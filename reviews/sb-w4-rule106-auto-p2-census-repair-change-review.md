# Change review — isolate native cleanup proofs from user census churn

Subject base: 68dd75006a9692b18953ddafb28bef80ba70b8cb
Review state: open
Reviewed content: none
Outcome: Use the existing bounded resource-owner test allowance for native-loop non-cap proofs so unrelated gate-worker churn does not consume the shared user-account fork margin. Include stderr in the forged-file assertion's failure diagnostics.
Affected rules: 1, 24, 25, 26, 34, 37, 49, 60, 61, 70, 74, 101, 102, 108, 112, 113, 115, 116
Affected floors: secrets — sandbox unchanged; spend cap — no provider calls; stop — real stop tests retained; no duplicate sends — no send-path edits; durable intake — no journal or intake edits
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Test fixture configuration and diagnostics only. Production ceilings, ability, admission, prompts and parsing are unchanged.
Side effects: The shared test owner permits at most 256 tree processes rather than 32, matching resource-owner.test.ts; the unchanged aggregate cap still applies. Dedicated cap tests construct their own original tight owners. This finite margin tolerates user-account churn but does not claim immunity to arbitrary host exhaustion. The saved gate omitted stderr; the injected census reproduces the result shape and demonstrates EAGAIN, not a recovered historical error message.
Undo and recovery: Revert this commit normally; no product-state migration. Reverting restores the smaller shared test margin and its susceptibility to parallel account churn.
Multi-machine posture: Deliberately machine-local macOS Seatbelt test fixture; no distributed state or peer requirement.
Layer below: resource-owner.mjs processLimit and LIMIT_SCRIPT lower RLIMIT_NPROC for the whole UID; native-tool-worker.mjs shell spawn error returns stderr and null exitCode; tests/integration/resource-owner.test.ts already uses finite processCount 256 for non-cap cases.
Bug class: integration
Bug evidence: reproducer=tests/preview/native-loop.test.ts
Hook bypass: none
Convergence: none
Prompt review: No model-facing source changed. Existing recorded native-step replay tests remain in the targeted file; no new model-facing behavior is claimed.
Decision: repair-census-fixture | Apply the existing finite non-cap fixture allowance; preserve all dedicated tight resource tests and production defaults. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-rule106-auto-p2-repair-PROGRESS.md
Decision: repair-census-minimal | Keep the two-sided real injected-census experiment in the report; omit its host-count-dependent temporary tests from the shipped change. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-rule106-auto-p2-repair-PROGRESS.md

Subject (1 paths): tests/preview/native-loop.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: reuse the existing resource-owner test allowance, with no production machinery or reduced ability. It prevents unrelated user-account process churn from exhausting a cleanup proof's fork margin. Start guards: real owner admission and sandbox; end guards: real planted files, next-call success, outside-neighbor survival and verified cleanup; limits: finite process allowance with original aggregate, memory, CPU, stop and test deadlines. Dedicated tight-ceiling cases remain negative neighbors. No autonomous completion feature is claimed.
80/20: Keep the repair to the test fixture and stderr diagnostics. An injected stale census proved both EAGAIN at 32 and success at 256 without load generation; the targeted file exercises real cleanup and caps. Historical failed full-run evidence stays failed and needs the pipeline rerun.
VERDICT: author submission; no independent verdict asserted
