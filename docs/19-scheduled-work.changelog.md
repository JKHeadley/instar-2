# Changelog — `19-scheduled-work.md`

_Generated from `19-scheduled-work.changelog.json` by `scripts/render-changelog.mjs` — do not edit by hand._
The document itself reads as a first version; every change to it is recorded here, newest first,
each linked to the git change that made it (rule 91).

## Revision 4 · 2026-10-03 · draft — Unit w4-sessiondriver: long and scheduled work becomes a delegated harness session with its Rule 114 edge and honest bounds (plan rows #399/#401). No constitution change.

- **§5 gains the rule that long and scheduled work may run as a full delegated harness session, with its Rule 114 edge recorded before the child exists and exactly one close on every path out, and that the declared result file — non-empty, within its byte bound and unchanged across two reads one poll apart, with any leftover removed first — is the exit test rather than a per-harness idle-prompt classifier.** — The session driver existed but nothing called it, so no durable work item could run as a real session; and one real session harness keeps placeholder text on its prompt line throughout a turn, so a step whose completion depended on that classifier would run to its deadline with its work already finished on disk. _(src/assembly/production-session-work.ts; tests/assembly/production-session-work.test.ts; tests/e2e/session-work-live.test.ts; tests/preview/journal.ts (workObligations, session-work record); LIVE-PATH-PLAN.md rows #399, #401)_
- **§5 gains the rule that a session step is bounded by time, result size and a per-launch step ceiling, one step at a time under the launch's single stop authority, and that its recorded budget states its token bound as ABSENT because a subscription session reports no token meter — with a caller needing a token bound directed to a metered route.** — Rule 60's ceiling has to be stated in units that are actually observable here; recording an invented token budget would be a measured claim nobody can check. _(src/assembly/production-session-work.ts; tests/assembly/production-session-work.test.ts)_

## Revision 3 · 2026-10-03 · draft — Unit w4-toolsreal: the full-tool ruling's replacement text, adapted to the reuse route (Justin 2026-10-02 00:43, topic 102965 message 121912; desk decision 2026-10-01 17:49, message 121586). No constitution change.

- **§5 gains the rule that every delegated session, including one started inside a turn, has its Rule 114 run edge, that subprocesses stay owned by their enclosing execution, and that the preview's tool turn delegates nothing.** — Replaces the proposed in-turn subagent exemption the ruling rejected (MF6). _(lanes/astra-fulltool-ruling.md (replacement text); lanes/w4-toolsreuse-PROGRESS.md (proven configuration); lanes/w4-toolsreal-PROGRESS.md; LIVE-PATH-PLAN.md rows #358, #363, #367)_

## Revision 2 · 2026-09-28 · approved — Operator's standing direction in topic 52075 at 09:09 PDT 2026-09-28 ('For the 2.0 work the only thing I need to approve are changes to the constitution'): design parts need no separate operator approval; this part is approved as written.

- **Mark the design approved as written.** — Only changes to the constitution require the operator; design parts implement it and are approved on the operator's standing direction. _(topic-52075-2026-09-28T16:09Z)_

## Revision 1 · 2026-09-11 · draft — Initial design

- **Initial Part Fifteen design: scheduled and recurring work.** — Define how scheduled and recurring work is admitted and run. _(fafd73e1)_
