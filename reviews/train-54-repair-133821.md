# Change review — detached-child memory fixture isolation

Subject base: d5a62c4f30693dee9177eb089009d47f3f25cb5c
Review state: open
Reviewed content: none
Outcome: Let the detached-child memory regression reach the real tree memory ceiling without a competing shared-UID fork allowance.
Affected rules: 13, 26, 37, 49, 60, 70, 74, 101, 102, 111, 112, 113, 116.
Affected floors: secrets — no runtime change; spend cap — no runtime change; stop — real owner cancellation retained; no duplicate sends — no send path changed; durable intake — no journal implementation changed.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Test-only reuse of an existing injected query filter; no product or model-facing change.
Side effects: The two detached-memory cases no longer exercise RLIMIT_NPROC for the shared UID; dedicated resource-owner integration tests retain that coverage. Tree census, process identities, sandbox and working-area joins, memory sampling, exact interrupted=memory outcome, kill count and cleanup assertions remain real and unchanged. The filter test also verifies another UID's count still delegates.
Undo and recovery: Revert this test/review change; no state, migration or runtime recovery required. Reversion restores the shared-UID race exposure.
Multi-machine posture: Machine-local test observations deliberately; no distributed state or ownership changes.
Layer below: scripts/resource-owner.mjs processLimit computes current UID population plus launch.processCount, and run passes it to limitedArgv. Concurrent unrelated growth can exhaust that allowance before fork. Existing treeLimitQuery in native-loop.test.ts already isolates the six-process tree test; reuse it for the eight-process detached-memory test. tests/integration/resource-owner.test.ts retains hard UID allowance and unavailable-count checks.
Bug class: integration
Bug evidence: reproducer=tests/preview/native-loop.test.ts
Hook bypass: none; core.hooksPath unset and common hooks directory contains sample hooks only.
Convergence: none
Decision: train54-detached-memory-uid-isolation | Reuse treeLimitQuery for the detached-memory owner rather than raising the memory/process ceilings or relaxing the assertions; filter only the shared UID count and preserve real tree observations. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-54-repair-133821-PROGRESS.md

The provided Studio gate failed the inside-volume case with exitCode 1 instead of memory interruption after 440 ms. The bounded excerpt contains no stderr: shared-UID fork pressure is a source-supported diagnosis, not a captured errno. Portable filter/parser checks run on WSL; real detached-child sandbox verification remains a macOS gate duty. No full-suite or live completion claim.

simplestRobustRoute: This is the simplest robust route: apply the existing exact query filter to the remaining small-ceiling fixture. Start with real launch admission, retain finite memory/process and cleanup guards, and require the unchanged memory interruption and dead-child assertions on the Studio. No production safeguard changes, new machinery or unattended-completion claim.
80/20: Keep the repair confined to the test's competing limit and a negative filter neighbor; retain the exact-head Studio test gate and all inherited release duties.
VERDICT: author submission; no independent verdict or live acceptance claimed
