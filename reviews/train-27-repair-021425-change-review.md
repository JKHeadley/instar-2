# Change review — train-27 pipeline fixture repair

Subject base: fe7cd6ec2617242e8bdffe591a1762a856e6e8f4
Review state: open
Reviewed content: none
Outcome: Repair certificate tests that assumed supported publication and make native-loop neighbor fixtures own an exact child handle.
Affected rules: Purpose 3; Rules 26, 37, 49, 60, 70, 74, 101, 102, 105, 111, 113, 115, 116.
Affected floors: secrets — no custody changes; spend cap — no provider calls or accounting changes; stop — exact fixture child cleanup only; no duplicate sends — no sender changes; durable intake — no intake changes.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Only test fixtures and assertions change; no production behavior or certificate publication changes.
Side effects: Supported-certificate lint mutations use an isolated in-memory declaration; the actual shipped declaration is checked separately and is not certified by this test. Unproven adapter reporting is asserted, while the supported branch retains exact runtime/artifact/conformance checks. All three identical shell-launched neighbor fixtures now use direct child handles and await cleanup; a failed spawn cannot be parsed as PID zero and ESRCH cannot replace the underlying assertion. The forged-pid case writes the numeric child PID.
Undo and recovery: Revert this test-only commit. No durable state migration, production rollout or recovery action is introduced.
Multi-machine posture: Machine-local test children and in-memory declarations. Runtime mismatch is judged on the declared platform; composition byte drift is checked on every platform. Studio alone certifies the native macOS composition.
Layer below: Read parityMatrix/lintParityRegister, compositionClosure/compositionDigest, selfHostCompositionEvidence and ChildProcess lifecycle behavior; the old shell fixture could fail a fork or lose its neighbor and then mask the original failure during unconditional process.kill.
Bug class: integration
Bug evidence: reproducer=tests/types/shipped-clients.test.ts; reproducer=tests/preview/native-harness-contract.test.ts; reproducer=tests/preview/native-loop.test.ts; supplied Studio fast.log records the four failures.
Hook bypass: none; git config --get core.hooksPath returned unset; common hooks directory contains only .sample files.
Convergence: none
Decision: train-27-repair-021425-certificates | Keep the shipped native tuple unproven; test positive and negative certificate rules in memory, and assert actual adapter honesty without publishing support. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-27-repair-021425-PROGRESS.md
Decision: train-27-repair-021425-neighbor | Replace all three identical shell neighbor fixtures with observed direct child handles; retain live-neighbor assertions and await exact-child cleanup. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-27-repair-021425-PROGRESS.md

Subject (3 paths): tests/preview/native-harness-contract.test.ts, tests/preview/native-loop.test.ts, tests/types/shipped-clients.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: isolate certificate-checker fixtures from the mutable certification posture, assert honest deployed posture, and use the existing Node child handle for exact cleanup. No checker, production machinery, publication or authority is added. Start guard is observed successful spawn; end guard awaits child exit; the live-neighbor assertion remains. This test repair makes no unattended product-completion claim.
80/20: Run changed portable cases, typecheck, architecture, lint, register and change-review checks; the Studio gate owns native macOS confinement and certification.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
