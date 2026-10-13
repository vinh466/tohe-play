# Tò He Play

*Góc chơi nhỏ của cả nhà* — a small, self-hosted web/PWA platform for quick casual games, built for a family and
its friends, and designed so that new games can be created quickly (including by AI agents) on a stable
technical foundation.

- **Hub** (`apps/hub`) — React PWA: catalog, sandboxed game launcher, local-first saves.
- **Games** (`games/*`) — independent static builds in any web technology, bound to the platform only by the
  [Game Contract](docs/contracts/game-contract-v1.md) and checked by a conformance kit.
- **Platform API** (`services/api`) — .NET 10 modular monolith on PostgreSQL.
- **Site** (`apps/site`) — Vietnamese landing page + English developer docs rendered from [`docs/`](docs/index.md).

## Quick start

Requirements: Node 24, pnpm 11, .NET SDK 10, Docker.

```sh
pnpm install && dotnet tool restore

# hot reload
docker compose up -d postgres
pnpm dev                          # hub http://localhost:4720 · docs http://localhost:4710/docs/

# or production-like containers
docker compose up --build -d
```

Before a pull request: `pnpm verify`. Details: [Local development](docs/guides/local-development.md).

## Documentation

Start at [`docs/index.md`](docs/index.md) — architecture, contracts, guides, decisions (ADRs) and roadmap.
Agents: read [`AGENTS.md`](AGENTS.md).
