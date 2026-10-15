# Change review — Make runner exit causes visible without changing recovery

Subject base: 324d40539a76ce148ccfd6d74b0278e72571ae32
Review state: open
Reviewed content: none
Outcome: Print one runner exiting line to stderr at deliberate exit points, reusing the reason already recorded durably. Both observed live clean exits reached the existing default 1000-cycle ceiling.
Affected rules: Purpose 2/3; Rules 34, 35, 39, 46, 49, 55, 59, 60, 68, 70, 74, 101, 111, 113, 116.
Affected floors: secrets — fixed error wording still suppresses exception details; spend cap — unchanged reservation and limits; stop — unchanged signal and stop admission; no duplicate sends — existing intent and result journal retained, delayed-send restart test; durable intake — accepted queued input survives cycle exit and is answered after relaunch without another platform delivery.
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: Observability-only exit logging in the launcher; no lifecycle, model decision, authority, effect or recovery policy changes. Real launcher restart tests verify the existing safety floors beneath the change.
Side effects: One additional stderr line per exiting process. The one-shot guard prevents a second reason if error propagation reaches the outer catch after the durable-exit handler. Standby acquisition remains a role transition and prints no exit line. Generated publication and owner-reference hashes follow the exact changed source.
Undo and recovery: Revert this change and its publication together; no journal migration is required. Existing durable intake, send outcomes and supervisor revival remain authoritative, including UNKNOWN outcomes that must never be blindly repeated.
Multi-machine posture: Exit stderr is deliberately machine-local, captured by that runner's launcher. Both standby and owner exit paths report their existing reason; shared authority, replication and send ownership remain unchanged.
Layer below: Inspected default cycles, lane.settle, ordinary-lane pending wake and peer admission, journal intake/send persistence, exit revival disposition, launcher restart loop and login-pool selection. Read-only live runs and decrypted frame metadata match both reported exit timestamps.
Bug class: integration
Bug evidence: reproducer=tests/preview/journal-agent.test.ts
Hook bypass: none
Convergence: none
Decision: runner-exit-observation | Mirror existing durable exit causes once on stderr; preserve lifecycle and recovery policy. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/runner-exit-reason-1014-PROGRESS.md
Prompt review: No prompt, parser or model accept/escalate/refuse rule changes. Fixture provider answers support process-boundary testing only; observer #106 model replay does not apply to this logging change.

simplestRobustRoute: This is the simplest robust route: reuse the existing reason at each exit, with a one-shot stderr guard preventing duplicate output when an exception reaches both local cleanup and the outer catch. Keep existing bounded shutdown, durable queues and send fencing; add no supervisor or retry mechanism.
80/20: Both observed causes resolved from durable live evidence. Process tests cover cycle exit, all three pause signals, refused startup, pending intake recovery and delayed-send completion without duplication; remaining full-suite and independent review belong to the desk.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
