using Microsoft.EntityFrameworkCore;

namespace Tohe.Api.Infrastructure.Database;

internal static class DatabaseExtensions
{
    public static WebApplicationBuilder AddDatabase(this WebApplicationBuilder builder)
    {
        builder.Services.AddDbContext<ToheDbContext>(options => options
            .UseNpgsql(builder.Configuration.GetConnectionString("Database"))
            .UseSnakeCaseNamingConvention());
        builder.Services.AddHealthChecks().AddDbContextCheck<ToheDbContext>("database");
        return builder;
    }

    /// <summary>Applies pending migrations when <c>Database:MigrateOnStartup</c> is true (local dev, docker).</summary>
    public static async Task MigrateDatabaseIfConfiguredAsync(this WebApplication app)
    {
        if (!app.Configuration.GetValue<bool>("Database:MigrateOnStartup") || BuildTime.IsGeneratingOpenApi)
        {
            return;
        }

        await using var scope = app.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();
        await db.Database.MigrateAsync();
    }
}
