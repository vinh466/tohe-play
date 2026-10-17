---
title: UAT environment
description: The always-on environment on the homelab that the family uses — how to deploy, back up, roll back and inspect it.
sidebar:
  order: 4
---

UAT is the environment the family actually plays on. It runs on the homelab machine with Docker Compose and is
reachable from the owner's devices over WireGuard/LAN at **10.100.0.2**. There is no production environment yet;
see [ADR 0010](../decisions/0010-environments-dev-and-uat.md).

| What | URL |
| --- | --- |
| Hub | <http://10.100.0.2:4820> |
| Landing + docs | <http://10.100.0.2:4810> |
| Games origin | `http://10.100.0.2:4830` (embedded by the hub) |

The API and PostgreSQL are not published; the hub proxies `/api`. Development uses the separate `tohe` compose
project on ports 47xx ([Local development](local-development.md)); the two never share containers, volumes or ports.

## First use

Open the hub, choose **Tạo tài khoản gia đình**, then add the children's profiles under **Quản lý gia đình**
(it asks for the password again). The second parent registers with the invite code shown there. See
[Identity](../architecture/identity.md).

## Deploy

From any checkout of the repository on the homelab:

```sh
deploy/uat/deploy.sh               # deploys origin/main
deploy/uat/deploy.sh <commit>      # deploys a specific commit (roll back / forward)
```

The script:

1. creates `~/.config/tohe-uat/uat.env` on first run (host, a random database password and a telemetry report
   token — keep this file; an older file gets the token added once);
2. exports the exact commit with `git archive` into `~/.local/share/tohe-uat/src` — never a working copy;
3. pulls the four images CI published for that commit, `ghcr.io/vinh466/tohe-play/<api|hub|games|site>:sha-<commit>`
   ([ADR 0021](../decisions/0021-release-production-through-the-tohe-chart.md)) — the same images production runs.
   CI publishes them after every check on `main` passed; until then the script stops and says so. A commit from
   before CI published images (a rollback that far) is built here instead, as deploys used to;
4. backs up the database if UAT is running ([below](#backups));
5. starts the `tohe-uat` compose project (database migrations run when the API starts), waits for `/api/health` and
   prints the deployed commit.

What is running: `curl -s http://10.100.0.2:4820/api/config` → `apiVersion` is the deployed commit.

Deploy only commits that are on `main` with green CI. Agents deploy after merging when asked to "ship to UAT".

The packages are public, so the homelab pulls without signing in. If a pull is refused, check the package's
visibility on GitHub (**Packages → tohe-play/api → Package settings**), or sign in once with
`docker login ghcr.io` and a token that can read packages.

## Backups

`deploy/uat/backup.sh` dumps the database to `~/backups/tohe-uat/` and keeps the newest 20 dumps. Every deploy
runs it right before replacing the containers. Restore a dump:

```sh
gunzip -c ~/backups/tohe-uat/tohe-YYYYMMDD-HHMMSS.sql.gz \
  | docker compose -p tohe-uat exec -T postgres psql -U tohe -d tohe
```

## Inspect

```sh
docker compose -p tohe-uat ps
docker compose -p tohe-uat logs -f api
docker compose -p tohe-uat exec postgres psql -U tohe -d tohe
```

How the games are doing on the family's devices ([Device telemetry](../architecture/telemetry.md)); the operator
token is `TOHE_UAT_TELEMETRY_TOKEN` in `~/.config/tohe-uat/uat.env`, added by the first deploy that needs it:

```sh
pnpm --filter @tohe/telemetry-report report -- --env uat --days 7
```

## Limits (accepted for now)

- Plain HTTP inside WireGuard/LAN: no service worker or "Add to Home Screen" on phones (needs HTTPS), session
  cookies are not marked `Secure`. Production runs on HTTPS ([ADR 0021](../decisions/0021-release-production-through-the-tohe-chart.md)).
- One machine, no redundancy. Backups are local to the same disk.
