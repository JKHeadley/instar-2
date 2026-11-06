# Change review — Restore train-184 aggregate crash-test deadlines

Subject base: 9facbef4c1493f3d8ad332d2dd9351ccf01eba29
Review state: open
Reviewed content: none
Outcome: Restore the accepted enclosing deadlines so sequential bounded crash-recovery children can reach their persistence and refusal assertions.
Affected rules: 34, 37, 42, 49, 70, 74, 95, 101, 102, 111, 112, 113, 116
Affected floors: Secrets, spend cap, stop, no duplicate sends and durable intake are unchanged; all persistence, uncertainty and refusal assertions remain intact.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Three numeric test arguments only; no product, helper, model, account, authority or resource semantics change.
Side effects: A failing aggregate test can wait longer, bounded at 95/155/215 seconds. Every child remains bounded at 30 seconds; independent crash cuts and runChild remain unchanged.
Undo and recovery: Revert this commit to restore the previous aggregate test deadlines; no production data or schema changes.
Multi-machine posture: Portable test budgets; verification here uses disposable local WSL fixtures. Native, physical, installed and full qualification remains on the correct host for the new SHA. No Studio writes or live-state changes.
Layer below: Inspected the actual TypeScript call expressions and tests/e2e/async-child.ts. Pending append has three sequential stages with parallel readers, torn owner five children, and poison history seven children. Child close, SIGKILL expectations and persistent uncertainty/refusal checks are preserved.
Bug class: integration
Bug evidence: reproducer=tests/e2e/harness-adapters-round7-regression.test.ts
Hook bypass: none
Convergence: none

## Evidence and inherited 1.x comparison

The valid forward Astra round 5 reviews a032fd32d4f1a4a16c6d3d5f65e8b3a2f82d42ba to 9facbef4c1493f3d8ad332d2dd9351ccf01eba29, retaining the recorded torn-owner 30-second failure in train-184-repair-065047-PROGRESS.md:114. The reverse round 4 is invalid for this candidate. This is one bounded correction, not a reset of repair history.

This repair inherits reviews/train-184-repair-193028-change-review.md and its recorded actual JKHeadley/instar main research at 9b5790e8105f94c8ad6f13243d063e7c7efd23b6: src/core/SessionLivenessOracle.ts (bounded async probes retain indeterminate on timeout), docs/specs/unified-session-lifecycle-robustness.md (false-death incident), docs/specs/test-runner-concurrency-bound.md and history 618560b3e/c91b8780e/2aaac4288; ONEX-LESSONS.md lifecycle and resource/testing areas. Reuse the existing async bounded observation and truthful uncertainty behavior; the production session oracle is not a fit for a test runner. This correction retains that implementation and restores its accepted aggregate budgets; no new 1.x transplant or claimed fresh search.

Decision: train184-deadline-restoration-1106 | Restore only aggregate deadlines 30_000/30_000/60_000 to 95_000/155_000/215_000, covering three/five/seven sequential 30-second stages plus margin; retain all child bounds and assertions. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-184-deadline-restoration-1106-PROGRESS.md

Correction to copied handoff wording: Three aggregate test deadlines changed. Product limits and per-child bounds did not change. Old 9fac fullPASS does not qualify these changed bytes; the normal pipeline must requalify the new SHA through native, answer, full, independent review, install and live. Disk193 remains first. No R105 exception is claimed.

simplestRobustRoute: Restore the three accepted enclosing test deadlines through the existing runner, with no new machinery. This is the simplest robust route; child admission, close/assertion end guards and finite per-child limits remain intact. No autonomous-completion claim.
80/20: Three test lines and this review record only. Run the touched file serially at nice 19 plus typecheck/build and cheap architecture/register/change-review checks; preserve unrelated blockers without broad repair.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
