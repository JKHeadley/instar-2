# Change review — Bounded same-turn throttle recovery

Subject base: 17dfeb44673820f6196086e9f62f7b12ccc56a14
Review state: open
Reviewed content: none
Outcome: An admitted idle throttled turn gets one delayed neutral continuation under its existing deadline and admission, without redelivering its input.
Affected rules: 1, 26, 34, 36, 42, 46, 47, 49, 55, 60, 61, 63, 68, 70, 74, 76, 87, 96, 101, 102, 110, 111, 113, 116
Affected floors: secrets — unchanged custody and delivery; spend cap — same admitted model gate and allowance; stop — checked before observation and terminal input; no duplicate sends — same effect identities, one durable nudge intent, uncertain input never replayed; durable intake — existing delivery record retained unchanged
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Recovery changes the lifecycle of an already admitted turn and adds one model-facing continuation, without a new authority path or service.
Side effects: A quota wall may retain a worker for 30 seconds and consume one additional admitted model call. A second throttle is observed for five seconds before the existing pause is exposed. The original deadline never extends. The independent watchdog ignores bare Stop receipts during recovery because a throttle also emits Stop. A driver-confirmed close still cancels the watchdog. Unconfined sessions remain observation-only because autonomous continuation requires the admitted effect and model-call floors.
Undo and recovery: Revert this commit and regenerate source pins. The optional journal field is backward compatible; old rows need no migration. A recorded sending state is never retried on restart. Rollback observes the existing throttle without reissuing the original input. No credentials, installation policy or account membership change.
Multi-machine posture: Recovery is deliberately local to the existing physical session journal and exact process identity. The host retains conversation ownership and its journal writer lock. No remote takeover, new worker or account migration occurs in the recovery; the existing pool may select a reviewed login for subsequent work after the typed pause.
Layer below: Durable session IO exclusive/save boundary; terminal input crash window; admission model/effect checkpoints; conversation adapter cursor and result delivery; independent deadline watchdog and authenticated Stop receipts; existing login-pool typed pause consumption.
Bug class: integration
Bug evidence: reproducer=tests/assembly/production-session-driver.test.ts
Hook bypass: none; core.hooksPath unset and common hooks directory inspected, samples only
Convergence: none
Prompt review: The neutral continuation asks to continue the same interrupted turn from recorded state, without replaying completed actions or uncertain effects. It does not repeat the user request, fabricate context, resolve semantic uncertainty or use the compaction-restoration payload. Existing admission enforces the floors; wording does not replace enforcement.

Subject (5 paths): scripts/session-deadline-watchdog.mjs, src/assembly/README.md, src/assembly/production-session-driver.ts, tests/assembly/production-session-driver.test.ts, tests/assembly/session-deadline-recovery.test.ts

Decision: ratelimit-one-turn | Extend the existing driver journal with one 30-second delayed continuation per admitted turn; retain its deadline and stop/call/effect admission instead of adding a sentinel service. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/ratelimit-recover-1016-PROGRESS.md
Decision: ratelimit-uncertain | Record sending before terminal input and never retry an uncertain nudge; a repeated throttle returns the existing typed pause for next-call account selection. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/ratelimit-recover-1016-PROGRESS.md
Decision: ratelimit-deadline | During recovery, only the driver's durable close cancels the independent deadline; a bare throttle Stop receipt cannot defeat the safety ceiling after host loss. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/ratelimit-recover-1016-PROGRESS.md

Evidence: The positive same-turn regression failed before implementation (immediate pause), then passed. The independent watchdog regression failed for all three recovery states before its repair, then passed. Existing captured Claude limit output from 2026-09-24 drives the recovery with a simulated idle prompt; this is recorded provider text, not a claim of a captured full terminal frame. Recorded summary/uncertain/Jev/review/delivered/empty shapes from retrospective-duty-followup-train-1-2026-10-08.json remain non-throttle evidence. No new live model or Telegram result is claimed.

## Closing block

simplestRobustRoute: This is the simplest robust route through the existing serialized driver, journal, deadline and admission. The optional recovery field is necessary to retain due time and distinguish an unsent continuation from one whose delivery is uncertain after a crash. No new service, store, watcher or classifier. Start: exact admitted session, accepted input, idle current quota wall, no compaction/grounding owner, and room in the existing deadline. End: ordinary turn completion evidence or truthful pause/uncertainty. Limits: one attempt, 30-second backoff, five-second post-submit observation, original deadline, stop and original spend/effect gates. Unattended shipped-path proof remains a desk acceptance check, not an asserted result.
80/20: Targeted tests include direct importers, real recorded provider/model shapes and independent watchdog subprocess checks. The full suite and live proof run on the desk's gate host. No alternate worktree or full-suite investigation.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
