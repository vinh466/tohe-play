using System.Text.RegularExpressions;

namespace Tohe.Api.Modules.Agents;

/// <summary>A scope an agent token may hold (ADR 0052): its name, <c>area.verb</c>, and what it allows.</summary>
public sealed record AgentScope(string Name, string Description);

/// <summary>
/// The scopes agents may hold (ADR 0052): a closed list in code, not configuration — a new one is a code change,
/// reviewed, with its area's ADR. No scope may fall in the families no agent ever gets (<see cref="IsAllowedName"/>);
/// the API's tests fail when one does.
/// </summary>
public static partial class AgentScopes
{
    /// <summary>Create and change the agent's own drafts in the Studio, upload draft files, run the checks without saving (ADR 0051).</summary>
    public static readonly AgentScope StudioDraft = new(
        "studio.draft",
        "Create and change its own drafts in the Asset Studio, upload draft files, run the checks without saving");

    /// <summary>Every scope there is.</summary>
    public static readonly IReadOnlyList<AgentScope> All = [StudioDraft];

    /// <summary>
    /// Areas no scope may name as its first segment: players' data, signing in, power over people, the console, secrets
    /// and settings (ADR 0052).
    /// </summary>
    public static readonly IReadOnlyList<string> ForbiddenAreas =
    [
        "players", "player", "accounts", "account", "users", "user", "profiles", "profile", "progress", "scores",
        "score", "rooms", "room", "links", "link", "identity", "auth", "sessions", "session", "roles", "role",
        "agents", "agent", "admin", "console", "secrets", "secret", "settings", "setting",
    ];

    /// <summary>
    /// Verbs no segment of a scope may be: a person decides these (ADR 0052) — deleting, approving and its kin, and
    /// giving or taking power.
    /// </summary>
    public static readonly IReadOnlyList<string> ForbiddenVerbs =
        ["delete", "remove", "purge", "approve", "review", "deprecate", "withdraw", "grant", "revoke"];

    /// <summary>The scope of this name, or null when there is none.</summary>
    public static AgentScope? Find(string name) => All.FirstOrDefault(scope => scope.Name == name);

    /// <summary>
    /// Whether a scope may have this name: <c>area.verb</c> in lower-case letters, an area outside
    /// <see cref="ForbiddenAreas"/> and no segment among <see cref="ForbiddenVerbs"/>.
    /// </summary>
    public static bool IsAllowedName(string name)
    {
        if (!Shape().IsMatch(name))
        {
            return false;
        }

        var segments = name.Split('.');
        return !ForbiddenAreas.Contains(segments[0], StringComparer.Ordinal)
            && !segments.Any(segment => ForbiddenVerbs.Contains(segment, StringComparer.Ordinal));
    }

    [GeneratedRegex("^[a-z]+\\.[a-z]+$")]
    private static partial Regex Shape();
}
