# Change review — isolate the native tree resource fixture

Subject base: 6edf7458fa608f25258a4ca2838dbb9ac537c897
Review state: open
Reviewed content: none
Outcome: The native resource-boundary fixture measures the launch tree independently of shared-user fork headroom. Ordinary work retains its positive assertion; memory and process violations must report the actual owner interruption, and all four launches must have verified cleanup.
Affected rules: 26, 34, 37, 49, 60, 70, 74, 101, 102, 111, 113, 116
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged. No production source or configured resource ceiling changes.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Test fixture isolation and stronger assertions only; the shipped resource owner and native tool path are unchanged.
Side effects: Only the tight tree-ceiling fixture injects an unavailable user-ID process-count reading through the owner's existing query port. Its real tree census, start identity, sandbox membership, working-directory observations and cleanup remain enabled. The owner's kernel UID limit remains covered separately in tests/integration/resource-owner.test.ts. The process assertion no longer accepts a generic fork error as proof of tree-limit enforcement.
Undo and recovery: Revert this commit to restore the combined UID/tree fixture. No installed data, migrations or recovery actions are involved.
Multi-machine posture: Deliberately machine-local test observations; each host's production limits and conversation ownership are unchanged.
Layer below: Read both constitutional documents in full and confirmed their bytes match origin/main. Inspected createResourceOwner processLimit, limitedArgv, run, census and cleanup; native runWorker and workerOutput; the resource-owner kernel-limit tests; and the existing Vitest RPC defect. The six-process UID allowance is computed before spawning and can be consumed by unrelated workers. A pid-less shell spawn reports empty stdout and null exitCode. The supplied failure excerpt omits stderr and interrupted, so it does not prove this was the specific Studio interruption. The revised macOS case remains the consumer verification owed to the Studio gate.
Bug class: none
Bug evidence: none
Verification evidence: npm ci completed; npm run typecheck and node scripts/check-architecture.mjs passed. Targeted native-loop portable selection passed 4 tests: selective observation injection, native framing, parser boundaries and retained recorded-output replay. The macOS sandbox case is not claimed run on WSL. No full-suite pass is claimed. The supplied runner RPC timeout remains red evidence under docs/defects/vitest-worker-rpc-timeouts.md; no starving test is identified in the brief and no speculative global runner alteration is made.
Hook bypass: none; core.hooksPath was unset and the common hooks directory contained sample files only. Plain git commit, no stash or history rewrite.
Convergence: none
Decision: LPD-205412-tree-subject | Isolate the unavailable UID observation only in the tight tree-limit fixture and require an actual processes interruption; shared-account fork churn is not evidence of a launch-tree violation. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-login-pool-default-1012-repair-205412-PROGRESS.md
Decision: LPD-205412-rpc-evidence | Retain the supplied unlocated RPC timeout as red gate evidence under the existing desk-owned defect; do not invent a cause or alter unrelated test scheduling without a trace. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-login-pool-default-1012-repair-205412-PROGRESS.md
Prompt review: No model-facing prompt, parsing, acceptance, escalation or refusal behavior changes. Existing retained output replay was included in the portable selection; it is not new live-model evidence.

simplestRobustRoute: Use the resource owner's existing query port to separate the test's tree resource subject from the shared-user subject, then strengthen its interruption assertions. Start guards remain admission and real process observations, end guards remain verified cleanup, and memory/process/CPU/handle/stop limits remain the production owner's. No new product mechanism or autonomous-completion claim.
80/20: One fixture repair, one selective-injection regression, targeted portable checks and a macOS consumer handoff. No quarantine, raised product limits, fabricated full-run report or unrelated runner rewrite.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
