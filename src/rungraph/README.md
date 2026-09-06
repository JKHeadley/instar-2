# Part five: linear durable run core

This package implements the single-root slice of `docs/09-the-run-graph.md` §§1–3,
8 and 10–13. `createRunGraph` is the production core constructor. It has no timer,
provider call, transport branch, ambient clock, or storage implementation. The
feature declaration retains the full worst-case control/costly/user/chat profile,
bounded by `rungraph.bound`, while production activation remains dark. Its gate
is P5-NF-54 with a 2026-10-05 UTC ceiling; unavailable production live proof is
omitted, never replaced by a weaker profile. Six owns repeated scheduling,
reservations and dispatch. No exactly-once external-effect claim is made.

`register-source/owner-references.json` pins the actual decoder exports, build
fixture, CI workload probe and governed design using P1 canonical source hashes.
P3 resolves these references and verifies the gates' actual source calls. Replay
reports missing contract approval/standing as prerequisites; it is shape-only,
not an entering-force generation. Runtime installation still requires the real
P2/P3 verified register and contract history. The probe's 1000ms cadence describes
the declared CI workload bound, not deployed scheduling or supervision.

## Owned records and ordering

Five owns `Run`, `RunBudget`, `RunStep`, `RunTransition`, `RunExit` and
`SessionGrounding`, their closed decoders and the run projection. Grounding uses
schema version 2 to bind worker/harness to independently resolved ownership and
execution context. Version 1 grounding cannot acquire that missing authority by
migration: it requires a new actual read. Other owned records remain version 1.
`Run` is immutable; its id hashes its admitted opening cause. A start transition
contains the immutable step in the SAME signed fact, before any executor may
consume it. An outcome transition references a prior P1 Outcome and eight's
settlement evidence before clearing pending work. Unknown execution OR charge
keeps the step pending, including after restart. Replaying the identical accepted
transition retrieves state; it never dispatches. An old operation key cannot be
admitted again even after settlement. Independent newly admitted work is allowed
only after the predecessor is settled. Attempts and credits remain seven/six's.
Canonical identity commitments include every embedded RunBudget, RunStep and
RunExit as well as Run/RunTransition/SessionGrounding, and survive settlement.
Safety-ceiling, actual-start and exit clock comparisons use P1's subject-aware
consumer; a foreign clock domain is uncertainty, not a comparable scalar.
An authenticated stop cannot acquire newly proposed completed authority without
authorized resume. Causally prior completed work is not erased by a late stop.

P2's status-bearing snapshot and current-source authority read are mandatory.
The fold also calls the durable owner-witness reader: a raw shape-valid fact is
not an admission receipt. Incompatible successors yield P2 `ConflictClass`
diagnostics and inhibit execution. P1's constitutional Conflict does not accept
P5-owned sides; no counterfeit P1 Conflict is manufactured. There is no conflict
resolution API in this slice. Equal logical transitions deduplicate by canonical
bytes, not arrival time. All records are retained; wake queues are disposable.

P1 Scope and Measurement values are decoded by P1, including after JSON replay.
References to constitutional authority remain origin-pinned references, not live
grants. The P2 owned-body wire policy represents its variable-key frontier map
as bounded canonical JSON text; public records retain P2's CausalFrontier map.
Messages require captured bytes and a separate harness consumption receipt.
Full history above the configured threshold refuses: summary accounting is not
implemented. Conversation ordering is single-lineage in this slice.

## Six-field behavioral seams

| Producer | Consumer | Record / port | Required order | Failure behavior | Closure owner |
|---|---|---|---|---|---|
| One | Five | constitutional decoders, historical readers and Result/Outcome consumers | Verify signed origin before consuming; rehydrate only through owner APIs | Typed refusal; no cast into authority | One for types; five for calls |
| Two | Five | FactStorePort.readForProjection; ProjectedView | Complete signed prefix and mandatory taint before every decision | Poison, unknown coverage, stale view or conflict inhibits | Two for spine; five for fold |
| Three | Five / build | decodeRunGraphRegistration; colocated declaration; ProjectionGeneration | Decode shape at installation/build; assembly supplies pinned generation before reads | Unknown schema/generation refused; shape-only is not live governance | Three for register; eleven for entering-force assembly |
| Four | Five | resolveIntakeOwner; actual intake-admitted; control.verify | Resolve opaque IntakeWork owner through installation-pinned P1 record; retain original cause/Intent; verify stop/resume before append AND replay | Unresolved/mismatched ownership refuses; stop never settles effects; timer never resumes | Four for intake/control; five for owner-resolving acceptance |
| Five | Six | RunAdmissionPort.create/commit | Conditional cause/head/fence admission surrounds exact append callback | No-op, mismatched receipt, stale fence and duplicate callback refuse | Six for atomic exclusion; five for acceptance |
| Six | Five | RunAdmissionPort.verify/execution/reservation; AdmissionReservation | Read historical witness for root/transition/consumed grounding; independently resolve actual worker under ownership; verify exact operation reservation | Old-worker/new-lease grounding refuses; missing witness/reservation refuses; expiry does not erase history | Six; real adapter composition pending |
| Eight | Five | settlement.read; P1 Evidence and Outcome refs | Recorded outcome, closed executor claim and settled charge before advance | Unknown execution/charge retains original key and pending obligation | Eight for settlement; five for state |
| Nine | Five | exitCheck.verify; P1 Evidence and Result refs | Exact unchanged exit bar, subject and fresh evidence before closing | Refused/missing/stale/changed proof cannot complete | Nine for check; five for closure |
| Ten | Five | RunWriterPort | Sole P2 append and durability receipt before return; required refs deduplicated | Lost ACK preserves fact; missing durable append refuses | Ten for persistence adapter |
| Ten / worker harness | Five | GroundingReadPort; SessionGrounding | Actual clock/read/deliver/consumption receipt before start, repeat after restart | Gaps, stale clock, unavailable bytes, omitted briefing or new inbound hold start | Ten for read/delivery; five for validation |
| Five | Eleven | createRunGraph; read-owned-obligations; public package | Supply real owner ports, grounded worker and effect boundary in initialization | Missing ports refuse; no library fallback to execute | Eleven for real-surface slice assembly |

Evidence consumer contracts: settlement evidence source is configured explicitly;
claim subject is the operation key, predicate `operation-settled`, value names the
exact digest and `claimClosed`/`chargeSettled`. The eight-owned reader must agree
with this signed evidence and Outcome. Exit evidence uses the configured check
producer, subject, `exit:<check>:<version>` predicate and acceptance hash. Ten's
consumption fact binds worker, harness, canonical JSON `hashes` and `classes`.
These are requirements on owner adapters, not substitute owner implementations.

`resolveIntakeOwner` consumes P4's actual `intake-admitted` fact through its
installed `IntakeWork` decoder. `RunDecodeContext.intakeOwners` is trusted,
installation-pinned resolution from the opaque work-owner key to a P1-verified
agent/system principal reference. It does not mint authority from message text.
The original fact remains both the Run's cause and its Intent source; the owner
may refer to a separate installation identity record. The owner mapping must be
available when admitting and rebuilding the Run. The actual-output test loads
P4's unmodified exports and fixtures at `28c84e0` from pinned git objects, with
shared P1/P2/P3 public packages. Missing pinned source is a failure, not a skip;
full-history CI checkouts provide the reachable P4 commit. No copied P4 schema
or replacement stimulus is involved.

## Built scope and explicit residuals

Designed, not yet built: delegation contracts; fan-out/collection; exhaustion
runs; awaiting-authorization; agent-transport port beyond six's slice needs;
summary/compaction continuity accounting; remote/nested traces; judgment attempt
mapping; production real-surface assembly and production monitoring/supervision.
Cancellation/unreachable exits and boundary-review loops are also not exposed.
Operator-set ceilings are 32 children / depth 16 / 3 attempts (PR #22); actual
slice depth is 1 and children are empty. Zero resource capacity remains zero.

Tests exercise P1/P2/P3 public consumers, a real fsynced disk spine, a killed
compiled-package worker, and controlled six/eight/nine/ten contract fixtures.
The intake-durable/pre-root SIGKILL leaves only the intake fact. Separate fresh
boots reconstruct one accountable root from that fact plus installation policy,
not a parent-supplied Run. A pre-start kill and independent persisted replacement
placement then prove old-grounding refusal and newly grounded start. The separate
effect-before-response kill remains an uncertainty/reconciliation test.
Those fixtures are NOT evidence that the other owners' real adapters converge.
P5-NF-29/49/50/55/56/59/60 retain explicit production/residual skips alongside
the implemented portions. No Rule is labeled fully held by this package.
The inherited-duty residual owner is eleven for assembly, six/eight for effect
and recovery realization, seven for judgments, and five for deferred run forms.
Echo's orchestration/review loop revisits these at slice assembly, with design
§12's calendar ceiling 2026-10-05; closure requires real port/lifecycle evidence.

The build map reads actual test results and marks partial rows as partial.
The scoped fold workload records fact count, pending count, conflict count and
duration with a 5-second test budget; it is not a provider-latency assertion.
Production probes, cadence and Tier-1 supervision remain eleven's assembly duty.
