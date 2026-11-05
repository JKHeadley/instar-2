# Change review — drain probe stdout before success

Subject base: b5806d1e015dc650cdc1dee2e0accab05a849d4b
Review state: open
Reviewed content: none
Outcome: Retain all access-probe rows when its pipe reader pauses by waiting for the existing stdout write callback before the existing successful exit.
Affected rules: 34, 42, 44, 70, 74, 95, 101, 102, 111, 113, 116
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake are unchanged; no new authority, accounts, effects or diagnostic output.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Repairs physical readiness evidence; a real pipe regression and negative control establish the source fix, while native installed acceptance remains a release gate.
Side effects: A successful probe waits for queued bytes instead of dropping rows. The consumer's existing 45-second timeout and 16MiB buffer ceiling still apply; malformed, missing and refused results stay refused.
Undo and recovery: Revert this change through the ordinary release path; no live image, installed launcher, journal or account was changed by this unit.
Multi-machine posture: Deliberately machine-local stdout transport on each host. The existing content-comparing atomic installFile path updates each installed launcher; no shared state is added.
Layer below: Inspected the real launcher's probe writes and exit, probeAccess complete-row checks and bounds, harnessReadiness refusal and installLauncher/installFile content replacement. The delayed real pipe receives only 774/2500 rows without the flush but all 2500 with it. Exit 0 alone does not establish complete proof.
1.x reference: JKHeadley/instar main b80413b4a708599896ea31cc597578a3786bf0a1; searched src/, docs/specs/ and git history for stdout drain/flush and probe transport. src/scheduler/ScriptCanaryRunner.ts writeStubProber uses write callback before exit (35b02553b); docs/specs/token-audit-completeness.md distinguishes exit from stream closure. ONEX-LESSONS.md area 2 and docs/specs/unified-session-lifecycle-robustness.md warn against treating an indeterminate probe as a positive state. No equivalent separate-identity probe was found in those searches; reuse the proven 2.0 two-line flush and sixteen-line subprocess test from 25662cf32f49ffacd09861283e52b0bff6a62909.
Bug class: live-path
Bug evidence: reproducer=tests/preview/harness-user.test.ts; live=docs/defects/2026-11-05-harness-probe-drain-minimal.md
Hook bypass: none
Convergence: none
Prompt review: No model prompt, model-output parsing or judgment change; only the OS access-probe producer waits for its pipe.

Decision: HPROBE-MINIMAL-1105 | Reuse only the proven stdout flush and real slow-reader regression, retaining existing refusal, identity and resource behavior. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/harness-probe-drain-minimal-1105-PROGRESS.md

Decision: HPROBE-MINIMAL-PUBLISH-1105 | Regenerate the existing shape-only publication from committed source and reopen inherited frozen publication scopes through existing tools; no product behavior beyond the flush. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/harness-probe-drain-minimal-1105-PROGRESS.md

## Closing block

simplestRobustRoute: This is the simplest robust route: drain the existing stream before its existing success exit. Start guards remain identity and probe syntax, end guards remain complete valid rows, and limit guards remain the existing timeout, buffer and authority boundaries. No new framework, retry or diagnostic is needed.
80/20: The failing negative control and passing real pipe establish the source repair. Full qualification, independent review and installed live acceptance remain owed to the desk's normal release gates; whole work stays OPEN.
VERDICT: author submission; this record asserts no independent verdict.
