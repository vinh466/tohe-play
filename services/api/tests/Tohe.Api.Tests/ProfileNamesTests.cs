using Tohe.Api.Modules.Identity;

namespace Tohe.Api.Tests;

/// <summary>Profile names are free, for fun (ADR 0023), within a few rails: visible, bounded, not the platform's own.</summary>
public sealed class ProfileNamesTests
{
    private const string Family = "\U0001F468‍\U0001F469‍\U0001F467‍\U0001F466";

    [Theory]
    [InlineData("Na", "Na")]
    [InlineData("  Bé   Na  ", "Bé Na")]
    [InlineData("Bố Vinh", "Bố Vinh")] // marks typed apart stay apart: the hub sends NFC, the API has no ICU
    [InlineData("Ông Ngoại　", "Ông Ngoại")] // every kind of space is one plain space
    [InlineData("小明", "小明")]
    [InlineData("Na 👧🏻", "Na 👧🏻")]
    [InlineData("🏴\U000E0067\U000E0062\U000E0073\U000E0063\U000E0074\U000E007F", "🏴\U000E0067\U000E0062\U000E0073\U000E0063\U000E0074\U000E007F")]
    [InlineData("Admin Nhí", "Admin Nhí")] // only the reserved names themselves, not every name containing one
    public void Names_are_free(string input, string stored)
    {
        Assert.True(ProfileNames.TryNormalize(input, out var name, out var error), error);
        Assert.Equal(stored, name);
    }

    [Fact]
    public void An_emoji_family_counts_as_one_character()
    {
        var five = string.Concat(Enumerable.Repeat(Family, 5));
        Assert.True(ProfileNames.TryNormalize(five, out _, out _));

        var long24 = new string('a', ProfileNames.MaxLength);
        Assert.True(ProfileNames.TryNormalize(long24, out _, out _));
        Assert.False(ProfileNames.TryNormalize(long24 + "a", out _, out var error));
        Assert.Equal("name_too_long", error);
    }

    [Fact]
    public void A_chain_of_joined_emoji_is_one_character_but_not_an_endless_name()
    {
        var chain = string.Join('‍', Enumerable.Repeat("\U0001F98A", 40)); // one grapheme, 119 UTF-16 units

        Assert.False(ProfileNames.TryNormalize(chain + "‍" + chain, out _, out var error));
        Assert.Equal("name_too_long", error);
        Assert.False(ProfileNames.TryNormalize(new string('a', 5000), out _, out error));
        Assert.Equal("name_too_long", error);
    }

    [Theory]
    [InlineData("ADMIN")]
    [InlineData("Quản trị viên")]
    [InlineData("to-he")]
    [InlineData("TÒ HE 🦊")] // decorations around a reserved name do not make it another name
    [InlineData("ad‍min")] // nor does a joiner hidden inside
    [InlineData("Người chơi đã xoá")]
    [InlineData("HỖ TRỢ")]
    [InlineData("Quản trị")] // marks typed apart
    [InlineData("ＡＤＭＩＮ")] // full-width letters
    public void Names_that_pass_for_the_platform_are_reserved(string input)
    {
        Assert.False(ProfileNames.TryNormalize(input, out _, out var error));
        Assert.Equal("name_reserved", error);
    }

    [Theory]
    [InlineData("Na‮evil")] // right-to-left override
    [InlineData("Na​na")] // zero-width space
    [InlineData("Na­na")] // soft hyphen
    [InlineData("ㅤ")] // Hangul filler: a letter that draws nothing
    [InlineData("Na⠀")] // blank braille pattern
    [InlineData("Na\u0007")]
    [InlineData("Na")] // private use
    [InlineData("q̀́̂̃")] // four marks piled on one letter
    public void Invisible_or_piled_up_characters_are_refused(string input)
    {
        Assert.False(ProfileNames.TryNormalize(input, out _, out var error));
        Assert.Equal("name_invalid_character", error);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData(" \t  ")]
    public void A_name_is_required(string? input)
    {
        Assert.False(ProfileNames.TryNormalize(input, out _, out var error));
        Assert.Equal("name_required", error);
    }
}
