using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Identity;
using Tohe.Api.Modules.Identity;

namespace Tohe.Api.Modules.Admin;

/// <summary>
/// What a platform role may do in the admin console (ADR 0027). Code checks these permissions, never role names, so
/// what a role may do changes here alone.
/// </summary>
internal static class AdminPermissions
{
    /// <summary>Any console session — every one holds a role: its own step-up.</summary>
    public const string SignedIn = "signed-in";

    /// <summary>The read-only pages: overview, games, device health, system — and the account's own two-factor authentication.</summary>
    public const string Read = "admin.read";

    /// <summary>The audit log: who did what in the console.</summary>
    public const string AuditRead = "admin.audit.read";

    /// <summary>Find accounts and see one: its sign-in methods, role, suspension, profiles and their names.</summary>
    public const string UsersRead = "admin.users.read";

    /// <summary>Suspend an account or lift that, and end its sessions.</summary>
    public const string UsersWrite = "admin.users.write";

    /// <summary>Give or take platform roles.</summary>
    public const string RolesWrite = "admin.roles.write";

    /// <summary>Rename a profile whose name breaks the rules of a community.</summary>
    public const string ProfilesModerate = "admin.profiles.moderate";

    /// <summary>Switch sign-in methods and the registration mode; communities and their invite codes (ADR 0028).</summary>
    public const string SettingsWrite = "admin.settings.write";

    /// <summary>Review the results the integrity engine held: approve, reject, reopen (ADR 0029).</summary>
    public const string ResultsReview = "admin.results.review";

    /// <summary>See agents, their tokens — never a token itself — and each agent's audit (ADR 0052).</summary>
    public const string AgentsRead = "admin.agents.read";

    /// <summary>Make and disable agents, make and revoke their tokens (ADR 0052): the owner alone.</summary>
    public const string AgentsWrite = "admin.agents.write";

    /// <summary>Give and take studio roles (ADR 0051): the owner alone.</summary>
    public const string StudioWrite = "admin.studio.write";

    /// <summary>
    /// What each role may: owners everything, admins all but roles, changing agents and studio roles, moderators find
    /// accounts and rename profiles, viewers read. A permission to change something new arrives with its page, given here
    /// to the roles that hold it.
    /// </summary>
    public static IReadOnlyList<string> Of(PlatformRole? role) => role switch
    {
        null => [],
        PlatformRole.Owner => [Read, AuditRead, UsersRead, UsersWrite, RolesWrite, ProfilesModerate, SettingsWrite, ResultsReview, AgentsRead, AgentsWrite, StudioWrite],
        PlatformRole.Admin => [Read, AuditRead, UsersRead, UsersWrite, ProfilesModerate, SettingsWrite, ResultsReview, AgentsRead],
        PlatformRole.Moderator => [Read, UsersRead, ProfilesModerate, ResultsReview],
        _ => [Read],
    };
}

/// <summary>The permission an admin endpoint needs; an endpoint without one is refused to everyone.</summary>
internal sealed record AdminPermission(string Name);

/// <summary>An endpoint that changes something sensitive: step-up level 2 must be open in the console session (ADR 0025).</summary>
internal sealed record StepUpRequired;

/// <summary>The account calling the admin API, and the role it holds now.</summary>
internal sealed record AdminCaller(Guid AccountId, PlatformRole Role)
{
    public static AdminCaller Of(HttpContext http) => (AdminCaller)http.Items[typeof(AdminCaller)]!;
}

/// <summary>
/// Guards every endpoint behind the console's session (ADR 0042), in order: a console session (401 — the players'
/// session counts for nothing here); the account still holds a role and two-factor authentication, both read from the
/// database for this request, or the session ends (401); the role grants the permission the endpoint declares (403
/// <c>admin_required</c>); step-up level 2 in the console session where the endpoint asks for it
/// (<c>step_up_required</c>).
/// </summary>
internal sealed class AdminAccess : IEndpointFilter
{
    /// <summary>
    /// The account of this console session and the role it holds now, both read from the database; null without a
    /// console session. What let the session start must still hold: with the role taken away, or two-factor
    /// authentication off, the session ends here.
    /// </summary>
    public static async Task<(Account Account, PlatformRole Role)?> CallerAsync(HttpContext http)
    {
        if (SessionClaims.AccountId(http.User) is not { } accountId)
        {
            return null;
        }

        // What it reads comes from the request's own services.
        var services = http.RequestServices;
        var role = await services.GetRequiredService<PlatformRoles>().RoleOfAsync(accountId, http.RequestAborted);
        var account = await services.GetRequiredService<UserManager<Account>>().FindByIdAsync(accountId.ToString());
        if (role is not { } held || account is not { TwoFactorEnabled: true })
        {
            await http.SignOutAsync(ConsoleSession.Scheme);
            return null;
        }

        return (account, held);
    }

    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        var http = context.HttpContext;
        if (await CallerAsync(http) is not var (account, held))
        {
            return TypedResults.Unauthorized();
        }

        var services = http.RequestServices;
        var metadata = http.GetEndpoint()?.Metadata;
        var needs = metadata?.GetMetadata<AdminPermission>();
        var allowed = needs is not null
            && (needs.Name == AdminPermissions.SignedIn || AdminPermissions.Of(held).Contains(needs.Name));
        if (!allowed)
        {
            return Problems.Of(StatusCodes.Status403Forbidden, "admin_required", "This account may not do this in the console");
        }

        var now = services.GetRequiredService<TimeProvider>().GetUtcNow();
        if (metadata?.GetMetadata<StepUpRequired>() is not null && !SessionClaims.IsSecure(http.User, now))
        {
            return Problems.StepUpRequired();
        }

        http.Items[typeof(AdminCaller)] = new AdminCaller(account.Id, held);
        return await next(context);
    }
}

internal static class AdminAccessExtensions
{
    /// <summary>Declares the permission an admin endpoint needs (ADR 0027).</summary>
    public static RouteHandlerBuilder RequirePermission(this RouteHandlerBuilder endpoint, string permission) =>
        endpoint.WithMetadata(new AdminPermission(permission));

    /// <summary>Asks for step-up level 2 in the console session (ADR 0025).</summary>
    public static RouteHandlerBuilder RequireStepUp(this RouteHandlerBuilder endpoint) =>
        endpoint.WithMetadata(new StepUpRequired());
}
