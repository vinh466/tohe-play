using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Identity;
using Tohe.Api.Modules.Identity;

namespace Tohe.Api.Modules.Studio;

/// <summary>
/// What a studio role may do in the Studio (ADR 0051). Code checks these permissions, never role names, so what a role
/// may do changes here alone.
/// </summary>
internal static class StudioPermissions
{
    /// <summary>Read styles, packs and drafts.</summary>
    public const string Read = "studio.read";

    /// <summary>Make and change drafts, upload draft files, run the checks without saving.</summary>
    public const string Contribute = "studio.contribute";

    /// <summary>Approve, reject and deprecate pack versions, behind step-up; and the step-up itself.</summary>
    public const string Review = "studio.review";

    public static IReadOnlyList<string> Of(StudioRole? role) => role switch
    {
        null => [],
        StudioRole.Reviewer => [Read, Contribute, Review],
        _ => [Read, Contribute],
    };
}

/// <summary>The permission a Studio endpoint needs; an endpoint without one is refused to everyone.</summary>
internal sealed record StudioPermission(string Name);

/// <summary>A review action: step-up — a fresh code from the authenticator — must be open in the Studio session.</summary>
internal sealed record StudioStepUpRequired;

/// <summary>The account calling the Studio's API, and the studio role it holds now.</summary>
internal sealed record StudioCaller(Guid AccountId, StudioRole Role)
{
    public static StudioCaller Of(HttpContext http) => (StudioCaller)http.Items[typeof(StudioCaller)]!;
}

/// <summary>
/// Guards every endpoint behind the Studio's session, in order: a Studio session (401 — a player's or the console's
/// session counts for nothing here); the account still holds a studio role, and a reviewer two-factor authentication,
/// both read from the database for this request, or the session ends (401); the role grants the permission the
/// endpoint declares (403 <c>studio_required</c>); step-up in the Studio session where the endpoint asks for it
/// (<c>step_up_required</c>).
/// </summary>
internal sealed class StudioAccess : IEndpointFilter
{
    /// <summary>
    /// The account of this Studio session and the role it holds now, both read from the database; null without a Studio
    /// session. What let the session start must still hold: with the role taken away, or a reviewer's two-factor
    /// authentication off, the session ends here.
    /// </summary>
    public static async Task<(Account Account, StudioRole Role)?> CallerAsync(HttpContext http)
    {
        if (SessionClaims.AccountId(http.User) is not { } accountId || StudioSession.Until(http.User) is null)
        {
            return null;
        }

        var services = http.RequestServices;
        var role = await services.GetRequiredService<StudioRoles>().RoleOfAsync(accountId, http.RequestAborted);
        var account = await services.GetRequiredService<UserManager<Account>>().FindByIdAsync(accountId.ToString());
        if (role is not { } held || account is null || !StudioRoles.MayHoldSession(held, account))
        {
            await http.SignOutAsync(StudioSession.Scheme);
            return null;
        }

        return (account, held);
    }

    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next) =>
        await RefuseAsync(context.HttpContext) ?? await next(context);

    /// <summary>
    /// The checks of this filter, in its order: null when the Studio session may call the endpoint — the caller is then
    /// in <see cref="StudioCaller"/> — or the answer that refuses it.
    /// </summary>
    public static async Task<IResult?> RefuseAsync(HttpContext http)
    {
        if (await CallerAsync(http) is not var (account, held))
        {
            return TypedResults.Unauthorized();
        }

        var metadata = http.GetEndpoint()?.Metadata;
        var needs = metadata?.GetMetadata<StudioPermission>();
        if (needs is null || !StudioPermissions.Of(held).Contains(needs.Name))
        {
            return Problems.Of(StatusCodes.Status403Forbidden, "studio_required", "This account may not do this in the Studio");
        }

        var now = http.RequestServices.GetRequiredService<TimeProvider>().GetUtcNow();
        if (metadata?.GetMetadata<StudioStepUpRequired>() is not null && !SessionClaims.IsSecure(http.User, now))
        {
            return Problems.StepUpRequired();
        }

        http.Items[typeof(StudioCaller)] = new StudioCaller(account.Id, held);
        return null;
    }
}

internal static class StudioAccessExtensions
{
    /// <summary>
    /// The Studio's session, and the checks of <see cref="StudioAccess"/>, on every endpoint of the group: what the
    /// Studio's endpoints are mapped on.
    /// </summary>
    public static RouteGroupBuilder RequireStudioSession(this RouteGroupBuilder group) =>
        group.AddEndpointFilter<StudioAccess>();

    /// <summary>Declares the permission a Studio endpoint needs (ADR 0051).</summary>
    public static RouteHandlerBuilder RequireStudioPermission(this RouteHandlerBuilder endpoint, string permission) =>
        endpoint.WithMetadata(new StudioPermission(permission));

    /// <summary>Asks for step-up in the Studio session: a fresh code from the authenticator.</summary>
    public static RouteHandlerBuilder RequireStudioStepUp(this RouteHandlerBuilder endpoint) =>
        endpoint.WithMetadata(new StudioStepUpRequired());
}
