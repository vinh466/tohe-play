using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Admin;
using Tohe.Api.Modules.Studio;

namespace Tohe.Api.Tests;

/// <summary>
/// Studio roles in the console (ADR 0051): the owner alone gives, changes and takes them, behind step-up level 2, each
/// change in the console's audit log; owners, admins and moderators see who holds one. A studio role opens nothing in
/// the console, and taking it away ends the account's Studio session at its next request.
/// </summary>
public sealed class StudioMembersTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static readonly CancellationToken Ct = TestContext.Current.CancellationToken;

    [Fact]
    public async Task The_owner_gives_changes_and_takes_a_role_and_each_change_is_audited()
    {
        var owner = await Admins.NewAsync(factory, "owner");
        Assert.Contains(AdminPermissions.StudioWrite, AdminPermissions.Of(Tohe.Api.Modules.Identity.PlatformRole.Owner));
        var member = await Studio.NewAsync(factory, role: null, twoFactor: true);

        var given = await owner.Client.PostAsJsonAsync(Url("/api/admin/studio/members"), new { email = member.Email.ToUpperInvariant(), role = "contributor" }, Ct);
        Assert.Equal(HttpStatusCode.OK, given.StatusCode);
        var view = (await given.Content.ReadFromJsonAsync<StudioMemberView>(Ct))!;
        Assert.Equal((member.AccountId, "contributor", true, owner.AccountId, owner.Email), (view.AccountId, view.Role, view.TwoFactorEnabled, view.GrantedBy, view.GrantedByName));

        // By its id, a role changed; giving the same role again changes nothing and logs nothing.
        var changed = await owner.Client.PostAsJsonAsync(Url("/api/admin/studio/members"), new { accountId = member.AccountId, role = "reviewer" }, Ct);
        Assert.Equal("reviewer", (await changed.Content.ReadFromJsonAsync<StudioMemberView>(Ct))!.Role);
        Assert.Equal(HttpStatusCode.OK, (await owner.Client.PostAsJsonAsync(Url("/api/admin/studio/members"), new { accountId = member.AccountId, role = "reviewer" }, Ct)).StatusCode);

        var listed = (await owner.Client.GetFromJsonAsync<List<StudioMemberView>>(Url("/api/admin/studio/members"), Ct))!;
        Assert.Equal("reviewer", listed.Single(held => held.AccountId == member.AccountId).Role);

        Assert.Equal(HttpStatusCode.NoContent, (await owner.Client.DeleteAsync(Url($"/api/admin/studio/members/{member.AccountId}"), Ct)).StatusCode);
        var gone = await owner.Client.DeleteAsync(Url($"/api/admin/studio/members/{member.AccountId}"), Ct);
        Assert.Equal((HttpStatusCode.NotFound, "studio_member_not_found"), (gone.StatusCode, await CodeOfAsync(gone)));
        Assert.DoesNotContain((await owner.Client.GetFromJsonAsync<List<StudioMemberView>>(Url("/api/admin/studio/members"), Ct))!, held => held.AccountId == member.AccountId);

        await using var scope = factory.Services.CreateAsyncScope();
        var log = await scope.ServiceProvider.GetRequiredService<ToheDbContext>().AuditLog.AsNoTracking()
            .Where(entry => entry.Target != null && entry.Target.StartsWith(member.Email))
            .OrderBy(entry => entry.Id)
            .ToListAsync(Ct);
        Assert.Equal(
            [AuditActions.StudioMemberGrant, AuditActions.StudioMemberGrant, AuditActions.StudioMemberRevoke],
            log.Select(entry => entry.Action));
        Assert.All(log, entry => Assert.Equal((owner.AccountId, owner.Email), (entry.ActorId, entry.Actor)));
        Assert.Equal(("contributor", null), Roles(log[0].Details));
        Assert.Equal(("reviewer", "contributor"), Roles(log[1].Details));
        Assert.Equal(("reviewer", null), Roles(log[2].Details));
    }

    /// <summary>The role, and the one before, an audit entry's details name.</summary>
    private static (string? Role, string? Before) Roles(string? details)
    {
        using var json = JsonDocument.Parse(details!);
        var before = json.RootElement.TryGetProperty("before", out var held) ? held.GetString() : null;
        return (json.RootElement.GetProperty("role").GetString(), before);
    }

    [Fact]
    public async Task Only_the_owner_changes_roles_and_only_after_step_up()
    {
        var member = await Studio.NewAsync(factory, role: null, twoFactor: false);
        var body = new { accountId = member.AccountId, role = "contributor" };
        foreach (var role in (string[])["admin", "moderator", "viewer"])
        {
            var other = await Admins.NewAsync(factory, role);
            var refused = await other.Client.PostAsJsonAsync(Url("/api/admin/studio/members"), body, Ct);
            Assert.Equal((HttpStatusCode.Forbidden, "admin_required"), (refused.StatusCode, await CodeOfAsync(refused)));
            Assert.Equal("admin_required", await CodeOfAsync(await other.Client.DeleteAsync(Url($"/api/admin/studio/members/{member.AccountId}"), Ct)));
            // Who holds a role is shown to those who find accounts.
            var list = await other.Client.GetAsync(Url("/api/admin/studio/members"), Ct);
            Assert.Equal(role == "viewer" ? HttpStatusCode.Forbidden : HttpStatusCode.OK, list.StatusCode);
        }

        var owner = await Admins.NewAsync(factory, "owner");
        var fresh = await Admins.SignInAsync(factory, owner.Email, owner.Key, step: 2);
        Assert.Equal("step_up_required", await CodeOfAsync(await fresh.PostAsJsonAsync(Url("/api/admin/studio/members"), body, Ct)));
        Assert.Equal("step_up_required", await CodeOfAsync(await fresh.DeleteAsync(Url($"/api/admin/studio/members/{member.AccountId}"), Ct)));
        // The hub's session is not the console's.
        Assert.Equal(HttpStatusCode.NotFound, (await owner.Player.PostAsJsonAsync(Url("/api/admin/studio/members"), body, Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await owner.Client.PostAsJsonAsync(Url("/api/admin/studio/members"), body, Ct)).StatusCode);
    }

    [Fact]
    public async Task A_grant_names_one_account_and_a_role_the_studio_knows()
    {
        var owner = await Admins.NewAsync(factory, "owner");
        var member = await Studio.NewAsync(factory, role: null, twoFactor: false);

        Assert.Equal("role_invalid", await FieldAsync(await owner.Client.PostAsJsonAsync(Url("/api/admin/studio/members"), new { accountId = member.AccountId, role = "owner" }, Ct), "role"));
        Assert.Equal("role_invalid", await FieldAsync(await owner.Client.PostAsJsonAsync(Url("/api/admin/studio/members"), new { accountId = member.AccountId }, Ct), "role"));
        Assert.Equal("account_required", await FieldAsync(await owner.Client.PostAsJsonAsync(Url("/api/admin/studio/members"), new { role = "reviewer" }, Ct), "account"));
        Assert.Equal("account_required", await FieldAsync(await owner.Client.PostAsJsonAsync(Url("/api/admin/studio/members"), new { email = member.Email, accountId = member.AccountId, role = "reviewer" }, Ct), "account"));

        var nobody = await owner.Client.PostAsJsonAsync(Url("/api/admin/studio/members"), new { email = Accounts.NewEmail(), role = "reviewer" }, Ct);
        Assert.Equal((HttpStatusCode.NotFound, "account_not_found"), (nobody.StatusCode, await CodeOfAsync(nobody)));
        var unknownId = await owner.Client.PostAsJsonAsync(Url("/api/admin/studio/members"), new { accountId = Guid.NewGuid(), role = "reviewer" }, Ct);
        Assert.Equal((HttpStatusCode.NotFound, "account_not_found"), (unknownId.StatusCode, await CodeOfAsync(unknownId)));
        Assert.Equal("studio_member_not_found", await CodeOfAsync(await owner.Client.DeleteAsync(Url($"/api/admin/studio/members/{member.AccountId}"), Ct)));

        // The owner may give themselves a role: the owner who reviews holds reviewer as well.
        Assert.Equal(HttpStatusCode.OK, (await owner.Client.PostAsJsonAsync(Url("/api/admin/studio/members"), new { accountId = owner.AccountId, role = "reviewer" }, Ct)).StatusCode);
    }

    [Fact]
    public async Task Revoking_in_the_console_ends_the_studio_session_and_a_studio_role_opens_nothing_in_the_console()
    {
        var owner = await Admins.NewAsync(factory, "owner");
        var member = await Studio.NewAsync(factory, role: null, twoFactor: true);
        Assert.Equal(HttpStatusCode.OK, (await owner.Client.PostAsJsonAsync(Url("/api/admin/studio/members"), new { email = member.Email, role = "reviewer" }, Ct)).StatusCode);
        var studio = await Studio.SignInAsync(factory, member);
        Assert.Equal(HttpStatusCode.OK, (await studio.GetAsync(Url("/api/studio/session"), Ct)).StatusCode);

        // A reviewer with an authenticator but no platform role: the console refuses it.
        var console = await Admins.ConsoleClient(factory).PostAsJsonAsync(Url("/api/admin/session"), Admins.SignIn(member.Email, member.Key!, step: 1), Ct);
        Assert.Equal((HttpStatusCode.Unauthorized, "invalid_credentials"), (console.StatusCode, await CodeOfAsync(console)));

        Assert.Equal(HttpStatusCode.NoContent, (await owner.Client.DeleteAsync(Url($"/api/admin/studio/members/{member.AccountId}"), Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await studio.PostAsJsonAsync(Url("/api/studio/session/step-up"), new { code = Studio.Code(member, step: 2) }, Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await studio.GetAsync(Url("/api/studio/session"), Ct)).StatusCode);
    }

    [Fact]
    public async Task Deleting_an_account_for_good_takes_its_studio_role_with_it()
    {
        var member = await Studio.NewAsync(factory, Tohe.Api.Modules.Studio.StudioRole.Contributor, twoFactor: false);
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();
        Assert.True(await db.StudioMembers.AnyAsync(held => held.AccountId == member.AccountId, Ct));
        await db.Users.Where(account => account.Id == member.AccountId).ExecuteDeleteAsync(Ct);
        Assert.False(await db.StudioMembers.AnyAsync(held => held.AccountId == member.AccountId, Ct));
    }

    private static async Task<string?> CodeOfAsync(HttpResponseMessage response)
    {
        var body = await response.Content.ReadAsStringAsync(Ct);
        if (body.Length == 0)
        {
            return null;
        }

        using var json = JsonDocument.Parse(body);
        return json.RootElement.TryGetProperty("code", out var code) ? code.GetString() : null;
    }

    private static async Task<string?> FieldAsync(HttpResponseMessage response, string field)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct));
        return json.RootElement.GetProperty("errors").GetProperty(field)[0].GetString();
    }

    private static Uri Url(string path) => new(path, UriKind.Relative);
}
