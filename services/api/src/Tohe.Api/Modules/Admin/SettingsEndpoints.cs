using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Email;
using Tohe.Api.Modules.Identity;

namespace Tohe.Api.Modules.Admin;

/// <summary>A sign-in method as the console shows it.</summary>
/// <param name="Id"><c>password</c>, <c>google</c>, <c>github</c> or <c>oidc</c>.</param>
/// <param name="Configured">The deployment has what it needs (a provider's secrets): only then can it be on.</param>
/// <param name="OnlyWayIn">Accounts that sign in no other way: they cannot while it is off.</param>
public sealed record SignInMethodView(string Id, string Name, bool Configured, bool On, int OnlyWayIn);

/// <param name="Registration"><c>open</c>, <c>invite</c> or <c>closed</c>.</param>
/// <param name="Email">The server sends email, which signing up by email needs (ADR 0022).</param>
public sealed record SignInSettingsView(IReadOnlyList<SignInMethodView> Methods, string Registration, bool Email);

/// <param name="Methods">The methods to switch, by id; those left out stay as they are.</param>
/// <param name="Registration"><c>open</c>, <c>invite</c> or <c>closed</c>; none leaves it as it is.</param>
public sealed record UpdateSignInSettingsRequest(IReadOnlyDictionary<string, bool>? Methods, string? Registration);

public sealed record CreateCommunityRequest(string? Name);

/// <param name="Code">The code to use, e.g. <c>BANCO-2026</c>; none makes one up.</param>
/// <param name="MaxUses">How many accounts may come with it; none, no limit.</param>
public sealed record CreateInviteCodeRequest(string? Code, DateTimeOffset? ExpiresAt, int? MaxUses);

/// <summary>
/// Sign-in and registration at run time, and communities with their invite codes (ADR 0028). The deployment decides
/// what can exist, the console what is on. Two guards: one method stays on, and whoever switches keeps a way in. Every
/// change needs step-up level 2 and lands in the audit log.
/// </summary>
internal static class SettingsEndpoints
{
    /// <summary>The providers ADR 0026 knows, with the name each has before it is configured.</summary>
    private static readonly (string Id, string Name)[] Known = [("google", "Google"), ("github", "GitHub"), ("oidc", "OpenID Connect")];

    public static void Map(RouteGroupBuilder admin)
    {
        admin.MapGet("/settings", GetAsync)
            .RequirePermission(AdminPermissions.Read)
            .WithName("GetAdminSignInSettings")
            .WithSummary("The sign-in methods, which are on and who signs in only by each; the registration mode.");

        admin.MapPut("/settings", UpdateAsync)
            .RequirePermission(AdminPermissions.SettingsWrite)
            .RequireStepUp()
            .WithName("UpdateAdminSignInSettings")
            .WithSummary("Switch sign-in methods and the registration mode; one method stays on, and you keep a way in.");

        admin.MapGet("/communities", CommunitiesAsync)
            .RequirePermission(AdminPermissions.Read)
            .WithName("GetAdminCommunities")
            .WithSummary("Communities, how many accounts came with each, and their invite codes.");

        admin.MapPost("/communities", CreateCommunityAsync)
            .RequirePermission(AdminPermissions.SettingsWrite)
            .RequireStepUp()
            .WithName("CreateAdminCommunity")
            .WithSummary("A new community.");

        admin.MapPost("/communities/{id:guid}/codes", CreateCodeAsync)
            .RequirePermission(AdminPermissions.SettingsWrite)
            .RequireStepUp()
            .WithName("CreateAdminInviteCode")
            .WithSummary("A new invite code for the community: given or made up, with an end and a limit of uses if wanted.");

        admin.MapDelete("/invite-codes/{code}", RevokeCodeAsync)
            .RequirePermission(AdminPermissions.SettingsWrite)
            .RequireStepUp()
            .WithName("RevokeAdminInviteCode")
            .WithSummary("Revoke an invite code: no sign-up uses it again.");
    }

    private static async Task<Ok<SignInSettingsView>> GetAsync(
        RuntimeSettings settings, ExternalProviderCatalog providers, IdentityFacts identity, IEmailOutbox email, CancellationToken ct) =>
        TypedResults.Ok(await ViewAsync(settings, providers, identity, email, ct));

    private static async Task<Results<Ok<SignInSettingsView>, ValidationProblem, ProblemHttpResult>> UpdateAsync(
        UpdateSignInSettingsRequest request,
        HttpContext http,
        RuntimeSettings settings,
        ExternalProviderCatalog providers,
        IdentityFacts identity,
        IEmailOutbox email,
        UserManager<Account> users,
        AdminAudit audit,
        ToheDbContext db,
        TimeProvider clock,
        CancellationToken ct)
    {
        RegistrationMode? mode = null;
        if (request.Registration is { } name)
        {
            if (RuntimeSettings.ParseMode(name) is not { } parsed)
            {
                return Problems.Field("registration", "registration_invalid");
            }

            mode = parsed;
        }

        var methods = request.Methods ?? new Dictionary<string, bool>();
        if (methods.Keys.Any(id => id != SignInMethods.Password && providers.Find(id) is null))
        {
            return Problems.Field("methods", "method_unknown");
        }

        // What will be on: today's switches, with the asked changes over them.
        var on = new HashSet<string>(StringComparer.Ordinal);
        foreach (var id in (string[])[SignInMethods.Password, .. providers.Providers.Select(provider => provider.Id)])
        {
            if (methods.TryGetValue(id, out var wanted) ? wanted : await settings.IsOnAsync(id, ct))
            {
                on.Add(id);
            }
        }

        if (on.Count == 0)
        {
            return Problems.Of(StatusCodes.Status409Conflict, "settings_last_method", "One way of signing in stays on");
        }

        var caller = AdminCaller.Of(http);
        if (!await identity.HasWayInAsync(caller.AccountId, on, ct))
        {
            return Problems.Of(StatusCodes.Status409Conflict, "settings_lockout_self", "You would have no way in left");
        }

        var now = clock.GetUtcNow();
        var changes = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var (id, wanted) in methods)
        {
            changes[RuntimeSettings.MethodKey(id)] = wanted ? "on" : "off";
        }

        if (mode is { } given)
        {
            changes[RuntimeSettings.RegistrationKey] = RuntimeSettings.NameOf(given);
        }

        await using (var transaction = await db.Database.BeginTransactionAsync(ct))
        {
            var existing = await db.PlatformSettings.Where(setting => changes.Keys.Contains(setting.Key)).ToDictionaryAsync(setting => setting.Key, ct);
            foreach (var (key, value) in changes)
            {
                if (existing.TryGetValue(key, out var setting))
                {
                    setting.Value = value;
                    setting.UpdatedAt = now;
                }
                else
                {
                    db.PlatformSettings.Add(new PlatformSetting { Key = key, Value = value, UpdatedAt = now });
                }
            }

            audit.Add(AdminActor.Of((await users.FindByIdAsync(caller.AccountId.ToString()))!, http), AuditActions.SettingsChange, details: changes);
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
        }

        settings.Forget();
        return TypedResults.Ok(await ViewAsync(settings, providers, identity, email, ct));
    }

    private static async Task<Ok<IReadOnlyList<CommunityView>>> CommunitiesAsync(CommunitiesAdmin communities, TimeProvider clock, CancellationToken ct) =>
        TypedResults.Ok(await communities.ListAsync(clock.GetUtcNow(), ct));

    private static async Task<Results<Ok<IReadOnlyList<CommunityView>>, ValidationProblem, ProblemHttpResult>> CreateCommunityAsync(
        CreateCommunityRequest request,
        HttpContext http,
        CommunitiesAdmin communities,
        UserManager<Account> users,
        AdminAudit audit,
        ToheDbContext db,
        TimeProvider clock,
        CancellationToken ct)
    {
        var name = string.Join(' ', (request.Name ?? "").Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));
        if (name.Length == 0)
        {
            return Problems.Field("name", "name_required");
        }

        if (name.Length > Invites.MaxCommunityName)
        {
            return Problems.Field("name", "name_too_long");
        }

        var now = clock.GetUtcNow();
        await using (var transaction = await db.Database.BeginTransactionAsync(ct))
        {
            if (await communities.CreateAsync(name, now, ct) is null)
            {
                return Problems.Of(StatusCodes.Status409Conflict, "community_exists", "A community has this name already");
            }

            audit.Add(await ActorAsync(http, users), AuditActions.CommunityCreate, name);
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
        }

        return TypedResults.Ok(await communities.ListAsync(now, ct));
    }

    private static async Task<Results<Ok<IReadOnlyList<CommunityView>>, NotFound, ValidationProblem, ProblemHttpResult>> CreateCodeAsync(
        Guid id,
        CreateInviteCodeRequest request,
        HttpContext http,
        CommunitiesAdmin communities,
        UserManager<Account> users,
        AdminAudit audit,
        ToheDbContext db,
        TimeProvider clock,
        CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        string? code = null;
        if (!string.IsNullOrWhiteSpace(request.Code) && (code = Invites.Normalize(request.Code)) is null)
        {
            return Problems.Field("code", "invite_code_invalid");
        }

        if (request.MaxUses is < 1)
        {
            return Problems.Field("maxUses", "max_uses_invalid");
        }

        if (request.ExpiresAt is { } end && end <= now)
        {
            return Problems.Field("expiresAt", "expires_in_past");
        }

        if (await communities.FindAsync(id, ct) is not { } community)
        {
            return TypedResults.NotFound();
        }

        await using (var transaction = await db.Database.BeginTransactionAsync(ct))
        {
            if (await communities.CreateCodeAsync(community, code, request.ExpiresAt, request.MaxUses, now, ct) is not { } created)
            {
                return Problems.Of(StatusCodes.Status409Conflict, "invite_code_exists", "This code exists already");
            }

            audit.Add(
                await ActorAsync(http, users),
                AuditActions.InviteCreate,
                created.Code,
                new { community = community.Name, expiresAt = created.ExpiresAt, maxUses = created.MaxUses });
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
        }

        return TypedResults.Ok(await communities.ListAsync(now, ct));
    }

    private static async Task<Results<Ok<IReadOnlyList<CommunityView>>, NotFound>> RevokeCodeAsync(
        string code,
        HttpContext http,
        CommunitiesAdmin communities,
        UserManager<Account> users,
        AdminAudit audit,
        ToheDbContext db,
        TimeProvider clock,
        CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        await using (var transaction = await db.Database.BeginTransactionAsync(ct))
        {
            if (await communities.RevokeAsync(Invites.Normalize(code) ?? code, now, ct) is not { } revoked)
            {
                return TypedResults.NotFound();
            }

            audit.Add(await ActorAsync(http, users), AuditActions.InviteRevoke, revoked.Code);
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
        }

        return TypedResults.Ok(await communities.ListAsync(now, ct));
    }

    private static async Task<SignInSettingsView> ViewAsync(
        RuntimeSettings settings, ExternalProviderCatalog providers, IdentityFacts identity, IEmailOutbox email, CancellationToken ct)
    {
        var methods = new List<SignInMethodView>
        {
            new(SignInMethods.Password, "Email và mật khẩu", true, await settings.IsOnAsync(SignInMethods.Password, ct),
                await identity.OnlyWayInAsync(SignInMethods.Password, ct)),
        };
        foreach (var (id, name) in Known)
        {
            var configured = providers.Find(id);
            methods.Add(new SignInMethodView(
                id,
                configured?.Name ?? name,
                configured is not null,
                await settings.IsOnAsync(id, ct),
                await identity.OnlyWayInAsync(id, ct)));
        }

        // A provider only a test configures (no name of its own here) is listed too.
        foreach (var provider in providers.Providers.Where(provider => Known.All(known => known.Id != provider.Id)))
        {
            methods.Add(new SignInMethodView(
                provider.Id, provider.Name, true, await settings.IsOnAsync(provider.Id, ct), await identity.OnlyWayInAsync(provider.Id, ct)));
        }

        return new SignInSettingsView(methods, RuntimeSettings.NameOf(await settings.RegistrationAsync(ct)), email.Enabled);
    }

    private static async Task<AdminActor> ActorAsync(HttpContext http, UserManager<Account> users) =>
        AdminActor.Of((await users.FindByIdAsync(AdminCaller.Of(http).AccountId.ToString()))!, http);
}
