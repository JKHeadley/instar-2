# Change review — train-176 fail-fast fixture and register repair

Subject base: 8debc3502f4143fff7585f402f78649f339f2024
Review state: open
Reviewed content: none
Outcome: Restore current Codex catalog evidence and exercise each reported crash, restart and register boundary without aggregate synchronous-child starvation or premature HTTP timeout.
Affected rules: 24, 26, 34, 37, 42, 49, 55, 56, 60, 69, 70, 74, 95, 101, 102, 111, 112, 113, 116
Affected floors: secrets — only synthetic credentials and sanitized catalog evidence; spend cap — actual charge stays unknown; stop — bounded child waits and signal assertions retained; no duplicate sends — restart assertions retained; durable intake — all crash, pending-state and committed-source assertions retained.
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: Existing fixture repairs and evidence-backed declaration renewal, with generated publication. No product prompt, model selection, authority or runtime behavior changes.
Side effects: Independent crash/register cases are reported separately and await the existing async child helper. Launcher startup uses the established 30-second fixture budget per stage. Non-timeout HTTP tests request the existing owner's coordinated 10-second fixture window; timeout tests retain the original 100ms admitted bound and deterministically inject abort before or after server arrival. A failed response cannot print the intentional crash marker. Codex freshness and estimated subsidy are renewed from retained evidence, never widened or relabeled as measured.
Undo and recovery: Revert this repair and regenerate the register. Disposable test roots are machine-local. Reverting the evidence renewal restores the correctly expired model-map refusal. Preserve all earlier red evidence.
Multi-machine posture: Committed tests, declarations and evidence travel through Git. Child processes, HTTP endpoints and temporary journals are machine-local; catalog presence does not establish another machine's login, capacity or model reachability.
Layer below: Read the constitution; inspected async-child.ts spawn/close/timeout semantics, provider fixture authority bounds and real fetch, server request recording, crash-worker marker ordering, journal restart counters, register committed-graph replay and existing RPC defect history. Existing modelEntryFresh still rejects future and expired times.
Bug class: integration
Bug evidence: reproducer=tests/e2e/model-provider-path.test.ts; other=docs/defects/vitest-worker-rpc-timeouts.md
Hook bypass: none
Convergence: none

1.x comparison: Searched actual JKHeadley/instar main 234fa37563dfb6ec8ba0c8c8e0deb7514b61db34 src/ and docs/specs/ for model-map/freshness and HTTP/test timeout behavior, plus git history. Inspected src/core/DoorwayRegistryReader.ts, docs/specs/model-registry-freshness-guard.eli16.md, docs/specs/DOORWAY-MODEL-KNOWLEDGE-REGISTRY-SPEC.md matches, docs/specs/test-runner-concurrency-bound.md and histories ab26b7ca3/1f90fa1a9/618560b3e/e1a1b7218/95b289eef. Read ONEX-LESSONS section 6. Reuse explicit freshness/unknown evidence and bounded asynchronous test orchestration via existing 2.0 mechanisms; no exact 1.x signed-register/owner-crash implementation fits. The inherited train-176 comparison at 22463d0b6a372aedb33f5f1b756e13bae89ab807 and cache owner comparison remain in earlier reviews.

Decision: shared-repairs | Reuse complete relevant files from existing owners: register fixture and catalog renewal 5eefd6fd921cb93fb3f241a152bd71b76302b9a2 (register source owner 99db9a0967837d7d10527c457263b50383464952); round-seven cases e673e8d8c4d349374ee63684dd33ab3745c95901; provider crash proof 480f815741b5e670b92bec8b7b606ebd91e64df4; launcher waits 07b2106d590d0167b3790287468177f561ecbe2a; deterministic HTTP aborts d4532ed52bb6bb43c2d63a01a77e785ae1e81cdc. Do not duplicate their mechanisms or pull unrelated fixes. | reported=reviews/train-176-gate-repair-change-review.md
Decision: provider-composition | Combine the two existing fixture options (invocationTimeoutMs and timeoutSignal), retaining their original defaults. Apply the existing 10-second invocation window to the ordinary integration cases that require a completed HTTP request; the two deadline tests still assert 90/100ms and the before-arrival test asserts zero requests. | reported=reviews/train-176-gate-repair-change-review.md
Decision: catalog-evidence | Import the owner's sanitized catalog observation at 2026-11-06T03:40:55.257112Z and unchanged model, ratio 1, estimated basis and 2885119381ms intervals. This proves listing only, not inference, live acceptance or measured pricing. Retain per-call authentication and unknown accounting. | reported=reviews/train-176-gate-repair-change-review.md
Decision: publication | Source commit 4f0e58dfd1a363e6336eaf882b286f6a3206e199 was replayed with the existing register builder after delegated owner-manifest rehash and chain refresh. Generation sha256:c6e3119c2bc6fa094f1de070a63eb121777faa3573394498b3109c16a281ceb8 retains 298 entries, 121 rules, 34 terms and shape-only authority. | reported=reviews/train-176-gate-repair-change-review.md
Decision: checks | Run only changed test files serially with nice -n 10, plus tsc and final lint/register/review checks; the Studio pipeline owns the full suite. No load generator or fabricated report. | reported=reviews/train-176-gate-repair-change-review.md

Inherited evidence: docs/release-evidence/train-181-register-repair-report.md is historical owner evidence; docs/release-evidence/train-187-codex-catalog-2026-11-05.json is the exact sanitized catalog observation. The owner comparison at 79d83ec93a399c0cd5896871e3e8e29d83d3fc5c inspected DoorwayRegistryReader.ts, doorway-scan.md, doorway-scan-real-run.md and histories 35b02553b/269da957b. It separates reviewed model knowledge from reachability. Source parent and exact replay results for this repair are recorded in the absolute lanes progress files; no independent verdict is claimed.

Prompt review: No model-facing prompt, parsing or semantic accept/escalate/refuse path changes. The existing real-process tests use fixture responses to verify infrastructure. No fresh live-model acceptance is claimed.

## Closing block

simplestRobustRoute: This is the simplest route: reuse already-written async fixture repairs and a real catalog observation, coordinate existing test bounds, and regenerate through the delegated desk tools. Start guards remain admitted authority and exact test roots; end guards remain observed child exit, HTTP response, signed durable history and exact assertions; finite timeouts and one worker bound execution. No new runtime machinery or ability reduction.
80/20: Target the supplied failures and preserve every refusal/positive neighbor; keep full-run qualification with the pipeline and retain old failures as evidence.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
