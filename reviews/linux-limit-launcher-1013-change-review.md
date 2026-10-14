# Change review — Portable resource-limit launcher

Subject base: 0de16e3cdaea380ac746793123a51382aeb9830b
Review state: open
Reviewed content: none
Outcome: Linux and macOS launch providers and transports through the same bounded shim without Debian dash refusing ulimit -u before execution.
Affected rules: 1, 13, 26, 34, 37, 49, 60, 61, 70, 74, 101, 102, 111, 113, 116.
Affected floors: secrets — shell startup code cannot consume handoff input; spend cap — existing Six admission unchanged; stop — gate and cleanup paths unchanged; no duplicate sends — transport outcome classification unchanged; durable intake — launch gate still opens only after its durable row.
Operator questions: none
Suggested tier: significant
Declared tier: ordinary
Tier rationale: Physical launch adapter repair, preserving core admission and per-process kernel limits.
Side effects: Bash is required at /bin/bash, present on supported Linux and macOS installations. Both shim forms exec Bash with -p, retaining the PID and ignoring environment-sourced shell code. Linux counts UID threads rather than process rows; the finite UID allowance is at least 16 tasks so a Node transport with four process slots can start. The existing sampled tree process ceiling is unchanged. Linux root or CAP_SYS_RESOURCE/CAP_SYS_ADMIN can evade NPROC; same-UID concurrency or hidden namespace tasks can exhaust the shared allowance early. No per-tree hard memory or process confinement is claimed.
Undo and recovery: Revert the commit together with the generated file shim. No persistent schema, migration, or production state changes.
Multi-machine posture: Machine-local kernel limits deliberately; Linux counts threads and macOS counts processes. Cross-machine ownership, spend, durability and allocation are unchanged. Existing installations receive the script through the same shipped adapter update path.
Layer below: Read both governing documents fully and verified their bytes match origin/main. Inspected dash's actual rejected -u operation, Bash execution and inherited kernel limits, Linux getrlimit(2) RLIMIT_NPROC thread semantics, both shim consumers, the durable fd3 launch gate, Six allocations, and the process inventory's independent sampled bounds. The new real child tests inspect all six limits and both gate dispositions.
Bug class: integration
Bug evidence: reproducer=tests/integration/limit-launcher.test.ts
Hook bypass: none; core.hooksPath unset; common hooks directory contains only sample hooks.
Convergence: none
Prompt review: No model prompt, output parser, semantic acceptance, escalation or refusal policy is changed. This is OS launch plumbing; no live journal replay or real credentials are needed.
Decision: linux-limit-shell | Re-exec the common shim through /bin/bash -p; retain the external /bin/sh argv contract, request position, PID, durable gate and all soft/hard ceilings. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/linux-limit-launcher-1013-PROGRESS.md
Decision: linux-limit-task-census | Count Linux UID threads with ps nlwp, retain macOS process counting, and bound the Linux launch allowance to max(16, requested process slots) to accommodate one Node runtime without dropping NPROC. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/linux-limit-launcher-1013-PROGRESS.md
Decision: linux-limit-honest-posture | Report the UID bound's unit and retain sampled tree bounds; root, capabilities, shared UID contention and hidden PID namespaces remain explicit limitations. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/linux-limit-launcher-1013-PROGRESS.md

Decision: linux-limit-composition-pin | Refresh the affected composition byte pin; the declared macOS runtime and contract remain unchanged, with its platform execution owed to the Studio gate, not claimed on WSL. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/linux-limit-launcher-1013-PROGRESS.md

## Closing block

simplestRobustRoute: This is the simplest robust route: reuse the existing limit body under the shell that implements its options, and count the resource Linux actually limits. No new launcher service, native executable, configuration knob or confinement system. Start guards are existing admission and the durable go pipe; end guards are existing settlement and verified cleanup; kernel limits are lowered, never raised. The new live child probes and existing provider/transport tests exercise the shipped path without real logins or sends. Independent landing acceptance remains with the desk.
80/20: Correct one shared launcher cause once, verify child limits and affected callers, record remaining host-dependent failures without claiming Linux confinement or a green full gate.
VERDICT: author submission; no independent verdict asserted
