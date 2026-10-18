using Tohe.Api.Modules.Identity;

namespace Tohe.Api.Tests;

/// <summary>Public profile IDs (ADR 0023): random, 12 digits, and a Damm check digit that catches typing mistakes.</summary>
public sealed class ProfileIdsTests
{
    [Fact]
    public void The_check_digit_is_damms()
    {
        Assert.Equal(4, ProfileIds.CheckDigit("572")); // the worked example of Damm's algorithm
        Assert.Equal(0, ProfileIds.CheckDigit("5724"));
    }

    [Fact]
    public void New_ids_have_twelve_digits_never_start_with_zero_and_check_out()
    {
        for (var i = 0; i < 1000; i++)
        {
            var id = ProfileIds.New();

            Assert.Matches("^[1-9][0-9]{11}$", id);
            Assert.True(ProfileIds.TryNormalize(id, out var normalized), id);
            Assert.Equal(id, normalized);
        }
    }

    [Fact]
    public void People_can_type_an_id_with_spaces_or_dashes()
    {
        var id = ProfileIds.New();

        Assert.True(ProfileIds.TryNormalize(ProfileIds.Format(id), out var spaced));
        Assert.True(ProfileIds.TryNormalize($" {id[..4]}-{id[4..8]}-{id[8..]} ", out var dashed));
        Assert.Equal((id, id), (spaced, dashed));
        Assert.Equal($"{id[..4]} {id[4..8]} {id[8..]}", ProfileIds.Format(id));
    }

    [Fact]
    public void Every_single_digit_typo_and_every_swap_of_neighbours_is_caught()
    {
        for (var round = 0; round < 50; round++)
        {
            var id = ProfileIds.New();
            for (var i = 0; i < id.Length; i++)
            {
                for (var digit = '0'; digit <= '9'; digit++)
                {
                    if (digit != id[i])
                    {
                        var typo = id[..i] + digit + id[(i + 1)..];
                        Assert.False(ProfileIds.TryNormalize(typo, out _), typo);
                    }
                }

                if (i + 1 < id.Length && id[i] != id[i + 1])
                {
                    var swapped = id[..i] + id[i + 1] + id[i] + id[(i + 2)..];
                    Assert.False(ProfileIds.TryNormalize(swapped, out _), swapped);
                }
            }
        }
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("1234 5678 901")]
    [InlineData("1234 5678 9012 3")]
    [InlineData("1234 5678 901a")]
    [InlineData("1234_5678_9012")]
    [InlineData("１２３４５６７８９０１２")]
    public void Anything_else_is_not_an_id(string? input) => Assert.False(ProfileIds.TryNormalize(input, out _));

    [Fact]
    public void An_id_starting_with_zero_is_refused_even_when_its_check_digit_fits()
    {
        var body = "0" + ProfileIds.New()[1..11];
        var id = body + ProfileIds.CheckDigit(body);

        Assert.Equal(0, ProfileIds.CheckDigit(id));
        Assert.False(ProfileIds.TryNormalize(id, out _));
    }
}
