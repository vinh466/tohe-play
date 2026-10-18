---
title: "0022: Send transactional email through an outbox and an SMTP relay"
description: Messages are written in the transaction that causes them and sent by a background worker through SMTP — Mailpit locally, Resend on UAT and production; bodies are erased once delivered.
sidebar:
  order: 22
---

- **Status:** Accepted
- **Date:** 2026-10-18

## Context

Tò He is opening to the public with email as the account identifier: signing up, resetting a password, changing the
address, linking a sign-in method and stepping up all send a one-time code or a security notice. The API sends no
email today. Codes are short-lived (minutes), so mail has to leave quickly; it must never leave for a change that was
rolled back, nor be lost for one that was saved. Codes are secrets while they live. ADR 0008 asks for an ADR for a new
service, and this adds one: an email relay.

## Decision

- **Outbox.** A module adds an `EmailMessage` to the `email.outbox` table through `IEmailOutbox`, in the same unit of
  work as the change it reports; nothing is sent unless that transaction commits. A background worker
  (`EmailDelivery`, every `Email:PollInterval`, 3 s by default) hands due messages to the relay — one API instance
  (ADR 0016), so no locking.
- **Retries.** A refused message waits 1 min, 5 min, 15 min, 1 h, then 6 h between tries, and is given up after
  `Email:MaxAttempts` (6). Delivery is at least once: a message the relay took just before the API stopped goes again.
- **Nothing secret stays.** Once sent or given up, the subject and both bodies are erased; the envelope (kind,
  recipient, times, last error) stays for `Email:Retention` (30 days) and is then deleted. Logs never carry a
  recipient or a body.
- **SMTP, through MailKit.** One protocol for every environment and provider: **Mailpit** in the local stack (web UI
  on port 4760), **Resend** on UAT and production — the relay the `platform` services already use, on 587 with
  STARTTLS. The sender is `Tò He <no-reply@…>` (the domain is a deployment setting). MailKit rather than
  `System.Net.Mail.SmtpClient`, which Microsoft does not recommend for new development.
- **One look.** `EmailLayout` renders every message: Vietnamese, a heading, short paragraphs, an optional code set
  apart, a "do not reply" footer; plain text and HTML; no images, no tracking, no links that are not the point.
- **Off is a state.** `Email:Mode=Disabled` (the default) sends nothing, and `IEmailOutbox.Enabled` tells features that
  need email to stay unavailable — adding a message then is a programming error and throws. `Email:Mode=Smtp` with an
  incomplete configuration stops the API at start-up, naming what is missing.

Not done: marketing or digest mail, bounce and complaint handling, a provider's HTTP API.

## Consequences

- New dependency MailKit (with its MimeKit). Its transitive `System.Security.Cryptography.Pkcs` 10.0.0 has published
  advisories; the API pins the patched 10.0.13 directly.
- Configuration: `Email:*` ([Configuration](../guides/configuration.md)). The local stack gains a `mailpit` service;
  UAT reads the relay's settings from `uat.env` and stays off until they are there ([UAT](../guides/uat.md)); the Helm
  chart gains an SMTP block once it lands.
- A code reaches the relay within a few seconds of being asked for; the poll interval bounds it.
- Whether production shares the platform's Resend account depends on its plan: the free plan's 100 emails a day are
  shared by everything on the account.

## Alternatives considered

- **Send inside the request:** the person waits on the relay, a relay hiccup loses the code, and a rolled-back
  transaction can still have sent one.
- **A queue (Redis, a broker):** another moving part for a handful of messages an hour; the database is already
  transactional with the change being reported.
- **The provider's HTTP API:** slightly richer, but ties the code to one provider and needs a fake locally; SMTP works
  the same against Mailpit and Resend.
