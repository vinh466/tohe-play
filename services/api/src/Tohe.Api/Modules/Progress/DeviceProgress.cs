using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Identity;
using Tohe.Api.Modules.Integrity;

namespace Tohe.Api.Modules.Progress;

/// <summary>
/// What a device profile played, taken in with it when it comes into an account (ADR 0043). Saves: one present on one
/// side is taken; on both, the newer wins and the other is kept as the previous version (ADR 0005). Scores join the
/// profile's, every one of them marked <see cref="ScoreEntry.DeviceEarned"/>, and go to the integrity engine as a device
/// profile's runs — in no public board's audience. Only this channel marks them, never a field a device sends.
/// </summary>
internal sealed class DeviceProgress(ToheDbContext db, IResults results, TimeProvider clock) : IDeviceProgress
{
    public string? Refusal(DeviceProfileData data)
    {
        foreach (var save in data.AllSaves())
        {
            if (!ProgressModule.IsGameId(save.GameId))
            {
                return "game_invalid";
            }

            // A save sent without its data has nothing to keep.
            if (save.Data.ValueKind == JsonValueKind.Undefined)
            {
                return "save_invalid";
            }

            if (Encoding.UTF8.GetByteCount(save.Data.GetRawText()) > ProgressModule.MaxSaveBytes)
            {
                return "save_too_large";
            }
        }

        return data.AllScores().Any(score => !ProgressModule.IsGameId(score.GameId) || !double.IsFinite(score.Value))
            ? "score_invalid"
            : null;
    }

    public async Task ImportAsync(Guid profileId, Guid accountId, DeviceProfileData data, CancellationToken ct)
    {
        var now = ProgressModule.ToDatabasePrecision(clock.GetUtcNow());
        await ImportSavesAsync(profileId, data.AllSaves(), now, ct);
        await ImportScoresAsync(profileId, accountId, data.AllScores(), now, ct);
    }

    private async Task ImportSavesAsync(Guid profileId, IReadOnlyList<DeviceSave> saves, DateTimeOffset now, CancellationToken ct)
    {
        // One per game: the device's newest, should it send two.
        var newest = saves
            .GroupBy(save => save.GameId, StringComparer.Ordinal)
            .Select(group => group.OrderByDescending(save => save.UpdatedAt).First())
            .ToList();
        var games = newest.Select(save => save.GameId).ToList();
        var known = await db.SavedGames
            .Where(save => save.ProfileId == profileId && games.Contains(save.GameId))
            .ToDictionaryAsync(save => save.GameId, StringComparer.Ordinal, ct);
        foreach (var device in newest)
        {
            var data = device.Data.GetRawText();
            if (!known.TryGetValue(device.GameId, out var save))
            {
                db.SavedGames.Add(new SavedGame { ProfileId = profileId, GameId = device.GameId, Data = data, UpdatedAt = now });
            }
            else if (device.UpdatedAt > save.UpdatedAt)
            {
                // The device's is newer: it wins, and the server's is kept for one restore. A new server time, so the
                // profile's other devices see the change.
                save.PreviousData = save.Data;
                save.PreviousUpdatedAt = save.UpdatedAt;
                save.Data = data;
                save.UpdatedAt = now;
            }
            else
            {
                // The server's is newer: it stays, and the device's is the one kept.
                save.PreviousData = data;
                save.PreviousUpdatedAt = device.UpdatedAt;
            }
        }
    }

    private async Task ImportScoresAsync(
        Guid profileId, Guid accountId, IReadOnlyList<DeviceScore> scores, DateTimeOffset now, CancellationToken ct)
    {
        if (scores.Count == 0)
        {
            return;
        }

        var ids = scores.Select(score => score.ClientId).Distinct().ToList();
        var known = await db.Scores
            .Where(score => score.ProfileId == profileId && ids.Contains(score.ClientId))
            .ToDictionaryAsync(score => score.ClientId, ct);
        var changed = new List<ScoreEntry>();
        foreach (var input in scores)
        {
            if (known.TryGetValue(input.ClientId, out var entry))
            {
                // As a run reported again (ADR 0014): its highest score, final once final — and marked from now on.
                if (input.Value > entry.Value)
                {
                    entry.Value = input.Value;
                    entry.AchievedAt = input.AchievedAt;
                }

                entry.Final |= input.Final;
                entry.RecordedAt = now;
                entry.DeviceEarned = true;
            }
            else
            {
                entry = new ScoreEntry
                {
                    ProfileId = profileId,
                    GameId = input.GameId,
                    Board = input.Board,
                    Value = input.Value,
                    AchievedAt = input.AchievedAt,
                    RecordedAt = now,
                    ClientId = input.ClientId,
                    Final = input.Final,
                    DeviceEarned = true,
                };
                db.Scores.Add(entry);
                known[input.ClientId] = entry;
            }

            if (!changed.Contains(entry))
            {
                changed.Add(entry);
            }
        }

        await results.SubmitDeviceRunsAsync(
            profileId,
            accountId,
            [.. changed.Select(entry => new RunClaim(entry.ClientId, entry.GameId, entry.Board, entry.Value, entry.Final, entry.AchievedAt))],
            ct);
    }
}
