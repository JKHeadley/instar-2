## 1. Ownership and boundaries

**Rule — part sixteen defines no new core type.** Rules 1, 30, 49, 69 and 90; **checks:
P16-NF-01–03**. A measurement ledger is this package's name for registered producers, existing
fact payloads, disposable projections and surfaces. It is not a type. The package consumes only
public doorways and types owned by the earlier parts. It creates no second fact envelope,
judgment record, budget, authorization, effect, verification grade, run, loop, adapter contract
or operator surface schema.

| Owner | Names consumed here |
|---|---|
| One | `Measurement`, `Evidence`, `Result`, `Outcome`, `Decision`, `Authorization`, `VerifiedPrincipal`, `Conflict`, provenance, subject and unit values |
| Two | fact envelope, causal frontier, signed history, correction, retraction, capture reference, projection, checkpoint, folded-through vector, durability state and taint |
| Three | `Declaration`, registered identifiers, `constructGoverned` and `GovernedConstruct`, register generation, profiles, rules and check-run records |
| Four | `IntakePort`, event-id authority, operation classification, authorization request, original evidence custody and session-start evidence |
| Five | `Run`, `RunStep` and `RunBudget` |
| Six | `Lease`, `FenceToken`, `AdmissionReservation`, spend reservation, `SettlementApplication`, `LoopPolicy`, `LoopRecord`, `RecoveryRecord` and transport receipt |
| Seven | `JudgmentRequest`, `JudgmentAttemptRecord`, `BenchmarkRecord`, `BenchmarkScenario`, `BenchmarkRunRecord`, `JudgmentHoldCost` and provider receipt |
| Eight | `OperationDefinition`, `EffectRequest`, `OperationObservation`, `EffectSettlement` and verification obligation |
| Nine | `VerificationPlan`, `ProbeRecord`, `VerificationAssessment`, `Grade`, `BenchmarkEvaluation` and the existing retention/protection contracts |
| Ten | `ModelAdapterPort`, process, persistence and channel adapter ports; executable assembly; store custody; `GrowthPolicy` and `GrowthObservation` |
| Eleven | registered operator surface, scoped read, verified operator act and independently witnessed receipt |

**Value — boundary choice.** Sixteen owns the observational package and its read semantics. Seven
owns why a model was asked and the benchmark against which its result is judged. Eight owns the
effect that can spend, freeze, throttle, kill or change a cap. Six owns conditional admission,
reservation, fencing and application of settlement accounting. Nine owns whether the collectors
and projections are presently adequate. Ten realizes the adapters and storage. Eleven presents
the views and operator actions. Keeping those owners separate makes a missing metric a visible
defect instead of an accidental veto or grant.

**Rule — approved owner contracts and landed implementations are reported separately.** Rules 26,
30, 49 and 69; **checks: P16-NF-02/06/09/15/16/24/32/35–37/47–51**. The design may depend on an approved
owner contract, but activation also requires its public landed decoder, port and production
wiring. The following prerequisites are not implemented by this package and cannot be replaced by
private types or prose conventions.

The historical presentation has one additional, already landed owner input. It receives the exact
`FactSnapshot` returned once by two's public `FactStorePort.readForProjection()` for the pinned
read. The same owner-issued snapshot is supplied to the source fold and separately to the
presentation. Its `FactStatus.fact` values retain each complete envelope, including `at`, machine,
principal, provenance and predecessors; its status values retain conflict, taint, constitutional
and historical-read evidence. The
presentation records the snapshot's canonical digest as its `sourceHistoryDigest`. It never asks
the projection to expose envelope fields, reconstructs them from a body, or substitutes arrival or
query time. P16-NF-16/32/36/37/50 verify that exact public input and digest.

| Owner prerequisite | Approved design position | Landed public contract at this head | P16 consequence and filed seam |
|---|---|---|---|
| Three: governed price and exchange-rate manifests | Three owns declarations, strict decoding, approval and entering-force generations | The closed declaration union has no effective-dated price or exchange-rate payload | P16-NF-15–20/36 are non-executable until the grant in `seam-response-declarations.md` lands |
| Four: measurement-observation intake | Four owns authenticated intake, event identity and original custody | `IntakePort` exposes `receive`, `recover` and `expireHolds` for conversational/stop intake only | P16-NF-03/04/06/08/21/24/42/44/45/49 ingestion arms are non-executable until the grant in `seam-response-intake-followup.md` lands |
| Six: qualified admission-accounting read and accounting-window membership | Six owns reservations, the budget window that consumed them and the restart-sensitive accounting used for new admission | `TransportAuthority.inspect()` returns historical records; the qualification- and durability-aware `admissionAccounting()` reader is private, and no public record exposes the owner-selected budget-window identity | P16-NF-11/19/36–38/49 committed-exposure arms are non-executable until the grant in `seam-response-loop-followup.md` lands; its granted-but-unlanded `accountingWindow` addendum is tracked in `SEAM-LEDGER.md` row 34 |
| Six: full operational collector loop | Six owns adaptive backoff, breaker cooldown and half-open trials, attempt/duration/resource bounds, durable wake and recovery records | Landed `LoopPolicy` has fixed `minDelay` and `breaker: 'stub-closed'`; `recover()` only observes an existing claimed operation through eight, while `BoundedDueScanPort` returns selection and a cursor without scheduling work | P16-NF-43 is non-executable until the full-loop grant in `seam-response-loop-followup.md` item #25 lands; the landed selection/recovery subset is not its positive fixture |
| Seven: `JudgmentHoldCost` | Seven defines the hold-cost meaning and producer | `JudgmentRecord` and its landed decoder omit it; the slice manifest calls cohort/queue hold metrics out of scope | P16-NF-03/04/11/49 hold-cost arms are non-executable until the grant in `seam-response-judgment.md` lands |
| Five/six/eight: conservative maximum disposition | Five owns the run disposition, eight owns effect settlement and six owns accounting application | No landed payload represents an authorized maximum disposition; six derives applications only from outcome, final charge and delayed-execution evidence | The maximum-disposition arm of P16-NF-19/49 is non-executable until the grants in `seam-response-rungraph-followup.md`, `seam-response-effects-followup.md` and `seam-response-loop-followup.md` land |
| Eight: cap/freeze effects | Eight owns effect payloads, validation, invocation and settlement | `EffectRequest` and `OperationAdapterPort.invoke` accept only `OutboundMessage`; there is no cap/freeze/unfreeze payload | P16-NF-35/45/49/51 cap/freeze arms are non-executable until the grant in `seam-response-effects-followup.md` lands |
| Ten: provider usage categories | Ten realizes `ModelAdapterPort`; seven records its receipt | `ProviderObservation.usage` is exactly input tokens, output tokens, charge and source; extra category fields are rejected | P16-NF-03/04/09/10/14/49 and the expanded-category arm of P16-NF-33 are non-executable until the grant in `seam-response-assembly-followup.md` lands |
| Seven/ten: benchmark compatibility resolution, benchmark execution and current measured-route support | Seven owns benchmark compatibility, bounded benchmark execution and support evidence; ten owns the concrete route description and live provider adapter | `BenchmarkRecord` exposes only an opaque claimed digest; `JudgmentBenchmarkReadPort` has no tuple resolver; `ModelDescription.measured` is the literal `false`; the landed slice excludes benchmark execution, rerun admission and measured-route selection and lists production activation gaps | The benchmark arm of P16-NF-07 and all of P16-NF-31/32 are non-executable until the grants in `seam-response-judgment.md` and `seam-response-assembly-followup.md` land, together with the named five/six/eight/nine production wiring |
| Ten: operating-system process and resource producer | Ten owns production assembly and platform adapters | `HarnessAdapterPort.observe()` reports lifecycle/context phases for a known launch, and `GrowthObservation` retains caller-supplied measurement references; neither obtains a process census, CPU interval or RSS point | The process-inventory addendum in `seam-response-assembly-followup.md`, tracked in `SEAM-LEDGER.md` row 40, is GRANTED CONDITIONAL and builds only after docs/18 approval. Its unnamed `resource observations` do not define P16 interval semantics, so the real-producer arms of P16-NF-24/49 are non-executable until that grant and `design-measurement-ledgers-seam-request-resource-observation.md` land, together with `seam-response-intake-followup.md` |
| Eleven/ten: measurement and spend operator surface | Eleven owns authenticated scoped presentation; ten owns production composition | This head has no `src/operator` package or operator export. The granted guard-and-repair pull operation is specific to part fourteen and cannot render this package | The pure read/privacy fixtures in P16-NF-47/48 remain runnable. Their real-surface arms, P16-NF-03 surface resolution and P16-NF-49 production lifecycle are non-executable until `design-measurement-ledgers-seam-request-operator-surface.md` is granted and its Eleven port plus Ten composition land |
| Eight/ten: paid-door activation and current serving posture | Eight owns authority-changing effects; ten owns assembly admission and live realization | The granted spend-control seam adds cap, freeze and unfreeze payloads but no separate per-door arm/disarm operation. Landed assembly has no paid-service posture read for consumption immediately before admission | P16-NF-35/45/49/51 door-activation/readiness arms are non-executable until `design-measurement-ledgers-seam-request-paid-door-readiness.md` is granted and lands, in addition to the granted `seam-response-effects-followup.md` spend controls |

Part five also designs `ExhaustionRecord`, `ContinuityAccounting` and `DeliveryEvidence`, but its
landed `RunRecord` union does not contain them. This package does not consume those three names and
no P16 check depends on them. A later use would first require their five-owned public decoders and
exports; part sixteen cannot substitute local shapes.

---
