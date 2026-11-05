# Change review — retain complete harness probe output

Subject base: b5806d1e015dc650cdc1dee2e0accab05a849d4b
Review state: open
Reviewed content: none
Outcome: Drain the existing access probe's queued stdout before its successful exit, and distinguish command failure, incomplete rows and malformed rows without weakening readiness.
Affected rules: 5, 26, 34, 37, 42, 44, 49, 70, 74, 95, 101, 102, 108, 111, 112, 113, 116
Affected floors: secrets — probe diagnostics carry counts and sanitized code/signal, never paths or command output; spend cap — no model route or accounting change; stop — unchanged; no duplicate sends — no send or retry change; durable intake — unchanged.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: This repairs physical readiness for a separate harness identity. Focused subprocess regression and native/full release verification are appropriate; no authority change is involved.
Side effects: A successful probe waits for its queued stdout to drain instead of losing rows on exit. Existing 45-second command and buffer limits stay. Failures remain null and held; their bounded reason becomes visible.
Undo and recovery: Revert this candidate through the ordinary release path. No serving runner, installed launcher, activation record or journal was changed by this unit.
Multi-machine posture: Machine-local deliberately. Each host runs its existing probe and atomically installs its own changed launcher through installFile's content comparison; no shared state or new service.
Layer below: Inspected probeAccess command execution/row checks, harnessReadiness null handling, harnessGate holding and recheck, installed launcher stdout writes and process.exit, plus the existing atomic content installer. Delayed stdout reading proves the actual launcher returns exit 0 with incomplete output; the same existing stream's flush callback retains all rows. An incomplete proof still refuses.
Bug class: live-path
Bug evidence: reproducer=tests/preview/harness-user.test.ts; live=docs/defects/2026-11-05-harness-probe-stdout-drain.md
Hook bypass: none
Convergence: none
Prompt review: No prompt, model output parser or judgment change. This parser consumes local OS access-probe rows only. Model replay is inapplicable.

Decision: HPROBE-DRAIN | Flush the existing stdout stream before its existing exit rather than changing row requirements, command deadlines or adding retries. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/harness-probe-drain-1105-PROGRESS.md
Decision: HPROBE-REASON | Preserve the existing null refusal but record bounded failure classes and let readiness name them; keep the generic refusal for injected probes without diagnostics. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/harness-probe-drain-1105-PROGRESS.md
Decision: HPROBE-PUBLICATION | Replay the existing shape-only register from committed source after the existing desk rehash/repin tools found no manifest or inventory pin changes; reopen the two inherited browser publication scopes whose generated subject changed, preserving their historical findings. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/harness-probe-drain-1105-PROGRESS.md
Decision: HPROBE-HISTORY | Report the demonstrated stdout defect separately from the historical outage cause, which the retained historical diagnostics cannot establish. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/harness-probe-drain-1105-PROGRESS.md

Subject (14 paths): docs/defects/2026-11-05-harness-probe-stdout-drain.md, generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, reviews/browser-bridge-on-resource-1104-change-review.md, reviews/browser-mcp-worker-read-1104-change-review.md, tests/preview/README.md, tests/preview/harness-launch.mjs, tests/preview/harness-user.mjs, tests/preview/harness-user.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: drain the stream already writing the required rows, retain the existing complete-proof refusal, and improve the existing diagnostic. Start guard is the same separate identity and probe command, end guard is all expected boolean rows, limit guards are unchanged command timeout, buffer bound, custody and held-launch behavior. Existing content replacement supplies migration parity. No new queue, authority or service is introduced.
80/20: The real delayed-reader case and its removed-flush negative control establish the defect and repair. Historical attribution, a fresh live user task and independent full release acceptance are not claimed.
VERDICT: author submission; this record asserts no independent verdict.
