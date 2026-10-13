using System.Text.RegularExpressions;

namespace Tohe.Api.Modules.Identity;

/// <summary>Allowed values for profiles. Served to the hub by <c>GET /api/profiles/options</c>.</summary>
public static partial class ProfileOptions
{
    public static IReadOnlyList<string> Avatars { get; } =
    [
        "🦊", "🐼", "🐯", "🐸", "🐧", "🐨", "🦁", "🐰",
        "🐱", "🐶", "🦄", "🐙", "🐢", "🦖", "🐝", "🦉",
    ];

    /// <summary>Age bands for children, as "min-max" years. The lower bound filters games by <c>minAge</c>.</summary>
    public static IReadOnlyList<string> AgeBands { get; } = ["3-5", "6-8", "9-12", "13-17"];

    public const int MaxProfilesPerHousehold = 12;

    public static int MinAgeOf(string ageBand) => int.Parse(ageBand.Split('-')[0], System.Globalization.CultureInfo.InvariantCulture);

    [GeneratedRegex("^[0-9]{4}$")]
    public static partial Regex Pin();
}

/// <summary>Allowed avatars and age bands.</summary>
public sealed record ProfileOptionsView(IReadOnlyList<string> Avatars, IReadOnlyList<string> AgeBands);
