# Changelog — `21-the-recall-doorway.md`

_Generated from `21-the-recall-doorway.changelog.json` by `scripts/render-changelog.mjs` — do not edit by hand._
The document itself reads as a first version; every change to it is recorded here, newest first,
each linked to the git change that made it (rule 91).

## Revision 6 · 2026-10-03 · draft — Unit review of w4-memlearn-s round 1 (Astra, VERDICT: NO): two must-fixes repaired at source. No constitution change.

- **Section 16 offers the memoryFailure report after any answer to the operator, including a full-history one, as the packet's lowest-priority guidance that yields first under byte pressure; section 12 P21-NF-25 and section 13 P21-NEG-32 follow.** — A full-history "I don't know" states no wrong value, so the correction signal could not cover it and the operator's reminder was silently lost (Purpose constraint 2, Rule 85). _(lanes/w4-memlearn-s-PROGRESS.md (Pipeline repair); tests/preview/memory-learning.test.ts)_
- **The never-stored cause is replaced by source unresolved: when the report names no original and no earlier operator message states its words exactly, the record says whether the fact was stored is unknown; P21-NF-26 follows.** — A wording miss is not evidence of absence (Rules 11 and 26); a paraphrased reminder was misreported as proof the fact was never stored. _(lanes/w4-memlearn-s-PROGRESS.md (Pipeline repair); tests/preview/memory-learning.ts)_

## Revision 5 · 2026-10-03 · draft — Unit w4-memlearn-s (plan row #404): memory-failure recording and structural self-improvement, on the operator's direction of 2026-09-13 and the 2026-10-03 re-grounding (Justin, topic 102965, message 121996 and the 10:45 pillars). No constitution change.

- **New section 16, memory failures and the learning loop: a failure is recorded from two model-judged signals (an operator correction naming the agent's restating reply; a structurally offered memoryFailure report after an answer given without part of memory verbatim), with the question, the returned reply, the truth and a cause read from the failed turn's recorded grounding; a projection over durable rows, with no new store.** — The re-grounding (plan rows #399 and #404) named memory-failure recording as missing: a forgotten fact left no record, so nothing could learn from it. _(lanes/w4-memlearn-s-PROGRESS.md; LIVE-PATH-PLAN.md row #404; tests/preview/memory-learning.test.ts)_
- **Section 16 also states the learning loop inside the one recall owner: a retrieval hint adds the missed question's words to the source's meaning cues; a source that fails twice is pinned into recall; a forgotten or corrected source teaches nothing; the status reply and status record show the counts.** — A log line changes nothing; the lesson has to change what the next recall returns, measurably and within bounds. _(lanes/w4-memlearn-s-PROGRESS.md; tests/preview/memory-learning.ts)_
- **Section 12 gains P21-NF-25 to P21-NF-27 (executable), section 13 gains P21-NEG-31 to P21-NEG-33, and the index lists section 16.** — Every new rule names executable checks with a positive neighbor (Rule 69). _(lanes/w4-memlearn-s-PROGRESS.md)_

## Revision 4 · 2026-09-28 · approved — Operator's standing direction in topic 52075 at 09:09 PDT 2026-09-28 ('For the 2.0 work the only thing I need to approve are changes to the constitution'): design parts need no separate operator approval; this part is approved as written.

- **Mark the design approved as written.** — Only changes to the constitution require the operator; design parts implement it and are approved on the operator's standing direction. _(topic-52075-2026-09-28T16:09Z)_

## Revision 3 · 2026-09-13 · approved — operator review on PR #68; Independent rereview11 of b579d0b928a618e73ce10e1529f45d691400e32e; repair round 11, RD-01 through RD-04

- **Copy the row-100 Seven execution/rerun-admission grant, add it to U30, and label every dependent acceptance positive non-executable until it lands.** — RD-01: row 30 support resolution does not grant benchmark execution or rerun admission; recall must not implement the missing owner operation. _(rereview11 RD-01; SEAM-LEDGER row 100; seam-response-judgment-benchmark-execution.md)_
- **Retain IntegrationGate with the scheduled owner; inventory its separate auto-blockers file and actual completion consumer; add the learning/hold/release migration fixture.** — RD-02: reader replacement and restart must preserve successful learning, failed/no-learning holds and bounded timeout/bypass semantics through the real scheduler. _(rereview11 RD-02; docs/19-scheduled-work/05-execution-gates-and-supervision.md; P21-REG-INTEGRATION-GATE)_
- **Move all six decision Basis entries into the closing Rule block.** — RD-03: operator decision bodies must stay readable on a phone without technical citations. _(rereview11 RD-03; docs/21-the-recall-doorway/15-operator-decisions-and-honest-limits.md)_
- **Explain everyday actions and extra-check permission, recommend the all-listed-actions option for isolated trials, and explicitly defer the live policy choice with matching status references.** — RD-04: a trial recommendation and constitutional classification do not answer or authorize the pending live before/after-review choice. _(rereview11 RD-04; OD-05; sections 8/12/14/15)_

Approved in: PR #68, merge `abf65fedd`.

## Revision 2 · 2026-09-13 · draft — operator review on PR #68; Independent rereview10 of 50f17eb5; repair round 10, RD-01 through RD-04

- **Inherit consequential classification solely from the purpose and name history-review candidates separately, including selector and boundary fixtures.** — RD-01: policy selection for extra review must not narrow constitutional classification. _(rereview10 RD-01 at 50f17eb5; PR #68)_
- **Separate agent-owned experimental settings from constitutional decisions and provide plain-language recommendations with separate Basis lines.** — RD-02/RD-03: constitutional bounds do not uniquely choose trial settings; operator text must stand alone on a phone. _(rereview10 RD-02/RD-03 at 50f17eb5; PR #68)_
- **Define meaning-based search index and split NF-17 into ten named subcases with updated references and intact dependencies.** — RD-04: explain terms at first use and make independent regression obligations separately readable. _(rereview10 RD-04 at 50f17eb5; PR #68)_

## Revision 1 · 2026-09-13 · draft — Operator confirmation, topic 52075, 2026-09-13 23:26Z; repair round 9 on PR #68

- **Derive all six section-15 decisions from the constitution and name the agent-owned tuning and follow-on judgment-of-use design.** — The amended purpose requires a deciding purpose statement, pillar or constraint for every listed question. Only the consequential-effect definition in PR #71 awaits operator approval; execution and spend gates remain in force. _(PR #68; purpose amendment PR #69; candidate purpose revision 3, PR #71; operator confirmation in topic 52075 at 2026-09-13 23:26Z)_
- **Update open-decision cross-references and allow the three precise constitutional-version references in the governed-document checker.** — Decision status must agree across the design; a reference to the governing authority is current content, not document history. Existing Rule/Value labels and check references are preserved. _(docs/00-the-purpose.md: a design question this document cannot decide is a gap in this document; rule 91)_
- **Give the round-seven scheduled-work integration proof a 15-second test timeout, matching round eight.** — The required npm test run completed 1,403 passing tests but the ten-scenario owner-port proof exceeded the implicit five-second default. The test checks owner boundaries, not latency; all assertions and a finite timeout remain intact. _(tests/integration/scheduled-round7.test.ts; tests/integration/scheduled-round8.test.ts; repair-round-9 npm test evidence)_
