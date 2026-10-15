# Change review — preserve historical prompts after requested-verification guidance

Subject base: 3b52905f79eba23fcb5826843e9dc1de1fe5aea6
Review state: open
Reviewed content: none
Outcome: Repair the three failing gate assertions without rewriting recorded model evidence or changing product behavior.
Affected rules: 26, 36, 37, 70, 74, 101, 102, 113, 116
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — replay still proves one delivery after restart; durable intake — replay still uses the durable journal
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Three test assertion repairs following the existing shared guidance change; no runtime code or fixture bytes change.
Side effects: Historical prompt comparisons allow only removal of the named requested-verification addition, with an exact-one occurrence assertion. All other prompt bytes must still match. The measured tool prompt growth becomes 3275 bytes; packet and total-envelope budget assertions are unchanged.
Undo and recovery: Revert this test-only commit. No state, schema, migration or effect needs recovery; do not replay uncertain effects.
Multi-machine posture: Shared test source, deterministic on every host; no new machine-local or distributed state.
Layer below: Read the shared COMPLETE_REQUESTED_STEPS composition, historical fixtures, existing selfdesc-abilities compatibility assertions, and the default-context floor's real envelope and launcher checks.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains only sample hooks.
Convergence: none
Decision: train-41-repair-075420-history | Preserve historical captures and compare their exact system text to today's prompt minus the single later guidance addition, following the existing selfdesc replay pattern. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-41-repair-075420-PROGRESS.md
Decision: train-41-repair-075420-floor | Repin measured growth to 3275 bytes after the 508-byte instruction addition, retaining the actual packet and envelope budget guards. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-41-repair-075420-PROGRESS.md

Subject (3 paths): tests/preview/default-context-floor.test.ts, tests/preview/literal-copy.test.ts, tests/preview/train-12-capability-replay.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: update three stale test expectations using the existing historical-prompt comparison pattern. No product mechanism, prompt, parser, gate or captured evidence changes. Exact comparisons still reject unrelated prompt drift, one-copy assertions reject missing or duplicate guidance, and measured envelope checks still enforce the same resource bounds.
80/20: Run the three affected files, typecheck and required cheap and pinned-text gates; the Studio pipeline owns full-suite acceptance. The first targeted run passed all 10 tests, including historical delivered failures and corrected outputs through restart.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
