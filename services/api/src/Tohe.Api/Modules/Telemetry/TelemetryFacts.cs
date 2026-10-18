using Microsoft.EntityFrameworkCore;
using Tohe.Api.Infrastructure.Database;

namespace Tohe.Api.Modules.Telemetry;

/// <summary>What the admin console counts of device telemetry (ADR 0027); the full picture is the report.</summary>
internal sealed class TelemetryFacts(ToheDbContext db)
{
    /// <summary>Errors devices reported since then, from the raw events (kept 30 days).</summary>
    public Task<int> ErrorsSinceAsync(DateTimeOffset since, CancellationToken ct) =>
        db.TelemetryRecords.CountAsync(record => record.Kind == "error" && record.ReceivedAt > since, ct);
}
