# Change review — train-40-p2 Darwin conformance

Subject base: f673335e5cf04929591032b219aff3e3bcb32ba9
Review state: open
Reviewed content: none
Outcome: Renew the train-40-p2 native self-host certificate for the current composition after the Darwin behavioral contract passes, and regenerate its publication.
Affected rules: Rules 26, 30, 34, 37, 49, 70, 74, 90, 95, 101, 102, 107, 111, 112, 113, 115 and 116; architecture R105.
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake keep their existing enforcement; the contract exercises admissions, stop and restart behavior.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Exact native conformance evidence changes; executable behavior does not.
Side effects: The supported Darwin self-hosting tuple binds the combined composition; dependent generated publication follows committed declaration bytes. Other tuples retain their posture.
Undo and recovery: Revert with the corresponding composition and regenerate publication. A different composition requires fresh native contract evidence; restoring a stale certificate alone is not a recovery.
Multi-machine posture: Shared declaration certifies only the exact Darwin runtime and composition tested here; no new platform support or remote authority.
Layer below: Inspected compositionClosure, compositionDigest, currentRuntime and the native contract certificate consumer. The unchanged contract exercises actual confined build, test and install through owner admissions, provider refusal, stop, restart and bounded readiness.
Bug class: none
Bug evidence: Evidence maintenance only. Initial contract passes all nine behavioral cases; its sole failure is the stale certificate assertion at line 147. Desk clarification expressly permits renewal for this case; the complete contract must pass after renewal. Before/after evidence is in the absolute PROGRESS location.
Hook bypass: none; core.hooksPath checked unset and common hooks directory contains samples only.
Convergence: none
Deferral: generated/register.json:1 | not-a-deferral=Inherited register descriptions are mechanically replayed; publication introduces no deferred work.

Decision: train-40-p2-darwin-conformance | train-40-p2 Darwin conformance re-declared for its composition. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-40-darwin-1015-PROGRESS.md

Subject (8 paths): src/assembly/harness.declarations.json, generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json

## Closing block

simplestRobustRoute: This is the simplest route: run the existing native contract, compute the certificate with the existing composition helpers, and replay dependent publication. No machinery is added. Exact runtime, complete composition and behavioral assertions guard renewal; the full contract and architecture check guard the end state. Existing admission, stop and confinement retain limits. No live-provider or deployment acceptance claim.
80/20: Targeted native and shipped-client consumers plus required pinned tests, architecture, register and review checks; the pipeline owns the full suite.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
