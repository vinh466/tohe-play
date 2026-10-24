---
title: "0055: Let the front page explain Tò He, greet a known device, and ask once at the app's door"
description: The home page becomes an introduction in sections with two centred buttons instead of a catalog; a device that has played sees a greeting with its player's name and last game on `/`, with the domain and paths unchanged; and the app's first visit asks whether to sign in or to play on this device, while links to a game or a table still play at once.
sidebar:
  order: 55
---

- **Status:** Accepted — arrives in steps (plans/launch-review E-08: V1 the front page, V2 the app's door)
- **Date:** 2026-10-25
- **Amends:** [ADR 0046](0046-player-surfaces-two-zones-one-frame.md) — `/` no longer puts the catalog first; *Continue*
  on `/` becomes a greeting; the frame's first visit asks before it plays.
  [ADR 0047](0047-two-languages-and-an-introduction-surface-that-grows.md) — the home page's contents.
  [ADR 0043](0043-device-profiles-and-identity-levels.md) — the `any` level makes a device profile silently only after
  the app's door has been answered once.
- **Decided by:** the owner, in the launch review (plans/launch-review D-08, D-09, D-10, E-08). On 2026-10-24, after
  trying production on real devices: "về luồng và UI thì cần cải thiện cho xịn hơn nữa"; the research plan, "duyệt, kế
  hoạch ổn, làm đi"; on 2026-10-25 the proposals, "duyet r nha", and the owner merged them (#166). D-10's two questions
  were answered by the proposal it approved: the app asks and lets the player choose (not a wall); players already
  playing on their device are not asked again. Points the agent added while writing this are marked *(agent)*.

## Context

The owner tried production on an Android phone and an iPhone on 2026-10-24: nothing was broken, but three moments left
people unsure what was happening (plans/launch-review R-11):

- **The front page does not say what Tò He is.** `/` shows the name, one line and the four games (the same grid as
  `/games/` and the app's Games), a "play together" box and three questions. Its only button is *Chơi ngay* in the
  corner of the header. The owner: "landing page làm cho nó giới thiệu 1 chút có các section và căn giữa các nút … k cần
  list game ở đây lặp".
- **Coming back by typing the address.** A device that has opened a game sees a wide *Chơi tiếp* above the name, saying
  neither who nor which game. The owner suspected the domain and paths ("tôi đang nghi do bố cục domain/path ta k ổn
  quá"). The research found three cases: a browser that has played (the button needs context), a player signed in
  elsewhere on a new browser (no session exists there under any path), and the installed app (it opens `/play` and never
  passes `/`). Moving paths fixes none of them.
- **The app makes a player without saying so.** A device with no session that opens `/play`, `/together` or `/account`
  is given a device profile with a suggested name ("Thỏ Hiền Khô") and goes straight on. The owner: "vào thẳng với
  profile tạm nó hơi làm user k biết chuyện gì đang xảy ra". The hub already has a screen that offers the choice
  (`/account/sign-in`: Google, create an account, "Chơi luôn, không cần tài khoản"), but a newcomer is never sent there.

Peers (plans/launch-review R-12): products that must explain themselves (Duolingo, Chess.com, Discord) open on a centred
hero with *start* and *I already have an account*, then sections, then a closing call; game portals (Poki, PBS KIDS) open
on their catalog. Google lists "redirecting users to an internal page once they are logged in" as a legitimate redirect,
and calls it cloaking only when bots and people are shown different content to mislead. NN/g advises against a login
wall in the first experience; apps for children ask the adult on the first run, and explain (YouTube Kids, Khan Academy
Kids).

The vision promises play in seconds without signing up, a name only when others will see it, and an account only when it
is worth it. A link to a game or a table must keep playing at once.

## Decision

### The front page explains (`/` and `/en/`)

- **A centred hero**: the picture (the app's icon until the drawn tò he of [ADR 0049](0049-a-crafted-toy-voice-and-look.md)),
  the name as the heading, one line, and two buttons of the same width — **Chơi ngay** (filled, to `/play`) and **Tôi đã
  có tài khoản** (outlined, to `/account/sign-in`). Stacked on a phone, side by side from tablet width.
- **Six sections, then a closing call**, each one idea with an icon or a picture and a few lines:
  1. *What Tò He is* — open and play, nothing to install; the family plays together through one link; no ads, no
     purchases.
  2. *How it works* — three steps: pick a game; play on this device or sign in to keep progress on every device; send a
     link to bring the family to the table.
  3. *Playing together* — a table opened with a link in Zalo, its code; *Thử Tiến Lên*; and one card, **Xem các trò
     chơi**, with the number of games, to `/games/`.
  4. *For children and parents* — a profile for each child, the parents' PIN, links out asking a parent first, the
     promise.
  5. *Install it like an app* — one line for Android, one for iPhone, the guide.
  6. *Parents often ask* — three or four questions that open in place, and the link to the FAQ.

  The closing call repeats *Chơi ngay*, centred. The footer stays.
- **No list of games on the home page.** The games are listed at `/games/` and in the app; the home page links there.
- **The header keeps** *Chơi ngay* (*Chơi tiếp* on a device that has opened a game) on every public page, phones too.
- **From tablet width** the content is about 1100 px wide, centred; *What Tò He is* in three columns; the later sections
  in two, words and picture alternating sides.
- **Structured data**: `WebSite` and `Organization` on the home pages; the games' `ItemList` is `/games/`'s (it has it
  already).

### A known device is greeted on `/`

- **No redirect, and the domain and paths of [ADR 0042](0042-hosts-by-trust-paths-by-component.md) stay.** A link to `/`
  always shows `/`.
- The hub keeps one small key, **`tohe:greeting`**, in `localStorage`: the playing profile's name and picture and the id
  of the game it opened last — written where the hub writes `tohe:returning` today, removed when that profile is deleted
  or its account signs out *(agent)*. Nothing else; it never leaves the device.
- On a device that has it, the public pages' small script draws, **before the first paint**, a card in the hero in place
  of the two buttons: the picture and "Chào lại, <name>"; **Chơi tiếp <game>** (filled, to `/play/<id>`); **Vào Tò He**
  (outlined, to `/play`); a small link **Không phải <name>?** (to the picker, `/account/profiles?ask=true`). The heading,
  the line and the sections stay below, so a returning player can still read the introduction.
- A device with `tohe:returning` but no greeting (one that played before this change) gets the card with *Chơi tiếp* to
  `/play` and no name.
- Crawlers keep no storage: they, and every newcomer, get the same page.
- The way back that needs no address at all is the installed app: the home page's *Install it like an app* section and
  the app's own install prompt stay.

### The app asks once at its door

- **When it asks**: a visitor with no session who has never chosen — no `tohe:guest` on the device — opens a screen of
  the frame (`/play`, `/together`, `/account/…`). The hub shows **the sign-in screen in its first-visit form** instead of
  making a device profile silently.
- **What it says**: a welcome and one line on what an account gives ("tiến độ theo bạn sang mọi máy, bé có hồ sơ
  riêng"); the sign-in methods that are on — **Tiếp tục với Google** first; nothing is said about a method that is off
  *(agent)*; then, under "hoặc", **Chơi thử trên máy này** with "Tiến độ chỉ ở máy này; đăng nhập sau vẫn giữ."
- **Playing on this device** shows the device profile the hub suggests — its picture and name — with *Đổi tên, hình* and
  one button, **Vào chơi**. Nothing to type: a name stays something asked only when others will see it *(agent)*. No
  terms line, because nothing reaches the server. Then the screen that was asked for.
- **Where it never asks**: a link to a game (`/play/<id>`), a table (`/r/…`) or a share (`/s/…`) — they play at once as
  today: the `any` level makes the device profile silently, the `named` screen asks where others will see the name. A
  device already playing as its device profiles (`tohe:guest` set). A signed-in player.
- **Afterwards the app says where progress lives**: the chip on Trò chơi reads "<name> · trên máy này" for a device
  profile; Tôi leads with *Đăng nhập để giữ tiến độ trên mọi máy*.

### Not done

- No redirect on `/`, no new host or path, no app shell on `/`.
- No wall: playing without an account stays one choice away on the first visit, and zero on a link.
- No age question at the door: age is asked when a profile's data first reaches the server (ADR 0025, 0043).

## Consequences

- **Docs**: [Surfaces](../architecture/surfaces.md) (the home page, the greeting, the door, where things stand),
  [Identity](../architecture/identity.md) (a device's first visit), [Overview](../architecture/overview.md) (a
  newcomer's first touches). The vision does not change: play without signing up, a name only when others see it.
- **The public pages' build check**: the home pages need `WebSite` and `Organization`, no longer `ItemList`; `/games/`
  needs `ItemList`.
- **Tests**: the greeting key (written and removed by the hub, read by the public pages' script, both languages); the
  door (asked once, never on a link, never for a device already playing); the e2e smoke test's first steps go through
  the door.
- **Words**: the agent writes them by [Voice and look](../conventions/voice-and-look.md), Vietnamese and English; the
  owner reviews them.
- **Order** (plans/launch-review E-08): V1, the front page and the greeting (`apps/web`), beside V2, the door and the
  key (`apps/hub`); then V3, the frame's layouts on tablets and computers. The owner tries them on real devices.
- **Costs accepted**: a newcomer who taps *Chơi ngay* passes one screen and one tap before the first game (none today);
  a returning player still taps once; on a shared device the last player's name shows on `/`, as the picker shows it in
  the app, with *Không phải <name>?* beside it.

## Alternatives considered

- **Open the app at once for a known device** — a visible one-second "Đang mở Tò He của An…" then a redirect, or `/`
  swapping its content for the app's first screen as GitHub does. One tap fewer, but it is the redirect the owner removed
  on 2026-10-22; a returning player could no longer read the introduction from a link to `/`; a page that moves by itself
  is what left people unsure; the swap needs the app shell and its service worker on `/`.
- **Move the paths** — the app at `/` and the introduction elsewhere, or the app on a host of its own. It fixes none of
  the three cases and costs the sitemap, the service worker's scope, links already shared, certificates and Caddy.
- **A wall: sign in before playing.** It breaks the vision's play-without-signing-up, a grandparent opening a Zalo link,
  and a child with no email; NN/g advises against it, and Baymard measured 19% leaving a purchase when forced to make an
  account.
- **Stay silent and explain afterwards** — a chip and a strip, no question. Cheapest, but it does not ask, which is what
  the owner found missing.
- **Keep the catalog first and add sections below it**, or **a strip of game icons** in the sections: both repeat the
  list the owner asked not to repeat.
