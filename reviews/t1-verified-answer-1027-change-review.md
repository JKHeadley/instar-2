# Change review — Require current evidence selection before attaching pending reports

Subject base: 9e04f28e9ef5d7c623e43e3197fde4620d8bd5c8
Review state: open
Reviewed content: none
Outcome: The current answer selects which pending reports are supported before the runner appends them; an old assertion alone cannot append or close owed work.
Affected rules: 4, 8, 10, 26, 36, 42, 49, 70, 74, 83, 84, 101, 102, 111, 113, 116
Affected floors: secrets — existing redaction and outbound wall; spend cap — existing bounded answer call, no new call; stop — unchanged; no duplicate sends — existing receipt and boundTo identities; durable intake — unchanged encrypted journal
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: Small model-facing change to report assembly and packet data; no new effect, authority, store, or provider dependency.
Side effects: Delivery-mechanics fixtures now explicitly simulate selection; legacy model outputs omit selection and leave reports pending. The report packet is bounded to MAX_ANSWER_BYTES, in existing schedule order, and yields with an omitted count under the existing overall envelope bound. Reports with no selection remain visible, not marked delivered. Dedicated explicitly requested result sends retain their existing route.
Undo and recovery: Revert this change. No journal schema or migration changes; existing pending reports, original drafts, send identities and receipts remain readable.
Multi-machine posture: Stateless selection on each owner from the shared journal. The selection must match the offered text and current report; existing owner and send receipt fencing remain authoritative across restart and transfer.
Layer below: Inspected Instar 1.x CommitmentTracker.verifyOne: unverifiable one-time and behavioral commitments stay pending instead of trusting an acknowledgment. Reuse that invariant rather than its filesystem/config verifiers, which cannot establish conversational factual support. Inspected 2.0 pendingReports, packet builder, answer record, sentObligations and receipt replay.
Bug class: integration
Bug evidence: reproducer=tests/preview/t1-verified-answer.test.ts
Hook bypass: none; core.hooksPath unset; common hooks directory contains samples only, inspected before commit
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Prompt review: Existing answering mind judges evidence with current context. No keywords decide factual support, no fresh verifier or paid call. Exact offered key/text matching only admits that judgment. The real T1 text and recorded uncertain/undecided/review/empty shapes are replayed, with synthetic setup explicitly labeled.


Decision: t1-current-selection | Let the current answering mind select a report from its exact evidence packet; preserve unselected work and use normal send receipts for completion. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/t1-verified-answer-1027-PROGRESS.md
Decision: t1-recorded-replay | Retain exact T1 capture and replay recorded uncertain shapes; delivery-mechanics fixtures explicitly simulate selection without claiming fresh model proof. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/t1-verified-answer-1027-PROGRESS.md

Prompt finding: 4106b49fff07 | protocol-literal | Unchanged protocol shared with recorded fixtures, not a semantic trigger — fixture-phrase tests/preview/journal.ts <- tests/preview/topic-awareness.test.ts: "you attempted nothing outside this reply, so never call an avenue tried; a missi"
Prompt finding: 849db3a6296a | protocol-literal | Unchanged protocol shared with recorded fixtures, not a semantic trigger — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: 85544c20941f | protocol-literal | Unchanged protocol shared with recorded fixtures, not a semantic trigger — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-conversation-session.test.ts: "your messages are kept and i'll answer them then; you don't need to resend them."
Prompt finding: e8708c7fea24 | protocol-literal | Unchanged protocol shared with recorded fixtures, not a semantic trigger — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel; disclose unknown sources."
Deferral: tests/preview/journal.ts:2665 | not-a-deferral=Product guidance or regression data about durable pending work; no builder deferral.
Deferral: tests/preview/t1-verified-answer.test.ts:72 | not-a-deferral=Product guidance or regression data about durable pending work; no builder deferral.
Subject (25 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references/preview.json, tests/preview/deferral-delivery.test.ts, tests/preview/deferral-finish.test.ts, tests/preview/fixtures/t1-verified-answer-20261027.json, tests/preview/journal-deliver-all-floor.test.ts, tests/preview/journal-deliver-all.test.ts, tests/preview/journal-due-loop.test.ts, tests/preview/journal-incoherent-results.test.ts, tests/preview/journal-loop-declared-wait.test.ts, tests/preview/journal-loop-fire.test.ts, tests/preview/journal-obligations.test.ts, tests/preview/journal-revision-keeps-results.test.ts, tests/preview/journal-send-outcome.test.ts, tests/preview/journal.ts, tests/preview/obligation-task-answer-live.test.ts, tests/preview/requested-report-live.test.ts, tests/preview/select-report-fixture.ts, tests/preview/t1-verified-answer.test.ts

Decision: t1-envelope | Let optional report evidence yield under byte pressure before it crowds out the current answer; absent report text cannot authorize selection. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/t1-verified-answer-1027-PROGRESS.md

Validation: Focused final replay and default-context floor pass (20 tests); delivery/revision neighbors pass (25 tests); all other changed delivery selection scenarios pass. Two untouched physical-bridge cases in journal-send-outcome remain host-dependent here; they are listed in the local report. Typecheck and build passed before the final small envelope refinement; final typecheck and gate checks are in progress. Generated register refreshed in replay mode from source commit 7753b15152202c4556dcd60371b8a301821ce2e4.

## Closing block

simplestRobustRoute: This is the simplest robust route: give the existing answering mind the pending report and require its selection. The exact check prevents the observed automatic stale appendix without guessing meaning. Start: pending durable report and current task. End: selected report receives normal send receipt, or stays pending. Limits: existing envelope, answer size, call/spend cap, stop and unique send identity. No claim of a fresh unattended live-model proof.
80/20: A bounded packet and exact selection replace the blind append; reuse the existing delivery and recovery lifecycle. No new service, store, review call or semantic filter.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
