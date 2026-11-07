# Change review — The harness probe waits for its rows to reach the reader before it exits

Subject base: 22cb6c1ea6d11511ee54a6ceaac0f7c8a499137d
Review state: open
Reviewed content: none
Outcome: The harness launcher's access probe writes its rows once and exits only after the write completes, so a slow reader (sudo's relay on a busy Studio) receives every row; readiness no longer holds every Claude Code launch as "the harness launch is not permitted" because the tail of a /private/tmp-sized probe was dropped. A short row count now leaves a [harness-probe] incomplete line instead of failing silently.
Affected rules: 8, 22, 37, 92, 116
Affected floors: secrets — unchanged; the probe prints only path, mode, ok and error code, never file contents, and the kernel deny proof keeps every /private/tmp entry; spend cap — unchanged, no model call; stop — unchanged; no duplicate sends — unchanged, no send path touched; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: One output-flush repair in the launcher's read-only probe mode plus one diagnostic line; no new effect, authority, store, provider or call kind, and the probe's checks and its full path list are unchanged.
Side effects: Reproducer "delivers every probe row to a slow reader" gave 841 of 9000 rows on the prior launcher and 9000 of 9000 after; the live symptom was answer-check-forum.log "the harness launch is not permitted" with no [harness-probe] failed line, and the 2026-11-07 02:02 forum answer check reply "I couldn't start my model right now." The probe buffers its rows in memory (about 100 bytes per path; under 1 MB for 9000 entries) and writes them once. A spec refused mid-list now exits 125 with no rows printed instead of a partial list; the caller already treats any non-zero exit as no probe. probeAccess writes one stderr line when rows are incomplete.
Undo and recovery: Revert this commit; the probe returns to per-row writes and intermittent truncation under a slow reader. No stored state changes.
Multi-machine posture: Per-machine launcher; the runner reinstalls the repo copy when its digest differs, so each machine picks the fix up at its next readiness check.
Layer below: 1.x revision 62d5c57c19aedd65b51eba4cf6071f8d61b9ae2e (JKHeadley/instar main): src/cli.ts:2379 and :2389 set process.exitCode rather than calling process.exit, so stdout drains before the process ends. Reused that behavior (let the output finish before exit); here the probe block is followed by the launch code, so it waits for the write callback and then exits. The 1.x harness has no separate-user probe to carry over. ONEX-LESSONS.md is not present under the agent home or repository. 2.0 inspected: tests/preview/harness-launch.mjs --probe, tests/preview/harness-user.mjs probeAccess and harnessReadiness, commits 10cb7823c and 6cfdba290 (earlier probe timeout and buffer repairs that left this cause).
Bug class: integration
Bug evidence: reproducer=tests/preview/harness-user.test.ts
Hook bypass: none; core.hooksPath unset; plain git commit used
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Decision: probe-flush-await | Await the single stdout write before process.exit rather than narrowing the probe's path list, because the deny proof over every /private/tmp entry is the safeguard and the failure was only the lost output. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-200-PROGRESS.md
Decision: probe-incomplete-line | probeAccess names an incomplete row count on stderr, because this cause left no line at all and took a full answer check to surface. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-200-PROGRESS.md
Decision: probe-register-replay | Refresh the generated register in replay mode from source commit 5f5c87640 so lint and register:check pass; the desk repin chain ran and changed no pin. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-200-PROGRESS.md
Prompt review: none; no model-facing text, parser or decision path changed.
Deferral: generated/register.json:1 | not-a-deferral=Generated register content; no builder deferral.

Subject (10 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, tests/preview/harness-launch.mjs, tests/preview/harness-user.mjs, tests/preview/harness-user.test.ts

## Closing block

simplestRobustRoute: Waiting for the one write to finish is the simplest route: it keeps the full kernel deny proof and changes nothing else. Shortening the path list would narrow the safeguard, and a longer timeout would not help since the probe exited 0. Start: a probe over every /private/tmp entry. End: every row reaches the reader, or the caller logs the short count and holds the launch as before.
80/20: One awaited write closes the intermittent hold; the Studio answer check on the pushed head confirms it live.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
