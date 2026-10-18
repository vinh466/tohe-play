using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Tohe.Api.Infrastructure;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Admin;
using Tohe.Api.Modules.Identity;
using Tohe.Api.Modules.Progress;
using Tohe.Api.Modules.Rooms;

namespace Tohe.Api.Tests;

/// <summary>Deleting profiles and accounts (ADR 0034): what goes, what stays for the others, and the wait.</summary>
public sealed class AccountDeletionTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Deleting_a_profile_takes_everything_of_it_and_its_id_is_never_given_again()
    {
        await Games.KnowAsync(factory, "merge-block");
        var (client, me) = await RegisterAsync("Bố");
        await Accounts.StepUpAsync(client);
        var na = await AddProfileAsync(client, "Na");
        await PlayAsAsync(client, na.Id);
        await RecordAsync(client, Run(120));
        await PutSaveAsync(client, "merge-block");
        await PlayAsAsync(client, me.Profiles[0].Id);
        await RecordAsync(client, Run(80));
        var stranger = factory.CreateClient();
        await Accounts.SignUpAsync(factory, stranger, "Người lạ");
        Assert.Equal(HttpStatusCode.OK, (await stranger.GetAsync(Url($"/api/profiles/by-id/{na.PublicId}"), Ct)).StatusCode);
        Assert.Equal(new Kept(1, 1, 1, 1), await KeptAsync(na.Id));

        await Accounts.StepUpAsync(client);
        var deleted = await client.DeleteAsync(Url($"/api/profiles/{na.Id}"), Ct);

        Assert.Equal(HttpStatusCode.OK, deleted.StatusCode);
        Assert.Equal(new Kept(0, 0, 0, 0), await KeptAsync(na.Id));
        Assert.True(await RetiredAsync(na.PublicId));
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.GetAsync(Url($"/api/profiles/by-id/{na.PublicId}"), Ct)).StatusCode);
        // The rest of the account keeps everything.
        Assert.Equal(new Kept(0, 1, 1, 1), await KeptAsync(me.Profiles[0].Id));
    }

    [Fact]
    public async Task A_finished_hand_keeps_a_deleted_players_seat_for_the_others_with_nothing_of_them()
    {
        var (client, me) = await RegisterAsync("Bố");
        await Accounts.StepUpAsync(client);
        var na = await AddProfileAsync(client, "Na");
        var bo = me.Profiles[0];
        var roomId = await FinishedHandAsync(me.Account.Id, na, bo);

        await Accounts.StepUpAsync(client);
        Assert.Equal(HttpStatusCode.OK, (await client.DeleteAsync(Url($"/api/profiles/{na.Id}"), Ct)).StatusCode);

        await PlayAsAsync(client, bo.Id);
        var replay = await client.GetFromJsonAsync<HandReplay>(Url($"/api/rooms/{roomId}/hands/1"), Ct);
        var gone = replay!.Seats[0];
        Assert.True(gone.Deleted);
        Assert.Equal((null, null, null), (gone.Name, gone.Avatar, gone.Bot));
        Assert.NotNull(gone.ProfileId);
        Assert.NotEqual(na.Id, gone.ProfileId);
        Assert.Equal((bo.Id, bo.Name, false), (replay.Seats[1].ProfileId, replay.Seats[1].Name, replay.Seats[1].Deleted));

        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();
        var room = await db.Rooms.AsNoTracking().SingleAsync(r => r.Id == roomId, Ct);
        Assert.Equal((Guid.Empty, Guid.Empty), (room.HostProfileId, room.HostAccountId));
        var table = JsonSerializer.Deserialize<List<SeatRecord>>(room.SeatList)!;
        Assert.True(table[0].Deleted);
        Assert.Null(table[0].Name);
        Assert.Equal(bo.Id, table[1].ProfileId);
        var results = await db.RoomResults.AsNoTracking().Where(r => r.RoomId == roomId).OrderBy(r => r.Seat).ToListAsync(Ct);
        Assert.Equal([null, bo.Id], results.Select(r => r.ProfileId));
        Assert.Null(results[0].AccountId);
    }

    [Fact]
    public async Task Deleting_the_account_ends_its_sessions_and_signing_in_within_the_wait_keeps_it()
    {
        var email = Accounts.NewEmail();
        var (client, me) = await RegisterAsync("Mẹ", email);
        var phone = factory.CreateClient();
        Assert.Equal(HttpStatusCode.OK, (await LoginAsync(phone, email)).StatusCode);
        var stranger = factory.CreateClient();
        await Accounts.SignUpAsync(factory, stranger, "Người lạ");

        var refused = await client.DeleteAsync(Url("/api/account"), Ct);
        Assert.Equal((HttpStatusCode.Forbidden, "step_up_required"), (refused.StatusCode, await CodeAsync(refused)));

        await Accounts.StepUpAsync(client);
        var asked = await client.DeleteAsync(Url("/api/account"), Ct);
        Assert.Equal(HttpStatusCode.OK, asked.StatusCode);
        var deleteAfter = (await asked.Content.ReadFromJsonAsync<AccountDeletionView>(Ct))!.DeleteAfter;
        Assert.InRange(deleteAfter, DateTimeOffset.UtcNow.AddDays(7).AddMinutes(-5), DateTimeOffset.UtcNow.AddDays(7).AddMinutes(5));
        Assert.Contains(
            deleteAfter.ToOffset(Weeks.VietnamOffset).ToString("dd/MM/yyyy", CultureInfo.InvariantCulture),
            await factory.MailSentToAsync(email),
            StringComparison.Ordinal);

        // This device is signed out at once; the other one may not renew its session either.
        Assert.Equal(HttpStatusCode.NoContent, (await client.GetAsync(Url("/api/auth/me"), Ct)).StatusCode);
        var stale = await phone.PutAsJsonAsync(Url("/api/session/profile"), new { profileId = me.Profiles[0].Id }, Ct);
        Assert.Equal((HttpStatusCode.Unauthorized, "session_ended"), (stale.StatusCode, await CodeAsync(stale)));
        // Meanwhile nobody finds its profiles to ask them to a table.
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.GetAsync(Url($"/api/profiles/by-id/{me.Profiles[0].PublicId}"), Ct)).StatusCode);

        var back = factory.CreateClient();
        Assert.Equal(HttpStatusCode.OK, (await LoginAsync(back, email)).StatusCode);

        Assert.Null(await DeleteAfterAsync(me.Account.Id));
        Assert.Contains("không bị xoá nữa", await factory.MailSentToAsync(email), StringComparison.Ordinal);
        Assert.Equal(HttpStatusCode.OK, (await stranger.GetAsync(Url($"/api/profiles/by-id/{me.Profiles[0].PublicId}"), Ct)).StatusCode);
    }

    [Fact]
    public async Task An_account_whose_wait_is_over_waits_for_an_admin_who_deletes_it_for_good()
    {
        await Games.KnowAsync(factory, "merge-block");
        var email = Accounts.NewEmail();
        var (client, me) = await RegisterAsync("Ông", email);
        await PlayAsAsync(client, me.Profiles[0].Id);
        await RecordAsync(client, Run(50));
        await PutSaveAsync(client, "merge-block");
        await Accounts.StepUpAsync(client);
        var child = await AddProfileAsync(client, "Bin", ageBand: "6-8");
        await Accounts.StepUpAsync(client);
        Assert.Equal(HttpStatusCode.OK, (await client.DeleteAsync(Url("/api/account"), Ct)).StatusCode);

        var admin = await Admins.NewAsync(factory, "admin");
        var moderator = await Admins.NewAsync(factory, "moderator");
        var deleteIt = (Admins.Admin who) => who.Client.PostAsync(Url($"/api/admin/users/{me.Account.Id}/delete"), null, Ct);

        // In the console's list of accounts waiting to be deleted; not yet due — its owner may still keep it.
        var waiting = (await admin.Client.GetFromJsonAsync<List<AccountSummary>>(Url("/api/admin/users?deleting=true"), Ct))!;
        Assert.Contains(waiting, account => account.Id == me.Account.Id);
        Assert.All(waiting, account => Assert.NotNull(account.DeleteAfter));
        Assert.Equal("deletion_not_due", await CodeAsync(await deleteIt(admin)));

        // Its seven days over, nothing deletes it by itself, and a moderator may not.
        await WaitIsOverAsync(me.Account.Id);
        Assert.True(await AccountExistsAsync(me.Account.Id));
        Assert.Equal("admin_required", await CodeAsync(await deleteIt(moderator)));
        // The overview counts it among the accounts due, so an admin sees there is something to do.
        var due = (await admin.Client.GetFromJsonAsync<AdminOverview>(Url("/api/admin/overview"), Ct))!.DeletionsDue;
        Assert.True(due >= 1);

        var deleted = await deleteIt(admin);
        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
        Assert.False(await AccountExistsAsync(me.Account.Id));
        Assert.Equal(due - 1, (await admin.Client.GetFromJsonAsync<AdminOverview>(Url("/api/admin/overview"), Ct))!.DeletionsDue);
        Assert.Equal(HttpStatusCode.NotFound, (await deleteIt(admin)).StatusCode);
        Assert.Equal(new Kept(0, 0, 0, 0), await KeptAsync(me.Profiles[0].Id));
        Assert.True(await RetiredAsync(me.Profiles[0].PublicId));
        Assert.True(await RetiredAsync(child.PublicId));
        var login = await LoginAsync(factory.CreateClient(), email);
        Assert.Equal((HttpStatusCode.Unauthorized, "invalid_credentials"), (login.StatusCode, await CodeAsync(login)));
        // The address is nobody's any more: a new account may take it.
        await using var scope = factory.Services.CreateAsyncScope();
        Assert.Null(await scope.ServiceProvider.GetRequiredService<UserManager<Account>>().FindByEmailAsync(email));
        // The audit log keeps who did it, for its year (ADR 0034).
        var entry = await scope.ServiceProvider.GetRequiredService<ToheDbContext>().AuditLog
            .SingleAsync(e => e.Action == AuditActions.UserDelete && e.Actor == admin.Email, Ct);
        using var details = JsonDocument.Parse(entry.Details!);
        Assert.Equal(2, details.RootElement.GetProperty("profiles").GetInt32());
    }

    [Fact]
    public async Task The_console_deletes_only_an_account_whose_owner_asked()
    {
        var admin = await Admins.NewAsync(factory, "admin");
        var (_, me) = await RegisterAsync("Bà");

        var refused = await admin.Client.PostAsync(Url($"/api/admin/users/{me.Account.Id}/delete"), null, Ct);

        Assert.Equal((HttpStatusCode.Conflict, "deletion_not_requested"), (refused.StatusCode, await CodeAsync(refused)));
        Assert.True(await AccountExistsAsync(me.Account.Id));
    }

    // ------------------------------------------------------------------ helpers

    /// <summary>What is kept of a profile: saves, scores, results on boards, and their decisions.</summary>
    private sealed record Kept(int Saves, int Scores, int Results, int Decisions);

    private async Task<Kept> KeptAsync(Guid profileId)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();
        var results = db.IntegrityResults.Where(r => r.ProfileId == profileId);
        return new Kept(
            await db.SavedGames.CountAsync(s => s.ProfileId == profileId, Ct),
            await db.Scores.CountAsync(s => s.ProfileId == profileId, Ct),
            await results.CountAsync(Ct),
            await db.IntegrityDecisions.CountAsync(d => results.Any(r => r.Id == d.ResultId), Ct));
    }

    private async Task<bool> RetiredAsync(string publicId)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        return await scope.ServiceProvider.GetRequiredService<ToheDbContext>().RetiredProfileIds.AnyAsync(r => r.PublicId == publicId, Ct);
    }

    private async Task<DateTimeOffset?> DeleteAfterAsync(Guid accountId)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        return await scope.ServiceProvider.GetRequiredService<ToheDbContext>().Users
            .Where(a => a.Id == accountId).Select(a => a.DeleteAfter).SingleAsync(Ct);
    }

    private async Task<bool> AccountExistsAsync(Guid accountId)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        return await scope.ServiceProvider.GetRequiredService<ToheDbContext>().Users.AnyAsync(a => a.Id == accountId, Ct);
    }

    /// <summary>Seven days later, as far as this account is concerned.</summary>
    private async Task WaitIsOverAsync(Guid accountId)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        await scope.ServiceProvider.GetRequiredService<ToheDbContext>().Users
            .Where(a => a.Id == accountId)
            .ExecuteUpdateAsync(set => set.SetProperty(a => a.DeleteAfter, DateTimeOffset.UtcNow.AddMinutes(-1)), Ct);
    }

    /// <summary>A closed table where Na (seat 0, the host) and Bố (seat 1) finished a hand of Tiến Lên.</summary>
    private async Task<Guid> FinishedHandAsync(Guid accountId, ProfileView na, ProfileView bo)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();
        var seats = JsonSerializer.Serialize(new List<SeatRecord>
        {
            new(na.Id, accountId, na.Name, na.Avatar, null),
            new(bo.Id, accountId, bo.Name, bo.Avatar, null),
        });
        var now = DateTimeOffset.UtcNow;
        var room = new Room
        {
            Id = Guid.CreateVersion7(),
            Code = "000000",
            GameId = "tien-len",
            GameVersion = "0.6.1",
            RulesPath = "tien-len/0.6.1/rules.js",
            HostProfileId = na.Id,
            HostAccountId = accountId,
            Seats = 2,
            SeatList = seats,
            Status = RoomStatus.Closed,
            Hand = 1,
            CreatedAt = now,
            UpdatedAt = now,
            ClosedAt = now,
        };
        db.Rooms.Add(room);
        db.RoomHands.Add(new RoomHand
        {
            RoomId = room.Id,
            GameId = "tien-len",
            GameVersion = "0.6.1",
            Hand = 1,
            Seed = 42,
            Options = "{}",
            Seats = seats,
            Result = "{}",
            FinishedAt = now,
        });
        db.RoomResults.AddRange(
            new RoomResult { RoomId = room.Id, GameId = "tien-len", Hand = 1, Seat = 0, ProfileId = na.Id, AccountId = accountId, Place = 0, Points = 3, At = now },
            new RoomResult { RoomId = room.Id, GameId = "tien-len", Hand = 1, Seat = 1, ProfileId = bo.Id, AccountId = accountId, Place = 1, Points = 1, At = now });
        await db.SaveChangesAsync(Ct);
        return room.Id;
    }

    private async Task<(HttpClient Client, MeView Me)> RegisterAsync(string displayName, string? email = null)
    {
        var client = factory.CreateClient();
        return (client, await Accounts.SignUpAsync(factory, client, displayName, email));
    }

    private static Task<HttpResponseMessage> LoginAsync(HttpClient client, string email) =>
        client.PostAsJsonAsync(Url("/api/auth/login"), new { email, password = Accounts.Password }, Ct);

    private static async Task<ProfileView> AddProfileAsync(HttpClient client, string name, string? ageBand = null)
    {
        var response = await client.PostAsJsonAsync(Url("/api/profiles"), new { name, avatar = "🐼", ageBand }, Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<MeView>(Ct))!.Profiles.Single(p => p.Name == name);
    }

    private static async Task PlayAsAsync(HttpClient client, Guid profileId)
    {
        var response = await client.PutAsJsonAsync(Url("/api/session/profile"), new { profileId }, Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private static ScoreInput Run(double value) => new(Guid.NewGuid(), "merge-block", "default", value, DateTimeOffset.UtcNow, true);

    private static async Task RecordAsync(HttpClient client, params ScoreInput[] scores)
    {
        var response = await client.PostAsJsonAsync(Url("/api/progress/scores"), new { scores }, Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private static async Task PutSaveAsync(HttpClient client, string gameId)
    {
        var response = await client.PutAsJsonAsync(Url($"/api/progress/saves/{gameId}"), new { data = new { level = 3 } }, Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private static async Task<string?> CodeAsync(HttpResponseMessage response)
    {
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct));
        return document.RootElement.TryGetProperty("code", out var code) ? code.GetString() : null;
    }

    private static Uri Url(string path) => new(path, UriKind.Relative);
}
