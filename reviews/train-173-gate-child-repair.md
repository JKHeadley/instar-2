# Change review — reuse owned register and proof child repairs

Subject base: 669e02ab496041361bafa4f4e11cc7f633a06656
Review state: open
Reviewed content: none
Outcome: The register bridge matrix yields while CLI children run, and proof status preserves child failure before parsing output. Slow successful status remains observable.
Affected rules: 9, 14, 26, 34, 37, 38, 42, 43, 60, 73, 74, 95, 101, 102, 113, 116
Affected floors: Secrets, spend cap, stop, no duplicate sends and durable intake retain their existing runtime enforcement. This change repairs test execution and evidence collection only.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Two existing test fixtures change; no runtime capability, authorization, prompt, parser, production deadline or constitutional wording changes.
Side effects: Delegated desk rehash refreshes the 15 existing proof-file pins in register-source/owner-references/part-nine.json; no inventory entries or authority change. Independent register matrices repeat setup but retain every acceptance and refusal assertion. The committed bridge fixture uses the adjacent full-graph 120-second hang ceiling. Proof status uses the existing bounded async port; nonzero exit or signal is reported before JSON parsing. An injected 11-second status delay exercises the former 10-second timeout without host load.
Undo and recovery: Revert these test patches together and regenerate affected source evidence through the existing tools. The reverted fixtures recover their former timing vulnerability; runtime state and operator data are untouched.
Multi-machine posture: Test fixtures remain local temporary repositories and launcher roots. Asynchronous waiting accommodates a slow host without changing committed-source authority or production proof deadlines; Git carries the same assertions to each host.
Layer below: Existing tests/e2e/async-child.ts runChild and tests/preview/journal-cutover-harness.mjs statusOf/statusOn ports. No new scheduler or process collector.
Bug class: none
Bug evidence: The desk supplied a 60-second register bridge timeout and an empty-output JSON parse at proofs-launcher.test.ts:157. The owning repairs address these same fixture boundaries; the supplied bounded excerpt is retained in the conversation and canonical progress records.
Hook bypass: none
Convergence: none
Prompt review: No model-facing text, output parsing or accept/escalate/refuse policy changes. The status JSON here is deterministic CLI evidence, not model output.
Deferral: generated/register.json:1 | not-a-deferral=Existing generated governing text; publishing this fixture repair adds no deferred work.
Decision: train-173-gate-owned-repair | Apply the exact owned test patches from 47d59ce25a948229b23774218c50e5b259977828 and 944b258c3c248496ac7f4bed40a807d507eab649 plus cc47685ea57621eb8710272982df34ed29d04dab, preserving their controls and acceptance conditions. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-173-repair-PROGRESS.md

1.x comparison: Actual JKHeadley/instar origin/main 154a09ffd44749ceac6205e4a95a9df4c56f4659 was searched in src/, docs/specs/ and Git history. Read src/core/hostTestRunnerSemaphore.ts and docs/specs/test-runner-concurrency-bound.md; inspected CARTOGRAPHER-SWEEP-EVENTLOOP-SAFETY.md and conformance-gate-timeout.md matches, history 1f90fa1a9/618560b3e/c91b8780e/681f86543/e1a1b7218, and ONEX-LESSONS.md section 6. Reused the bounded, yielding, workload-specific waiting principle. The 1.x suite admission semaphore does not fit this local 2.0 child-evidence boundary, so reuse the existing 2.0 async ports and the named owning repairs instead of copying a global scheduler.

Validation: The full proof-launcher file passed 9/9, including the slow-child and unwritable-log cases; tsc and build passed. The five changed register cases passed at nice 10 with one worker (documentation 56.377s, calls 62.673s, pins 40.717s, missing bridge 23.236s, committed bridge 72.550s); exact outputs and final lint/register/review results are recorded in the canonical PROGRESS. Full-suite execution belongs to the Studio pipeline. The slow-child regression proves successful status past the old deadline and refusal of an unsuccessful child; bridge controls cover both missing ambient/clean and committed working/clean graphs, plus stale-roster refusal.
simplestRobustRoute: This is the simplest robust route: reuse the already-owned repairs and existing async ports. The extra readStatus helper prevents a named child failure from becoming a misleading JSON parse error; separate register matrices keep independent full-graph work inside bounded fixture deadlines without dropping checks.
80/20: Repair the two demonstrated fixture causes, verify the affected files and final cheap gates, and let the existing Studio pipeline perform the full qualification run.
VERDICT: author submission; no independent convergence claimed
