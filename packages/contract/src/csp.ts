/**
 * Content-Security-Policy every game is served with (games origin, conformance kit, docker image).
 * Games may only load their own files: no third-party scripts, trackers, ads or network calls.
 * `wasm-unsafe-eval` allows WebAssembly engines (Godot, Pixi filters). `frame-ancestors` limits who may embed.
 * `form-action 'none'`: a game page submits no form anywhere — not even to the hub, which may be the same site
 * (ADR 0040). Input is handled in script; a `submit` handler that calls `preventDefault()` is unaffected.
 */
export function gameContentSecurityPolicy(hubOrigins: readonly string[]): string {
  return [
    "default-src 'self'",
    "script-src 'self' 'wasm-unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "form-action 'none'",
    `frame-ancestors ${hubOrigins.length > 0 ? hubOrigins.join(' ') : "'none'"}`,
  ].join('; ');
}
