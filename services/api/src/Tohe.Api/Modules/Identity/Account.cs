using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Tohe.Api.Modules.Identity;

/// <summary>
/// Someone who signs in. An account owns the profiles that play (ADR 0023); children only ever have profiles, made and
/// managed by the account behind the parent gate.
/// </summary>
public sealed class Account : IdentityUser<Guid>
{
    public required string DisplayName { get; set; }

    /// <summary>The account's devices send technical telemetry (ADR 0015); its owner can turn it off.</summary>
    public bool TelemetryEnabled { get; set; } = true;

    public DateTimeOffset CreatedAt { get; set; }
}

internal sealed class AccountConfiguration : IEntityTypeConfiguration<Account>
{
    public void Configure(EntityTypeBuilder<Account> builder)
    {
        builder.ToTable("accounts", "identity");
        builder.Property(account => account.DisplayName).HasMaxLength(200); // as a profile name (ProfileNames)
        builder.Property(account => account.TelemetryEnabled).HasDefaultValue(true);
    }
}

internal sealed class AccountClaimConfiguration : IEntityTypeConfiguration<IdentityUserClaim<Guid>>
{
    public void Configure(EntityTypeBuilder<IdentityUserClaim<Guid>> builder) =>
        builder.ToTable("account_claims", "identity");
}

internal sealed class AccountLoginConfiguration : IEntityTypeConfiguration<IdentityUserLogin<Guid>>
{
    public void Configure(EntityTypeBuilder<IdentityUserLogin<Guid>> builder) =>
        builder.ToTable("account_logins", "identity");
}

internal sealed class AccountTokenConfiguration : IEntityTypeConfiguration<IdentityUserToken<Guid>>
{
    public void Configure(EntityTypeBuilder<IdentityUserToken<Guid>> builder) =>
        builder.ToTable("account_tokens", "identity");
}
