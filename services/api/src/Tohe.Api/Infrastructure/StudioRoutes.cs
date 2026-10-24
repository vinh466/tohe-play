using Microsoft.Extensions.Options;
using Tohe.Api.Modules.Platform;

namespace Tohe.Api.Infrastructure;

/// <summary>
/// The API's Studio routes, <c>/api/studio/…</c>, live on the Studio's host (ADR 0051), the same shape as the console's
/// (<see cref="ConsoleRoutes"/>): with <c>App:StudioUrl</c> set they answer there and nowhere else, and nothing else of
/// the API answers there. The Studio's Caddy site proxies only these routes; this holds the same in the API, whatever
/// proxy is in front of it — on localhost and on UAT the hosts share a name and differ by port. Until the Studio has a
/// host — <c>App:StudioUrl</c> unset, as in production before its DNS exists — they answer on any host but the
/// console's, as before the Studio's app, and the log says so once.
/// </summary>
internal static partial class StudioRoutes
{
    /// <summary>Whether the path is one of the Studio's routes.</summary>
    public static bool Covers(PathString path) =>
        path.StartsWithSegments(StudioPaths.Api, StringComparison.OrdinalIgnoreCase);

    /// <summary>Whether the request came to the Studio's host — the host and port of <c>App:StudioUrl</c>.</summary>
    public static bool OnStudioHost(HttpRequest request, Uri studioUrl) =>
        string.Equals(request.Host.Value, studioUrl.Authority, StringComparison.OrdinalIgnoreCase);

    /// <summary>The Studio's origin, as browsers send it in <c>Origin</c>.</summary>
    public static string Origin(Uri studioUrl) => studioUrl.GetLeftPart(UriPartial.Authority);

    /// <summary>
    /// With <c>App:StudioUrl</c> set, answers 404 to a Studio route that did not come to the Studio's host, and to every
    /// other route that did. Unset, lets every request through — the console's routes already keep the Studio's off the
    /// console's host — and the log says so once.
    /// </summary>
    public static IApplicationBuilder UseStudioRoutes(this WebApplication app)
    {
        var studioUrl = app.Services.GetRequiredService<IOptions<AppOptions>>().Value.StudioUrl;
        if (studioUrl is null)
        {
            if (!BuildTime.IsGeneratingOpenApi)
            {
                LogNoStudio(app.Services.GetRequiredService<ILoggerFactory>().CreateLogger(typeof(StudioRoutes)), StudioPaths.Api);
            }

            return app;
        }

        return app.Use(async (context, next) =>
        {
            if (Covers(context.Request.Path) != OnStudioHost(context.Request, studioUrl))
            {
                context.Response.StatusCode = StatusCodes.Status404NotFound;
                return;
            }

            await next(context);
        });
    }

    [LoggerMessage(Level = LogLevel.Warning, Message = "App:StudioUrl is not set: the Studio's routes ({Routes}) answer on every host but the console's")]
    private static partial void LogNoStudio(ILogger logger, string routes);
}
