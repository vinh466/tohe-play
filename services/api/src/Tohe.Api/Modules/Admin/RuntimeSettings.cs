using Microsoft.EntityFrameworkCore;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Identity;

namespace Tohe.Api.Modules.Admin;

/// <summary>
/// The switches of ADR 0028 — the sign-in methods and the registration mode — and the proof-of-work of ADR 0037, kept
/// in <c>admin.settings</c> and read through a cache: one API process serves them (ADR 0027), and the console forgets
/// the cache when it saves. Unset, a method the deployment configured is on, registration is open and the
/// proof-of-work off; a method it did not configure is never on.
/// </summary>
internal sealed class RuntimeSettings(IServiceScopeFactory scopes, ExternalProviderCatalog providers) : ISignInSettings
{
    public const string RegistrationKey = "registration.mode";

    /// <summary>The proof-of-work before a code by email (ADR 0037): <c>on</c>, else off.</summary>
    public const string ProofOfWorkKey = "registration.proof-of-work";

    private readonly SemaphoreSlim _loading = new(1, 1);
    private volatile IReadOnlyDictionary<string, string>? _values;

    public static string MethodKey(string method) => $"signin.{method}";

    public static string NameOf(RegistrationMode mode) => mode switch
    {
        RegistrationMode.Invite => "invite",
        RegistrationMode.Closed => "closed",
        _ => "open",
    };

    public static RegistrationMode? ParseMode(string? name) => name switch
    {
        "open" => RegistrationMode.Open,
        "invite" => RegistrationMode.Invite,
        "closed" => RegistrationMode.Closed,
        _ => null,
    };

    public async ValueTask<bool> IsOnAsync(string method, CancellationToken ct) =>
        (method == SignInMethods.Password || providers.Find(method) is not null)
        && (await ValuesAsync(ct)).GetValueOrDefault(MethodKey(method)) != "off";

    public async ValueTask<RegistrationMode> RegistrationAsync(CancellationToken ct) =>
        ParseMode((await ValuesAsync(ct)).GetValueOrDefault(RegistrationKey)) ?? RegistrationMode.Open;

    public async ValueTask<bool> ProofOfWorkAsync(CancellationToken ct) =>
        (await ValuesAsync(ct)).GetValueOrDefault(ProofOfWorkKey) == "on";

    /// <summary>The next question reads the database again: the console saved a change.</summary>
    public void Forget() => _values = null;

    private async ValueTask<IReadOnlyDictionary<string, string>> ValuesAsync(CancellationToken ct)
    {
        if (_values is { } cached)
        {
            return cached;
        }

        await _loading.WaitAsync(ct);
        try
        {
            if (_values is { } loaded)
            {
                return loaded;
            }

            await using var scope = scopes.CreateAsyncScope();
            var values = await scope.ServiceProvider.GetRequiredService<ToheDbContext>().PlatformSettings
                .AsNoTracking()
                .ToDictionaryAsync(setting => setting.Key, setting => setting.Value, StringComparer.Ordinal, ct);
            _values = values;
            return values;
        }
        finally
        {
            _loading.Release();
        }
    }
}
