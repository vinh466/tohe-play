---
title: Local development
description: Prerequisites, the three ways to run the stack, demo data, ports, commands and troubleshooting.
sidebar:
  order: 1
---

How a change reaches UAT and production is in [Environments and releases](environments.md).

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
| 4710 | Docs, at the root of their own host (`pnpm dev` and compose) |
| 4711 | The public pages' dev server (`pnpm dev` only). Under compose they are the root of the hub, 4720; under `pnpm dev` the root of 4720 is the app's dev server, which has no public page |
| 4720 | Hub (open this) — proxies `/api` to the API |
| 4721 | The console, on a host of its own with its own sign-in: its dev server under `pnpm dev`, the hub container's second site under `docker compose`. The API answers the console's routes at this address only (`App:ConsoleUrl`) ([Admin console](../architecture/admin.md)). Under `pnpm dev` it answers only at `http://localhost:4721`, not through `127.0.0.1` or a LAN IP: the API tells the console's host by the `Host` header |
| 4730 | Games origin |
| 4731 | A single game's standalone dev server (`dev:standalone`) |
| 4740 | Platform API (direct, for debugging; Scalar at `/api/docs`, on in both modes, off on UAT and production) |
| 4741 | The API's Prometheus metrics, `http://localhost:4741/metrics` ([Metrics](../architecture/metrics.md)) — 9464 in the image |
| 4750 | PostgreSQL (bound to 127.0.0.1) — user `tohe`, password `tohe-dev-only`, database `tohe` |
| 4760 | Mailpit — every email the API sends locally, in a web UI ([ADR 0022](../decisions/0022-send-transactional-email-through-an-outbox.md)) |
| 4761 | Mailpit's SMTP port, which `pnpm dev`'s API sends to (start it with `docker compose up -d mailpit`) |

## Mode A — hot reload (day-to-day)

```sh
docker compose up -d postgres mailpit   # the database, and Mailpit for the codes sign-up emails
pnpm dev                                # API (dotnet watch) + games origin + hub + public pages + docs
```

Open <http://localhost:4720/play> (under compose the root, <http://localhost:4720>, is the public home page; under
`pnpm dev` it is on <http://localhost:4711>). The API migrates the database on start and indexes the games within ~15 s.
A new device plays as a guest at once, with no sign-in screen. To sign up, use the "Đăng nhập" strip on the catalog
and "Tạo tài khoản": any email and a password of 8+ characters (the code arrives in Mailpit,
<http://localhost:4760>); add a child profile under "Quản lý tài khoản".

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
docker compose up --build -d    # postgres, mailpit, api, hub, games, docs
```

Same URLs as above. Images are the ones production will use (Caddy + chiseled .NET). Stop with
`docker compose down` (add `-v` to wipe the database). Do not run modes A, B and C at the same time — they share ports.

This is the development stack. The family's always-on environment is separate: see
[UAT environment](uat.md).

### Trying it on a phone

Mode B with your machine's LAN address:

```sh
TOHE_PUBLIC_HOST=192.168.1.23 docker compose up --build -d
```

Then open `http://192.168.1.23:4720` on the phone (same Wi-Fi). Plain-HTTP LAN addresses are not a secure
context: the service worker and "Add to Home Screen" only work on `localhost` or HTTPS, but the games play fine.

To try the service worker and installing on an Android phone, connect it over USB and forward the hub and the games
origin to it, then open `http://localhost:4720` on the phone — `localhost` is a secure context (either mode):

```sh
adb reverse tcp:4720 tcp:4720
adb reverse tcp:4730 tcp:4730
```

An iPhone has no such shortcut: try it on production while only the owner uses it
([Environments and releases](environments.md)).

## Mode C — the images of a tag

To reproduce a problem seen on UAT or production, run the exact images CI published for a commit, on this machine:

```sh
pnpm stack:image uat-2026-10-20.1    # a uat-/prod- tag, a branch (origin/main), or any commit
pnpm stack:image --down              # stop it and remove its database
```

The script resolves the tag or commit, pulls `ghcr.io/vinh466/tohe-play/{api,hub,games,docs}:sha-<commit>` and starts
them next to a fresh PostgreSQL and Mailpit, in their own compose project, `tohe-image`, on the same ports as the
other modes (hub <http://localhost:4720>, mail <http://localhost:4760>). When the hub answers it prints the commit and
the API's `apiVersion`. The tag only decides the images: `compose.yaml` and `compose.image.yaml` come from your
working tree.

- **It never builds.** CI publishes images for a commit on `main` once its checks pass; for a commit from before that,
  or one CI has not finished, there are none, and the script says so and stops.
- **It shares the ports of Mode A and B**, so it refuses to start while the development stack (project `tohe`) is up:
  stop it first with `docker compose -p tohe down`, or stop `pnpm dev`.
- **Its data is throwaway.** `--down` removes the database, and starting it again replaces a Mode C stack that is
  already running, database included, so a newer schema never meets an older API.
- **It never touches UAT** (`tohe-uat`): the script refuses that project name. Fill it with demo data the same way as the
  other modes ([below](#demo-data)), if that commit has the seed command.

It needs Docker Compose 2.24 or later (the override uses `!reset`).

## Demo data

`pnpm seed` fills a development database with demo accounts, profiles and scores, so trying things by hand and taking
screenshots is quick. It runs `dotnet Tohe.Api.dll dev seed`, made the way the API makes accounts (the same services, so
public IDs, profile limits, the terms version and a confirmed email all hold), and is safe to run again: what exists
is kept, what is missing is added.

| Email | Password | Profiles |
| --- | --- | --- |
| `gia-dinh@tohe.localhost` | `tohe-dev-only` | Bố Minh (adult) and Bé Na (child, 6–8: off public boards, asked to tables only within the account); manage PIN `123456` |
| `ban@tohe.localhost` | `tohe-dev-only` | Cô Lan (adult), a friend with an account of her own; manage PIN `123456` |

Each profile gets three finished runs of every solo game that takes scores, so the account's board shows the family
(the game's "Bảng xếp hạng", tab "Nhà mình"). The public boards take only runs the server verified, which a seed cannot make, so they stay
empty. No platform roles are seeded, and no rooms (they live in memory, [ADR 0016](../decisions/0016-online-rooms-for-turn-based-games.md)):
claim ownership with the setup token at <http://localhost:4721/setup>, or `docker compose exec api dotnet Tohe.Api.dll admin grant gia-dinh@tohe.localhost --role owner`;
then add an authenticator in the hub (Quản lý tài khoản → Bảo mật tài khoản) and sign in to the console at
<http://localhost:4721> ([Admin console](../architecture/admin.md)).

| Mode | How |
| --- | --- |
| A | `docker compose up -d postgres mailpit`, then `pnpm seed`. It uses `dotnet run`, which migrates the database if the API has never run; or by hand: `ASPNETCORE_ENVIRONMENT=Development dotnet run --project services/api/src/Tohe.Api -- dev seed`. |
| B | `pnpm seed` runs it inside the `api` container of project `tohe`. |
| C | `pnpm seed` runs it inside the `api` container of project `tohe-image`, if that commit has the command; an older image would try to start a second web server and fail on the port. |

The games arrive in the registry within about a minute of the API starting; seeded before that, there are accounts but
no scores, and the command says so. Run it again then.

**Never on UAT or production.** The command has two locks, each enough on its own: the host environment must be
`Development`, and the setting `Dev:SeedAllowed` must be true — only `appsettings.Development.json` and `compose.yaml`
set it, never UAT's configuration or the chart. `pnpm seed` asks for `Development` only for its own single command, in
the `tohe` and `tohe-image` projects, never in `tohe-uat`; a UAT container asked the same way still refuses. The
passwords are public, so a database that holds real people must never have these accounts.

## Everyday commands

| Command | What it does |
| --- | --- |
| `pnpm verify` | Lint + typecheck + test + build + conformance for everything. Run before every PR. |
| `pnpm lint` / `pnpm format` | Biome check / fix. |
| `pnpm test` | Unit tests (Vitest) and API tests (xUnit + PostgreSQL in Docker). |
| `pnpm conformance` | Conformance kit for every game. |
| `pnpm stack:image <tag\|commit>` | Mode C: run the images CI published for a commit; `--down` stops it ([above](#mode-c--the-images-of-a-tag)). |
| `pnpm seed` | Demo accounts, profiles and scores in the local database ([above](#demo-data)). |
| `pnpm --filter @tohe/e2e smoke` | End-to-end smoke test against a running stack (`HUB_URL` to override). |
| `pnpm --filter @tohe/e2e routes` | Mode B only: the hub's image serves the map of its paths — the app's pages, real 404s, `robots.txt` ([Hosts and paths](../architecture/hosts-and-paths.md)). |
| `pnpm --filter @tohe/routes build` | Regenerate what the map of the hub's paths generates, after changing `packages/routes/src/map.ts`. |
| `pnpm --filter @tohe/e2e rooms` | Online rooms end to end: three phones open, join and play a Tiến Lên table (ADR 0016). |
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
| Port already in use | Another mode is running: `docker compose down`, `pnpm stack:image --down`, or stop `pnpm dev`. |
