using System.Text;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Options;
using Tohe.Api.Infrastructure;
using Tohe.Api.Modules.Platform;
using Tohe.Api.Modules.Registry;
using Tohe.Api.Modules.Rooms;

namespace Tohe.Api.Modules.Links;

/// <summary>What a link preview card says: every value plain text, escaped when the card is rendered.</summary>
internal sealed record PreviewCard(string Title, string Description);

/// <summary>
/// Link previews of room and share links, for crawlers only (ADR 0044): the hub's Caddy rewrites a known crawler's
/// <c>/r/&lt;code&gt;</c> and <c>/s/&lt;code&gt;</c> here and passes the answer through, never into a template. This renders
/// and escapes every value itself, answers 200 every time — the generic card for anything unknown, dead, or past the
/// limits — and never names anyone at a table, nor a child.
/// </summary>
internal sealed partial class LinkPreviews(
    ShareLinks links, IRoomPreviews rooms, IRegistryGames games, IOptions<AppOptions> app, LinkLimits limits)
{
    /// <summary>What the app's own page says (apps/hub/index.html): the generic card.</summary>
    public const string Description =
        "Game nhỏ, mở ra là chơi: không quảng cáo, không cần tài khoản. Giữ tiến độ khi bạn muốn, rủ bạn vào cùng bàn bằng một link.";

    public static readonly PreviewCard Generic = new("Tò He", Description);

    /// <summary>A table's card when it is not listed publicly, or not there: the same for all, naming no one.</summary>
    public static readonly PreviewCard Table = new("Lời mời vào bàn chơi Tò He", Description);

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
            card = new PreviewCard($"Lời mời vào bàn {game.Name}", Description);
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
            // The maker's current name on the server — a moderator's when one renamed it — never a child's.
            card = maker.Child
                ? new PreviewCard($"Lời mời chơi {game.Name}", Description)
                : new PreviewCard($"{maker.Name} mời bạn chơi {game.Name}", Description);
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
        return Results.Content(Render(card, url, $"{hub}/og.png"), "text/html; charset=utf-8", Encoding.UTF8, StatusCodes.Status200OK);
    }

    /// <summary>The card as a small HTML page: <c>og:</c> and <c>twitter:</c> tags and a link to the app.</summary>
    public static string Render(PreviewCard card, string url, string image)
    {
        var title = Escape(card.Title);
        var description = Escape(card.Description);
        var href = Escape(url);
        var picture = Escape(image);
        return $"""
            <!doctype html>
            <html lang="vi">
            <head>
            <meta charset="utf-8">
            <title>{title}</title>
            <meta name="robots" content="noindex">
            <meta name="description" content="{description}">
            <meta property="og:type" content="website">
            <meta property="og:site_name" content="Tò He">
            <meta property="og:locale" content="vi_VN">
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
            <p><a href="{href}">{title}</a></p>
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
