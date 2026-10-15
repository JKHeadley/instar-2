# Change review — step1o Darwin conformance

Subject base: f738b8c7de2832946b0f34d20a46d141352db0cd
Review state: open
Reviewed content: none
Outcome: Re-declare the native Darwin certificate for the current step1o composition after its behavioral contract passes, then verify the exact certificate consumer.
Affected rules: Rules 26, 30, 34, 37, 49, 70, 74, 90, 95, 101, 102, 107, 111, 112, 113, 115 and 116; architecture R105.
Affected floors: Existing secrets, spend cap, stop, no duplicate sends and durable intake enforcement remains unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Exact native conformance evidence changes; executable behavior does not.
Side effects: The existing supported Darwin tuple binds the current composition. Its dependent generated publication requires replay; the separate preview.step-check graduation deadline finding is owned by register-stepcheck-deadline-1014.
Undo and recovery: Revert this certificate refresh; the old composition certificate remains invalid for the changed composition and must not be treated as proof. Re-run the contract and re-declare with project helpers for any later composition.
Multi-machine posture: Shared declaration certifies only the exact Darwin runtime and composition tested on the Studio; no other platform or remote authority claim.
Layer below: Read compositionClosure, compositionDigest, currentRuntime and the exact certificate consumer in the native contract. Real confined build/test/install, owner admissions, stop, refused/timed-out/over-cap provider results, journal restart and readiness limits are exercised with captured provider frames.
Bug class: none
Bug evidence: Evidence maintenance only. Before renewal, 9/10 tests passed with only the stale certificate assertion failing; architecture reported that same single R105 mismatch. The desk clarification permits re-declaration in precisely this case and requires a final 10/10 contract pass.
Hook bypass: none; core.hooksPath unset, common hooks directory contains samples only.
Convergence: none

Decision: step1o-darwin-conformance | step1o-reaction-ack-1014 Darwin conformance re-declared for its composition | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1o-darwin-1014-PROGRESS.md

Subject (1 paths): src/assembly/harness.declarations.json

## Closing block

simplestRobustRoute: This is the simplest robust route: execute the existing contract, use compositionClosure/compositionDigest on its exact currentRuntime, then check the consumer and publication. No new machinery. Existing owner admission, stop, confinement and bounded readiness guard start and limits; the real confined build/install contract supplies completion evidence. No live-provider or deployment claim.
80/20: Certificate-only repair and required targeted checks; the pipeline owns the full suite.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
