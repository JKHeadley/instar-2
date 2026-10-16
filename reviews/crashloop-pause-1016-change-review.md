# Change review — durable crash-loop pause in the existing host supervisor

Subject base: 17dfeb44673820f6196086e9f62f7b12ccc56a14
Review state: open
Reviewed content: none
Outcome: a repeatedly crashing supervised runner consumes one durable shared failure window, pauses before another launch, and resumes only through explicit episode-bound deployment control.
Affected rules: 1, 4, 26, 36, 40, 44, 49, 52, 53, 55, 60, 61, 68, 74, 87, 88, 101, 102, 113, 116
Affected floors: secrets — existing redaction and confined notice driver; spend cap — runner rechecks original allowance; stop — latch and expiry still precede launch and refuse resume; no duplicate sends — original notice episode/ledger remains authoritative; durable intake — no journal work or effect records are altered.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: includes mechanically regenerated register publication as well as retry admission and local recovery state; no model call, distributed authority, effect replay or live installation mutation.
Side effects: maxRestarts now also bounds mixed failures within a ten-minute default window, across supervisor restarts and intervening successes. A paused host no longer gets a new budget from launchd. Explicit manual resume clears only its local launch pause, and all original runner fences still apply. New policy fields cannot silently reinterpret an existing crash window; an explicit resume starts the configured policy afresh. Existing incident evidence supplies the initial window on update. The retained legacy evidence is only the existing holder's bounded history, not a claim of full historical job coverage.
Undo and recovery: revert the source commit to restore the previous supervisor. Existing journal, notice ledger, failure evidence and manual-resume evidence remain. An old supervisor ignores the new pause field and therefore can relaunch; deploy rollback only deliberately. Normal repair uses the episode-bound resume command rather than editing stop or job files.
Multi-machine posture: deliberately machine-local, per supervised root under the existing exclusive deployment owner. It shares all observed host failure classes, not a pool-wide budget. It changes neither conversation ownership nor the independent minimal plane. No claim to implement the unlanded distributed Part Six causal-cohort breaker.
Layer below: inspected the pure scheduled priority brake, journal exit reader, exact child-process supervision, atomic file/directory fsync writer and confined infrastructure-notice ledger. No job manifest edits, direct messaging, process-name matching or unknown-effect retries are added. Existing source of stop, trial expiry and grant checks stays authoritative.
Bug class: unit
Bug evidence: reproducer=tests/integration/host-watch-journal.test.ts
Hook bypass: none; core.hooksPath unset and common hooks directory contains sample files only.
Convergence: none
Decision: crashloop-window | reuse host-watch.json for shared failure, launch-refusal, hang and rapid queued-exit pressure with a bounded window; retain pressure across success and supervisor restart | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/crashloop-pause-1016-PROGRESS.md
Decision: crashloop-resume | require the current paused episode for local manual resume; retain prior pause evidence and never clear stop, expiry, allowance or unknown-effect fences | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/crashloop-pause-1016-PROGRESS.md
Decision: crashloop-scope | extend the existing supervisor and notice driver with a pure scheduled reducer, rather than creating a watcher/store or claiming a distributed breaker | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/crashloop-pause-1016-PROGRESS.md

Decision: crashloop-publication | refresh the changed owner-reference hash and regenerate the existing shape-only register from committed source; leave the Studio-owned native certificate untouched | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/crashloop-pause-1016-PROGRESS.md

simplestRobustRoute: this is the simplest robust route for the named host-restart budget reset: persist the window and pause in the holder that already records every failed launch, reuse its existing confined notice driver, and add an exact local resume. The pure reducer performs only arithmetic over supplied observations; the host owns time and I/O. Start, stop, grant, budget and unknown-effect guards remain. Recorded launch/worker replays and injected-clock positives/negative neighbours are offline evidence; the desk owns the unattended proof-room result and independent landing review.
80/20: targeted changed/direct-importer tests, typecheck, architecture/register/change-review checks and pinned READY tests; no full-suite sweep, second baseline tree or live mutations. The remaining live proof is an explicit desk acceptance step, not claimed performed.
VERDICT: author submission; no independent convergence or live acceptance claim
