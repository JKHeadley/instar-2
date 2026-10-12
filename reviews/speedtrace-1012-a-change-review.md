# Change review — Content-free acknowledgement, send and preflight timing

Subject base: ea75ce39
Review state: open
Reviewed content: none
Outcome: Distinguish late acknowledgement callbacks from slow audience admission and physical sends, and separate CLI version/auth preflights from the model invocation using the existing encrypted journal and status surface.
Affected rules: Purpose least revelation and durable cause; Rules 1/13/26/32/34/39/42/49/55/60/63/74/77/87/101/102/111/113/116.
Affected floors: Secrets — numeric and boolean measurements only; spend cap — no model calls or allowance change; stop — all existing checks retained; no duplicate sends — UNKNOWN never retries and only proved-not-sent may retry once; durable intake — unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Observations at send admission and transport boundaries, without changing their decisions.
Side effects: Adds bounded content-free journal observations and status output. Generation 4 declares the new frame additive so the previous generation can read it. The latest 100 observations are projected and survive snapshots; timing is never admission evidence. Observation writes add journal I/O; one record per send attempt avoids a write at each physical boundary. Preflight results and errors are never copied into the timing record.
Undo and recovery: Revert instrumentation and read with the prior generation's additive-frame support. Preserve the journal and all signed send intents; never repeat an UNKNOWN effect.
Multi-machine posture: Timing is observed by the current owning runner, recorded through its existing journal and replicated with that journal. Ownership, peer admission and physical stop checks are unchanged. Timing never authorizes another machine to send.
Layer below: Inspected dispatch's two-attempt proved-not-sent contract, delayed durable admission, host audience verification and physical invoke, call-outcome validation, snapshot replay and rollback window. Callback timing uses the injected worker clock; audience duration uses the runner's existing elapsed clock.
Bug class: observability
Bug evidence: reproducer=tests/preview/phase-timing.test.ts
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains samples only.
Convergence: none
Decision: speedtrace-a-observations | Add content-free phase observations through the encrypted journal, expose the last 100 on status, and keep every admission and retry decision unchanged. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/speedtrace-1012-PROGRESS.md
Decision: speedtrace-a-boundaries | Capture physical-send phases at the host invoke boundary and observe each CLI preflight in the existing physical IO wrapper; a model result remains its separate call-outcome. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/speedtrace-1012-PROGRESS.md
Prompt review: No prompt, model-output parsing or semantic accept/escalate/refuse decision changes. Existing captured acknowledgement timing replay remains part of validation; synthetic slow-path neighbors test only phase attribution.

## Closing block

simplestRobustRoute: This is the simplest robust route: add measurements to the existing diagnostic journal and physical IO wrapper, with injected-clock tests. No worker, polling loop, transport retry or audience cache policy is added. Existing authority, stop, spend, audience, ownership and durable-intent guards hold every effect. No live deployment or unattended production completion is claimed.
80/20: Targeted phase, send, cache, rollback and direct-import tests plus required machine checks; no full suite, CPU load test or live-root mutation.
VERDICT: author submission; independent judgment belongs to the desk
