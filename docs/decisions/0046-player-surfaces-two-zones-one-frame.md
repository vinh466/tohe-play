---
title: "0046: Lay out the players' surfaces as two zones in one frame, and name the planes"
description: The players' host has two zones — Discover, static and indexed, and Play, the app — joined both ways; the app gets one frame with three tabs (Games, Play together, Me) and a first screen that starts from what a player left unfinished; the hosts of ADR 0042 are named as planes, and the game plane stays at isolation level L1 until a game the owner did not add arrives.
sidebar:
  order: 46
---

- **Status:** Accepted
- **Date:** 2026-10-22
- **Amends:** [ADR 0042](0042-hosts-by-trust-paths-by-component.md) — the namespace `/together` for the app; Cloudflare
  Access in front of `console.` (on since 2026-10-22). The public pages' redirect of a returning player
  ([Hosts and paths](../architecture/hosts-and-paths.md)) ends.
- **Refined:** 2026-10-23, after the launch review's surface round (plans/launch-review, F1): a public page opened from
  the app shows no link out of Tò He (below, *Ways across both directions* and the consequences), *Chơi ngay* is built in
  every header, and *Chơi tiếp* means the device has opened a game. Refined again 2026-10-24 by the owner's answers to
  E-07 ("chốt theo đề xuất"): updates also apply while the app is out of sight on a frame screen (below, *Updates
  wait*); the splash screen takes the brand colour; the turn-the-phone layer stays the answer to portrait games held
  sideways.
- **Decided by:** the owner, 2026-10-22, in the launch review (plans/launch-review D-02, D-04, D-05): "D-02 D-04 chọn
  B"; "đến mức L1 th bởi game sẽ do tôi thêm vào repo th, người khác thì sẽ được qua tin tường và review của tôi … nên nếu
  lên vấn đề này như 1 topic và nói tình hình hiện tại". Points the agent proposed are marked *(agent)*;
  the owner approved them on 2026-10-22 ("ổn nha, theo đề xuất") and turned Cloudflare Access on in front of
  `console.` the same day. **No redirect on `/`** waited for the owner's review of the full route map; the owner
  decided it later that day, going further: "triệt để bỏ đi, làm như mới, prod hiện chỉ có tôi dùng thôi" — no redirect
  on `/`, and the app's old paths from before ADR 0042 no longer answer `301` either.

## Context

On the players' host (`toheplay.io.vn`, ADR 0042) the public pages and the app grew apart:

- **Two front doors that do not meet.** `/` is the introduction. A browser that has played before is sent to `/play`
  before the page shows, so it never sees `/` again. The app has no way out to the guides, the FAQ or a game's page — only
  to the terms, from the consent box.
- **The app has no frame.** Its root route is an empty outlet; each page draws its own header; a bottom sheet holds four
  items (enter a code, my links, install, feedback). On a computer the app is one narrow column.
- **Two catalogs and two pages for one game**, with no stated role: `/games/` and `/games/<id>/` (static, indexed) and
  `/play` and `/play/<id>` (the app).
- **Playing together is scattered.** Tables are reached through each game. The API lists a profile's tables
  (`GET /api/rooms/mine`) but no screen shows them; invitations (`/api/rooms/invites`) show on the catalog, for profiles
  that sync with the server.
- **Coming back starts from zero.** The first screen is the catalog: no "continue", no "you are at a table". On a shared
  family device the last player stays active without asking. An account whose session ended falls back to the device's
  profile in silence.

On isolation: the games origin is `games.toheplay.io.vn`. Because `io.vn` is on the Public Suffix List, it is the
same *site* as the hub and the console, though a different *origin*. Origin isolation, `SameOriginGuard` (ADR 0011),
`__Host-` cookies and the games' CSP (ADR 0040) cover what being the same site leaves open, for games the owner adds to
this repository. Moving games to a second domain is cheap later — the games origin is configuration, and the API builds
each game's URL from it when it answers.

Nothing is launched, so the layout is cheapest to change now.

## Decision

### Planes

The hosts of ADR 0042 are named by what they trust:

| Plane | Host | Who | Trust |
| --- | --- | --- | --- |
| **Players** | `toheplay.io.vn` — two zones (below) and `/api` | players, parents | high: sessions, profiles, children's data |
| **Games** | `games.toheplay.io.vn` | game code | low: sandboxed, speaks only the Game Contract |
| **Operators** | `console.toheplay.io.vn` | operators | highest: its own session, a second factor, Cloudflare Access |
| **Developers** | `docs.toheplay.io.vn`; later `studio.` (reserved in ADR 0042) | people who make games | public, no session |
| **Edge** | `status.`, `notify.` | — | no code of Tò He's |

**The game plane's isolation ladder.**

| Level | What | Blocks | When |
| --- | --- | --- | --- |
| L1 — today | an origin of its own (`games.`) | reaching the hub's storage, cookies and pages; with `SameOriginGuard`, `__Host-` cookies and the games' CSP | games the owner adds to this repository |
| L2 | a registrable domain of its own | also SameSite, cookie tossing, a shared process and storage partition, a shared reputation | **before the first game the owner did not add** |
| L3 | a site per game (a domain of its own, on the Public Suffix List) | also one game reaching another | many outside authors |

The owner's review of a game includes changes to its dependencies (the supply chain is the real risk at L1). Asking
browsers to keep the games origin apart by origin rather than by site (`Origin-Agent-Cluster: ?1`) is left for later:
tried on 2026-10-22, the end-to-end test that opens the leaderboard from a game's title screen failed twice with the
header and passed without it, so it needs understanding first (the product backlog). Cloudflare
Access is in front of `console.` (the owner turned it on, 2026-10-22); the console's own sign-in still asks after it.

### Two zones on the players' host

| Zone | Paths | For | Indexed |
| --- | --- | --- | --- |
| **Discover** | `/`, `/games/`, `/games/<id>/`, `/guides/…`, `/faq/`, `/about/`, `/terms/`, `/privacy/`, and what [ADR 0047](0047-two-languages-and-an-introduction-surface-that-grows.md) adds | newcomers, parents | yes |
| **Play** | `/play` (Games), `/together` (Play together, **new**), `/account` (Me), `/play/<id>` (a game in play), `/play/<id>/rooms/…`, `/s/…`, `/r/…` | players | no |

- **One game, two URLs, two roles.** `/games/<id>/` is the game's page: indexed, with *Play* and *Play with a friend*
  at its top. `/play/<id>` is where it is played: full screen, not indexed. A game's tile in the static catalog leads to
  its page; in the app it starts the game.
- **`/` puts the catalog first** and the introduction after it.
- **No redirect on `/`** *(agent)*. A browser that has played before gets a *Continue* button at the top of the page
  (the same small script reads the same keys). A link to `/` always shows `/`; the installed app still opens `/play`.
- **Ways across both directions.** Every public page has *Play now* (and *Continue* when the device has opened a game);
  on a phone it stays in sight in the header. In the app, Me leads to *Help and about* (the guides, the FAQ, about) and
  *Papers* (the terms, the privacy notice). Links out of Tò He (the docs, GitHub, mail) appear only in Me and in the
  public pages' footer — and **a public page opened from the app shows no link out**: the app adds `?from=app`, and the
  page hides every link that leaves Tò He for that visit. A child who goes from Me to the FAQ has no way out of Tò He but
  the app's own, which the PIN guards.

### The app's frame

A layout route wraps every screen of the Play zone except a game in play.

- **Three labelled tabs**: **Trò chơi** (Games, `/play`), **Chơi cùng** (Play together, `/together`), **Tôi** (Me,
  `/account`) *(agent: the names)*. A bottom bar on narrow screens, a rail on the left from tablet width; content up to
  about 1200 px wide, the catalog in four to six columns. Forms (signing in, a new profile) stay narrow.
- A fourth tab comes only with a feature of its own (a shared board, friends), never to hold settings.
- **Games**: who is playing (avatar, name, *Change*) and a button for a code *(agent)* — the code box stays one tap from
  the first screen because an installed app on an iPhone cannot follow a link ([Entry links](../architecture/entry-links.md));
  the table the player sits at, if any; invitations to them; *Continue* — the game this profile opened last, one big
  tile; recent games; every game.
- **Play together**: the box for a table's or a link's code; the player's tables; invitations to them; the links they sent
  (the list stays at `/account/links`; Play together shows the newest and leads there).
- **Me**: profiles and who is playing; settings (language, theme, sound); install; help and about; feedback; papers; the
  account.
- **A game in play has no frame**: full screen as today ([ADR 0020](0020-a-game-has-a-menu-stage-and-a-play-stage.md)).
  Each level (the app, a table, a game) is an entry in the history, so Android's back steps one level.
- The bottom sheet goes; its items move: enter a code and my links to Play together, install and feedback to Me.
- **The app no longer locks the screen to portrait** *(agent)*. The hub neither rotates nor locks: a game draws itself for
  the screen it gets, fitting the orientation its manifest prefers inside it (the kit's scaling does), so a portrait game
  on a landscape tablet or computer shows with margins.
  **A portrait game on a phone held sideways** *(agent, launch review F2, 2026-10-23)*: the hub still does not lock the
  screen — it asks the player to turn the phone. When the game's `game.json` says `portrait`, the screen is a touch
  screen in landscape and under 500 px high, a calm layer covers the game ("Xoay dọc máy để chơi" · "Turn your phone
  upright to play", a drawing of a phone turning upright); the game keeps running underneath and the layer goes when the
  phone turns back. `any` and `landscape` games never get it, and a tablet or a computer (500 px and up, or a mouse)
  never does.
- **A child's profile of an account asks for the account's manage PIN** (six digits, [Identity](../architecture/identity.md))
  to follow a link out of Tò He *(agent)*. A device with only device profiles has no PIN, so nothing asks there.
- No streaks that punish, no countdowns, no guilt — the first screen shows what was left unfinished, neutrally.

### Coming back

- **Who is playing** on a shared device: with one profile, never asked; with several, one tap after a cold start that
  follows **30 minutes** unused *(agent: the time)*. Moving from an account's child profile to an adult's or to the account
  asks for the manage PIN; the other way does not.
- **Invitations** stay addressed to profiles with a public ID ([ADR 0033](0033-invite-a-profile-by-its-id.md)), so they reach
  an account's profiles; a device profile, which has none, joins by code or link *(agent)*.
- **An ended session says so** ("your session has ended — sign in again to play on your account") instead of falling
  back to the device's profile in silence.
- **Updates wait** *(agent; refined 2026-10-24)*: a new version takes over at the next cold start, or when the app goes
  out of sight (`visibilitychange` to hidden) while it shows a screen of the frame — never in a game, at a table or in a
  replay — so the player comes back to the same screen in the new version and never sees it happen; in a long session in
  sight, *A new version — Reload* shows on the frame's screens with a visible *Để sau* / *Later*. The router already
  reloads once if a screen's file is missing; this removes even that.
- **The splash screen** an installed app shows while it starts takes the brand colour (`background_color` in the
  manifest), in light and dark alike: Android draws it from the manifest before any page exists *(agent; 2026-10-24)*.
- **Links when installed**: `launch_handler` `focus-existing` where supported (Chromium); on iPhone, where a link opens
  Safari and not the installed app, entry pages say "Installed Tò He? Open it → Enter the code ABCD-EFGH".
- The installed app asks for persistent storage (`navigator.storage.persist()`); returning visits are counted as totals,
  never by whom (ADR 0015).
- **Not done here** *(agent)*: push notifications ("your turn") and the app badge — the product backlog
  (`docs/roadmap/product-backlog.md`).

## Consequences

- **The short landscape screen** *(agent)*: the frame takes the rail instead of the bar and a compact header below
  500 px of height (a height query, not only `md:`), so the catalog shows its games in the first screen; the kit's title
  screen fits the height it gets (two columns from 480 px wide), checked by conformance on six screen sizes; a portrait
  game asks to turn the phone (above). [Surfaces](../architecture/surfaces.md) and [Game shell](../architecture/game-shell.md)
  describe them.
- `@tohe/routes`: the namespace `/together` (the app's page), with the screen that uses it. Generated files regenerated.
- The hub: the layout route and the three tabs; Play together and Me as screens; the first screen; who is playing;
  the ended-session notice; the update policy (`registerType: 'prompt'`, the notice); `launch_handler`; persistent storage;
  the manifest without `orientation`; the PIN for links out; the history per level. e2e and the screenshots in light and
  dark follow.
- The public pages: the catalog first; *Continue* instead of the redirect; *Play now* on every page, in the header, with
  *Continue* in its place on a device that has opened a game (the hub writes `tohe:returning` where it notes "opened",
  not on every start; no compatibility for devices from before). A page opened with `?from=app` hides the links out of
  Tò He — marked `data-out`, hidden by a script file (the pages' CSP has no inline script) and kept for the visit in
  `sessionStorage` — and the docs link is in the footer, not in the home page's body. Every link into the app carries
  `?lang=` in the page's own language, Vietnamese included.
- Docs: [Surfaces](../architecture/surfaces.md) (new) describes the planes, the zones, the frame and coming back;
  [Hosts and paths](../architecture/hosts-and-paths.md) gains `/together`, the planes and the ladder;
  [Entry links](../architecture/entry-links.md) (the code box and the links in the frame, not in a menu),
  [Identity](../architecture/identity.md) (who is playing, the ended session) and [Telemetry](../architecture/telemetry.md)
  (returning visits) follow when the frame lands.
- ADR 0042's status line notes the amendment.
- Cloudflare Access in front of `console.` is in place (2026-10-22); [Admin console](../architecture/admin.md) already
  describes it.

## Alternatives considered

- **Bridges only**: menu links from the app to the public pages and nothing else. Cheap, but the app keeps no frame,
  the computer keeps one column, and playing together stays scattered.
- **The app is the website**: one React app prerendering every public page. One frame everywhere, but the public pages
  would load the app's code (slower, and they lose `connect-src 'none'`), Astro's simple static pages would be rewritten,
  and the gain over two zones is small.
- **Keep the redirect on `/`.** Google's spam policy seems to allow it (our reading: Googlebot keeps no storage, so it
  always gets the page), but a returning player could never read the introduction or the FAQ from a link to `/`.
- **Games on a second domain now (L2).** Cleaner, but a domain and a zone to keep for what L1 already covers while every
  game is the owner's; the move stays one configuration change for when it is needed.
- **The introduction pages or the games on the owner's other domain.** That domain hosts apps that are not Tò He's
  (ADR 0039), and the introduction must share the app's origin for *Continue*.
