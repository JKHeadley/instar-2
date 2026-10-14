## 7. Honest liveness, progress, and completion

**Rule — observations say exactly what their source proves.** Rules 13/26/36/39/42/59/68;
checks P13-NF-15/21/29–34. Ten extends `HarnessObservation` with typed delivery, output, terminal
and usage payloads instead of encoding them in free-text detail. Thirteen normalizes actual
runtime events into this vocabulary:

| Observation | Meaning |
|---|---|
| Started / live / probe unknown / exited | Evidence about one exact process incarnation, with source time and freshness. Probe failure is not death. |
| Input accepted / context consumed | The exact runtime input receipt and the separate evidence that the current manifest reached the model-context boundary. |
| Model/tool activity | Correlated attempt, admitted call, returned result or new output range; a heartbeat or repeated event is not work progress. |
| Reply candidate | Captured answer content and completeness, bound to its delivery; not a sent message. |
| Turn ended | Terminal status, reply or explicit no-reply, pending operations/children and accounting; not the run's exit test. |
| Context boundary / control outcome | Correlated compaction, interruption or close evidence. A request to compact is not proof it worked. |
| Usage | Exact attempt/component/model/account attribution, tokens/charge or explicit unknown/exception and retained exposure. |

The record carries source identity, launch/incarnation, current delivery/work references,
source position, clock and capture references. Duplicate source events or republished output
ranges cannot create another reply or new progress. Conflicting content at the same position
is an explicit fault. Ordered observation batches are bounded by bytes and count. The host
persists observations before advancing its cursor. A crash after recording and before cursor
advance is handled by deduplication; a missing range returns a gap, never silent end-of-stream.
Local observation storage applies backpressure at its bound and cannot discard unrecorded events.

**Rule — output and completion are separately checked.** Rules 26/34/42/62/68;
checks P13-NF-31/32/33/34. A runtime terminal event plus closed or explicitly pending streams and
child operations ends the turn. Missing final output can still leave an honest interrupted or
uncertain result. A final sentence without a terminal witness does not close a turn, and exit
zero does not complete a run. Five checks the exit test and Nine checks the applicable evidence.
The outward path records its own send receipt; neither consumes a runtime success label as proof.

**Value — useful diagnosis without another authority.** Retain compact lifecycle events and
required captured input/output. Terminal render, spinners, prompt glyphs and file sizes can help
investigation, but cannot prove readiness, completion, consumption or quiescence. Optional pane
snapshots follow the operator's diagnostic policy and custody rules. Collect no second full
transcript merely to prove that the authoritative transcript exists.
