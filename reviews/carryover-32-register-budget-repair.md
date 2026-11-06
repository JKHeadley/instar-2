# Change review — Allow cumulative register wiring fixture time

Subject base: 557731f17ac87532fb5ab12593ec8b385ba8eb6b
Review state: frozen
Reviewed content: sha256:8da389c6cd8cca94141f05a969f77392a7553a0d426010e1e28930e426d0aa00
Outcome: The R2 register fixture has a finite 120-second case budget for sequential build and wiring scans plus setup and cleanup, retaining every acceptance/refusal assertion and finite child wait.
Affected rules: 26/37/42/60/70/74/101/102/109/112/113/116.
Affected floors: secrets — unchanged test fixture; spend cap — no provider calls; stop — unchanged; no duplicate sends — no send effects; durable intake — product journal unchanged.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Narrow fixture-budget repair requested by independent review; no product behavior or authority changes.
Side effects: Explicitly reopen the superseded CLI repair review because its frozen subject contains this changed fixture; preserve its historical evidence. The five R2 parameterized cases share a 120-second budget instead of 60 seconds, following the longer-budget pattern already used by neighboring CLI cases. Each child retains its 60-second timeout. A genuinely stalled case can therefore take longer to fail, but remains finite. All assertions and isolated fixture cleanup remain intact.
Undo and recovery: Revert this test-only budget change and review record. No production data or runtime migration is involved.
Multi-machine posture: Machine-local temporary fixture on each host; identical CLI assertions and bounds across hosts. No cross-machine runtime state is added.
Layer below: Inspected runNode and tests/e2e/async-child.ts (60-second child timeout), build-then-wiring sequencing, setup/cleanup, and neighboring 120-second CLI case budgets. Retained independent review's measured valid and failing wiring observations.
Bug class: integration
Bug evidence: reproducer=tests/e2e/register.test.ts
Hook bypass: none
Convergence: none
Decision: C32-R2-REVIEW-2 | Reopen the superseded CLI repair review using the existing checker after Rule 109 identified its frozen subject changed; preserve its previous evidence and submit this new frozen review for the budget repair. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-32-common-base-1105-repair-182525-PROGRESS.md
Decision: C32-R2-BUDGET-1 | Allow 120 seconds for the R2 fixture group using the existing longer-budget pattern: independent wiring untracked timed out at 60,013 ms and valid took 52,387 ms. Preserve child limits and assertions; do not introduce a scheduler, cache or production change. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-32-common-base-1105-repair-182525-PROGRESS.md

1.x FIRST: Inherit accepted reviews/carryover-32-register-cli-repair.md comparison at b227aed934ce3c61cda09142f46de06834aacc9c. Rechecked actual JKHeadley/instar recorded main 5abca9c1df110113ba80c758db3cdec52f952df9 src/lifeline/TelegramLifeline.ts:2800, docs/specs/CRASH-RECOVERY-UX-SPEC.md:141–142,627,965 and history e5f88b0fe/9585a36e6/0ca2f6756. ONEX-LESSONS section 6 read. Existing async-child adaptation retains the asynchronous subprocess behavior; this repair addresses only the 2.0 register fixture's cumulative time budget. The accepted correction adaptation from 1.x 4f88880a through port 88aabf739 is untouched.

Retained red evidence: Astra R2 at this subject base reported 39 passes and one wiring-untracked timeout (60,013 ms); wiring-valid took 52,387 ms and committed equivalence 32,321 ms. Studio lanes/astra-unit-carryover-32-common-base-1105-r2-evidence/register.log remains the original evidence. Earlier passing runs are historical evidence, never exoneration. New targeted results and exact-head cheap checks are in the reported progress record. Row 32 remains OPEN for the desk's combined gate and installed actual-use proof; this submission claims neither installed acceptance nor independent review convergence.

## Closing block

simplestRobustRoute: Adjust only the cumulative case budget to the file's existing 120-second pattern, leaving asynchronous child execution, finite child waits, real CLI scans and every assertion intact. This is the simplest robust route; no product latency contract changes and no machinery is added.
80/20: Address the one remaining fixture-budget finding and verify the existing valid/untracked pair. Preserve the failed run; no quarantine or full-suite rerun.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
