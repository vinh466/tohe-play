using Tohe.Api.Modules.Identity;

namespace Tohe.Api.Modules.Admin;

/// <summary>
/// What a platform role may do in the admin console (ADR 0027). Code checks these permissions, never role names, so
/// what a role may do changes here alone.
/// </summary>
internal static class AdminPermissions
{
    /// <summary>
    /// Any signed-in account, with a role or none: only who is asking (<c>GET /api/admin/me</c>), so the console can tell
    /// a player without a role how one is granted.
    /// </summary>
    public const string SignedIn = "signed-in";

    /// <summary>The read-only pages: overview, games, device health, system.</summary>
    public const string Read = "admin.read";

    /// <summary>
    /// Every role reads. A permission to change something arrives with the page that changes it (users, sign-in
    /// settings…), given here to the roles that hold it.
    /// </summary>
    public static IReadOnlyList<string> Of(PlatformRole? role) => role is null ? [] : [Read];
}

/// <summary>The permission an admin endpoint needs; an endpoint without one is refused to everyone.</summary>
internal sealed record AdminPermission(string Name);

/// <summary>The account calling the admin API, and the role it holds now, if any.</summary>
internal sealed record AdminCaller(Guid AccountId, PlatformRole? Role)
{
    public static AdminCaller Of(HttpContext http) => (AdminCaller)http.Items[typeof(AdminCaller)]!;
}

/// <summary>
/// Guards every <c>/api/admin</c> endpoint: a signed-in account whose role, read from the database for this request,
/// grants the permission the endpoint declares. Signed out is 401; anything else short of that is 403
/// <c>admin_required</c>.
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

        var needs = http.GetEndpoint()?.Metadata.GetMetadata<AdminPermission>();
        var role = await http.RequestServices.GetRequiredService<PlatformRoles>().RoleOfAsync(accountId, http.RequestAborted);
        var allowed = needs is not null
            && (needs.Name == AdminPermissions.SignedIn || AdminPermissions.Of(role).Contains(needs.Name));
        if (!allowed)
        {
            return Problems.Of(StatusCodes.Status403Forbidden, "admin_required", "This account may not do this in the admin console");
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
}
