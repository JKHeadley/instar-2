# Change review — Supply measured synthetic windows to fresh-root launcher fixtures

Subject base: aa70b59248991cb41914950e557ad4dc6ca2d2f6
Review state: open
Reviewed content: none
Outcome: Fresh-root synthetic launcher fixtures declare their one-million-token test window and reach their intended behavior; the existing review declares Rule 42.
Affected rules: 37, 42, 49, 70, 74, 84, 101, 113, 116, 123
Affected floors: secrets — unchanged custody/redaction; spend cap — unchanged production admission; stop — unchanged checks; no duplicate sends — unchanged durable intent/outcome; durable intake — unchanged encrypted journal
Operator questions: none
Suggested tier: significant
Declared tier: ordinary
Tier rationale: Fixture metadata and review declaration only; no production code, prompt, parser or decision changes.
Side effects: Fresh synthetic journals now use the window-derived default. Existing-journal fixtures retain recorded limits. No production model receives a fabricated window.
Undo and recovery: Revert the fixture arguments and declaration. No production state or migration changes.
Multi-machine posture: Machine-local isolated test roots; existing conversation ownership and replication remain unchanged.
Layer below: Read purpose and rules; traced previewContextBytes before fresh journal creation and successiveWorld synthetic model; audited direct launch argv and shared cutover harness, distinguishing preseeded journals.
Bug class: integration
Bug evidence: reproducer=tests/preview/tools-default.test.ts
Hook bypass: none
Convergence: none
Decision: synthetic-fixture-window | Supply 1000000 tokens at fresh-root synthetic callers, including the shared cutover harness; retain preseeded journal limits and all production admission. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/context-default-1112-repair-PROGRESS.md
Team posture: Test-local metadata only; existing operator grants, member/guest boundaries, private-by-default ownership and sharing are unchanged, including team-of-one.

1.x comparison: inherited and rechecked JKHeadley/instar main db3ed6d3052cfcc24888b6c8bc86086abcfc2987, src/memory/WorkingMemoryAssembler.ts (2000 supplemental tokens) and docs/specs/context-budget-layered-summaries.md §9.5 (100K–1M session window, proposed 400K backstop); matching history fb0b84d3d, 5129779c3, ab26b7ca3. Preserve separate supplemental and whole-window budgets through existing 2.0 journal/summary/recall owners; no filesystem assembler import is needed for fixture metadata. Read ONEX-LESSONS.md memory/awareness and resource/testing areas on the Studio: exact payload, actual briefing delivery, retained originals and bounded test concurrency.
Rule 42 declaration: notice/status still derive refused versus unknown delivery from durable send outcomes; this repair adds the missing declaration without changing enforcement.
Evidence report: /Users/dabombstudio/.instar/agents/echo/.instar/lanes/context-default-1112-repair-PROGRESS.md.

Subject (11 paths, plus the existing review declaration): register-source/owner-references/preview.json, tests/integration/host-watch.test.ts, tests/preview/channel-source-launcher.test.ts, tests/preview/harness-login-launcher.test.ts, tests/preview/journal-agent-resources.test.ts, tests/preview/journal-cutover-harness.mjs, tests/preview/journal-overlap.test.ts, tests/preview/review-layers-canary.test.ts, tests/preview/runner-exit-reason.test.ts, tests/preview/self-state-launcher.test.ts, tests/preview/tools-default.test.ts

## Closing block

simplestRobustRoute: This is the simplest route: supply the same explicit synthetic window used by journal-agent.test.ts to every affected fresh-root fixture. Keep measured-window production admission intact; add no mechanism.
80/20: Reproduced the tools-on exit-1 failure before repair. Run the touched launcher files, tsc and cheap gates; the Studio pipeline owns the full test run.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
