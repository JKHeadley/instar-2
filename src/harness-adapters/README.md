# Session harness adapters

Part Thirteen Slice A1 owns only package-local adapter records, their total
decoders, operation-attempt admission, signed-observation admission, and the
declared progress identity. These values are not core facts, permissions,
effect settlements, run transitions, capture custody, or lease authority.

The holder lifecycle is structurally absent. Durable journal reads and
rotation, pending-work decisions, completion, liveness, reconnect, and resume
confirmation are `NON-EXECUTABLE-UNTIL-slice-A2`. Output ranges decode and
deduplicate in A1, but output cannot be credited as owner-resolved progress
until Slice A2 binds a landed current Part Two capture-custody read.

## Native turn worker

`native-loop.ts` owns the native model/tool loop (Rules 2, 30, 55, 60 and 115).
It receives an already prepared context, finite turn bounds and host ports for
model dispatch, stop, tool admission, tool execution and result recording. It
imports no private core implementation and performs no ambient host I/O.
Each model call consumes one step; the final step can answer but cannot start
tools. Every tool passes admission, a stop check, execution and recording.
An answer is returned unchanged to the caller's reply path; the worker sends
nothing. Unknown containment remains in the result for the owner to reconcile.

The preview native host in `tests/preview/native-loop.mjs` supplies those ports
using its existing admission hook, resource owner and sandbox. It delegates
parsing, envelope assembly and the entire turn loop to this module. The pure
worker tests replay the recorded 2026-10-03 task, scope and stop model values;
the preview tests verify the physical host boundary on macOS.

This is a turn worker, not a continuing-session driver. The adapter's durable
launch and delivery records remain authoritative. Grounding a new turn, deciding
whether to resume an interrupted operation, persisting a reply and committing
its send belong to the owners; a worker return is not evidence of a sent reply.
