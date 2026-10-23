---
name: packet
description: Hand one piece of work to a worker — choose the worker and its effort, claim the paths it may change, open its worktree, write the work packet, spawn it, and check its diff before committing. Use whenever the master delegates a pull request, a chore, a search or a review, and to decide whether two pieces of work can run at the same time.
---

# Packet

The master's steps for one worker. The rules are in `docs/guides/working-with-agents.md`: "Agents and models",
"Choosing the effort" and "Claims: who changes what".

1. **Delegate or not.** Small work the master does itself. Delegate when it keeps the master's context small or runs
   beside other work. At most four workers at once.
2. **Choose the worker and its effort** from the table in "Choosing the effort". A `scout` (`low`) or a `reviewer`
   (`high`) changes nothing: it needs no worktree and no claims, so skip to step 5.
3. **Claim the paths** the work changes, as narrow as they go: the feature's directories, each doc page, each test
   file; the `package.json` and `pnpm-lock.yaml` for a dependency; each generated file it regenerates; `@dev-stack` when
   it runs the e2e suites or `docker compose`.
4. **Open the worktree:**
   ```sh
   git fetch origin
   git worktree add .claude/worktrees/<name> -b <branch> origin/main
   pnpm claims open .claude/worktrees/<name> <claim>...
   ```
   When `open` reports a touch, do not spawn: queue the work after the worktree it names, or split it so the claims do
   not touch. `pnpm claims status` lists every open worktree.
5. **Write the packet:** the goal; the decisions and docs it implements; scope in and out; the claims; done-when
   (tests, `pnpm verify`, docs); constraints; the worktree as an absolute path; the report to return.
6. **Spawn the worker by its name** (`builder`, `chore`, `scout`, `reviewer`), naming the model `opus` and the effort
   from step 2, without worktree isolation: the packet names the worktree. Run it in the background when another
   worker runs. If the name is unknown because the definitions changed after this session started, start a new
   session rather than spawning `general-purpose`, which has no hooks.
7. **When the report comes:**
   ```sh
   pnpm claims check .claude/worktrees/<name>
   ```
   Settle every finding first (widen the claims, move the change, merge `origin/main`, or wait for the other
   worktree). Then review the diff, re-run `pnpm verify` in the worktree, and commit. If the checks fail, the report
   goes back once with the errors; a builder that ran at `medium` is spawned again at `high`. After a second failure,
   finish the work yourself.
8. **Open the pull request.** Its description names each worker that ran, its effort, and the rounds it took.
9. **Close.** Merged work stops counting by itself. When the work is dropped, run
   `pnpm claims close .claude/worktrees/<name>`. Remove the worktree once its pull request is merged.
