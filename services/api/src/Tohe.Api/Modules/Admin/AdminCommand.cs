using Microsoft.AspNetCore.Identity;
using Tohe.Api.Modules.Identity;

namespace Tohe.Api.Modules.Admin;

/// <summary>
/// <c>dotnet Tohe.Api.dll admin …</c>, run inside the API's container (ADR 0027): grant, take away and list platform
/// roles. The way to a first role on development and UAT, and the way back when every owner is lost.
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

                await roles.SetAsync(account, role);
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

                await output.WriteLineAsync(await roles.RemoveAsync(account)
                    ? $"{Label(account)} no longer has a role."
                    : $"{Label(account)} had no role.");
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
