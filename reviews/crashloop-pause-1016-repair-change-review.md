# Change review — current-launch crash accounting and paused alert recovery

Subject base: 0f49350f6306cfee96a2dd5255e138b7f4062b57
Review state: open
Reviewed content: none
Outcome: zero exits without a fresh recorded completion consume the durable failure window, and a paused supervisor recovers its prepared undispatched alert without launching a runner or repeating a dispatch.
Affected rules: 4, 8, 26, 40, 52, 53, 55, 60, 61, 68, 74, 101, 102, 113, 116
Affected floors: secrets — existing confined notice driver retains custody; spend cap — runner admission remains authoritative; stop — checked before launches and notice recovery; no duplicate sends — inspect the existing dispatch ledger before recovery and retain the same episode; durable intake — no journal work or effect records removed.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: repair retry admission and alert recovery with their register publication; no new authority or model-facing behavior.
Side effects: stale completion and inhibition rows no longer excuse a subsequent unrecorded zero-code exit or terminate its retries. Fresh completion and capacity outcomes remain excluded. A paused supervisor can invoke the existing bounded notice child once per invocation when no dispatch claim exists. Delivered, refused, uncertain and dispatching ledger entries settle the existing episode without a send; the pause stays latched. Tests that previously represented healthy exits without launch records now supply the actual two-row shape.
Undo and recovery: revert this repair to restore prior behavior; retained crash state and notice ledger remain readable. This would restore the two reviewed recovery gaps, so prefer the exact episode-bound resume after repairing a runner. The change adds no store or migration format.
Multi-machine posture: deliberately machine-local per supervised root under the existing exclusive deployment owner; no distributed breaker or new effect authority.
Layer below: checked lastJournalRun launch/exit pairing and torn-row behavior, stop/expiry detection, atomic fsync holder writes, noticePhase ledger authority and the confined driver's pre-dispatch claim. The test exercises that actual child against a fake Telegram server and confirms one delivery with the launch pause retained.
Bug class: unit
Bug evidence: reproducer=tests/integration/host-watch-journal.test.ts
Hook bypass: none; core.hooksPath unset and common hooks directory contains sample files only.
Convergence: none
Decision: crashloop-repair | use only current-launch records to exclude failures and recover paused prepared alerts once per invocation through the existing ledger and confined driver | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/crashloop-pause-1016-repair-PROGRESS.md

simplestRobustRoute: this is the simplest robust route: extend the existing failure classification and share existing notice settlement between ordinary failure handling and the paused return. No new watcher, store, classifier or messaging path. Current launch evidence prevents renewed retry budgets; pre-dispatch ledger inspection prevents duplicate sends. Stop, admission, authority and effect checkpoints remain. Tests demonstrate unattended confined-child recovery against fake Telegram, not live acceptance; the desk owns the native certificate renewal and live proof.
80/20: 31 targeted supervisor tests pass, including 8 regressions that failed before repair, recorded launch and work fixture replays, physical hang recovery and real confined notice dispatch. Typecheck and build pass. Full suites are reserved for the Studio pipeline. Architecture reports only the standing charter clause 7 native certificate exception; no declaration is changed to conceal it.
Register publication: owner-manifest rehash and grounding-chain helper each refreshed zero pins. Generated outputs replay committed repair source c241eb21ecbc71b1c59ac7c9d6e934fc5c24d238 with shape-only authority.

VERDICT: author submission; no independent convergence or live acceptance claim
