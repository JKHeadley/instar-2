## 6. Resume, continuation, and compaction

**Rule — four continuation cases remain distinct.** Rules 47, 68, 69, 96 and 110; **checks:
P13-NF-25/26/28/38**. The adapter distinguishes reconnecting to the same live incarnation,
resuming a runtime conversation in a new incarnation, continuing after context compaction, and
launching a replacement worker with no usable runtime conversation. Each case preserves the same
durable run and unresolved logical operations while recording a new launch or pause observation
where required. A runtime conversation handle is opaque source evidence. It confers no lease,
standing, grant, register generation, or proof that its recalled context is current.

**Rule — every cut triggers fresh authority and actual-start reads.** Rules 31, 47, 63, 68, 96
and 110; **checks: P13-NF-25/26/27/28**. A replacement process requires the current lease/fence,
a fresh worker incarnation and corresponding ownership admission. Reconnect to a surviving process
retains its incarnation. Compaction inside that surviving process also retains its incarnation,
because a worker incarnation is one process lifetime; it instead creates a new grounding and
context-consumption boundary. Every case reads current signed history, current clock, current run
graph, pending effects, current directives and register generation. Runtime-restored history is
supplemental input, not the grounding source. A stale, missing, rejected, or ambiguous runtime
handle cannot authorize fallback. Part Six recovery and the assembly choose whether to attempt a
fresh grounded replacement under an admitted policy.

**Rule — multi-machine posture is shared work with machine-local runtime handles.** Rules 31, 32,
63, 68, 113 and 114; **checks: P13-NF-25/38**. A **runtime-local handle** is a process id, process
start receipt, PTY or pane target, local socket, in-memory adapter binding, or equivalent handle
whose meaning exists only on the machine that observed it. Such a handle is never adopted by
another machine. Durable run and step identities, intake and effect identities, signed launch,
current-context and observation records, conversation handles as opaque evidence, leases, fences,
and recovery obligations are shared through their owning stores and retain the same logical
identity across machines.

A fresh same-machine reconnect may retain the process incarnation only after the current owner
re-resolves its fence and proves that exact local process-start identity is still live. A
cross-machine replacement is permitted only through Six's break-before-make handoff: current
ownership loss for the old epoch is committed, unresolved reservations and effects are preserved,
the new machine obtains the current fence and capacity, and Ten records a new launch, machine, and
process incarnation before Five grounds it. An unreachable old worker is fenced at every later
step, resource, provider, tool, and conversation-effect admission even if it never receives a stop
notice. It is not reported killed or quiescent without evidence. Late authenticated observations
may enter under separate observer standing; unresolved effects remain owned and are observed or
settled before any retry. During a partition, inability to establish exclusive current ownership
closes ordinary execution and preserves queued input; it never permits two speaking workers.

**Rule — compaction preserves classes and discloses the seam.** Rules 47, 69 and 110; **checks:
P13-NF-26/27/52**. The adapter delivers the same required governing-context classes after compaction
as at initial start, subject to the current generation, and records the new consumption boundary.
The process keeps its launch and incarnation. Inside the next `ground()` call, its injected reader
takes the new clock/history read and generates the exact new bytes; obtains the exact Eight
delivery admission and Six one-use claim; then appends and resolves a new Ten current-context
specification binding them and linked to the prior delivery and observed compaction-control
operation. Preparation and admission still do not invoke the adapter. The guarded driver then
delivers those bytes exactly once, observes claim consumption, and obtains and re-resolves the new
consumption observation before returning. That specification, not a mutation or reuse of
the launch manifest, is what Five compares with the current grounding. The changed-bytes positive
   is non-executable until the dated 08:48Z addenda in `seam-response-assembly-followup.md` and
   `seam-response-rungraph-followup.md`, recorded as GRANTED in `SEAM-LEDGER.md` row 45, land.
Part Five owns the designed `ContinuityAccounting` for the first reply: the pre-pause inbound,
explicit compaction disclosure, and `addressed`, `superseded`, or `pending` disposition. Its landed
decoder does not yet accept compaction grounding or export continuity accounting, so governed
post-compaction action remains unsupported. P13-NF-27 is non-executable until
`seam-response-run-closure.md` lands the record; P13-NF-26 is independently non-executable until
`seam-response-rungraph-followup.md` lands compaction admission, grounding, and public consumption.
The adapter cannot infer that the model remembered a message, suppress the disclosure, or declare
substantive adequacy from an output phrase.

**Rule — continuation never repeats an uncertain effect.** Rules 42, 55, 57, 63 and 68;
**checks: P13-NF-24/28/38/39**. On resume, the worker receives the exact pending attempt,
reservation, receipt, charge, and verification references from the run graph. The adapter observes
the original launch, delivery, provider call, tool, and outbound operations through their owners.
Neither a blank runtime transcript nor a missing process permits a new attempt. A new operation is
never admitted while occurrence, delayed execution, or charge remains uncertain. Even after
decisive non-occurrence, quiescence, and charge closure, the landed Six/Eight slice still safely
refuses the same request or semantic-message identity and reports `retryEligible: false`. An actual
retry becomes a required positive only after `seam-response-effects-followup.md` and
`seam-response-loop-followup.md` land. Those owner seams
must preserve the original logical request and digest and link a new attempt to the settled
predecessor; changing semantic identity is never a retry mechanism. The actual-retry positive is
non-executable until `seam-response-effects-followup.md` and `seam-response-loop-followup.md` land.

---
