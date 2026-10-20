using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Identity;
using Tohe.Api.Modules.Links;

namespace Tohe.Api.Modules.Admin;

/// <summary>
/// The console's share links (ADR 0044): find one by its code — its maker, state and every count by day — and revoke
/// it, with step-up level 2 and an audit entry. Read with the permission to find accounts, revoked by moderators.
/// </summary>
internal static class LinksEndpoints
{
    public static void Map(RouteGroupBuilder admin)
    {
        admin.MapGet("/links/{code}", FindAsync)
            .RequirePermission(AdminPermissions.UsersRead)
            .WithName("GetAdminShareLink")
            .WithSummary("A share link by its code, typed any way codes are read: its maker, state and every count by day.");

        admin.MapPost("/links/{code}/revoke", RevokeAsync)
            .RequirePermission(AdminPermissions.ProfilesModerate)
            .RequireStepUp()
            .WithName("RevokeAdminShareLink")
            .WithSummary("Revoke a share link: it resolves as revoked from now on, and its preview is the generic one.");
    }

    private static async Task<Results<Ok<AdminShareLinkView>, NotFound>> FindAsync(string code, ShareLinksAdmin links, CancellationToken ct) =>
        await links.FindAsync(code, ct) is { } link ? TypedResults.Ok(link) : TypedResults.NotFound();

    private static async Task<Results<Ok<AdminShareLinkView>, NotFound>> RevokeAsync(
        string code,
        HttpContext http,
        UserManager<Account> users,
        ShareLinksAdmin links,
        AdminAudit audit,
        ToheDbContext db,
        CancellationToken ct)
    {
        if (await links.RevokeAsync(code, ct) is not var (link, changed))
        {
            return TypedResults.NotFound();
        }

        // The revoke and its audit entry are saved together; revoking again changes nothing and logs nothing.
        if (changed)
        {
            var actor = AdminActor.Of((await users.FindByIdAsync(AdminCaller.Of(http).AccountId.ToString()))!, http);
            audit.Add(actor, AuditActions.LinkRevoke, $"share link {link.Code} ({link.GameId})", new { maker = link.Maker.ProfileId });
            await db.SaveChangesAsync(ct);
        }

        return TypedResults.Ok(link);
    }
}
