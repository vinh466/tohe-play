---
title: UAT environment
description: The always-on environment on the homelab that the family uses — how to deploy, back up, roll back and inspect it.
sidebar:
  order: 5
---

UAT is the environment the family actually plays on. It runs on the homelab machine with Docker Compose and is
reachable from the owner's devices over WireGuard/LAN at **10.100.0.2**. It runs the images of a `uat-` tag, and
production runs only a commit that ran here first: see [Environments and releases](environments.md),
[ADR 0041](../decisions/0041-promote-one-build-through-the-environments-by-tag.md) and
[ADR 0010](../decisions/0010-environments-dev-and-uat.md).

| What | URL |
| --- | --- |
| Hub | <http://10.100.0.2:4820> |
| Landing + docs | <http://10.100.0.2:4810> |
| Games origin | `http://10.100.0.2:4830` (embedded by the hub) |

The API and PostgreSQL are not published; the hub proxies `/api`. Development uses the separate `tohe` compose
project on ports 47xx ([Local development](local-development.md)); the two never share containers, volumes or ports.

## First use

Open the hub and choose **Tạo tài khoản**: an email, a name and a password, then the code that email receives
([ADR 0024](../decisions/0024-email-identifies-an-account.md)) — so UAT needs its relay configured
([below](#email)), or nobody new can join. The account starts with one profile and plays at once. Accounts made
before email sign-in keep their username and add an email the next time they sign in. Add the
children's profiles from **Đổi người chơi → Thêm hồ sơ** or **Quản lý tài khoản** (the first time it asks for the
password and offers a 6-digit manage PIN, which opens it from then on — ADR 0025);
an account holds up to five. A family shares one account on its devices; another adult may register their own. See
[Identity](../architecture/identity.md).

## Deploy

From any checkout of the repository on the homelab:

```sh
deploy/uat/deploy.sh uat-YYYY-MM-DD.N   # deploys the commit a uat- tag points at
```

The script also accepts a commit or nothing (`origin/main`), but agents and releases always deploy a tag, rolling back
included: a new `uat-` tag on the older commit ([ADR 0041](../decisions/0041-promote-one-build-through-the-environments-by-tag.md)).

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

What is running: `curl -s http://10.100.0.2:4820/api/config` → `apiVersion` is the first 12 characters of the deployed
commit. `pnpm check:uat` does that and the rest of the [checks after a deploy](environments.md#checks-after-a-deploy)
(it reads only), and `pnpm check:uat --expect <tag>` compares the version with a tag.

Deploy only commits that are on `main` with green CI. The agent tags the commit `uat-…` and deploys when the owner
says "deploy" ([ADR 0041](../decisions/0041-promote-one-build-through-the-environments-by-tag.md)); the tag rules and
the checks to run afterwards are in [Environments and releases](environments.md).

The packages are public, so the homelab pulls without signing in. If a pull is refused, check the package's
visibility on GitHub (**Packages → tohe-play/api → Package settings**), or sign in once with
`docker login ghcr.io` and a token that can read packages.

## Email

UAT sends no email until the relay's settings are in `~/.config/tohe-uat/uat.env`
([ADR 0022](../decisions/0022-send-transactional-email-through-an-outbox.md)). For Resend (port 587, STARTTLS — the
username is the literal word `resend`, the password an API key). Tò He sends from `toheplay.io.vn`, the domain
verified in Resend for it, as production does; its key may send from that domain alone, so the sender must be on it:

```sh
TOHE_UAT_EMAIL_MODE=Smtp
TOHE_UAT_EMAIL_FROM='Tò He <no-reply@toheplay.io.vn>'   # quoted: deploy.sh sources this file
TOHE_UAT_SMTP_HOST=smtp.resend.com
TOHE_UAT_SMTP_USERNAME=resend
TOHE_UAT_SMTP_PASSWORD=re_…
```

The next deploy picks them up. Resend's free plan allows 100 emails a day for the whole account.

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

The admin console, `http://10.100.0.2:4820/admin/`, shows the same and more ([Admin console](../architecture/admin.md)).
Until someone owns the deployment, the API logs a setup token when it starts; the first owner gives it at
`/admin/setup`, signed in with a confirmed email:

```sh
docker compose -p tohe-uat logs api | grep "No platform owner"
```

The command inside the API's container grants roles too, and is the way back if every owner is lost:

```sh
docker compose -p tohe-uat exec api dotnet Tohe.Api.dll admin grant <email or old username> --role owner
docker compose -p tohe-uat exec api dotnet Tohe.Api.dll admin list
```

The first visit sets up two-factor authentication: an authenticator app on the phone, and recovery codes to keep.

## Limits (accepted for now)

- Plain HTTP inside WireGuard/LAN: no service worker or "Add to Home Screen" on phones (needs HTTPS), session
  cookies are not marked `Secure`. Production runs on HTTPS ([ADR 0021](../decisions/0021-release-production-through-the-tohe-chart.md)).
- One machine, no redundancy. Backups are local to the same disk.
