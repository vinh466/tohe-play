using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Identity;
using Tohe.Api.Modules.Integrity;
using Tohe.Api.Modules.Progress;
using Tohe.Api.Modules.Registry;

namespace Tohe.Api.Modules.Dev;

/// <summary>
/// Demo data for a development database: a family (an adult and a child), a friend, and a few finished scores on every
/// game that takes scores, so boards and the profile picker show something. Made the way the API makes them — the same
/// <see cref="UserManager{TUser}"/>, public IDs, profile defaults and integrity engine — so every invariant holds. Safe to
/// run again: what exists is kept (a changed password included), what is missing is added. No platform roles: the setup
/// token or <c>admin grant</c> does that. No rooms: they live in memory (ADR 0016).
/// </summary>
internal static class DevSeed
{
    /// <summary>For every demo account. A development password, like <c>tohe-dev-only</c>: it lives in a public repository.</summary>
    public const string Password = "tohe-dev-only";

    /// <summary>The demo accounts' manage PIN (step-up level 1, ADR 0025).</summary>
    public const string ManagePin = "123456";

    /// <summary>
    /// The terms version the hub shows (<c>TERMS_VERSION</c> in <c>apps/hub/src/legal/documents.ts</c>): the hub asks an
    /// account for the terms again unless it holds exactly this one. A test keeps the two equal.
    /// </summary>
    public const string TermsVersion = "2026-10-18.4";

    public const string FamilyEmail = "gia-dinh@tohe.localhost";
    public const string FriendEmail = "ban@tohe.localhost";

    private const string ScoresCapability = "scores";
    private const string Board = "default";

    /// <summary>A profile to have: <see cref="AgeBand"/> set makes it a child's. <see cref="ScoreBase"/> sets its scores.</summary>
    private sealed record ProfileSpec(string Name, string Avatar, string? AgeBand, int ScoreBase);

    private sealed record AccountSpec(string Email, ProfileSpec[] Profiles)
    {
        // An account is named after its first profile, as at sign-up (ADR 0023).
        public string DisplayName => Profiles[0].Name;
    }

    private static readonly AccountSpec[] Demo =
    [
        new(FamilyEmail,
        [
            new("Bố Minh", ProfileOptions.Avatars[0], null, 1800),
            new("Bé Na", ProfileOptions.Avatars[1], "6-8", 900),
        ]),
        new(FriendEmail,
        [
            new("Cô Lan", ProfileOptions.Avatars[8], null, 2600),
        ]),
    ];

    public static async Task RunAsync(IServiceProvider services, TextWriter output)
    {
        var db = services.GetRequiredService<ToheDbContext>();
        // A fresh development database may never have run the API: bring it up to date, as the API does at start.
        await db.Database.MigrateAsync();

        var users = services.GetRequiredService<UserManager<Account>>();
        var clock = services.GetRequiredService<TimeProvider>();
        var games = await ScoredGamesAsync(db);
        var results = services.GetRequiredService<IResults>();
        var people = new List<(Account Account, IReadOnlyList<Profile> Profiles)>();
        var runs = 0;
        foreach (var spec in Demo)
        {
            var (account, profiles) = await EnsureAccountAsync(db, users, clock, spec);
            people.Add((account, profiles));
            foreach (var wanted in spec.Profiles)
            {
                var profile = profiles.Single(p => p.Name == wanted.Name);
                runs += await EnsureScoresAsync(db, results, clock, account, profile, wanted, games);
            }
        }

        await ReportAsync(output, people, games, runs);
    }

    private static async Task<(Account, IReadOnlyList<Profile>)> EnsureAccountAsync(
        ToheDbContext db, UserManager<Account> users, TimeProvider clock, AccountSpec spec)
    {
        var now = clock.GetUtcNow();
        await using var transaction = await db.Database.BeginTransactionAsync();
        var account = await users.FindByEmailAsync(spec.Email);
        if (account is null)
        {
            var id = Guid.CreateVersion7(now);
            account = new Account
            {
                Id = id,
                // Identity needs a user name; an account that signs in by email has an opaque one (ADR 0024).
                UserName = id.ToString("N"),
                Email = spec.Email,
                EmailConfirmed = true,
                DisplayName = spec.DisplayName,
                CreatedAt = now,
                TermsVersion = TermsVersion,
                TermsAcceptedAt = now,
            };
            account.ManagePinHash = ManagePins.Hash(account, ManagePin);
            var created = await users.CreateAsync(account, Password);
            if (!created.Succeeded)
            {
                throw new InvalidOperationException(
                    $"Could not create {spec.Email}: {string.Join(", ", created.Errors.Select(e => e.Code))}");
            }
        }

        var profiles = await db.Profiles.Where(p => p.AccountId == account.Id).OrderBy(p => p.CreatedAt).ToListAsync();
        foreach (var wanted in spec.Profiles)
        {
            if (profiles.Any(p => p.Name == wanted.Name))
            {
                continue;
            }

            if (profiles.Count >= ProfileOptions.MaxProfilesPerAccount)
            {
                throw new InvalidOperationException(
                    $"{spec.Email} already has {ProfileOptions.MaxProfilesPerAccount} profiles, so \"{wanted.Name}\" cannot be added.");
            }

            var child = wanted.AgeBand is not null;
            // Read again for each: profiles are listed in the order they were made, the account's first one first.
            now = clock.GetUtcNow();
            var profile = new Profile
            {
                Id = Guid.CreateVersion7(now),
                AccountId = account.Id,
                PublicId = await ProfileEndpoints.NewPublicIdAsync(db, CancellationToken.None),
                Name = wanted.Name,
                Avatar = wanted.Avatar,
                Kind = child ? ProfileKind.Child : ProfileKind.Adult,
                AgeBand = wanted.AgeBand,
                // The defaults of POST /api/profiles and of sign-up: a child is off public boards and asked to tables only
                // within its account (D-06, ADR 0033); an adult is on boards and asked by anyone.
                OnPublicBoards = !child,
                Invites = child ? InviteScope.Account : InviteScope.Anyone,
                CreatedAt = now,
            };
            db.Profiles.Add(profile);
            await db.SaveChangesAsync();
            profiles.Add(profile);
        }

        await transaction.CommitAsync();
        return (account, profiles);
    }

    /// <summary>Listed games that take scores and are played alone: the registry may still be empty on a first start.</summary>
    private static async Task<IReadOnlyList<Game>> ScoredGamesAsync(ToheDbContext db) =>
        [.. (await db.Games.AsNoTracking().Where(g => g.Listed && g.Rooms == null).OrderBy(g => g.Id).ToListAsync())
            .Where(g => g.Capabilities.Contains(ScoresCapability))];

    /// <summary>Three finished runs per game, as <c>POST /api/progress/scores</c> records them; returns how many are new.</summary>
    private static async Task<int> EnsureScoresAsync(
        ToheDbContext db,
        IResults results,
        TimeProvider clock,
        Account account,
        Profile profile,
        ProfileSpec spec,
        IReadOnlyList<Game> games)
    {
        var now = clock.GetUtcNow();
        var wanted = new List<ScoreEntry>();
        foreach (var game in games)
        {
            for (var run = 0; run < 3; run++)
            {
                wanted.Add(new ScoreEntry
                {
                    ProfileId = profile.Id,
                    GameId = game.Id,
                    Board = Board,
                    // Rising, as a player getting better: the last run is the best.
                    Value = Math.Round(spec.ScoreBase * (1 + (run * 0.6))),
                    AchievedAt = now.AddDays(-(2 - run)),
                    RecordedAt = now,
                    ClientId = ClientIdOf(profile.Id, game.Id, run),
                    Final = true,
                });
            }
        }

        var ids = wanted.Select(s => s.ClientId).ToList();
        var known = await db.Scores.Where(s => s.ProfileId == profile.Id && ids.Contains(s.ClientId))
            .Select(s => s.ClientId).ToListAsync();
        var added = wanted.Where(s => !known.Contains(s.ClientId)).ToList();
        if (added.Count == 0)
        {
            return 0;
        }

        db.Scores.AddRange(added);
        // The engine decides how far each can be trusted, saved with the scores (ADR 0029).
        await results.SubmitRunsAsync(
            profile.Id,
            account.Id,
            [.. added.Select(s => new RunClaim(s.ClientId, s.GameId, s.Board, s.Value, s.Final, s.AchievedAt))],
            CancellationToken.None);
        await db.SaveChangesAsync();
        return added.Count;
    }

    /// <summary>The same run gets the same id every time, so a second seeding finds its scores instead of adding more.</summary>
    private static Guid ClientIdOf(Guid profileId, string gameId, int run) =>
        new(MD5.HashData(Encoding.UTF8.GetBytes($"tohe-dev-seed:{profileId:N}:{gameId}:{run}")));

    private static async Task ReportAsync(
        TextWriter output, List<(Account Account, IReadOnlyList<Profile> Profiles)> people, IReadOnlyList<Game> games, int runs)
    {
        await output.WriteLineAsync("Demo data is in place. Sign in at the hub with:");
        foreach (var (account, profiles) in people)
        {
            await output.WriteLineAsync($"  {account.Email}   password {Password}   manage PIN {ManagePin}");
            foreach (var profile in profiles)
            {
                var kind = profile.Kind == ProfileKind.Child ? $"child {profile.AgeBand}" : "adult";
                await output.WriteLineAsync($"    {profile.Avatar} {profile.Name} ({kind})   ID {ProfileIds.Format(profile.PublicId)}");
            }
        }

        if (games.Count == 0)
        {
            await output.WriteLineAsync(
                "No scores yet: the registry lists no game that takes scores. The API indexes the games within a minute of "
                + "starting; run the command again then.");
        }
        else
        {
            await output.WriteLineAsync($"Scores on {string.Join(", ", games.Select(g => g.Id))}: {runs} new run(s) this time.");
        }

        await output.WriteLineAsync("No platform roles: grant one with `dotnet Tohe.Api.dll admin grant <email> --role owner`.");
    }
}
