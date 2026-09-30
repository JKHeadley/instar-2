# Change review — cb7-r90 pipeline repair: sandboxed runtime startup hang, paired self-state ratio, register e2e budget

Subject base: a115286a0851b6cf62bf3b7a5a45403dd71acbda
Review state: open
Reviewed content: none
Outcome: The Mama PC gate of cb7-r90 at a115286a failed three tests. (1) tests/preview/self-host.test.ts, the version-only update case, returned active null. The confined node child that re-proves the prior version hung. `sample` placed it in dyld initializers: CoreFoundation getpwuid_r, then notify_register_check, then a bootstrap_look_up that launchd did not answer for 25 s, so the probe hit its backstop and the restore failed. The profile denied mach-lookup with reporting, and launchd stalled replying to that reported denial. The lookup is still denied, now `(with no-report)`. Measured on this machine: 8 of 8 runs clean with the change, and 2 hangs in a 4-run control without it. The self-host conformance digest is re-declared for the changed profile. (2) tests/preview/self-state.test.ts read ratio 10.50 against 10. It divided two independent p95 tails on a linear derivation. It now takes the median of per-iteration paired ratios against 12: linear work reads at most 10, while n log n (about 14.3) and quadratic (about 100) still fail. (3) tests/e2e/register.test.ts's normal-workflow case took 125 s against a 120 s fixture budget. It takes 37 s isolated here and 51 s on the main tree, and earlier gates took 41 to 72 s, so the budget is now 300 s with its body unchanged. Both defect records carry the recurrence.
Affected rules: 2, 37, 74, 115, 116
Affected floors: secrets — unchanged (confinement still denies every mach-lookup, the environment stays empty); spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: the only non-test change is removing violation REPORTING from a denial the confinement profile keeps, so no permission widens; the rest is a test statistic, a fixture budget, a re-declared digest and defect records
Side effects: denied mach-lookups by a confined worker are no longer logged as sandbox violations; the self-host conformance digest and the register generation change
Undo and recovery: revert these commits; nothing durable changes format
Multi-machine posture: the profile is materialized per machine from the repository; the records travel with the repository
Layer below: deploy/macos/fixed-worker/worker.sb (deny default already covered mach-lookup); tests/preview/self-host-harness.mjs selfHostCompositionEvidence (conformance is the closure digest); docs/defects/preview-self-state-timing-flake.md; docs/defects/full-suite-load-timeouts.md
Bug class: integration
Bug evidence: reproducer=tests/preview/self-host.test.ts
Hook bypass: none
Convergence: none
Prompt review: no system prompt, provider policy or invocationPolicyDigest changed
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (paths): see the change-review check

## Closing block

simplestRobustRoute: fix each failure at its source with the smallest change. One profile clause stops the stalled violation report and the lookup stays denied. The ratio statistic now pairs samples that share the same contention. One budget constant is sized to measured work. No machinery is added and no case is skipped.
80/20: the full self-host (12/12), self-state (15/15), native-harness-contract, shipped-clients and fixed-worker-monitor-native files pass (48/48). Targeted register e2e passes. tsc, lint and register:check are clean. Both sides of the hang are measured. The full suite runs at the gate.
VERDICT: author submission; the independent verdict is recorded as a pass
