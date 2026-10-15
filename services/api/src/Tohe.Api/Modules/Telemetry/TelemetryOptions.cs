using System.ComponentModel.DataAnnotations;

namespace Tohe.Api.Modules.Telemetry;

/// <summary>Device telemetry (ADR 0015, docs/architecture/telemetry.md).</summary>
public sealed class TelemetryOptions
{
    public const string Section = "Telemetry";

    /// <summary>The server-side switch: off, the hub stops sending (GET /api/config) and the API drops what still arrives.</summary>
    public bool Enabled { get; set; } = true;

    /// <summary>Secret an operator (an agent's report tool) sends to read reports. Empty: no reports.</summary>
    public string OperatorToken { get; set; } = "";

    /// <summary>How long raw events are kept.</summary>
    [Range(1, 365)]
    public int RawRetentionDays { get; set; } = 30;

    /// <summary>How long daily roll-ups are kept.</summary>
    [Range(1, 3650)]
    public int DailyRetentionDays { get; set; } = 365;

    /// <summary>Batches accepted per minute from one address (a few devices may share one).</summary>
    [Range(1, 100_000)]
    public int RequestsPerMinute { get; set; } = 30;

    /// <summary>Roll up finished days and delete what is past retention, in the background.</summary>
    public bool MaintenanceEnabled { get; set; } = true;

    public TimeSpan MaintenanceInterval { get; set; } = TimeSpan.FromHours(1);
}
