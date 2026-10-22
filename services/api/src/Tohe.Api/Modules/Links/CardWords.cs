using Tohe.Api.Infrastructure;

namespace Tohe.Api.Modules.Links;

/// <summary>
/// The words of a link preview card in one language (ADR 0047): the card speaks the language of the link's maker, or of
/// the table's host, kept with the link or the table. A card that names no game — unknown, dead, private, past the
/// limits — speaks Vietnamese, the default, so it says nothing about what stands behind the code.
/// </summary>
/// <param name="Language">The page's <c>lang</c>, and the tag a game's names are looked up by (ADR 0048).</param>
/// <param name="Locale">The card's <c>og:locale</c>.</param>
/// <param name="Description">What the app's own page says, in this language: the description of every card.</param>
/// <param name="Open">The card's link to the app, for a browser with scripts off.</param>
/// <param name="AnyTable">The title of a table's card that names nothing: the same for every such table.</param>
/// <param name="TableOf">The title of a listed table's card, from the game's name.</param>
/// <param name="Invites">The title of a share link's card, from its maker's name and the game's.</param>
/// <param name="InviteTo">The title of a share link's card made by a child's profile, naming no one, from the
/// game's name.</param>
internal sealed record CardWords(
    string Language,
    string Locale,
    string Description,
    string Open,
    string AnyTable,
    Func<string, string> TableOf,
    Func<string, string, string> Invites,
    Func<string, string> InviteTo)
{
    /// <summary>
    /// The Vietnamese words — the default. The description is the one in apps/hub/index.html (the app's own card) and in
    /// apps/web/src/content/home.ts: keep them in step.
    /// </summary>
    public static readonly CardWords Vietnamese = new(
        Languages.Vietnamese,
        "vi_VN",
        "Game nhỏ, mở ra là chơi: không quảng cáo, không cần tài khoản. Giữ tiến độ khi bạn muốn, rủ bạn vào cùng bàn bằng một link.",
        "Mở Tò He",
        "Lời mời vào bàn chơi Tò He",
        game => $"Lời mời vào bàn {game}",
        (maker, game) => $"{maker} mời bạn chơi {game}",
        game => $"Lời mời chơi {game}");

    /// <summary>The English words. The description is the English home page's, in apps/web/src/content/home.ts.</summary>
    public static readonly CardWords English = new(
        Languages.English,
        "en_US",
        "Small games you open and play: no ads, no account needed. Keep your progress when you want to, and bring friends to your table with one link.",
        "Open Tò He",
        "An invite to a table on Tò He",
        game => $"An invite to a {game} table",
        (maker, game) => $"{maker} invites you to play {game}",
        game => $"An invite to play {game}");

    /// <summary>The words of a kept language; Vietnamese for anything else.</summary>
    public static CardWords In(string? language) => language == Languages.English ? English : Vietnamese;
}
