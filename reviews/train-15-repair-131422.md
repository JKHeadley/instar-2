# Change review — saved-answer acknowledgement reconstruction

Subject base: b2fb788cb5356e50565ac9838abfe7a3492cca78
Review state: open
Reviewed content: none
Outcome: Restore the existing acknowledgement timer after reopening a durable complete answer awaiting review, without waiting for final-answer dispatch.
Affected rules: Purpose continuity and least revelation; Rules 1, 26, 37, 49, 52, 63, 70, 74, 77, 87, 101, 102, 111, 112, 113, 116
Affected floors: secrets — existing outbound and audience checks; spend cap — unchanged reply and call budgets; stop — existing halted and dispatch checks; no duplicate sends — final intent and sent/UNKNOWN notice fences unchanged; durable intake — encrypted journal replay remains authoritative
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: A narrow runtime guard repair affects an irreversible reply and restart continuity.
Side effects: Complete saved answers may reconstruct their acknowledgement timer while review is pending. Reserved turns without a complete answer remain excluded. Final-send intent still excludes reconstruction; sent and UNKNOWN acknowledgement intents still refuse another dispatch.
Undo and recovery: Revert the reconstruction guard and its regression tests, then regenerate pins/publications using the existing tools. No schema changes or new journal records; preserve all durable intents and never resend an UNKNOWN effect. Reverting restores the observed delayed-review acknowledgement defect.
Multi-machine posture: Timer handles remain deliberately process-local and are reconstructed from durable intake and answer state. Existing ownership, audience, replication and dispatch checks retain authority; this repair adds no cross-machine state or owner.
Layer below: Inspected startAcknowledgement callers at intake and both drain reconstruction points, acknowledgeReply current/admission checks, held-notice intent and sent replay, final dispatch cancellation, and journal worker reconstruction. Existing doorway checks keep the named floors.
Bug class: durability
Bug evidence: reproducer=tests/preview/reply-acknowledgement-timing.test.ts; restart=reviews/train-15-repair-131422.md
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains sample hooks only; ordinary commits used
Convergence: none
Decision: train-15-repair-saved-answer | Permit reconstruction only for complete saved answers while retaining exclusion of incomplete/uncertain reservations and final dispatch; reuse the existing timer and send doorway. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-15-repair-131422-PROGRESS.md
Decision: train-15-repair-pins | Regenerate changed source and owner pins plus publications with the delegated desk scripts and existing register generator, without hand-editing hashes. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-15-repair-131422-PROGRESS.md
Prompt review: No model prompt, output parser, acceptance, escalation or refusal judgment changes. The new regression replays the captured delivered answer and intake for update 969390408 with an injected unavailable reviewer and slow contextual review. Existing acknowledgement suites replay captured answer, Jev and review shapes. No live delivery or autonomous release claim.
Prompt finding: 849db3a6296a | protocol-literal | Unchanged fixed empty-memory reply asserted by the memory-list regression; not a new model trigger.
Prompt finding: e8708c7fea24 | quoted-evidence | Unchanged recall instruction located by the hallucination negative control; no fixture answer drives classification.

Restart evidence: Before the guard repair, the saved-answer paired regression produced 1 passed / 1 failed: uninterrupted acknowledged at ten seconds, restarted did not. After repair, TMPDIR=/private/tmp nice -n 10 npx vitest run --maxWorkers 1 tests/preview/reply-acknowledgement-timing.test.ts tests/preview/reply-acknowledgement.test.ts exited 0 with 2 files and 45 tests passed. Both restart cases acknowledge at ten seconds and send the saved final answer once, with no new model call; reopening again produces no duplicate. Existing tests cover sent/UNKNOWN acknowledgements, operator eligibility, stop, expiry, cap, disclosure and final dispatch. The sandbox denied setpriority but executed the tests; fake time supplies the delay. This is recorded-shape replay, not a fresh live delivery.

simplestRobustRoute: This is the simplest robust route: relax the existing reconstruction guard for durable complete answers only and exercise it through the real journal/worker. No new timer service, record, model call or review round. Start guard retains operator eligibility and ordinary allowance; end guard remains final-send intent; existing send admission retains secrets, stop, audience and cap floors. No autonomous-completion claim.
80/20: Repair the single demonstrated restart boundary and run focused acknowledgement tests, compiler, architecture, required publication and pinned-text checks. Independent release review and live proof remain the desk's gate.
VERDICT: author submission; this record asserts no independent verdict
