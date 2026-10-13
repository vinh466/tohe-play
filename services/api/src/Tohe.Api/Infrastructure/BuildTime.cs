using System.Reflection;

namespace Tohe.Api.Infrastructure;

internal static class BuildTime
{
    /// <summary>
    /// True while <c>dotnet build</c> runs the app to write openapi/tohe-api.json. Startup work that needs real
    /// configuration or infrastructure (option validation, migrations, background workers) is skipped then.
    /// </summary>
    public static bool IsGeneratingOpenApi { get; } =
        Assembly.GetEntryAssembly()?.GetName().Name == "GetDocument.Insider";
}
