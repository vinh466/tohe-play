---
title: Sign in with Google
description: Switch on "Tiếp tục với Google" in production — the Google client the owner makes, who may sign up, its two keys in Infisical, the console switch and the checks.
sidebar:
  order: 8
---

The code has been there since [ADR 0026](../decisions/0026-sign-in-methods-and-account-linking.md): the API offers
Google once it has a client ID and a secret, and the console can switch it off and on again at run time
([ADR 0028](../decisions/0028-sign-in-and-registration-at-run-time.md)). Production has neither today, so `/api/config`
answers `providers: []`. This guide turns it on, in order: Google is the fast way in for a newcomer.

| Who | Does |
| --- | --- |
| The owner | Decides who may sign up, makes the Google client, puts its ID and secret in Infisical |
| The agent | Checks production |

No pull request is needed: production's API takes its own settings from the Infisical folder `/tohe/api`, one key per
setting ([Configuration](configuration.md#settings-from-infisical-in-production)).

**Production only.** Google takes no redirect address on plain HTTP or on a bare IP, so UAT (`http://10.100.0.2:4820`)
cannot offer Google. Development can, with a client of its own (see [the end of this guide](#on-a-development-machine)).

## 1. The Google client (owner)

In the [Google Cloud console](https://console.cloud.google.com/), in a project of Tò He's own:

1. **Google Auth Platform → Branding**:
   - App name `Tò He`, and a support email the owner reads.
   - Home page `https://toheplay.io.vn/`.
   - Privacy policy `https://toheplay.io.vn/privacy`; terms `https://toheplay.io.vn/terms`. Change both
     here if those pages move.
   - Authorized domain `toheplay.io.vn`.
   - A developer contact address.
2. **Audience**: user type **External**, then **Publish app** so that its status is **In production**. Tò He asks
   Google for `openid` and `email` only. These are not sensitive scopes: Google needs no verification for them and
   shows no "unverified app" warning. Google may ask to verify the brand before it shows the name and logo on its
   screen; that is optional.
3. **Data access**: add nothing. The API asks for its two scopes itself.
4. **Clients → Create client**, type **Web application**, name `Tò He production`:
   - **Authorized redirect URIs**: exactly `https://toheplay.io.vn/api/auth/external/google/callback`.
   - **Authorized JavaScript origins**: none. The browser never talks to Google's API; the API exchanges the code.
5. **Create**, then copy the **client ID** and the **client secret** at once. Google shows the secret only now; later it
   keeps the last four characters. A lost secret is replaced, not recovered (see [Rotating the secret](#rotating-the-secret)).

A new or changed redirect address can take from five minutes to a few hours to work at Google.

## 2. Who may sign up (owner, before step 3)

A provider that has its keys is **on** unless the console switched it off. So Google is live for everyone as soon as the
API restarts with its keys (step 3), and the console cannot switch it off before then. Decide first who may make an
account the first time they sign in with Google: **the console → Đăng nhập & đăng ký → Đăng ký**:

- `Mở`: anyone.
- `Theo lời mời`: with an invite code.
- `Đóng`: nobody new.

It is `Mở` on production today. Someone whose Google address already has a Tò He account is not signing up: Tò He sends
a code to that address, and once they confirm it, Google is linked to that account
([ADR 0026](../decisions/0026-sign-in-methods-and-account-linking.md)).

## 3. The keys in Infisical (owner)

In Infisical, project `platform`, environment `prod`, folder **`/tohe/api`** (create it the first time), two keys with
exactly these names:

| Key | Value |
| --- | --- |
| `Auth__Providers__Google__ClientId` | the client ID, `….apps.googleusercontent.com` |
| `Auth__Providers__Google__ClientSecret` | the client secret |

Within a minute the operator copies them into the API's Secret and Reloader restarts the API with them. The API offers
Google only with both keys; with one of them missing it starts as before, without Google.

## 4. Check (agent, then owner)

Once the API has restarted:

1. `curl -s https://toheplay.io.vn/api/config` lists `{"id":"google","name":"Google"}` under `providers`, and the
   console lists Google under **Cách đăng nhập**, switched on.
2. The sign-in page shows **Tiếp tục với Google**.
3. The owner signs in with the Google account whose address is the owner account's. Tò He asks for a code sent to that
   address (**Liên kết Google**); after it, both ways sign in to the same account. Linking also works from
   **Quản lý tài khoản**, which asks to confirm it is you first.
4. A Google account with no Tò He account behaves as the **Đăng ký** card says.

When it goes wrong:

| What you see | Why |
| --- | --- |
| Google says `redirect_uri_mismatch` | The redirect address in the client differs from step 1.4 — `http`, a trailing `/`, another host — or Google has not applied it yet |
| Google says `invalid_client` | The client ID or the secret in Infisical is wrong, or the secret was rotated away |
| Tò He says *Cách đăng nhập đó đang tạm tắt* | Google is off in the console |
| No Google in the console | The API has no client ID or no secret: look at step 3 (both keys, their exact names, in `/tohe/api`), and at the API's log |

## Turning it off, rotating the secret

**Off** is the console's switch under **Cách đăng nhập**: it applies at once, and accounts keep their link. Someone
who signs in only with Google cannot sign in while it is off; when there are such accounts, the console says so and
asks once more.

### Rotating the secret

A Google client holds two secrets at once, so rotating needs no downtime:

1. Add a secret to the client in Google.
2. Put the new one in Infisical `/tohe/api` as `Auth__Providers__Google__ClientSecret`. Reloader restarts the API.
3. Sign in with Google once to check.
4. Disable and delete the old secret in Google.

## On a development machine

A second client, `Tò He dev`, with the redirect address `http://localhost:4720/api/auth/external/google/callback`
(Google accepts plain HTTP for `localhost`). While the client stays in **Testing**, add the Google accounts that will
try it as test users. Give the API its keys through user secrets, never in a file in the repository:

```sh
dotnet user-secrets --project services/api/src/Tohe.Api set "Auth:Providers:Google:ClientId" "<the client ID>"
dotnet user-secrets --project services/api/src/Tohe.Api set "Auth:Providers:Google:ClientSecret" "<the secret>"
```

Restart `pnpm dev`, then switch Google on in the console at `http://localhost:4721`.
