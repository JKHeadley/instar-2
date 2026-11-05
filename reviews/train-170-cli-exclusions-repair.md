# Change review — retain CLI host exclusions in every Vitest project

Subject base: de4b48d78d1228beb6346334f1284baaab4b34df
Review state: open
Reviewed content: none
Outcome: Restore the desk's host partition: Studio-assigned tests no longer run on m5pro as well, while every test remains selected exactly once across the two hosts.
Affected rules: 26, 34, 35, 37, 49, 55, 60, 74, 101, 102, 107, 111, 112, 113, 116
Affected floors: secrets — production custody unchanged; spend cap — production accounting unchanged; stop — production enforcement unchanged; no duplicate sends — production dispatch unchanged; durable intake — production storage unchanged.
Operator questions: none
Suggested tier: significant
Declared tier: ordinary
Tier rationale: Test selection infrastructure only. No test assertion, production capability, prompt, parser, admission checkpoint or host prerequisite is weakened. The full suite still requires both halves.
Side effects: The existing Vitest parser supplies CLI exclusions to all inline projects as well as the root; exclusions compose with the existing platform list and serial fixture separation. Ordinary targeted positional filters and default whole-suite discovery remain intact.
Undo and recovery: Revert this change to restore the previous configuration. No production state or migration is involved; the previous configuration would again run excluded host-dependent files on m5pro.
Multi-machine posture: Repair the existing two-host test partition without changing either host list or inheriting split environment state into child gate checks. Verify completeness and disjointness through actual CLI discovery.
Layer below: Inspected the desk m5pro-gate-remote.sh CLI construction and Studio selection, Vitest 3.2.7 normalizeCliOptions (--exclude becomes cliExclude), resolveProjects (CLI project overrides omit cliExclude), and config resolution (cliExclude appends to exclude). Reuse public parseCLI instead of implementing a second argument parser.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none

Decision: train-170-cli-exclusions | Propagate parsed CLI exclusions through the shared project exclusion list; retain existing host lists, all assertions and project ordering. The demonstrated defect is configuration propagation, not missing product ability or a test requiring quarantine. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-170-repair-PROGRESS.md

## 1.x comparison

Searched actual JKHeadley/instar origin/main `fd741cf528b8fefae3c1b41198f3d3218cde952e` src/ and docs/specs/ for Vitest splitting/exclusion and host placement. Read `src/localVerify/shardPlan.ts`, `docs/specs/local-verify-merge-authority.md` (Balanced shards), `src/core/PlacementExecutor.ts` (channel eligibility), `docs/specs/placement-platform-workspace-aware.md`, and matching history including `fc0e9c5eda966d584275b8161d6378419ed08e72` (balanced shards). ONEX-LESSONS.md section 1 records the wrong-workspace placement incident.

Retain the 1.x invariants: placement must match host capability, and partitioning changes where a test runs, never whether it runs; every file belongs to exactly one half. Its duration-balancing algorithm and product channel eligibility do not fit this 2.0 inline-project CLI propagation defect. No unrelated 1.x subsystem is copied. The implementation reuses the existing 2.0 project construction and Vitest parser. No production carryover is removed.

## Evidence and limits

The supplied red m5pro run executed the Studio-assigned files too: real Codex launch, local transcription, and the harness-account ACL failed on m5pro; all five cases passed in the supplied Studio half. The new actual-CLI discovery regression fails on the old config because exclusions are ignored. After the repair, all eight tests in `tests/unit/test-worker-limit.test.ts` pass, including default selection, both environment splits, repeated CLI exclusions across ordinary and serial projects, equal-sign globs combined with the environment split, exactly-once coverage, and existing process scheduling/isolation controls. Typecheck passes.

Read-only discovery with the actual desk union of macos-only.txt and m5pro-studio-only.txt selects 1020 remote files and 31 Studio files: 1051 total, disjoint and complete. This executes no test suite. Targeted logs, the regression's original red result, architecture and final committed-head cheap checks are retained in the desk progress record. The supplied full-run red evidence remains red; the pipeline owns a fresh whole-suite run after push. No deployed acceptance or closure of existing blocked constitutional items is claimed.

## Closing block

simplestRobustRoute: Supply the existing parser's exclusions to the existing projects. Keep all production behaviors, test assertions, host prerequisites, finite waits and serial fixture ownership. Prove selection using the real Vitest CLI instead of mocking configuration fields.
80/20: One configuration fix, one focused regression file and this review record address the five failures at their shared routing cause. Targeted tests and cheap checks run here; the pipeline reruns the full suite.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
