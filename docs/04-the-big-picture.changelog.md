# Changelog — `04-the-big-picture.md`

_Generated from `04-the-big-picture.changelog.json` by `scripts/render-changelog.mjs` — do not edit by hand._
The document itself reads as a first version; every change to it is recorded here, newest first,
each linked to the git change that made it (rule 91).

## Revision 2 · 2026-09-01 · approved — operator review on PR #12; operator's first review: make fractal self-hosting, recursive session composition, the native harness, Grok Build, and scoped degradation explicit

- **Self-hosting and local evolution made architectural: every development tool ships as a capability, each agent can build and preserve local capability packages, and the observe-change-verify-graduate loop repeats fractally at platform, agent, feature, and run-group scale.** — Rule 2 existed, but the first draft did not show how an individual agent remains able to evolve without waiting for the official source. _(PR #12 review comment 3910394463)_
- **Durable work changed from an implicitly flat set of runs to a recursively composable run graph supporting conversation-session → orchestrator → specialist-group topologies, capability-aware placement, and other topologies chosen by the work.** — Session-to-session delegation is a powerful first-class operating pattern and cannot remain an implementation accident. _(PR #12 review comment 3910436663)_
- **Instar Native added as a required first-party, provider-independent reference harness; Grok Build added by its verified official harness name.** — The system must prove harness independence through its own unprivileged reference client and include the current external harness set accurately. _(PR #12 review comment 3910573910; https://docs.x.ai/build/overview)_
- **Startup and failure handling changed from an easily read global integrity gate to scoped admission and degradation: a minimal communication/repair plane, per-family gates, quarantine, safe last-known-good reads, and fault-matrix proof that non-minimal failures cannot make the whole agent unusable.** — Integrity checks must increase reliability rather than repeatedly shutting down the system they protect. _(PR #12 review comment 3910616904)_
- **A protocol-independent agent-transport port added to the recursive run graph; Threadline named as its reference adapter; delegation envelopes, durable run-to-thread mapping, local/remote parity, and authoritative delivery states fixed while concrete Threadline protocol choices remain deferred to its part design.** — Cross-agent delegation must be designed before the work engine can assume every child is local, while Threadline itself must remain a replaceable adapter rather than enter the constitutional core. _(operator Threadline follow-up in topic 52075)_

Approved in: PR #12, merge `0d525aef0`.

## Revision 1 · 2026-09-01 · draft — first draft: the small-core architecture that the approved rules, register, and glossary imply

- **First version.** — The repository plan requires the big-picture design after the rules foundation and before any part design or code. _(README.md; docs/01-the-rules.md; docs/02-the-register.md; docs/03-the-glossary.md)_
