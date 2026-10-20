using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Identity;
using Tohe.Api.Modules.Links;
using Tohe.Api.Modules.Rooms;

namespace Tohe.Api.Tests;

/// <summary>
/// Share links and link previews (ADR 0044, step I3a): codes, making them as a `named` feature with its limits, the
/// child's switch, resolving with its limit, counts and the threshold of three, uses, expiry and revoking, the maker's
/// life — deleted, merged, moved, suspended — the console, and the cards crawlers get: escaped, 200 every time, a
/// table's naming no one. And a closed table's code, kept for a day.
/// </summary>
public sealed class ShareLinksTests(ApiFactory factory) : IClassFixture<ApiFactory>, IAsyncLifetime
{
    private const string Terms = "2026-10-20";
    private const string Game = "merge-block";
    private static readonly CancellationToken Ct = TestContext.Current.CancellationToken;

    public async ValueTask InitializeAsync()
    {
        await Games.KnowAsync(factory, Game);
        await Games.KnowRoomGameAsync(factory, "co-tuong");
    }

    public ValueTask DisposeAsync() => ValueTask.CompletedTask;

    // ------------------------------------------------------------------ codes

    [Theory]
    [InlineData("7KQ2M9XA", "7KQ2M9XA")]
    [InlineData("7kq2-m9xa", "7KQ2M9XA")]
    [InlineData(" 7KQ2 M9XA ", "7KQ2M9XA")]
    [InlineData("iLo0abcd", "1100ABCD")]
    public void A_typed_code_is_read_case_insensitively_without_spaces_or_hyphens(string typed, string code)
    {
        Assert.True(LinkCodes.TryNormalize(typed, out var read));
        Assert.Equal(code, read);
    }

    [Theory]
    [InlineData("")]
    [InlineData("7KQ2M9X")]
    [InlineData("7KQ2M9XAB")]
    [InlineData("7KQ2M9XU")]
    [InlineData("7KQ2M9X!")]
    [InlineData("482913")]
    public void Anything_else_is_no_share_code(string typed) => Assert.False(LinkCodes.TryNormalize(typed, out _));

    [Fact]
    public void New_codes_are_eight_characters_of_the_alphabet()
    {
        for (var i = 0; i < 200; i++)
        {
            var code = LinkCodes.New();
            Assert.Equal(8, code.Length);
            Assert.All(code, c => Assert.Contains(c, LinkCodes.Alphabet));
        }
    }

    // ------------------------------------------------------------------ making

    [Fact]
    public async Task A_device_profile_makes_a_game_link_with_the_registrys_version_and_30_days_by_default()
    {
        var phone = await DevicePhoneAsync("Mèo Cam");
        var made = await MakeAsync(phone.Client, new { kind = "game", gameId = Game });
        Assert.Equal(("game", Game, "1.0.0", "any", "ok"), (made.Kind, made.GameId, made.GameVersion, made.Level, made.State));
        Assert.True(LinkCodes.TryNormalize(made.Code, out var code) && code == made.Code);
        Assert.InRange(made.ExpiresAt - made.CreatedAt, TimeSpan.FromDays(30) - TimeSpan.FromSeconds(1), TimeSpan.FromDays(30) + TimeSpan.FromSeconds(1));
        Assert.Equal(new LinkCounts(0, 0, null), made.Counts);

        var mine = (await phone.Client.GetFromJsonAsync<List<ShareLinkView>>(Url("/api/links/mine"), Ct))!;
        Assert.Equal(made.Code, Assert.Single(mine).Code);
    }

    [Fact]
    public async Task Making_a_link_is_a_named_feature()
    {
        // No player at all.
        var nobody = factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await nobody.PostAsJsonAsync(Url("/api/links"), new { kind = "game", gameId = Game }, Ct)).StatusCode);

        // A device profile without its server copy, or without the terms the hub shows.
        var phone = await StartedPhoneAsync();
        using (var unknown = new HttpRequestMessage(HttpMethod.Post, Url("/api/links")) { Content = JsonContent.Create(new { kind = "game", gameId = Game }) })
        {
            unknown.Headers.Add(DeviceKey.ProfileHeader, Guid.NewGuid().ToString());
            unknown.Headers.Add(DeviceKey.TermsHeader, Terms);
            var refused = await phone.Plain.SendAsync(unknown, Ct);
            Assert.Equal((HttpStatusCode.NotFound, "device_profile_not_found"), (refused.StatusCode, await CodeAsync(refused)));
        }

        var named = await DevicePhoneAsync("Chó Vàng");
        using (var oldTerms = new HttpRequestMessage(HttpMethod.Post, Url("/api/links")) { Content = JsonContent.Create(new { kind = "game", gameId = Game }) })
        {
            oldTerms.Headers.Add(DeviceKey.ProfileHeader, named.ProfileId.ToString());
            oldTerms.Headers.Add(DeviceKey.TermsHeader, "2027-01-01");
            var refused = await named.Plain.SendAsync(oldTerms, Ct);
            Assert.Equal((HttpStatusCode.PreconditionFailed, "terms_required"), (refused.StatusCode, await CodeAsync(refused)));
        }

        // An account's profile.
        var bo = await PersonAsync("Bố");
        Assert.Equal("ok", (await MakeAsync(bo.Client, new { kind = "game", gameId = Game, level = "account" })).State);
    }

    [Fact]
    public async Task An_entry_link_is_refused_until_step_I4_and_options_are_checked()
    {
        var phone = await DevicePhoneAsync("Mèo Cam");
        var entry = await phone.Client.PostAsJsonAsync(Url("/api/links"), new { kind = "entry", gameId = Game }, Ct);
        Assert.Equal((HttpStatusCode.BadRequest, "kind_not_supported"), (entry.StatusCode, await CodeAsync(entry)));

        foreach (var bad in new object[]
        {
            new { kind = "page", gameId = Game },
            new { kind = "game", gameId = Game, level = "admin" },
            new { kind = "game", gameId = Game, expiresInHours = 0 },
            new { kind = "game", gameId = Game, expiresInHours = 2161 },
            new { kind = "game", gameId = Game, maxUses = 0 },
            new { kind = "game", gameId = Game, maxUses = 1001 },
        })
        {
            Assert.Equal(HttpStatusCode.BadRequest, (await phone.Client.PostAsJsonAsync(Url("/api/links"), bad, Ct)).StatusCode);
        }

        var unknown = await phone.Client.PostAsJsonAsync(Url("/api/links"), new { kind = "game", gameId = "no-such-game" }, Ct);
        Assert.Equal((HttpStatusCode.NotFound, "game_not_found"), (unknown.StatusCode, await CodeAsync(unknown)));

        var ninety = await MakeAsync(phone.Client, new { kind = "game", gameId = Game, expiresInHours = 2160, maxUses = 1000 });
        Assert.Equal((TimeSpan.FromDays(90), 1000), (ninety.ExpiresAt - ninety.CreatedAt, ninety.MaxUses));
    }

    [Fact]
    public async Task A_child_makes_links_only_while_play_with_others_is_on()
    {
        var parent = await PersonAsync("Mẹ");
        var child = await ChildAsync(parent, "Bé Na");
        var refused = await child.Client.PostAsJsonAsync(Url("/api/links"), new { kind = "game", gameId = Game }, Ct);
        Assert.Equal((HttpStatusCode.Forbidden, "play_with_others_off"), (refused.StatusCode, await CodeAsync(refused)));

        await Accounts.StepUpAsync(parent.Client);
        var on = await parent.Client.PatchAsJsonAsync(Url($"/api/profiles/{child.ProfileId}"), new { playWithOthers = true }, Ct);
        Assert.Equal(HttpStatusCode.OK, on.StatusCode);
        var made = await MakeAsync(child.Client, new { kind = "game", gameId = Game });
        Assert.Equal("ok", made.State);

        // Its card names no child: the game only.
        var card = await PreviewAsync($"/api/previews/s/{made.Code}");
        Assert.Contains("<title>Lời mời chơi merge-block</title>", card, StringComparison.Ordinal);
        Assert.DoesNotContain("Bé Na", card, StringComparison.Ordinal);
        var intent = await OpenAsync(factory.CreateClient(), made.Code);
        Assert.Null(intent.MakerName);
    }

    [Fact]
    public async Task Limits_hold_per_profile_and_per_device_key()
    {
        await using var limited = factory.WithWebHostBuilder(builder =>
        {
            builder.UseSetting("Links:MakesPerProfilePerDay", "2");
            builder.UseSetting("Links:MakesPerDevicePerDay", "3");
        });
        var client = limited.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = true });
        Assert.Equal(HttpStatusCode.NoContent, (await client.PostAsync(Url("/api/devices"), null, Ct)).StatusCode);
        var first = await RegisterAsync(client, "Một");
        var second = await RegisterAsync(client, "Hai");

        // The first profile: two, then its own limit.
        Assert.Equal(HttpStatusCode.OK, (await MakeAsResponseAsync(client, first)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await MakeAsResponseAsync(client, first)).StatusCode);
        var third = await MakeAsResponseAsync(client, first);
        Assert.Equal((HttpStatusCode.TooManyRequests, "link_limit"), (third.StatusCode, await CodeAsync(third)));

        // The second profile of the same device: one more, then the device's limit.
        Assert.Equal(HttpStatusCode.OK, (await MakeAsResponseAsync(client, second)).StatusCode);
        var fourth = await MakeAsResponseAsync(client, second);
        Assert.Equal((HttpStatusCode.TooManyRequests, "link_limit"), (fourth.StatusCode, await CodeAsync(fourth)));
    }

    // ------------------------------------------------------------------ resolving

    [Fact]
    public async Task Resolving_is_limited_per_address()
    {
        await using var limited = factory.WithWebHostBuilder(builder => builder.UseSetting("Links:ResolvesPerMinute", "2"));
        var client = limited.CreateClient();
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsync(Url("/api/links/7KQ2M9XA/open"), null, Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsync(Url("/api/links/7KQ2M9XA/play"), null, Ct)).StatusCode);
        var third = await client.PostAsync(Url("/api/links/7KQ2M9XA/open"), null, Ct);
        Assert.Equal((HttpStatusCode.TooManyRequests, "resolve_limit"), (third.StatusCode, await CodeAsync(third)));
    }

    [Fact]
    public async Task Resolving_is_limited_for_the_whole_server()
    {
        await using var limited = factory.WithWebHostBuilder(builder => builder.UseSetting("Links:ResolvesPerMinuteGlobal", "1"));
        var client = limited.CreateClient();
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsync(Url("/api/links/7KQ2M9XA/open"), null, Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.TooManyRequests, (await client.PostAsync(Url("/api/links/7KQ2M9XA/open"), null, Ct)).StatusCode);
    }

    [Fact]
    public async Task An_unknown_code_resolves_as_unknown_and_nothing_more()
    {
        var anyone = factory.CreateClient();
        var intent = await OpenAsync(anyone, "zzzz-zzzz");
        Assert.Equal(new LinkIntent("ZZZZZZZZ", "unknown"), intent);
        Assert.Equal(new LinkIntent("", "unknown"), await OpenAsync(anyone, "no-such-link"));
        // Read as a code the way people type them: O as 0.
        Assert.Equal(new LinkIntent("N0TAC0DE", "unknown"), await OpenAsync(anyone, "not-a-code"));
    }

    [Fact]
    public async Task Counts_opened_and_played_and_accounts_made_only_from_three()
    {
        var maker = await DevicePhoneAsync("Lan");
        var link = await MakeAsync(maker.Client, new { kind = "game", gameId = Game });
        var anyone = factory.CreateClient();

        var opened = await OpenAsync(anyone, link.Code.ToLowerInvariant());
        Assert.Equal(new LinkIntent(link.Code, "ok", "game", Game, Game, "any", "Lan"), opened);
        await OpenAsync(anyone, link.Code);
        var played = await PlayAsync(anyone, link.Code);
        Assert.Equal("ok", played.State);

        // Two accounts made from the entry: the maker does not see it yet.
        await SignUpFromAsync(link.Code);
        await SignUpFromAsync(link.Code);
        var counts = await CountsAsync(maker, link.Code);
        Assert.Equal(new LinkCounts(2, 1, null), counts);
        Assert.Equal(1, Assert.Single(await MineAsync(maker), view => view.Code == link.Code).Uses);

        // The third: all three now. A code that names no link counts nothing, and never fails the sign-up.
        await SignUpFromAsync(link.Code.ToLowerInvariant());
        await SignUpFromAsync("ZZZZZZZZ");
        await SignUpFromAsync("<not a code>");
        await SignUpFromAsync(new string('A', 500));
        Assert.Equal(new LinkCounts(2, 1, 3), await CountsAsync(maker, link.Code));
    }

    [Fact]
    public async Task A_link_with_maximum_uses_is_used_up_once_they_are_taken()
    {
        var maker = await DevicePhoneAsync("Lan");
        var link = await MakeAsync(maker.Client, new { kind = "game", gameId = Game, maxUses = 2 });
        var anyone = factory.CreateClient();

        // Opening takes no use; playing does, atomically.
        await OpenAsync(anyone, link.Code);
        var plays = await Task.WhenAll(Enumerable.Range(0, 5).Select(_ => PlayAsync(anyone, link.Code)));
        Assert.Equal(2, plays.Count(intent => intent.State == "ok"));
        Assert.All(plays.Where(intent => intent.State != "ok"), intent => Assert.Equal(("used_up", Game), (intent.State, intent.GameId)));
        Assert.Equal("used_up", (await OpenAsync(anyone, link.Code)).State);

        var view = Assert.Single(await MineAsync(maker), v => v.Code == link.Code);
        Assert.Equal((2, "used_up", 2), (view.Uses, view.State, view.Counts.Played));
    }

    [Fact]
    public async Task A_link_asking_a_level_takes_a_use_only_from_such_a_player()
    {
        var maker = await PersonAsync("Ba");
        var named = await MakeAsync(maker.Client, new { kind = "game", gameId = Game, level = "named" });
        var account = await MakeAsync(maker.Client, new { kind = "game", gameId = Game, level = "account" });

        var anonymous = await factory.CreateClient().PostAsync(Url($"/api/links/{named.Code}/play"), null, Ct);
        Assert.Equal((HttpStatusCode.Forbidden, "level_required"), (anonymous.StatusCode, await CodeAsync(anonymous)));

        var device = await DevicePhoneAsync("Khách");
        Assert.Equal("ok", (await PlayAsync(device.Client, named.Code)).State);
        var deviceOnAccount = await device.Client.PostAsync(Url($"/api/links/{account.Code}/play"), null, Ct);
        Assert.Equal((HttpStatusCode.Forbidden, "level_required"), (deviceOnAccount.StatusCode, await CodeAsync(deviceOnAccount)));

        var other = await PersonAsync("Chú");
        Assert.Equal("ok", (await PlayAsync(other.Client, account.Code)).State);
        Assert.Equal(1, Assert.Single(await MineAsync(maker.Client), v => v.Code == account.Code).Uses);
    }

    [Fact]
    public async Task Expiry_changes_and_a_revoked_link_stays_revoked()
    {
        var maker = await DevicePhoneAsync("Lan");
        var link = await MakeAsync(maker.Client, new { kind = "game", gameId = Game, expiresInHours = 1 });

        // A new expiry, from now, within one hour and 90 days.
        var longer = await maker.Client.PatchAsJsonAsync(Url($"/api/links/{link.Code}"), new { expiresInHours = 48 }, Ct);
        var changed = await ReadAsync<ShareLinkView>(longer);
        Assert.InRange(changed.ExpiresAt, DateTimeOffset.UtcNow.AddHours(47), DateTimeOffset.UtcNow.AddHours(49));
        Assert.Equal(HttpStatusCode.BadRequest, (await maker.Client.PatchAsJsonAsync(Url($"/api/links/{link.Code}"), new { expiresInHours = 2161 }, Ct)).StatusCode);

        // Someone else's link is not theirs to change or revoke.
        var stranger = await DevicePhoneAsync("Người lạ");
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.Client.PatchAsJsonAsync(Url($"/api/links/{link.Code}"), new { expiresInHours = 2 }, Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.Client.PostAsync(Url($"/api/links/{link.Code}/revoke"), null, Ct)).StatusCode);

        // Expired: the reason and the game, no name; its card is the generic one.
        await QueryAsync(db => db.ShareLinks.Where(l => l.Code == link.Code)
            .ExecuteUpdateAsync(set => set.SetProperty(l => l.ExpiresAt, DateTimeOffset.UtcNow.AddMinutes(-1)), Ct));
        var anyone = factory.CreateClient();
        Assert.Equal(new LinkIntent(link.Code, "expired", "game", Game, Game, "any"), await OpenAsync(anyone, link.Code));
        Assert.Equal("expired", (await PlayAsync(anyone, link.Code)).State);
        Assert.Contains("<title>Tò He</title>", await PreviewAsync($"/api/previews/s/{link.Code}"), StringComparison.Ordinal);

        // Given a new expiry it opens again; revoked, it never does.
        await maker.Client.PatchAsJsonAsync(Url($"/api/links/{link.Code}"), new { expiresInHours = 2 }, Ct);
        Assert.Equal("ok", (await OpenAsync(anyone, link.Code)).State);
        var revoked = await ReadAsync<ShareLinkView>(await maker.Client.PostAsync(Url($"/api/links/{link.Code}/revoke"), null, Ct));
        Assert.Equal("revoked", revoked.State);
        Assert.Equal(new LinkIntent(link.Code, "revoked", "game", Game, Game, "any"), await OpenAsync(anyone, link.Code));
        var again = await maker.Client.PatchAsJsonAsync(Url($"/api/links/{link.Code}"), new { expiresInHours = 2 }, Ct);
        Assert.Equal((HttpStatusCode.Conflict, "link_revoked"), (again.StatusCode, await CodeAsync(again)));
        Assert.Contains("<title>Tò He</title>", await PreviewAsync($"/api/previews/s/{link.Code}"), StringComparison.Ordinal);
    }

    // ------------------------------------------------------------------ the maker's life

    [Fact]
    public async Task A_deleted_maker_takes_its_links_and_their_counts()
    {
        var maker = await DevicePhoneAsync("Lan");
        var link = await MakeAsync(maker.Client, new { kind = "game", gameId = Game });
        await OpenAsync(factory.CreateClient(), link.Code);

        Assert.Equal(HttpStatusCode.NoContent, (await maker.Plain.DeleteAsync(Url($"/api/devices/profiles/{maker.ProfileId}"), Ct)).StatusCode);
        Assert.Equal("unknown", (await OpenAsync(factory.CreateClient(), link.Code)).State);
        Assert.Equal(0, await QueryAsync(db => db.ShareLinks.CountAsync(l => l.MakerProfileId == maker.ProfileId, Ct)));
        Assert.Equal(0, await QueryAsync(db => db.ShareLinkDays.CountAsync(d => db.ShareLinks.All(l => l.Id != d.LinkId), Ct)));
    }

    [Fact]
    public async Task A_maker_cleaned_up_after_90_days_takes_its_links_too()
    {
        var maker = await DevicePhoneAsync("Lan");
        var link = await MakeAsync(maker.Client, new { kind = "game", gameId = Game });
        await QueryAsync(db => db.Profiles.Where(p => p.Id == maker.ProfileId)
            .ExecuteUpdateAsync(set => set.SetProperty(p => p.LastUsedAt, DateTimeOffset.UtcNow.AddDays(-91)), Ct));
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            await scope.ServiceProvider.GetRequiredService<DeviceCleanup>().RunAsync(Ct);
        }

        Assert.Equal("unknown", (await OpenAsync(factory.CreateClient(), link.Code)).State);
    }

    [Fact]
    public async Task A_merged_makers_links_move_to_the_target_and_a_moved_one_keeps_them()
    {
        // Moved to another device with a transfer code: the same id, the same links, managed from the new device.
        var old = await DevicePhoneAsync("Mèo Cam");
        var link = await MakeAsync(old.Client, new { kind = "game", gameId = Game });
        var transfer = await old.Plain.PostAsJsonAsync(Url($"/api/devices/profiles/{old.ProfileId}/transfer"), new { termsVersion = Terms }, Ct);
        var secret = (await ReadAsync<TransferCodeView>(transfer)).Secret;
        var phone = await StartedPhoneAsync();
        Assert.Equal(HttpStatusCode.OK, (await phone.Plain.PostAsJsonAsync(Url("/api/devices/transfers/redeem"), new { secret }, Ct)).StatusCode);
        var moved = phone with { ProfileId = old.ProfileId };
        Name(moved);
        Assert.Equal(link.Code, Assert.Single(await MineAsync(moved)).Code);
        Assert.Equal("Mèo Cam", (await OpenAsync(factory.CreateClient(), link.Code)).MakerName);

        // Merged into an account's profile: its links are the target's.
        var me = await Accounts.SignUpAsync(factory, phone.Plain, "Chú");
        await Accounts.StepUpAsync(phone.Plain);
        var target = me.Profiles[0].Id;
        var merged = await phone.Plain.PostAsJsonAsync(Url($"/api/profiles/{target}/merge"), new { name = "Mèo Cam", deviceProfileId = old.ProfileId }, Ct);
        Assert.Equal(HttpStatusCode.OK, merged.StatusCode);
        Assert.Equal(target, await QueryAsync(db => db.ShareLinks.Where(l => l.Code == link.Code).Select(l => l.MakerProfileId).SingleAsync(Ct)));
        Assert.Equal(link.Code, Assert.Single(await MineAsync(phone.Plain)).Code);
        Assert.Equal("Chú", (await OpenAsync(factory.CreateClient(), link.Code)).MakerName);
    }

    [Fact]
    public async Task A_suspended_or_leaving_makers_links_resolve_as_revoked_with_no_name()
    {
        var maker = await PersonAsync("Ba");
        var link = await MakeAsync(maker.Client, new { kind = "game", gameId = Game });
        var anyone = factory.CreateClient();
        Assert.Equal("Ba", (await OpenAsync(anyone, link.Code)).MakerName);

        await QueryAsync(db => db.Users.Where(a => a.Id == maker.Me.Account.Id)
            .ExecuteUpdateAsync(set => set.SetProperty(a => a.SuspendedAt, DateTimeOffset.UtcNow), Ct));
        Assert.Equal(new LinkIntent(link.Code, "revoked", "game", Game, Game, "any"), await OpenAsync(anyone, link.Code));
        Assert.Equal("revoked", (await PlayAsync(anyone, link.Code)).State);
        var card = await PreviewAsync($"/api/previews/s/{link.Code}");
        Assert.Contains("<title>Tò He</title>", card, StringComparison.Ordinal);
        Assert.DoesNotContain("Ba mời", card, StringComparison.Ordinal);

        // Lifted, it opens again; waiting to be deleted, it does not.
        await QueryAsync(db => db.Users.Where(a => a.Id == maker.Me.Account.Id)
            .ExecuteUpdateAsync(set => set.SetProperty(a => a.SuspendedAt, (DateTimeOffset?)null).SetProperty(a => a.DeleteAfter, DateTimeOffset.UtcNow.AddDays(7)), Ct));
        Assert.Equal("revoked", (await OpenAsync(anyone, link.Code)).State);
        await QueryAsync(db => db.Users.Where(a => a.Id == maker.Me.Account.Id)
            .ExecuteUpdateAsync(set => set.SetProperty(a => a.DeleteAfter, (DateTimeOffset?)null), Ct));
        Assert.Equal("ok", (await OpenAsync(anyone, link.Code)).State);
    }

    // ------------------------------------------------------------------ the console

    [Fact]
    public async Task The_console_finds_a_link_with_every_count_and_revokes_it()
    {
        var maker = await DevicePhoneAsync("Lan");
        var link = await MakeAsync(maker.Client, new { kind = "game", gameId = Game });
        await OpenAsync(factory.CreateClient(), link.Code);
        await SignUpFromAsync(link.Code);

        var moderator = await Admins.NewAsync(factory, "moderator");
        var found = (await moderator.Client.GetFromJsonAsync<AdminShareLinkView>(Url($"/api/admin/links/{link.Code.ToLowerInvariant()}"), Ct))!;
        Assert.Equal((link.Code, "ok", 1, 0, 1), (found.Code, found.State, found.Opened, found.Played, found.AccountsMade));
        Assert.Equal((maker.ProfileId, "Lan", (Guid?)null), (found.Maker.ProfileId, found.Maker.Name, found.Maker.AccountId));
        Assert.Equal(HttpStatusCode.NotFound, (await moderator.Client.GetAsync(Url("/api/admin/links/ZZZZZZZZ"), Ct)).StatusCode);

        // A viewer reads nothing of people; the players' session does nothing on the console's routes.
        var viewer = await Admins.NewAsync(factory, "viewer");
        Assert.Equal(HttpStatusCode.Forbidden, (await viewer.Client.GetAsync(Url($"/api/admin/links/{link.Code}"), Ct)).StatusCode);

        var revoked = await moderator.Client.PostAsync(Url($"/api/admin/links/{link.Code}/revoke"), null, Ct);
        Assert.Equal("revoked", (await ReadAsync<AdminShareLinkView>(revoked)).State);
        Assert.Equal("revoked", (await OpenAsync(factory.CreateClient(), link.Code)).State);
        Assert.Equal(1, await QueryAsync(db => db.AuditLog.CountAsync(e => e.Action == "link.revoke" && e.Target!.Contains(link.Code), Ct)));
    }

    // ------------------------------------------------------------------ previews

    [Fact]
    public async Task A_hostile_name_renders_escaped()
    {
        var maker = await DevicePhoneAsync("Lan");
        var link = await MakeAsync(maker.Client, new { kind = "game", gameId = Game });
        const string hostile = "<script>alert(1)</script>\"' {{ env \"SECRET\" }} `x` &amp;";
        await QueryAsync(db => db.Profiles.Where(p => p.Id == maker.ProfileId)
            .ExecuteUpdateAsync(set => set.SetProperty(p => p.Name, hostile), Ct));

        var response = await factory.CreateClient().GetAsync(Url($"/api/previews/s/{link.Code}"), Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("text/html", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal("noindex", response.Headers.GetValues("X-Robots-Tag").Single());
        var card = await response.Content.ReadAsStringAsync(Ct);
        Assert.DoesNotContain("<script", card, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("{{", card, StringComparison.Ordinal);
        Assert.DoesNotContain("`", card, StringComparison.Ordinal);
        Assert.Contains("&lt;script&gt;alert(1)&lt;/script&gt;&quot;&#39; &#123;&#123; env &quot;SECRET&quot; &#125;&#125; &#96;x&#96; &amp;amp; mời bạn chơi merge-block", card, StringComparison.Ordinal);
        // Every attribute keeps its quotes: nothing broke out of one.
        Assert.All(card.Split('\n').Where(line => line.StartsWith("<meta", StringComparison.Ordinal)), line => Assert.Equal(0, line.Count(c => c == '"') % 2));
    }

    [Fact]
    public void Escaping_drops_control_characters_and_keeps_vietnamese()
    {
        Assert.Equal("Bé Na &lt;3", LinkPreviews.Escape("Bé\u0000 Na\u0007 <3"));
        var card = LinkPreviews.Render(new PreviewCard("A \"b\"", "c"), "https://h.test/s/ABC?x=\"1\"", "https://h.test/og.png");
        Assert.Contains("<meta property=\"og:url\" content=\"https://h.test/s/ABC?x=&quot;1&quot;\">", card, StringComparison.Ordinal);
    }

    [Fact]
    public async Task A_share_links_card_names_the_maker_by_the_servers_name_and_the_game()
    {
        var maker = await DevicePhoneAsync("Lan");
        var link = await MakeAsync(maker.Client, new { kind = "game", gameId = Game });
        // A moderator renamed it on the server: the card shows that name.
        await QueryAsync(db => db.Profiles.Where(p => p.Id == maker.ProfileId)
            .ExecuteUpdateAsync(set => set.SetProperty(p => p.Name, "Người chơi 1").SetProperty(p => p.NameModeratedAt, DateTimeOffset.UtcNow), Ct));
        var card = await PreviewAsync($"/api/previews/s/{link.Code}");
        Assert.Contains("<meta property=\"og:title\" content=\"Người chơi 1 mời bạn chơi merge-block\">", card, StringComparison.Ordinal);
        Assert.Contains("<meta name=\"twitter:title\" content=\"Người chơi 1 mời bạn chơi merge-block\">", card, StringComparison.Ordinal);
        Assert.Contains($"<meta property=\"og:url\" content=\"http://localhost/s/{link.Code}\">", card, StringComparison.Ordinal);
        Assert.Contains("<meta property=\"og:image\" content=\"http://localhost/og.png\">", card, StringComparison.Ordinal);
        Assert.Contains($"<a href=\"http://localhost/s/{link.Code}\">", card, StringComparison.Ordinal);
        Assert.DoesNotContain("Lan", card, StringComparison.Ordinal);
    }

    [Theory]
    [InlineData("/api/previews/s/ZZZZZZZZ")]
    [InlineData("/api/previews/s/not-a-code")]
    [InlineData("/api/previews/s/%3Cb%3E")]
    public async Task An_unknown_link_gets_the_generic_card_with_200(string path)
    {
        var response = await factory.CreateClient().GetAsync(Url(path), Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var card = await response.Content.ReadAsStringAsync(Ct);
        Assert.Contains("<title>Tò He</title>", card, StringComparison.Ordinal);
        Assert.Contains("og:description", card, StringComparison.Ordinal);
        Assert.DoesNotContain("<b>", card, StringComparison.Ordinal);
    }

    [Fact]
    public async Task A_crawler_asking_head_first_hears_200()
    {
        using var head = new HttpRequestMessage(HttpMethod.Head, Url("/api/previews/s/ZZZZZZZZ"));
        var response = await factory.CreateClient().SendAsync(head, Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("text/html", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task A_tables_card_names_no_one_and_shows_the_game_only_when_it_is_listed()
    {
        var host = await PersonAsync("Lan");
        var listed = await CreateRoomAsync(host, new { gameId = "co-tuong", seats = 2, isPublic = true });
        var card = await PreviewAsync($"/api/previews/r/{listed.Code}");
        Assert.Contains("<title>Lời mời vào bàn co-tuong</title>", card, StringComparison.Ordinal);
        Assert.DoesNotContain("Lan", card, StringComparison.Ordinal);

        // A private table, one kept to its account, and one that does not exist read the same.
        var other = await PersonAsync("Hùng");
        var hidden = await CreateRoomAsync(other, new { gameId = "co-tuong", seats = 2, isPublic = false });
        var own = await CreateRoomAsync(await PersonAsync("Tú"), new { gameId = "co-tuong", seats = 2, isPublic = true, entry = "own" });
        var cards = new[]
        {
            await PreviewAsync($"/api/previews/r/{hidden.Code}"),
            await PreviewAsync($"/api/previews/r/{own.Code}"),
            await PreviewAsync("/api/previews/r/000000"),
            await PreviewAsync("/api/previews/r/abc"),
        };
        Assert.All(cards, generic => Assert.Contains("<title>Lời mời vào bàn chơi Tò He</title>", generic, StringComparison.Ordinal));
        Assert.All(cards, generic => Assert.DoesNotContain("co-tuong", generic, StringComparison.Ordinal));
        Assert.Equal(cards[0].Replace(hidden.Code, "", StringComparison.Ordinal), cards[2].Replace("000000", "", StringComparison.Ordinal));
    }

    [Fact]
    public async Task Previews_past_their_limit_get_the_generic_card_and_still_200()
    {
        var maker = await DevicePhoneAsync("Lan");
        var link = await MakeAsync(maker.Client, new { kind = "game", gameId = Game });
        await using var limited = factory.WithWebHostBuilder(builder => builder.UseSetting("Links:PreviewsPerMinute", "1"));
        var client = limited.CreateClient();
        Assert.Contains("Lan mời bạn chơi", await (await client.GetAsync(Url($"/api/previews/s/{link.Code}"), Ct)).Content.ReadAsStringAsync(Ct), StringComparison.Ordinal);
        var over = await client.GetAsync(Url($"/api/previews/s/{link.Code}"), Ct);
        Assert.Equal(HttpStatusCode.OK, over.StatusCode);
        Assert.Contains("<title>Tò He</title>", await over.Content.ReadAsStringAsync(Ct), StringComparison.Ordinal);
    }

    // ------------------------------------------------------------------ rooms

    [Fact]
    public async Task A_closed_tables_code_is_not_given_out_again_for_a_day()
    {
        var registry = factory.Services.GetRequiredService<RoomRegistry>();
        var host = await PersonAsync("Lan");
        var drawn = new Queue<string>(["314159"]);
        registry.DrawCode = () => drawn.TryDequeue(out var code) ? code : "271828";
        try
        {
            var first = await CreateRoomAsync(host, new { gameId = "co-tuong", seats = 2 });
            Assert.Equal("314159", first.Code);
            Assert.Equal(HttpStatusCode.NoContent, (await host.Client.PostAsync(Url($"/api/rooms/{first.Id}/leave"), null, Ct)).StatusCode);

            // Its code comes up again within the day: drawn again.
            drawn.Enqueue("314159");
            drawn.Enqueue("161803");
            var second = await CreateRoomAsync(host, new { gameId = "co-tuong", seats = 2 });
            Assert.Equal("161803", second.Code);

            // A day later, it is free.
            await QueryAsync(db => db.Rooms.Where(r => r.Id == first.Id)
                .ExecuteUpdateAsync(set => set.SetProperty(r => r.ClosedAt, DateTimeOffset.UtcNow.AddDays(-1).AddMinutes(-1)), Ct));
            drawn.Enqueue("314159");
            var third = await CreateRoomAsync(await PersonAsync("Hùng"), new { gameId = "co-tuong", seats = 2 });
            Assert.Equal("314159", third.Code);
        }
        finally
        {
            registry.DrawCode = () => System.Security.Cryptography.RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6", System.Globalization.CultureInfo.InvariantCulture);
        }
    }

    // ------------------------------------------------------------------ helpers

    private sealed record Phone(HttpClient Client, HttpClient Plain, Guid ProfileId);

    private sealed record Person(HttpClient Client, MeView Me, Guid ProfileId);

    private async Task<Phone> StartedPhoneAsync()
    {
        var jar = new CookieJar(factory.Server.CreateHandler());
        var client = new HttpClient(jar, disposeHandler: false) { BaseAddress = factory.Server.BaseAddress };
        var plain = new HttpClient(jar, disposeHandler: false) { BaseAddress = factory.Server.BaseAddress };
        Assert.Equal(HttpStatusCode.NoContent, (await plain.PostAsync(Url("/api/devices"), null, Ct)).StatusCode);
        return new Phone(client, plain, Guid.Empty);
    }

    private async Task<Phone> DevicePhoneAsync(string name)
    {
        var phone = await StartedPhoneAsync();
        var id = Guid.NewGuid();
        Assert.Equal(HttpStatusCode.OK, (await phone.Plain.PostAsJsonAsync(Url("/api/devices/profiles"), Registration(id, name), Ct)).StatusCode);
        var acting = phone with { ProfileId = id };
        Name(acting);
        return acting;
    }

    private static void Name(Phone phone)
    {
        phone.Client.DefaultRequestHeaders.Remove(DeviceKey.ProfileHeader);
        phone.Client.DefaultRequestHeaders.Remove(DeviceKey.TermsHeader);
        phone.Client.DefaultRequestHeaders.Add(DeviceKey.ProfileHeader, phone.ProfileId.ToString());
        phone.Client.DefaultRequestHeaders.Add(DeviceKey.TermsHeader, Terms);
    }

    private static object Registration(Guid id, string name) =>
        new { id, name, avatar = ProfileOptions.Avatars[2], termsVersion = Terms };

    /// <summary>A device profile of the client's device, on the server; its id.</summary>
    private static async Task<Guid> RegisterAsync(HttpClient client, string name)
    {
        var id = Guid.NewGuid();
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync(Url("/api/devices/profiles"), Registration(id, name), Ct)).StatusCode);
        return id;
    }

    private static async Task<HttpResponseMessage> MakeAsResponseAsync(HttpClient client, Guid deviceProfile)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, Url("/api/links")) { Content = JsonContent.Create(new { kind = "game", gameId = Game }) };
        request.Headers.Add(DeviceKey.ProfileHeader, deviceProfile.ToString());
        request.Headers.Add(DeviceKey.TermsHeader, Terms);
        return await client.SendAsync(request, Ct);
    }

    private async Task<Person> PersonAsync(string displayName)
    {
        var jar = new CookieJar(factory.Server.CreateHandler());
        var client = new HttpClient(jar) { BaseAddress = factory.Server.BaseAddress };
        var me = await Accounts.SignUpAsync(factory, client, displayName);
        await PlayAsAsync(client, me.Profiles[0].Id);
        return new Person(client, me, me.Profiles[0].Id);
    }

    private static async Task<Person> ChildAsync(Person parent, string name)
    {
        await Accounts.StepUpAsync(parent.Client);
        var response = await parent.Client.PostAsJsonAsync(Url("/api/profiles"), new { name, avatar = ProfileOptions.Avatars[1], ageBand = "9-12" }, Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var me = (await response.Content.ReadFromJsonAsync<MeView>(Ct))!;
        var child = me.Profiles.Last(p => p.Name == name);
        await PlayAsAsync(parent.Client, child.Id);
        return parent with { Me = me, ProfileId = child.Id };
    }

    private static async Task PlayAsAsync(HttpClient client, Guid profileId)
    {
        var response = await client.PutAsJsonAsync(Url("/api/session/profile"), new { profileId }, Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    /// <summary>A new account made from the share link: the hub passes its code with the request that makes it.</summary>
    private async Task SignUpFromAsync(string entryCode)
    {
        var client = factory.CreateClient();
        var email = Accounts.NewEmail();
        var attempt = await Accounts.StartSignUpAsync(client, email, "Bạn");
        var confirmed = await client.PostAsJsonAsync(
            Url("/api/auth/register/confirm"),
            new { attemptId = attempt, code = await factory.CodeSentToAsync(email), entryCode },
            Ct);
        Assert.Equal(HttpStatusCode.OK, confirmed.StatusCode);
    }

    private static async Task<ShareLinkView> MakeAsync(HttpClient client, object request)
    {
        var response = await client.PostAsJsonAsync(Url("/api/links"), request, Ct);
        Assert.True(response.IsSuccessStatusCode, await response.Content.ReadAsStringAsync(Ct));
        return await ReadAsync<ShareLinkView>(response);
    }

    private static async Task<List<ShareLinkView>> MineAsync(Phone phone) => await MineAsync(phone.Client);

    private static async Task<List<ShareLinkView>> MineAsync(Person person) => await MineAsync(person.Client);

    private static async Task<List<ShareLinkView>> MineAsync(HttpClient client) =>
        (await client.GetFromJsonAsync<List<ShareLinkView>>(Url("/api/links/mine"), Ct))!;

    private static async Task<LinkCounts> CountsAsync(Phone maker, string code) =>
        Assert.Single(await MineAsync(maker), view => view.Code == code).Counts;

    private static async Task<LinkIntent> OpenAsync(HttpClient client, string code) =>
        await ReadAsync<LinkIntent>(await client.PostAsync(Url($"/api/links/{Uri.EscapeDataString(code)}/open"), null, Ct));

    private static async Task<LinkIntent> PlayAsync(HttpClient client, string code) =>
        await ReadAsync<LinkIntent>(await client.PostAsync(Url($"/api/links/{Uri.EscapeDataString(code)}/play"), null, Ct));

    private async Task<string> PreviewAsync(string path)
    {
        var response = await factory.CreateClient().GetAsync(Url(path), Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await response.Content.ReadAsStringAsync(Ct);
    }

    private static async Task<RoomView> CreateRoomAsync(Person person, object request)
    {
        var response = await person.Client.PostAsJsonAsync(Url("/api/rooms"), request, Ct);
        Assert.True(response.IsSuccessStatusCode, await response.Content.ReadAsStringAsync(Ct));
        return await ReadAsync<RoomView>(response);
    }

    private async Task<T> QueryAsync<T>(Func<ToheDbContext, Task<T>> query)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        return await query(scope.ServiceProvider.GetRequiredService<ToheDbContext>());
    }

    private static async Task<T> ReadAsync<T>(HttpResponseMessage response)
    {
        Assert.True(response.IsSuccessStatusCode, $"{(int)response.StatusCode}: {await response.Content.ReadAsStringAsync(Ct)}");
        return (await response.Content.ReadFromJsonAsync<T>(Ct))!;
    }

    private static async Task<string?> CodeAsync(HttpResponseMessage response)
    {
        var text = await response.Content.ReadAsStringAsync(Ct);
        if (string.IsNullOrEmpty(text))
        {
            return null;
        }

        using var json = JsonDocument.Parse(text);
        return json.RootElement.TryGetProperty("code", out var code) ? code.GetString() : null;
    }

    private static Uri Url(string path) => new(path, UriKind.Relative);
}
