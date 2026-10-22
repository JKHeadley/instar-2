# Change review — train-118 pipeline assertion repair

Subject base: 830cc60dd39d58e8588c3001b86ff8a33f59ece0
Review state: open
Reviewed content: none
Outcome: Repair the five gate assertions after the reviewed memory-supersession guidance merge, preserving runtime behavior and immutable recorded evidence.
Affected rules: 7, 13, 26, 34, 36, 37, 49, 70, 74, 101, 102, 112, 113, 116
Affected floors: secrets — no credentials or outbound calls; spend cap — offline replay only, unchanged reservations; stop — unchanged admission and latch; no duplicate sends — restart replay still asserts one delivery; durable intake — original captured bytes and journal persistence unchanged.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Five test assertion repairs only; no shipped prompt, parser, policy or runtime modification.
Side effects: The tests accept the reviewed current policy digest and reconstruct the historical memory wording explicitly. The packet-size budget grows only by the measured 60-byte conflict instruction delta; recall and precision thresholds stay fixed.
Undo and recovery: Revert this commit to restore the five red assertions. Captured fixtures, runtime prompts and activation records require no migration or recovery.
Multi-machine posture: Tests and their immutable evidence travel in git; runtime ownership, replication and state are unchanged. The desk copies the local report to the specified Studio path.
Layer below: Read full purpose and rules, verified they equal origin/main; inspected production memory-answer-guidance, journal conflictDecision, activation validation and existing historical prompt reconstruction in inrole-memory-live. Gate log supplies the five failures; full suite remains the Studio gate's job.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath unset and common hooks directory contains only sample hooks.
Convergence: none
Verification: Run all five changed test files with one worker, typecheck, architecture/lint, register and change-review checks. Exact results are recorded in the repair report; no fresh live model or full-suite claim.
Decision: train-118-repair-history | Reconstruct only the reviewed memory wording in historical prompt expectations, and assert current wording occurs once and old wording is absent. Keep real captured outputs and their positive/negative reader and delivery assertions immutable. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-118-repair-225902-PROGRESS.md
Decision: train-118-repair-policy | Pin the current policy digest in both canaries and reject the exact previous digest through activation validation; existing successor tests still verify admitted current records and refused stale records. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-118-repair-225902-PROGRESS.md
Decision: train-118-repair-budget | Account for the measured 405-to-465-byte conflictDecision growth by adding exactly 60 to the previous packet ceiling; retain the source recall, precision, complementary-source and hard packet-bound checks. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-118-repair-225902-PROGRESS.md

## Closing block

simplestRobustRoute: This is the simplest robust route: repair the five outdated test expectations using existing historical reconstruction and activation checks. No new runtime machinery, weakened ability or rewritten evidence. Start guard is the existing reviewed merge; end guard is all five targeted files passing; resource and authority floors remain unchanged. This repair makes no autonomous shipped-path completion claim.
80/20: Only the five named test files and cheap required checks; no full suite or second baseline worktree.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
