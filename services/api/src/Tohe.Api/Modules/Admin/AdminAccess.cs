using Microsoft.AspNetCore.Identity;
using Tohe.Api.Modules.Identity;

namespace Tohe.Api.Modules.Admin;

/// <summary>
/// What a platform role may do in the admin console (ADR 0027). Code checks these permissions, never role names, so
/// what a role may do changes here alone.
/// </summary>
internal static class AdminPermissions
{
    /// <summary>
    /// Any signed-in account, with a role or none: who is asking (<c>GET /api/admin/me</c>) and setup, so the console
    /// can tell a player how a role comes, and the first owner can claim a new deployment.
    /// </summary>
    public const string SignedIn = "signed-in";

    /// <summary>The read-only pages: overview, games, device health, system — and the account's own two-factor setup.</summary>
    public const string Read = "admin.read";

    /// <summary>The audit log: who did what in the console.</summary>
    public const string AuditRead = "admin.audit.read";

    /// <summary>
    /// Every role reads; owners and admins read the audit log too. A permission to change something arrives with the
    /// page that changes it (users, sign-in settings…), given here to the roles that hold it.
    /// </summary>
    public static IReadOnlyList<string> Of(PlatformRole? role) => role switch
    {
        null => [],
        PlatformRole.Owner or PlatformRole.Admin => [Read, AuditRead],
        _ => [Read],
    };
}

/// <summary>The permission an admin endpoint needs; an endpoint without one is refused to everyone.</summary>
internal sealed record AdminPermission(string Name);

/// <summary>An endpoint of the console's own two-factor setup, open before two-factor authentication passed.</summary>
internal sealed record WithoutTwoFactorCheck;

/// <summary>An endpoint that changes something sensitive: step-up level 2 must be open on the device (ADR 0025).</summary>
internal sealed record StepUpRequired;

/// <summary>The account calling the admin API, and the role it holds now, if any.</summary>
internal sealed record AdminCaller(Guid AccountId, PlatformRole? Role)
{
    public static AdminCaller Of(HttpContext http) => (AdminCaller)http.Items[typeof(AdminCaller)]!;
}

/// <summary>
/// Guards every <c>/api/admin</c> endpoint, in order: signed in (401); a role, read from the database for this
/// request, that grants the permission the endpoint declares (403 <c>admin_required</c>); two-factor authentication
/// on the account (<c>two_factor_setup_required</c>) and passed on this device (<c>two_factor_required</c>), except for
/// <c>signed-in</c> endpoints and the two-factor setup itself; step-up level 2 where the endpoint asks for it
/// (<c>step_up_required</c>).
/// </summary>
internal sealed class AdminAccess : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        var http = context.HttpContext;
        if (SessionClaims.AccountId(http.User) is not { } accountId)
        {
            return TypedResults.Unauthorized();
        }

        // One filter serves every request: what it reads comes from the request's own services.
        var services = http.RequestServices;
        var users = services.GetRequiredService<UserManager<Account>>();
        var clock = services.GetRequiredService<TimeProvider>();
        var metadata = http.GetEndpoint()?.Metadata;
        var needs = metadata?.GetMetadata<AdminPermission>();
        var role = await services.GetRequiredService<PlatformRoles>().RoleOfAsync(accountId, http.RequestAborted);
        var allowed = needs is not null
            && (needs.Name == AdminPermissions.SignedIn || AdminPermissions.Of(role).Contains(needs.Name));
        if (!allowed)
        {
            return Problems.Of(StatusCodes.Status403Forbidden, "admin_required", "This account may not do this in the admin console");
        }

        var now = clock.GetUtcNow();
        if (needs!.Name != AdminPermissions.SignedIn && metadata!.GetMetadata<WithoutTwoFactorCheck>() is null)
        {
            if (await users.FindByIdAsync(accountId.ToString()) is not { TwoFactorEnabled: true })
            {
                return Problems.Of(StatusCodes.Status403Forbidden, "two_factor_setup_required", "Set up two-factor authentication first");
            }

            if (!SessionClaims.IsAdminOpen(http.User, now))
            {
                return Problems.Of(StatusCodes.Status403Forbidden, "two_factor_required", "Enter a code from the authenticator first");
            }
        }

        if (metadata?.GetMetadata<StepUpRequired>() is not null && !SessionClaims.IsSecure(http.User, now))
        {
            return Problems.StepUpRequired();
        }

        http.Items[typeof(AdminCaller)] = new AdminCaller(accountId, role);
        return await next(context);
    }
}

internal static class AdminAccessExtensions
{
    /// <summary>Declares the permission an admin endpoint needs (ADR 0027).</summary>
    public static RouteHandlerBuilder RequirePermission(this RouteHandlerBuilder endpoint, string permission) =>
        endpoint.WithMetadata(new AdminPermission(permission));

    /// <summary>Opens an endpoint of the two-factor setup before two-factor authentication passed.</summary>
    public static RouteHandlerBuilder WithoutTwoFactor(this RouteHandlerBuilder endpoint) =>
        endpoint.WithMetadata(new WithoutTwoFactorCheck());

    /// <summary>Asks for step-up level 2 on the device (ADR 0025).</summary>
    public static RouteHandlerBuilder RequireStepUp(this RouteHandlerBuilder endpoint) =>
        endpoint.WithMetadata(new StepUpRequired());
}
