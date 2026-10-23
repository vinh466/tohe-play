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

    /// <summary>A game whose build opens share entries itself (ADR 0045).</summary>
    private const string EntryGame = "thach-ban";

    /// <summary>One that also asks for a name to open (ADR 0045).</summary>
    private const string NamedEntryGame = "thach-ten";
    private static readonly CancellationToken Ct = TestContext.Current.CancellationToken;

    public async ValueTask InitializeAsync()
    {
        await Games.KnowAsync(factory, Game);
        await Games.KnowRoomGameAsync(factory, "co-tuong");
        await Games.KnowEntryGameAsync(factory, EntryGame);
        await Games.KnowEntryGameAsync(factory, NamedEntryGame, "named");
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
        Assert.Equal(("game", Game, "1.0.0", "any", "ok", "vi"), (made.Kind, made.GameId, made.GameVersion, made.Level, made.State, made.Language));
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
    public async Task An_entry_link_is_made_only_for_a_game_that_takes_entries_and_options_are_checked()
    {
        var phone = await DevicePhoneAsync("Mèo Cam");
        var payload = new { v = 1, seed = 913, score = 12340 };
        var notTaken = await phone.Client.PostAsJsonAsync(Url("/api/links"), new { kind = "entry", gameId = Game, payload }, Ct);
        Assert.Equal((HttpStatusCode.BadRequest, "entry_not_supported"), (notTaken.StatusCode, await CodeAsync(notTaken)));

        foreach (var bad in new object[]
        {
            new { kind = "entry", gameId = EntryGame },
            new { kind = "game", gameId = Game, payload },
            new { kind = "page", gameId = Game },
            new { kind = "game", gameId = Game, level = "admin" },
            new { kind = "game", gameId = Game, expiresInHours = 0 },
            new { kind = "game", gameId = Game, expiresInHours = 2161 },
            new { kind = "game", gameId = Game, maxUses = 0 },
            new { kind = "game", gameId = Game, maxUses = 1001 },
            new { kind = "game", gameId = Game, language = "fr" },
            new { kind = "game", gameId = Game, language = "EN" },
            new { kind = "game", gameId = Game, language = "vi-VN" },
            new { kind = "game", gameId = Game, language = "" },
        })
        {
            Assert.Equal(HttpStatusCode.BadRequest, (await phone.Client.PostAsJsonAsync(Url("/api/links"), bad, Ct)).StatusCode);
        }

        var unknown = await phone.Client.PostAsJsonAsync(Url("/api/links"), new { kind = "game", gameId = "no-such-game" }, Ct);
        Assert.Equal((HttpStatusCode.NotFound, "game_not_found"), (unknown.StatusCode, await CodeAsync(unknown)));

        var ninety = await MakeAsync(phone.Client, new { kind = "game", gameId = Game, expiresInHours = 2160, maxUses = 1000 });
        Assert.Equal((TimeSpan.FromDays(90), 1000), (ninety.ExpiresAt - ninety.CreatedAt, ninety.MaxUses));

        // At most 2 KB as UTF-8: Vietnamese takes more than a byte a letter.
        var big = await phone.Client.PostAsJsonAsync(Url("/api/links"), new { kind = "entry", gameId = EntryGame, payload = new string('ế', 700) }, Ct);
        Assert.Equal((HttpStatusCode.BadRequest, "payload_too_large"), (big.StatusCode, await CodeAsync(big)));
        var fits = await MakeAsync(phone.Client, new { kind = "entry", gameId = EntryGame, payload = new string('a', 2046) });
        Assert.Equal("entry", fits.Kind);
    }

    [Theory]
    [InlineData("Mình được 12.340 điểm Ghép Khối. Bạn vượt được không?", true)]
    [InlineData("  I scored 1,234,567 in Merge Blocks. Can you beat it?  ", true)]
    [InlineData("Hai dòng\nđây", false)]
    [InlineData("Vào toheplay.io.vn chơi nhé", false)]
    [InlineData("Xem https://example.com", false)]
    [InlineData("Xem www.example nhé", false)]
    [InlineData("Gọi mình 0901234567", false)]
    [InlineData("Thư cho mình: na@example.vn", false)]
    [InlineData("đồ khốn nạn", false)]
    [InlineData("Gọi 0901 234 567", false)]
    [InlineData("Gọi 090-123-4567", false)]
    [InlineData("Gọi 0901.234.567", false)]
    [InlineData("Được 12.340 điểm", true)]
    [InlineData("Vào tròchơi.vn nhé", false)]
    [InlineData("Vào toheplay．io nhé", false)]
    [InlineData("Vào toheplay。vn nhé", false)]
    [InlineData("Vào toheplay｡vn nhé", false)]
    [InlineData("Vào tоhеplay.іо nhé", false)]
    [InlineData("Vào toheplay\u200B.vn nhé", false)]
    [InlineData("Vượt\u2060 nhé", false)]
    [InlineData("   ", false)]
    public void A_share_message_goes_out_only_when_it_passes_the_checks(string text, bool sent) =>
        Assert.Equal(sent ? text.Trim() : null, ShareTexts.Accept(text));

    [Fact]
    public void A_share_message_is_one_line_of_120_characters_at_most()
    {
        Assert.NotNull(ShareTexts.Accept(new string('a', 120)));
        Assert.Null(ShareTexts.Accept(new string('a', 121)));
        // Characters as people count them: a letter typed with its marks apart is one.
        Assert.NotNull(ShareTexts.Accept(string.Concat(Enumerable.Repeat("e\u0302\u0301", 120))));
    }

    [Fact]
    public async Task An_entry_link_takes_the_registrys_version_and_at_least_the_games_level()
    {
        var phone = await DevicePhoneAsync("Mèo Cam");
        var payload = new { v = 1, seed = 913, score = 12340 };
        // What the request says of the version is not read.
        var made = await MakeAsync(phone.Client, new { kind = "entry", gameId = EntryGame, payload, gameVersion = "9.9.9", level = "any" });
        Assert.Equal(("entry", "1.0.0", "any"), (made.Kind, made.GameVersion, made.Level));
        var stored = await QueryAsync(db => db.ShareLinks.Where(l => l.Code == made.Code).Select(l => l.Payload).SingleAsync(Ct));
        using (var kept = JsonDocument.Parse(stored!))
        {
            Assert.Equal((1, 913, 12340), (kept.RootElement.GetProperty("v").GetInt32(), kept.RootElement.GetProperty("seed").GetInt32(), kept.RootElement.GetProperty("score").GetInt32()));
        }

        // The message is checked and given back when it may be sent; kept nowhere.
        var text = "Mình được 12.340 điểm. Bạn vượt được không?";
        Assert.Equal(text, (await MakeAsync(phone.Client, new { kind = "entry", gameId = EntryGame, payload, text })).Message);
        Assert.Null((await MakeAsync(phone.Client, new { kind = "entry", gameId = EntryGame, payload, text = "Gọi 0901234567" })).Message);
        Assert.All(await MineAsync(phone), view => Assert.Null(view.Message));

        // A game that asks for a name to open raises the link to it, whatever was asked; a higher level stays.
        var raised = await MakeAsync(phone.Client, new { kind = "entry", gameId = NamedEntryGame, payload, level = "any" });
        Assert.Equal("named", raised.Level);
        var game = await MakeAsync(phone.Client, new { kind = "game", gameId = NamedEntryGame });
        Assert.Equal("named", game.Level);
        var bo = await PersonAsync("Bố");
        Assert.Equal("account", (await MakeAsync(bo.Client, new { kind = "entry", gameId = NamedEntryGame, payload, level = "account" })).Level);
    }

    [Fact]
    public async Task Playing_an_entry_link_gives_its_payload_version_and_maker_and_nothing_else_does()
    {
        var maker = await DevicePhoneAsync("Mèo Cam");
        var payload = new { v = 1, seed = 913, score = 12340, note = "PAYLOAD-MARK" };
        var link = await MakeAsync(maker.Client, new { kind = "entry", gameId = EntryGame, payload });
        var anyone = factory.CreateClient();

        var opened = await OpenAsync(anyone, link.Code);
        Assert.Equal(("ok", "entry", "Mèo Cam"), (opened.State, opened.Kind, opened.MakerName));
        Assert.Null(opened.Entry);

        var played = await PlayAsync(anyone, link.Code);
        Assert.NotNull(played.Entry);
        Assert.Equal(("1.0.0", ProfileOptions.Avatars[2]), (played.Entry.Version, played.Entry.MakerAvatar));
        Assert.Equal(913, played.Entry.Payload.GetProperty("seed").GetInt32());
        Assert.Equal("PAYLOAD-MARK", played.Entry.Payload.GetProperty("note").GetString());

        // Never in a preview, nor in the console's view of the link, nor in the maker's own list.
        Assert.DoesNotContain("PAYLOAD-MARK", await PreviewAsync($"/api/previews/s/{link.Code}"), StringComparison.Ordinal);
        var moderator = await Admins.NewAsync(factory, "moderator");
        var console = await moderator.Client.GetStringAsync(Url($"/api/admin/links/{link.Code}"), Ct);
        Assert.DoesNotContain("PAYLOAD-MARK", console, StringComparison.Ordinal);
        Assert.DoesNotContain("payload", console, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("PAYLOAD-MARK", await maker.Client.GetStringAsync(Url("/api/links/mine"), Ct), StringComparison.Ordinal);

        // A game link has none; a link that no longer opens gives none.
        var plain = await MakeAsync(maker.Client, new { kind = "game", gameId = EntryGame });
        Assert.Null((await PlayAsync(anyone, plain.Code)).Entry);
        await maker.Client.PostAsync(Url($"/api/links/{link.Code}/revoke"), null, Ct);
        Assert.Null((await PlayAsync(anyone, link.Code)).Entry);
    }

    [Theory]
    [InlineData("""{"n":1e131071}""", "1e131071")]
    [InlineData("""{"s":"a\u0000b"}""", "a\\u0000b")]
    [InlineData("""{"s":"Vượt 12.340 của Na"}""", "12.340")]
    public async Task An_entry_payload_comes_back_as_it_was_written(string payload, string kept)
    {
        var maker = await DevicePhoneAsync("Mèo Cam");
        var body = $$"""{"kind":"entry","gameId":"{{EntryGame}}","payload":{{payload}}}""";
        var made = await maker.Client.PostAsync(Url("/api/links"), new StringContent(body, System.Text.Encoding.UTF8, "application/json"), Ct);
        var link = await ReadAsync<ShareLinkView>(made);

        var played = await factory.CreateClient().PostAsync(Url($"/api/links/{link.Code}/play"), null, Ct);
        var text = await played.Content.ReadAsStringAsync(Ct);
        Assert.Equal(HttpStatusCode.OK, played.StatusCode);
        // Byte for byte as the game wrote it, and as small: a number is not spelled out, a NUL stays escaped.
        Assert.Contains(kept, text, StringComparison.Ordinal);
        Assert.InRange(text.Length, 1, 4096);
        Assert.Equal(payload, await QueryAsync(db => db.ShareLinks.Where(l => l.Code == link.Code).Select(l => l.Payload).SingleAsync(Ct)));
    }

    [Fact]
    public async Task An_entry_link_from_a_child_names_no_maker()
    {
        var parent = await PersonAsync("Mẹ");
        var child = await ChildAsync(parent, "Bin");
        await Accounts.StepUpAsync(parent.Client);
        var allowed = await parent.Client.PatchAsJsonAsync(Url($"/api/profiles/{child.ProfileId}"), new { playWithOthers = true }, Ct);
        Assert.Equal(HttpStatusCode.OK, allowed.StatusCode);
        var link = await MakeAsync(child.Client, new { kind = "entry", gameId = EntryGame, payload = new { v = 1 } });

        var played = await PlayAsync(factory.CreateClient(), link.Code);
        Assert.Equal("ok", played.State);
        Assert.Null(played.MakerName);
        Assert.Null(played.Entry?.MakerAvatar);
        Assert.Equal(1, played.Entry?.Payload.GetProperty("v").GetInt32());
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

        // Its owner turns the switch off: its links stop, as revoked with no name, and come back when it is on again.
        var off = await parent.Client.PatchAsJsonAsync(Url($"/api/profiles/{child.ProfileId}"), new { playWithOthers = false }, Ct);
        Assert.Equal(HttpStatusCode.OK, off.StatusCode);
        var anyone = factory.CreateClient();
        Assert.Equal(new LinkIntent(made.Code, "revoked", "game", Game, Game, "any"), await OpenAsync(anyone, made.Code));
        Assert.Equal("revoked", (await PlayAsync(anyone, made.Code)).State);
        Assert.Contains("<title>Tò He</title>", await PreviewAsync($"/api/previews/s/{made.Code}"), StringComparison.Ordinal);
        Assert.Equal("revoked", Assert.Single(await MineAsync(child.Client)).State);
        await parent.Client.PatchAsJsonAsync(Url($"/api/profiles/{child.ProfileId}"), new { playWithOthers = true }, Ct);
        Assert.Equal("ok", (await OpenAsync(anyone, made.Code)).State);
    }

    [Fact]
    public async Task Links_merged_into_a_child_follow_its_switch()
    {
        var device = await DevicePhoneAsync("Mèo Cam");
        var link = await MakeAsync(device.Client, new { kind = "game", gameId = Game });
        var me = await Accounts.SignUpAsync(factory, device.Plain, "Mẹ");
        await Accounts.StepUpAsync(device.Plain);
        var made = await device.Plain.PostAsJsonAsync(Url("/api/profiles"), new { name = "Bé Na", avatar = ProfileOptions.Avatars[1], ageBand = "9-12" }, Ct);
        var child = (await ReadAsync<MeView>(made)).Profiles.Single(p => p.Name == "Bé Na").Id;
        var merged = await device.Plain.PostAsJsonAsync(Url($"/api/profiles/{child}/merge"), new { name = "Mèo Cam", deviceProfileId = device.ProfileId }, Ct);
        Assert.Equal(HttpStatusCode.OK, merged.StatusCode);

        // A child's, kept to its account: revoked, no name.
        Assert.Equal(new LinkIntent(link.Code, "revoked", "game", Game, Game, "any"), await OpenAsync(factory.CreateClient(), link.Code));
        Assert.Equal(HttpStatusCode.OK, (await device.Plain.PatchAsJsonAsync(Url($"/api/profiles/{child}"), new { playWithOthers = true }, Ct)).StatusCode);
        var intent = await OpenAsync(factory.CreateClient(), link.Code);
        Assert.Equal(("ok", (string?)null), (intent.State, intent.MakerName));
        Assert.Single(me.Profiles);
    }

    [Fact]
    public async Task Requests_at_the_same_moment_never_pass_the_profiles_limit_together()
    {
        await using var limited = factory.WithWebHostBuilder(builder => builder.UseSetting("Links:MakesPerProfilePerDay", "2"));
        var client = limited.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = true });
        Assert.Equal(HttpStatusCode.NoContent, (await client.PostAsync(Url("/api/devices"), null, Ct)).StatusCode);
        var profile = await RegisterAsync(client, "Một");
        var answers = await Task.WhenAll(Enumerable.Range(0, 8).Select(_ => MakeAsResponseAsync(client, profile)));
        Assert.Equal(2, answers.Count(answer => answer.StatusCode == HttpStatusCode.OK));
        Assert.All(answers.Where(answer => answer.StatusCode != HttpStatusCode.OK), answer => Assert.Equal(HttpStatusCode.TooManyRequests, answer.StatusCode));
        Assert.Equal(2, await QueryAsync(db => db.ShareLinks.CountAsync(l => l.MakerProfileId == profile, Ct)));
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

    [Theory]
    [InlineData(null, "unknown")]
    [InlineData("203.0.113.7", "203.0.113.7")]
    [InlineData("::ffff:203.0.113.7", "203.0.113.7")]
    [InlineData("2001:db8:1:2:aaaa:bbbb:cccc:dddd", "2001:db8:1:2::/64")]
    [InlineData("2001:db8:1:2::1", "2001:db8:1:2::/64")]
    public void A_client_is_counted_by_its_ipv4_address_or_its_ipv6_64(string? address, string key) =>
        Assert.Equal(key, Infrastructure.ClientAddress.PartitionKey(address is null ? null : System.Net.IPAddress.Parse(address)));

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
        // The only script is the card's own, static one.
        Assert.Equal(1, card.Split("<script", StringSplitOptions.None).Length - 1);
        Assert.Contains($"<script>{LinkPreviews.SendOnScript}</script>", card, StringComparison.Ordinal);
        Assert.DoesNotContain("{{", card, StringComparison.Ordinal);
        Assert.DoesNotContain("`", card, StringComparison.Ordinal);
        Assert.Contains("&lt;script&gt;alert(1)&lt;/script&gt;&quot;&#39; &#123;&#123; env &quot;SECRET&quot; &#125;&#125; &#96;x&#96; &amp;amp; mời bạn chơi merge-block", card, StringComparison.Ordinal);
        // Every attribute keeps its quotes: nothing broke out of one.
        Assert.All(card.Split('\n').Where(line => line.StartsWith("<meta", StringComparison.Ordinal)), line => Assert.Equal(0, line.Count(c => c == '"') % 2));
    }

    [Fact]
    public async Task A_card_sends_a_person_on_to_the_app_with_its_one_script_allowed_by_hash()
    {
        var response = await factory.CreateClient().GetAsync(Url("/api/previews/r/123456"), Ct);
        var csp = response.Headers.GetValues("Content-Security-Policy").Single();
        var hash = Convert.ToBase64String(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(LinkPreviews.SendOnScript)));
        Assert.Equal($"default-src 'none'; script-src 'sha256-{hash}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'", csp);
        Assert.Equal("User-Agent", response.Headers.Vary.Single());
        var card = await response.Content.ReadAsStringAsync(Ct);
        Assert.Contains("<a href=\"http://localhost/r/123456?app=1\">Mở Tò He</a>", card, StringComparison.Ordinal);
        Assert.Contains("location.replace(location.pathname+'?app=1')", LinkPreviews.SendOnScript, StringComparison.Ordinal);
        // Once sent on, it does nothing: a card asked for at its API path never reloads itself.
        Assert.StartsWith("if(!/[?&]app=/.test(location.search))", LinkPreviews.SendOnScript, StringComparison.Ordinal);
    }

    [Fact]
    public void Escaping_drops_control_characters_and_keeps_vietnamese()
    {
        Assert.Equal("Bé Na &lt;3", LinkPreviews.Escape("Bé\u0000 Na\u0007 <3"));
        var card = LinkPreviews.Render(new PreviewCard("A \"b\"", "c", CardWords.Vietnamese), "https://h.test/s/ABC?x=\"1\"", "https://h.test/og.png");
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
        Assert.Contains($"<a href=\"http://localhost/s/{link.Code}?app=1\">Mở Tò He</a>", card, StringComparison.Ordinal);
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
    public async Task Cards_name_the_game_in_vietnamese_and_a_links_intent_carries_its_names()
    {
        // Standard names in English, with a Vietnamese one (ADR 0048): a link made, or a table opened, without a
        // language is Vietnamese, and so is its card (ADR 0047).
        await Games.KnowAsync(factory, "ghep-so");
        await Games.KnowRoomGameAsync(factory, "o-an-quan");
        await QueryAsync(db => db.Games.Where(game => game.Id == "ghep-so").ExecuteUpdateAsync(set => set
            .SetProperty(game => game.Name, "Merge Blocks")
            .SetProperty(game => game.Names, """{ "vi": "Ghép Khối", "en-GB": "Merging Blocks" }"""), Ct));
        await QueryAsync(db => db.Games.Where(game => game.Id == "o-an-quan").ExecuteUpdateAsync(set => set
            .SetProperty(game => game.Name, "Mandarin Squares")
            .SetProperty(game => game.Names, """{ "vi": "Ô Ăn Quan" }"""), Ct));

        var maker = await DevicePhoneAsync("Lan");
        var link = await MakeAsync(maker.Client, new { kind = "game", gameId = "ghep-so" });
        var card = await PreviewAsync($"/api/previews/s/{link.Code}");
        Assert.Contains("<title>Lan mời bạn chơi Ghép Khối</title>", card, StringComparison.Ordinal);
        Assert.DoesNotContain("Merge Blocks", card, StringComparison.Ordinal);

        // The hub shows its own language's name: the intent carries the standard one and the names per language.
        var intent = await OpenAsync(factory.CreateClient(), link.Code);
        Assert.Equal("Merge Blocks", intent.GameName);
        Assert.Equal(new Dictionary<string, string> { ["vi"] = "Ghép Khối", ["en-GB"] = "Merging Blocks" }, intent.GameNames);

        var table = await CreateRoomAsync(await PersonAsync("Hùng"), new { gameId = "o-an-quan", seats = 2, isPublic = true });
        Assert.Contains("<title>Lời mời vào bàn Ô Ăn Quan</title>", await PreviewAsync($"/api/previews/r/{table.Code}"), StringComparison.Ordinal);
    }

    [Fact]
    public async Task A_card_speaks_the_language_its_link_was_made_in()
    {
        await Games.KnowAsync(factory, "ghep-en");
        await QueryAsync(db => db.Games.Where(game => game.Id == "ghep-en").ExecuteUpdateAsync(set => set
            .SetProperty(game => game.Name, "Merge Blocks")
            .SetProperty(game => game.Names, """{ "vi": "Ghép Khối", "en-GB": "Merging Blocks" }"""), Ct));
        var maker = await DevicePhoneAsync("Lan");

        // In English: the page, its locale, its words, and the game's name looked up in English — the standard one, as
        // `en` does not find `en-GB` (ADR 0048).
        var english = await MakeAsync(maker.Client, new { kind = "game", gameId = "ghep-en", language = "en" });
        Assert.Equal("en", english.Language);
        var card = await PreviewAsync($"/api/previews/s/{english.Code}");
        Assert.Contains("<html lang=\"en\">", card, StringComparison.Ordinal);
        Assert.Contains("<meta property=\"og:locale\" content=\"en_US\">", card, StringComparison.Ordinal);
        Assert.Contains("<title>Lan invites you to play Merge Blocks</title>", card, StringComparison.Ordinal);
        Assert.Contains("<meta property=\"og:title\" content=\"Lan invites you to play Merge Blocks\">", card, StringComparison.Ordinal);
        Assert.Contains($"<meta property=\"og:description\" content=\"{CardWords.English.Description}\">", card, StringComparison.Ordinal);
        Assert.Contains($"<a href=\"http://localhost/s/{english.Code}?app=1\">Open Tò He</a>", card, StringComparison.Ordinal);
        Assert.DoesNotContain("Ghép Khối", card, StringComparison.Ordinal);
        Assert.DoesNotContain("mời", card, StringComparison.Ordinal);

        // In Vietnamese, asked for or by default: the Vietnamese name and words.
        foreach (var made in new[]
        {
            await MakeAsync(maker.Client, new { kind = "game", gameId = "ghep-en", language = "vi" }),
            await MakeAsync(maker.Client, new { kind = "game", gameId = "ghep-en" }),
        })
        {
            Assert.Equal("vi", made.Language);
            var vietnamese = await PreviewAsync($"/api/previews/s/{made.Code}");
            Assert.Contains("<html lang=\"vi\">", vietnamese, StringComparison.Ordinal);
            Assert.Contains("<meta property=\"og:locale\" content=\"vi_VN\">", vietnamese, StringComparison.Ordinal);
            Assert.Contains("<title>Lan mời bạn chơi Ghép Khối</title>", vietnamese, StringComparison.Ordinal);
            Assert.Contains($"<meta property=\"og:description\" content=\"{CardWords.Vietnamese.Description}\">", vietnamese, StringComparison.Ordinal);
            Assert.Contains($"<a href=\"http://localhost/s/{made.Code}?app=1\">Mở Tò He</a>", vietnamese, StringComparison.Ordinal);
        }

        // The maker sees the language each was made in; the link itself carries none to whoever opens it.
        Assert.Equal(new[] { "vi", "vi", "en" }, (await MineAsync(maker)).Select(view => view.Language));
        Assert.Equal("ok", (await OpenAsync(factory.CreateClient(), english.Code)).State);

        // A link that no longer opens gets the generic card, in Vietnamese, whatever it was made in.
        await maker.Client.PostAsync(Url($"/api/links/{english.Code}/revoke"), null, Ct);
        var revoked = await PreviewAsync($"/api/previews/s/{english.Code}");
        Assert.Contains("<html lang=\"vi\">", revoked, StringComparison.Ordinal);
        Assert.Contains("<title>Tò He</title>", revoked, StringComparison.Ordinal);
    }

    [Fact]
    public async Task A_childs_card_in_english_names_the_game_only()
    {
        var parent = await PersonAsync("Mẹ");
        var child = await ChildAsync(parent, "Bé Na");
        await Accounts.StepUpAsync(parent.Client);
        Assert.Equal(HttpStatusCode.OK, (await parent.Client.PatchAsJsonAsync(Url($"/api/profiles/{child.ProfileId}"), new { playWithOthers = true }, Ct)).StatusCode);
        var made = await MakeAsync(child.Client, new { kind = "game", gameId = Game, language = "en" });
        var card = await PreviewAsync($"/api/previews/s/{made.Code}");
        Assert.Contains("<title>An invite to play merge-block</title>", card, StringComparison.Ordinal);
        Assert.DoesNotContain("Bé Na", card, StringComparison.Ordinal);
    }

    [Fact]
    public async Task A_tables_card_speaks_the_language_it_was_opened_in_and_a_private_one_still_says_nothing()
    {
        await Games.KnowRoomGameAsync(factory, "o-an-quan-en");
        await QueryAsync(db => db.Games.Where(game => game.Id == "o-an-quan-en").ExecuteUpdateAsync(set => set
            .SetProperty(game => game.Name, "Mandarin Squares")
            .SetProperty(game => game.Names, """{ "vi": "Ô Ăn Quan" }"""), Ct));

        var english = await CreateRoomAsync(await PersonAsync("Lan"), new { gameId = "o-an-quan-en", seats = 2, isPublic = true, language = "en" });
        var card = await PreviewAsync($"/api/previews/r/{english.Code}");
        Assert.Contains("<html lang=\"en\">", card, StringComparison.Ordinal);
        Assert.Contains("<meta property=\"og:locale\" content=\"en_US\">", card, StringComparison.Ordinal);
        Assert.Contains("<title>An invite to a Mandarin Squares table</title>", card, StringComparison.Ordinal);
        Assert.Contains($"<meta property=\"og:description\" content=\"{CardWords.English.Description}\">", card, StringComparison.Ordinal);
        Assert.DoesNotContain("Lan", card, StringComparison.Ordinal);

        var vietnamese = await CreateRoomAsync(await PersonAsync("Hùng"), new { gameId = "o-an-quan-en", seats = 2, isPublic = true, language = "vi" });
        var tableCard = await PreviewAsync($"/api/previews/r/{vietnamese.Code}");
        Assert.Contains("<html lang=\"vi\">", tableCard, StringComparison.Ordinal);
        Assert.Contains("<title>Lời mời vào bàn Ô Ăn Quan</title>", tableCard, StringComparison.Ordinal);

        // The language is kept with the table, as it is kept through a restart.
        Assert.Equal("en", await QueryAsync(db => db.Rooms.Where(room => room.Id == english.Id).Select(room => room.Language).SingleAsync(Ct)));

        // A private table opened in English reads exactly as a code that names no table: Vietnamese, the same words.
        var hidden = await CreateRoomAsync(await PersonAsync("Tú"), new { gameId = "o-an-quan-en", seats = 2, isPublic = false, language = "en" });
        var hiddenCard = await PreviewAsync($"/api/previews/r/{hidden.Code}");
        var noTable = await PreviewAsync("/api/previews/r/000000");
        Assert.Contains("<html lang=\"vi\">", hiddenCard, StringComparison.Ordinal);
        Assert.Equal(noTable.Replace("000000", "", StringComparison.Ordinal), hiddenCard.Replace(hidden.Code, "", StringComparison.Ordinal));
    }

    [Fact]
    public async Task A_table_is_opened_only_in_a_language_the_hub_speaks()
    {
        var host = await PersonAsync("Lan");
        foreach (var language in new[] { "fr", "EN", "en-US", "" })
        {
            var refused = await host.Client.PostAsJsonAsync(Url("/api/rooms"), new { gameId = "co-tuong", seats = 2, language }, Ct);
            Assert.Equal(HttpStatusCode.BadRequest, refused.StatusCode);
        }

        var table = await CreateRoomAsync(host, new { gameId = "co-tuong", seats = 2 });
        Assert.Equal("vi", await QueryAsync(db => db.Rooms.Where(room => room.Id == table.Id).Select(room => room.Language).SingleAsync(Ct)));
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
