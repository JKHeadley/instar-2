# Change review — Deterministic acknowledgement restart clock

Subject base: 0ed77d1682e55fb894fdc1f13b26cabd62972e00
Review state: open
Reviewed content: none
Outcome: The durable queued-input restart test reconstructs both acknowledgement timers regardless of the calendar date on which Vitest installs its fake clock.
Affected rules: 1, 26, 35, 37, 49, 70, 74, 87, 101, 102, 111, 113, 116.
Affected floors: secrets — no live credentials or outbound calls; spend cap — production admission unchanged; stop — grant expiry remains enforced; no duplicate sends — existing second-reopen assertions retained; durable intake — existing encrypted journal close/reopen assertions retained.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Test-only clock repair; no product code, prompt, parser, grant, or send-admission change.
Side effects: The restart scenario now runs with fixture-day, actual-today, and 2099 timer-installation epochs. It restores fixture time after clearing timers, as the neighboring saved-answer restart test already does. Existing captured bytes and assertions are unchanged.
Undo and recovery: Revert this test-only commit; no production state or migration is involved.
Multi-machine posture: Machine-local test clock, deliberately; each test owns its temporary encrypted journal. Production ownership, replication, and clocks are unchanged on every host.
Layer below: Read the full purpose and rule book. Inspected Vitest clearAllTimers and its bundled fake-timers reset: reset assigns clock.now = start. Inspected journal gate and acknowledgement reconstruction: expiry uses the injected ports.now. Installed Vitest and every locked @vitest package match package-lock.json at 3.2.7; no dependency directory was changed.
Bug class: unit
Bug evidence: reproducer=tests/preview/reply-acknowledgement-timing.test.ts
Hook bypass: none; core.hooksPath unset and common hooks directory contains only sample hooks.
Convergence: none
Prompt review: No model-facing change. The existing recorded answer and reviewer replay cases remain intact; this repair changes only fake-clock setup around a simulated process restart.
Decision: ack-restart-clock-reset | Restore fixture time immediately after clearAllTimers because Vitest resets time as well as timers; preserve the product's existing expiry boundary. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/ack-restart-date-1013-PROGRESS.md
Decision: ack-restart-date-matrix | Run the same restart scenario with fixture-day, actual-today, and 2099 installation epochs to prove host-date independence and retain the duplicate-send checks. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/ack-restart-date-1013-PROGRESS.md

## Closing block

simplestRobustRoute: This is the simplest robust route: restore the existing fixture clock after Vitest resets it. No product mechanism is added. Start guard is durable accepted intake; end guards are two acknowledgements at ten seconds, serial final answers, and no sends on another reopen. Existing expiry, stop, spend, secret, and send-deduplication floors remain unchanged. No unattended production capability is claimed.
80/20: Before repair, the unchanged scenario passed on the fixture-day installation epoch and failed on today's and 2099's epochs with trial expiry. After repair all 19 cases in the file pass. The report records required final-head checks; independent landing review remains with the desk.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
