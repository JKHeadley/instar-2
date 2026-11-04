# Change review — restore abandoned worker slot recovery

Subject base: 1d10dea2e7b0e88d35f964fa456573451229ac33
Review state: frozen
Reviewed content: sha256:33c36f5c594216843c389ba090ec75b445c5531fe110fc3a6e819f0631ce92d9
Outcome: Restore the previously reviewed recovery of dead launch reservations on the answering live base, without adding another behavior change.
Affected rules: 60, 61, 49, 74, 101, 112, 113
Affected carryover rows: 21, 47, 50
Affected floors: secrets — reads process IDs and cwd only; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Host resource accounting is on the live trust path. Exact-head full suite, independent review and a new real task are required.
Side effects: Final settlement and restart recovery ask passwordless sudo for a read-only lsof census over candidate PIDs. Failure falls back to the existing unprivileged read. Uncertain members keep their reservation. The ordinary one-second sample retains its 64-candidate bound.
Undo and recovery: Revert this restore before another switch. Undecidable rows remain in the ledger until a complete census can verify that their workers are gone.
Multi-machine posture: Host-local census and Six allocation remain with the runner owner. No remote state or credential change.
Layer below: The current live build inherited 13 unresolved old launch rows after rollback. This restores the same complete settlement census and privileged-read fallback that was live in 45ce50d0; it does not change conversation dispatch.
Bug class: live-path
Bug evidence: tests/integration/resource-owner.test.ts; live root owned-launches.json contained 13 orphan rows at 08:12:02 PST on 2026-11-04.
Hook bypass: none
Convergence: claimed
1.x reference: src/core/hostTestRunnerSemaphore.ts returns a holder when its PID is provably dead; this implementation also accounts for escaped descendants.
Prompt review: no prompt change.
Deferral: none

Subject (10 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, scripts/resource-owner.mjs, src/assembly/harness.declarations.json, tests/integration/resource-owner.test.ts

Decision: RR-RESTORE-1 | Restored only resource-owner code and its can-fail tests from 45ce50d0 onto 1d10dea2; no unrelated source change. | reported=.instar/lanes/SEAM-LEDGER.md
Decision: RR-RESTORE-2 | The focused resource-owner file passed 39/39. Native composition passed 10/10 after its exact digest was declared. | reported=.instar/lanes/SEAM-LEDGER.md

Decision: RR-RESTORE-3 | Independent Astra read-only review of cba79ee69 found the restored resource owner byte-identical to 45ce50d0 and returned YES conditional on exact-head gates. It warned that complete settlement can take time under denied process reads, and that the three named carryover rows are not closed by this contribution alone. | reported=.instar/lanes/SEAM-LEDGER.md

## Closing block

simplestRobustRoute: Reuse the existing complete settlement and restart census with the same conservative unknown result; do not add a new scheduler or force-release path.
80/20: Restore the already reviewed resource owner and re-run exact-head gates. The new real task after switch proves that worker slots allow useful work.
VERDICT: author submission; no independent verdict asserted.
