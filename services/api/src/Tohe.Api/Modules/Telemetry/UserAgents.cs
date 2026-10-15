using System.Text.RegularExpressions;

namespace Tohe.Api.Modules.Telemetry;

/// <summary>Operating system and browser, family and major version: all telemetry keeps of a User-Agent header.</summary>
public sealed record ReducedAgent(string Os, string OsVersion, string Browser, string BrowserVersion);

/// <summary>
/// Reduces a User-Agent header to families and major versions; the header itself is never stored. Browsers on iOS
/// all run WebKit but keep their own names (CriOS is Chrome); a headless browser (tests, conformance) says so, so
/// reports can leave it out.
/// </summary>
internal static partial class UserAgents
{
    public static ReducedAgent Reduce(string? userAgent)
    {
        var ua = userAgent ?? "";
        var (os, osVersion) = OperatingSystem(ua);
        var (browser, browserVersion) = BrowserOf(ua, os);
        return new ReducedAgent(os, osVersion, browser, browserVersion);
    }

    private static (string, string) OperatingSystem(string ua)
    {
        if (AppleMobile().Match(ua) is { Success: true } apple)
        {
            return (apple.Groups[1].Value == "iPad" ? "iPadOS" : "iOS", apple.Groups[2].Value);
        }

        if (Android().Match(ua) is { Success: true } android)
        {
            return ("Android", android.Groups[1].Value);
        }

        if (WindowsNt().Match(ua) is { Success: true })
        {
            return ("Windows", "");
        }

        if (Mac().Match(ua) is { Success: true } mac)
        {
            return ("macOS", $"{mac.Groups[1].Value}.{mac.Groups[2].Value}");
        }

        if (ua.Contains("CrOS", StringComparison.Ordinal))
        {
            return ("ChromeOS", "");
        }

        return ua.Contains("Linux", StringComparison.Ordinal) ? ("Linux", "") : ("Other", "");
    }

    private static (string, string) BrowserOf(string ua, string os)
    {
        (string Name, Regex Pattern)[] browsers =
        [
            ("HeadlessChrome", Headless()),
            ("Samsung Internet", Samsung()),
            ("Edge", Edge()),
            ("Opera", Opera()),
            ("Firefox", Firefox()),
            ("Chrome", Chrome()),
            ("Safari", Safari()),
        ];
        foreach (var (name, pattern) in browsers)
        {
            if (pattern.Match(ua) is { Success: true } match)
            {
                return (name, match.Groups[1].Value);
            }
        }

        // An app's embedded browser on iOS reports no browser at all.
        return os is "iOS" or "iPadOS" ? ("WebView", "") : ("Other", "");
    }

    [GeneratedRegex(@"(iPhone|iPad|iPod).*? OS (\d+)[_.]")]
    private static partial Regex AppleMobile();

    [GeneratedRegex(@"Android (\d+)")]
    private static partial Regex Android();

    [GeneratedRegex(@"Windows NT \d+")]
    private static partial Regex WindowsNt();

    [GeneratedRegex(@"Mac OS X (\d+)[_.](\d+)")]
    private static partial Regex Mac();

    [GeneratedRegex(@"HeadlessChrome/(\d+)")]
    private static partial Regex Headless();

    [GeneratedRegex(@"SamsungBrowser/(\d+)")]
    private static partial Regex Samsung();

    [GeneratedRegex(@"(?:Edg|EdgA|EdgiOS)/(\d+)")]
    private static partial Regex Edge();

    [GeneratedRegex(@"(?:OPR|OPT)/(\d+)")]
    private static partial Regex Opera();

    [GeneratedRegex(@"(?:Firefox|FxiOS)/(\d+)")]
    private static partial Regex Firefox();

    [GeneratedRegex(@"(?:Chrome|CriOS)/(\d+)")]
    private static partial Regex Chrome();

    [GeneratedRegex(@"Version/(\d+)[\d.]* (?:Mobile/\S+ )?Safari/")]
    private static partial Regex Safari();
}
