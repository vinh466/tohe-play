using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql;
using Testcontainers.PostgreSql;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Identity;
using Tohe.Api.Modules.Rooms;

namespace Tohe.Api.Tests;

/// <summary>
/// Migrations that move data, run against data shaped like UAT's before them (E-01). UAT holds a family's history and
/// migrates when the API starts, so the move is tested here, not discovered there.
/// </summary>
public sealed class MigrationTests : IAsyncLifetime
{
    private static readonly CancellationToken Ct = TestContext.Current.CancellationToken;

    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:18-alpine").Build();

    public async ValueTask InitializeAsync() => await _postgres.StartAsync(Ct);

    public async ValueTask DisposeAsync() => await _postgres.DisposeAsync();

    [Fact]
    public async Task Households_become_accounts_that_own_their_profiles()
    {
        await using var db = new ToheDbContext(new DbContextOptionsBuilder<ToheDbContext>()
            .UseNpgsql(_postgres.GetConnectionString())
            .UseSnakeCaseNamingConvention()
            .Options);
        var migrator = db.GetService<IMigrator>();
        await migrator.MigrateAsync("20261017173932_TransactionalEmail", Ct);

        // A household: two adults (mum first), a child, a room the dad hosts with a bot, a finished hand, and a result
        // of a child profile that was removed since.
        var household = Guid.NewGuid();
        var mum = Guid.NewGuid();
        var dad = Guid.NewGuid();
        var mumProfile = Guid.NewGuid();
        var dadProfile = Guid.NewGuid();
        var child = Guid.NewGuid();
        var removed = Guid.NewGuid();
        var room = Guid.NewGuid();
        var run = Guid.NewGuid();
        var seats = $$"""
            [{"ProfileId":"{{dadProfile}}","HouseholdId":"{{household}}","Name":"Bố","Avatar":"🦊","Bot":null,"Auto":false},
             {"ProfileId":null,"HouseholdId":null,"Name":null,"Avatar":null,"Bot":"easy","Auto":true},
             {"ProfileId":null,"HouseholdId":null,"Name":null,"Avatar":null,"Bot":null,"Auto":false}]
            """;
        await ExecuteAsync($$"""
            INSERT INTO households.households (id, name, created_at, telemetry_enabled)
            VALUES ('{{household}}', 'Nhà Na', now() - interval '3 days', false);
            INSERT INTO identity.accounts (id, display_name, household_id, created_at, user_name, normalized_user_name,
                email_confirmed, phone_number_confirmed, two_factor_enabled, lockout_enabled, access_failed_count)
            VALUES ('{{mum}}', 'Mẹ', '{{household}}', now() - interval '3 days', 'me', 'ME', false, false, false, true, 0),
                   ('{{dad}}', 'Bố', '{{household}}', now() - interval '2 days', 'bo', 'BO', false, false, false, true, 0);
            INSERT INTO households.profiles (id, household_id, name, avatar, kind, account_id, created_at)
            VALUES ('{{mumProfile}}', '{{household}}', 'Mẹ', '🐼', 'Adult', '{{mum}}', now() - interval '3 days'),
                   ('{{dadProfile}}', '{{household}}', 'Bố', '🦊', 'Adult', '{{dad}}', now() - interval '2 days');
            INSERT INTO households.profiles (id, household_id, name, avatar, kind, age_band, created_at)
            VALUES ('{{child}}', '{{household}}', 'Na', '🐰', 'Child', '6-8', now() - interval '1 day');
            INSERT INTO rooms.rooms (id, code, game_id, game_version, rules_path, host_profile_id, host_household_id,
                is_public, household_only, locked, seats, bots_fill, bots_take_over, turn_seconds, options, seat_list,
                status, hand, seed, hand_seats, scores, created_at, updated_at)
            VALUES ('{{room}}', '482913', 'tien-len', '0.2.0', 'tien-len/0.2.0/rules.js', '{{dadProfile}}', '{{household}}',
                false, true, false, 3, true, true, 30, '{}', '{{seats}}', 'waiting', 1, 7, '[0,1,2]', '[0,0,0]',
                now(), now());
            INSERT INTO rooms.hands (room_id, game_id, game_version, hand, seed, options, seats, result, finished_at)
            VALUES ('{{room}}', 'tien-len', '0.2.0', 1, 7, '{}', '{{seats}}', '{}', now());
            INSERT INTO rooms.results (room_id, game_id, hand, seat, profile_id, household_id, place, points, at)
            VALUES ('{{room}}', 'tien-len', 1, 0, '{{dadProfile}}', '{{household}}', 0, 3, now()),
                   ('{{room}}', 'tien-len', 1, 1, '{{removed}}', '{{household}}', 1, 1, now()),
                   ('{{room}}', 'tien-len', 1, 2, null, null, 2, 0, now());
            INSERT INTO progress.scores (profile_id, game_id, board, value, achieved_at, recorded_at, client_id, final)
            VALUES ('{{child}}', 'merge-block', 'default', 420, now() - interval '1 day', now() - interval '1 day', '{{run}}', true);
            """);

        await migrator.MigrateAsync(cancellationToken: Ct);

        var owners = await QueryAsync(
            "SELECT id, account_id, public_id FROM identity.profiles",
            reader => (Id: reader.GetGuid(0), Account: reader.GetGuid(1), PublicId: reader.GetString(2)));
        Assert.Equal(3, owners.Count);
        Assert.Equal(mum, owners.Single(p => p.Id == mumProfile).Account);
        Assert.Equal(dad, owners.Single(p => p.Id == dadProfile).Account);
        Assert.Equal(mum, owners.Single(p => p.Id == child).Account); // the household's first adult
        Assert.All(owners, p => Assert.True(ProfileIds.TryNormalize(p.PublicId, out _), p.PublicId));
        Assert.Equal(3, owners.Select(p => p.PublicId).Distinct().Count());

        var telemetry = await QueryAsync("SELECT telemetry_enabled FROM identity.accounts", reader => reader.GetBoolean(0));
        Assert.Equal([false, false], telemetry);

        var hosted = await QueryAsync(
            $"SELECT host_account_id, account_only, seat_list::text FROM rooms.rooms WHERE id = '{room}'",
            reader => (Host: reader.GetGuid(0), AccountOnly: reader.GetBoolean(1), Seats: reader.GetString(2)));
        Assert.Equal(dad, hosted[0].Host);
        Assert.True(hosted[0].AccountOnly);
        AssertSeats(hosted[0].Seats, dadProfile, dad);

        var handSeats = await QueryAsync("SELECT seats::text FROM rooms.hands", reader => reader.GetString(0));
        AssertSeats(handSeats[0], dadProfile, dad);

        var results = await QueryAsync(
            "SELECT seat, account_id FROM rooms.results ORDER BY seat",
            reader => reader.IsDBNull(1) ? (Guid?)null : reader.GetGuid(1));
        Assert.Equal([dad, mum, null], results); // a removed profile's result stays with the household's first adult

        var leftovers = await QueryAsync(
            "SELECT count(*) FROM information_schema.schemata WHERE schema_name = 'households'",
            reader => reader.GetInt64(0));
        Assert.Equal(0, leftovers[0]);

        // Results so far come into the integrity engine as they were trusted (ADR 0029): the run as reported, the hand
        // as refereed — public, two people sat at it — each with its first decision.
        var trusted = await QueryAsync(
            "SELECT kind, profile_id, account_id, level, \"public\", source FROM integrity.results ORDER BY kind, source",
            reader => (Kind: reader.GetString(0), Profile: reader.GetGuid(1), Account: reader.GetGuid(2), Level: reader.GetString(3),
                Public: reader.GetBoolean(4), Source: reader.GetString(5)));
        Assert.Equal(
            [("Hand", dadProfile, dad, "Verified", true), ("Hand", removed, mum, "Verified", true), ("Run", child, mum, "Reported", true)],
            trusted.Select(r => (r.Kind, r.Profile, r.Account, r.Level, r.Public)));
        Assert.Equal($"run:{child:N}:{run:N}", trusted[2].Source);
        var imported = await QueryAsync(
            "SELECT count(*) FROM integrity.decisions WHERE reason = 'imported' AND \"from\" IS NULL", reader => reader.GetInt64(0));
        Assert.Equal(3, imported[0]);

        // And the API's own model reads what the migration left.
        Assert.Equal(3, await db.Profiles.CountAsync(Ct));
        Assert.Equal(2, await db.Profiles.CountAsync(p => p.AccountId == mum, Ct));
    }

    private static void AssertSeats(string json, Guid profile, Guid account)
    {
        Assert.DoesNotContain("HouseholdId", json, StringComparison.Ordinal);
        var seats = JsonSerializer.Deserialize<List<SeatRecord>>(json)!;
        Assert.Equal(3, seats.Count);
        Assert.Equal(profile, seats[0].ProfileId);
        Assert.Equal(account, seats[0].AccountId);
        Assert.Equal("Bố", seats[0].Name);
        Assert.Null(seats[1].AccountId);
        Assert.Equal("easy", seats[1].Bot);
        Assert.True(seats[2].IsEmpty);
    }

    private async Task ExecuteAsync(string sql)
    {
        await using var connection = new NpgsqlConnection(_postgres.GetConnectionString());
        await connection.OpenAsync(Ct);
        await using var command = new NpgsqlCommand(sql, connection);
        await command.ExecuteNonQueryAsync(Ct);
    }

    private async Task<List<T>> QueryAsync<T>(string sql, Func<NpgsqlDataReader, T> read)
    {
        await using var connection = new NpgsqlConnection(_postgres.GetConnectionString());
        await connection.OpenAsync(Ct);
        await using var command = new NpgsqlCommand(sql, connection);
        await using var reader = await command.ExecuteReaderAsync(Ct);
        var rows = new List<T>();
        while (await reader.ReadAsync(Ct))
        {
            rows.Add(read(reader));
        }

        return rows;
    }
}
