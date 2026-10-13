# Change review — Integrate reviewed transient cancellation recovery

Subject base: 0de16e3cdaea380ac746793123a51382aeb9830b
Review state: open
Reviewed content: none
Outcome: Integrate reviewed unit 2caeef9e6a1f91cff2e169bba6226c9ee1b73da0 onto live train-18 0de16e3c unchanged, then replay its register. Transient unreadable authority no longer immediately kills an admitted answer; complete read-only cancellation evidence permits one separately reserved replacement with durable recovery ownership.
Affected rules: 1, 4, 8, 26, 37, 41, 49, 55, 60, 66, 69, 70, 74, 75, 83, 90, 95, 101, 102, 111, 113, 116; purpose constraints 2 and 3.
Affected floors: secrets — existing scrubbing and fixed cause labels; spend cap — both UNKNOWN calls remain charged and replacement separately reserved; stop — immediate stop and strict admission retained; no duplicate sends — complete read-only trace requirement and existing send-intent fence; durable intake — encrypted intake and pre-dispatch owned recovery retained.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Carries the reviewed change at the physical paid-call cancellation and recovery boundary.
Side effects: Fast-forward integration carries the unit byte-for-byte. An admitted call can tolerate unavailable authority for at most 200ms; explicit withdrawal and stop remain immediate. Missing, malformed or clipped trace evidence cannot authorize replacement. Follow-up remains under existing cadence/caps and reply-only delivery.
Undo and recovery: Revert the integrated unit and register projections together. Preserve journals, UNKNOWN accounting and outstanding recovery commitments; reconcile those commitments before downgrade and never repeat uncertain effects.
Multi-machine posture: Cancellation polling is local to the owning process. Durable recovery uses the existing journal, writer ownership and send fence across restart/handoff. No new store or peer dependency.
Layer below: Reviewed original and repair records; resource-owner strict admission and stop polling, complete trace readers, answer-replace durable prefix, UNKNOWN reservations, restart projection, and delivered-answer settlement. Register replay consumes compiled sources.
Bug class: user-facing
Bug evidence: reproducer=tests/preview/answer-cancel-recovery.test.ts; live=tests/preview/answer-cancel-recovery.test.ts; restart=tests/preview/answer-cancel-recovery.test.ts
Hook bypass: none; core.hooksPath unset and common hooks directory contains samples only. Plain merge and commits.
Convergence: none
Decision: sb-answer-cancel-merge | ordinary fast-forward from exact live base to reviewed unit 2caeef9e, preserving both original and repair records; unit report is /Users/dabombstudio/.instar/agents/echo/.instar/lanes/answer-cancel-transient-1013-PROGRESS.md and repair report is /Users/dabombstudio/.instar/agents/echo/.instar/lanes/answer-cancel-transient-1013-repair-085656-PROGRESS.md | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-answer-cancel-transient-1013-PROGRESS.md
Decision: sb-answer-cancel-register | replay register at the merged unit head using the desk chain; zero inventory or owner-reference pins needed changes | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-answer-cancel-transient-1013-PROGRESS.md
Prompt review: No additional model-facing change in this integration. Carried recovery context preserves uncertain effects. Recorded cancellation update 715675816 exercises the production worker and trace readers; summary, uncertain summary, Jev undecided/unsure, reply-review and delivered/empty recorded shapes are negative controls. The successful replacement is a test double, not live delivery evidence.
Prompt finding: 849db3a6296a | protocol-literal | unchanged existing protocol guidance — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: e8708c7fea24 | protocol-literal | unchanged existing protocol guidance — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel; disclose unknown sources."
Deferral: generated/register.json:1 | not-a-deferral=implemented durable recovery behavior or its generated projection, not deferred engineering
Deferral: tests/preview/journal.ts:733 | not-a-deferral=implemented durable recovery behavior or its generated projection, not deferred engineering
Deferral: tests/preview/journal.ts:745 | not-a-deferral=implemented durable recovery behavior or its generated projection, not deferred engineering
Deferral: tests/preview/journal.ts:4625 | not-a-deferral=implemented durable recovery behavior or its generated projection, not deferred engineering
Deferral: tests/preview/journal.ts:10872 | not-a-deferral=implemented durable recovery behavior or its generated projection, not deferred engineering

Subject (18 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, scripts/resource-owner.mjs, src/assembly/harness.declarations.json, tests/preview/answer-cancel-recovery.test.ts, tests/preview/answer-cancellation.mjs, tests/preview/answer-cancellation.test.ts, tests/preview/call-diagnostics.mjs, tests/preview/egress-proxy.mjs, tests/preview/journal-agent.mjs, tests/preview/journal.ts, tests/preview/operator-records-cache.test.ts, tests/preview/tool-turn.mjs

## Closing block

simplestRobustRoute: This is the simplest robust route: one ordinary fast-forward merge of the independently reviewed unit, with no product edits, followed by the established repin/build/rehash/register replay chain. The existing bounded poll and replacement/commitment mechanisms prevent transient cancellation and lost recovery ownership without a new service. Start guards remain strict admission; end state is delivered answer or owned reconciliation; stop, 200ms grace, one replacement and spend/send limits remain. Offline replay is evidenced; no new unattended live completion is claimed.
80/20: No merge conflicts or additional product machinery. Targeted recorded-shape and boundary tests verify the carried behavior; final checks and host limitations are recorded in the report. Independent gate acceptance remains the desk responsibility.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
