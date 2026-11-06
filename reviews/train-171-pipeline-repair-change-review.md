# Change review — preserve host exclusions and bound intake fixture work

Subject base: b932b7f716a64998a782b4aff94d23107b59e55f
Review state: open
Reviewed content: none
Outcome: M5 CLI exclusions reach every inline Vitest project, leaving Studio tool tests on Studio. Intake-owner uses the existing ordered fixture lane and reads each immutable committed artifact once.
Affected rules: 37, 49, 70, 74, 99, 101, 102, 107, 111, 112, 113, 116
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Test-gate scheduling and selection change, with no product behavior or acceptance assertion change.
Side effects: CLI exclusions now apply to ordinary and serial projects; intake-owner runs after ordinary files in a fresh isolated worker. No test is removed from the combined host inventory.
Undo and recovery: Revert this repair if qualification disproves it; preserve the failed gate and targeted evidence. The pipeline must qualify the exact pushed head before integration.
Multi-machine posture: Scheduling is machine-local. The existing M5 command supplies exclusions for the Studio half; each host retains its intended files, and the complete inventory is their disjoint union. No runtime shared state changes.
Layer below: Read Vitest 3.2.7 resolveProjects and configureVitest dispatch: cliExclude is omitted from inline-project overrides, and the public hook runs after project configuration before discovery. Inspected loadOwnerReferences: its existing show port supplies bytes, while every load still checks ownership, path, hash, manifest shape and decoder claims.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Prompt review: no prompt change.

Decision: TRAIN171-REPAIR-1 | Reuse the public project hook to apply the root's parsed CLI exclusions; actual discovery reproduced the ignored --exclude. No custom CLI parser or second host list. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-171-repair-PROGRESS.md
Decision: TRAIN171-REPAIR-2 | Reuse the ordered fixture lane for the measured intake-owner timeout, and cache exact Git bytes at its fixed commit through the existing loader port. This removes repeated subprocess work while preserving all positive and hostile assertions and existing deadlines. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-171-repair-PROGRESS.md

## Evidence

The supplied gate at the subject base stays red: seven failed assertions in four files and one unattributed RPC error. The three Studio-dependent preview files passed in the supplied Studio half. Actual pre-repair discovery still selected trust-setup despite its explicit CLI exclusion (1070 files).

Typecheck and build pass. Worker-limit passes eight tests, including actual CLI discovery with repeated and equals-form exclusions, both project types, positive Studio selection and exact combined inventory. Its existing asynchronous rendezvous proves ordinary overlap, serial ordering and fresh forks without CPU load. Intake-owner passes all 24 cases; the formerly timed-out manifest case takes 13,084 ms locally. Its negative matrix retains bad artifact hashes, foreign owners and missing decoders; broken receiver and alias chains still refuse. Different host conditions mean this is not a benchmark against the supplied M5 duration.

The initial targeted run passed worker-limit but could not collect intake-owner because this fresh checkout lacked dist/index.js; after the build, intake-owner passed. This setup failure remains recorded in the progress evidence. Architecture/lint and register checks pass before commit; final committed-head checks are recorded in PROGRESS. The full suite is reserved for the pipeline by explicit operator direction. The unattributed RPC error is not declared independently closed by a targeted run.

Rule 99 accounting from the integration review remains: promised-result blocker rechecks and deadlines are unchanged. No model prompt, parser or model acceptance boundary changes, so no new live-shape replay is claimed or needed. No 1.x feature is replaced; this repairs the existing test infrastructure.

Subject (4 paths): vitest.config.ts, tests/unit/test-worker-limit.test.ts, tests/register/intake-owner.test.ts, docs/defects/vitest-worker-rpc-timeouts.md

## Closing block

simplestRobustRoute: Apply parsed exclusions through the existing Vitest project hook, and reuse the existing serial lane and loader show port. No new scheduler, skip, runtime boundary or larger timeout.
80/20: Both changed test files pass and all original assertions remain. Full-suite qualification belongs to the pipeline; original red evidence remains visible.
VERDICT: author submission; this record asserts no independent verdict.
