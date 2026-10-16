# Change review — failed tool activity completion

Subject base: a82cdeac28e30f18a6f3dfee9335ae71ca31b890
Review state: open
Reviewed content: none
Outcome: A failed session tool invocation closes its matching activity occurrence. When every admitted root tool has ended, progress says no tool step is running instead of naming an ended command.
Affected rules: 1, 26, 32, 34, 36, 37, 42, 49, 52, 70, 74, 87, 89, 101, 111, 112, 113, 116
Affected floors: secrets — existing host-local bounded record and outbound checks; spend cap — no added model calls and unchanged reply allowance; stop — existing observation and send guards; no duplicate sends — unchanged step identity, cadence and final-answer ordering; durable intake — unchanged journal custody.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Repair a user-facing activity projection with real recorded completion evidence and executable-hook/send-path replay; no new authority or effect capability.
Side effects: Claude session launches additionally register PostToolUseFailure with the existing post command and unchanged timeout. The hook records a distinct post-failure phase. It does not send a success-shaped checkpoint post or settle an effect or child edge: those outcomes remain uncertain under the existing owner. Activity closure requires the exact occurrence id and tool, and excludes child failures. Between tools, the existing bounded progress channel may now report no tool step running, including after successful completions. The same step identity suppresses duplicate announcements. Missing, corrupt, incomplete or stale evidence cannot supply this status. Existing workers need normal replacement to acquire the new launch settings; historic admission logs are not rewritten.
Undo and recovery: Revert this commit to restore the prior launch and projection. Existing admission readers ignore the new phase; replay of older records retains its missing-completion uncertainty. Reversion restores the stale-status defect. No data migration, service, authority grant or journal schema is added.
Multi-machine posture: Deliberately machine-local activity derived from the existing claim-local admission file and fresh worker observation. Existing owner fencing and durable progress sends remain authoritative across machines. No new store or replication demand.
Layer below: Full constitution; srerun2-1016 report and raw admission prefix; original Claude Code 2.1.280 tool-use/result records; documented PostToolUseFailure envelope; actual admissionArgs launch wiring; executable hook; activity projection; journal progress scheduling, step deduplication, final-answer serialization and replay guards; sealed per-call policy checkpoints.
Bug class: integration
Bug evidence: reproducer=tests/preview/working-activity-failure.test.ts
Hook bypass: none; core.hooksPath unset, shared hooks directory inspected and contains samples only; ordinary commits.
Convergence: none
Decision: progress-stale-failure-outcome | Use the real failure completion to close activity only; an invocation ending does not establish the outcome of its external effect. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/progress-stale-1016-PROGRESS.md
Decision: progress-stale-session-scope | Register the failure event on the session route named by the brief. Retain separately sealed per-call tool settings and their grants. Keep the admission hook timeout, launch ceiling and recovery paths unchanged. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/progress-stale-1016-PROGRESS.md
Prompt review: No model prompt, reply parser or model accept/escalate/refuse decision changes. Failure events add no model context. Existing recorded summary-writer/uncertain, Jev undecided/unsure, reply-review and delivered/empty-context cases run in working-progress.test.ts. The empty recorded candidate is not claimed to be a delivered empty bubble.

## Closing block

simplestRobustRoute: This is the simplest robust route: wire the missing failure event to the existing hook and consume its explicitly failed completion in the existing bounded projection. A timer cannot establish whether a tool ended, and treating failure as success would erase uncertain effects. Start guards are the actual claim-local occurrence and fresh live observation. End guards are exact failure completion and existing final-answer activity removal/send serialization. Secrets, spend cap, stop, no duplicate sends and durable intake remain held. No new service, heuristic, model call or unattended live-deployment claim.
80/20: The initial recorded-shape regression run had 11 failures and one pass. After repair, the focused replay/progress/session/policy suites pass 109 tests; hook, session-admission, tool-turn replay and Codex-worker checks also pass. Message 744 raw prefix SHA and exact text/step hash reproduce before failure closure; all three recorded failures replay through the executable hook. The new status reaches the progress send and zero progress follows the final answer. The only architecture finding is the byte-bound native macOS self-host conformance certificate; the desk owns renewal under the standing charter. Full host testing and independent review belong to the pipeline.
VERDICT: author submission; independent review pending
