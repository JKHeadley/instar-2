# Register intake CLI fixture execution budget on WSL

Status: repair under verification. Owner: Echo, sb-w4-credname-narrow builder.

On 2026-10-09, tests/e2e/register.test.ts's P3-P4-P5 owner-resolution and broken-intake-wiring case timed out at 60,023 ms on Mama PC. The foreground run used nice -n 10 and --maxWorkers 1 alongside one other serial targeted test runner. On identical test source in isolation it passed all assertions in 56,558 ms. The original failed result remains evidence; the passing rerun does not clear it.

The case copies the repository and executes eight register CLI fixtures: one valid graph, six invalid wiring variants and one wrong owner. Its old execution budget had about 3.4 seconds of headroom even in isolation. The repair uses 120 seconds, matching the neighboring register CLI fixture's execution budget, with all assertions, child bounds and product limits unchanged. This is a bounded fixture hang detector, not a product latency requirement. No skip or quarantine hides the case.

Verification must execute every register E2E case and retain the initial failed result alongside the repaired run. Evidence is in the sb-w4-credname-narrow handoff report and local logs under /home/echo/.instar/agents/echo/.instar/state/sb-w4-credname-narrow-evidence/. The desk receives the report at /Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-credname-narrow-PROGRESS.md.

Multi-machine posture: test execution is machine-local; the bounded fixture budget and this record travel with the repository. Undo: restore the 60-second timeout if the fixture work is reduced and verified with headroom.
