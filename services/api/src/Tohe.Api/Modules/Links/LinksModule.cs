using System.Threading.RateLimiting;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;
using Tohe.Api.Infrastructure;
using Tohe.Api.Modules.Identity;

namespace Tohe.Api.Modules.Links;

public sealed class LinksOptions
{
    public const string Section = "Links";

    /// <summary>Share links one profile may make in 24 hours (ADR 0044), counted from the links it made.</summary>
    public int MakesPerProfilePerDay { get; set; } = 30;

    /// <summary>
    /// Share links one device key may make in 24 hours, whichever of its profiles makes them — or one account, when its
    /// session carries no device key (ADR 0044). Kept in memory.
    /// </summary>
    public int MakesPerDevicePerDay { get; set; } = 60;

    /// <summary>Resolves of share links (open and play) per client address per minute.</summary>
    public int ResolvesPerMinute { get; set; } = 30;

    /// <summary>Resolves of share links per minute for the whole server.</summary>
    public int ResolvesPerMinuteGlobal { get; set; } = 600;

    /// <summary>Link previews per client address per minute; past it, the generic card, read from nothing.</summary>
    public int PreviewsPerMinute { get; set; } = 60;

    /// <summary>Link previews per minute for the whole server; past it, the generic card.</summary>
    public int PreviewsPerMinuteGlobal { get; set; } = 600;
}

/// <summary>
/// Entry links (ADR 0044): share links — making, resolving, revoking, limiting and counting them — and the link
/// previews of room and share links that the hub's Caddy asks for crawlers. See docs/architecture/entry-links.md.
/// </summary>
internal static class LinksModule
{
    public static WebApplicationBuilder AddLinksModule(this WebApplicationBuilder builder)
    {
        var services = builder.Services;
        services.AddOptions<LinksOptions>().BindConfiguration(LinksOptions.Section);
        services.TryAddSingleton(TimeProvider.System);
        services.AddSingleton<LinkLimits>();
        services.AddSingleton<LinkMakers>();
        services.AddScoped<ShareLinks>();
        services.AddScoped<LinkPreviews>();
        // Finding and revoking a link from the console (ADR 0027, 0044).
        services.AddScoped<ShareLinksAdmin>();
        // A maker's links go with it when it is deleted, and follow it when it is merged (ADR 0034, 0043).
        services.AddScoped<LinksProfileData>();
        services.AddScoped<IProfileData>(provider => provider.GetRequiredService<LinksProfileData>());
        services.AddScoped<IProfileMoves>(provider => provider.GetRequiredService<LinksProfileData>());
        // Accounts made from a share link, counted when Identity makes one.
        services.AddScoped<IEntrySignUps>(provider => provider.GetRequiredService<LinksProfileData>());
        return builder;
    }

    public static IEndpointRouteBuilder MapLinksEndpoints(this IEndpointRouteBuilder api)
    {
        LinkEndpoints.Map(api);
        LinkPreviews.Map(api);
        return api;
    }
}

/// <summary>
/// Share links each device key — or each account without one — makes in a day (ADR 0044,
/// <c>Links:MakesPerDevicePerDay</c>).
/// </summary>
internal sealed class LinkMakers(TimeProvider clock) : SlidingAllowance(clock, TimeSpan.FromDays(1));

/// <summary>
/// The limits of the public link routes (ADR 0044): resolving share links, and link previews, each per client address —
/// the one the trusted proxy chain gives, as the sign-in's limits — and for the whole server, in fixed windows of a
/// minute.
/// </summary>
internal sealed class LinkLimits : IDisposable
{
    private readonly PartitionedRateLimiter<HttpContext> _resolves;
    private readonly PartitionedRateLimiter<HttpContext> _previews;

    public LinkLimits(IOptions<LinksOptions> options)
    {
        _resolves = Chained(options.Value.ResolvesPerMinute, options.Value.ResolvesPerMinuteGlobal);
        _previews = Chained(options.Value.PreviewsPerMinute, options.Value.PreviewsPerMinuteGlobal);
    }

    /// <summary>Counts a resolve; false when the address, or the server, had its minute's worth.</summary>
    public bool TryResolve(HttpContext http) => TryTake(_resolves, http);

    /// <summary>Counts a preview; false when the address, or the server, had its minute's worth.</summary>
    public bool TryPreview(HttpContext http) => TryTake(_previews, http);

    public void Dispose()
    {
        _resolves.Dispose();
        _previews.Dispose();
    }

    private static bool TryTake(PartitionedRateLimiter<HttpContext> limiter, HttpContext http)
    {
        using var lease = limiter.AttemptAcquire(http);
        return lease.IsAcquired;
    }

    private static PartitionedRateLimiter<HttpContext> Chained(int perAddress, int global) =>
        PartitionedRateLimiter.CreateChained(
            PartitionedRateLimiter.Create<HttpContext, string>(http => RateLimitPartition.GetFixedWindowLimiter(
                http.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                _ => new FixedWindowRateLimiterOptions { PermitLimit = perAddress, Window = TimeSpan.FromMinutes(1) })),
            PartitionedRateLimiter.Create<HttpContext, string>(_ => RateLimitPartition.GetFixedWindowLimiter(
                "server",
                _ => new FixedWindowRateLimiterOptions { PermitLimit = global, Window = TimeSpan.FromMinutes(1) })));
}
