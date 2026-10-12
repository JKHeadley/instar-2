# Change review — train-14 shipped send extraction repair

Subject base: 7cfda40311a8cad58054582e4cc678435e22f32b
Review state: open
Reviewed content: none
Outcome: Restore collection and execution of the group carry request regression suite against the shipped send callback, including its phase observer parameter.
Affected rules: Rules 26, 37, 49, 70, 74, 101, 102, 111, 113 and 116.
Affected floors: secrets — no runtime changes; spend cap — no runtime changes; stop — existing shipped checks exercised unchanged; no duplicate sends — existing restart and uncertain-outcome assertions retained; durable intake — existing journal replay assertions retained.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Test-only repair to a stale source-extraction boundary; no model-facing or runtime behavior changes.
Side effects: The regression now evaluates the actual shipped parameter bindings as well as its body, so optional parameters cannot become unbound names. Existing send and recovery cases still execute the shipped checks.
Undo and recovery: Revert this test and review together; that restores the known collection failure and requires correcting the extraction before gating again.
Multi-machine posture: Machine-local test execution only; shipped ownership, replication and dispatch behavior is unchanged.
Layer below: Inspected journal-agent.mjs send callback, its optional observeSendPhase invocations, durable admission ordering and shared outcome handling; retained the real classifier and recorded answer replay.
Bug class: none
Bug evidence: Test infrastructure defect reproduced before repair as a collection TypeError at line 280. Targeted suite after repair exercises shipped send and restart recovery, including captured answer update 715672480.
Hook bypass: none; core.hooksPath unset and common hooks directory contains sample hooks only.
Convergence: none
Decision: train-14-repair-send-bindings | Extract the full shipped send expression instead of reconstructing a stale parameter list; assert phase callbacks while existing recovery cases omit the optional observer | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-14-repair-104757-PROGRESS.md

Subject (1 paths): tests/preview/group-carry-requests.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: keep the existing source-body test, extract its complete send expression and verify the observer calls. It prevents signature drift from breaking collection or leaving body variables unbound, without adding a parser or changing runtime code. Existing admission, stop, ownership, disclosure and no-repeat checks remain exercised; this makes no new autonomous-completion claim.
80/20: One test-file repair with before/after targeted evidence and the cheap gate checks; the Studio pipeline owns the full suite.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
