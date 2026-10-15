using System.Collections.Concurrent;
using System.Text.Json;
using Jint;
using Jint.Native;
using Jint.Runtime;
using Microsoft.Extensions.Options;
using Tohe.Api.Modules.Platform;

namespace Tohe.Api.Modules.Rooms;

/// <summary>
/// A game's rules module (ADR 0016) running in Jint, one engine per room: the module's code comes from this
/// repository's reviewed game builds, so the limits here contain bugs (a loop that never ends, runaway memory), not
/// attackers. Calls take and return JSON; <c>Math.random</c> and <c>Date.now</c> throw, so a module cannot lose its
/// determinism (replays after a restart depend on it). Not thread-safe: the room's actor calls it one at a time.
/// </summary>
internal sealed class RulesHost
{
    private readonly Engine _engine;
    private readonly JsValue _call;

    public RulesHost(string source, TimeSpan timeout)
    {
        _engine = new Engine(options => options
            .Strict()
            .TimeoutInterval(timeout)
            .LimitRecursion(512)
            // Bytes allocated during one call (Jint counts allocations, not live memory): a bot's look-ahead allocates
            // much more than an action, measured in docs/research/online-rooms.md.
            .LimitMemory(2_000_000_000));
        _engine.Execute("""
            Math.random = function () { throw new Error('Math.random is not allowed in a rules module'); };
            Date.now = function () { throw new Error('Date.now is not allowed in a rules module'); };
            """);
        _engine.Modules.Add("rules", source);
        _engine.Modules.Add("bridge", """
            import { rules } from 'rules';
            export function call(name, args) {
              const out = rules[name](...JSON.parse(args));
              return out === undefined ? 'null' : JSON.stringify(out);
            }
            """);
        var bridge = _engine.Modules.Import("bridge");
        _call = bridge.Get("call");
    }

    /// <summary>Calls <c>rules[name](...args)</c>; <paramref name="argsJson"/> is a JSON array, the result is JSON.</summary>
    public string Call(string name, string argsJson)
    {
        try
        {
            return _engine.Invoke(_call, name, argsJson).AsString();
        }
        catch (Exception exception) when (exception is JavaScriptException or ExecutionCanceledException or TimeoutException
                                              or MemoryLimitExceededException or RecursionDepthOverflowException
                                              or StatementsCountOverflowException)
        {
            throw new RulesException($"rules.{name} failed: {exception.Message}", exception);
        }
    }

    public string Setup(int seats, int seed, string optionsJson, string? carryJson) =>
        Call("setup", $"[{{\"seats\":{seats},\"seed\":{seed},\"options\":{optionsJson},\"carry\":{carryJson ?? "null"}}}]");

    public string View(string state, int? seat) => Call("view", $"[{state},{(seat is { } s ? s.ToString(System.Globalization.CultureInfo.InvariantCulture) : "null")}]");

    public string Act(string state, int seat, string action) => Call("act", $"[{state},{seat},{action}]");

    public string Status(string state) => Call("status", $"[{state}]");

    public string Timeout(string state, int seat) => Call("timeout", $"[{state},{seat}]");

    public string Bot(string state, int seat, string level, int seed) =>
        Call("bot", $"[{state},{seat},{JsonSerializer.Serialize(level)},{seed}]");
}

internal sealed class RulesException(string message, Exception inner) : Exception(message, inner);

/// <summary>
/// Fetches rules modules from the games origin by build path and keeps them: builds are immutable, so a module once
/// fetched never changes, and a room keeps refereeing with its version after a newer one is deployed.
/// </summary>
internal sealed class RulesSource(HttpClient http, IOptions<GamesOptions> games)
{
    private static readonly ConcurrentDictionary<string, string> Cache = new(StringComparer.Ordinal);

    /// <summary>The module at <paramref name="path"/> (e.g. <c>tien-len/0.2.0/rules.js</c>) on the games origin.</summary>
    public async Task<string> GetAsync(string path, CancellationToken cancellationToken)
    {
        if (Cache.TryGetValue(path, out var cached))
        {
            return cached;
        }

        // The catalog's own address reaches the games origin from inside the network (compose service name).
        var url = new Uri(games.Value.CatalogUrl, path);
        var source = await http.GetStringAsync(url, cancellationToken);
        Cache[path] = source;
        return source;
    }
}
