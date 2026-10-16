# Change review — idle proactive context headroom

Subject base: a82cdeac28e30f18a6f3dfee9335ae71ca31b890
Review state: open
Reviewed content: none
Outcome: Long journal conversations compact at the existing pressure threshold between ordinary turns, with a durable ten-minute cooldown and the existing continuity path.
Affected rules: Rules 7, 14, 15, 26, 34, 36, 47, 49, 55, 60, 61, 63, 74, 96, 101, 102, 110, 111, 113 and 116; purpose no silent loss and evidence before done.
Affected floors: Secrets retain the existing scrubbed model doorway; spend retains existing reservations, call caps and per-span brakes; stop is checked before proactive admission and each existing model operation; no duplicate sends retains the existing intent/receipt path; durable intake and original journal history are unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: Changes automatic summary scheduling and idle-only frontier publication, with no new model call type, prompt, parser, service or store.
Side effects: Ordinary replies, intake and the minimal responder remain immediate while a summary model is in flight. A result finishing during an ordinary turn is recorded as a deferred failure; originals remain and the existing bounded retry path can try again after cooldown. Automatic summary passes have a cooldown reconstructed from recorded summaries, failures and uncertain reservations. Clock regression extends the cooldown. Explicit memory processing and forced context-wall recovery retain their existing behavior. Per-pass summary retries remain bounded by the existing eight-attempt maximum and shared spend cap.
Undo and recovery: Revert this change. No new journal record or projection field is introduced; both versions replay the same durable history. UNKNOWN reservations are never re-dispatched under a new identity.
Multi-machine posture: The current journal owner runs the existing summary path. Cooldown is derived from the replicated journal, so restart/handoff does not reset it. The existing summary promise prevents simultaneous summary passes; no ownership, lease, replica or remote effect rules change.
Layer below: Read purpose and rule book, D15 section 5, D16 delivery/uncertainty section 8, D18 continuity section 5 and carryover section 10. Inspected existing summary pressure, reservation, UNKNOWN recovery, faithfulness review, retained originals, continuity accounting and runner scheduling. Replayed the recorded proof-room journal and model outputs without a live service call.
Bug class: integration
Bug evidence: reproducer=tests/preview/proactive-compaction.test.ts
Evidence details: Before repair the busy-turn test dispatched summary:4 during the answer; cooldown test dispatched four calls instead of two. After repair both pass. Recorded proof-room updates 715672479–715672500 replay through the unforced path: writer uncertainty, Jev 0.38 undecided and stronger review pass preserve marker probe-5f1ba73c and the tomato commitment. The next answer packet consumes that advanced frontier and still carries both the marker and tomato task; its reply is sent by the existing worker. No live deployment claim.
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains only sample hooks.
Convergence: none
Prompt review: No model prompt or output parser changed. Recorded bytes feed the existing interpreters; summary acceptance and continuity checks remain unchanged. The holder decides exact idle, pressure and elapsed-cooldown facts only.
Decision: precompact-existing-path | Extend the existing holder and journal summary path rather than add a service, store or model call; retain its pressure threshold and forced recovery. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/precompact-1016-PROGRESS.md
Decision: precompact-idle-cooldown | Recheck idle before publishing a summary instead of delaying ordinary replies, and derive the ten-minute cooldown from durable summary outcomes/reservations so a restart cannot reset pacing. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/precompact-1016-PROGRESS.md


Prompt finding: 4106b49fff07 | protocol-literal | Existing source-bound claim instruction is unchanged; its mirrored test checks the protocol, and no expected model verdict was added.
Prompt finding: 849db3a6296a | protocol-literal | Existing empty-memory display literal is unchanged; this change does not alter its model prompt or parser.
Prompt finding: e8708c7fea24 | protocol-literal | Existing sourceLabel provenance instruction is unchanged and tested as a protocol requirement.
Deferral: src/awareness/README.md:28 | not-a-deferral=Describes the implemented idle boundary and durable cooldown, not postponed development.
Deferral: tests/preview/journal.ts:11259 | not-a-deferral=Recorded runtime outcome when an ordinary turn owns the boundary; originals and bounded retry remain implemented.
Deferral: tests/preview/proactive-compaction.test.ts:105 | not-a-deferral=Assertion of the actual runtime deferral outcome, followed by the successful idle retry.

simplestRobustRoute: This is the simplest robust route: one pure idle/pressure/cooldown decision in the existing context holder, consumed by the already scheduled journal summary pass. Checking idle before starting and publishing prevents the reproduced mid-turn compaction race without delaying replies; reading existing durable rows prevents rapid repeated passes and cooldown reset after restart without adding state. Existing ownership, stop, spend and reservation guards admit work; faithful accepted summaries, retained originals and first-reply accounting establish continuity. Actual unattended live proof belongs to the desk proof room and is not claimed here.
80/20: Red/green regressions, direct consumers, recorded replay, typecheck, architecture, register and pinned checks on WSL; the desk owns host-dependent and live proof-room checks.
VERDICT: author submission; the independent desk records its own review
