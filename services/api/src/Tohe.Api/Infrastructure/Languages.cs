namespace Tohe.Api.Infrastructure;

/// <summary>
/// The two languages the players' surfaces speak (ADR 0047): Vietnamese, the face and the default, and English. The API
/// keeps one with each share link and each table — the language the hub spoke when it made the link or opened the
/// table — and the link previews speak it.
/// </summary>
public static class Languages
{
    public const string Vietnamese = "vi";

    public const string English = "en";

    /// <summary>The longest name of one: what its column holds.</summary>
    public const int MaxLength = 2;

    /// <summary>
    /// The language a request asked for: <c>vi</c> or <c>en</c>, exactly — or Vietnamese when it asked for none. False
    /// for anything else, which the endpoint refuses.
    /// </summary>
    public static bool TryParse(string? name, out string language)
    {
        (var known, language) = name switch
        {
            null => (true, Vietnamese),
            Vietnamese => (true, Vietnamese),
            English => (true, English),
            _ => (false, Vietnamese),
        };
        return known;
    }
}
