# Change review — Account for both Jev attempts in launcher tests

Subject base: c66e0708e1758465b989c0ca53b2196ee70e9205
Review state: open
Reviewed content: none
Outcome: Repair the five launcher status assertions that still counted only one unavailable Jev attempt per turn after the bounded retry shipped.
Affected rules: Rules 26, 37, 41, 49, 55, 70, 74, 75, 101, 102, 111, 113, 116.
Affected floors: secrets — no credential or outbound behavior changes; spend cap — assert UNKNOWN usage for both attempts; stop — retain signal-pause and operator-stop assertions; no duplicate sends — retain exact send counts and topic routing; durable intake — retain the journal and restart path.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Test expectation repair only; no runtime, prompt, parser, authority or policy changes.
Side effects: Launcher tests now fail if either unavailable Jev attempt disappears from UNKNOWN accounting or model-call diagnostics. Existing reply and send assertions remain in place.
Undo and recovery: Revert this test-only commit if the bounded retry contract changes. No data migration or runtime recovery is required.
Multi-machine posture: Machine-local test expectations deliberately; no shared state or cross-machine protocol changes. Existing ownership enforcement is untouched.
Layer below: Read checkReply's one-retry budget, the durable jevRetried reservation, unknownCallKeys' separate jev and jev-retry keys, and launcher's status projection. Existing jev-retry tests cover rescue, exhaustion, deadline, cap, stop, crash and recorded shapes.
Bug class: integration
Bug evidence: reproducer=tests/preview/journal-agent.test.ts
Hook bypass: none
Convergence: none
Decision: jev-repair-023135-accounting | Count both unavailable attempts and their UNKNOWN usage in the launcher assertions; keep runtime behavior and exact delivery assertions. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-jev-retry2-1011-repair-023135-PROGRESS.md
Decision: jev-repair-023135-evidence | Report WSL launcher refusals and missing saved Studio results honestly; do not weaken confinement or fabricate full-run evidence. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-jev-retry2-1011-repair-023135-PROGRESS.md
Decision: jev-repair-023135-pins | Regenerate the edited test source pin and register publication with delegated desk tooling; no manual hash edits. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-jev-retry2-1011-repair-023135-PROGRESS.md
Prompt review: No prompt or model-facing behavior changes. Only numerical assertions and explanatory comments change; existing recorded-shape retry tests are run as supporting evidence.

Subject: tests/preview/journal-agent.test.ts; register-source/owner-references/preview.json; generated/ (register replay).

Verification: Typecheck and build pass; architecture passes. The 24 existing Jev retry tests pass. WSL launcher tests refuse startup before the changed assertions; report them for Studio verification. Register publication regenerated from 290dd8ec with the delegated scripts.

## Closing block

simplestRobustRoute: This is the simplest robust route: update stale consumer assertions to the existing one-retry contract, with no new machinery. The existing start, deadline, cap and stop guards and exact single-send checks stay in force. This test repair makes no autonomous live-completion claim.
80/20: Verify the narrow assertions and existing retry boundary tests, typecheck, architecture, register and pinned checks. Studio owns full-suite and macOS launcher verification.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
