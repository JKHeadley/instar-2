## 1. Ownership and boundaries

**Value — the conversation lives in a full session.** The session is the agent's working
mind, hands and voice: it reasons, uses tools and connected accounts, delegates, answers, and
continues when the next message arrives. Instar retains its identity, history, work and authority
when that worker is replaced. A conversation can outlive many processes and contain many runs;
neither a message nor a process exit defines the end of the conversation.

**Rule — one public contract, with one owner for each fact.** Rules 29/30/32/49/63/68/114/115;
checks P13-NF-01/03/08/19/38/41. Ten owns the public `HarnessAdapterPort`, launch, current-context
and observation records. Thirteen implements adapters and their local drivers. The core depends
on that port, never on a vendor session driver. No application, scheduler, conversation host or
model-route consumer branches on a harness name. The composition root selects an adapter by its
registered identity and capability evidence; executable names, CLI flags, protocol decoders,
transcript formats and environment names belong inside the selected adapter package.

| Owner | Responsibility at this boundary |
|---|---|
| One and Four | Verified input principal, standing, stable source identity, conversation binding and durable intake. An input can use authority, never create it. |
| Two and the conversation owner | Ordered history, captures and their custody. Accepted input, reply candidates and uncertain operations survive worker loss. |
| Five | Runs, steps, grounding, continuations, delegation and work completion. The session consumes these references; it does not decide their lifecycle. |
| Six | Current ownership/fence, resources, spend reservations, bounded recovery and retries. |
| Seven | Model route and model-call evidence, including system-initiated calls. |
| Eight | Effect admission, durable preparation, dispatch, observations and settlement, including outward replies. |
| Nine | Independent protection and applicable verification. |
| Ten | Public worker contract, admitted assembly, actual context delivery and physical bindings. |
| Thirteen | Runtime translation, exact local process handles, decoding correlated observations. |
| Eleven and awareness | Reachability reserve and the current briefing delivered at start, resume and compaction. |

This contract adds no competing queue, grant store, promise store, model router or run engine.
The conversation coordinator is common application code over those owners. Scheduling selects
work for the same port; a scheduled task's output destination is not a universal instruction
that every session must avoid answering its person. Run/step correlation comes from Five's
conversation design, not a second session-local definition of a run.

**Rule — local handles are replaceable, durable work is not.** Rules 26/31/32/63/68/113;
checks P13-NF-15/24/25/38/49. An incarnation is one process lifetime. Process ids, terminal pane
handles, sockets and vendor resume tokens are machine-local evidence; another machine cannot
adopt them as authority. Launch, delivery, run, intake, captured output and effect references
remain in their owners' shared records. Missing local handles trigger reconciliation with those
records. A read error is unknown, never an empty queue or proof that a worker died.

**Value — smallest robust route.** Keep the existing immutable launch and per-delivery context
record, existing ownership, durable intake and effect claim. Add only the worker operations and
observations needed to drive a continuing session through that boundary. Five public methods
serve all workers; a second conversation-specific adapter interface would create two places to
fix every lifecycle fault. A single local owner works without a peer. The same admission and
fence fields allow placement elsewhere without changing this port.

### Evidence dependency index

**Rule — existing evidence remains resolvable without certifying new behavior.** Rules 26/69/90;
checks P13-NF-01/02/07/48. The repository's A1/A2 contract maps use the names below for partial
implementation evidence. These citations identify owner boundaries, not a claim that every
named capability is absent or that a letter grants runtime authority. New conversation
conformance must execute this document's current cases. A stored A1/A2 result retains its
original meaning; it cannot certify a new port method or later-input behavior by sharing a
check number. The public-contract build unit updates the map and its consumers with its actual
implementation evidence.

The stable label **LIVE-PREREQUISITES** means CTX-GROUND, CTX-CURRENT, HISTORY-COVERAGE, RUNTIME,
ROUTE-CONFORMANCE, PROVIDER, CONTINUITY, COMPACTION, BREAKER, RECOVERY, RETRY, HARNESS-EFFECTS,
PROMPT and MINIMAL-PLANE in the A1/A2 evidence vocabulary. The index locates their grants in
`SEAM-LEDGER.md`; the actual floors and behavior are specified in sections 2–12.

| Evidence label | Owner reference and capability |
|---|---|
| CTX-GROUND | Five: dated 06:33Z addendum in `seam-response-rungraph-followup.md`, ledger row 38; production grounding-consumption validation. |
| CTX-CURRENT | Ten/Five: dated 08:48Z addenda in `seam-response-assembly-followup.md` and `seam-response-rungraph-followup.md`, row 45; immutable current-context delivery and fresh grounding. |
| HISTORY-COVERAGE | Five: dated 09:10Z addendum in `seam-response-rungraph-followup.md`, row 52; complete ordered history and covered summaries. |
| RUNTIME | Seven/Ten: `seam-response-judgment.md` and `seam-response-assembly-followup.md`; model route, runtime configuration and capability report. |
| ROUTE-CONFORMANCE | Ten: dated 07:52Z addendum in `seam-response-assembly-followup.md`, row 42; route-bound conformance and activation. |
| PROVIDER | Seven/Eight: `seam-response-judgment.md` and `seam-response-effects-followup.md`; real prepared call and receipt. |
| CONTINUITY | Five: `seam-response-run-closure.md`; continuity accounting. |
| COMPACTION | Five: `seam-response-rungraph-followup.md`; compaction grounding and delegated work. |
| BREAKER | Six: `seam-response-loop-breaker.md`; shared bounded recovery episode. |
| RECOVERY | Six: `seam-response-loop-followup.md`; ordered action/observation recovery. |
| RETRY | Eight/Six: `seam-response-effects-followup.md` and `seam-response-loop-followup.md`; decisive closure before another attempt. |
| HARNESS-EFFECTS | Eight: `seam-response-effects-payloads.md` and `seam-response-effects-followup.md`; admitted process, delivery and control operations. |
| PROMPT | Eight/Ten: dated 07:10Z addendum in `seam-response-effects-followup.md` and the paired `seam-response-assembly-followup.md`, row 41; exact-call allow-once response. |
| MINIMAL-PLANE | Eleven/Ten: `part-eleven-seam-response-assembly.md`; real reserved reachability composition. |
| Cross-machine placement | Six: `design-harness-adapters-seam-request-cross-machine-ownership.md`; successor authority, never adapter-local lease replacement. |
| Captured output custody | Two: `design-17-harness-adapters-seam-request-part-two-capture-read.md`; actual current captured bytes and gap status. |
