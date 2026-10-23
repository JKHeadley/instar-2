# Connection recovery while an answer is being written

An interrupted model request keeps the original message, worker and allowance.
The native client's reconnect attempts run under the existing call budget and
original turn deadline. Instar does not type the question again, press Enter,
or start a second retry loop. A completed answer still needs its matching result
and authenticated turn-end receipt. Exhaustion leaves the attempt uncertain and
retains the request.

If the captured native retry state persists through the normal two-minute
conversation silence window, the existing progress lane can send one line:

> The model request is being retried. Your message is saved; Instar is waiting for those attempts to finish.

This line reports a wait, not successful recovery. Its identity belongs to the
worker and turn, so changing retry numbers cannot produce repeated notices.
The existing reply budget, reserved final-answer slot, stop checks, audience
checks, infrastructure attribution and durable send intent still apply. Unknown
notice delivery is not retried. A quick recovery needs no extra line.

The adapter observation in `src/assembly/production-session-driver.ts` feeds the
already-installed `workingActivities.observeSession` call in
`tests/preview/journal-agent.mjs`. `tests/preview/working-activity.mjs` projects
that observation and `tests/preview/working-progress.ts` supplies the fixed text.
No model instructions or train timing change.

The starting implementation is Instar 1.x `SocketDisconnectSentinel.ts`,
`sentinelWiring.ts` and the silently-stopped trio in `src/commands/server.ts`
at `2461cfcf734bbd41d189c55e6e0ddd1b7598bf66`. The bounded episode and shared
notification path carry forward. Its broad text matches, terminal nudges and
claim of recovery when error text disappears do not: the recorded 2.0 native
client already owns backoff, and only correlated completion proves recovery.

This slice covers the recorded Claude native retry/exhaustion path. It does not
claim recognition of every socket error spelling or recovery on every harness.
Tests replay captured updates 1016101/1016102 through the driver, public adapter
and conversation owner, and retain final proof records 1016105/1016106. Those
historical live proofs establish the inherited recovery path, not live delivery
of this new wait line. The new line is exercised through the real journal worker
with simulated transport and time; current-head live acceptance belongs to the
Studio gate.

Physical observations are deliberately machine-local. Existing conversation
ownership and durable intake/send records remain responsible for cross-machine
coordination; this feature adds neither an owner nor a store.
