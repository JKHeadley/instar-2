# When a conversation worker disappears

An accepted question belongs to the conversation, not to the process answering it.
If that process disappears before preparing any tools for the current question,
Instar starts one replacement with the exact saved question and context. The
replacement uses the time and model calls left in the original allowance. The
person does not need to send the question again.

Recovery uses the existing conversation owner and harness continuation adapter.
The host records its recovery attempt before starting a replacement. A second
loss, an operator stop, a withdrawn grant, an exhausted allowance, an incomplete
observation, an uncertain send or effect, and pending child work all prevent
revival. A paused or slow worker is not evidence of a dead worker.

If the lost worker prepared a tool, Instar keeps the question and explains that
the tool's outcome needs reconciliation. Even a tool that returned successfully
is not permission to repeat the original question: the saved input predates that
work. A missing effect record never means the effect did not happen.

This slice handles worker loss while the conversation host is still running.
A host restart retains unresolved dispatched input as uncertain. Queued input
continues through the existing startup recovery path. Batched active inputs are
retained for reconciliation, rather than replayed as a new batch.

Worker processes and their replacement are local to the current conversation
owner. Existing ownership fencing, durable intake, admission hooks, result
collection and send identity continue to govern both local and multi-machine
installations. No new queue, timer or store is added.

A delivered promise whose background work becomes uncertain keeps its execution
hold. On the next ordinary obligation cycle, the conversation receives one plain
interruption notice. Simultaneous interrupted promises in that conversation share
one notice. The promise remains open and visible as stalled in status; the existing
scheduled observation still checks for a saved result. This notice neither starts
another worker nor claims that the promised result was delivered.

The notice uses the existing signed outbound doorway, with its intent durably
recorded before dispatch. Restart and journal compaction preserve that identity.
An unknown notice delivery is not retried. Stop, the reply allowance, conversation
ownership and audience admission still govern delivery.
