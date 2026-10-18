using Microsoft.AspNetCore.Identity;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Identity;

namespace Tohe.Api.Modules.Admin;

/// <summary>
/// <c>dotnet Tohe.Api.dll admin …</c>, run inside the API's container (ADR 0027): grant, take away and list platform
/// roles — the way back when every owner is lost. Each change lands in the audit log, by "command line"; granting
/// an owner also ends setup mode, for good.
/// </summary>
internal static class AdminCommand
{
    public const string Usage = """
        Usage, inside the API's container:
          dotnet Tohe.Api.dll admin grant <email> --role owner|admin|moderator|viewer
          dotnet Tohe.Api.dll admin revoke <email>
          dotnet Tohe.Api.dll admin list
        An account from before email sign-in is named by its username instead.
        """;

    public static bool Matches(string[] args) => args is ["admin", ..];

    /// <summary>Runs the command; 0 when it did what it was asked, 1 when the account is not found, 2 for usage errors.</summary>
    public static async Task<int> RunAsync(IServiceProvider services, string[] args, TextWriter output, TextWriter error)
    {
        await using var scope = services.CreateAsyncScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<Account>>();
        var roles = scope.ServiceProvider.GetRequiredService<PlatformRoles>();
        var audit = scope.ServiceProvider.GetRequiredService<AdminAudit>();
        var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();

        switch (args)
        {
            case ["admin", "grant", var who, "--role", var name]:
            {
                if (PlatformRoles.Parse(name.ToLowerInvariant()) is not { } role)
                {
                    await error.WriteLineAsync($"No role \"{name}\": owner, admin, moderator or viewer.");
                    return 2;
                }

                if (await FindAsync(users, who) is not { } account)
                {
                    await error.WriteLineAsync($"No account signs in with \"{who}\".");
                    return 1;
                }

                await using (var transaction = await db.Database.BeginTransactionAsync())
                {
                    await roles.SetAsync(account, role);
                    if (role == PlatformRole.Owner)
                    {
                        await scope.ServiceProvider.GetRequiredService<SetupState>()
                            .CloseAsync(scope.ServiceProvider.GetRequiredService<TimeProvider>().GetUtcNow(), CancellationToken.None);
                    }

                    audit.Add(AdminActor.CommandLine, AuditActions.RoleGrant, Label(account), new { role = PlatformRoles.NameOf(role) });
                    await db.SaveChangesAsync();
                    await transaction.CommitAsync();
                }

                await output.WriteLineAsync($"{Label(account)} is now {PlatformRoles.NameOf(role)}.");
                return 0;
            }

            case ["admin", "revoke", var who]:
            {
                if (await FindAsync(users, who) is not { } account)
                {
                    await error.WriteLineAsync($"No account signs in with \"{who}\".");
                    return 1;
                }

                await using (var transaction = await db.Database.BeginTransactionAsync())
                {
                    if (!await roles.RemoveAsync(account))
                    {
                        await output.WriteLineAsync($"{Label(account)} had no role.");
                        return 0;
                    }

                    audit.Add(AdminActor.CommandLine, AuditActions.RoleRevoke, Label(account));
                    await db.SaveChangesAsync();
                    await transaction.CommitAsync();
                }

                await output.WriteLineAsync($"{Label(account)} no longer has a role.");
                return 0;
            }

            case ["admin", "list"]:
            {
                var holders = await roles.HoldersAsync(CancellationToken.None);
                if (holders.Count == 0)
                {
                    await output.WriteLineAsync("No account has a role yet.");
                }

                foreach (var holder in holders)
                {
                    await output.WriteLineAsync(
                        $"{PlatformRoles.NameOf(holder.Role),-9} {holder.Email ?? holder.Username} ({holder.DisplayName})");
                }

                return 0;
            }

            default:
                await error.WriteLineAsync(Usage);
                return 2;
        }
    }

    private static async Task<Account?> FindAsync(UserManager<Account> users, string who) =>
        await users.FindByEmailAsync(who) ?? await users.FindByNameAsync(who);

    private static string Label(Account account) => $"{account.Email ?? account.UserName} ({account.DisplayName})";
}
