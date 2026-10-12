# Change review — Merge live acknowledgement timing into Jev retry repair

Subject base: e0449416a1c995ebd09b27f31f483c76532be6c9
Review state: open
Reviewed content: none
Outcome: Merge live build ea75ce395d9fdd4f9f2f970e8c278b9fe37a5387 into the approved Jev retry branch, preserving both histories and validating acknowledgement timing with bounded Jev retries.
Affected rules: Rules 1, 34, 36, 37, 49, 55, 63, 69, 70, 74, 87, 101, 102, 111, 112, 113, 116.
Affected floors: secrets — existing outbound and disclosure checks; spend cap — existing per-attempt reservations and reply allowance; stop — existing admission and physical-send checks; no duplicate sends — signed durable intent and UNKNOWN fence; durable intake — journal acceptance precedes timers and answer work.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Integration of two reviewed changes affecting reply review and acknowledgement dispatch.
Side effects: Acknowledgements now follow the live fixed-template timer while answer checks retain the branch bounded retry. Generated publication is rebuilt from merged sources. No new capability restriction or authority.
Undo and recovery: Forward-fix integration, retaining readers for durable retry and acknowledgement rows. Never repeat an accepted or UNKNOWN send. Regenerate publication after any source repair.
Multi-machine posture: Existing ownership and replication admission govern sends; process-local timers reconstruct from durable intake. No new shared state or peer dependency.
Layer below: Inspected journal worker merge, acknowledgement cancellation at disclosure and physical send, legacy acknowledgement projection, recorded-shape tests, and the branch Jev client path. The sole test conflict retains both no-review and no-intent fast-answer assertions.
Bug class: integration
Bug evidence: reproducer=tests/preview/jev-stage-latency.test.ts
Hook bypass: none; core.hooksPath unset and common hooks directory contains only samples.
Convergence: none
Decision: jev-repair-live-merge | Preserve live acknowledgement runtime and branch Jev retries with ordinary merge; keep both fast-answer assertions and regenerate all generated conflicts. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-jev-retry2-1011-repair-062954-PROGRESS.md
Prompt review: No new model instruction authored. Live build removes per-send fixed acknowledgement review. Existing real recorded shapes and timing cases are replayed through the merged worker; inherited memory guidance remains unchanged.
Prompt finding: 849db3a6296a | protocol-literal | Existing unchanged memory reply or source-citation instruction, inherited from reviewed branches.
Prompt finding: bd01de21286a | protocol-literal | Existing unchanged memory reply or source-citation instruction, inherited from reviewed branches.
Prompt finding: fb5fa7e706c8 | protocol-literal | Existing unchanged memory reply or source-citation instruction, inherited from reviewed branches.

Subject (19 paths): register-source/owner-references/preview.json, tests/preview/README.md, tests/preview/fixtures/reply-acknowledgement-live-2026-10-12.json, tests/preview/group-audience-cache.test.ts, tests/preview/group-carry-requests.test.ts, tests/preview/jev-stage-latency.test.ts, tests/preview/journal-agent-resources.test.ts, tests/preview/journal-agent.mjs, tests/preview/journal-cutover-ports.mjs, tests/preview/journal-obligations.test.ts, tests/preview/journal-session-work-launch.test.ts, tests/preview/journal-summary-crash.test.ts, tests/preview/journal.ts, tests/preview/minimal-responder.test.ts, tests/preview/reply-acknowledgement-timing.test.ts, tests/preview/reply-acknowledgement.test.ts, tests/preview/send-stage-replay.test.ts, tests/preview/two-machine-floors.test.ts, tests/preview/two-machine-runner.test.ts

Publication: Existing register builder replayed merged source 38c9aee806879846f06d547b92fbeac7dc6f48cc; all seven generated conflicts are now regenerated. Desk rehash and repin found no stale pins.

## Closing block

simplestRobustRoute: This is the simplest robust route: ordinary merge, retain both compatible assertions, and regenerate publication through existing desk tools. No new machinery. Start guards remain durable intake, disclosure and ownership; limits remain reply caps and bounded retries; end guards remain current eligibility and durable send custody. Recorded replays are verification, not a new live deployment claim.
80/20: Run changed test files, bounded retry tests, pinned-text checks and cheap gates; leave the full suite to the Studio pipeline.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
