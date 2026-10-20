using System.Text.Json;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Identity;

namespace Tohe.Api.Modules.Admin;

/// <summary>What the audit log records (ADR 0027).</summary>
internal static class AuditActions
{
    /// <summary>A new deployment claimed with its setup token: the first owner.</summary>
    public const string SetupClaim = "setup.claim";

    public const string RoleGrant = "role.grant";
    public const string RoleRevoke = "role.revoke";

    public const string UserSuspend = "user.suspend";
    public const string UserLift = "user.unsuspend";
    public const string UserSignOut = "user.sign-out";

    /// <summary>An account its owner asked to delete, deleted for good once its seven days were over (ADR 0038).</summary>
    public const string UserDelete = "user.delete";
    public const string ProfileRename = "profile.rename";

    public const string SettingsChange = "settings.change";
    public const string CommunityCreate = "community.create";
    public const string InviteCreate = "invite.create";
    public const string InviteRevoke = "invite.revoke";

    public const string ResultApprove = "result.approve";
    public const string ResultReject = "result.reject";
    public const string ResultReopen = "result.reopen";
    public const string ProfileHide = "profile.hide";
    public const string ProfileShow = "profile.show";

    /// <summary>A profile — an account's or a device's (ADR 0043) — removed from the tables it sat at or watched.</summary>
    public const string ProfileWithdraw = "profile.withdraw";

    /// <summary>A share link revoked from the console (ADR 0044).</summary>
    public const string LinkRevoke = "link.revoke";

    /// <summary>The console opened on a device: two-factor authentication passed.</summary>
    public const string ConsoleOpen = "console.open";

    public const string TwoFactorEnable = "two-factor.enable";
    public const string TwoFactorDisable = "two-factor.disable";
    public const string RecoveryCodesNew = "two-factor.recovery-codes";
}

/// <summary>Who did something, as the audit log keeps it.</summary>
internal sealed record AdminActor(Guid? AccountId, string Label, string? Address)
{
    public static readonly AdminActor CommandLine = new(null, "command line", null);

    public static AdminActor Of(Account account, HttpContext http) =>
        new(account.Id, account.Email ?? account.UserName ?? account.Id.ToString(), http.Connection.RemoteIpAddress?.ToString());
}

/// <summary>
/// Adds entries to the append-only audit log. An entry joins the caller's unit of work: it is written with the
/// caller's next save, in the caller's transaction, so a change is never logged without happening or the reverse.
/// </summary>
internal sealed class AdminAudit(ToheDbContext db, TimeProvider clock)
{
    public void Add(AdminActor actor, string action, string? target = null, object? details = null) =>
        db.AuditLog.Add(new AuditEntry
        {
            At = clock.GetUtcNow(),
            ActorId = actor.AccountId,
            Actor = actor.Label,
            Action = action,
            Target = target,
            Details = details is null ? null : JsonSerializer.Serialize(details, JsonSerializerOptions.Web),
            Address = actor.Address,
        });
}
