/**
 * Content-Security-Policy every game is served with (games origin, conformance kit, docker image).
 * Games may only load their own files: no third-party scripts, trackers, ads or network calls.
 * `wasm-unsafe-eval` allows WebAssembly engines (Godot, Pixi filters). `frame-ancestors` limits who may embed.
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
    `frame-ancestors ${hubOrigins.length > 0 ? hubOrigins.join(' ') : "'none'"}`,
  ].join('; ');
}
