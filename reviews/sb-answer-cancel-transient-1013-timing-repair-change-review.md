# Change review — Observe physical timeout and synchronize capacity proofs

Subject base: 28155b1d9ff7836698a110997bf0307697145d96
Review state: open
Reviewed content: none
Outcome: The timeout proof counts physical model dispatches and verifies timeout termination even when startup has not written its log; the Six capacity proof observes child readiness and explicitly releases completion.
Affected rules: 1, 26, 37, 49, 60, 70, 74, 101, 102, 111, 113, 116; purpose constraint 3.
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — one model dispatch remains asserted; durable intake — unchanged. Only test observation and fixture synchronization change.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Two test repairs; no production source, model prompt, parser, policy, or acceptance behavior changes.
Side effects: The subscription test observes the actual physical timeout result instead of assuming the CLI writes its log within 100 ms. The capacity fixture adds a 350 ms startup delay and waits for an explicit release file; finally blocks release and await all launched work. Existing physical launch deadlines bound failure paths. No timers, subprocess functions or resource limits are mocked.
Undo and recovery: Revert the two test changes and this review. Existing per-test cleanup removes fixture roots after awaited children settle.
Multi-machine posture: Deliberately machine-local temporary children and files; no shared production state or cross-machine protocol changes. The Studio must verify its own physical launch shim; WSL's /bin/sh refuses that shim's ulimit -u.
Layer below: Read production-provider.ts command dispatch and preflight deadlines, production-boot-io.mjs delegation to hostResources, resource-owner.mjs physical timer, launch gate, Six admission and cleanup, and limit-exec.sh. The model timeout begins before CLI startup can write commands.jsonl; a capacity debit is held until physical cleanup returns it.
Bug class: integration
Bug evidence: reproducer=tests/assembly/production-provider-subscription.test.ts
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains only sample hooks.
Convergence: none
Decision: timeout-physical-evidence-1013 | count the physical model launch and assert its timeout/SIGKILL result rather than require the CLI to log before timeout | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-answer-cancel-transient-1013-repair-111517-PROGRESS.md
Decision: six-readiness-release-1013 | replace elapsed-time startup and completion assumptions with bounded readiness observation and explicit release on both capacity branches | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-answer-cancel-transient-1013-repair-111517-PROGRESS.md

Subject (2 paths): tests/assembly/production-provider-subscription.test.ts, tests/integration/resource-owner.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: observe the existing physical timeout result and synchronize the real child fixture with one release file. The start guard remains the production launch gate; the end guard asserts timeout termination or successful serial/concurrent completion; existing physical deadlines bound waiting and finally blocks drain children. A longer sleep cannot guarantee readiness or preserve a state for a delayed observer. No production machinery is added and no autonomous-completion claim is made.
80/20: The two Studio assertions identify observation races. The repair preserves the real timeout and both sides of Six capacity enforcement, with injected slow startup rather than CPU load. Local physical verification encounters the unchanged WSL shell's unsupported ulimit option; portable checks and precise host limitations are reported separately. Independent acceptance remains with the desk.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
