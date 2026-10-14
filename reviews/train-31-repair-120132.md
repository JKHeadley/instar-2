# Change review — train-31 parsing wiring test repair

Subject base: b28ce1410bcdcab753fd3dcd0b85eabf02ace29a
Review state: open
Reviewed content: none
Outcome: Keep the parsing-policy wiring test accurate after conversation answer decoding moved into its shared initial/collection helper.
Affected rules: 26, 37, 49, 70, 74, 95, 101, 102, 111, 112, 113, 116.
Affected floors: secrets — no runtime change; spend cap — no runtime change; stop — no runtime change; no duplicate sends — no runtime change; durable intake — no runtime change.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Test-only repair of a stale source-location assumption; no model-facing or runtime behavior changes.
Side effects: The test now reads the existing shared decoder and asserts both initial and collection delegations. It still enumerates all three readAnswer sites and verifies strict review policy, answer-only wrapper acceptance, and absence of direct parseModelJson calls.
Undo and recovery: Revert this test and record; no persisted state changes. Reversion restores the reproduced false failure for the extracted decoder.
Multi-machine posture: Portable repository test only; no machine ownership, replication, credentials or journal state changes.
Layer below: Read the edfd0a33 extraction diff, conversationSessionAnswer decoder, initial and collectModel callers, inline reply revision decoder, and per-consumer subscription policy. The third parser was moved, not removed.
Bug class: integration
Bug evidence: reproducer=tests/preview/model-json.test.ts
Hook bypass: none; core.hooksPath unset and the common hooks directory contains sample hooks only.
Convergence: none
Prompt review: No prompt or model parser behavior changes. The existing model-json tests retain captured-provider bytes and both accepting and refusing wrapper cases. No live-model acceptance claim.
Decision: train31-120132-smallest | Follow the existing shared decoder in the test rather than restore duplicated runtime parsing or undo accepted host repairs; retain exact parser-policy and caller coverage. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-31-repair-120132-PROGRESS.md

Subject (1 path): tests/preview/model-json.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: repair the source-wiring expectation at its new helper location, with no new production machinery. The reproduced failure is a stale test assumption, not a missing decoder. Existing role policy, complete-answer decoding and journal limits remain the start, end-state and limit guards. No autonomous-completion claim is made.
80/20: Reproduced the exact failure, then verified all 51 tests in the changed file. Run typecheck and the required cheap and pinned-text checks; the Studio owns the full suite.
VERDICT: author submission; independent review belongs to the desk
