using Microsoft.Extensions.Options;
using Tohe.Api.Modules.Platform;

namespace Tohe.Api.Infrastructure.Security;

/// <summary>
/// Rejects state-changing <c>/api</c> requests a browser marks as coming from another origin. Session cookies are
/// <c>SameSite</c>, but the games origin and the console are the same <em>site</em> as the hub: in development and on
/// UAT only the port differs, and in production they are subdomains of the hub's domain (ADR 0040, 0042). A game page
/// could otherwise send a cookie-carrying POST. Requests without the header (curl, tests) are allowed; they cannot
/// carry a browser's cookie by accident. On top of that, the console's origin is accepted only for the console's
/// routes, and only the console's origin for them (ADR 0042); and the same for the Studio's origin and the Studio's
/// routes once the Studio has a host of its own (ADR 0051).
/// </summary>
internal static class SameOriginGuard
{
    public static IApplicationBuilder UseSameOriginGuard(this IApplicationBuilder app)
    {
        var options = app.ApplicationServices.GetRequiredService<IOptions<AppOptions>>().Value;
        var consoleOrigin = options.ConsoleUrl is null ? null : ConsoleRoutes.Origin(options.ConsoleUrl);
        var studioOrigin = options.StudioUrl is null ? null : StudioRoutes.Origin(options.StudioUrl);
        return app.Use(async (context, next) =>
        {
            var request = context.Request;
            var unsafeMethod = !(HttpMethods.IsGet(request.Method) || HttpMethods.IsHead(request.Method)
                || HttpMethods.IsOptions(request.Method));
            if (unsafeMethod
                && request.Path.StartsWithSegments("/api", StringComparison.Ordinal)
                && (CrossOrigin(request)
                    || WrongOrigin(request, consoleOrigin, ConsoleRoutes.Covers(request.Path))
                    || WrongOrigin(request, studioOrigin, StudioRoutes.Covers(request.Path))))
            {
                await Results.Problem(
                        title: "Cross-origin request rejected",
                        statusCode: StatusCodes.Status403Forbidden,
                        extensions: new Dictionary<string, object?> { ["code"] = "cross_origin" })
                    .ExecuteAsync(context);
                return;
            }

            await next(context);
        });
    }

    private static bool CrossOrigin(HttpRequest request) =>
        request.Headers.TryGetValue("Sec-Fetch-Site", out var site) && site != "same-origin" && site != "none";

    /// <summary>
    /// A host's own origin — the console's, the Studio's — calling anything but its routes, or another origin calling
    /// those. Nothing to check while the host has no origin configured.
    /// </summary>
    private static bool WrongOrigin(HttpRequest request, string? hostOrigin, bool hostRoute)
    {
        if (hostOrigin is null || !request.Headers.TryGetValue("Origin", out var origin))
        {
            return false;
        }

        var fromHost = string.Equals(origin, hostOrigin, StringComparison.OrdinalIgnoreCase);
        return fromHost != hostRoute;
    }
}
