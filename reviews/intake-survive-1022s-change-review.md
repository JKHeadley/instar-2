# Change review — preserve intake holds through recovery

Subject base: ca3d8ab80f606ce490c2883e71b6b5ab2a93d154
Review state: open
Reviewed content: none
Outcome: A worker reconsidering an accepted input retains the durable hold until its existing reservation, intent or memory settlement clears it. Read-only replay agrees during preparation and while a reserved harness result is pending. Recorded test inputs survive restart and finish once.
Affected rules: Purpose Rule 2; Rules 26, 30, 33, 35, 36, 42, 46, 49, 55, 60, 61, 63, 68, 70, 74, 101, 111, 113, 116.
Affected floors: secrets — existing custody, disclosure and outbound checks; spend cap — existing reservations and cap holds; stop — existing gate before dispatch; no duplicate sends — original intent/receipt fencing and host-result identity; durable intake — original raw bytes, writer and turn identity retained in the existing encrypted journal.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Repair of the shipped journal's recovery projection; no new authority, prompt, parser, journal format or retry policy.
Side effects: Status and concurrent observers continue to see the recorded hold during preparation until a durable successor clears it. A new different hold remains effective within the same pass. A same-reason hold retains its original age. Existing acknowledgements and summarization can still observe that durable hold; the targeted hold/notice/correction tests cover these consumers.
Undo and recovery: Revert this change and regenerate the register. No schema migration, new store, altered input, discarded result or replay authorization is introduced. Existing snapshots remain readable.
Multi-machine posture: The same journal and existing ownership, replication and fencing ports remain authoritative. Retry eligibility is a per-pass local variable, never shared state or permission for another owner to dispatch. No lease or timing change.
Layer below: Read the journal append/fsync/project order, snapshot and retained-evidence checks, raw replay, reservation and intent hold settlement, collectModel custody/packet matching, send intent/receipt fencing, loopHealth and restore proof. Read 1.x origin/main abd2c22e9281063e1e29ddabce4f64ec7bc71fa1 MessageProcessingLedger.ts, ingressDedup.ts, stuckMessageRecovery.ts and PendingInjectStore.ts. Reuse their exact input/sender lifecycle, duplicate suppression, injected recovery and persist-until-handoff invariants through the existing 2.0 adapter. Do not copy the topic-wide already-answered heuristic or at-least-once side effects.
Bug class: durability
Bug evidence: reproducer=tests/preview/intake-survive.test.ts; restart=tests/preview/intake-survive.test.ts
Hook bypass: none; core.hooksPath unset; common hooks directory inspected and contains sample hooks only.
Convergence: none
Decision: durable-hold-until-successor | Keep retry eligibility local and clear durable holds only through existing recorded successors. This removes all direct hold mutation in the drain path without adding a frame or store. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/intake-survive-1022s-PROGRESS.md
Decision: separate-observation-from-attribution | The sanitized capture lacks the overdue IDs and differing fields. Reproduce its operational shape using recorded test-origin updates 1016101 and 1016102; do not claim those are the live overdue items. Their identification and disposition remain unverified. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/intake-survive-1022s-PROGRESS.md
Decision: publish-source-pin | Regenerate the existing shape-only publication from committed repair a9b1a9f07353178201e4076eadd04efd4fea3b29; no declaration or certificate change. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/intake-survive-1022s-PROGRESS.md
Deferral: generated/register.json:1 | not-a-deferral=Unchanged existing declaration wording republished from the repaired source.
Prompt review: No model question, prompt text, output parser, verdict or release predicate changes. Recorded proof-room ingress updates 1016101/1016102 and answer output 1016104 exercise the real journal worker. A synthetic uncertain summary response isolates recovery from summary generation; it is labelled test machinery, not a new live model result. Existing recorded correction and summary corpus tests remain part of targeted validation.
Prompt finding: 4106b49fff07 | protocol-literal | Existing runtime instruction about the no-tools reply boundary, asserted by its consumer; unchanged by this repair.
Prompt finding: 849db3a6296a | protocol-literal | Existing fixed memory-list response; unchanged by this repair.
Prompt finding: e8708c7fea24 | quoted-evidence | Existing recall instruction located and removed by the negative-control test; unchanged by this repair and not derived from its expected answer.
Verification: Initial regression failed with live/replay inequality. The first targeted run passed 104 tests in 12 files. The expanded recovery file passes 12 cases. Typecheck and architecture pass. Full final verification and exact pushed head are recorded in the desk PROGRESS file. No live root, bot, chat or login was accessed; no live acceptance is claimed.

Subject (11 paths): tests/preview/journal.ts, tests/preview/intake-survive.test.ts, tests/preview/fixtures/intake-survive-2026-10-22.json, tests/preview/README.md, generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json

## Closing block

simplestRobustRoute: This is the simplest robust route: preserve the existing durable turn and use one local value to indicate retry eligibility while preparation runs. Directly deleting projected holds caused read-only restore disagreement and could persist across a pending result without a successor frame. No new queue, timer, store, frame or retry is needed. Start guards: existing ownership, audience, stop and cap checks. End guard: existing reservation/intent or recorded memory settlement. Limit guards: unchanged call/reply bounds and uncertain-effect fences. Unattended evidence is recorded-input replay through the worker, not a live-service completion claim.
80/20: One root cause, repaired across its drain-path mutation sites. Recorded-input restart, collection and duplicate boundaries pass; the two anonymized live overdue items cannot be attributed from the supplied snapshot. Independent review and live operation remain desk evidence.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
