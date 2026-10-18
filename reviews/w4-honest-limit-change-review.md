# Change review — honest provider usage limits

Subject base: c1524e54d9e4c0590491967eda76058dbe2c96cc
Review state: open
Reviewed content: none
Outcome: A launched, fully metered zero-token provider quota refusal is recorded as capacity, retains its counted attempt and original intake, and receives one plain infrastructure reply per topic per episode. The reply includes a safe reset hint or timestamp and explicitly asks for a resend. A successful model answer ends the episode. The first capacity hold projects one durable desk event on the existing operator-event surface. The existing minimal responder owns delivery.
Affected rules: purpose constraints 2 and 3; 1, 4, 14, 26, 34, 36, 37, 42, 46, 49, 52, 53, 60, 63, 70, 74, 75, 77, 87, 89, 95, 101, 102, 111, 112, 113, 116
Affected floors: secrets — bounded reset fields and existing outbound/audience check; spend — retain the launched attempt and tool liability, settle only observed tokens; stop — existing dispatch gate; no duplicate sends — durable limited-intent and episode lookup survive restart, compaction and lost receipts; durable intake — original held turns remain encrypted and visible as unanswered.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Provider failure reporting, reservation accounting and operator-facing delivery change.
Side effects: No automatic recovery is promised; the operator must resend after capacity returns. Each new inbound attempt remains subject to the existing cap. The resumed-tool rejection retry excludes capacity failures, avoiding an immediate second quota attempt. Status replies do not end an episode. Missing usage, partial work, policy rejection and uncertain results retain their existing paths. Older readers do not understand the added hold metadata; retain this reader after rollout.
Undo and recovery: Revert before rollout. After capacity holds exist, retain a supporting reader and the journal; never discard intake or repeat a lost notice receipt. Resend is new durable intake. No live root, runner policy or service is mutated by this unit.
Multi-machine posture: Existing exclusive journal writer, owner checks and replication apply. Episode identity derives from durable turns; no in-memory timer, new store or alternate owner. Compaction preserves capacity metadata and existing notice intents.
Layer below: Inspected the subscription adapter's positive failed-result and usage evidence, the shipped invokeSubscription conversion, runToolTurn's resumed-rejection retry, token settlement and UNKNOWN projection, hold replay, minimal responder, durable intent and outbound gate. The server-policy branch was merged normally, preserving its effective-configuration admission.
Bug class: durability
Bug evidence: reproducer=tests/preview/journal-capacity.test.ts; restart=tests/preview/journal-capacity.test.ts
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains sample hooks only.
Convergence: none
Decision: w4-honest-limit-resend | reuse the durable hold and minimal responder, explicitly request resend, retain the launched attempt | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-honest-limit-PROGRESS.md
Decision: w4-honest-limit-episode | derive episode from recorded capacity holds until a successful model answer; one notice per topic and one existing operator event per episode | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-honest-limit-PROGRESS.md
Prompt review: No model prompt changes. The shipped rejected-result conversion is replayed against genuine captured weekly quota bytes from 2026-09-24 and the operator-recorded 2026-10-10 session wording in that captured envelope (the latter is explicitly not a raw capture). Recorded proof-room rows 715672479–715672500, including summary writer outputs, uncertain summaries, Jev unsure/unavailable/undecided, reply reviews and deliveries, replay unchanged before the new capacity path fires. Read-only inspection of three live/proof-room journals found no real empty delivered answer; 715672656 is an unknown-answer notice, not an empty bubble. No synthetic case is labelled recorded evidence.

Prompt finding: 849db3a6296a | protocol-literal | existing fixed memory-list reply wording, unchanged by this patch
Prompt finding: bd01de21286a | protocol-literal | existing source citation guidance, unchanged by this patch
Prompt finding: fb5fa7e706c8 | protocol-literal | existing source grounding guidance, unchanged by this patch

simplestRobustRoute: This is the simplest robust route: retain the existing provider classification through the launcher and add capacity metadata to an existing durable hold, using the existing operator-event and minimal-responder surfaces. Episode identity prevents duplicate notices across queued messages and restarts without adding a scheduler or store. Start and limit guards are provider admission, ownership, stop and spend; the end-state guard is the durable send intent. The explicit resend wording avoids promising an automatic retry. Evidence is offline shipped-path replay, not a live production-delivery or unattended deployment claim.
80/20: 243 tests pass in the seven Darwin host files, covering all 29 formerly failing launcher/process-control cases and the merged server policy. Another 171 tests pass across 12 focused journal, tool, replay and floor files. Build, typecheck and architecture pass. The 12-case capacity suite additionally verifies the actual status CLI exposes one durable alert after compaction. The existing desk chain refreshed two owner-reference pins and regenerated the seven register artifacts in e7958cd4; no roster or authority change. Final lint has issues=[], typecheck passes and register:check is true (generation sha256:1ff1fcf8efb0a0e7daf907355b233ed201b27eec0a87601cfbec1647fd3c78e9). This author submission makes no independent convergence claim.
VERDICT: author submission; no independent verdict claimed
