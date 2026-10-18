# Change review — train-17 pipeline repair

Subject base: 73fe7359cd934e645b7f2cc84a793597c5e33d6d
Review state: open
Reviewed content: none
Outcome: Repair stale train-17 regression expectations and ensure recorded-output replay assertions surface as test failures instead of being caught as unknown model outcomes.
Affected rules: Purpose 2/3; Rules 26, 34, 36, 37, 42, 49, 70, 74, 95, 101, 102, 111, 112, 113, 116.
Affected floors: secrets — production checks unchanged; spend cap — production reservations unchanged; stop — production gates unchanged; no duplicate sends — restart assertions retained; durable intake — encrypted-journal reopen checked before answer and asserted outside the model callback.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Tests only; no runtime source, prompt, authority, capability or configuration change.
Side effects: Five regressions now reflect the combined train's existing behavior. Group and in-role replay assertions run outside model callbacks, exposing assertion failures directly. Independent replies survive unresolved memory; rejected mutation tests still verify the fixed failure notice. The inherited homonym repair is retained without further edits.
Undo and recovery: Revert this test-only commit to restore the old expectations; no journal format or live state changes, and no migration is needed.
Multi-machine posture: Tests use local temporary encrypted journals and injected clocks. Production ownership, replication, send fencing and admission remain unchanged. Studio owns the full gate; this WSL run is portable targeted evidence.
Layer below: Inspected journal.ts memoryUnresolved admission and memoryReplyFailed selection, current memoryDecision guidance, readAnswer, encrypted journal reopening and the group-disclosure checkpoint. Ran the independent-answer captured replay and malformed/rejected-memory neighbors as well as all changed tests.
Bug class: integration
Bug evidence: reproducer=tests/preview/group-carry.test.ts
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains only sample hooks. Use ordinary git commit.
Convergence: none
Decision: train-17-repair-204307-expectations | Align three old fixed-notice expectations with the merged independent-answer behavior; assert unresolved state remains recorded and uncancelled requests still fire. Keep the rejected mutation notice neighbors. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-17-repair-204307-PROGRESS.md
Decision: train-17-repair-204307-replays | Match current memory guidance and assert captured packet/storage facts outside model callbacks so assertion errors cannot become unknown model outcomes; preserve the recorded bytes, identity digest, audience and restart checks. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-17-repair-204307-PROGRESS.md
Decision: train-17-repair-204307-inherited | Retain b6290b8e and 73fe7359, already on origin/train-17 at start; journal-people passes all 20 tests, so no second repair of its packet-budget cause is introduced. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-17-repair-204307-PROGRESS.md

Prompt review: Runtime prompts are unchanged. The repaired assertions check the current guidance delivered to the model. Captured fixtures replay summary:715672480 (uncertain), 715672483 (summary writer), 715672482 (reply review), 969389570/969389923 (Jev unsure/undecided), 715672479 (delivered reply), 715672550 (empty reply), and in-role updates 715675444/715675448. The independent-answer neighbor replays 46039931. No fresh-provider or live-root run is claimed.

## Closing block

simplestRobustRoute: This is the simplest robust route: repair stale test expectations at their source and move assertions out of the callback that deliberately catches model failures. No runtime machinery is added. Existing start/admission, exact mutation validation, spend, stop, audience, encrypted intake and send receipt guards stay intact. Recorded-output replay is the evidence; this test repair makes no autonomous deployment claim.
80/20: Run the five changed files, the already-repaired homonym regression, four direct boundary neighbors, typecheck and required cheap/pinned gates. No full suite, quarantine, second base worktree or source change.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
