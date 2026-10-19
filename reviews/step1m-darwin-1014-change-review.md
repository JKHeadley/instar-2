# Change review — step1m Darwin conformance

Subject base: c4849c635d5fcbcb39f0188efacc218f41b74508
Review state: open
Reviewed content: none
Outcome: Certify the step1m native self-hosting composition after its existing Darwin execution contract passes on the declared runtime, and regenerate its publication.
Affected rules: Rules 26, 30, 34, 37, 49, 70, 74, 90, 95, 101, 102, 107, 111, 112, 113, 115 and 116; architecture R105.
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake retain their existing enforcement; the contract exercises admissions, stop and restart behavior.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Exact native conformance evidence changes; executable behavior does not.
Side effects: The Claude Code Darwin self-hosting tuple remains supported for the measured composition. Other tuples retain their existing posture. Generated publication must follow committed declaration bytes.
Undo and recovery: Revert the declaration with its matching composition and regenerate publication; reverting only this certificate leaves the current composition correctly refused by R105. A different composition needs its own successful native contract before certification.
Multi-machine posture: Shared declaration carries evidence only for the exact Darwin runtime and composition tested here; no remote authority or other platform claim.
Layer below: Inspected compositionClosure, compositionDigest, currentRuntime and selfHostCompositionEvidence. The unchanged contract exercises the actual confined local build, test and install through owner admissions, plus provider refusal, stop, restart and bounded readiness.
Bug class: none
Bug evidence: Evidence maintenance only. Before re-declaration 9/10 passed: native execution and all floor cases succeeded, and only the stale-certificate assertion failed. The unchanged full file passed 10/10 after renewal (26.61s); architecture passed. Register replay binds source commit ff95c55eb6fcef0e2529ae1cfd8af069c50ef827. Its exact certificate assertion and architecture R105 verify the resulting declaration; before/after logs are retained in the absolute PROGRESS location.
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains samples only.
Convergence: none

Decision: step1m-darwin-conformance | step1m Darwin conformance re-declared for its composition; use the existing digest helpers after the native contract passes, then replay dependent publication. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1m-darwin-1014-PROGRESS.md

Subject (8 paths): src/assembly/harness.declarations.json, generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json

## Closing block

simplestRobustRoute: Use the existing contract and composition helpers, then regenerate publication; this is the simplest route and adds no machinery. Existing owner admission, stop and confinement guard start and limits; the contract proves local build/install completion. No new unattended live-provider or deployment claim.
80/20: Narrow evidence refresh with targeted native and composition consumers plus architecture, register and review checks; the pipeline owns the full suite.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
