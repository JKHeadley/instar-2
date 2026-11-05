# Change review — Attention health producer integration

Subject base: d87d7e523d2d119409600cc37361a495251e8949
Review state: open
Reviewed content: none
Outcome: Carry the existing obligation health observations into the installed Attention operator page, retaining entity-stable health rows and condition episodes. Row 88 remains OPEN for whole hub/standby/channel parity.
Affected rules: 1, 4, 7, 26, 28, 31, 32, 34, 39, 42, 44, 46, 49, 52, 53, 60, 63, 74, 79, 84, 87, 95, 101, 102, 105, 113, 116
Affected floors: secrets — existing redaction and encrypted journal, authenticated page; spend cap — no additional model calls; stop — existing owner/stop/expiry/activation boundary precedes every append; no duplicate sends — this producer never dispatches a send or retries work; durable intake — existing journal acceptance and atomic condition/item transition, with retained history.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Durable status and installed maintenance integration require real journal, HTTP and restart checks; full launcher/live acceptance belongs to the desk gate.
Side effects: New health observations write Attention records during the existing maintenance pass. At most four health identities per installation grant/chat are generated; identical repeated observations write nothing. Status is tracking only. A new health action requires the compatible journal reader on both machines, just like the existing non-additive Attention records.
Undo and recovery: Revert the producer before any health action is written; after a health action exists retain this reader or a compatible successor. Never delete frames to downgrade. No live root or authority installation changed.
Multi-machine posture: Same encrypted journal and replication owner. The producer identity uses a SHA-256 digest of the complete bot/chat/grant tuple, not a process or machine, so takeover does not mint duplicate health items. Only the current admitted journal owner writes. Standby ingress is still absent and is not simulated with a second writer.
Layer below: Read the constitution, register, original brief and prior report; inspected original 1.x AttentionConditionStore, RemoteAckStore, TelegramAdapter health recurrence and CollaborationSurfacer/hub contracts plus their tests. The existing obligation projection owns the measurement; the installed Attention surface owns mutation admission. No replacement model/provider or send owner.
1.x reference: TelegramAdapter.ts:4148-4372 (especially 4328-4372 entity-stable health recurrence), AttentionConditionStore.ts:63-133 (explicit episode lifecycle). Adapted into one journal frame to prevent a crash between condition observation and visible item persistence. No unrelated adapter code copied.
Bug class: unit
Bug evidence: reproducer=tests/preview/attention-queue.test.ts
Hook bypass: none
Convergence: none
Prompt review: No model prompt, model output parser, or model accept/escalate/refuse decision changed by the health integration.

Decision: AQ88-health-atomic | Persist the health condition and visible item in one existing journal frame; preserve human acknowledgement within an episode and reopen only after positive recovery. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-88-hub-standby-parity-1105-PROGRESS.md
Decision: AQ88-health-producer | Consume the existing obligation-health facts on the installed maintenance pass; four silent pull identities never retry work or turn tracking into authority. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-88-hub-standby-parity-1105-PROGRESS.md

Decision: AQ88-health-key | Bound the health entity key by hashing the complete installation tuple; valid long grant identifiers cannot overflow an item ID or stop maintenance. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-88-hub-standby-parity-1105-PROGRESS.md

## Closing block

simplestRobustRoute: Use the existing health projection, Attention page, journal and owner boundary. One atomic frame prevents a named crash gap; unchanged observation suppression prevents unbounded journal churn and acknowledgement resets. No new store, scheduler, transport, model call or send owner. No autonomous-completion or full parity claim.
80/20: The portable producer is tested at its actual HTTP consumer. Remaining row 88 obligations stay explicit in the builder report: hub transport/binding/model contracts and real captures, standalone authorized standby ingress, other producers and channel parity, plus Studio launcher proof and disposition of the prior 44 failures.
VERDICT: author submission only; independent review and live proof remain required.
