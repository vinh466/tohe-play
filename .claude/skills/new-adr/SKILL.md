---
name: new-adr
description: Record an architecture decision in docs/decisions with the next free number. Use when a choice is expensive to reverse — contract changes, new technology, new service or origin, data ownership, security boundaries.
---

# New ADR

1. List `docs/decisions/` and take the next free four-digit number.
2. Copy `docs/decisions/0000-template.md` to `docs/decisions/NNNN-short-kebab-title.md`.
3. Fill it in: title `"NNNN: Decision in the imperative"`, `sidebar.order: NNNN` (as a number), status `Proposed`
   unless the user already decided, today's date, context (facts and constraints), decision (including what is
   explicitly not done), consequences (checks, docs, follow-ups), alternatives with the reason each lost.
4. Add a row to the table in `docs/decisions/index.md`.
5. If it supersedes an ADR, set the old one's status to `Superseded by NNNN` — change nothing else in it.
6. Update every doc page the decision affects, in the same change.
7. Build the site (`pnpm --filter @tohe/site build`) so the link check runs.
