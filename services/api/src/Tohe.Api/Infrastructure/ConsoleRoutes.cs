using Microsoft.Extensions.Options;
using Tohe.Api.Modules.Platform;

namespace Tohe.Api.Infrastructure;

/// <summary>
/// The API's console routes, <c>/api/admin/…</c>, live on the console's host alone (ADR 0027, 0042): they answer there
/// and nowhere else, and nothing else of the API answers there. The console's Caddy site proxies only these routes;
/// this holds the same in the API, whatever proxy is in front of it — on localhost and on UAT the hub and the console
/// share a host name and differ by port, so the browser's cookies alone would not keep them apart.
/// </summary>
internal static partial class ConsoleRoutes
{
    /// <summary>Whether the path is one of the console's routes.</summary>
    public static bool Covers(PathString path) =>
        path.StartsWithSegments(ConsolePaths.Api, StringComparison.OrdinalIgnoreCase);

    /// <summary>Whether the request came to the console's host — the host and port of <c>App:ConsoleUrl</c>.</summary>
    public static bool OnConsoleHost(HttpRequest request, Uri consoleUrl) =>
        string.Equals(request.Host.Value, consoleUrl.Authority, StringComparison.OrdinalIgnoreCase);

    /// <summary>The console's origin, as browsers send it in <c>Origin</c>.</summary>
    public static string Origin(Uri consoleUrl) => consoleUrl.GetLeftPart(UriPartial.Authority);

    /// <summary>
    /// Answers 404 to a console route that did not come to the console's host — or to any route at all while
    /// <c>App:ConsoleUrl</c> is unset, which the log says once — and to every other route that did.
    /// </summary>
    public static IApplicationBuilder UseConsoleRoutes(this WebApplication app)
    {
        var consoleUrl = app.Services.GetRequiredService<IOptions<AppOptions>>().Value.ConsoleUrl;
        if (consoleUrl is null && !BuildTime.IsGeneratingOpenApi)
        {
            LogNoConsole(app.Services.GetRequiredService<ILoggerFactory>().CreateLogger(typeof(ConsoleRoutes)), ConsolePaths.Api);
        }

        return app.Use(async (context, next) =>
        {
            var onConsoleHost = consoleUrl is not null && OnConsoleHost(context.Request, consoleUrl);
            if (Covers(context.Request.Path) != onConsoleHost)
            {
                context.Response.StatusCode = StatusCodes.Status404NotFound;
                return;
            }

            await next(context);
        });
    }

    [LoggerMessage(Level = LogLevel.Warning, Message = "App:ConsoleUrl is not set: the console's routes ({Routes}) answer 404")]
    private static partial void LogNoConsole(ILogger logger, string routes);
}
