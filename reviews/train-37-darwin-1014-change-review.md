# Change review — train-37 Darwin conformance

Subject base: 2b2935a81c494a0d6d0cd96c682b3dd32649de59
Review state: open
Reviewed content: none
Outcome: Re-declare train-37 native Darwin conformance for its measured composition after its existing behavioral contract passes on the declared runtime, and replay dependent publication if source pins trail.
Affected rules: Rules 26, 34, 37, 42, 49, 70, 74, 90, 95, 101, 102, 107, 111, 112, 113, 115 and 116; architecture R105.
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake retain existing enforcement; the unchanged contract exercises admission, refusal, stop and restart.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Exact native conformance evidence changes; executable behavior does not.
Side effects: The supported Darwin tuple binds this composition. Dependent publication must follow committed declaration bytes; other tuples retain their posture.
Undo and recovery: Revert the declaration with its matching composition and regenerate publication. A different composition requires its own native contract evidence; an older certificate alone does not certify these bytes.
Multi-machine posture: Shared declaration certifies only the exact Darwin runtime and composition tested here, with no other platform or remote authority claim.
Layer below: Inspected compositionClosure, compositionDigest, currentRuntime and selfHostCompositionEvidence. The unchanged contract runs real confined local build, test and install with captured provider frames and checks admission, refusal, stop, restart and bounded readiness.
Bug class: none
Bug evidence: Evidence maintenance only. Before renewal nine tests passed and only the stale certificate assertion failed; the desk explicitly authorizes renewal in this case. Before/after evidence is retained in the absolute PROGRESS location.
Hook bypass: none; core.hooksPath checked unset and common hooks directory contains samples only.
Convergence: none
Deferral: generated/register.json:1 | not-a-deferral=Inherited register descriptions are mechanically replayed; this publication introduces no deferred work.

Decision: train-37-darwin-conformance | train-37 Darwin conformance re-declared for its composition; use the existing helpers after the behavioral contract passes, then verify the certificate and dependent publication. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-37-darwin-1014-PROGRESS.md

Subject (8 paths): src/assembly/harness.declarations.json, generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json

## Closing block

simplestRobustRoute: The existing contract, composition helpers and register replay are the simplest robust route; no machinery is added. Exact runtime and successful behavior guard renewal; owner admission, stop and confinement retain start and limit guards. The contract proves local build/install completion, with no fresh live-provider or deployment claim.
80/20: Narrow evidence refresh with targeted native and shipped-client tests plus required architecture, register, review and pinned-text gates. The pipeline owns the full suite.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
