# Changelog — `21-the-recall-doorway.md`

_Generated from `21-the-recall-doorway.changelog.json` by `scripts/render-changelog.mjs` — do not edit by hand._
The document itself reads as a first version; every change to it is recorded here, newest first,
each linked to the git change that made it (rule 91).

## Revision 1 · 2026-09-13 · draft — Operator confirmation, topic 52075, 2026-09-13 23:26Z; repair round 9 on PR #68

- **Derive all six section-15 decisions from the constitution and name the agent-owned tuning and follow-on judgment-of-use design.** — The amended purpose requires a deciding purpose statement, pillar or constraint for every listed question. Only the consequential-effect definition in PR #71 awaits operator approval; execution and spend gates remain in force. _(PR #68; purpose amendment PR #69; candidate purpose revision 3, PR #71; operator confirmation in topic 52075 at 2026-09-13 23:26Z)_
- **Update open-decision cross-references and allow the three precise constitutional-version references in the governed-document checker.** — Decision status must agree across the design; a reference to the governing authority is current content, not document history. Existing Rule/Value labels and check references are preserved. _(docs/00-the-purpose.md: a design question this document cannot decide is a gap in this document; rule 91)_
- **Give the round-seven scheduled-work integration proof a 15-second test timeout, matching round eight.** — The required npm test run completed 1,403 passing tests but the ten-scenario owner-port proof exceeded the implicit five-second default. The test checks owner boundaries, not latency; all assertions and a finite timeout remain intact. _(tests/integration/scheduled-round7.test.ts; tests/integration/scheduled-round8.test.ts; repair-round-9 npm test evidence)_
