# Change review — train-231 self-description attribution replay repair

Subject base: 1d2ec318a1058a19dd0478f918d0d9625c7daf24
Review state: open
Reviewed content: none
Outcome: Repair the six self-description replay failures by translating the exact former write-only attribution inventory sentence to train-231's intentional note-and-reply sentence. Keep captured bytes, full briefing equality, historical judge digests and all existing negative checks unchanged.
Affected rules: 34, 36, 70, 74, 78, 84, 101, 102, 111, 113, 116, 121
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged. Test-only expectation repair adds no model call or runtime behavior.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Fourteen test lines, including an exact-match and near-miss regression; no product, constitution, fixture or generated-file edits.
Side effects: The replay recognizes the declared attribution scope expansion. It still rejects unrelated capability drift, changed retirement wording and a near-match attribution sentence. Historical PASSes remain evidence only for their original inputs, not certification of the expanded attribution check.
Undo and recovery: Revert this repair commit; no persistent/runtime state changes. The six stale-expectation failures would return.
Multi-machine posture: Checkout-local replay tests; identical assertions on every host. No machine-specific behavior or state introduced.
Layer below: Inspected tests/preview/README.md's preview.attribution-check declaration, generated/capabilities.json, capabilityBriefing and the currentChannelNote historical adapter. The original train review explicitly expanded the check from notes to notes and replies and shortened that line to preserve the context floor. Inspected actual 1.x sources and the existing digest-bound recorded fixtures.
Bug class: integration
Bug evidence: reproducer=tests/preview/selfdesc-abilities.test.ts
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains sample files only. Plain git commit.
Convergence: none
Prompt review: No runtime prompt, parser or acceptance decision changes. Existing authentic self-description captures replay unchanged: updates 6232224, 6232229, 840342287, 840342355 and 840342414, including five rendered-paragraph answers, ten unchanged-question answers, authentic PASS/FAIL digests and the formatting-negative handling already asserted by this file. This repair changes only the historical inventory translation; it makes no claim of a new live-model run.
Decision: train-231-fix-expectation | The expanded attribution scope is intentional, supported by the existing runtime and declaration; update only its exact historical translation and add the near-miss neighbor. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-231-fix-1109-PROGRESS.md
Prompt finding: 0d4664ea9de7 | protocol-literal | Existing standing-trust prompt equality in the touched replay file; unchanged by this repair, not a semantic keyword gate.
Prompt finding: 14d7eeccc218 | protocol-literal | Existing standing-trust prompt equality in the touched replay file; unchanged by this repair.
Prompt finding: 45e37ea2e9e9 | protocol-literal | Existing standing-trust prompt equality in the touched replay file; unchanged by this repair.
Prompt finding: 4b98dc2a1b9f | protocol-literal | Existing historical tool-label translation and exact equality; unchanged by this repair.
Prompt finding: 95e349aaf4ac | protocol-literal | Existing standing-grant wording translation and exact equality; unchanged by this repair.
Prompt finding: 9781075d458e | protocol-literal | Existing doorway refusal prose equality; unchanged by this repair.

1.x FIRST: Searched actual JKHeadley/instar origin/main f62d3246125d7dd4c8101c3a3fe8bac8e58c4a1b src/ and docs/specs/ for self-description, capability inventory and attribution. Read src/core/attribution/AttributionJudge.ts, docs/specs/attribution-paper-trail.md, src/core/BootSelfKnowledge.ts and docs/specs/session-boot-self-knowledge.md; inspected history c3529b2f7b4902540f7526afb0698f2a82646237, aeef135a8a7cd1f64eb1237f0d22471acbd231af and ab26b7ca36c1375d855f08c9a6a66e84e2b656e2. Read ONEX-LESSONS.md memory/coherence area, including self-coherence-parallel-work-attribution. The parent train reused paragraph-first chunks, whole-text exact facts and strict answer validation from 6cbe44c819cd97aec1d9c7f470b04148fbca708d. Note-and-send attribution and truthful capability context fit; this failure is specifically the 2.0 historical fixture adapter, so reuse that adapter rather than importing unrelated 1.x runtime code.

Verification: Before: 6 failed / 5 passed, all at the attribution inventory line. After: 12/12 pass, including exact old line, already-current line and unexpected wording. Architecture checks pass. build-register --check passes (generation f09d94f2, 307 entries, 122 rules). Final pushed-head gate results are in the progress report. The desk reports tests/e2e/register.test.ts also fails on base 227; its cause belongs to the desk and is not repaired here.

## Closing block

simplestRobustRoute: Translate one exact declared inventory line in the existing historical replay helper and prove unexpected wording remains visible; this is the simplest robust route and adds no runtime machinery.
80/20: Reproduce the six failures, repair their shared cause, verify recorded evidence and mandatory gates; no full suite or unrelated runtime repair.
VERDICT: author submission; no independent acceptance or live readiness claimed
