# Codex conversation protocol adapter

`codex-conversation.ts` maps continuing-conversation operations to Codex app-server
requests and reads a bounded turn from captured notifications. It has no I/O, authority,
queue, journal or transport. This is a compatibility building block, not a registered
production worker; the shipped `unproven` declarations remain accurate.

## Host contract

1. Launch `codex app-server --listen stdio://` with the existing resource lease, exact
   process identity, isolated configuration, tool admission hooks and model-dispatch
   checkpoint. Only the custodian supplies login/account access. Hold the conversation's
   allowance across all turns. Never inherit the operator's serving configuration.
2. Send `initialize` with an RPC id, await success, then send `initialized` without an id.
   Demultiplex responses by id; RPC errors never count as successful launch or delivery.
3. Send `start` or `resume` with the same current prepared policy. Persist the returned
   thread id. The `config` map passes host-prepared `hooks.PreToolUse`, `hooks.PostToolUse`,
   `model_provider`, `model_providers.<name>` and `mcp_servers` exactly on both paths.
   Use socket-backed credential launcher references, never credential strings. Passing
   configuration does not certify its enforcement. Hook/account proof is still required.
4. Admit each durable input under its operation and current owner/incarnation. Queue
   while busy in the host: `turn/start` can steer a busy Codex turn. Record the attempted
   dispatch BEFORE sending `deliver`; never replay it after an ambiguous response.
   An RPC id is not an idempotency key. This module performs no retry or send itself.
5. Bind a reader to the returned turn and thread ids. Capture notifications arriving
   before the RPC response until they can be bound. Feed completed item, token usage
   and terminal notifications to it. Only completed turns expose reply text. Commentary,
   failed/interrupted output and empty bubbles are not outbound replies. A completed
   turn without text remains distinct from an open turn.
6. Retain raw frames before projecting them. Reader state is disposable, machine-local
   and replayable, not the conversation record. Persist completion/output against intake
   before the audience/secret checks and durable no-duplicate-send doorway.
7. Usage is **thread cumulative**, not turn cost or number of calls. Missing usage stays
   unknown. The external checkpoint meters/caps every request, including internal retries
   and children. On stop/expiry close admission first, send `interrupt` for the exact
   thread/turn, then terminate the exact owned PID if terminal evidence misses the deadline.
8. On transport loss call `lost`; do not regenerate a possibly executed turn. Reconcile
   stored thread state with durable attempts. Missing resume cache needs the existing
   complete agent-owned continuation, never an empty replacement. Start/compaction
   grounding stays with the host's awareness machinery.

## Common contract changes for the desk

Provide asynchronous start/resume, further admitted-input delivery, a bound turn result
(status, reply, evidence, usage subject), and cancellation behind one neutral port.
`NativeHarnessDriverPort` is synchronous and has no reply field. The assembly and
part-thirteen adapters bind delivery to the first launch input. Extend that contract
once, without harness switches in lane A.

Lane A `production-conversation-session.ts` at `11c40b11` polls a synchronous driver and
reads a JSON result file. A neutral port can accept either a verified result artifact or
captured reply text. One turn is not one model call; terminal evidence does not authorize
an outbound send. No lane A edits are included here.

Tracked integration: owner desk lanes A/B; acceptance is a registered worker completing
the recorded 24-message proof-room walk with the five floors and exact owner bindings.
This module does not install a transport or claim that acceptance.

## Evidence and limits

Mapping checked against installed 0.156.1 `app-server generate-ts` and the
[official protocol](https://learn.chatgpt.com/docs/app-server).
Fixtures contain unchanged outer notifications captured from that real binary with an
empty private home and a deterministic loopback SSE provider. Two turns completed in
one thread; resume rejoined it. A malformed fake provider response proved the CLI can
emit reply items, retry, then close as failed. Upstream reply text and token usage are
fabricated. No paid model, serving login, actual tool hook, connected account,
process-restart resume, or user surface was exercised. Interrupt, isolation and malformed
neighbors use a fake harness. The desk's real walk is this unit's acceptance tier.
