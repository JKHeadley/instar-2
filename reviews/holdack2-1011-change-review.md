# Change review — restore approved slow-turn acknowledgements

Subject base: 7002feeb7cd44c8ea2ec2500aa005999962ff3b1
Review state: open
Reviewed content: none
Outcome: Merge approved main d5d1ed51 and restore holdack behavior: one short in-reply acknowledgement on slow user turns, none on fast turns; preserve all four speed changes and pull-only held/agent status.
Affected rules: Purpose least revelation and durable cause; Rules 1/4/13/14/26/28/34/36/37/41/46/49/57/58/63/70/74/75/77/87/95/101/111/112/113/116.
Affected floors: secrets — existing outbound checks; spend cap — existing call/reply reservations; stop — existing intake/dispatch checkpoints; no duplicate sends — durable intent/receipt and unknown-outcome fence; durable intake — original encrypted journal unchanged by runtime rollback.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Restores reviewed acknowledgement dispatch and durable journal state alongside the approved constitutional clarification.
Side effects: Slow replies again reserve one acknowledgement review/send. Compact briefing retains the speed work and adds the exact approved Rule 87 excerpt. Existing final-send and review routes remain.
Undo and recovery: Revert this restoration and regenerate publications; a rollback removing holdack journal kinds must not open a holdack-written root. No live root or rollout changed here.
Multi-machine posture: Existing ownership, signed dispatch, replication and unknown-outcome recovery fences remain; acknowledgement uses existing durable journal state. Timer/cache/evidence are deliberately machine-local.
Layer below: Inspected first-parent revert, speed composition, merged constitutional source/pins, host acknowledgement callback, journal intent/review/receipt, audience cache, final review and archived replay harness.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath unset, common hooks directory contains samples only.
Convergence: none
Prompt review: Restores acknowledgement review using existing full-context gate; merged Rule 87 reaches briefing. Replays recorded summary uncertainty, Jev unsure/undecided, reply reviews, delivered reply and empty context fixtures through the affected path. Archived speed-hold updates 969390381/969390382 retain exact final answers and no duplicate sends.
Prompt finding: 849db3a6296a | protocol-literal | Existing fixed memory inventory response, not a new semantic classifier.
Prompt finding: bd01de21286a | protocol-literal | Existing source label instruction and grounding assertion.
Prompt finding: fb5fa7e706c8 | protocol-literal | Existing semantic memory retrieval instruction and grounding assertion.

Decision: merge-approved-rule | Keep compact speed briefing and add the approved Rule 87 excerpt and pin. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/holdack2-1011-PROGRESS.md
Decision: restore-exact-revert | Reverse 17d11d0b, retain historical review record and canary repair; runtime files match composed 82e3aa6f. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/holdack2-1011-PROGRESS.md
Decision: regenerate-once | Publish the final committed source and canonical merged anchor once. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/holdack2-1011-PROGRESS.md
Decision: isolated-replay | Reuse archived authenticated prefixes with recorded durations and captured sends. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/holdack2-1011-PROGRESS.md
Verification: Required targeted tests, archived replay and final publication checks are recorded in /Users/dabombstudio/.instar/agents/echo/.instar/lanes/holdack2-1011-PROGRESS.md.

## Closing block

simplestRobustRoute: This is the simplest robust route: merge the approved Rule 87 text, reverse the exact holdack revert and retain the existing four speed changes. Use the existing journal, metered review, durable send intent and receipt. Start guards require durable intake, current owner/audience and eight seconds; end guards retain unknown-outcome no-retry and exact receipt. Existing secrets, cap and stop checks remain. Replay is unattended against archived copies with captured sends, not live deployment evidence.
80/20: Targeted foreground positive and negative cases, real recorded shapes, stage timings, compiler and publication gates; desk performs independent landing review and full suite.
VERDICT: author submission; no independent convergence claim
