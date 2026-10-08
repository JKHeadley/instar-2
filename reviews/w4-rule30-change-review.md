# Change review — R30e route coverage for both registered doorways

Subject base: 1c3447786f1ca9721b4b6b58774edc51eb59b1a3
Review state: open
Reviewed content: none
Outcome: repair missing proof coverage for the registered Codex doorway without changing product behavior or claiming native-harness certification. R30e inspected only the Claude conformance file although the deployed register enumerated both doorways.
Affected rules: 26, 30, 36, 37, 49, 70, 74, 101, 102, 108, 113, 115, 116
Affected floors: secrets — tests use isolated synthetic profiles and recorded scrubbed frames; spend cap — no paid calls and the over-cap neighbor must refuse; stop — the added route test requires no dispatch after stop; no duplicate sends — no sends, refused calls are counted and must not retry; durable intake — no product state or intake code changes
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: tests-only repair of a stale desk proof check, with no product, prompt, parser, register declaration or authority change.
Side effects: four new Codex route cases run in the existing adapter test file and add a small amount of isolated child-process work. The companion R.sh patch in the progress report includes this file and reads route results from both files, while requiring every test in both files to pass. Native-harness conformance remains explicitly unproven for Codex; no declaration is promoted.
Undo and recovery: revert this test change and undo the companion R.sh patch together; the old proof coverage failure returns. No persisted product state needs recovery.
Multi-machine posture: machine-local proof artifacts, deliberately. The new tests use temporary isolated directories on the test host. They neither read live agent stores nor send messages, and create no peer dependency.
Layer below: the deployed r-vitest.json has 65 passed tests and no failures, skips or todos; its native-harness file has four Claude route cases and no Codex route cases. r-probe.json enumerates both doorways and explicitly declares Codex native self-hosting unproven. The existing Codex fixture drives the unchanged registered route and parser using recorded real CLI frames. Its host IO replacement is confined to temporary synthetic executables and an injected timeout outcome.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: rule30-test-side-coverage | classify the recorded R30e failure as missing test coverage, not a demonstrated product defect: all 65 recorded cases passed, and the check queried a Claude-only fixture for Codex cases | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-rule30-PROGRESS.md
Decision: rule30-preserve-route-proof | add the same four route obligations to the existing Codex fixture and include its file in the desk check; do not exclude Codex, reduce the required case count, accept skips or relabel its native conformance supported | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-rule30-PROGRESS.md
Decision: rule30-desk-patch-handoff | provide the exact R.sh patch in the local report for the desk to apply, respecting the read-only Studio boundary; replay its actual expanded predicate against recorded and mutated results locally | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-rule30-PROGRESS.md
Deferral: none

Subject (1 paths): tests/assembly/production-codex-provider.test.ts

## Closing block

simplestRobustRoute: reuse the existing Codex recorded-frame fixture and registered doorway interface for the four obligations R30e already promises, and extend the existing proof predicate to both test files. This is that route. No product mechanism, new fixture framework, conformance claim or register state is needed. The concrete failure is a proof runner querying the wrong file for a newly registered doorway. Start guards are the existing clean deployed-tree check and route activation; end guards are all four cases per registered id plus the unregistered-id refusal; limits are the existing no-retry and invocation bounds with an injected timeout, not a load generator. No autonomous product completion is claimed.
80/20: author checks cover success, unknown charge, provider refusal, timeout, token overflow and stopped dispatch; the desk predicate replay preserves rejection of absent files, absent cases, failed/skipped/todo results and a new untested doorway. Full native harness certification and a fresh Studio group run are not claimed by this tests-only unit.
VERDICT: author submission; independent review belongs to the desk
