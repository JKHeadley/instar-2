# Change review — scope ended tool status to the main session

Subject base: b35694135493743f898c34fb6bc95d8e7db2cb0b
Review state: open
Reviewed content: none
Outcome: Completed main-session calls report only that the latest main-session tool call ended, even when a background child remains active.
Affected rules: 26, 36, 37, 49, 52, 70, 74, 87, 89, 101, 102, 111, 112, 113, 114, 116
Affected floors: secrets — existing outbound inspection retained; spend cap — no new model calls; stop — existing send guards retained; no duplicate sends — unchanged step identity and cadence; durable intake — unchanged journal custody.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Evidence-bounded wording repair in the existing host projection; no new state, authority, parser or execution path.
Side effects: The completed status changes after both successful and failed main-session calls. It makes no claim about child work or the model between calls. Running-call text, failure matching, observation freshness, step hashes and progress delivery remain unchanged. Existing failure and send assertions are updated to the narrower wording. Generated register wiring is refreshed through the existing replay generator because the projection bytes changed.
Undo and recovery: Revert this repair and regenerate register output with the existing generator; this restores the overbroad status defect. No state migration or service restart is performed by this change.
Multi-machine posture: Existing machine-local claim observation only; cross-machine ownership fencing remains at the admission/send checkpoints. No new store or transport.
Layer below: Read both constitutional documents in full and confirmed they match origin/main. Inspected the projection's deliberate exclusion of agent-tagged admissions, admission-gate.mjs asynchronous launch acknowledgement retaining the child edge, recorded tool-turn root/child admissions, executable failure-hook replay and bounded progress send tests.
Bug class: integration
Bug evidence: reproducer=tests/preview/working-activity.test.ts
Hook bypass: none; core.hooksPath unset and common hooks directory contains samples only.
Convergence: none
Decision: progress-stale-main-session-scope | Use the review's bounded past-tense status instead of adding a child tracker or restricting background delegation; derive the async regression from captured admissions and explicitly label its constructed arrangement. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/progress-stale-1016-repair-133332-PROGRESS.md
Prompt review: No model input, output parser or accept/escalate/refuse decision changes. Existing recorded summary-uncertain, Jev, reply-review, delivered reply and empty-context controls replay in working-progress.test.ts. The constructed async neighbor is not represented as a captured asynchronous run.

## Closing block

simplestRobustRoute: This is the simplest robust route: narrow one status sentence to what the existing main-session projection observes and prove the still-running-child neighbor without new machinery. Start and end guards remain the existing admitted occurrence, completion evidence and fresh observation; send bounds and all five floors remain enforced. No autonomous deployment or live acceptance is claimed.
80/20: The updated projection tests failed all four cases before the implementation repair, including the background-child regression. After repair all 42 tests in the three affected files pass, and typecheck passes. Pipeline review and Studio full-suite acceptance remain distinct from this targeted repair evidence.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
