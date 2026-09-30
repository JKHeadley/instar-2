# Change review — cint-L3b post-check repair: restore the held proof cases the contract checkers require

Subject base: b30444b972731ab446afa188a47f43114d93d2ca
Review state: open
Reviewed content: none
Outcome: Gate 5 on 0fcb14da passed Vitest but its post-test contract checkers failed. Run against the gate's saved results (paths re-rooted to this worktree), each failure traced to a proof case that was quarantined or stale. (1) check-p5/assembly "required final assertion was not executed": build 10 added one import line to tests/rungraph/production-grounding-round3.test.ts and production-grounding-review.test.ts; the desk rehash updated reviewedSourceSha256 but not the 75 assertion-site line numbers in tests/assembly/production-grounding-inventory.json. The lines are shifted by one (method and source hashes unchanged), every site matches the gate's executed assertion audit, and the inventory digest in check-assembly-contracts.mjs is re-pinned by the desk chain. (2) check-verification-contracts P9-NF-66: the parameterized capture-loss case (full-suite-load-timeouts quarantine) is restored; 17 passed, each state about 2 s. (3) check-transport-contracts SLB-LEGACY-ALL-KINDS-93: HEAD now contains main 02753cdc, so the stale-main quarantine is lifted for this case; it passes, reporting the comparison inapplicable. (4) check-p11/assembly boot recovery: the production boot conversation shard quarantine is removed; all four shards complete in isolation (52, 47, 47, 52 s) and the shard-hang record is closed. (5) check-register-contract-map: P4-NF-06 was already restored in repair 6. Its next failures were held preview evidence: the two genuine-capture fixtures and the eight launcher probe plans that reach 'passed' in CI are now named on the tests that prove them, with explicit passed assertions; the four e2e register CLI cases quarantined only for pin drift pass and are restored. Seven preview runtime probes have no passing CI test and are filed as docs/defects/preview-runtime-probes-without-ci-proof.md rather than credited by title. With those seven treated as passing in a diagnostic run, register-contract-map maps all 30 P3 contracts; p4, transport, effect, p5, judgment and verification pass on the diagnostic evidence. The boot-recovery checks need the gate's own full run.
Affected rules: 37, 43, 74, 107, 116
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged; the boot recovery shards (durable prefix SIGKILL recovery) run again instead of being skipped
Operator questions: none; the seven-probe gap asks the owner to choose a repair route (defect record)
Suggested tier: critical
Declared tier: ordinary
Tier rationale: test un-skips, test-title evidence ids with added passed assertions, a line-number correction in a reviewed inventory, and derived pin/register hashes; no src/ behavior changes
Side effects: none outside test runs, register and wiring checks
Undo and recovery: revert the seven commits; nothing durable changes
Multi-machine posture: not applicable, tests and derived hashes only
Layer below: docs/00-the-purpose.md and docs/01-the-rules.md; the post-test contract checkers in scripts/; the desk repin steps (rehash owner manifests, repin chain, build-register --replay)
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Deferral: docs/defects/preview-runtime-probes-without-ci-proof.md:7 | commitment=docs/defects/preview-runtime-probes-without-ci-proof.md
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

## Closing block

simplestRobustRoute: Remove each Rule 37 quarantine whose cause is gone and re-pin with the standard desk tooling; correct the inventory lines mechanically against the executed audit; name evidence ids only on tests that reach 'passed' for them. No checker was weakened and no pin was hand-edited (Rules 37, 107, 116).
80/20: targeted runs pass: provider-answer-reply 17/17 active, loop-main-head-mutation 3/3, governance 16/16, boot shards 0-3, production-grounding round3/review/evidence 121/121, proofs-launcher/model-json/provider-failure 44/44, e2e register 4 passed + 2 skipped; npm run lint and register:check pass; the full suite reruns at the gate.
VERDICT: author submission; the independent verdict is pending
