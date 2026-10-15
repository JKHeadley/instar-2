# Change review — train-35 topic pool integration

Subject base: 9d8c16f03f6917b9850269f3773809bd39fa9335
Review state: open
Reviewed content: none
Outcome: Integrate the exact reviewed per-topic account pool into the live train-30 base, preserving topic custody, queued intake, native or journal continuity and shared accounting.
Affected rules: Purpose 2/3; Rules 1, 26, 29, 30, 32, 34, 36, 37, 42, 44, 46, 49, 55, 60, 61, 63, 68, 70, 74, 75, 90, 96, 101, 102, 111, 112, 113, 116.
Affected floors: secrets — existing encrypted topic custody and no credential copying; spend cap — unchanged installation allowance and durable dispatch charges; stop — exact worker retirement and existing stop/deadline guards; no duplicate sends — original update identities and journal receipts; durable intake — queued input persists through admission and validation waits.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Integrates account replacement into the durable concurrent topic host.
Side effects: Each topic selects its own account and carries exact native transcript handles across claims. Missing or divergent native history uses existing journal continuation. Pool validation outages retain queued input. Existing live-base acknowledgement behavior is retained. Only generated publications conflicted; no product source or test hunk needed resolution.
Undo and recovery: Revert the candidate before deployment. Preserve encrypted topic, pool and host custody and original roots. Never replay uncertain sends or delete divergent transcripts. Runtime deployment and rollback remain desk-owned.
Multi-machine posture: Machine-local account selection and physical transcript copying under the existing owning-host fence; no new peer requirement, credential transfer or second writer.
Layer below: Inspected the host prepareTurn boundary, exact retirement, shared reservation, topic authority binding, driver resume mapping, physical transcript copy and pool completion reconciliation. These preserve existing intake and effect owners.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath unset and common hooks directory contains sample hooks only.
Convergence: none
Prompt review: No new model wording or parser. Replay member fixtures for summary 715672480, summary uncertain 715672483, Jev undecided 715672482, Jev unsure 969389570, reply review 969389923, delivered reply 715672479 and empty candidate 715672550 through the topic replacement tests. No live/provider acceptance claim.
Decision: train-35-pool | Ordinary merge of exact reviewed head 18d97316e50b9134cb66d42234ae7da7a8f20e35; report /Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1l-pool-topics-1014-PROGRESS.md and its committed member review records define scope. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-35-PROGRESS.md
Decision: train-35-desk-A | Preserve all member behavior and live-base changes; product files auto-merged without conflict. Regenerate the seven conflicting generated publications through the existing desk chain; prior publication was retained only until replay. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-35-PROGRESS.md
Decision: train-35-desk-B | Create a separate worktree directly at exact live base 9d8c16f03f6917b9850269f3773809bd39fa9335 and preserve its ancestry; no main merge or newer branch tip. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-35-PROGRESS.md
Decision: train-35-desk-D | Run targeted portable consumers and journal checks on WSL; disclose native/macOS and e2e/integration checks for the Studio gate per host instructions. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-35-PROGRESS.md

simplestRobustRoute: This is the simplest robust route: one ordinary exact-head merge and existing desk regeneration, with consumer checks. No new product machinery. Current grants and destination preflight guard start; durable completion and journal receipts guard outcomes; stop, deadline, retry brakes and shared allowance bound execution. No autonomous production-completion claim.
80/20: Target changed tests, direct imports, journal regressions, fixed-context floor and prescribed portable gates; leave native-host acceptance to the Studio. No full suite or load burner.
VERDICT: author submission for desk gate; no independent convergence or release acceptance claim
