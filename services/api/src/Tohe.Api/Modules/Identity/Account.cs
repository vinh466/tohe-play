using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Tohe.Api.Modules.Identity;

/// <summary>An adult who can sign in. Children never have accounts, only profiles (ADR 0004, 0011).</summary>
public sealed class Account : IdentityUser<Guid>
{
    public required string DisplayName { get; set; }

    public Guid HouseholdId { get; set; }

    public Household? Household { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}

internal sealed class AccountConfiguration : IEntityTypeConfiguration<Account>
{
    public void Configure(EntityTypeBuilder<Account> builder)
    {
        builder.ToTable("accounts", "identity");
        builder.Property(account => account.DisplayName).HasMaxLength(40);
        builder.HasOne(account => account.Household)
            .WithMany()
            .HasForeignKey(account => account.HouseholdId)
            .OnDelete(DeleteBehavior.Restrict);
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
