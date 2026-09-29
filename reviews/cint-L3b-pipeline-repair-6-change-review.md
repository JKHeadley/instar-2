# Change review — cint-L3b pipeline repair 6: restore the held P4-NF-06 owner-manifest pin test

Subject base: 0fcb14da28e24bf1afe9c3338c98e608644a1cbc
Review state: open
Reviewed content: none
Outcome: The Mama PC gate failed at scripts/check-register-contract-map.mjs with "held test P4-NF-06 must pass in the current run". The register entry intake.dedup holds P4-NF-06 as build-stage fixture evidence, but its governance case "P4-NF-06 R7 owner manifest pins …" was quarantined with it.skip under docs/defects/owner-reference-pin-drift.md. The earlier desk repins removed the underlying drift (src/facts/store.ts now matches its pin), so the source fix is to remove the skip. The desk steps then re-pinned register-source/owner-references/part-four.json for the edited test file and regenerated generated/ by replay. The defect record notes that this case is closed; the five e2e register cases stay quarantined. The test file passes 16/16 locally.
Affected rules: 37, 74, 116
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged, the owner-manifest pin proof for the intake gates now runs again instead of being skipped
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: a one-line un-skip that restores an existing assertion, plus derived pin and register hashes; no source or behavior changes
Side effects: none outside the test run, register and wiring checks
Undo and recovery: revert the four commits; nothing durable changes
Multi-machine posture: not applicable, test and derived hashes only
Layer below: docs/00-the-purpose.md and docs/01-the-rules.md; scripts/check-register-contract-map.mjs held-test check; the desk repin steps (rehash owner manifests, repin chain, build-register --replay)
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

## Closing block

simplestRobustRoute: Once its cause was repaired, remove the Rule 37 quarantine and re-pin with the standard desk tooling. No new mechanism, and no pin was hand-edited (Rule 37, Rule 116).
80/20: tests/intake/governance.test.ts passes 16/16; tsc, npm run lint and register:check pass on this machine; the full suite reruns at the gate.
VERDICT: author submission; the independent verdict is pending
