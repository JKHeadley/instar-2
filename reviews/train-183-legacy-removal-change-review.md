# Change review — remove the verbatim 1.x relationship copy from train-183

Subject base: fb9ca25f850dd328dea9ac277dfd79c0f63a20d4
Review state: open
Reviewed content: none
Outcome: The train no longer carries fifteen uncompiled 1.x relationship files (12,874 of its 21,113 inserted lines). The verbatim copy stays reachable at commit 8e7df7f5f, and every live reference now names that commit.
Affected rules: 49, 74, 102, 111, 113, 116
Affected floors: secrets — unchanged, only uncompiled reference copies and comments change; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: The checker suggests significant because tests/preview/relationship-store.ts is under the preview source path. Its only change is one comment; no port code or test changes.
Side effects: The verbatim copy leaves the working tree, so reading it now needs git show at 8e7df7f5f. Nothing compiled, tested or run reads the directory. Earlier review records keep their legacy-1x lines as history for their own subjects.
Undo and recovery: Revert this commit, or restore the directory with git checkout 8e7df7f5f -- legacy-1x. No migration or history rewrite.
Multi-machine posture: No runtime or stored state changes, so every machine behaves the same. A machine reading the old copy needs the commit, which train-183 history contains.
Layer below: Searched the whole train-183 tree for legacy-1x, other spellings of the directory and relationships/src paths. tsconfig includes only src, tests and vitest.config.ts. The only tree references were three lines in the carry document, one in tests/preview/README.md and one comment in tests/preview/relationship-store.ts, plus review records.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath unset.
Convergence: none
Prompt review: No model prompt, output parser, judgment policy or provider choice changes; only uncompiled copies, documentation and one comment.
Decision: train183-legacy-removal | Remove legacy-1x/relationships at the desk's direction and name commit 8e7df7f5f as where it stays reachable. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-183-legacy-removal-PROGRESS.md
Decision: train183-legacy-readme | Two references named legacy-1x/relationships/README.md, which is in no commit. Point them at the directory at 8e7df7f5f and the carry document instead of repointing a dead name. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-183-legacy-removal-PROGRESS.md
Decision: train183-legacy-records | Leave earlier review records unedited; their legacy-1x lines are history for their own subjects. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-183-legacy-removal-PROGRESS.md

Subject (16 paths): legacy-1x/relationships/src/commands/relationship.ts, legacy-1x/relationships/src/core/HybridLogicalClock.ts, legacy-1x/relationships/src/core/ReplicatedRecordEnvelope.ts, legacy-1x/relationships/src/core/UnionReader.ts, legacy-1x/relationships/src/core/types.ts, legacy-1x/relationships/src/permissions/RelationshipAnomalyScorer.ts, legacy-1x/relationships/src/permissions/RelationshipBehaviorStore.ts, legacy-1x/relationships/tests/e2e/ws23-relationships-alive.test.ts, legacy-1x/relationships/tests/integration/ws23-relationships-routes.test.ts, legacy-1x/relationships/tests/unit/PostUpdateMigrator-ws26OneMemory.test.ts, legacy-1x/relationships/tests/unit/relationship-delete.test.ts, legacy-1x/relationships/tests/unit/relationship-manager.test.ts, legacy-1x/relationships/tests/unit/relationship-routes.test.ts, legacy-1x/relationships/tests/unit/slack-relationship-anomaly.test.ts, legacy-1x/relationships/tests/unit/ws23-relationships-wiring.test.ts, reviews/train-183-legacy-removal-change-review.md

## Verification

Results are in the report sent to the desk; the pipeline owns the full suite and independent review.

## Closing block

simplestRobustRoute: This is the simplest robust route: delete the unused copy and name the commit that keeps it. No added mechanism, guard change or test change.
80/20: Removes more than half of the train's inserted lines for review with five one-line reference edits; port code and tests stay as reviewed.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
