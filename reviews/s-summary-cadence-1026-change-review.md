# Change review — Summary cadence and bounded format recovery

Subject base: 1e1dac0353a8fad0651a91ddc6a60526dc121b54
Review state: open
Reviewed content: none
Outcome: Automatic rolling summaries select the largest older prefix that fits the existing byte limits, and a completed malformed writer result gets one format re-ask in the same bounded pass. Failed summaries remain uncommitted.
Affected rules: 4, 7, 11, 35, 36, 42, 47, 49, 55, 58, 60, 70, 74, 75, 95, 96, 101, 113, 116
Affected floors: secrets — existing redaction and storage unchanged; spend cap — reservations, two failures per span and eight attempts per pass unchanged; stop — checked before every dispatch and after review; no duplicate sends — no send-path changes; durable intake — originals and failures remain in the journal.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Changes automatic compaction span selection and format recovery on the running memory path.
Side effects: Automatic passes can cover more turns per call and may encounter the existing output or review limits sooner. Existing over-cap recovery shrinks spans; no byte, output, review or spend limit is raised. Synchronous memory recovery retains four-turn chunks and its 32-turn immediate recovery threshold, so incoming replies do not wait on a newly enlarged synchronous catch-up. An idle pass still yields to a busy reply. Format feedback is pass-local and an oversized retry does not poison the ordinary packet cache.
Undo and recovery: Revert this change; no journal format or state migration. Existing accepted summaries, originals, UNKNOWN reservations and failed-attempt accounting remain readable.
Multi-machine posture: Owner-local execution, with reservations/results in the existing journal and its unchanged replication path. No new shared state, store, transport, ownership or authority.
Layer below: Read constitution in full; inspected 1.x proactive compaction and bounded recovery, 2.0 sentinel cooldown, packet fitting, adapter readAnswer classification, durable attempt accounting, UNKNOWN recovery and both review paths. Read authenticated proof-room journal frames without opening a writer or invoking a model.
Bug class: user-facing
Bug evidence: reproducer=tests/preview/summary-cadence.test.ts; live=tests/preview/fixtures/summary-cadence-2026-10-26.json
Evidence boundary: Actual malformed outputs at 6236633 and 6236637, valid writer and review at 6236633, Jev verdict and delivered replies come from proofroom2-q-20261026-105723. The 86-turn end-of-budget snapshot shows the late fact reaches a fitting automatic span. Its larger candidate and conservation reviewer are explicitly synthetic because no recorded larger-span answer exists; this is offline coverage and recovery proof, not live S acceptance. Existing recorded-shape suites cover uncertainty, undecided reviews, loss and empty replies. Desk owns the unattended live S0b proof.
Hook bypass: none
Convergence: none
Decision: fitting-automatic-prefix | Use the existing byte ceiling for automatic spans; keep synchronous chunks bounded to four to preserve reply latency. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/s-summary-cadence-1026-PROGRESS.md
Decision: completed-format-reask | Reuse the existing format reminder and per-span attempt accounting only for completed adapter format failures; never retry UNKNOWN or reinterpret an unresolved memory judgment as a format defect. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/s-summary-cadence-1026-PROGRESS.md
Prompt review: Summary and review questions unchanged. The existing content-free format reminder carries the actual reader defect on the single re-ask. No test phrase decides runtime meaning, acceptance, escalation or refusal.
Prompt finding: 4106b49fff07 | protocol-literal | Unchanged protocol text, no new keyword decision — fixture-phrase tests/preview/journal.ts <- tests/preview/topic-awareness.test.ts: "you attempted nothing outside this reply, so never call an avenue tried; a missi"
Prompt finding: 849db3a6296a | protocol-literal | Unchanged protocol text, no new keyword decision — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: 85544c20941f | protocol-literal | Unchanged protocol text, no new keyword decision — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-conversation-session.test.ts: "your messages are kept and i'll answer them then; you don't need to resend them."
Prompt finding: e8708c7fea24 | protocol-literal | Unchanged protocol text, no new keyword decision — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel; disclose unknown sources."
Deferral: tests/preview/fixtures/summary-cadence-2026-10-26.json:227 | not-a-deferral=Recorded delivered reply preserved as test evidence, not a builder commitment.
Validation: Red-first recorded-tail regression; targeted summary tests, architecture, typecheck and final gate results in PROGRESS. Injected waiting and clocks only; no Studio load tests.

## Closing block

simplestRobustRoute: This is the simplest robust route: remove the four-turn restriction from automatic byte-fitting and reuse the existing format reminder for one completed malformed attempt. It repairs the recorded ten-minute retry delay and short-span bottleneck without a scheduler, new engine, weaker reviewer or raised resource floor. Pressure/idle/cooldown admission, stop, spend, prepared prompt/output ceilings and acceptance review remain the start, limit and end guards. No unattended live-completion claim is made.
80/20: Two localized behavior changes with actual captured format failures, bounded recovery controls and existing summary regression coverage. Independent judgment and live proof stay with the review desk.
VERDICT: author submission; no independent verdict asserted
