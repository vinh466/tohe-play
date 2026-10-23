using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Admin;
using Tohe.Api.Modules.Identity;

namespace Tohe.Api.Modules.Studio;

/// <summary>An account with a studio role, as the console shows it.</summary>
/// <param name="Role"><c>contributor</c> or <c>reviewer</c>.</param>
/// <param name="TwoFactorEnabled">The account has an authenticator: without one a reviewer cannot sign in to the Studio.</param>
/// <param name="GrantedBy">The account that gave the role.</param>
/// <param name="GrantedByName">Its email — or name — while it exists.</param>
public sealed record StudioMemberView(
    Guid AccountId,
    string? Email,
    string DisplayName,
    string Role,
    bool TwoFactorEnabled,
    DateTimeOffset GrantedAt,
    Guid GrantedBy,
    string? GrantedByName);

/// <param name="Email">The account's email; or</param>
/// <param name="AccountId">its id.</param>
/// <param name="Role"><c>contributor</c> or <c>reviewer</c>.</param>
public sealed record GrantStudioRoleRequest(string? Email, Guid? AccountId, string? Role);

/// <summary>
/// Studio roles in the console (ADR 0051): owners, admins and moderators see who holds one; only the owner gives,
/// changes and takes them, behind step-up level 2, each change in the console's audit log in the same transaction.
/// Taking a role away ends the account's Studio session at its next request, which reads the role again.
/// </summary>
internal static class StudioConsoleEndpoints
{
    public static void Map(RouteGroupBuilder admin)
    {
        var members = admin.MapGroup("/studio/members").WithTags("Studio");

        members.MapGet("/", ListAsync)
            .RequirePermission(AdminPermissions.UsersRead)
            .WithName("GetAdminStudioMembers")
            .WithSummary("Every account with a studio role, reviewers first, then the latest given.");

        members.MapPost("/", GrantAsync)
            .RequirePermission(AdminPermissions.StudioWrite)
            .RequireStepUp()
            .WithName("GrantAdminStudioRole")
            .WithSummary("Give a studio role — or change it — to an account named by its email or its id.");

        members.MapDelete("/{accountId:guid}", RevokeAsync)
            .RequirePermission(AdminPermissions.StudioWrite)
            .RequireStepUp()
            .WithName("RevokeAdminStudioRole")
            .WithSummary("Take a studio role away: the account's Studio session ends at its next request.");
    }

    private static async Task<Ok<IReadOnlyList<StudioMemberView>>> ListAsync(ToheDbContext db, UserManager<Account> users, CancellationToken ct)
    {
        var members = await db.StudioMembers.AsNoTracking().ToListAsync(ct);
        return TypedResults.Ok(await ViewsAsync(members, users, ct));
    }

    private static async Task<Results<Ok<StudioMemberView>, ValidationProblem, ProblemHttpResult>> GrantAsync(
        GrantStudioRoleRequest request,
        HttpContext http,
        UserManager<Account> users,
        AdminAudit audit,
        ToheDbContext db,
        TimeProvider clock,
        CancellationToken ct)
    {
        if (StudioRoles.Parse(request.Role) is not { } role)
        {
            return Problems.Field("role", "role_invalid");
        }

        var email = request.Email?.Trim();
        if (string.IsNullOrEmpty(email) == (request.AccountId is null))
        {
            return Problems.Field("account", "account_required");
        }

        var account = request.AccountId is { } id
            ? await users.FindByIdAsync(id.ToString())
            : await users.FindByEmailAsync(email!);
        if (account is null)
        {
            return AccountNotFound();
        }

        // The owner may give themselves a role: the owner who reviews holds reviewer as well (ADR 0051).
        var member = await db.StudioMembers.FindAsync([account.Id], ct);
        var before = member?.Role;
        if (before != role)
        {
            var caller = AdminCaller.Of(http);
            var now = clock.GetUtcNow();
            if (member is null)
            {
                member = new StudioMember { AccountId = account.Id };
                db.StudioMembers.Add(member);
            }

            member.Role = role;
            member.GrantedBy = caller.AccountId;
            member.GrantedAt = now;
            audit.Add(
                await ActorAsync(http, users),
                AuditActions.StudioMemberGrant,
                Label(account),
                new { role = StudioRoles.NameOf(role), before = before is { } held ? StudioRoles.NameOf(held) : null });
            try
            {
                await db.SaveChangesAsync(ct);
            }
            catch (DbUpdateException e) when (e.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
            {
                // Two grants at once for the same account: the other one won; say what holds now.
                db.ChangeTracker.Clear();
            }
        }

        var saved = await db.StudioMembers.AsNoTracking().SingleAsync(held => held.AccountId == account.Id, ct);
        return TypedResults.Ok((await ViewsAsync([saved], users, ct))[0]);
    }

    private static async Task<Results<NoContent, ProblemHttpResult>> RevokeAsync(
        Guid accountId,
        HttpContext http,
        UserManager<Account> users,
        AdminAudit audit,
        ToheDbContext db,
        CancellationToken ct)
    {
        if (await db.StudioMembers.FindAsync([accountId], ct) is not { } member)
        {
            return Problems.Of(StatusCodes.Status404NotFound, "studio_member_not_found", "This account holds no studio role");
        }

        var account = await users.FindByIdAsync(accountId.ToString());
        db.StudioMembers.Remove(member);
        audit.Add(
            await ActorAsync(http, users),
            AuditActions.StudioMemberRevoke,
            account is null ? $"account {accountId}" : Label(account),
            new { role = StudioRoles.NameOf(member.Role) });
        await db.SaveChangesAsync(ct);
        return TypedResults.NoContent();
    }

    private static async Task<IReadOnlyList<StudioMemberView>> ViewsAsync(
        IReadOnlyCollection<StudioMember> members, UserManager<Account> users, CancellationToken ct)
    {
        var ids = members.Select(member => member.AccountId).Concat(members.Select(member => member.GrantedBy)).Distinct().ToList();
        var accounts = await users.Users.AsNoTracking()
            .Where(account => ids.Contains(account.Id))
            .Select(account => new { account.Id, account.Email, account.UserName, account.DisplayName, account.TwoFactorEnabled })
            .ToDictionaryAsync(account => account.Id, ct);
        return
        [
            .. members
                .Where(member => accounts.ContainsKey(member.AccountId))
                .OrderByDescending(member => member.Role)
                .ThenByDescending(member => member.GrantedAt)
                .Select(member =>
                {
                    var account = accounts[member.AccountId];
                    var granter = accounts.GetValueOrDefault(member.GrantedBy);
                    return new StudioMemberView(
                        member.AccountId,
                        account.Email,
                        account.DisplayName,
                        StudioRoles.NameOf(member.Role),
                        account.TwoFactorEnabled,
                        member.GrantedAt,
                        member.GrantedBy,
                        granter is null ? null : granter.Email ?? granter.UserName ?? granter.DisplayName);
                }),
        ];
    }

    private static string Label(Account account) => $"{account.Email ?? account.UserName} ({account.DisplayName})";

    private static ProblemHttpResult AccountNotFound() =>
        Problems.Of(StatusCodes.Status404NotFound, "account_not_found", "No account has this email or id");

    private static async Task<AdminActor> ActorAsync(HttpContext http, UserManager<Account> users) =>
        AdminActor.Of((await users.FindByIdAsync(AdminCaller.Of(http).AccountId.ToString()))!, http);
}
