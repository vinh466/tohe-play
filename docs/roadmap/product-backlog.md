---
title: Product backlog
description: Product ideas for Tò He outside the work in progress — each with its scope, value, effort, status and what it needs — to pick from one at a time.
sidebar:
  order: 4
---

Ideas to pick from, not commitments. The owner picks what comes next; games have their own list in the
[game backlog](game-backlog.md).

## How it is kept

- **One row per idea**, with an id that never changes (`PB-NN`).
- **Status:**
  - **idea:** worth doing, not decided.
  - **ready:** decided, can be picked up as it is.
  - **planned:** picked; the row names the plan or the pull request.
  - **done:** moved to [Done](#done) with its pull request.
  - **dropped:** moved to [Dropped](#dropped) with the reason.
- **Value:** what it brings players or the platform. **H** high, **M** medium, **L** low.
- **Effort:**
  - **S:** a day or two.
  - **M:** a few days.
  - **L:** a week or more, or a change to the Game Contract or the room model.
- **Needs** names what must happen before code: an ADR, a decision by the owner, or a condition that has to be true.
- Picking an item: its row becomes **planned** in the pull request that starts it. A large one gets an ADR, or a plan
  space, first. The pull request that finishes it moves the row to **Done**.

## Now

The product surfaces come first: the layout of the app and the public pages, the two languages, SEO and GEO. After them,
more games. Nothing below is picked yet.

## Play together

| ID | Idea | Value | Effort | Status | Needs |
| --- | --- | --- | --- | --- | --- |
| PB-01 | **Family table**: each account keeps one table with a code that never changes, to pin in a family's Zalo group, so grandparents always tap the same link. Today a room closes 30 minutes after everyone leaves ([ADR 0016](../decisions/0016-online-rooms-for-turn-based-games.md)) | H | M | idea | ADR: the room model (a kept code and settings, the room rebuilt in memory when someone comes) |
| PB-02 | **Seats in table invitations**: the preview of `/r/<code>` says "Tiến Lên · Bà's table · 1 seat left", and the link opens a one-button "Join" card | M | S | idea | — |
| PB-03 | **Shared screen**: a TV or tablet shows the Tiến Lên table and a QR code; each phone holds one player's hand; latecomers watch. A family around the TV at Tết | H | L | idea | ADR: a screen role and a controller role in the Game Contract |
| PB-04 | **Turn-based tables over days**: Tiến Lên or chess where each player moves when free, for families in different cities | H | L | idea | ADR: tables kept on the server instead of only in memory; PB-09 to tell a player it is their turn |
| PB-05 | **Result cards**: a "Thách bạn" link's preview shows the score to beat as an image | M | M | idea | Preview images made by the server |

## Family and engagement

Engagement here never means pressure: no streaks that punish, no countdowns, no guilt, no currency.

| ID | Idea | Value | Effort | Status | Needs |
| --- | --- | --- | --- | --- | --- |
| PB-06 | **Today's challenge**: one seed per game per day, the same for everyone; a card at the top of the games; its scores on the household's board that tables already have ([walking skeleton](walking-skeleton.md), M8); built on "Thách bạn" ([ADR 0045](../decisions/0045-games-declare-identity-and-entries.md)) | H | M | idea | ADR: a `daily` entry kind and a daily seed from the server |
| PB-07 | **Seasons and holidays**: a Tết look, a family tournament made from one link, a printable honour board — decoration only | M | M | idea | — |
| PB-08 | **Voluntary support**, in the way Lichess does it: supporters get a badge and nothing else | ? | S | idea | The owner's decision; the vision promises no purchases in the app — an ADR on the vision if yes |
| PB-09 | **"Your turn" notifications**: opt-in Web Push for tables, through the browser's own push service and nothing else | M | M | idea | PB-04; the player turns it on |
| PB-10 | **App badge** on the installed app's icon | L | S | idea | Notification permission (iOS) |

## Kids and safety

| ID | Idea | Value | Effort | Status | Needs |
| --- | --- | --- | --- | --- | --- |
| PB-11 | **Kids mode you can see**: a child's profile gets big icon-first tiles, reactions only at tables, no place on public leaderboards, and a small sign that it is a child's profile | M | S | idea | Check what public boards show of a child's profile today |

## Operators

| ID | Idea | Value | Effort | Status | Needs |
| --- | --- | --- | --- | --- | --- |
| PB-12 | **The console in English**: its words are written in Vietnamese in the code today; operators read English | M | S | ready | — |

## Platform and security

| ID | Idea | Value | Effort | Status | Needs |
| --- | --- | --- | --- | --- | --- |
| PB-13 | **`Origin-Agent-Cluster: ?1` on the games origin**, so browsers keep games apart by origin rather than by site | M | S | idea | Check browser support |
| PB-14 | **Games on a domain of their own, then a site per game** (isolation levels L2, L3). Today the games origin is `games.` of the hub's domain (L1), right for games the owner adds to this repository | — | M | idea | **Condition:** before the first game that the owner did not add; the owner then chooses L2 or L3 |
| PB-15 | **Sign in with Zalo** | M | M | idea | Zalo may not give an email address |
| PB-16 | **A service worker on the games origin**, so games not opened recently also play offline | M | M | idea | The spike in the [walking skeleton](walking-skeleton.md) |

## Operations and quality

| ID | Idea | Value | Effort | Status | Needs |
| --- | --- | --- | --- | --- | --- |
| PB-17 | **A test that deploys over an open app**: two builds, the page on the first, the second deployed, a game opened — no error screen. Written on 2026-10-22, when it found the risk was not real (the router reloads once); not committed yet | M | S | idea | Decide whether CI runs it |
| PB-18 | **Browser crashes and CSP reports** in telemetry, totals only ([ADR 0015](../decisions/0015-device-telemetry.md)) | M | M | idea | — |
| PB-19 | **UAT over HTTPS** (`uat.toheplay.io.vn`, [ADR 0042](../decisions/0042-hosts-by-trust-paths-by-component.md)) | L | M | idea | — |

## Done

| ID | Idea | Pull request |
| --- | --- | --- |

## Dropped

| ID | Idea | Why |
| --- | --- | --- |
