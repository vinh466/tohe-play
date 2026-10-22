---
title: Surfaces
description: What players and newcomers see of Tò He and how it is laid out — the planes, the two zones of the players' host, the app's frame, coming back, the two languages, and an introduction surface that grows from one source per game.
---

Decisions: [ADR 0046](../decisions/0046-player-surfaces-two-zones-one-frame.md) (the planes, the zones, the frame,
coming back) and [ADR 0047](../decisions/0047-two-languages-and-an-introduction-surface-that-grows.md) (the languages,
the introduction surface). Hosts and namespaces: [Hosts and paths](hosts-and-paths.md). The target is described here;
*Where things stand* says what runs today.

## Planes

```mermaid
flowchart LR
  subgraph P["Players — toheplay.io.vn"]
    D["Discover<br/>static, indexed, vi + /en/"]
    A["Play<br/>the app, not indexed"]
    API["/api"]
  end
  G["Games — games.<br/>sandboxed, level L1"]
  O["Operators — console.<br/>own session, Access"]
  V["Developers — docs.<br/>(later studio.)"]
  E["Edge — status., notify."]
  A -- "iframe, Game Contract" --> G
  A --> API
  O --> API
```

| Plane | Trust | Rule |
| --- | --- | --- |
| Players | high: sessions, profiles, children's data | no third-party script; a CSP per namespace |
| Games | low | sandboxed iframe, an origin of its own, the games' CSP; speaks only the Game Contract |
| Operators | highest | Cloudflare Access in front (on since 2026-10-22), then its own session and second factor |
| Developers | public | no session |
| Edge | — | no code of Tò He's |

**The game plane's isolation.** Today **L1**: an origin of its own. Every game is added to this repository by the owner,
whose review covers the game's dependencies too. **Before the first game the owner did not add**, the owner chooses
**L2** (a registrable domain of its own) or **L3** (a site per game). The games origin is configuration, so L2 is a
change of configuration and DNS; L3 also needs a URL per game from the API, the hub's CSP to allow each game's host, and a
games host that serves many names. Keeping the games origin apart by origin (`Origin-Agent-Cluster: ?1`) waits: it broke
an end-to-end test when tried (2026-10-22).

## The players' host: two zones

| Zone | Paths | Indexed |
| --- | --- | --- |
| **Discover** | `/`, `/games/`, `/games/<id>/`, `/games/c/<slug>/`, `/guides/…`, `/faq/`, `/about/`, `/promise/`, `/terms/`, `/privacy/`, and each under `/en/` | yes |
| **Play** | `/play`, `/together`, `/account/…`, `/play/<id>/…`, `/s/<code>`, `/r/<code>` | no |

```mermaid
flowchart LR
  search[Google, Bing, AI answers] --> home & gp
  pwa[The installed app] --> games
  link["/s/… · /r/… from Zalo, Messenger"] --> playg
  subgraph K[Discover]
    home["/ — catalog first"]
    gp["/games/&lt;id&gt;/ — the game's page"]
    help["/guides · /faq · /about · /promise"]
    legal["/terms · /privacy"]
  end
  subgraph C[Play]
    games["/play — Games"]
    together["/together — Play together"]
    me["/account — Me"]
    playg["/play/&lt;id&gt; — in play"]
  end
  home -- "Play now · Continue" --> games
  gp -- Play --> playg
  games --> playg
  together --> playg
  me -- "Help and about" --> help
  me -- Papers --> legal
```

- **A game's two URLs**: `/games/<id>/` is its page (indexed, *Play* and *Play with a friend* at the top);
  `/play/<id>` is where it is played (full screen, not indexed).
- **`/` never redirects.** A device that has played gets *Continue* at the top of the page; the installed app opens
  `/play`.

## The app's frame

| | Narrow screens | From tablet width |
| --- | --- | --- |
| Navigation | a bottom bar: **Trò chơi · Chơi cùng · Tôi** | a rail on the left, the same three tabs |
| Content | one column | up to about 1200 px; the catalog in four to six columns |
| A game in play | no frame, full screen | the same |

| Tab | Path | From the top |
| --- | --- | --- |
| **Trò chơi** — Games | `/play` | who is playing (*Change*) and a button for a code → the table the player sits at → invitations → *Continue* (the game this profile opened last) → recent → every game |
| **Chơi cùng** — Play together | `/together` | the box for a code → the player's tables → invitations → the links they sent (the full list stays at `/account/links`) |
| **Tôi** — Me | `/account` | profiles and who is playing → settings (language, theme, sound) → install → help and about → feedback → papers → the account |

- Each level — the app, a table, a game — is an entry in the history, so Android's back steps one level.
- The app's manifest locks no orientation; each game declares its own.
- On an account's child profile, a link out of Tò He asks for the account's manage PIN ([Identity](identity.md)); a device
  with only device profiles has no PIN.
- The hub neither rotates nor locks the screen: a game fits the orientation it prefers inside the screen it gets.
- Nothing presses a child to keep playing: no punishing streaks, no countdowns, no guilt.

**How the hub does it** (`apps/hub/src/frame/`):

- A layout route (`_frame` in `router.tsx`) holds `/play`, `/together` and every `/account/…` screen; a game
  (`/play/<id>`), its lobby, a table, a replay and the links into them (`/r/…`, `/s/…`) are outside it, full screen.
  `/account/links` is Chơi cùng's. Forms (signing in, signing up, a new profile) stay one narrow column inside it.
- Each tab's screen starts with the tab's name and the player's avatar and name, which open the profile picker. The bar
  sits above the phone's home indicator (`env(safe-area-inset-bottom)`) and steps aside while a field that brings up the
  keyboard has the focus. The rail comes before the screen in the document and the bar after it, so the focus follows
  what is seen; the tab of the screen shown carries `aria-current="page"`.
- **History**: a tab takes the place of the screen in the history (the app is one level); a game, a table or a screen
  under a tab is a new entry. The app opened straight at a game, a table or a link into one, with nothing of the app
  behind it, first puts `/play` behind it, so Back from the game reaches the app before it leaves Tò He.
- **Tôi** is `/account`; Quản lý tài khoản, behind the parent gate, is `/account?manage=true` — and what returns there:
  `?add=true` (a new profile), `?linked=` and `?link_error=` (a provider linked, the API's `HubPaths.Account`).
  Help and about and the papers are full navigations to the public pages, in the app's language where the page exists
  in it. Feedback (`mailto:`) is the only link out of Tò He today.

## Coming back

| Moment | What happens |
| --- | --- |
| Opening the app | the frame's first screen starts from what was left unfinished (above) |
| A shared device | with several profiles, "who is playing?" — one tap — after a cold start that follows 30 minutes unused; an account's child profile → an adult's asks for the manage PIN |
| The account's session ended | the app says so and offers to sign in; it does not fall back to the device's profile in silence |
| A new version | waits for the next cold start; in a long session, *A new version — Reload* on the frame's screens, never during a game, at a table or in a replay |
| A link while installed | `launch_handler` `focus-existing` where supported; on iPhone, entry pages say how to open the app and enter the code |
| Storage | the installed app asks for persistent storage |
| Counting | returning visits counted as totals only ([Telemetry](telemetry.md)) |

## Languages

| Part | Vietnamese | English |
| --- | --- | --- |
| Public pages | `/…` | `/en/…`; `x-default` → `/en/` |
| The app | a setting (Me → Language), shared with the public pages' switch; without one: the public page the player came from, then the browser (`vi` → Vietnamese, else English), then Vietnamese | the same |
| Link previews | the language of the link's maker, or of the table's host | the same |
| Terms and privacy | the original | a translation; where they differ, the version more favourable to the user applies |
| Console, developer docs | — | English only |

- `hreflang` lives in `sitemap.xml` only, which `@tohe/routes` generates. Each page has its `lang`, `og:locale` and
  alternate, and a canonical link to itself.
- The VI | EN switch leads to the same page; a non-Vietnamese browser gets a suggestion, never a redirect.
- Proper names and established terms stay in English inside the Vietnamese interface. A game's `name` is its standard
  name; a name and a description per language (`names`, `descriptions`) are optional and shown in the reader's language
  when present ([ADR 0048](../decisions/0048-a-standard-name-and-words-per-language-for-each-game.md)).

**What the public pages hand to the app** — two things, both read by the app when it starts
(`apps/hub/src/language/language.ts`):

| | What | Written by |
| --- | --- | --- |
| The remembered choice | `localStorage` key **`tohe:language`** on the players' origin, `vi` or `en`. Written when a reader uses the VI \| EN switch, follows the suggestion (`en`) or turns it down with *Stay in Vietnamese* (`vi`); a Vietnamese page shows the suggestion when the key says `en`, or when there is no key and the browser's first language is not `vi*`, and not when it says `vi` | `apps/web/src/scripts/language.ts` |
| The page's language | **`?lang=en`** on every link from an English page into the app (`/play`, `/play/<id>`), and on the redirect of a returning device from `/en/` to `/play`; a Vietnamese page's links carry nothing, Vietnamese being the default | `appPath` in `apps/web/src/i18n.ts`, `returning.js` |

The app's order stays as above: its own setting, which a choice on the public pages' switch fills in (the key), then
the page the player came from (`?lang=`), then the browser, then Vietnamese. Tôi → Ngôn ngữ writes the same key, and
the app changes language at once, without a reload; its links to the public pages follow it.

## The introduction surface

```mermaid
flowchart LR
  src["games/&lt;id&gt;/page/vi.md + en.md + facts.json<br/>games/&lt;id&gt;/public/game.json"] --> build[The public pages' build]
  build --> pages["/games/&lt;id&gt;/ and /en/games/&lt;id&gt;/"]
  build --> meta["JSON-LD · a preview picture per game and language"]
  src --> routes["@tohe/routes: sitemap + hreflang"]
  build --> check["the build check: anything missing fails the build"]
```

| Page | Holds | Structured data |
| --- | --- | --- |
| Home | the catalog first; "Game nhỏ cho cả nhà · Không quảng cáo · Không cần tài khoản · Chơi ngay"; *Continue*; a date | `WebSite`, `Organization`, `ItemList` |
| A game's page | *Play*, *Play with a friend*; the answer; **the facts table** (ages, players, round length, ads: none, data collected: none); how to play; pictures; related games; a date | `VideoGame`, `BreadcrumbList` |
| The promise | no ads, no tracking, no purchases, no coins | `WebPage` |
| A collection (from ~8 games) | a written introduction and a comparison table | `CollectionPage`, `ItemList`, `BreadcrumbList` |
| A page for a search (≥ 3 fitting games) | written text that answers the search | `Article`, `ItemList` |

**Adding a game** brings its public page: `/new-game` writes `games/<id>/page/vi.md`, `en.md` (with an `updated` date)
and `facts.json` (facts the manifest does not hold, such as how long a round lasts); the rest comes from `game.json`;
the build makes the pages and their pictures (`/games/<id>/og.png`, made at build time) and fails if anything is
missing.

**Crawlers.** `robots.txt` keeps the content signals (`search=yes, ai-input=yes, ai-train=no`), allows by name the
crawlers that fetch for search and answers (Googlebot, Bingbot, `OAI-SearchBot`, `Claude-SearchBot`, `PerplexityBot`,
Applebot, Cốc Cốc's) in a group that repeats every crawler's rules, and disallows everything to those only for training
(`GPTBot`, `ClaudeBot`, `CCBot`, and the tokens `Google-Extended`, `Applebot-Extended`).

**Growth**: about 8 games, collections; about 30, a static search and a paginated list; about 100, a sitemap per
language and IndexNow.

## Where things stand

| Part | Today | In place when |
| --- | --- | --- |
| Planes, L1, the escalation rule | L1 in place; Cloudflare Access on `console.` | — |
| Crawlers by name in `robots.txt` | in place | — |
| Namespaces `/together`, `/promise/` | `/together` in place (Chơi cùng); `/promise/` arrives with its page (Tôi links to it already) | the introduction surface's pull request |
| Public pages in two languages | in place: Vietnamese at `/…`, English at `/en/…`, `hreflang` in the sitemap, the VI \| EN switch and the suggestion, the choice kept under `tohe:language`, `?lang=en` into the app (which reads both); the terms and the privacy notice Vietnamese-only (`vietnameseOnlyPages` in `@tohe/routes`) | the public pages' languages pull request |
| Game names per language | in place: a standard `name` with `names` and `descriptions` per language (ADR 0048); the hub shows its language's, the console the standard name, link previews the Vietnamese, each public page its own language's | — |
| One source per game, a picture per game, the facts table, the catalog-first home, the promise, *Continue* instead of the redirect | how-to in `apps/web/src/content/games.ts`, in both languages; one picture; `/` redirects a returning device | the introduction surface's pull request |
| The app's frame and tabs, the language setting | in place: the bar and the rail, the three tabs (Trò chơi without the table the player sits at, *Continue* and recent yet — the coming-back pull request), Chơi cùng, Tôi with the language, theme and sound, the history per level, no orientation lock, the manage PIN before a link out on a child's profile; the bottom-sheet menu gone | — |
| Coming back | the catalog first; no "who is playing"; silent fallback; updates take over at once | the coming-back pull request |
| Link previews in the maker's language | Vietnamese only | the link languages' pull request |
| The terms and the privacy notice in English, the clause parity test | Vietnamese only | before the launch |
| The console in English | Vietnamese words in its code | an item of the product backlog |
