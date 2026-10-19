namespace Tohe.Api.Modules.Dev;

/// <summary>
/// <c>dotnet Tohe.Api.dll dev …</c>: helpers for a development machine. Today one: <c>dev seed</c>, demo accounts,
/// profiles and scores (<see cref="DevSeed"/>). Two locks, each enough on its own: the host environment must be
/// Development, and <c>Dev:SeedAllowed</c> must be true — a setting only development's configuration has
/// (<c>appsettings.Development.json</c>, <c>compose.yaml</c>). A container of UAT or production asked to run as
/// Development still refuses: its configuration never allows seeding.
/// </summary>
internal static class DevCommand
{
    public const string Usage = """
        Usage:
          dotnet Tohe.Api.dll dev seed
        Fills a development database with demo accounts, profiles and scores; running it again changes nothing. It refuses
        to run unless ASPNETCORE_ENVIRONMENT is Development. `pnpm seed` runs it for whichever local stack is up.
        """;

    public static bool Matches(string[] args) => args is ["dev", ..];

    /// <summary>Runs the command; 0 when it did what it was asked, 2 for usage errors and when the environment is not Development.</summary>
    public static async Task<int> RunAsync(IServiceProvider services, string[] args, TextWriter output, TextWriter error)
    {
        if (args is not ["dev", "seed"])
        {
            await error.WriteLineAsync(Usage);
            return 2;
        }

        // First, before the database is so much as opened: demo accounts with published passwords must never exist on a
        // deployment that holds real people.
        var environment = services.GetRequiredService<IHostEnvironment>();
        if (!environment.IsDevelopment())
        {
            await error.WriteLineAsync(
                $"Refusing to seed: the environment is {environment.EnvironmentName}, not Development. The demo accounts have "
                + "published passwords, so only a development database may have them (UAT and production never do).");
            return 2;
        }

        if (!services.GetRequiredService<IConfiguration>().GetValue<bool>("Dev:SeedAllowed"))
        {
            await error.WriteLineAsync(
                "Refusing to seed: Dev:SeedAllowed is not set. Only a development stack's configuration sets it "
                + "(appsettings.Development.json, compose.yaml); UAT and production never do.");
            return 2;
        }

        await using var scope = services.CreateAsyncScope();
        await DevSeed.RunAsync(scope.ServiceProvider, output);
        return 0;
    }
}
