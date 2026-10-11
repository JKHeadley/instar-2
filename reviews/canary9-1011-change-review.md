# Change review — keep completed group reviews with extra known findings

Subject base: c17ba65f7bcc1aedfe5989291f8322de66443ef6
Review state: open
Reviewed content: none
Outcome: A completed group reply review that answers every requested rule plus extra known rules retains every finding and can release an all-pass answer. Missing, unknown, duplicate and malformed findings still refuse; extra violations retain their ordinary objection and holding behavior.
Affected rules: 4, 26, 36, 41, 42, 49, 55, 57, 58, 70, 74, 77, 95, 101, 108, 111, 113, 116; purpose least revelation
Affected floors: secrets — extra credential violations remain violations and exact secret checks are unchanged; spend cap — existing call and deadline bounds remain, no new calls; stop — unchanged checkpoints; no duplicate sends — exact encrypted-prefix replay sends once and restart sends nothing; durable intake — original journal preserved, only isolated copies replayed.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Changes interpretation of live model review output and therefore reply release; preserves coverage and all negative findings.
Side effects: Additional recognized findings now participate in the same review result, including violations outside the requested subset. No finding is silently discarded. Every requested rule remains mandatory, unknown rules remain malformed, duplicate lines and invalid verdicts remain malformed, and combined historical verdicts remain invalid for newly selected reviews. Prompt, model, membership authority, review deadline and budgets are unchanged.
Undo and recovery: Revert the parser and caller change together. Existing journal rows remain readable because their findings already use the current rule schema. Do not repeat the real canary probe or restore a predecessor journal that omits its effects. Desk restoration edits have switch-canary-copy.sh.bak-273 and canary-restore-1011-test.py.bak-273 backups outside the repository.
Multi-machine posture: No new state or transport; findings use the existing encrypted journal and ownership/replication rules. Desk process cleanup is deliberately machine-local and does not claim remote bot ownership.
Layer below: Read the preserved canary journal strictly read-only and journal-agent inspect; both review calls are complete with exitCode 0, no local limit, and valid PASS findings. The requested audience/self-state/preference subset was accompanied by four known obligation findings, rejected by the old parser twice. The real group audience and complete recorded prompt remain intact in the encrypted-prefix worker replay. Read the canary runs.jsonl and group launcher log: the recorded canary PID is 87500, exited 14:13:22; the later 61029 refusal does not establish that PID was this canary.
Bug class: integration
Bug evidence: reproducer=tests/preview/canary-review-replay.test.ts
Hook bypass: none; core.hooksPath unset and the common hooks directory has sample files only.
Convergence: none
Decision: canary9-retain-findings | Require all selected findings and retain extra known results, including violations, rather than refusing a completed review or dropping objections. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/canary9-1011-PROGRESS.md
Decision: canary9-cleanup | Extend existing exact-PID graceful cleanup to 60 seconds, verify exit before wait/relaunch, and verify one actual node runner for the bot. Preserve stop and effect-prefix guards. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/canary9-1011-PROGRESS.md
Prompt review: No prompt edits. Model parser replay includes both exact captured outputs from 969390374 and their Jev input, plus archived shapes: summary writer 715672480, uncertain summary 715672483, undecided Jev 715672482, unsure Jev 969389570, reply-review 969389923, delivered reply 715672479, and empty candidate 715672550. The latter is an empty recorded context bubble, not asserted to have been delivered. Non-review shapes never become a completed audience review. Two isolated encrypted-prefix worker replays retain the full original context and release the probe once without a fresh model call or Telegram send.
Deferral: tests/preview/fixtures/canary9-review-2026-10-11.json:64 | not-a-deferral=Immutable captured reviewer output discusses whether the probe defers work; it creates no commitment.
Deferral: tests/preview/fixtures/canary9-review-2026-10-11.json:69 | not-a-deferral=Immutable captured reviewer retry discusses whether the probe defers work; it creates no commitment.

Publication: Refresh the existing preview fixture owner hash and regenerate register outputs from the committed source; these are derived evidence, not new authority.

Subject: tests/preview/reply-check.ts, tests/preview/journal-agent.mjs, tests/preview/reply-check.test.ts, tests/preview/canary-review-replay.test.ts, tests/preview/fixtures/canary9-review-2026-10-11.json

## Closing block

simplestRobustRoute: This is the simplest robust route: accept complete evidence over the known rule vocabulary and retain all its findings. The existing parser already validates individual findings; only exact equality of the returned rule set unnecessarily refused the real case. No new retry, model call, classifier, gate or storage. Start evidence is update 969390374 with two completed all-pass model outputs rejected as unavailable; end evidence is the same full journal prefix delivering once with both recorded outputs and remaining silent on restart. Desk restoration reuses existing cleanup and readiness with a finite grace interval and bot-wide count. Existing secret, spend, stop, disclosure, durable-intake and duplicate-send floors remain. No live unattended cutover is claimed.
80/20: Targeted single-worker tests and two full encrypted-prefix replays establish the repaired parser path; offline process tests cover both sides of cleanup and readiness. Full suite and independent convergence belong to the desk pipeline.
VERDICT: author submission; the pipeline records its independent verdict
