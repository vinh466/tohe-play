# Plan spaces

A plan space is where the owner and an agent think a large change through — slowly, in writing, and without
touching the spec — until it is decided well enough that the spec can be written and built in one run. It is the
same method the owner uses in the `platform` repository.

**Why here and not under `docs/`:** `docs/` is the specification, and the site publishes every page under it
(including `llms.txt`, which agents read as the spec). A plan is *intent*, not spec, so it lives outside `docs/`.

**Use one when** the change crosses the hub, the API and the games, needs several decisions that depend on each
other, or reworks the foundation (identity, the contract, delivery). A single feature's design does not need one —
it goes straight to a doc change or an ADR.

## Active plans

| Plan | Goal | Phase | Entry point |
|---|---|---|---|
| public-launch | Tò He ready to open to the public: user-first accounts and profiles, email and OAuth sign-in, a platform admin, an integrity engine for trustworthy leaderboards, and its own Helm chart for production | Close (the rest moved to product-surface) | [PLAN.md](public-launch/PLAN.md) |
| product-surface | Phase 1 after production: the development, test and environment flow written as spec; every component's place on the domain; public pages people and AI can find; a newcomer plays in seconds and is led to install the app and sign up | Frame | [PLAN.md](product-surface/PLAN.md) |

## What a plan space is — and is not

- **Reference, never canonical.** It links out to code and docs; nothing in `docs/` links into it. If it and the
  spec disagree, the spec is what runs today — the plan is what we *intend*.
- **Independent.** Options are argued on their merits, not bent to fit the current spec. Where the plan wants an
  accepted decision changed, that becomes an item of the plan, not a silent edit elsewhere.
- **Not a backlog.** Only what the goal depends on gets an item. Problems found along the way that the goal does
  not need are noted in `log.md` and reported, not planned.
- **Written in the owner's working language** (Vietnamese, technical terms in English). The graduated spec follows
  the repository's language (English).

## Layout

```text
plans/<slug>/
  PLAN.md        entry point: phase, item board, Next, questions waiting on the owner   (≤ 100 lines)
  brief.md       the owner's intent: why, constraints, what "done" means, non-goals      (the owner confirms it)
  map.md         the dependency map: every item, what it blocks, in what order
  design.md      the target design as the items compose it — decides nothing, cites the item for each claim
  log.md         one dated entry per working session, newest first                      (append-only)
  items/         one file per item — D-NN (decision) or E-NN (enhancement)
  research/      R-NN notes: findings with sources, facts kept apart from assumptions
```

Copy [_template/](_template/) to start one, and add its row to *Active plans* above.

### Items: D and E

| Prefix | What it is |
|---|---|
| **E-NN** | **Enhancement** — a change to what already exists that the goal depends on |
| **D-NN** | **Decision** — a question about the new thing itself, with options |

Every item moves through `open` → `researching` → `proposed` → **`decided`** — or `deferred` (not now, with the
condition that reopens it) or `dropped` (not needed, with why). An item gets its own file when it leaves `open`.

- **Only the owner moves an item to `decided`, `deferred` or `dropped`.** The agent records the call — the owner's
  words, the date, where it was said — and never infers it from silence.
- `proposed` means the item file has options, a recommendation and what the recommendation costs.
- A decided item that a later finding contradicts goes back to `proposed`, with the finding linked.

## Phases

| Phase | Done when |
|---|---|
| 1. **Frame** | `brief.md` confirmed by the owner |
| 2. **Map** | every item the goal depends on is on `map.md`, with its edges; the owner agrees nothing is missing |
| 3. **Resolve** | every item is `decided`, `deferred` or `dropped`, worked in dependency order |
| 4. **Converge** | `PLAN.md` holds the graduation list: each ADR, doc change and pull request, in order, traced to items |
| 5. **Graduate** | the list is written into `docs/` by the normal workflow (spec first, ADRs); implementation follows |
| 6. **Close** | the work has landed; the folder is deleted in the last pull request — git keeps it |

Phases overlap: an item can be decided while the map still grows, and a track whose items are all decided may
graduate before the rest. `PLAN.md` names the phase of the plan as a whole.

## A working session

1. **Start** at `PLAN.md` → **Next**. Read the newest `log.md` entry.
2. **Work** the item: facts from the code (paths, line numbers), research into `research/`, options with honest
   costs. Disagreements go in the item's *Discussion*, dated and signed (`**owner**` / `**agent**`).
3. **End**: update the item, the board, **Next** and *Waiting on the owner*, add a `log.md` entry, commit.

When an answer reshapes the plan, record it in the owner's words where it belongs, re-align every item it touches
in the same session (an item whose basis changed moves back a status), research what it opened up, and log it.

## Git

A plan lives on one long-lived branch, `plan/<slug>`, with a draft pull request as its container. It touches only
`plans/` (and the one row in `AGENTS.md` / the repository layout that points here), so merging it is safe at any
point; work continues on the same branch afterwards. Graduation happens on ordinary feature branches.
