---
title: Mail and the status page
description: Transactional mail moves to notify.toheplay.io.vn, and the status page lives at status.toheplay.io.vn on a service outside Tò He — the owner's steps, the agent's changes, the checks.
sidebar:
  order: 9
---

[ADR 0042](../decisions/0042-hosts-by-trust-paths-by-component.md) gives mail and the status page hosts of their own:

- **Mail** goes out from `notify.toheplay.io.vn`: its sending reputation stays apart from the root's, and its purpose
  is plain.
- **The status page** lives at `status.toheplay.io.vn`, on a service outside Tò He's infrastructure, so it stays up when
  Tò He is down.

Both are mostly the owner's setup; this guide gives the order. Mail to people does not move: `hello@` and
`security@toheplay.io.vn` reach the owner through Cloudflare Email Routing, the root's MX.

## Mail from `notify.`

Today production and UAT send as `Tò He <no-reply@toheplay.io.vn>` through Resend. The domain verified in Resend is the
root, so the records `resend._domainkey` and `send` sit at the root.

| # | Who | Step |
| --- | --- | --- |
| 1 | owner | Resend → **Domains → Add domain** `notify.toheplay.io.vn`. Let Resend add its records in Cloudflare, or add them by hand, DNS only: the DKIM `TXT` at `resend._domainkey.notify`, and the `MX` and `TXT` at `send.notify`. Wait for **Verified**. |
| 2 | owner | Resend → **API keys**: a key with sending access to `notify.toheplay.io.vn` only. |
| 3 | agent opens, owner merges | `platform-infra`, `apps/tohe/values.yaml`: `Email__From: "Tò He <no-reply@notify.toheplay.io.vn>"`. |
| 4 | owner, right after 3 syncs | Infisical `platform` / `prod` / `/tohe`: `email-smtp-password` = the new key. Reloader rolls the API. |
| 5 | owner | UAT, in `~/.config/tohe-uat/uat.env`: `TOHE_UAT_EMAIL_FROM='Tò He <no-reply@notify.toheplay.io.vn>'` and the new key, then deploy again. |
| 6 | agent | In this repository: `pnpm check:prod`'s `--sending-domain` default becomes `notify.toheplay.io.vn`, and the examples in [Configuration](configuration.md) and [UAT](uat.md) follow. |
| 7 | agent, then owner | The checks below. |
| 8 | owner, a week later | Remove `toheplay.io.vn` from Resend, and its records at the root: `resend._domainkey`, and the `MX` and `TXT` at `send`. Keep `_dmarc` and the root's MX. |

Between steps 3 and 4, the old key, which may only send from the root, meets the new sender, and Resend refuses the
mail. Nothing is lost: mail waits in the outbox and is tried six times, from a minute to six hours apart, with the
sender read at each try ([ADR 0022](../decisions/0022-send-transactional-email-through-an-outbox.md)). Do step 4 within
the hour all the same.

DMARC: DKIM signs as `notify.toheplay.io.vn`, the sender's own domain, so the mail passes DMARC on DKIM alone. The
record at `_dmarc.toheplay.io.vn` stays as it is; the second check below confirms the result.

### Checks

1. `pnpm check:prod`: the mail section reads the records at `notify.toheplay.io.vn`, and DMARC and MX at the root.
   Until step 6 lands, add `--sending-domain notify.toheplay.io.vn`.
2. Ask for a password reset on production to a Gmail address. In Gmail, open **Show original**: `SPF`, `DKIM` (domain
   `notify.toheplay.io.vn`) and `DMARC` all say `PASS`.
3. The API's log has no `Email … failed` line after the switch.

## The status page

The owner picks the service. What it must do:

- Run outside Tò He's servers and outside the cluster: it stays up when they are down.
- Serve `status.toheplay.io.vn` with a certificate it issues itself. HSTS covers every subdomain (ADR 0042), so a status
  page on plain HTTP would not open at all.
- Check from outside at least every five minutes, and tell the owner when a check fails.
- Show the page to anyone, without an account; incidents are written by hand.

**DNS**: a `CNAME` `status` → the target the service names, **DNS only** (grey cloud). The service then sees its own
hostname and keeps its certificate itself. The page still shares Tò He's DNS zone: if that zone fails, the owner's
Zalo and Facebook groups carry the news.

**What to watch**:

| Component on the page | Check | Healthy when |
| --- | --- | --- |
| Chơi | `https://toheplay.io.vn/api/health` | `200`, body `Healthy` |
| Chơi | `https://toheplay.io.vn/` | `200` after redirects |
| Game | `https://games.toheplay.io.vn/catalog.json` | `200` |
| Tài liệu | `https://docs.toheplay.io.vn/` | `200` |

Not watched from outside:

- The console: it is behind Cloudflare Access, and it is not for players.
- UAT: it runs on the homelab and is not public.

The cluster's own alerts (Alertmanager, in `platform-infra`) are a separate thing. They see inside, these checks see
what a player sees.
