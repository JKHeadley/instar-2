# Change review — Prove revision termination deadlines

Subject base: bbde8f1c023d66586c6ec1a7ac55956dcda2b0e3
Review state: open
Reviewed content: none
Outcome: The revision regression test measures the clock at termination for a shorter deadline and a request exceeding the parent deadline.
Affected rules: Rules 26, 34, 60, 70, 74, 87, 89, 101, 102, 111, 113, 116.
Affected floors: secrets — unchanged; spend cap — unchanged; stop — existing retirement assertions retained; no duplicate sends — existing dispatch assertions retained; durable intake — unchanged.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Two assertions strengthen an existing deterministic test; no runtime or model-facing change.
Side effects: A regression that ignores the revision deadline now fails even if eventual uncertainty and retirement remain correct.
Undo and recovery: Revert this test-only repair; no runtime data or migration is affected.
Multi-machine posture: Test-local injected clock only; production ownership and distributed state are untouched.
Layer below: Inspected the continuing conversation host deadline check and the fixture clock progression. The shorter request must stop at 1100 and the longer request at the parent bound 3000.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath unset; common hooks directory contains samples only.
Convergence: none
Decision: step1j-deadline-clock-proof | Measure termination time directly on both deadline boundaries, preserving the existing uncertainty, retirement and no-dispatch checks. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1j-hold-settles-1014-repair-073121-PROGRESS.md

Subject (1 paths): tests/assembly/production-conversation-session.test.ts

## Closing block

Rule inventory correction: The original unit's terminal failure notice also touches Rule 87 because it carries a result, and Rule 89 because the send branch labels it infrastructure. This repair adds those citations without changing the notice.
Scope: This repair covers the two assertions above bbde8f1c, not acceptance of inherited changes since the pipeline base. Original B07 passing control and simulated successful revisions remain limited evidence; no live-worker search or unattended acceptance claim is made.
simplestRobustRoute: This is the simplest robust route: assert the existing injected clock immediately after each request returns, without new machinery or changes to product behavior. The existing deadline guard supplies the bound and the test now observes it directly.
80/20: Run the changed test file, typecheck and required cheap gates; leave full-suite and live acceptance to the desk.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
