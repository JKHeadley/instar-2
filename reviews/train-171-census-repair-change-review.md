# Change review — restore bounded census and installation teardown

Subject base: 5ae95cc05d5943528204622ea70490d23d29da0c
Review state: open
Reviewed content: none
Outcome: A long unrelated argv no longer blinds the current-user process census; existing launch accounting and cleanup can again settle. Real npm installation fixtures reclaim their dependency tree and isolated cache asynchronously within their installation budget.
Affected rules: 22, 26, 32, 33, 34, 36, 37, 41, 49, 60, 61, 63, 70, 74, 101, 102, 105, 107, 111, 112, 113, 115, 116
Affected floors: secrets — argv payloads are no longer collected; existing custody unchanged; spend cap — unchanged; stop — existing identity and sandbox joins retain cleanup authority; no duplicate sends — unchanged; durable intake — unchanged.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Repairs a physical observer used by resource accounting and stop cleanup, without changing authority, ceilings, membership or model decisions.
Side effects: Inventory command labels now contain executable names rather than arguments. No consumer uses that label for membership or resource admission. The adapter digest changes with the requested columns. The exact native self-host certificate and source-bound register evidence must follow the tested composition.
Undo and recovery: Revert the repair and regenerate evidence if qualification disproves it. Keep the supplied failed gate and all earlier passing history; do not treat a failed census as empty or release an unresolved allocation.
Multi-machine posture: Each host observes its own physical processes, deliberately machine-local; shared ownership, replication and invocation policy are unchanged. The same ps comm column is available on macOS and Linux. The conformance declaration certifies only its existing darwin/runtime tuple.
Layer below: Read hostQuery's execFile buffer/failure handling, ps field selection, Ten decoding and membership joins, resource-owner sampling and cleanup, the real npm installer and fixture lifecycle. Read the composition closure/digest and the existing native contract before re-declaration.
Bug class: integration
Bug evidence: reproducer=tests/assembly/process-inventory.test.ts
Hook bypass: none
Convergence: none
Prompt review: No prompt, model parser, acceptance/escalation/refusal policy or agent ability changes. The existing media and native-loop recorded-shape tests are retained.

Decision: TRAIN171-CENSUS | Reuse the 1.x argv-free comm census: actual command output exceeded the existing host-query byte bound. Preserve the query bound, all identities/readings and incomplete-census refusal instead of raising the buffer or weakening cleanup. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-171-repair-PROGRESS.md
Decision: TRAIN171-TEARDOWN | Await asynchronous removal of the real installation and isolated npm cache under the installation's existing 120-second budget; the default 10-second hook ceiling caused the supplied failure. Keep the real install and every assertion. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-171-repair-PROGRESS.md
Decision: TRAIN171-CERTIFY | On the Studio, run the existing native contract before deriving the new certificate with compositionClosure/compositionDigest. Preserve its supported tuple and all other parity states; regenerate source-bound evidence with the delegated desk tools. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-171-repair-PROGRESS.md

## 1.x FIRST

Actual JKHeadley/instar main d7788fa3348ce079ae5590002d807fc59d12ac50 was confirmed with ls-remote. Searched src/, docs/specs/ and git history before implementation. Reuse the argv-free comm= observation design in src/monitoring/ExternalHogProcTable.ts and src/localVerify/orchestratorSeams.ts; docs/specs/external-hog-zombie-autokill-sentinel.md specifies cumulative time, start identity and comm=. Inspected history ab26b7ca36c1375d855f08c9a6a66e84e2b656e2 and 6deb97877b76a9fe89fc922381a1d86723cf9d17. This is a repair of the existing 2.0 observer, not a new process manager or feature replacement. Keep Ten's stricter partial-census refusal and the existing sandbox joins. The 2.0 npm hook mismatch does not require a 1.x migration replacement: src/core/MigratorStepEngine.ts and its history were inspected; production migration behavior remains unchanged. Read ONEX-LESSONS.md section 6 for resource scope, production assembly evidence, bounded test concurrency, target-safe cleanup and migration parity.

## Evidence and limits

The supplied full gate stays red in retained evidence: one M5 npm teardown failure and fourteen Studio census/accounting/cleanup failures. Before edits, a read-only local census reproduced ERR_CHILD_PROCESS_STDIO_MAXBUFFER at 1,048,576 bytes; the otherwise identical comm census succeeded at 202,315 bytes. No command arguments were printed or retained. The new injected regression supplies the maximum 4,096 rows and oversized hypothetical argv without starting a load workload; every identity and resource reading is preserved, while failed, malformed and over-limit observations remain non-complete. The real-host inventory and sandbox probes pass.

All 44 tests across mcp-setup, media-understanding and session-work-tmux pass. The real npm install and teardown finish; two successive sessions and a stopped session leave their helpers gone; Six returns the media allocation after verified cleanup. Twenty-four selected native-loop cases pass, including tool cap, FIFO stop, detached cleanup and hostile workspace-file controls. Five existing cases that allocate load or issue broad sandbox signals were deliberately not invoked locally under the standing builder charter; they remain in the unchanged full-suite inventory for the pipeline. No quarantine or changed acceptance bound was added. Typecheck passes.

Changing observer bytes initially produced the sole R105 stale-composition certificate finding. The named native contract then passed on Studio before the declaration changed (13.398 seconds). The existing digest utility derives the new certificate over 275 files as sha256:6ac421cba4d136c34a0c246f68189ec848deb59fd828014c95e15696d92d4321 on node-24.14.1@sha256:91d3afb67a7dc211f642f2328f822505ff1c1ad381e98ffdd21b003970deeeda. This repairs evidence rather than hiding the mismatch or weakening conformance. After updating the declaration, all 10 native-harness-contract tests passed (26.275 seconds), including exact certificate, owned launch, stop, journal replay and injected readiness/deadline controls; all 15 inventory tests passed again. Final cheap-check and pushed-head results are recorded in PROGRESS.

Rules 22/102: resolve the observer and certificate problem within the authorized repair. Rules 26/36/41/49/60/61: preserve source-bound observations, fail-closed uncertainty and physical cleanup/accounting, proved through real host and injected negative neighbors. Rules 32/33/63/113: no new store; deliberate host-local readings, fixture-only roots, unchanged shared state. Rules 34/37/70/74/107/112: source repair with positive/negative evidence and honest pipeline qualification; earlier red and green results retained. Rules 101/105/111/115/116: no bypass, exact native recertification after the contract, layer-below inspection and reuse of the existing observer. CB6-MF-A, CB7-R90 and CB1-MF5 remain OPEN, with their existing owners and recheck conditions. This does not claim universal physical confinement, live whole-feature acceptance or equality with a deployed invocationPolicyDigest.

Subject: scripts/process-inventory.mjs, tests/assembly/process-inventory.test.ts, tests/preview/mcp-setup.test.ts, src/assembly/harness.declarations.json, derived register publication and required source pins.

## Closing block

simplestRobustRoute: Request only the existing observer's needed process fields and give real fixture cleanup its own asynchronous installation-sized lifecycle. Reuse the native contract and certificate utility; preserve agent ability, all floors, uncertainty and resource ceilings without another runtime mechanism.
80/20: The reproduced shared cause is repaired and targeted consumers pass. The pipeline owns the full run, including the five locally unrun native cases; this submission asserts no independent verdict or live rollout.
VERDICT: author submission; the review desk records its own verdict.
