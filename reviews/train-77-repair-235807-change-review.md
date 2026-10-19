# Change review — Recognize the existing asynchronous P15 proof boundary

Subject base: 822fbefccf54731e378cd505887b812d368dfabb
Review state: open
Reviewed content: none
Outcome: The scheduled contract map accepts the current round-nine child proof and still refuses missing process, crash or assertion evidence.
Affected rules: 24, 26, 34, 37, 45, 49, 70, 74, 95, 101, 102, 107, 111, 112, 113, 116
Affected floors: secrets — no custody changes; spend cap — no budget changes; stop — no runtime changes; no duplicate sends — dispatch unchanged; durable intake — intake and recovery unchanged.
Operator questions: none
Suggested tier: significant
Declared tier: ordinary
Tier rationale: Two proof-inventory entries and a focused regression test. No runtime, model instruction, model-output parser, authority or policy changes.
Side effects: The P15 audit now follows round nine's awaited helper call and checks its Node spawn import and invocation. It still uses the existing textual structural evidence check, not a new semantic execution certificate. All existing held-arm, inventory and actual-report requirements remain enforced.
Undo and recovery: Revert this commit if necessary. This would restore the known false refusal; no state migration, runtime rollback or effect retry is involved.
Multi-machine posture: Deliberately machine-local repository verification with identical tracked inputs on every host; no ownership, replication or agent state changes.
Layer below: Read the round-nine crash/recovery test and async-child implementation. The real helper calls Node spawn, awaits close, keeps timeout outcomes unsuccessful and escalates by exact child PID. Prior repair changed the caller without updating this consumer's spawnSync requirement.
Bug class: integration
Bug evidence: reproducer=tests/scheduled/contract-map-async-proof.test.ts
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains sample hooks only, checked before commit.
Convergence: none
Decision: train-77-repair-proof-consumer | Update the two existing proof entries rather than reverting responsive child waits or adding a new parser; require the helper's actual spawn boundary as well as the awaited caller. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-77-repair-235807-PROGRESS.md

Subject (2 paths): scripts/check-p15-contract-map.mjs, tests/scheduled/contract-map-async-proof.test.ts

Prompt review: No model-facing change; real model-output replay is inapplicable. The regression test reads the actual repository fixture bytes and removes one required token at a time in its isolated mocked read, without modifying the shared worktree.
Verification: The six supplied failing files reproduced all seven reported failures before the repair. Afterward all nine direct checker test consumers pass, 32 tests including six new refusal neighbors. Typecheck and lint pass; architecture has no findings and register wiring has no issues. Studio retains the full-suite bar.

## Closing block

simplestRobustRoute: This is that route: update the existing proof inventory to follow the already-shipped asynchronous test boundary. No new runtime or checker machinery. Start is the existing contract audit, end is its unchanged complete inventory and evidence validation, and limits remain fail-closed missing-evidence checks and bounded child execution. No unattended product completion is claimed.
80/20: One shared cause, two inventory entries, one regression file; preserve accepted runtime and fixture repairs, with no quarantine, timeout increase or broad rework.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
