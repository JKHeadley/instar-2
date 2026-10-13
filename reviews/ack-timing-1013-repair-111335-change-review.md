# Change review — acknowledgement queue state through transport

Subject base: c4e15118f963eaaea5bae9b554fd9f9744157836
Review state: open
Reviewed content: none
Outcome: A request waiting behind the serial worker's final or remaining-part transport receives the queued acknowledgement; once the worker moves on, completed and UNKNOWN historical sends do not block it.
Affected rules: Rules 13, 26, 28, 34, 36, 37, 42, 49, 52, 62, 70, 74, 77, 87, 89, 101, 102, 111, 113, 116.
Affected floors: secrets — existing outbound and disclosure checks unchanged; spend cap — unchanged allowance, no additional model calls; stop — existing admission and dispatch gates unchanged; no duplicate sends — existing durable intents and UNKNOWN fencing unchanged; durable intake — encrypted intake and cursor replay unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: One process-local current-turn reference corrects fixed acknowledgement wording inside the existing worker and doorway; no new capability, authority or durable state.
Side effects: An earlier turn remains visibly queued through all awaited sends, including remaining parts reconstructed on restart. The current-turn reference clears before end-of-pass notices and in the worker's finally block; old completed or UNKNOWN intents never become permanent blockers. The admission-time queue recheck is retained.
Undo and recovery: Revert this repair's worker selection and its added tests together. No journal schema or migration changed, and UNKNOWN sends remain fenced across restart.
Multi-machine posture: Machine-local, deliberately: this reference describes the current process's serial worker occupancy, never ownership authority. Existing owned conversation journal, disclosure and send doorway still arbitrate effects across machines.
Layer below: Inspected serial drain and restart part drain, sendReplyParts, dispatch admission/current callback, acknowledgement cancellation and in-flight ordering, UNKNOWN fences, operator identity and infrastructure provenance. No prompt, parser, model acceptance or refusal criteria changed. Source-register pins are regenerated from committed content using the delegated desk tools.
Bug class: integration
Bug evidence: reproducer=tests/preview/reply-acknowledgement-timing.test.ts
Hook bypass: none; core.hooksPath is unset and the shared hooks directory contains sample hooks only.
Convergence: none
Prompt review: Only the queue predicate and worker occupancy bookkeeping changed. Model prompts and parser bytes are unchanged; fixed notice templates remain unchanged. Real recorded answer and delivery bytes are replayed with explicitly injected transport timing.
Prompt finding: 849db3a6296a | protocol-literal | Unchanged fixed empty-memory reply; not introduced or modified by this repair.
Prompt finding: e8708c7fea24 | quoted-evidence | Unchanged recall source instruction and negative-control test, unrelated to queue selection.
Decision: ack-timing-1013-repair-worker | Keep a process-local current-turn reference through final and remaining-part sends, and clear it on pass exit; an intent alone cannot prove the worker is free. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/ack-timing-1013-repair-111335-PROGRESS.md
Decision: ack-timing-1013-repair-evidence | Replay recorded answers with zero and 2500 ms transport, accepted and UNKNOWN outcomes, and recorded multipart text across restart; injected delays are not live measurements. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/ack-timing-1013-repair-111335-PROGRESS.md
Verification: Five focused files passed 98/98 tests. Typecheck and build passed. The delegated owner-manifest and inventory repin tools changed no pins; build-register replay regenerated generated/ from source commit 31df16f022997f77cece81b2eb89169e9145dae7. Final lint, register and change-review results are recorded in the local handoff report.

## Closing block

simplestRobustRoute: This is the simplest robust route: retain the existing ordered queue and admission recheck, adding only the turn actually occupying the worker until awaited transport ends. It fixes the named false-active acknowledgement without adding a queue, ledger, model call or capability limit. Start guards remain operator, allowance and stop; final dispatch still cancels its own notice; the existing one-notice budget, durable intent and UNKNOWN fence remain. Unit readiness is offline evidence; Rule 62 live-surface acceptance belongs to the Studio desk.
80/20: Repair only the reviewed transport occupancy cause. Carry the review's wider 75 importer failures in 15 unchanged files to combined-build verification without claiming they are host-only or running a full suite here.
VERDICT: author submission; independent judgment belongs to the review desk
