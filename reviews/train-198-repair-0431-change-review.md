# Change review — train-198 repair: run evidence stays on the host clock

Subject base: 253ba24d03df0875ef7d8d3450f1f64c283c2b36
Review state: open
Reviewed content: none
Outcome: The train-198 gate refused every model-provider proof because workers stamped them on the shifted test clock while the Vitest main process stamped the report start on the host clock. Keep run evidence on the host clock so a current proof passes under the test clock and a stale proof still fails. Repair the grounding ledger and boot receipts in the same change, because the two later gate checks compare the same clocks. The renewal logic and the check strength are unchanged.
Affected rules: 1 and 26 the checks still verify current run state; 34 and 37 gate evidence stays real and the suite stays green; 42 a stale proof stays a refusal; 70 reproducer and both-sides test; 74 this record; 95 the checks keep failing closed; 107 evidence submitted as it is; 111 layer below read; 113 posture stated; 116 simplest route stated.
Affected floors: secrets — none touched; spend cap — no model call or limit added; stop — no stop path touched; no duplicate sends — no send path touched; durable intake — no intake path touched.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Test infrastructure and gate evidence checks only; no product source, authority or live state changes, but the checks guard landing.
Side effects: Under a shifted run, proofs, ledger rows and receipts now carry host time rather than test time. The process exit row gains clockShift; a row without it reads as zero, which refuses a shifted run. Unshifted runs keep identical stamps and comparisons. Date.hostNow exists only under the test-clock preload. Nothing outside tests/ and the gate scripts changes, and dist is unchanged.
Undo and recovery: Revert the repair commits and regenerate the register and inventory pins with the existing desk tools. No state or migration is involved; proofs and ledgers are rewritten by the next gate run.
Multi-machine posture: Machine-local by design. Each host stamps and checks its own run evidence; a split gate already binds the single-process arms to the local half, and the shift is recorded per host in that host's exit row. The model-provider check keeps the merged report's earliest start, which is on the host clock of each half.
Layer below: Read tests/setup/test-clock.mjs and test-clock-env.ts, Vitest 3.2.7's JSON reporter (report startTime from the main process, file windows from worker test results), scripts/gate-report-checks.mjs check order, split-report localHalfReport, and every startTime or endTime reader in scripts/. Measured a real local run: report start 2026-11-07T12:33:16Z, file window and proofs 2026-10-22T21:40Z.
Bug class: integration
Bug evidence: reproducer=tests/unit/test-clock-evidence.test.ts; detail=at 253ba24d a real local run stamped proof V1 at 2026-10-22T21:40:02Z against a report start of 2026-11-07T12:33:16Z, so startedAt was below startTime for every proof; after the repair checkModelProviderCoverage passed for all four owners over 38 real proofs and refused the same proofs for a later report
Hook bypass: none
Convergence: none


1.X FIRST: Searched JKHeadley/instar main 03a4ea22a26ff404ae4d51fc4c2fe502057fbd31 through the GitHub code search for performance.timeOrigin (no match) and for test-clock shifting under tests/setup (0 results); searched startedAt, proof and stale, and read the match scripts/locked-proof/driver.mjs, which compares Date.parse(createdAt) with startedAt on one clock. Grepped the in-repo legacy-1x tree for assertion proofs and clock shifts (no match). ONEX-LESSONS.md is not in this worktree. Fit: 1.x has no shifted test clock, so there is no behavior to carry; its one-clock comparison is the same principle applied here.

Prompt review: No model prompt, output parser or judgment criterion changed. The repair touches test infrastructure, gate scripts and generated register output only.
Decision: train-198-host-clock-proofs | Stamp evidence on the host clock rather than moving the report start onto the test clock, because every shifted run starts at one fixed test time, so that clock cannot tell a stale proof from a current one. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-198-repair-0431-PROGRESS.md
Decision: train-198-host-clock-later-checks | Repair the grounding ledger and boot receipts in this change though the brief names only the provider proofs, because check-p5 and check-assembly compare the same clocks and would refuse the next gate for the same cause. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-198-repair-0431-PROGRESS.md
Decision: train-198-host-clock-file-window | Record the shift in the existing main-process exit row and move Vitest's file windows to the host clock in the check, rather than rewriting the digest-bound report. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-198-repair-0431-PROGRESS.md

Subject (22 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, reviews/train-198-repair-0431-change-review.md, scripts/check-assembly-contracts.mjs, scripts/check-boot-conversation-evidence.mjs, scripts/model-provider-contracts.mjs, tests/assembly/production-boot-conversation-evidence.test.ts, tests/assembly/production-boot-conversation.shared.ts, tests/assembly/production-grounding-evidence.mjs, tests/assembly/production-grounding-inventory.json, tests/assembly/production-grounding-process-evidence.mjs, tests/model-provider/review/assertions.mjs, tests/preview/README.md, tests/setup/host-clock.d.mts, tests/setup/host-clock.mjs, tests/setup/test-clock.mjs, tests/unit/test-clock-evidence.test.ts

Publication: Existing desk repin chain updated two inventory support pins and the inventory digest. Desk owner rehash changed no owner pins. The register was generated at the repaired source commit with the existing build-register tool.

## Closing block

simplestRobustRoute: This is the simplest robust route: one helper exposes the host clock the preload already holds, three existing evidence writers use it, the existing exit row records the shift, and two checks move file windows. A shifted comparison for everything would be smaller but could not refuse a stale proof, because each run restarts at the same test time. Rewriting the report would break its digest binding. The stale-proof guard, exit-row binding and fail-closed checks remain.
80/20: Targeted provider, grounding, boot-evidence and clock tests plus the real coverage function ran on WSL. The whole-report gate checks, launcher and macOS tests remain with the gate hosts, as the builder report states.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
