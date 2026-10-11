# Change review — preserve the historical topic-awareness packet proof

Subject base: f24f9d426e0bb5412a1366ad17b0994a0e35765d
Review state: open
Reviewed content: none
Outcome: The private-chat regression test retains its afa6be39 digest while accounting for the memoryDecision wording already changed in f589c692. It verifies current guidance separately and restores only that historical field from the existing immutable live capture before hashing. All other packet bytes remain covered by the original digest.
Affected rules: 26, 36, 37, 49, 70, 74, 96, 101, 102, 111, 112, 113, 116
Affected floors: secrets — no runtime changes; spend cap — existing limits unchanged; stop — existing checkpoints unchanged; no duplicate sends — recorded replay and delivery checks retained; durable intake — journal and captured source records unchanged.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Test-only repair of a historical comparison following a previously reviewed prompt change; no prompt, parser, admission, authority or runtime change.
Side effects: Only the known memoryDecision difference is normalized in the test. The original digest still detects changes to audience, memory facts, provenance, history, ordering and other packet fields. Current memory guidance and its schema are asserted before normalization. Existing forum cases still check topic attribution and reply routing; nothing is skipped or quarantined.
Undo and recovery: Revert this test and review commit; no data or runtime recovery is required. Reverting the assertion restores the known failure against the already-shortened guidance.
Multi-machine posture: Machine-local test comparison only. No shared state, ownership, replication, network behavior or runtime placement changes.
Layer below: Compared afa6be39 journal.ts memoryDecision construction with f589c692 and the inrole-memory-live-2026-10-11.json capture. The existing recall-latency historical comparison already reconstructs this same historical protocol. The topic-awareness recorded intake and model replay exercise the worker and original digest, proving the observed mismatch is confined to that field.
Bug class: integration
Bug evidence: reproducer=tests/preview/topic-awareness.test.ts
Hook bypass: none; core.hooksPath is unset and the hooks directory contains only samples.
Convergence: none
Decision: train8-topic-historical-field | Preserve the old digest and restore only the reviewed field from the existing capture, asserting current guidance separately; no production rollback, increased cap or new fixture is needed. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/inrole-act-live-repair-PROGRESS.md
Prompt review: No model-facing change. Existing topic-awareness cases replay real updates 969390330–969390332 and two subscription-model outputs through context construction, parsing and captured delivery. Historical wording comes from the committed inrole-memory capture. This test-only repair claims no new model judgment or live deployment.

Subject (1 paths): tests/preview/topic-awareness.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: repair the stale comparison at its source using an existing immutable capture, keep the original digest and verify current guidance. No runtime machinery is added. Start evidence is the gate's single failing test; end evidence is all 11 targeted cases passing. Existing resource, authority and effect guards are untouched; no autonomous shipped-path completion is claimed.
80/20: Run the one affected test file in the foreground at nice -n 10 with --maxWorkers 1, typecheck and all cheap gate checks. Preserve the saved failed full-run evidence unchanged; the pipeline supplies the fresh full-suite result. This author submission claims no independent convergence.
VERDICT: author submission; the pipeline records its independent verdict
