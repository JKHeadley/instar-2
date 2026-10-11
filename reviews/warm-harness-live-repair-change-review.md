# Change review — answer admission for speculative launches

Subject base: f3c3f4c6436a18b75d4f9714f30dff66a9278ba8
Review state: open
Reviewed content: none
Outcome: A speculative launch accepts task bytes only after its existing host owner verifies it is running and transfers it through ordinary answer admission, including Six answer-family allocation and answer reclamation priority. A queued or unadoptable candidate is cancelled and joined by the existing production cold path before one ordinary answer launch.
Affected rules: 15, 26, 37, 49, 60, 61, 69, 70, 74, 77, 95, 101, 111, 113, 115, 116
Affected floors: secrets — command and credential binding, confinement and custody checks unchanged; spend cap — finite original caps and durable turn reservation unchanged, no task before answer admission; stop — existing stop checks cover adoption and delivery; no duplicate sends — one-shot task delivery, no retry after delivery, send identities unchanged; durable intake — original durable intake and turn-claim paths unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Resource ownership and Six admission beneath an ordinary answer change; no new authority, model judgment or capability restriction.
Side effects: Adoption temporarily reserves an ordinary answer allocation alongside the unused speculative allocation, then durably transfers the same process identity before returning the maintenance debit. If that additional reservation cannot fit, the process is disposed before cold execution; the optimization is optional and answer capacity remains usable. Retained maintenance debit failures refuse task delivery, remain visible, and are retried on cleanup or recovered under the original durable identity. Admission counters include the replacement reservation. Native composition certification is regenerated from the existing composition-digest implementation and its ten contract cases pass.
Undo and recovery: Revert this repair to restore prior behavior (including the reported regression). Stop the owning runner first; existing process cleanup handles both identities. A crash during transfer retains one or both durable rows conservatively. Verified cleanup returns the answer and any retained maintenance debit. Recovery observes exact process incarnations; a live owner is never reclaimed by another owner.
Multi-machine posture: Deliberately host-local; process admission belongs to the existing host owner. No warm process or new state is replicated or transferred to another machine. Existing conversation ownership and withdrawal remain unchanged.
Layer below: Inspected tryReserve, answer reserve, priority reclamation, immutable Six allocation sets and family demands, durable process gate, cleanup and observation-only recovery. Real Six allocations and subprocesses prove held-slot queued fallback, ready same-PID adoption, full local capacity fallback, independent Six refusal, missing durable handoff, stopped/binding failures and failed-debit recovery.
Bug class: integration
Bug evidence: reproducer=tests/integration/provider-prestart.test.ts
Hook bypass: none; core.hooksPath is unset and the resolved common hooks directory contains sample files only
Convergence: none
Prompt review: No prompt, output parser or model verdict rule changes. Recorded summary writer, Jev faithfulness, reply review and answer bytes replay through both cold and adopted paths, now asserting that every adopted result carries answer admission. Captures are proofroom-summary-cascade-stall-2026-09-30 and live-declarations-2026-09-28; missing terminal output remains uncertain. Jev is a transport-shape replay, not a claim that Jev uses this CLI. The five captured live tool turns and earlier error frames also retain their outcomes.

## Closing block

simplestRobustRoute: Reuse the existing owner, ordinary answer admission, durable ledger and close-before-cold caller. An owner-issued adoption callback prevents queued maintenance work consuming a task; reserving the replacement before the durable handoff prevents unaccounted live resources; retaining a failed old-debit return prevents invisible capacity loss. No second scheduler, new approval gate or capability limitation. Start guards are matching binding, live owner readiness and answer admission; end guards are one delivery and observed cleanup; finite resource and lifetime limits remain. Evidence is real subprocess/Six held-slot tests and recorded-shape replay, not a claim of a new live Telegram deployment.
80/20: Typecheck and 17 targeted prestart/handoff/replay cases pass; the ten native-composition contract cases also pass. Full-suite execution and independent acceptance remain the pipeline's work under the operator's instruction.
VERDICT: author submission; no independent verdict claimed
