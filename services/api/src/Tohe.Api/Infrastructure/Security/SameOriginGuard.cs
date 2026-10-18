namespace Tohe.Api.Infrastructure.Security;

/// <summary>
/// Rejects state-changing <c>/api</c> requests a browser marks as coming from another origin. Session cookies are
/// <c>SameSite=Lax</c>, but the games origin can be the same <em>site</em> as the hub: in development and on UAT
/// only the port differs, and a deployment may put it on a sibling subdomain rather than a domain of its own
/// (ADR 0039). A game page could otherwise send a cookie-carrying POST. Requests without the header (curl, tests)
/// are allowed; they cannot carry a browser's cookie by accident.
/// </summary>
internal static class SameOriginGuard
{
    public static IApplicationBuilder UseSameOriginGuard(this IApplicationBuilder app) =>
        app.Use(async (context, next) =>
        {
            var request = context.Request;
            var unsafeMethod = !(HttpMethods.IsGet(request.Method) || HttpMethods.IsHead(request.Method)
                || HttpMethods.IsOptions(request.Method));
            if (unsafeMethod
                && request.Path.StartsWithSegments("/api", StringComparison.Ordinal)
                && request.Headers.TryGetValue("Sec-Fetch-Site", out var site)
                && site != "same-origin"
                && site != "none")
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
