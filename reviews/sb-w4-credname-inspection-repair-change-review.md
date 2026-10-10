# Change review — Preserve retrospective inspections independently of rejected findings

Subject base: 967ae2a73e2fb6d0399a8241898a7e679876ca35
Review state: open
Reviewed content: none
Outcome: The exact 967ae2a7 failed proof answer now completes I1b while its ref-less workaround finding remains rejected. An optional finding no longer erases an independently recorded inspection.
Affected rules: 9, 12, 16, 24, 25, 36, 37, 42, 49, 51, 58, 70, 74, 95, 101, 108, 111, 113, 116
Affected floors: secrets — only redacted journal capture; spend cap — existing admission and reserve unchanged; stop — existing checkpoints unchanged; no duplicate sends — no send path change; durable intake — case accounting and original journal unchanged
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Small model-output acceptance repair backed by the exact failed journal and adverse controls.
Side effects: A valid inspection declaration survives an optional finding rejection, carrying that rejection in its duty note. Invalid findings never enter the accepted finding list. Missing or unreadable inspection claims, missing producer evidence, malformed required duty parts, and legacy f claims without a corroborating finding still remain unavailable. Historical unavailable rows retain their meaning and reach the existing follow-up.
Undo and recovery: Revert this change and replay generated register evidence. No durable format change or journal rewrite is required.
Multi-machine posture: Pure parser behavior on every conversation owner; no new store, machine dependency, replication path, or restriction on tools or frameworks.
Layer below: Read the failed proofroom3 journal read-only, including both model-call outputs, held first result, supplied case packet, and final failed duty rows. Traced finding rejection and independent duty accounting in validateRetrospective and mergeDutyFollowUp; replayed worker reserve, stop, uncertain-call, recovery and I1d controls in the targeted file.
Bug class: live-path
Bug evidence: reproducer=tests/preview/retrospective-duty-followup.test.ts; live=tests/preview/fixtures/retrospective-duty-inspection-2026-10-09.json
Hook bypass: none
Convergence: none
Decision: inspection-vs-finding | Remove the recurring parser coupling while keeping finding rejection and explicit inspection evidence separate | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-credname-repair-PROGRESS.md
Prompt review: Removed redundant format coaching and corrected the inspection/finding relationship. No case-specific phrase or semantic keyword filter added. Exact historical answers are replayed without rewriting them; malformed neighbor shapes still cannot assert inspection.
Deferral: tests/preview/fixtures/retrospective-duty-inspection-2026-10-09.json:176 | not-a-deferral=Historical recorded evidence, parser compatibility comment, or TypeScript omitted-field selection; no implementation work is deferred.
Deferral: tests/preview/fixtures/retrospective-duty-inspection-2026-10-09.json:180 | not-a-deferral=Historical recorded evidence, parser compatibility comment, or TypeScript omitted-field selection; no implementation work is deferred.
Deferral: tests/preview/fixtures/retrospective-duty-inspection-2026-10-09.json:184 | not-a-deferral=Historical recorded evidence, parser compatibility comment, or TypeScript omitted-field selection; no implementation work is deferred.
Deferral: tests/preview/fixtures/retrospective-duty-inspection-2026-10-09.json:188 | not-a-deferral=Historical recorded evidence, parser compatibility comment, or TypeScript omitted-field selection; no implementation work is deferred.
Deferral: tests/preview/fixtures/retrospective-duty-inspection-2026-10-09.json:192 | not-a-deferral=Historical recorded evidence, parser compatibility comment, or TypeScript omitted-field selection; no implementation work is deferred.
Deferral: tests/preview/fixtures/retrospective-duty-inspection-2026-10-09.json:196 | not-a-deferral=Historical recorded evidence, parser compatibility comment, or TypeScript omitted-field selection; no implementation work is deferred.
Deferral: tests/preview/fixtures/retrospective-duty-inspection-2026-10-09.json:200 | not-a-deferral=Historical recorded evidence, parser compatibility comment, or TypeScript omitted-field selection; no implementation work is deferred.
Deferral: tests/preview/fixtures/retrospective-duty-inspection-2026-10-09.json:204 | not-a-deferral=Historical recorded evidence, parser compatibility comment, or TypeScript omitted-field selection; no implementation work is deferred.
Deferral: tests/preview/fixtures/retrospective-duty-inspection-2026-10-09.json:208 | not-a-deferral=Historical recorded evidence, parser compatibility comment, or TypeScript omitted-field selection; no implementation work is deferred.
Deferral: tests/preview/fixtures/retrospective-duty-inspection-2026-10-09.json:212 | not-a-deferral=Historical recorded evidence, parser compatibility comment, or TypeScript omitted-field selection; no implementation work is deferred.
Deferral: tests/preview/retrospective-duty-followup.test.ts:515 | not-a-deferral=Historical recorded evidence, parser compatibility comment, or TypeScript omitted-field selection; no implementation work is deferred.
Deferral: tests/preview/retrospective.ts:185 | not-a-deferral=Historical recorded evidence, parser compatibility comment, or TypeScript omitted-field selection; no implementation work is deferred.

Subject (4 paths): tests/preview/fixtures/retrospective-duty-inspection-2026-10-09.json, tests/preview/retrospective-duty-followup.test.ts, tests/preview/retrospective-live-failures-2.test.ts, tests/preview/retrospective.ts

Register evidence: Delegated rehash and repin tools ran with zero manifest/inventory changes. Replayed generated/ at 631f3c3d818d5437f2651bb03dbfc96820244ec7: 282 entries, 116 rules, 34 terms, unchanged shape-only authority. This record also covers the generated-source refresh.

## Closing block

simplestRobustRoute: This is the simplest robust route: remove the conditional that conflated looking with accepting a finding; keep the existing evidence validator and rejection note. Three prompt-only repairs had failed on different malformed optional fields. No retry, extra production model call, policy, or authority change. Start guards remain spend/stop admission; end guards remain valid duty accounting and finding validation; bounded follow-up is the limit guard. The real unattended proofroom3 answer now passes I1b through the shipped parser while its invalid finding remains refused.
80/20: Fifty-one targeted tests prove the exact recorded failure and both sides of acceptance; preserve the old evidence and the strict negative controls. One real claude-sonnet-5 call on the exact failed packet with the current prompt also completed I1b at 402 output tokens; fixture includes its raw output and prompt digest. Full-suite and fresh channel validation remain the automatic pipeline task.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
