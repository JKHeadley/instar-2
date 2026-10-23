# Continuing conversation worker

`codex-conversation-worker.ts` implements the existing asynchronous conversation contract.
`createProductionConversationAdapter` in the session driver chooses this worker only for
its framework. The default still constructs the existing terminal adapter; even the
protocol transport is lazy. The existing per-instance doorway selection and account pool
supply the executable and isolated login home, admission hook, model checkpoint and
prepared connector launch references. No account credential is copied by this worker.

`session-protocol.ts` is the injected physical port; `scripts/session-protocol-io.mjs`
implements bounded, correlated JSON-line RPC over private process pipes. Requests and
notifications are captured in the host directory before projection. No RPC is retried.
The common host records dispatch intent before delivery and retains uncertain inputs
through restart. The transport closes only the recorded PID with the matching start
stamp, and a reconstructed transport can retire the previous incarnation. Process
inspection that cannot establish identity retains uncertainty and capacity; only observed
absence or a different start stamp retires a reconstructed identity without signaling. Process
records and protocol captures are machine-local; conversation ownership and durable
intake remain with the existing host and its replication policy.

Start and resume use the same admission and model checkpoint overrides. The returned
thread id enters the existing session journal before launch succeeds, under both claim
and topic. A cache miss requires agent-owned continuation; its context accompanies the
next new input without replaying the old one. A completed turn's bound final answer (or
the existing bounded result artifact when present) is exposed only after successful
terminal evidence. Failed, interrupted and empty turns produce no reply. Changed input
bytes, another incarnation, another turn, uncertain submission and transport loss never
authorize a retry or a successful answer.

The common host can explicitly restore an accepted no-tool-work input after worker
loss. The adapter requires its prior accepted submission, confirmed connection
closure, matching saved bytes, a new claim and remaining original lifetime. It
starts the restored turn through its normal delivery path before returning the
replacement handle. A bare launch never replays input. A missing host receipt or
an uncertain RPC submission remains uncertain across restart.

For explicit lifecycle closure the host closes admission before control. Control interrupts the exact active turn and
closes the exact physical process. A host stop or finite lifetime also closes the pipe
process. The model checkpoint, not cumulative protocol token usage, holds spend limits.

A failed initialization/start/resume clears its local connection only after physical closure
succeeds, so the host can retire its claim and lease before a fresh launch. Unconfirmed
closure remains a failure and cannot release the host lease.

Stall coverage: unanswered RPC -> bounded timeout, uncertain input retained; lost/malformed
transport -> exit/paused, no replay; open turn -> host/physical deadline; missing cache ->
complete agent-owned grounding; failed/empty turn -> no reply; withdrawn authority -> host
admission close and exact stop; unresolved restart input -> common host reconciliation.

Tests use captured Codex 0.156.1 lifecycle notifications and a local replay process.
They do not certify tool-hook execution, subscription access, account custody on the
identity bridge, or a live user walk. Those require the desk's specified proof-room run.
The existing unproven parity declaration is unchanged.

Automatic idle cleanup uses the same control port with an idle fingerprint. The
protocol adapter requires a completed correlated turn and a live exact connection;
subsequent captured frames invalidate its quiet state until another known turn.
It rechecks the fingerprint immediately before closing. The terminal adapter
requires a closed-turn receipt plus the current affirmative ready frame and no
active or recovery marker, then revalidates inside the driver's exclusive boundary.
An absent or unknown observer retains the worker. Cleanup never interrupts an open
turn. Its confirmed close is followed by admission and lease release; a refusal
leaves admission open. The common host owns confirmation, grace and failure handling.
