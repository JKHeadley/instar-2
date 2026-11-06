# Change review — integrate the owned activation assertion repair

Subject base: d39609b1f166db219044206202b3f0cf7b550edd
Review state: open
Reviewed content: none
Outcome: Integrate exactly the existing notice-assertion owner patch into carryover-95 while preserving production behavior and all controls.
Affected rules: 26, 34, 36, 37, 49, 70, 74, 95, 100, 101, 102, 107, 111, 112, 113, 116
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake — existing runtime enforcement unchanged; only test readers and derived pins change.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Bounded test-only source integration and normal derived register refresh.
Side effects: Canary's legacy arbitrary-action credential matcher is removed in favor of the owner's exact activation renewal matcher. Model-route branch and its status-instruction refusal remain. Existing diagnostics, exact answers and negative controls remain.
Undo and recovery: Revert the integration and derived outputs together; no runtime state migration.
Multi-machine posture: Tests run locally in WSL; git distributes the assertion repair. Studio retains full, native, installed and live qualification.
Layer below: credentialDisplayLabel in tests/preview/credential-display.ts renders activation as your activation; credentialNotices in tests/preview/credential-reminders.ts appends the recorded smallestHumanAction. Existing answerOf functions validate every appended paragraph and separately reject model-route status instructions.
Bug class: unit
Bug evidence: reproducer=tests/preview/journal-agent.test.ts
Hook bypass: none
Convergence: none
Prompt review: No model-facing prompts or output parsing change. Captured infrastructure notices are test-only assertion inputs, inherited verbatim from the owner.
Decision: C95R2257-owner | Integrate only e7f0d6de54c3731784cd8740318e372c385339f5 from echo-deepseek-harness, attributed in reviews/train-173-notice-assertion-repair-change-review.md. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-95-cartographer-1105-repair-2257-PROGRESS.md
Decision: C95R2257-conflict | Resolve the canary matcher conflict to the exact owner matcher, removing the legacy arbitrary-action credential branch and retaining current diagnostics. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-95-cartographer-1105-repair-2257-PROGRESS.md
Decision: C95R2257-evidence | Exercise affected assertion cases and positive/negative controls; report distinct clock or host refusal without changing evidence timestamps or runtime expiry. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-95-cartographer-1105-repair-2257-PROGRESS.md
Decision: C95R2257-pins | Refresh derived pins and replay register from exact committed source, retaining manifest population and authority. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-95-cartographer-1105-repair-2257-PROGRESS.md

1.x comparison: Inherit the owner's researched comparison at 4e38b9fdaae43b62940a6a43e1e69094d1b91bd1. Independently searched actual JKHeadley/instar origin/main 028483097cb0a835a7d1264680a44dc4c2acb063 src/ and docs/specs/ for activation expiry, credential reminder and worker RPC; inspected src/monitoring/MissingLoginSessionDetector.ts and docs/specs/scrape-fixture-realness.md and histories ff8344b4b, 1f90fa1a9, 618560b3e, c91b8780e covering that source, src/core/hostTestRunnerSemaphore.ts and docs/specs/test-runner-concurrency-bound.md. ONEX-LESSONS sections 4 and 6 reinforce captured fixtures and bounded concurrency. Reuse the captured-byte discipline and existing 2.0 owner patch; missing-login detection does not implement this activation assertion. No product transplant fits this test-only integration.

Evidence: Assigned exact d39609b1 fast report has six declared activation-notice assertion signatures and zero unknown/unrelated failures, as stated by the desk brief. This is not independently re-read or generalized to a new head. Owner's captured 6 days 23 h and 6 days 22 h notice controls remain verbatim. Current targeted run at integration head 81518c5d3: 2 captured-notice control tests passed; 14 selected launcher cases failed before the notice assertions, with canary records naming bot identity refused; 8 cases were unselected. No expiry or clock repair is included. No earlier-head pass is claimed here.

simplestRobustRoute: Use the exact existing owning patch, resolve the one overlapping matcher to its narrower intended behavior, and run bounded consumer checks. No production code, competing regex, new mechanism, expiry extension or evidence retimestamping.
80/20: One cause and one repair; any distinct clock or native-host failure remains a separate causal obligation for the desk. Full exact-head and independent gates remain mandatory.
VERDICT: author submission; no independent convergence claimed
