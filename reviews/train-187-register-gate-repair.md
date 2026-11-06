# Change review — train-187 register gate repair

Subject base: cfa082fed741515dc7534890045ff29725a00da0
Review state: open
Reviewed content: none
Outcome: Renew expired Codex model/subsidy metadata from recorded current evidence and reuse the existing register CLI test repair so child work yields to Vitest and independent fixture groups retain finite bounds.
Affected rules: 30, 37, 49, 55, 56, 60, 61, 69, 70, 74, 101, 102, 107, 111, 113, 116
Affected floors: secrets — only selected public model catalog fields and a source digest are retained; spend cap — no inference or paid probe and the existing ChatGPT-only guard remains; stop — no runtime change, child bounds retained; no duplicate sends — no effect or retry change; durable intake — all existing register/committed-source assertions remain.
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: Existing evidence metadata and test orchestration, no new authority, model selection, prompt, runtime acceptance or governing wording. Independent desk review remains required.
Side effects: The existing 2885119381ms freshness intervals remain unchanged; next expiry is 2026-12-09T13:06:14.638Z. Estimated subsidy ratio 1 remains an estimate justified by the existing subscription-only route, not a measured price or liveness claim. The owner test patch separates independent fixture groups without increasing their deadlines or removing assertions.
Undo and recovery: Revert this metadata/test repair and regenerate the register; retain the desk failure and OPEN RPC defect. Reverting metadata restores an expired entry and thus correctly refuses a current build.
Multi-machine posture: Catalog observation comes from the configured same-role Studio Codex home; it proves catalog presence, not another host's activation. Temporary register repositories remain local and bounded to one worker.
Layer below: The declaration expired at 2026-11-06T03:35:59.351Z during the supplied READY run. Current catalog observation at 2026-11-06T03:40:55.257112Z lists the unchanged gpt-5.6-sol model. Existing provider code checks ChatGPT sign-in at every call and reports actual charge unknown. Separately, Node synchronous register children block worker RPC; owner 99db9a096 already repaired those sites using the existing async helper.
Bug class: integration
Bug evidence: reproducer=tests/e2e/register.test.ts; other=docs/defects/vitest-worker-rpc-timeouts.md
Hook bypass: none
Convergence: none
Decision: train187g-owner | Import complete owning repair 99db9a0967837d7d10527c457263b50383464952; the test is byte-identical, the historical review base is rebound, and the defect merge preserves this branch's history while appending only the owner's new section. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-187-repair-PROGRESS.md
Decision: train187g-renew | Use the actual catalog fetched_at for the existing model verification and reviewed subscription-policy estimate, retaining IDs, billing semantics and freshness duration. Preserve stale/future refusals in the existing checker. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-187-repair-PROGRESS.md
Decision: train187g-publish | Commit source before replaying register outputs, then validate and publish the final committed tree; use only touched tests and cheap gates on the Studio. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-187-repair-PROGRESS.md

1.x comparison: actual JKHeadley/instar origin/main 79d83ec93a399c0cd5896871e3e8e29d83d3fc5c; searched src/, docs/specs/ and git history, inspected src/core/DoorwayRegistryReader.ts, src/scaffold/templates/jobs/instar/doorway-scan.md, docs/specs/doorway-scan-real-run.md, src/core/WorktreeManager.ts and docs/specs/test-runner-concurrency-bound.md; histories 35b02553b/269da957b/ab26b7ca3/5143e436f and ONEX-LESSONS section 6. Reuse the distinction between reviewed model knowledge and observed reachability, plus bounded asynchronous child orchestration. The 1.x free CLI-version scanner explicitly cannot verify model IDs; its scheduled notification machinery does not fit this evidence renewal. The existing 2.0 owner patch and async-child helper fit whole. No unrelated 1.x subsystem is copied.

Evidence: docs/release-evidence/train-187-codex-catalog-2026-11-05.json contains the sanitized actual observation and source digest. docs/release-evidence/train-181-register-repair-report.md is historical owner evidence only. Current source validation and final publication results are appended to the absolute lanes progress record and the subsequent generated-output review. The supplied eight-file gate retained four failures and one unhandled RPC error; this repair does not erase or claim exact attribution for that untraced error. No full saved report is fetched or fabricated.

## Closing block

simplestRobustRoute: Renew two expired evidence timestamps honestly and reuse the existing owner repair; keep model abilities, existing checkpoints and all assertions. No new runner, automatic evidence refresher or extended freshness interval.
80/20: One touched test file, current catalog observation, source-bound register replay, and final cheap gates. Full-suite qualification belongs to the pipeline; the RPC defect remains OPEN until that qualification.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
