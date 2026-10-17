---
title: Local development
description: Prerequisites, the two ways to run the stack, ports, commands and troubleshooting.
sidebar:
  order: 1
---

## Prerequisites

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | 24 LTS | `.nvmrc` |
| pnpm | 11 | pinned in `package.json` → `packageManager` |
| .NET SDK | 10.0.1xx or later | pinned in `global.json` (rolls forward to the latest feature band) |
| Docker | with Compose v2 | PostgreSQL, the full stack, and API tests (Testcontainers) |
| Chrome or Playwright Chromium | — | conformance and e2e; the tools fall back to system Chrome automatically |

```sh
pnpm install
dotnet tool restore         # dotnet-ef for migrations
```

## Ports

Everything uses the 47xx range so it never collides with other stacks on the machine.

| Port | Service |
| --- | --- |
| 4710 | Site (landing + docs) |
| 4720 | Hub (open this) — proxies `/api` to the API |
| 4730 | Games origin |
| 4731 | A single game's standalone dev server (`dev:standalone`) |
| 4740 | Platform API (direct, for debugging; Scalar at `/api/docs`) |
| 4750 | PostgreSQL (bound to 127.0.0.1) — user `tohe`, password `tohe-dev-only`, database `tohe` |
| 4760 | Mailpit — every email the API sends locally, in a web UI ([ADR 0022](../decisions/0022-send-transactional-email-through-an-outbox.md)) |
| 4761 | Mailpit's SMTP port, which `pnpm dev`'s API sends to (start it with `docker compose up -d mailpit`) |

## Mode A — hot reload (day-to-day)

```sh
docker compose up -d postgres   # database only
pnpm dev                        # API (dotnet watch) + games origin + hub + site
```

Open <http://localhost:4720>. The API migrates the database on start and indexes the games within ~15 s.
A new device lands on the welcome screen: create a family account (any username, password of 8+ characters),
add a child profile under "Quản lý gia đình", or use "Chơi thử" to play as a guest.

`pnpm dev` builds the games once at start. After changing a game, rebuild it and the games origin picks it up:

```sh
pnpm turbo run build --filter=@tohe/games-host
```

To work on one game in isolation, run its own dev server; the SDK switches to standalone mode:

```sh
pnpm --filter @tohe/game-hello dev:standalone    # http://localhost:4731
```

## Mode B — production-like containers

```sh
docker compose up --build -d    # postgres, api, hub, games, site
```

Same URLs as above. Images are the ones production will use (Caddy + chiseled .NET). Stop with
`docker compose down` (add `-v` to wipe the database). Do not run modes A and B at the same time — they share ports.

This is the development stack. The family's always-on environment is separate: see
[UAT environment](uat.md).

### Trying it on a phone

Mode B with your machine's LAN address:

```sh
TOHE_PUBLIC_HOST=192.168.1.23 docker compose up --build -d
```

Then open `http://192.168.1.23:4720` on the phone (same Wi-Fi). Plain-HTTP LAN addresses are not a secure
context: the service worker and "Add to Home Screen" only work on `localhost` or HTTPS, but the games play fine.

## Everyday commands

| Command | What it does |
| --- | --- |
| `pnpm verify` | Lint + typecheck + test + build + conformance for everything. Run before every PR. |
| `pnpm lint` / `pnpm format` | Biome check / fix. |
| `pnpm test` | Unit tests (Vitest) and API tests (xUnit + PostgreSQL in Docker). |
| `pnpm conformance` | Conformance kit for every game. |
| `pnpm --filter @tohe/e2e smoke` | End-to-end smoke test against a running stack (`HUB_URL` to override). |
| `pnpm --filter @tohe/e2e rooms` | Online rooms end to end: two phones open, join and play a Tiến Lên table (ADR 0016). |
| `pnpm --filter @tohe/hub generate:api` | Regenerate the hub's API types after an API change. |
| `pnpm --filter @tohe/telemetry-report report` | Telemetry report of the dev stack (token `tohe-dev-only`); `-- --env uat` for UAT. |
| `dotnet ef migrations add <Name> --project services/api/src/Tohe.Api --output-dir Infrastructure/Database/Migrations` | New migration. |

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` | pnpm refuses packages published in the last 24 h (supply-chain policy). Use a slightly older version or wait; do not add exclusions. |
| `dotnet watch` warns about the inotify limit | Already handled: the dev script uses the polling watcher. To raise the limit: `sudo sysctl fs.inotify.max_user_watches=524288`. |
| Conformance/e2e: `Executable doesn't exist` | The tools fall back to system Chrome; install Chrome, or `pnpm exec playwright install chromium` where supported. |
| Catalog is empty | The API polls the games origin every 15 s (dev) / 20 s (docker). Check the games origin serves `/catalog.json`. |
| Port already in use | Another mode is running: `docker compose down`, or stop `pnpm dev`. |
