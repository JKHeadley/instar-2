# Change review — train-187 repaired startup register publication

Subject base: e45576ff74973c3c945e5b2a3871a21d6fb2bf28
Review state: open
Reviewed content: none
Outcome: Publish the generated register for repaired source e45576ff74973c3c945e5b2a3871a21d6fb2bf28, generation sha256:8fdcefbbb2a0853f8380e66e00e633f4d6c864bf31fa2d7d0236c82c5e471a9b.
Affected rules: 49, 69, 74, 90, 101, 111, 113, 116
Affected floors: secrets — no credentials in generated output; spend cap — no runtime change; stop — unchanged; no duplicate sends — no effect replay; durable intake — unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: Derived evidence only from committed and targeted-tested source; no new authority or governing wording.
Side effects: Seven generated outputs bind the repaired source and actual native conformance evidence. Existing shape-only authority remains explicit; no handcrafted pin or success claim.
Undo and recovery: Revert source and regenerate the register from that committed source. Retained journal and effects remain unchanged.
Multi-machine posture: Generated metadata distributes through git; profile inspection remains deliberately machine-local.
Layer below: Existing register replay and actual committed source; reviews/train-187-startup-cache-repair.md contains current source evidence and owner lineage. 122 affected tests, tsc/build and 10/10 renewed native contract passed. Source-pin tools refreshed zero pins.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Deferral: generated/register.json:1 | not-a-deferral=Generated serialized pre-existing registry descriptions, not a new work postponement.

Subject (7 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json

1.x comparison: Inherit the committed repair comparison at actual JKHeadley/instar main 9b5790e8105f94c8ad6f13243d063e7c7efd23b6: src/core/SessionManager.ts, docs/specs/cli-login-expired-opens-repair.eli16.md, docs/specs/forkbomb-prevention-simple.md, src/docs/specs cache-name searches, git history and ONEX-LESSONS sections 4/6. No fitting signed-cache implementation in those inspected references; whole 2.0 owner repair 0c1d832a reused. Publication adds no feature beyond that reviewed repair.

Decision: train187-cache-publication | Replay seven register outputs from exact repaired source e45576ff7, then validate final committed tree without a new full-run report. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-187-repair-PROGRESS.md

## Closing block

simplestRobustRoute: This is the simplest robust route: use the existing committed-source replay and review process. Start guard is the exact tested source commit; end guard is matching generated output and cheap validation; no added machinery or autonomous live-answer claim.
80/20: Only the required cheap gates on final commit; full suite and new real answer remain the automatic Studio pipeline responsibility under the specific repair brief.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
