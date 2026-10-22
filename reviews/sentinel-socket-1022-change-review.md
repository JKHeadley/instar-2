# Change review — Explain bounded native connection recovery

Subject base: 4a2635bc2064d5eaec5e451360634eeabecaad9d
Review state: open
Reviewed content: none
Outcome: A prolonged native reconnect episode produces one honest infrastructure line through the existing durable progress lane, while the native client alone owns bounded recovery and uncertain effects are never replayed.
Affected rules: 1, 5, 26, 30, 32, 34, 36, 42, 46, 49, 52, 55, 59, 60, 61, 63, 68, 70, 74, 75, 76, 87, 89, 101, 102, 105, 111, 113, 116
Affected floors: secrets — fixed text through existing outbound checks; spend cap — original native call reservation and progress reply budget; stop — existing driver and outbound stop checks; no duplicate sends — no new worker input and existing durable progress intent consumes unknown deliveries; durable intake — original request remains in owner custody.
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: User-visible recovery observation and notice, with no new effect authority, model instruction, parser grammar or retry engine.
Side effects: Native countdown observations now explicitly identify a connection wait. One fixed notice may consume a progress reply after the existing two-minute silence window; overlapping batch members share the occurrence, and the final answer slot remains reserved. Retry count changes cannot reset notice identity. Session journal and original turn deadlines are unchanged. Old binaries do not recognize the new connection wait tag in progress records.
Undo and recovery: Stop producing connection notices before rolling back; retain this reader for journals containing connection-tagged progress records. Do not blindly downgrade that reader or replay UNKNOWN sends. Reverting only the driver wait signal suppresses new notices while preserving readable history, native retries and original request custody. No installed settings/defaults migration is required.
Multi-machine posture: Exact-worker physical observations remain deliberately machine-local. The existing owner fence, durable conversation journal and effect identities still serialize work and sends. No peer takeover or new state store.
Layer below: Read 1.x SocketDisconnectSentinel.ts, sentinelWiring.ts buildSocketDisconnectDeps and server.ts silently-stopped trio at 2461cfcf734bbd41d189c55e6e0ddd1b7598bf66. Inspected 2.0 native retry evidence, original deadline and Stop/result correlation, admission-gate reserveCall, conversation adapter/owner, installed observeSession wrapper, progress freshness and intent-before-send projection. Legacy Enter nudges are not appropriate alongside a native retry loop; disappeared text is not proof of completion.
Bug class: integration
Bug evidence: reproducer=tests/assembly/production-session-driver.test.ts; tests/assembly/socket-drop-replay.test.ts; tests/preview/working-progress.test.ts
Hook bypass: none; core.hooksPath unset and common hooks directory contains samples only.
Convergence: none
Decision: socket-native-owner | Keep the already bounded native retry owner instead of importing legacy terminal nudges; expose its captured waiting state and retain correlated completion. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sentinel-socket-1022-PROGRESS.md
Decision: socket-notice-once | Port the shared notification lifecycle into existing durable progress with one stable worker-turn identity and unchanged silence cadence. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sentinel-socket-1022-PROGRESS.md
Prompt review: No how-to-work prompt changes. Existing captured native frames from 1016101/1016102 traverse the real driver, adapter and owner. Recorded summary 715672480, uncertain summary 715672483, Jev undecided 715672482, Jev unsure 969389570, reply-review 969389923, delivered reply 715672479 and empty candidate 715672550 traverse the new notice path. Empty candidates are not called delivered replies. Historical proofs 1016105/1016106 establish inherited exhaustion/transient recovery, not current-head live delivery of this notice.

simplestRobustRoute: This is the simplest robust route: preserve native recovery, expose the existing exact retry observation, and reuse the installed progress doorway. The new signal prevents a long native retry from being indistinguishable from silence. Start guards are exact live worker, admitted current turn, changed native countdown, original deadline and fresh matching projection. End guards remain correlated Stop/result or honest exhaustion; stale evidence stops notices. Existing native attempt/call bounds, stop, reply cap and intent deduplication supply limits. No new watcher, store, timer, prompt, nudge or model call. Current-head replay evidence is not an autonomous live-acceptance claim.
80/20: One captured native recovery slice, red-before-green tests and adjacent refusal/stop/budget/restart checks. Legacy socket spelling completeness and cross-harness parity are not asserted by this slice.
VERDICT: author submission; independent review and live acceptance belong to the desk
