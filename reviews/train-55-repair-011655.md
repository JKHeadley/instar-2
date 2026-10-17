# Change review — compose live safety halts with train-55 recovery

Subject base: 3ebc76b8f639cc885693c3700a99a48d731fcd28
Review state: open
Reviewed content: none
Outcome: Merge live b55334d3 into train-55 preserving bounded recovery, durable safety-halt causes, scoped tool completion and advancing-evidence freshness.
Affected rules: 1, 26, 34, 36, 37, 49, 59, 60, 68, 70, 74, 87, 90, 91, 101, 102, 111, 112, 113, 116.
Affected floors: secrets — exact outbound secret check remains before notice release; spend cap — original call reservation and typed refusal causes retained; stop — existing stop retains precedence; no duplicate sends — original intent and uncertain-send handling retained; durable intake — unresolved inputs and original turn identities retained.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Merges recovery and safety-ceiling code used by continuing conversation workers, including physical deadline enforcement and user notices.
Side effects: Rate-recovery deadline now persists and returns the live safety cause before retiring its exact worker. A Stop emitted by throttling cannot disarm the independent ceiling; a late Stop cannot satisfy timely completion. The live generic watchdog uses the existing durable session IO. Safety-halt notices retain precedence over the generic unknown-answer text and pass the existing exact content-free notice path after secret inspection. Ended tool evidence remains truthful and expires without renewal from polling. The existing progress sender retains its bounded content-free liveness wording.
Undo and recovery: Revert this merge against its first parent without rewriting source history; retained halts and uncertain effects require reconciliation, never automatic replay. Existing source histories and changelog entries are preserved.
Multi-machine posture: Session IO and activity observations remain deliberately local to the admitted worker owner. This composition grants no other machine authority to launch, send or replay. Native Darwin conformance requires Studio renewal for the merged bytes.
Layer below: Verified the watchdog checks exact tmux identity, re-reads durable turn state after physical IO, and records halt before closure. Admission distinguishes exhausted calls from unavailable reservation storage. The conversation owner consumes the typed cause and retains intake; the journal preserves it into an infrastructure notice. Activity requires observed advancing admission evidence and cannot infer background child completion from root completion.
Bug class: integration
Bug evidence: reproducer=tests/assembly/production-session-driver.test.ts,tests/assembly/session-deadline-recovery.test.ts,tests/preview/journal-conversation-session.test.ts,tests/preview/working-activity-failure.test.ts
Hook bypass: none; core.hooksPath unset and common hooks directory has sample hooks only.
Convergence: none
Decision: train55-repair-011655-compose | Combine recovery with persistent safety halts; a throttle Stop cannot erase its ceiling, and late Stop cannot count as timely completion. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-55-repair-011655-PROGRESS.md
Decision: train55-repair-011655-freshness | Preserve advancing-evidence freshness and live scoped ended-tool status without refreshing time on polls or completed evidence. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-55-repair-011655-PROGRESS.md
Prompt review: No new model instruction or semantic classifier is authored by this resolution. Inherited live prompt edits retain their original reviews. Recorded summary, Jev, reply-review and delivered/empty reply shapes run through the retained recovery and safety-halt tests.
Prompt finding: 4106b49fff07 | quoted-evidence | Existing limitation text in the topic-awareness fixture; no new phrase-triggered decision.
Prompt finding: 849db3a6296a | quoted-evidence | Existing empty-memory response is fixture evidence rather than a new output requirement.
Prompt finding: e8708c7fea24 | protocol-literal | Existing sourceLabel attribution instruction is retained, not a new keyword decision.
Deferral: tests/preview/fixtures/ownword-time-1016.json.gz:122 | not-a-deferral=Inherited compressed recorded evidence, not a promise to defer this repair.

simplestRobustRoute: This is the simplest robust route: merge the two existing behaviors at their common driver, watchdog, owner and notice boundaries, preserve both histories and regenerate derived pins using the delegated desk scripts. No new mechanism or autonomous-completion claim. Original deadline, cap, stop, durable intake, uncertain outcome and unique send intent remain the start and limit guards; correlated result plus timely turn closure is the completion guard.
80/20: Verify the conflict interactions and real recorded shapes with targeted portable tests; the Studio owns full-suite execution and native macOS conformance renewal.
VERDICT: author submission; no independent verdict or live acceptance claimed
