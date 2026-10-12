# Change review — Repair stale train-12 reply-review expectations

Subject base: 0aca7b9bc0f897614ccbcad3e16189b7cae4ec05
Review state: open
Reviewed content: none
Outcome: Restore the two fail-fast reply-review tests while preserving the approved compact runtime prompt and immutable recorded captures.
Affected rules: 12, 36, 37, 49, 70, 74, 101, 102, 111, 112, 113, 116.
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Test expectation repair only; no model prompt, parser, routing or runtime behavior changes.
Side effects: Historical replay compares the unchanged prompt suffix after exactly six known prose translations, each required to occur once. All other compared bytes and recorded model outputs remain exact. Owner source pins and generated publications are refreshed by the delegated desk tools.
Undo and recovery: Revert this repair and regenerate owner pins/publications with the existing desk tools; no live state is changed.
Multi-machine posture: Shared repository test expectations and generated pins apply equally on every host. Offline temporary journals and this report are machine-local verification artifacts.
Layer below: Read both constitutional documents in full; inspected 00641ee8 prompt diff, act-first replay translation, forum capture hashes, parser malformed-result controls, and production review question. Both failures reproduced before the repair.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->

Subject: tests/preview/reply-check.test.ts, tests/preview/reply-review-budget.test.ts, register-source/owner-references/preview.json, generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json

## Closing block

simplestRobustRoute: This is the simplest robust route: update one stale literal and reuse the already-approved six exact historical prose translations in the second affected consumer. No new runtime machinery, prompt change, budget expansion or weakening of safety floors. Start guard: original capture hashes; end guards: exact comparison and targeted tests; limits: existing provider output allowance and restart no-repeat checks. No new autonomous-capability claim.
80/20: Run targeted foreground replay and required cheap/READY checks; the Studio owns the full-suite and live gate.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

Decision: train-12-repair-043109-replay | Reuse the six exact train-11 prose translations already present in act-first, keeping recorded inputs and outputs immutable and runtime behavior unchanged. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-12-repair-043109-PROGRESS.md

Publication: Delegated desk rehash updated one owner source pin; inventory repin updated zero. build-register replay regenerated seven publications from f6064b942fc3831b3d835a31f7bda779f65179b1, generation sha256:2cd0e15a95fa82695855b55daa807fd220764dbfc9e1a336db1a08e7b9333d2f.
