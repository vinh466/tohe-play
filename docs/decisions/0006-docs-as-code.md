---
title: "0006: Docs as code, rendered by Starlight, written for humans and agents"
description: docs/ in the repository is the specification; the site renders it; AGENTS.md points to it.
sidebar:
  order: 6
---

- **Status:** Accepted
- **Date:** 2026-10-13

## Context

Most changes will be made by AI agents across many sessions. Intent ("why is it like this?") is lost between
sessions unless it is written where the agent will read it. The owner also wants a readable developer site.

## Decision

- `docs/` at the repository root is the **only** specification. Pages are Markdown with Starlight frontmatter and
  link to each other with relative `.md` paths (readable on GitHub and in editors).
- `apps/docs` (Astro + Starlight) renders `docs/` at the root of the docs host, rewrites relative links to routes, validates
  every link at build time, renders Mermaid diagrams, generates the API reference from the committed OpenAPI
  document, and publishes `llms.txt` for agents.
- Docs are in **English**; the public pages and the games' UI are in Vietnamese.
- `AGENTS.md` (with `CLAUDE.md` importing it) is short and points to
  [Working with agents](../guides/working-with-agents.md). Repeatable workflows are agent skills in
  `.claude/skills/`.
- Decisions are ADRs; behaviour changes update the docs in the same PR.

## Consequences

- A docs build failure (broken link) blocks the PR, which keeps the docs navigable.
- Agents get the same information as humans, in the same place.
- The SDK reference is written by hand while the SDK is small; TypeDoc can be added later (it needs TypeScript ≤ 6).

## Alternatives considered

- **Docs inside `apps/site/src/content`:** hides the spec from agents that browse the repository root.
- **A wiki (Outline):** good for notes, but drifts from code and is invisible to agents working in the repo.
