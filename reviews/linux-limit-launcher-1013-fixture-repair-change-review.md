# Change review — Inherited launcher fixture headroom repair

Subject base: 434916b1e2431a0bbe4c7c2c148290da035eb2fb
Review state: open
Reviewed content: none
Outcome: The nested limit probe can read all six inherited limits without a fixed NPROC ceiling exhausting a populated host UID.
Affected rules: 13, 26, 34, 37, 44, 49, 60, 70, 74, 101, 102, 107, 111, 112, 113, 116.
Affected floors: secrets — no product change; spend cap — admission unchanged; stop — existing ownership and cleanup unchanged; no duplicate sends — send classification unchanged; durable intake — durable launch gate unchanged.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: One integration fixture correction and review traceability; no shipped implementation or model-facing change.
Side effects: The fixture queries the real UID census and inherited soft/hard NPROC limits before launching. Both requests remain finite and beneath the inherited ceilings, with the outer request strictly tighter. A host with insufficient remaining capacity fails explicitly before running the probe, rather than silently skipping it. Same-UID growth and invisible namespace tasks remain host limitations. No product ceiling is relaxed.
Undo and recovery: Revert the fixture repair commit; no persistent state, installed file, schema or migration is changed by this repair.
Multi-machine posture: Deliberately machine-local test configuration; Linux census counts threads and macOS census counts processes. No cross-machine state or ownership change.
Layer below: Read the full purpose and rulebook from origin/main. Inspected LIMIT_BODY and both argv builders in scripts/resource-owner.mjs: nested limit reads fork before lowering, and tighter soft/hard ceilings are retained. Inspected the separate below-capacity fork-refusal test, which is unchanged. Rule 44 inventory correction for the original unit: tests/preview/harness-user.mjs installLauncher calls installFile, which compares bytes and mode and atomically replaces changed installed launchers; the shared limit-exec.sh retains its existing shipped path. This repair changes only a fixture and requires no additional migration.
Bug class: integration
Bug evidence: reproducer=tests/integration/limit-launcher.test.ts
Hook bypass: none; core.hooksPath checked unset and the common hooks directory contains only sample hooks.
Convergence: none
Prompt review: No model prompt, model output parsing, semantic acceptance, escalation or refusal changes; recorded model-shape replay is not applicable.
Decision: linux-limit-fixture-headroom | Derive finite nested NPROC requests from the real UID census plus 256/512 tasks, clamp both beneath inherited soft/hard limits, keep outer strictly below inner and require more than 32 tasks of remaining fork headroom. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/linux-limit-launcher-1013-repair-140757-PROGRESS.md
Decision: linux-limit-rule44-inventory | Record the original installed MCP launcher's existing content-comparison and atomic-replacement update path under Rule 44; no new migration machinery is needed for a fixture-only repair. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/linux-limit-launcher-1013-repair-140757-PROGRESS.md

## Closing block

simplestRobustRoute: This is the simplest robust route: correct the nested test's capacity assumption using the existing platform-aware census and actual inherited ceilings, retain all six effective-limit assertions and the separate fork-refusal test, and leave product enforcement unchanged. Existing launch admission, durable go pipe, settlement and cleanup remain the start/end guards. No new service, configuration, controller, retry or quarantine is introduced.
80/20: Repair the single review must-fix, add Rule 44 traceability, verify the targeted file and finite-parent neighbor, and submit platform limits honestly for the Studio gate. No full suite or live-agent readiness claim.
VERDICT: author submission; no independent verdict asserted
