---
title: Sign in with Google
description: Switch on "Tiếp tục với Google" in production — the Google client the owner makes, where its secret goes, the values that wire it in, the console switch and the checks.
sidebar:
  order: 8
---

The code has been there since [ADR 0026](../decisions/0026-sign-in-methods-and-account-linking.md): the API offers
Google once it has a client ID and a secret, and the console can switch it off and on again at run time
([ADR 0028](../decisions/0028-sign-in-and-registration-at-run-time.md)). Production has neither today, so `/api/config`
answers `providers: []`. This guide turns it on, in order: Google is the fast way in for a newcomer.

| Who | Does |
| --- | --- |
| The owner | Makes the Google client, puts its secret in Infisical, decides who may sign up, merges the `platform-infra` pull request |
| The agent | Opens the `platform-infra` pull request, then checks production |

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

## 2. The secret in Infisical (owner)

In Infisical, project `platform`, environment `prod`, path **`/tohe`**: add `google-client-secret` with the client secret.
The client ID is not a secret; it goes in the values (step 4).

Do this **before** step 4 is merged. The API reads the key from the `tohe-secrets` Secret, and a key that is not there
stops the pod from starting (`CreateContainerConfigError`), as `email-smtp-password` would. Reloader rolls the pods
whenever `tohe-secrets` changes; on its own, the new key changes nothing until the values ask for it.

## 3. Who may sign up (owner, before step 4)

A provider that has its keys is **on** unless the console switched it off. So Google is live for everyone as soon as the
API rolls out with step 4, and the console cannot switch it off before then. Decide first who may make an account the
first time they sign in with Google: **the console → Đăng nhập & đăng ký → Đăng ký**:

- `Mở`: anyone.
- `Theo lời mời`: with an invite code.
- `Đóng`: nobody new.

It is `Mở` on production today. Someone whose Google address already has a Tò He account is not signing up: Tò He sends
a code to that address, and once they confirm it, Google is linked to that account
([ADR 0026](../decisions/0026-sign-in-methods-and-account-linking.md)).

## 4. The values (agent opens, owner merges)

A pull request to `vinetic-spaces/platform-infra`, in `apps/tohe/values.yaml`, beside the mail settings:

```yaml
api:
  config:
    # …the Email__ settings stay as they are.
    Auth__Providers__Google__ClientId: "<the client ID>.apps.googleusercontent.com"
  extraEnv:
    # …Email__Smtp__Password stays as it is.
    - name: Auth__Providers__Google__ClientSecret
      valueFrom:
        secretKeyRef:
          name: tohe-secrets
          key: google-client-secret
```

The note at the top of `apps/tohe/base/static-secret.yaml` gains the key `google-client-secret`. The pull request changes
values, not `targetRevision`, so the owner merges it ([Environments and releases](environments.md)). The configuration
keys are listed in [Configuration](configuration.md).

## 5. Check (agent, then owner)

Once Argo CD has rolled the API:

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
| Google says `invalid_client` | The client ID in the values or the secret in Infisical is wrong, or the secret was rotated away |
| Tò He says *Cách đăng nhập đó đang tạm tắt* | Google is off in the console |
| No Google in the console | The API has no client ID or no secret: look at steps 2 and 4, and at the API's log |

## Turning it off, rotating the secret

**Off** is the console's switch under **Cách đăng nhập**: it applies at once, and accounts keep their link. Someone
who signs in only with Google cannot sign in while it is off; when there are such accounts, the console says so and
asks once more.

### Rotating the secret

A Google client holds two secrets at once, so rotating needs no downtime:

1. Add a secret to the client in Google.
2. Put the new one in Infisical `/tohe` as `google-client-secret`. Reloader rolls the API pods.
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
