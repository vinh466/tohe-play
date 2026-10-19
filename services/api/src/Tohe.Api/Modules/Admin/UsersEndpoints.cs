using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Identity;

namespace Tohe.Api.Modules.Admin;

/// <param name="Reason">Why, for the other admins; the account's owner is not shown it.</param>
public sealed record SuspendRequest(string? Reason);

/// <param name="Role"><c>owner</c>, <c>admin</c>, <c>moderator</c>, <c>viewer</c>, or none to take the role away.</param>
public sealed record SetRoleRequest(string? Role);

public sealed record RenameProfileRequest(string? Name);

/// <param name="Reason">Why, for the other admins; the profile's owner is only told that it is hidden.</param>
public sealed record HideProfileRequest(string? Reason);

/// <summary>
/// The console's users (ADR 0027): find an account by its address, a name or a profile ID, or those waiting to be
/// deleted; suspend it or lift that, end its sessions, give or take its role, rename one of its profiles or hide it
/// from public boards (ADR 0029), delete it for good once its owner asked and its seven days are over (ADR 0038).
/// Every change needs step-up level 2 and lands in the audit log with it. Nobody acts on their own account here, nor on one whose role is as strong as theirs — but an
/// owner may on another owner — and the last owner stays one.
/// </summary>
internal static class UsersEndpoints
{
    private const int MaxReason = 300;

    public static void Map(RouteGroupBuilder admin)
    {
        admin.MapGet("/users", SearchAsync)
            .RequirePermission(AdminPermissions.UsersRead)
            .WithName("SearchAdminUsers")
            .WithSummary("Accounts by email, username, name or profile ID (four digits or more); the newest first, fifty at most.");

        admin.MapGet("/users/{id:guid}", DetailAsync)
            .RequirePermission(AdminPermissions.UsersRead)
            .WithName("GetAdminUser")
            .WithSummary("One account: sign-in methods, role, two-factor authentication, suspension, profiles and their names.");

        admin.MapPost("/users/{id:guid}/suspend", SuspendAsync)
            .RequirePermission(AdminPermissions.UsersWrite)
            .RequireStepUp()
            .WithName("SuspendAdminUser")
            .WithSummary("Suspend an account: no way in, and its sessions end.");

        admin.MapDelete("/users/{id:guid}/suspend", LiftAsync)
            .RequirePermission(AdminPermissions.UsersWrite)
            .RequireStepUp()
            .WithName("LiftAdminUserSuspension")
            .WithSummary("Lift a suspension.");

        admin.MapPost("/users/{id:guid}/delete", DeleteAsync)
            .RequirePermission(AdminPermissions.UsersWrite)
            .RequireStepUp()
            .WithName("DeleteAdminUser")
            .WithSummary("Delete for good an account whose owner asked and whose seven days are over (ADR 0038).");

        admin.MapPost("/users/{id:guid}/sign-out", SignOutAsync)
            .RequirePermission(AdminPermissions.UsersWrite)
            .RequireStepUp()
            .WithName("SignOutAdminUser")
            .WithSummary("End every session of an account.");

        admin.MapPut("/users/{id:guid}/role", SetRoleAsync)
            .RequirePermission(AdminPermissions.RolesWrite)
            .RequireStepUp()
            .WithName("SetAdminUserRole")
            .WithSummary("Give an account a platform role, or take it away (owners only).");

        admin.MapPatch("/profiles/{id:guid}", RenameProfileAsync)
            .RequirePermission(AdminPermissions.ProfilesModerate)
            .RequireStepUp()
            .WithName("RenameAdminProfile")
            .WithSummary("Rename a profile, under the same name rules; its history keeps the old name.");

        admin.MapPost("/profiles/{id:guid}/hidden", HideProfileAsync)
            .RequirePermission(AdminPermissions.ProfilesModerate)
            .RequireStepUp()
            .WithName("HideAdminProfile")
            .WithSummary("Hide a profile from public boards; its owner's switch does not bring it back.");

        admin.MapDelete("/profiles/{id:guid}/hidden", ShowProfileAsync)
            .RequirePermission(AdminPermissions.ProfilesModerate)
            .RequireStepUp()
            .WithName("ShowAdminProfile")
            .WithSummary("Let a hidden profile back on public boards, as its owner's switch says.");
    }

    /// <param name="deleting">Only the accounts whose owner asked to delete them, the soonest due first (ADR 0038).</param>
    private static async Task<Ok<IReadOnlyList<AccountSummary>>> SearchAsync(
        AccountsAdmin accounts, CancellationToken ct, string? q = null, bool deleting = false) =>
        TypedResults.Ok(await accounts.SearchAsync(q, deleting, ct));

    /// <summary>
    /// Deletes for good an account its owner asked to delete, once its seven days are over (ADR 0038): with every
    /// profile and their data, as ADR 0034 says, and the audit entry in the same transaction. Before then its owner
    /// may still sign in and keep it.
    /// </summary>
    private static async Task<Results<NoContent, NotFound, ProblemHttpResult>> DeleteAsync(
        Guid id,
        HttpContext http,
        UserManager<Account> users,
        PlatformRoles roles,
        AccountDeletion deletion,
        AdminAudit audit,
        ToheDbContext db,
        TimeProvider clock,
        CancellationToken ct)
    {
        if (await users.FindByIdAsync(id.ToString()) is not { } target)
        {
            return TypedResults.NotFound();
        }

        if (await GuardAsync(http, target.Id, roles, ct) is { } refused)
        {
            return refused;
        }

        var label = Label(target);
        var actor = await ActorAsync(http, users);
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var outcome = await deletion.DeleteAsync(target.Id, clock.GetUtcNow(), ct);
        switch (outcome.State)
        {
            case AccountDeletionState.NotFound:
                return TypedResults.NotFound();
            case AccountDeletionState.NotRequested:
                return Problems.Of(StatusCodes.Status409Conflict, "deletion_not_requested", "Its owner has not asked to delete it");
            case AccountDeletionState.NotDue:
                return Problems.Of(StatusCodes.Status409Conflict, "deletion_not_due", "Its seven days are not over: its owner may still keep it");
        }

        audit.Add(actor, AuditActions.UserDelete, label, new { profiles = outcome.Profiles });
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return TypedResults.NoContent();
    }

    private static async Task<Results<Ok<AccountDetail>, NotFound>> DetailAsync(Guid id, AccountsAdmin accounts, CancellationToken ct) =>
        await accounts.DetailAsync(id, ct) is { } detail ? TypedResults.Ok(detail) : TypedResults.NotFound();

    private static async Task<Results<Ok<AccountDetail>, NotFound, ValidationProblem, ProblemHttpResult>> SuspendAsync(
        Guid id,
        SuspendRequest request,
        HttpContext http,
        UserManager<Account> users,
        AccountsAdmin accounts,
        PlatformRoles roles,
        AdminAudit audit,
        ToheDbContext db,
        TimeProvider clock,
        CancellationToken ct)
    {
        var reason = request.Reason?.Trim() ?? "";
        if (reason.Length == 0)
        {
            return Problems.Field("reason", "reason_required");
        }

        if (reason.Length > MaxReason)
        {
            return Problems.Field("reason", "reason_too_long");
        }

        if (await users.FindByIdAsync(id.ToString()) is not { } target)
        {
            return TypedResults.NotFound();
        }

        if (await GuardAsync(http, target.Id, roles, ct) is { } refused)
        {
            return refused;
        }

        await using (var transaction = await db.Database.BeginTransactionAsync(ct))
        {
            await accounts.SuspendAsync(target, reason, clock.GetUtcNow());
            audit.Add(await ActorAsync(http, users), AuditActions.UserSuspend, Label(target), new { reason });
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
        }

        return TypedResults.Ok((await accounts.DetailAsync(id, ct))!);
    }

    private static async Task<Results<Ok<AccountDetail>, NotFound, ProblemHttpResult>> LiftAsync(
        Guid id,
        HttpContext http,
        UserManager<Account> users,
        AccountsAdmin accounts,
        PlatformRoles roles,
        AdminAudit audit,
        ToheDbContext db,
        CancellationToken ct)
    {
        if (await users.FindByIdAsync(id.ToString()) is not { } target)
        {
            return TypedResults.NotFound();
        }

        if (await GuardAsync(http, target.Id, roles, ct) is { } refused)
        {
            return refused;
        }

        if (target.SuspendedAt is not null)
        {
            await using var transaction = await db.Database.BeginTransactionAsync(ct);
            await accounts.LiftAsync(target);
            audit.Add(await ActorAsync(http, users), AuditActions.UserLift, Label(target));
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
        }

        return TypedResults.Ok((await accounts.DetailAsync(id, ct))!);
    }

    private static async Task<Results<Ok<AccountDetail>, NotFound, ProblemHttpResult>> SignOutAsync(
        Guid id,
        HttpContext http,
        UserManager<Account> users,
        AccountsAdmin accounts,
        PlatformRoles roles,
        AdminAudit audit,
        ToheDbContext db,
        CancellationToken ct)
    {
        if (await users.FindByIdAsync(id.ToString()) is not { } target)
        {
            return TypedResults.NotFound();
        }

        if (await GuardAsync(http, target.Id, roles, ct) is { } refused)
        {
            return refused;
        }

        await using (var transaction = await db.Database.BeginTransactionAsync(ct))
        {
            await accounts.SignOutEverywhereAsync(target);
            audit.Add(await ActorAsync(http, users), AuditActions.UserSignOut, Label(target));
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
        }

        return TypedResults.Ok((await accounts.DetailAsync(id, ct))!);
    }

    private static async Task<Results<Ok<AccountDetail>, NotFound, ValidationProblem, ProblemHttpResult>> SetRoleAsync(
        Guid id,
        SetRoleRequest request,
        HttpContext http,
        UserManager<Account> users,
        AccountsAdmin accounts,
        PlatformRoles roles,
        AdminAudit audit,
        ToheDbContext db,
        CancellationToken ct)
    {
        PlatformRole? role = null;
        if (request.Role is { Length: > 0 } name)
        {
            if (PlatformRoles.Parse(name) is not { } parsed)
            {
                return Problems.Field("role", "role_invalid");
            }

            role = parsed;
        }

        if (await users.FindByIdAsync(id.ToString()) is not { } target)
        {
            return TypedResults.NotFound();
        }

        if (await GuardAsync(http, target.Id, roles, ct) is { } refused)
        {
            return refused;
        }

        var held = await roles.RoleOfAsync(target.Id, ct);
        if (held == role)
        {
            return TypedResults.Ok((await accounts.DetailAsync(id, ct))!);
        }

        await using (var transaction = await db.Database.BeginTransactionAsync(ct))
        {
            // Never the last owner: whoever acts is an owner too, so this holds already — kept as the rule it is.
            if (held == PlatformRole.Owner && !await roles.AnyOwnerAsync(except: target.Id, ct))
            {
                return Problems.Of(StatusCodes.Status409Conflict, "last_owner", "The platform keeps at least one owner");
            }

            var actor = await ActorAsync(http, users);
            if (role is { } given)
            {
                await roles.SetAsync(target, given);
                audit.Add(actor, AuditActions.RoleGrant, Label(target), new { role = PlatformRoles.NameOf(given) });
            }
            else
            {
                await roles.RemoveAsync(target);
                audit.Add(actor, AuditActions.RoleRevoke, Label(target));
            }

            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
        }

        return TypedResults.Ok((await accounts.DetailAsync(id, ct))!);
    }

    private static async Task<Results<Ok<AccountDetail>, NotFound, ValidationProblem, ProblemHttpResult>> RenameProfileAsync(
        Guid id,
        RenameProfileRequest request,
        HttpContext http,
        UserManager<Account> users,
        AccountsAdmin accounts,
        PlatformRoles roles,
        AdminAudit audit,
        ToheDbContext db,
        CancellationToken ct)
    {
        if (await accounts.FindProfileAsync(id, ct) is not { } profile)
        {
            return TypedResults.NotFound();
        }

        if (await GuardAsync(http, profile.AccountId, roles, ct) is { } refused)
        {
            return refused;
        }

        await using (var transaction = await db.Database.BeginTransactionAsync(ct))
        {
            var (before, error) = await accounts.RenameAsync(profile, request.Name ?? "", ct);
            if (error is not null)
            {
                return Problems.Field("name", error);
            }

            audit.Add(
                await ActorAsync(http, users),
                AuditActions.ProfileRename,
                $"{profile.PublicId} ({profile.Name})",
                new { from = before, to = profile.Name });
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
        }

        return TypedResults.Ok((await accounts.DetailAsync(profile.AccountId, ct))!);
    }

    private static async Task<Results<Ok<AccountDetail>, NotFound, ValidationProblem, ProblemHttpResult>> HideProfileAsync(
        Guid id,
        HideProfileRequest request,
        HttpContext http,
        UserManager<Account> users,
        AccountsAdmin accounts,
        PlatformRoles roles,
        AdminAudit audit,
        ToheDbContext db,
        TimeProvider clock,
        CancellationToken ct)
    {
        var reason = request.Reason?.Trim() ?? "";
        if (reason.Length == 0)
        {
            return Problems.Field("reason", "reason_required");
        }

        if (reason.Length > MaxReason)
        {
            return Problems.Field("reason", "reason_too_long");
        }

        return await SetHiddenAsync(id, reason, http, users, accounts, roles, audit, db, clock, ct);
    }

    private static async Task<Results<Ok<AccountDetail>, NotFound, ValidationProblem, ProblemHttpResult>> ShowProfileAsync(
        Guid id,
        HttpContext http,
        UserManager<Account> users,
        AccountsAdmin accounts,
        PlatformRoles roles,
        AdminAudit audit,
        ToheDbContext db,
        TimeProvider clock,
        CancellationToken ct) =>
        await SetHiddenAsync(id, null, http, users, accounts, roles, audit, db, clock, ct);

    /// <summary>Hides the profile with a reason, or shows it again without one.</summary>
    private static async Task<Results<Ok<AccountDetail>, NotFound, ValidationProblem, ProblemHttpResult>> SetHiddenAsync(
        Guid id,
        string? reason,
        HttpContext http,
        UserManager<Account> users,
        AccountsAdmin accounts,
        PlatformRoles roles,
        AdminAudit audit,
        ToheDbContext db,
        TimeProvider clock,
        CancellationToken ct)
    {
        if (await accounts.FindProfileAsync(id, ct) is not { } profile)
        {
            return TypedResults.NotFound();
        }

        if (await GuardAsync(http, profile.AccountId, roles, ct) is { } refused)
        {
            return refused;
        }

        accounts.SetHiddenFromBoards(profile, reason is not null, clock.GetUtcNow());
        audit.Add(
            await ActorAsync(http, users),
            reason is not null ? AuditActions.ProfileHide : AuditActions.ProfileShow,
            $"{profile.PublicId} ({profile.Name})",
            reason is not null ? new { reason } : null);
        await db.SaveChangesAsync(ct);
        return TypedResults.Ok((await accounts.DetailAsync(profile.AccountId, ct))!);
    }

    /// <summary>Not one's own account, and not one whose role is as strong as one's own — unless one is an owner.</summary>
    private static async Task<ProblemHttpResult?> GuardAsync(HttpContext http, Guid target, PlatformRoles roles, CancellationToken ct)
    {
        var caller = AdminCaller.Of(http);
        if (caller.AccountId == target)
        {
            return Problems.Of(StatusCodes.Status403Forbidden, "admin_self", "Not on one's own account here");
        }

        if (caller.Role != PlatformRole.Owner && await roles.RoleOfAsync(target, ct) is { } theirs && theirs >= caller.Role)
        {
            return Problems.Of(StatusCodes.Status403Forbidden, "admin_rank", "Not on an account whose role is as strong");
        }

        return null;
    }

    private static async Task<AdminActor> ActorAsync(HttpContext http, UserManager<Account> users) =>
        AdminActor.Of((await users.FindByIdAsync(AdminCaller.Of(http).AccountId.ToString()))!, http);

    private static string Label(Account account) => $"{account.Email ?? account.UserName} ({account.DisplayName})";
}
