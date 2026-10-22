using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Options;
using Tohe.Api.Infrastructure;
using Tohe.Api.Modules.Platform;
using Tohe.Api.Modules.Registry;
using Tohe.Api.Modules.Rooms;

namespace Tohe.Api.Modules.Links;

/// <summary>
/// What a link preview card says, in the words of its language: every value plain text, escaped when the card is
/// rendered.
/// </summary>
internal sealed record PreviewCard(string Title, string Description, CardWords Words);

/// <summary>
/// Link previews of room and share links, for crawlers only (ADR 0044): the hub's Caddy rewrites a known crawler's
/// <c>/r/&lt;code&gt;</c> and <c>/s/&lt;code&gt;</c> here and passes the answer through, never into a template. This renders
/// and escapes every value itself, answers 200 every time — the generic card for anything unknown, dead, or past the
/// limits — and never names anyone at a table, nor a child. A card that names a game speaks the language of the link's
/// maker or of the table's host (ADR 0047); the others speak Vietnamese. A person who lands here anyway — a crawler's
/// name in an in-app browser — is sent on to the app at once by the card's one script, or by its "Mở Tò He" link with
/// scripts off: <c>?app=1</c> keeps Caddy from sending them here again.
/// </summary>
internal sealed partial class LinkPreviews(
    ShareLinks links, IRoomPreviews rooms, IRegistryGames games, IOptions<AppOptions> app, LinkLimits limits)
{
    /// <summary>What the app's own page says (apps/hub/index.html): the generic card, in Vietnamese.</summary>
    public static readonly PreviewCard Generic = new("Tò He", CardWords.Vietnamese.Description, CardWords.Vietnamese);

    /// <summary>The query that marks a person sent on to the app: Caddy never answers it with a card (@tohe/routes).</summary>
    public const string AppQuery = "app=1";

    /// <summary>
    /// The card's only script: a browser that runs it goes on to the app at the same path — crawlers run no script. It is
    /// static, reads only <c>location</c>, and does nothing once the query says it went on already, so a card asked for
    /// at its API path never reloads itself.
    /// </summary>
    public const string SendOnScript = "if(!/[?&]app=/.test(location.search))location.replace(location.pathname+'?app=1')";

    /// <summary>
    /// The card's own CSP: nothing but <see cref="SendOnScript"/>, allowed by its hash. The hub's Caddy leaves it alone on
    /// the cards it rewrites here.
    /// </summary>
    public static readonly string ContentSecurityPolicy =
        $"default-src 'none'; script-src 'sha256-{Convert.ToBase64String(SHA256.HashData(Encoding.UTF8.GetBytes(SendOnScript)))}'; "
        + "base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

    /// <summary>
    /// A table's card when it is not listed publicly, or not there: the same for all, naming no one — in Vietnamese
    /// whatever its host speaks, so not even its language tells a private table from no table.
    /// </summary>
    public static readonly PreviewCard Table = new(CardWords.Vietnamese.AnyTable, CardWords.Vietnamese.Description, CardWords.Vietnamese);

    public static void Map(IEndpointRouteBuilder api)
    {
        var previews = api.MapGroup("/previews").AllowAnonymous().ExcludeFromDescription();
        // HEAD too: some crawlers ask it first.
        string[] methods = [HttpMethods.Get, HttpMethods.Head];
        previews.MapMethods("/r/{code}", methods, (string code, HttpContext http, LinkPreviews cards, CancellationToken ct) =>
            cards.RoomAsync(http, code, ct));
        previews.MapMethods("/s/{code}", methods, (string code, HttpContext http, LinkPreviews cards, CancellationToken ct) =>
            cards.ShareAsync(http, code, ct));
    }

    private async Task<IResult> RoomAsync(HttpContext http, string code, CancellationToken ct)
    {
        var card = Table;
        if (limits.TryPreview(http)
            && RoomCode().IsMatch(code)
            && rooms.FindByCode(code) is { Listed: true } room
            && await games.GetAsync(room.GameId, ct) is { } game)
        {
            // In the language the table was opened in, the game's name too (ADR 0047, 0048).
            var words = CardWords.In(room.Language);
            card = new PreviewCard(words.TableOf(game.NameIn(words.Language)), words.Description, words);
        }

        return Answer(http, card, HubPaths.RoomLink, code);
    }

    private async Task<IResult> ShareAsync(HttpContext http, string code, CancellationToken ct)
    {
        var card = Generic;
        if (limits.TryPreview(http)
            && await links.ResolveAsync(code, ct) is { State: LinkStates.Ok, Maker: { } maker } resolved
            && await games.GetAsync(resolved.Link.GameId, ct) is { } game)
        {
            // The maker's current name on the server — a moderator's when one renamed it — never a child's. In the
            // language the link was made in, the game's name too (ADR 0047, 0048).
            var words = CardWords.In(resolved.Link.Language);
            var name = game.NameIn(words.Language);
            card = maker.Child
                ? new PreviewCard(words.InviteTo(name), words.Description, words)
                : new PreviewCard(words.Invites(maker.Name, name), words.Description, words);
        }

        return Answer(http, card, HubPaths.ShareLink, code);
    }

    private IResult Answer(HttpContext http, PreviewCard card, string namespacePath, string code)
    {
        var hub = app.Value.PublicUrl?.GetLeftPart(UriPartial.Authority) ?? $"{http.Request.Scheme}://{http.Request.Host}";
        // Only a code that looks like one goes back into the card's address; anything else points at the hub.
        var url = PathCode().IsMatch(code) ? $"{hub}{namespacePath}/{code}" : $"{hub}/";
        http.Response.Headers["X-Robots-Tag"] = "noindex";
        http.Response.Headers.CacheControl = "no-cache";
        // The same address answers the app to a person: a cache in front (Cloudflare) must keep the two apart.
        http.Response.Headers.Vary = "User-Agent";
        http.Response.Headers.ContentSecurityPolicy = ContentSecurityPolicy;
        return Results.Content(Render(card, url, $"{hub}/og.png"), "text/html; charset=utf-8", Encoding.UTF8, StatusCodes.Status200OK);
    }

    /// <summary>
    /// The card as a small HTML page: <c>og:</c> and <c>twitter:</c> tags, the script that sends a person on, and a link
    /// to the app for a browser with scripts off.
    /// </summary>
    public static string Render(PreviewCard card, string url, string image)
    {
        var title = Escape(card.Title);
        var description = Escape(card.Description);
        var href = Escape(url);
        var picture = Escape(image);
        var words = card.Words;
        return $"""
            <!doctype html>
            <html lang="{Escape(words.Language)}">
            <head>
            <meta charset="utf-8">
            <title>{title}</title>
            <meta name="robots" content="noindex">
            <meta name="description" content="{description}">
            <meta property="og:type" content="website">
            <meta property="og:site_name" content="Tò He">
            <meta property="og:locale" content="{Escape(words.Locale)}">
            <meta property="og:url" content="{href}">
            <meta property="og:title" content="{title}">
            <meta property="og:description" content="{description}">
            <meta property="og:image" content="{picture}">
            <meta property="og:image:width" content="1200">
            <meta property="og:image:height" content="630">
            <meta name="twitter:card" content="summary_large_image">
            <meta name="twitter:title" content="{title}">
            <meta name="twitter:description" content="{description}">
            <meta name="twitter:image" content="{picture}">
            </head>
            <body>
            <p>{title}</p>
            <p><a href="{Escape(url + "?" + AppQuery)}">{Escape(words.Open)}</a></p>
            <script>{SendOnScript}</script>
            </body>
            </html>

            """;
    }

    /// <summary>
    /// Text as HTML, in an element or an attribute: <c>&amp; &lt; &gt; " ' `</c> and the braces of a template's
    /// <c>{{ }}</c> become character references, control characters go.
    /// </summary>
    public static string Escape(string text)
    {
        var html = new StringBuilder(text.Length + 16);
        foreach (var c in text)
        {
            switch (c)
            {
                case '&': html.Append("&amp;"); break;
                case '<': html.Append("&lt;"); break;
                case '>': html.Append("&gt;"); break;
                case '"': html.Append("&quot;"); break;
                case '\'': html.Append("&#39;"); break;
                case '`': html.Append("&#96;"); break;
                case '{': html.Append("&#123;"); break;
                case '}': html.Append("&#125;"); break;
                default:
                    if (!char.IsControl(c))
                    {
                        html.Append(c);
                    }

                    break;
            }
        }

        return html.ToString();
    }

    [GeneratedRegex("^[0-9]{6}$")]
    private static partial Regex RoomCode();

    /// <summary>What the hub's Caddy sends here: letters, digits and hyphens, at most 20.</summary>
    [GeneratedRegex("^[0-9A-Za-z-]{1,20}$")]
    private static partial Regex PathCode();
}
