**Status: draft, awaiting approval. Governed.**

# Part sixteen — the measurement and spend ledgers

**Value — purpose.** The operator should be able to ask what Instar consumed, what it cost, what
work caused it, and how confident the answer is without turning observation into permission.
This part makes token, quota, resource, feature-call and spend history one inspectable package
over the signed record. It also makes missing metering visible. A model call that cannot be
accounted for is not made cheap by the absence of a number.

**Value — governed submission scope.** The executable acceptance target in this document is the
foundation tranche named in section 13. It covers only contracts that can be implemented through
the public owner ports landed at this head. The full measurement, pricing, live accounting,
measured-benchmark and spend-control package remains a tracked follow-on design. Approval of this
document cannot be represented as approval or activation of that follow-on package.

**Rule — reading convention and evidence discipline.** Rules 13, 26, 39, 41, 58, 69, 75, 86,
91 and 113; **checks: P16-NF-01/03–06/52** and `node scripts/check-governed-docs.mjs docs`.
Every claim belongs to its nearest Rule or Value block. Statements about Instar 1.x are limited
to the modules audited in section 11. A configured collector, a database file and a target rate
are not evidence of running. Measured means recorded execution on named hardware against a named
workload. A record's own feature, model, price, machine or authority label is a claim; every
consumer re-resolves those labels against signed history at its chosen causal frontier.

---

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
30, 49 and 69; **checks: P16-NF-02/06/09/15/35/49/51**. The design may depend on an approved
owner contract, but activation also requires its public landed decoder, port and production
wiring. The following prerequisites are not implemented by this package and cannot be replaced by
private types or prose conventions.

| Owner prerequisite | Approved design position | Landed public contract at this head | P16 consequence and filed seam |
|---|---|---|---|
| Three: governed price and exchange-rate manifests | Three owns declarations, strict decoding, approval and entering-force generations | The closed declaration union has no effective-dated price or exchange-rate payload | P16-NF-15–20/36 are non-executable until the grant in `seam-response-declarations.md` lands |
| Four: measurement-observation intake | Four owns authenticated intake, event identity and original custody | `IntakePort` exposes `receive`, `recover` and `expireHolds` for conversational/stop intake only | P16-NF-03/04/06/08/21/24/42/44/45/49 ingestion arms are non-executable until the grant in `seam-response-intake-followup.md` lands |
| Six: qualified admission-accounting read and accounting-window membership | Six owns reservations, the budget window that consumed them and the restart-sensitive accounting used for new admission | `TransportAuthority.inspect()` returns historical records; the qualification- and durability-aware `admissionAccounting()` reader is private, and no public record exposes the owner-selected budget-window identity | P16-NF-11/19/36–38/49 committed-exposure arms are non-executable until the grant in `seam-response-loop-followup.md` lands; their window-membership arms also depend on the ungranted `design-measurement-ledgers-seam-request-accounting-window-membership.md` |
| Seven: `JudgmentHoldCost` | Seven defines the hold-cost meaning and producer | `JudgmentRecord` and its landed decoder omit it; the slice manifest calls cohort/queue hold metrics out of scope | P16-NF-03/04/11/49 hold-cost arms are non-executable until the grant in `seam-response-judgment.md` lands |
| Five/six/eight: conservative maximum disposition | Five owns the run disposition, eight owns effect settlement and six owns accounting application | No landed payload represents an authorized maximum disposition; six derives applications only from outcome, final charge and delayed-execution evidence | The maximum-disposition arm of P16-NF-19/49 is non-executable until the grants in `seam-response-rungraph-followup.md`, `seam-response-effects-followup.md` and `seam-response-loop-followup.md` land |
| Eight: cap/freeze effects | Eight owns effect payloads, validation, invocation and settlement | `EffectRequest` and `OperationAdapterPort.invoke` accept only `OutboundMessage`; there is no cap/freeze/unfreeze payload | P16-NF-35/45/49/51 cap/freeze arms are non-executable until the grant in `seam-response-effects-followup.md` lands |
| Ten: provider usage categories | Ten realizes `ModelAdapterPort`; seven records its receipt | `ProviderObservation.usage` is exactly input tokens, output tokens, charge and source; extra category fields are rejected | P16-NF-03/04/09/10/14/49 category arms are non-executable until the grant in `seam-response-assembly-followup.md` lands |
| Seven/ten: benchmark compatibility resolution, benchmark execution and current measured-route support | Seven owns benchmark compatibility, bounded benchmark execution and support evidence; ten owns the concrete route description and live provider adapter | `BenchmarkRecord` exposes only an opaque claimed digest; `JudgmentBenchmarkReadPort` has no tuple resolver; `ModelDescription.measured` is the literal `false`; the landed slice excludes benchmark execution, rerun admission and measured-route selection and lists production activation gaps | The benchmark arm of P16-NF-07 and all of P16-NF-31/32 are non-executable until the grants in `seam-response-judgment.md` and `seam-response-assembly-followup.md` land, together with the named five/six/eight/nine production wiring |

Part five also designs `ExhaustionRecord`, `ContinuityAccounting` and `DeliveryEvidence`, but its
landed `RunRecord` union does not contain them. This package does not consume those three names and
no P16 check depends on them. A later use would first require their five-owned public decoders and
exports; part sixteen cannot substitute local shapes.

---

## 2. Vocabulary and the registered measurement plane

**Rule — package terms are narrow aliases, not hidden core concepts.** Rules 26, 49 and 69;
**checks: P16-NF-01/03/04**.

| Term | Meaning in this part |
|---|---|
| proven no-exchange attempt | A canonical attempt whose evidence proves refusal or cancellation before provider invocation. It is retained in the attempt census but is not a provider exchange. |
| observed exchange | A canonical attempt with evidence that a provider invocation occurred, whether it completed, failed, streamed partially or returned unusable output. |
| dispatch-uncertain attempt | A canonical attempt whose one-use claim was consumed but whose available evidence proves neither provider invocation nor pre-invocation refusal. It is neither silently promoted to an exchange nor dropped. |
| half-open window | A window written `[start, end)`: a source time equal to `start` is included and one equal to `end` is excluded. Both endpoints use the declared comparable clock basis. |
| census completeness | For one burn-policy window, proof that every identity from each activity source named by the policy has been enumerated through the window's evidence horizon and classified without unresolved conflict. For the model source this includes every attempt; for a programmatic source it includes every registered event identity. |
| collector completeness | For one burn-policy window, proof that every collector named by the policy finished through the end and evidence horizon without an unavailable stream, omitted page, truncation or unresolved append. A completed collector may honestly classify an exchange as unmetered or unsupported, so collector completeness does not imply 100% usage coverage. |
| burn-eligible sample | One canonical, deduplicated activity member attributed to the policy's named feature and carrying a compatible observed amount in the policy unit. It is either a usage-supported observed exchange or a registered programmatic event; missing amounts, unmetered exchanges, dispatch-uncertain attempts and conflicts are not eligible samples. A source-reported zero amount is eligible. |
| usage-supported exchange | An observed exchange with current acceptable usage evidence for every category its registered adapter contract says it reports; a metered exchange may validly report zero. |
| usage coverage | For a pinned window, `usage-supported exchanges / observed exchanges`. Proven no-exchange and dispatch-uncertain attempts are displayed separately and enter neither term. A zero exchange denominator is `undefined`, not 0% or 100%. |
| pending evidence | An observed or dispatch-uncertain attempt still inside its declared evidence horizon; retained in counts and excluded from an overdue rate until the horizon ends. |
| overdue evidence | An observed or dispatch-uncertain attempt past its declared horizon without the evidence needed to resolve its category. `overdue / past-horizon observed-or-uncertain attempts` is reported separately from usage coverage. |
| unmetered model call | An observed exchange past its evidence horizon with no acceptable usage observation. It remains a real exchange and carries unknown usage. |
| unattributed usage | Metered usage for which no registered feature, run or judgment point resolves from signed history. |
| unattributed spend | Priced or settled usage that remains unattributed. It is a subset of spend, not a feature named `unknown`. |
| price manifest | The requested part-three governed declaration of effective-dated billing rates, currency, token categories, billing class, subsidy basis, plausibility policy, freshness and source. Until that seam lands this is a prerequisite, not an existing declaration kind. |
| historical settlement charge | The exact charge in the causally current signed `SettlementApplication`. It supports historical reporting but is not proof that six can presently use that application for admission accounting after restart. |
| provider-settled spend | The non-negative final provider charge returned by six's qualified current admission-accounting read. It is also retained as a known-charge annotation when execution is still unresolved. |
| maximum-disposition spend | The reserved maximum that a future five/six/eight conservative disposition would count as spent. It is labelled separately from a provider charge and is unavailable until the requested owner seam lands. |
| accounted spend | For one operation, the greater of its qualified provider-settled charge, its qualified maximum-disposition amount and zero. The controlling category supplies the label; the other known amount remains an annotation rather than a second addend. |
| qualified conservative exposure | Six's current qualified `exposure` for one operation. It already includes any known final charge while execution is unresolved or delayed execution remains possible. |
| outstanding exposure | For one operation, `max(0, qualified conservative exposure - accounted spend)`. It is the still-unaccounted remainder, not six's raw exposure field and not seven's observational hold metric. |
| committed window total | For one six-owned accounting window, the sum after canonical-operation union of each member operation's `accounted spend + outstanding exposure`; equivalently, each operation contributes `max(qualified conservative exposure, accounted spend)` exactly once. Settlement time and query time do not select membership. |
| detail horizon | The finite time range kept in a disposable high-cardinality projection or adapter cache. `High-cardinality` means that key count grows with attempts, observations or process incarnations rather than a fixed category roster. The horizon never licenses removing spine facts. |
| PID | A reusable operating-system process number and lookup locator, never process identity by itself. |
| RSS | Resident set size: bytes the named OS adapter reports resident for the named process incarnation at the sample instant, subject to that adapter's documented accounting limits. |
| observation stream | The exchange, measurement category, producer authority and source-event identity whose causal heads describe one quantity through partial, final and correction phases. |
| cumulative-session usage | A provider/framework total for one registered session whose later snapshot replaces the earlier current snapshot. It is aggregate evidence with `per-call attribution unsupported` unless an independent exact attempt mapping exists. |
| routing-spend view | A disposable projection that joins usage and settlement history to price manifests and attribution history at read time. It is not a money ledger or cap authority. |
| feature outcome classifier | A registered mapping from current attempt, decision, effect/event and grading evidence to the feature's declared action predicate. It yields `fired` only when that action is proved to have occurred, `no-op` only when complete evidence proves it did not occur, and `unclassified` when the mapping is absent, incomplete or conflicted. A `Grade` or judgment result alone is not this classifier. |
| shed attempt | Work refused before provider invocation by admission or a circuit breaker. It has no provider exchange and is distinct from a completed `no-op`. |
| full sample identity | One source observation's subject kind and instance, unit, producer authority, source-event identity and causal head. It is preserved even when an explicit cross-instance aggregate is computed. |
| measurement-window aggregate | The registered derived `Measurement` subject for one family, scope, start-inclusive/end-exclusive window, dimension set, pinned frontier and evaluation clock. Its instance is the canonical digest of those inputs and its membership manifest retains every full sample identity. |
| coverage debt | The visible count and identity set of expected observations that are absent, late, unsupported or unusable for a declared population. It is an instrumentation deficit, not usage attributed to a feature. |
| hysteresis | A state rule with a stricter threshold for opening than for recovery, plus consecutive recovery windows, so small boundary movements do not repeatedly open and close an episode. |
| z-value | A policy-fixed statistical multiplier selecting the confidence level of an interval. A larger z-value makes the interval wider for the same sample. |
| Wilson half-width | The margin on either side of a Wilson estimated pass rate after sample size is considered. A larger half-width means the observed rate is less precise. |

**Rule — every window uses an owner-recorded membership time.** Rules 13, 26, 32, 33, 58
and 69; **checks: P16-NF-16/19/36/37**. Every requested window is half-open: it includes a
member whose authoritative source time equals `start` and excludes one whose source time equals
`end`. Both endpoints and the member time must be comparable `Clock` values in the declared
basis. An incomparable clock makes the result partial; append time, arrival time and the query's
evaluation clock cannot substitute for membership time. UTC is the default display basis for
ordinary hour and day slices. A provider/account policy or six-owned budget policy may instead
name another basis, which the response must display.

| Family | Authoritative membership source | Late evidence and correction rule |
|---|---|---|
| attempt census | The `at` clock on the part-two envelope holding seven's first accepted `prepared` observation for the canonical attempt | Later dispatch, response, usage, resolution or correction facts refine the attempt but do not move its census window |
| provider exchange, model usage, price join, feature-call and model-call burn | The dispatch clock recorded by seven's first causally current `dispatch-observed` attempt phase; the fact-envelope clock is used only where the landed phase has no separate owned clock | Late response, usage, charge, attribution, grade or correction stays in the original dispatch window; reads at earlier frontiers remain unchanged |
| cumulative model session, quota, resource and package-cost sample | The part-one `Measurement.at` clock on that source observation; a quota sample also retains its provider account/window identity | A causal successor corrects the stream at later frontiers while retaining the original observation's measurement window; it never moves to its ingestion day |
| programmatic feature event | The registered event occurrence clock carried by its source `Evidence.observedAt`, not the time the collector appended it | Late collection or correction stays in the original occurrence window; an event without a comparable occurrence clock is incomplete and ineligible for burn |
| benchmark execution sample | The dispatch clock of the benchmark attempt, under the same rule as a production exchange | Late grade or evaluation evidence changes eligibility at later frontiers but not the execution window |
| committed accounting | Six's stable accounting-window id and membership clock fixed when the reservation consumed capacity | Settlement, requalification, maximum disposition, restart and correction retain that original owner window; a legacy or conflicted unknown remains uncertain at maximum exposure rather than being assigned to the query day |

The committed-accounting row is not implementable from the landed `AdmissionReservation` or
`SettlementApplication`, and the granted accounting read did not request it. Its checks depend
explicitly on `design-measurement-ledgers-seam-request-accounting-window-membership.md`. Part
sixteen does not derive a money window from a reservation's authority-local tick or a later fact's
append clock.

**Rule — every quantity has one registered subject, unit and producer.** Rules 13, 26, 32, 39,
58, 69 and 75; **checks: P16-NF-03–06/09/15/24/25**. The register contains the measurement
subjects below, their allowed units, their producer adapters and their evidence requirements.
Each `Measurement.subject.instance` is an existing registered identity: a judgment attempt for
call usage, an account/window for quota, a machine plus process incarnation for resources, or a
holder/run for the package's own cost. Cross-subject addition and unregistered units refuse at
decode. Evidence binds the sample to its source observation and capture reference where one is
required.

| Family | Required measurements | Required subject and evidence |
|---|---|---|
| model call | input tokens, cache-read input tokens, output tokens, provider-billed token categories, elapsed duration and call count | Seven's exact attempt id; resolved provider doorway/model/account and receipt; cache-read tokens are a subset of input tokens |
| cumulative model session | input, cached-input, output, reasoning-output and total tokens plus exposed quota-window percentages | Registered framework/session id and source snapshot; causally later cumulative total replaces, never adds to, the earlier snapshot and is not an invented attempt |
| money | provider-settled amount, reserved maximum liability and derived price amount, each separately labelled | Seven's attempt/hold and eight's settlement; currency and settlement source are explicit; derived amount names the price-manifest point |
| quota | used and remaining quantity when exposed, window size, reset time and collector age | Registered account and provider window; original provider observation, collector and observation time; unavailable fields remain unknown |
| rate-limit event | breaker open/recover count, session-sentinel throttle/quota/529 count and breaker trips per declared duration | Registered account/source episode and event identity; breaker and session detections are separate populations, not duplicate evidence for one event |
| resource | process CPU time, sampled wall interval, RSS bytes, process count and classified footprint RSS | Registered machine and process incarnation or machine aggregate; OS source, hardware profile and sample interval |
| package cost | scan duration, rows/bytes examined, projection lag, append failures, queue depth and storage bytes | Exact holder/run and machine; used to account for the observer's own resource cost |

**Rule — sample identity and aggregate compatibility are different checks.** Rules 13, 26, 32,
39 and 69; **checks: P16-NF-04/14/37**. Ordinary comparison and arithmetic retain part one's full
subject-instance check. Cross-instance addition occurs only through the registered
`aggregateMeasurements` package operation. That operation resolves a declaration mapping one
source subject kind to its `measurement-window aggregate` subject kind, additive units, allowed
dimensions and scope. It then requires equal source kind, unit, category semantics, producer
contract, currency or hardware basis where applicable, query frontier and evaluation clock. The
member instances may differ because that is the operation's purpose. The output instance is the
canonical digest of the aggregate scope, half-open window, dimensions, frontier and evaluation
clock. Its membership manifest retains each member's full sample identity and rejects duplicate
observation keys. No ordinary same-instance comparison is weakened, and no caller may widen the
registered scope merely by asking for a pool total.

**Rule — collection is observational and failure is explicit.** Rules 14, 31, 41, 46, 58, 75,
86 and 95; **checks: P16-NF-04–08/21–23/42–46**. Adapters observe a dispatch, provider receipt,
operating-system sample or quota response and submit existing `Measurement` and `Evidence`
payloads through the requested part-four observation-intake operation. The landed conversational
`IntakePort` cannot yet accept that flow. Collectors never call a provider, start a process, choose
an account, admit work or mutate the observed source. A rejected measurement append returns a typed result
to the adapter and raises a nine-owned instrument-health obligation. It does not rewrite the
already determined model-call or process outcome. Missing evidence is carried as missing; zero
is accepted only when the source actually reported zero.

---

## 3. Model-call census, tokens and attribution

**Rule — the attempt census is complete even though coverage uses the exchange subset.** Rules 39,
41, 58, 69, 75 and 86; **checks: P16-NF-07–11**. Every route through a model boundary creates or
references one seven-owned `JudgmentAttemptRecord` before exchange. The census includes provider
errors, cancellations, timeouts, streamed partials, breaker refusals, swaps, retries admitted by
six, benchmark candidates, supervisors, background features and interactive work. Each
non-conflicted canonical attempt resolves at the pinned frontier into exactly one of proven
no-exchange, observed exchange or dispatch-uncertain; unresolved/conflicting classification is displayed separately and cannot
enter a percentage. A provider exchange is counted once even when its response is later rejected
by a parser. A metered zero-token exchange is an observed, usage-supported exchange, while a
zero-call refusal is a proven no-exchange attempt.

The complete production census in P16-NF-07 is not executable at this head. The landed seven
slice excludes benchmark execution and rerun admission. It also lists production activation gaps
owned by five, eight, ten and nine. The census is non-executable until the granted benchmark work
in `seam-response-judgment.md` and `seam-response-assembly-followup.md` lands together with that
production wiring. A fake-provider call or a census of only current callsites cannot satisfy the
benchmark positive neighbor.

**Rule — exchange identity and observation identity are separate.** Rules 14, 32, 33, 58 and 75;
**checks: P16-NF-07–09/12–14**. The provider operation id, six's one-use claim and seven's attempt
id form the exchange key that binds dispatch, receipt and settlement. A usage observation key is
that exchange key plus measurement category, authenticated producer authority, source-event id
and phase. Its observation stream links partial → final → later correction with part two's causal
successor/correction relation. A fold uses the causally maximal compatible head per stream; it
does not add both a partial and its final successor. Equal replay of one observation key is
idempotent. Incompatible content under one key, or concurrent competing corrections without a
causal winner, creates `Conflict`; a later compatible final observation or late charge is a
refinement, not a conflict. Input, cache-read input, output, reasoning, tool and provider-billed
categories stay separate when the provider distinguishes them. The latter categories cannot be
implemented until the requested part-ten usage payload lands. An adapter maps categories only
through its registered conformance contract.

Charge observations use the same separation: operation/exchange identity binds the subject, while
source event and phase identify the observation in eight's causal settlement chain. An unknown or
partial charge can therefore gain a final successor without conflicting merely because the amount
changed; six applies each supported settlement identity at most once.

**Rule — coverage counts absence instead of normalizing it away.** Rules 13, 39, 41, 58, 75 and
86; **checks: P16-NF-09–11/14**. For a declared window, the view reports the three disjoint attempt
classes; usage-supported and unmetered subsets of observed exchanges; provider-settled exchanges;
pending and overdue evidence; unsupported-by-adapter exchanges; and conflicted joins. The only
displayed usage-coverage percentage is `usage-supported exchanges / observed exchanges`.
The separately displayed overdue-evidence rate uses only past-horizon observed-or-uncertain
attempts. Pending attempts remain visible but enter neither overdue numerator nor denominator.
Coverage is partitioned by adapter artifact, provider doorway, model, account, machine, feature
and outcome. An unsupported exchange remains in the usage denominator and is not healthy
coverage. A pre-exchange refusal never depresses exchange coverage, and a crash after claim
consumption remains dispatch-uncertain rather than being guessed into or out of that denominator.
An error response without usage remains unknown even if successful calls from the same provider
usually report it. Raw `SettlementApplication` history may show a lower charge while six still
retains the reserved maximum after restart. Current exposure changes only when the requested
six-owned qualified accounting read reports that live settlement consumption and the original
durability demand both succeeded.

**Rule — cumulative session observations do not become fictional calls.** Rules 13, 26, 39, 58,
75 and 86; **checks: P16-NF-08/10/12**. A Codex-style source that exposes only a growing session
total uses the cumulative-session subject. The observation stream keeps one current causally
maximal snapshot per registered session; equal replay changes nothing and a growing snapshot
replaces rather than adds to the earlier total. Cache, reasoning and quota-window fields remain
separate. The aggregate appears in its own coverage-limitation row and is excluded from attempt
coverage, per-feature call attribution and burn unless independent evidence maps exact deltas to
canonical attempts. Absence of that mapping is `per-call attribution unsupported`, not zero usage
and not a synthesized `JudgmentAttemptRecord`.

**Rule — feature attribution is re-resolved, never trusted from the usage row.** Rules 26, 32,
58, 69 and 86; **checks: P16-NF-12–14/30/31/36**. The read joins the attempt's run, judgment
point, registered feature and benchmark identities from signed history at the requested causal
frontier. A source-supplied feature string is retained only as evidence. No match produces
unattributed usage. Several incompatible matches produce `Conflict`. A later lawful correction
can change the derived attribution without rewriting the measurement. Per-feature totals show
unattributed and conflicted amounts beside named features; they never hide them in a synthetic
feature that can dominate a burn ranking.

---

## 4. Price manifests, settlement and spend views

**Rule — usage is stored independently of price.** Rules 7, 13, 26, 32, 58 and 69; **checks:
P16-NF-15–18**. Token and provider-usage measurements contain no mutable current-price answer.
The required manifests are the explicit part-three prerequisite in section 1, not a kind this
part may invent. Once that seam lands, a routing-spend read pins a causal frontier, resolves the
owner-issued manifest decoder and effective point for each attempt's dispatch time and billing
class, and then computes derived cost. A price correction appends signed history and changes later
reads at a later frontier. It never edits usage or moves the exchange out of its dispatch window.
Rebuilding at the same frontier, manifest generation, query parameters and explicit evaluation
clock produces equal canonical rows. P16-NF-15 remains a tracked follow-on until that seam lands;
neither its unavailable state nor its written fixture counts as a positive result.

**Rule — every dollar-like figure says what kind of figure it is.** Rules 13, 26, 39, 58 and 86;
**checks: P16-NF-17–20**. Each row separates provider-settled cost, manifest-derived gross cost,
subsidy or credit allocation, net derived cost, committed window total and unpriced usage. Money is
kept as exact decimal or integer minor units with an explicit currency. Totals do not add unlike
currencies. A conversion appears only through the requested part-three exchange-rate declaration,
with its effective time and a separately labelled converted total. A point is implausible exactly
when its exact rate is below the manifest's inclusive `minimumRate`, above its inclusive
`maximumRate`, or, when configured, its ratio to the causally prior current point is greater than
the inclusive maximum-step ratio. Equality at a bound is valid. Missing required bounds yield
`insufficient policy`, not implausible. A zero prior rate for a ratio test also yields
`insufficient policy`. An incomparable prior point yields `insufficient policy`. A missing point
produces unpriced usage with a missing-point reason. A stale point produces unpriced usage with a
stale reason. An incompatible point produces unpriced usage with an incompatible reason. An
implausible or insufficient-policy point produces unpriced usage with that exact reason. None
becomes zero cost.

**Rule — provider settlement outranks estimation without erasing disagreement.** Rules 31, 33,
58, 86 and 95; **checks: P16-NF-18/19/36**. Eight supplies settlement evidence; six alone applies
it and owns `SettlementApplication` history. A signed application is historical accounting
evidence, not necessarily six's currently usable admission state. After restart, six retains the
reserved maximum until eight's live settlement consumption qualifies the exact application again
and its original durability demand succeeds. The landed public `inspect()` does not expose that
distinction. Current committed totals therefore remain unavailable until the requested six-owned
qualified accounting read lands.

Once both six-owned read seams exist, the view selects operations by six's stable
`accountingWindow` membership and then unions canonical operation ids, including each member once.
The selection uses the reservation's owner-issued window even when dispatch or settlement occurs
in another hour or day. A missing or conflicted owner window makes the committed total partial and
retains maximum exposure; query time never reassigns it.
For operation `o`, let `E(o)` be six's qualified conservative exposure, `A(o)` its qualified
non-negative final provider charge when present, and `M(o)` its qualified maximum-disposition
amount when present. The read computes `S(o)=max(0,A(o),M(o))` as accounted spend,
`O(o)=max(0,E(o)-S(o))` as outstanding exposure, and `C(o)=S(o)+O(o)` as the committed
contribution. A known `A(o)` is always displayed as a provider-charge annotation, even when
`M(o)` controls `S(o)` or unresolved execution means `E(o)` remains larger. This formula prevents
the same known charge from appearing inside both addends while preserving six's conservative
total. A partial settlement later refined to final replaces that operation's current input. Equal
replay adds nothing. A conflict makes the total partial.

A restart fixture reserves 100 and records an unchanged signed application charging 20. Failed
requalification or unmet original durability exposes the charge only as historical and reports
`S=0`, `O=100`, `C=100` with one unresolved operation. Successful requalification with required
durability and proved quiescence reports `S=20`, `O=0`, `C=20` and 80 released. Successful
requalification without quiescence, including an `Outcome.uncertain` case and a final-charge case
where delayed execution remains possible, reports the known provider charge 20, `S=20`, `O=80`,
`C=100`, zero released and one unresolved operation. It reports neither 20 nor 120 as the
committed total.

The conservative maximum disposition is a separate tracked extension. Before it, the maximum is
outstanding exposure. After the requested five/six/eight seam applies it, the same maximum moves
to maximum-disposition spend, outstanding exposure becomes zero, and the committed total is
unchanged. A later provider charge at or below that maximum remains a known-charge annotation and
does not add again; a charge above it becomes the controlling accounted amount and carries
`capViolation`. That disposition releases no headroom and proves nothing about execution
completion or safe repetition. Every actual charge is recorded in full, never clipped. Seven's
`JudgmentHoldCost` is observational evidence about waiting and is never added again. The view
retains manifest-derived amount as comparison. Subsidy, credit or subscription allocation is a
reporting adjustment with its own source and scope and cannot reduce six's exposure or reopen cap
headroom.

**Rule — subscription access is never presented as free.** Rules 26, 39, 41 and 86; **checks:
P16-NF-17/20**. A doorway billed by subscription displays `not per-call settled`, its observed
tokens and quota state. If the operator has supplied a governed allocation policy, the view may
also display an allocated subscription cost with the complete formula, period and basis. That
allocation stays separate from provider settlement and cap enforcement. With no policy, cost is
unknown at call level rather than zero.

**Rule — routing-spend surfaces disclose their horizon and completeness.** Rules 26, 32, 39, 41,
69, 86 and 113; **checks: P16-NF-10/16–20/36–38/48**. Hour, day, feature, model, doorway, account,
machine, benchmark and run slices derive from the same pinned joins and the family-specific
membership sources in section 2. Every request declares `[start, end)`, its clock basis and an
explicit evaluation-clock `Measurement`; freshness, evidence-horizon endpoints and detail-horizon
selection use that value rather than an ambient clock. Every response includes the causal
frontier, register and price-manifest generations, evaluation clock, requested and available time
ranges, coverage counts, partial peers, conflicts, projection folded-through vector, last
successful rebuild and whether settlement is final. A reporting total and an authoritative
committed liability are never collapsed into one number.

The response has two independently labelled sections. `historicalProjection` is a pure fold of
signed history at the pinned frontier plus the pinned register/manifest generations, query
parameters and evaluation clock. Equal canonical inputs must produce byte-equal canonical rows.
`liveAccounting` is present only after the requested six-owned read seam lands. It is a pure
presentation of the exact owner-issued `AdmissionAccountingView` observations captured for the
query, including their read-operation ids, host incarnations, accounting revisions,
qualification/durability evidence, canonical digests and the same evaluation clock. Replaying
those exact view bytes produces byte-equal live-accounting rows. Re-running the owner read may
lawfully change that section after restart, qualification loss or restoration, durability change
or clock advancement. It does not alter the historical section or make an earlier signed
application current. P16-NF-36 compares the complete `historicalProjection` bytes and, when a
live input set is supplied, the `liveAccounting` bytes for that exact set; it never compares two
different live observations as though their inputs were equal.

---

## 5. Quota observations

**Rule — quota is a measurement, not a scheduler verdict.** Rules 13, 26, 41, 49, 69, 86 and 95;
**checks: P16-NF-21–23/35**. A quota adapter records what a provider exposed for one registered
account and window, with source, observation time, reset time, quantity semantics and freshness.
Missing files, corrupt responses, stale snapshots and providers with no advance-usage surface
remain distinct unknown states. Unknown is never coerced to 0% used, 100% available or a
placeable account. Repeated missing-state notices coalesce by episode so the instrument does not
drown the condition it is meant to expose.

**Rule — this package exports no `canRun`, `place`, `throttle` or `allow` decision.** Rules 4,
30, 41, 49 and 86; **checks: P16-NF-02/22/23/35/51**. Part six owns capacity admission, leases
and retry. Part eight owns any throttling, account change or refusal effect. Those owners may
consume their own registered current policy inputs and may display these observations as
evidence, but cannot import a part-sixteen projection as permission. A quota measurement failure
therefore degrades the view and opens verification work; it neither admits nor blocks a run.

---

## 6. CPU, memory and process footprint

**Rule — resource samples identify the machine and process incarnation.** Rules 13, 26, 32, 39,
58 and 113; **checks: P16-NF-24–29**. CPU time is measured as process CPU consumed across a
recorded monotonic wall interval. Any displayed CPU percentage states whether 100% means one core
or the whole named machine. RSS is bytes observed by the registered OS adapter. Heap is reported
only for a process whose runtime exposes it. A PID is joined to a process-incarnation identity,
start evidence and owning run; PID reuse cannot join a new process to an old run. Dead or
unreadable processes are missing samples, not zero CPU or zero memory.

**Rule — the sampler has bounded work and measures its own footprint.** Rules 39, 55, 60 and 86;
**checks: P16-NF-27/29/43/46**. One tick has finite process, byte, duration and concurrency limits.
Process reads are batched where the platform permits it. An over-limit census produces an
explicit truncated sample with examined and omitted counts. Ticks do not overlap. Idle cadence,
active cadence and retry backoff are six-owned loop policy. Scan CPU, memory, process creation,
duration, lag and failures are recorded under the holder's own subject so observation cost cannot
disappear from totals.

**Rule — footprint classification is registered and loss-aware.** Rules 26, 39, 58, 69 and 86;
**checks: P16-NF-26/28/29**. Process classes such as agent worker, model adapter, channel adapter
and external tool host are registered matching rules with conformance fixtures. The durable fact
contains class counts and RSS, not command lines, prompts, environment values or secrets.
Unmatched relevant processes remain `unclassified` with a count. A trend is derived only from a
declared complete sample window; missing ticks, classifier-generation changes or a machine change
break comparability and are shown rather than interpolated away.

**Rule — resource alerts are signals and cleanup remains elsewhere.** Rules 24, 41, 60 and 86;
**checks: P16-NF-29/33–35/51**. A footprint threshold or rising trend may create a nine-owned
finding with episode deduplication and measured entry/exit conditions. It cannot kill a process,
reap a session, deny a spawn or load/unload an adapter. Any proposed cleanup enters part four and
is classified and executed through part eight under the standing of its requester.

---

## 7. Feature, benchmark and burn joins

**Rule — feature-call metrics distinguish execution from outcomes.** Rules 13, 26, 39, 41, 58,
75 and 86; **checks: P16-NF-07–10/30**. A real provider exchange, a shed pre-exchange attempt, a
provider error, a parser failure and a programmatic event are different rows. Each feature
registers the action predicate and evidence mapping used by its feature outcome classifier.
`fired` requires current evidence that the declared action occurred. `no-op` requires the
classifier to run over complete, conflict-free evidence and prove that action did not occur.
Missing, incomplete or conflicted classification is `unclassified`, not `no-op`. Seven's
judgment result and nine's `Grade` are inputs to the mapping, not the classes themselves. Latency
percentiles name their eligible population and include failures where duration is observable.
Rates with insufficient denominators return raw counts and `insufficient evidence`.

**Rule — benchmark comparisons consume seven's compatibility identity and nine's grades.** Rules
13, 39, 58, 69, 75 and 86; **checks: P16-NF-31/32**. The landed seven/ten slice cannot yet supply
an eligible positive comparison. Its benchmark records expose a claimed `compatibilityDigest`,
not an owner-resolved full tuple, while the current `ModelDescription` permits only
`measured:false` and construction rejects any other value. P16 does not interpret that digest as
proof and does not create a route-support authority. P16-NF-31/32 stay outside the runnable
foundation tranche. They are non-executable until the grants in `seam-response-judgment.md` and
`seam-response-assembly-followup.md` land with the eligible positive control.

After that seam lands, seven's public resolver must supply the exact compatibility tuple:
judgment class, prompt and context-assembly digests, action-floor and output-schema digests, model
plus relevant settings, scenario class and evaluation-contract digest. Ten must supply current
measured support for the exact route through that seven-owned resolution. Nine supplies `Grade`
and `BenchmarkEvaluation` evidence at the pinned frontier. Eligibility is the conjunction below;
each row is tested independently.

| Eligibility condition | Required state |
|---|---|
| Owner compatibility | Seven's current public resolver returns the same complete tuple for production and benchmark sources; an opaque digest is insufficient. |
| Population identity | Scenario class and observation window match the declared comparison policy. |
| Grade integrity | Every included `Grade` is complete and conflict-free under one criterion version, with nine's compatible `BenchmarkEvaluation`. |
| Current route support | Ten's exact current route carries fresh measured support referencing seven's successful resolution. |
| Sample floors | Both production and benchmark sample counts are at least their inclusive `minimumSamples`. |
| Coverage floors | Both production and benchmark grade coverage values are at least their inclusive `minimumCoverage`. |
| Concentration ceiling | Maximum single-machine production share is at most the inclusive `maximumMachineShare`. |
| Freshness | Every evidence age is strictly less than `maximumEvidenceAge`; equality at the endpoint is stale under nine's convention. |

Seven owns the compatibility and bounded benchmark-run identity checked by P16-NF-31. Nine owns
complete grades, benchmark evaluation and the advisory conclusion checked by P16-NF-32. Six owns
the single analysis lease and bounded loop checked by P16-NF-43. Sixteen owns only the pinned,
overlap-safe read join. Missing peers remain a P16-NF-38 partial result, never an alignment claim.

The versioned comparison policy fixes separate minimum sample and coverage values for production
and benchmark populations, a maximum production machine share, a maximum evidence age, a binary
mapping from the chosen Grade dimension and a z-value before either population is read. The
z-value is the policy's confidence multiplier: a larger value deliberately produces a wider,
more cautious interval from the same evidence. For `x` mapped passes among `n` complete cases and
fixed `z`, Wilson confidence has
`center=(x/n+z²/(2n))/(1+z²/n)` and
`half=z*sqrt((x/n)*(1-x/n)/n+z²/(4n²))/(1+z²/n)`; the interval is
`[center-half, center+half]`. The half-width is the displayed margin of uncertainty around the
estimated pass rate after sample size is considered; a larger value tells the operator that the
rate is less precise. The read computes and retains one interval for the production sample and one
for the benchmark sample. A divergence or alignment conclusion must account for both half-widths;
its uncertainty bound cannot be narrower than the larger half-width. No mapping, zero population
or missing fixed z-value yields `insufficient evidence`, not a percentage. Either population below
its sample or coverage floor, or production above its concentration ceiling, is `partial`. A
compatibility, criterion, freshness, conflict, completeness or current-support failure is
`ineligible`. Only `eligible` may report a comparison. Every status retains both raw numerators
and denominators, both intervals, machine shares and missing reasons.
Real production measurements retain machine/workload identity. Targets, predicted rates and
declared prices are never measured. The policy and its threshold values are deployment-selected
Value choices; their decision boundaries are fixed here.

**Rule — burn detection has a versioned, coverage-aware hysteresis algorithm.** Rules 39, 41, 58,
60, 75, 86 and 87; **checks: P16-NF-10–14/33–35**. A burn policy fixes before evaluation the
current window, every preceding baseline window, the included model-exchange and programmatic-
event sources, their required collectors, registered amount unit, minimum eligible samples,
minimum usage coverage, entry excess/share thresholds, lower recovery excess/share thresholds
and required consecutive recovery windows. Source observations are canonically deduplicated.

For each window, the eligible sample set is exactly the union of the named feature's
usage-supported observed exchanges with a compatible amount in the policy unit and its registered
programmatic events with a compatible observed amount in that unit. `eligibleSampleCount` is the
cardinality of that union after canonical deduplication. It is scoped to the named feature, not to
all features, attempts or ledger rows. A source-reported zero amount remains an eligible sample.
An unmetered exchange, missing amount, dispatch-uncertain attempt or conflicted event is not an
eligible sample and remains visible in its own population.

`currentAmount` is the sum of the eligible sample amounts in the current window.
`baselineAmount` is the median across all declared compatible preceding windows (the middle sorted
value, or the exact arithmetic mean of the two middle values for an even count). No weak baseline
window is silently dropped. The share denominator is the sum of compatible metered amounts from
all usage-supported exchanges and registered programmatic events in the policy's comparison scope;
`share = currentAmount / denominator` and is undefined when that denominator is zero.
`excess = max(0, currentAmount - baselineAmount)`.

Census completeness, collector completeness and usage coverage are three independent inputs for
every current and baseline window. Every declared window must have complete censuses and collectors
and `eligibleSampleCount >= minimumEligibleSamples`. When a window contains at least one observed
model exchange, its usage coverage must also be `>= minimumUsageCoverage`; explicitly unmetered
exchanges may therefore leave coverage below 100% without making census or collector completeness
false. When a window contains no observed model exchange, usage coverage is undefined and the
usage-coverage floor is not applicable. An event-only window can therefore be adequate when its
programmatic-event census and collectors are complete and its eligible event count meets the sample
floor. The overall confidence status is `adequate` exactly when the current window and every
declared baseline window meet those applicable conditions and at least one baseline window exists.
Otherwise it is `insufficient evidence`, with each raw count, completeness bit, coverage numerator,
coverage denominator and failed condition. An empty baseline supplies neither a median nor adequate
confidence.

Window classification precedes every state transition. A missing or incomplete collection window
retains the prior episode even when its available amount is zero. It raises coverage debt and can
never be called recovery. A complete zero-activity window requires the attempt census and all
registered collectors to be complete through the horizon, with no observed exchange and no
programmatic feature event in the policy scope. Its usage percentage is undefined because there
was no exchange.
That window is `inactive` and closes an open episode immediately as an explicit exception to the
consecutive-window rule. A metered zero-amount exchange is activity, not this exception.

A complete window with one or more eligible samples whose source-reported compatible amounts sum
to zero is `zero-metered-activity`. Its share is undefined. A closed episode
stays closed because no entry comparison is possible. An open episode stays open and its
consecutive-recovery counter resets to zero because the window cannot prove a share at or below
the recovery threshold. It raises no coverage debt when its census and collectors are complete.
The same zero-looking window with incomplete census or collector evidence remains `incomplete`.
A census- and collector-complete window below its sample or applicable usage-coverage floor is
`insufficient-evidence`, not incomplete. Both states raise coverage debt, retain an open episode
and reset the consecutive-recovery counter. Neither supplies a recovery window.

A closed episode otherwise enters when there is current activity, confidence is adequate, and
both excess and share are greater than or equal to their entry thresholds. An open episode with
nonzero activity recovers only after the configured number of consecutive adequate windows have
both excess and share less than or equal to their recovery thresholds. Values between entry and
recovery retain prior state and reset an in-progress recovery counter. Any incomplete, inadequate
or undefined-share window likewise cannot advance the counter; the explicit inactive exception is
the only immediate close. This is hysteresis: stricter entry thresholds, lower recovery thresholds
and consecutive recovery evidence prevent boundary noise from flipping the episode. The
instrumentation-not-yet-run bucket raises coverage debt but cannot be a culprit; genuinely metered
unresolved usage may raise unattributed-spend evidence.
One threshold episode produces one notification and one part-five investigation run; six's one
bounded loop governs follow-through.

**Rule — no metric decides its own remedy.** Rules 4, 24, 41, 49, 82 and 86; **checks:
P16-NF-33–35/51**. Reliability, effectiveness, benchmark drift, quota pressure, resource pressure
and burn findings are evidence submitted to part nine. They do not alter routing, models,
prompts, schedules, accounts, caps or processes. Ten's `GrowthPolicy` and `GrowthObservation`
similarly measure source-fact and projection growth and, on one coalesced breach episode, trigger
one part-five investigation governed by six's loop. They do not trigger a second part-two loop;
part two owns only a proposed fact-storage change resulting from that investigation. A proposed
remedy becomes a part-five run or part-eight effect after part four resolves the requester and
operation. The producer does not grade its own adequacy or close the verification obligation.

---

## 8. Spend caps and freeze through the effect doorway

**Rule — cap authority never comes from an observational projection.** Rules 4, 26, 40, 42, 49,
82, 86 and 95; **checks: P16-NF-18/19/35/51**. Once the requested part-eight control payloads
land, the spend operation consumes the current authorized cap policy and six's current fenced
reservation/accounting state at the required durability. It does not add seven's observational
hold cost to that state and does not read a routing-spend total, quota bar, burn finding, cached
price or provider estimate as authority. Concurrent reservations remain serialized by six.
Unsettled calls retain maximum exposure. Exhausted capacity makes the paid business operation its
own part-one `Refused` with `reason: budget-exhausted`. A current freeze makes that operation
`Refused` with `reason: policy` and detail naming the freeze. Only the separate control operation
that applied the cap/freeze may return `Success`.
Their subjects and ids cannot satisfy one another.

**Rule — changing a cap and releasing a freeze require operator authority.** Rules 4, 28, 79, 82,
89 and 98; **checks: P16-NF-35/51/52**. The action begins as an exact authorization
request through part four, completes on eleven's verified surface and executes once through
the requested part-eight payload. The rendered subject includes account or key, doorway scope, old and proposed values,
currency, time window, current base digest and consequences. Silence, chat wording, a dashboard
read, a metric threshold and a configured default are not approval. A stale base, widened scope
or replay refuses.

**Rule — freeze is a separately reachable stop effect.** Rules 15, 40, 42, 60, 77, 82 and 95;
**checks: P16-NF-35/45/51**. The requested part-eight control seam evaluates freeze before
ordinary spend admission and records the effect independently of this package's construction. If the measurement package, price join
or normal spend surface is unavailable, the registered operator stop path remains reachable.
Freeze never rewrites measurements or settlements. Unfreeze is a distinct operator-authorized
effect. An agent may invoke freeze only under an explicit, current operator-issued standing
grant owned by part one; the package never infers that grant from urgency or a threshold.

---

## 9. Retention, reconstruction and multiple machines

**Rule — bounded detail does not delete accounting facts.** Rules 7, 32, 33, 39, 43 and 60;
**checks: P16-NF-36/39–41**. Per-call `Measurement`, `Evidence`, judgment, hold, settlement and
conflict facts remain on part two's signed spine. This package declares finite detail horizons
for high-cardinality projections, checkpoints, temporary ingestion buffers and regenerable
price indexes. Pruning is bounded by rows, bytes and duration and runs off the observed path.
Rebuilding from the same pinned frontier, projection policy, register generation and explicit
evaluation clock forgets the same projection identities in the same order. Advancing the clock is
a changed input and may advance the detail cutoff. A projection horizon must not be presented as
the beginning of recorded history.

**Rule — evidence pins and lawful redaction still win.** Rules 7 and 26, plus parts two, seven and
nine's owned retention contracts; **checks:
P16-NF-39–41/47**. Content-free accounting facts do not require prompt or response bodies.
Provider payload captures, when required by seven or nine, follow their existing custody and
retention pins. An open authorization, conflict, unsettled charge, benchmark obligation or
verification assessment prevents removal where the owning part says so. Lawful capture removal
leaves two's tombstone and does not permit replacing an unknown quantity with zero. This part
adds no fact-deletion or encryption-key-destruction path.

**Rule — every projection is rebuildable and pool merge starts from canonical identities.** Rules
24, 31–33, 39, 45, 69, 95 and 113; **checks: P16-NF-14/16/36–41/50**. A pool query first unions
canonical attempt ids, observation keys, operation ids and current causal heads from all admitted
replicas. Full-replica overlap therefore contributes once; incompatible content under an identity
conflicts; genuinely disjoint identities contribute separately. Only after this union may the
view derive counts, money, coverage denominators or percentiles. Same-sample arithmetic continues
to require the full subject instance. Cross-instance addition uses only the registered
`aggregateMeasurements` operation and a declared `measurement-window aggregate`; compatible
members match subject kind, unit, category semantics, producer contract, currency/price basis or
hardware profile as applicable, aggregate scope, query frontier and evaluation clock. They do not
need the same attempt or process instance. Every aggregate retains the member observation keys and
full sample identities, so overlap is removed and disjoint compatible attempts add exactly once.
An unregistered pool scope or a member outside the declared aggregate scope refuses. This part
chooses source-fact aggregation: percentiles are computed from the deduplicated compatible source
observations, never from averaged peer percentiles or an unspecified sketch. Money uses each
operation's one current six-owned accounting state. Latest quota remains per account/window;
resource samples remain per machine/hardware profile. Missing-peer and conflict sets are unioned.
A peer timeout returns a partial response naming the peer and last admitted frontier, never an
unqualified pool total.

**Value — the signed spine grows.** The constitutional design deliberately retains facts. Bounded
projection and cache retention controls working sets and disclosure, but it does not bound the
spine's physical lifetime. Ten's `GrowthPolicy` and `GrowthObservation` measure source-fact and
projection growth and open one coalesced part-five investigation through six's loop. If that work
proposes a lossless fact-storage change, part two owns its design and approval. Rollup retention
is not deletion authority.

---

## 10. Holders, runs, loops and surfaces

**Rule — configured is not alive.** Rules 37, 39, 62, 69, 72 and 73; **checks:
P16-NF-42–44/49/52**. Each required collector, coverage projector, price resolver, retention
worker and surface has a part-nine holder with a fresh proof of running. Proof includes exact
artifact and adapter versions, register generation, last eligible input and output frontiers,
last successful tick, lag, failure counters, supported measurement families and an independent
probe. A file, table, timer declaration, process existence or successful startup log cannot
satisfy the holder.

**Rule — collection work is durable and loop-governed.** Rules 8, 38, 46, 52, 60 and 88;
**checks: P16-NF-43–45**. Backfill, reconciliation, retention and benchmark joins run as part-five
durable runs with six-owned cursor, lease, finite page, retry, backoff and recovery records. A
session may execute one step but does not own the assignment. Ticks do not overlap. A restart
resumes from an admitted cursor; an uncertain append is observed before another attempt. Retry
exhaustion leaves an open obligation and coverage deficit. It never turns the prior failure into
an empty successful page.

**Rule — public reads are bounded and scoped.** Rules 15, 28, 39, 43, 60, 69 and 98; **checks:
P16-NF-47–49**. Eleven's surfaces query registered projections through mediated reads. Windows,
dimensions, page size, sort keys and export bytes have finite limits. Default views contain no
prompt, response, command line, environment, secret, raw account credential or unrelated user
identity. Authorized diagnostic detail remains scoped and audited. A query timeout returns its
pinned partial horizon or a typed refusal, never an unbounded fallback scan.

---

## 11. What Instar 1.x does today and what carries forward

**Rule — the audited 1.x layer below is described as code behaves, not as 2.0 aspires.** Rules 39,
41, 58, 60, 75, 86, 87 and 111; **checks: P16-NF-05–14/21–33/39–46**. The audit covered the
named 1.x modules and their matching operator guidance; typed distinctions required by 2.0 but
collapsed in 1.x are corrections below, not carried-forward guarantees.

| 1.x module | Behavior and guarantee carried forward | Incident that earned it |
|---|---|---|
| `TokenLedger` and `TokenLedgerPoller` | Claude transcript scanning retains an incremental offset per source. Source files are read-only. Identity or head replacement resets scanning safely. Long scans yield. Poller ticks do not overlap. Codex rollouts take a separate whole-file path. The last cumulative per-session total is upserted by session id, replacing prior totals rather than adding them. Cached input, output, reasoning output and primary/secondary quota percentages stay separate. Repeated identical and growing snapshots must therefore remain one session row. Codex cumulative rows are intentionally absent from Claude `token_events`, `summary()` and `BurnDetector`. Aggregate Codex visibility is not per-exchange coverage or burn attribution. Sources: `TokenLedger.ts` schema/upsert and `ingestCodexSession`, `TokenLedgerPoller.ts`, `CodexRolloutParser.ts`. | A 119,000-file, 12 GB history blocked the event loop. A 202 MB ledger with about 390,000 sentinel rows made synchronous attribution backfill stall health into a boot failure loop. The 2.0 correction is a registered cumulative-session subject or an explicit unsupported-attribution limitation, never promotion of cumulative snapshots into invented calls. |
| `TokenLedger` | Schema additions precede indexes and queries that use them; migrations are idempotent; native database failure is surfaced through the existing availability path | Creating the attribution index before adding its column left existing installations with `no such column` and permanent token-route unavailability |
| `TokenLedger`, `FeatureMetricsLedger` and `BurnDetector` | Missing attribution remains visible; coverage is distinct from burn; a finished burst is not an active burn; cache-read tokens remain visible but do not masquerade as fresh usage | Putting every older event in one pre-attribution bucket produced a permanent 100% burn alarm; a completed burst repeatedly produced a contradictory projected-zero burn notice for a full day |
| `FeatureMetricsLedger` call outcomes | Its caller-supplied classifier records `fired` when the gate acted and `noop` when it ran and took no action. A completed call without a usable classifier is `unclassified`. `shed` means the circuit refused before provider invocation, so it is not a real round trip. Errors and programmatic events remain separate. | Treating calls with no verdict classifier as no-op fabricated a 0% fire rate. |
| `FeatureMetricsLedger` usage and model views | Usage presence counts rows with a reported value, including zero, instead of summing tokens. Feature-by-model and aggregate-by-model partitions come from the same bounded read, and read models rebuild from raw truth. | One large token row could otherwise hide many calls with missing usage; repeated full-window scans multiplied synchronous SQLite work. |
| `FeatureMetricsLedger` coverage denominator and exemptions | The 1.x `usageCoverage` denominator includes only successful `fired`, `noop` and `unclassified` call rows. Error rows are reported beside it but do not enter that denominator. Claude `interactive-pool` success rows are excluded, `gemini-cli` is marked exempt, and an empty success denominator renders numeric zero. These are 1.x presentation rules, not complete-exchange coverage and not guarantees carried into 2.0. The 2.0 migration keeps the old numerator, denominator, exclusions and exemption marker as labelled legacy fields while its canonical exchange coverage remains undefined on an empty denominator and keeps errors in the observed-exchange population. | A numeric 1.x zero can mean no eligible successful rows rather than measured zero coverage. Exclusion and exemption can also hide unmetered real exchanges if copied as authority. |
| `BenchmarkDivergenceAnalyzer`, `benchmarkDivergenceCore` and `FeatureMetricsLedger` quality/by-model rows | The serving-lease holder reads bounded matured windows and bounded peer aggregates. Stale mirrors, unverifiable hashes, prompt drift and mixed prompt identities stop both positive and negative conclusions. Missing peers, orphaned outcomes and incomplete grading stay partial or insufficient. Production and benchmark samples each retain a Wilson half-width; the larger uncertainty participates in the advisory verdict. | A stale, drifted or tiny benchmark must not manufacture praise or blame for a model, and one missing machine must not disappear from a pool conclusion. |
| `QuotaTracker.getState()` cache and file read | A cached state inside the read cooldown returns before any file existence or freshness check. Outside the cooldown, a missing file returns `null`. A stale file also returns `null`, but on non-Codex paths it keeps the old cache and updates `lastRead`, so the next call inside the cooldown returns that stale cached value. Codex clears the cache on stale or corrupt input. Corrupt non-Codex input may return the prior cache immediately. | The 2.0 design corrects these collapsed and contradictory states with typed missing, stale, corrupt and unsupported observations; its migration fixture preserves the stale-null-then-cached-value counterexample. |
| `QuotaTracker.shouldSpawnSession()` | Codex unknown state refuses session creation before provider invocation. Most missing non-Codex state fails open. Non-authoritative or implausible estimates use bounded degraded handling. The separately injected pool-placeability path has its own unknown rules. The quota read does not schedule by itself; callers choose to invoke this decision helper. | A non-authoritative 186% estimate stopped all work; an absent file warned 902 times per day; a provider with 1.3 million observed tokens still reported 0%; account-blind allowance disagreed with placement and fed a respawn loop. |
| `ResourceLedger`, `ResourceLedgerPoller`, `ResourceSampler` and `ProcessFootprintMonitor` | The SQLite ledger durably records breaker `circuit-open`/`circuit-recover` separately from session-sentinel `throttle`/`quota`/`529`; summaries expose counts, first/last time and breaker trips/hour. Event identity is `source:timestamp:process-local-sequence`: same-process same-millisecond emissions remain distinct and an equal identity is ignored, but sequence resets on restart, so a repeated timestamp/sequence can collide and must not be overstated as a cross-restart identity guarantee. CPU/RSS history is observe-only and bounded. Sources: `ResourceLedger.ts:eventId/recordRateLimitEvent/rateLimitSummary/rateLimitByKind` and `ResourceLedgerPoller.ts:start`. | Multiple full agent stacks and heavy Chromium/Electron tool servers accumulated until the host hit an `os_refcnt` kernel panic on 2026-06-26; a load-average misread caused false heavy-load deferral on 2026-06-19. The 2.0 fixture must cover two same-ms events, equal replay, restart collision and durable restart recovery. |
| `ResourceSampler` failed own-resource reads | The 1.x sampler records CPU as zero when its own CPU read fails, when no prior baseline exists or when wall time does not advance. It records RSS as zero and heap as absent when its own memory read fails, then includes those values in the aggregate. These are synthetic failure zeros, not observations of idle CPU or empty memory. Session PID sampling instead omits a PID when the batched read fails or returns no row. The 2.0 migration must preserve the source distinction where available and mark an old zero with lost origin as uncertain rather than observed zero. | Read-only instrumentation was kept from crashing the server, but its fallback can turn missing evidence into a plausible number. |
| `ProcessFootprintMonitor` production scan failure | `defaultListProcesses()` catches a failed `ps` call and returns an empty list. The monitor treats that successful empty return as a new sample with zero processes and zero RSS. Only a thrown injected `listProcesses` call keeps the last sample or returns an unretained zero when none exists. The 2.0 collector records scan failure or genuine observed empty census as different states. An old zero whose origin cannot be recovered remains uncertain. | A quiet-looking footprint point can be a failed host scan, masking the process accumulation the monitor exists to reveal. |
| `routingSpendView` and `routingPriceAuthority` | Immutable usage is priced on read; unpriced metered usage is loud; subscription access is labelled not per-token billed; provider settlement and internal derivation remain distinct | Earlier spend surfaces could make missing price or subscription billing look like $0 per-call cost and could blur reporting totals with committed money |
| `MeteredSpendLedger` and its `AgentServer` wiring | When the 1.x money layer is enabled, `AgentServer` constructs the ledger, supplies it to `MeteredSpendGate`, runs an expiry sweep at boot and repeats that sweep every five minutes. A booking row is appended and fsynced before the in-memory fold and disposable totals cache are updated. The cache is atomically replaced on a best-effort basis. Construction rebuilds totals from the JSONL, and a file-size high-water mismatch triggers another rebuild. Those append-before-cache and rebuild guarantees carry forward through part two's durable spine and six's accounting fold. The 1.x expiry behavior does not carry forward: elapsed TTL appends `expire`, and an expired reservation contributes zero committed spend without proof that dispatch or charge became impossible. A later settlement can book actual cost on the settlement's day instead of the reservation's day. A rows-file read failure is treated as empty history. Any malformed row is skipped. In 2.0, eight's `EffectSettlement`, six's `SettlementApplication`, the granted qualified read in `seam-response-loop-followup.md`, and the requested accounting-window seam replace those shortcuts. An expired-but-unproved legacy reservation remains uncertain in its original owner window at maximum exposure; it never creates released headroom. | The append-first ledger and conservative concurrent reservation were built so cached reporting or simultaneous calls could not reopen a cap. Timer expiry and permissive rebuild were availability shortcuts, not evidence that an external call did not execute or charge. |
| `RoutingSpendCapsStore`, `MeteredSpendGate` and `meteredCallEntry` helper path | The helper checks freeze before live enablement. The gate checks current caps and books bounded reservations atomically. Releasing money needs operator authority. These are real helper/control-path guarantees, and the readiness probe exercises the gate with a no-network provider. | A disable flag captured only at construction could remain cosmetically off while calls still admitted; placing freeze inside a failed money layer could take down the emergency brake with the machinery it must stop. |
| `meteredCallEntry` production dispatch integration | No 1.x production paid-provider call invokes `admitMeteredCall`; the module names that dispatch seam as future work. Probe and helper evidence therefore do not prove that a real paid exchange is protected end to end. | A chokepoint that no paid dispatch calls is a required integration seam, not current spend protection. |

**Rule — 1.x mechanisms are re-expressed through the 2.0 core.** Rules 24, 30, 31, 33, 49, 69,
86 and 95; **checks: P16-NF-02/12/16/23/31/35–45/51**. SQLite tables, JSON quota files,
process-local maps, source-side feature tags, timer ownership and private cap stores are not
portable authorities. Measurement and evidence become part-one payloads on part two. Register
entries and declarations replace string enums and private manifests after the requested
part-three shapes land. The requested part-four operation admits observations. Five and six own
durable scans, cursors, leases, retry and settlement application. Seven owns attempts, benchmark
records and, once its landed seam exists, hold cost. Eight owns settlement and, once its payload
seam exists, cap/freeze effects. Nine owns instrument adequacy and signals. Ten owns concrete
adapters, usage-category observations and persistence. Eleven owns the human read and
authorization surfaces. The provider transcript scanner may remain one adapter, but it is not
the ledger.

**Rule — 2.0 forecloses the audited design mistakes.** Rules 26, 30, 41, 49, 58, 69, 75 and 86;
**checks: P16-NF-02/07/10–14/17/22/23/30/35/42/45/51**. No observability store may also expose a
scheduler decision. No writer may swallow an instrumentation refusal without a coverage deficit
and instrument-health record. No source label is authority for feature, doorway, model or
account. No permanent exemption removes an actual call from the coverage denominator. No timer
may host unrelated authority work merely because its cadence is convenient. No empty list or
zero substitutes for a failed read. No configured file or constructed object proves a live
holder. No read-time price, credit, estimate or burn threshold opens or closes spend authority.

---

## 12. Behavioral seams and shared failure traces

**Rule — every cross-part interaction has one producer, record, order and closure owner.** Rules
24, 31, 33, 42, 45, 49, 68 and 69; **checks: P16-NF-02/07/12/15/23/31/35/42–45/51**.

| Seam | Ordered record flow | Failure direction and closure owner |
|---|---|---|
| model usage | seven attempt → six claim → eight dispatch observation → ten adapter evidence → requested four observation intake → two facts → sixteen projection | Call outcome stands; missing usage stays unknown; nine owns instrument finding; seven owns attempt/receipt; expanded categories wait on the ten seam |
| price and spend | requested three manifest + usage + eight settlement → six `SettlementApplication` history → requested six qualified accounting read → pinned read join → eleven view | Missing/incompatible price is unpriced; raw application bytes cannot lower current exposure; three owns manifest repair and six owns current accounting truth |
| quota/rate limits | provider or breaker/sentinel observation → ten adapter → requested four observation intake → two facts → account/window/source view | Missing/stale stays unknown; breaker and session events stay separate; no scheduling answer; nine owns collector adequacy |
| resources | OS observation on named machine → ten adapter → requested four observation intake → two facts → machine view/finding | Missing sample breaks completeness; no kill or throttle; ten repairs adapter and nine assesses |
| benchmark | requested seven compatibility resolver + requested ten current measured-route support + nine `Grade`/`BenchmarkEvaluation` + production measurements → pinned eligible join → nine advisory finding | The landed opaque digest and `measured:false` route cannot produce a positive control; after the seam lands, mismatch/staleness/conflict/current-support failure is ineligible and threshold shortfall is partial; seven, ten and nine repair their owned evidence |
| growth | ten `GrowthPolicy` + `GrowthObservation` → one coalesced episode → one five investigation under six loop → optional proposed part-two storage change | Observation never deletes facts; ten owns measurement, five/six own follow-through, two owns any later storage design |
| maximum disposition | five-owned conservative disposition → requested eight settlement variant → six application and qualified accounting read → pinned view | Before disposition the maximum is outstanding; after it the maximum is separately accounted with no headroom release or execution conclusion; unavailable until its five/six/eight seam lands |
| cap/freeze | operator act through eleven/four → one authorization → requested eight control payload using six's current accounting → settlement/receipt | Measurement outage does not block stop; stale/replayed/widened authority refuses; a frozen paid operation uses `reason: policy`; eight owns effect settlement; unavailable until its seam lands |

**Rule — four failure traces have exact answers.** Rules 14, 24, 31, 33, 41, 42, 46 and 86;
**checks: P16-NF-08/10/14/17/22/26/38/42/45/50/51**.

1. A provider returns output but no usage at clock `t`, with evidence-horizon endpoint `H`. The
   attempt and output outcome remain. For `t < H`, the exchange is pending and is not yet
   unmetered or overdue. At `t = H` and afterward, absent acceptable usage is overdue and the
   observed exchange is unmetered; spend remains unpriced or at maximum liability. An acceptable
   late usage observation after `H` causally refines the current row to usage-supported for reads
   whose frontier includes it, while earlier pinned reads remain unchanged. Reconciliation
   continues under six. No zero usage or free-call claim appears.
2. A process exits and its PID is reused before the next sample. The new start evidence creates a
   new process incarnation. The old run gets no later resource sample, and the missing interval
   remains visible.
3. A price correction and a feature-attribution correction arrive while a pool spend query is in
   flight. The query completes at its pinned frontier and generations. The next query may differ
   and names the later frontier; neither rewrites usage or settlement.
4. The measurement package fails while paid spend appears runaway. Reads report the instrument
   outage. Once the requested part-eight control seam is implemented, its independently admitted
   operator freeze path still executes without this package; later rebuild reconciles observations
   without unfreezing anything. Before that seam lands, the stop capability is an explicit gap,
   not a claim of current protection.

---

## 13. Non-functional checks and activation

**Rule — this governed submission is the runnable foundation tranche.** Rules
13, 34, 36, 39, 43, 55, 60, 69, 75, 86 and 113; **checks: P16-NF-01–52**. At this head, the
complete executable acceptance contract for this governed submission is
P16-NF-01/02/05/12/13/22/23/25–30/33/34/39–41/43/46–48/52. A builder must run every
negative and positive neighbor in that set; one absent neighbor fails the tranche. This tranche
makes no package-live claim and does not include the complete production model-call census,
observation ingestion, expanded usage, price
declarations, qualified live accounting, hold cost, maximum disposition, measured benchmark
comparison or spend controls.

Every other P16-NF row below is a tracked follow-on obligation for the full package, not an
acceptance check of this narrower submission. It cannot be reported executed, held, live or as a
positive fixture until every named owner decoder, port and production wire in section 1 lands.
When those public prerequisites land, a separately governed activation adds the row only after
both its positive and negative neighbors execute. Keeping the row here preserves the required
full-package design; an unavailable-feature assertion is tracking evidence only and never a pass.
P16-NF-52 fails the foundation tranche if any follow-on row is counted toward its acceptance.

The granted-seam dependencies are exact. The affected check arms remain non-executable until
their named grant files land: P16-NF-03/04/06/08/21/24/42/44/45/49 observation ingestion waits
for `seam-response-intake-followup.md`; P16-NF-03/04/09/10/14/49 expanded usage waits for
`seam-response-assembly-followup.md`; P16-NF-03/04/11/49 hold cost waits for
`seam-response-judgment.md`; P16-NF-11/19/36–38/49/50 qualified accounting waits for
`seam-response-loop-followup.md`; P16-NF-15–20/36 manifest-dependent arms wait for
`seam-response-declarations.md`; P16-NF-19/49 maximum disposition waits for
`seam-response-rungraph-followup.md`, `seam-response-effects-followup.md` and
`seam-response-loop-followup.md`; P16-NF-35/45/49/51 spend control waits for
`seam-response-effects-followup.md`; and P16-NF-07/31/32 benchmark execution and support wait for
`seam-response-judgment.md` and `seam-response-assembly-followup.md`. A grant records permission
to build; it is not evidence that the owner implementation or either fixture neighbor exists.

| Check | Foundation contract or tracked follow-on obligation |
|---|---|
| P16-NF-01 | Governed-doc lint and architecture inventory prove the required structure, owner table, duties, decisions and exactly one P16 check sequence with no gaps or duplicates. |
| P16-NF-02 | Dependency lint rejects a new core schema, private earlier-part import, retry loop, standing resolver, effect executor or register bypass in the package. |
| P16-NF-03 | Register build resolves every measurement subject, unit, producer, projection, holder, surface and bidirectional dependency; one missing or stale id fails activation. |
| P16-NF-04 | Decoder fixtures reject wrong subject kind, instance namespace, unit, clock, producer or evidence binding and accept the realistic registered neighbor. |
| P16-NF-05 | Measurement rendering refuses the word measured for a target, estimate, configured threshold or unnamed hardware/workload and accepts recorded execution evidence. |
| P16-NF-06 | After the part-four observation seam lands, adapter conformance proves collectors only observe and call that public intake operation; source mutation, provider invocation, conversation masquerade or direct fact append fails. |
| P16-NF-07 | **Tracked follow-on — non-executable until `seam-response-judgment.md` and `seam-response-assembly-followup.md` land with the named five/six/eight/nine production wiring.** Callsite census and production assembly then prove every model exchange path creates one seven-owned attempt, including swaps, failures, benchmarks and supervisors. A fake provider or current-callsite-only census is not the positive. |
| P16-NF-08 | Kill/fault cuts preserve one exchange identity and honest unknown outcome; repeated and growing Codex cumulative-session snapshots replace one registered session total, never add calls or enter exchange coverage/burn without attribution. |
| P16-NF-09 | Blocked on the part-ten usage-category seam: once landed, provider fixtures preserve input, cache-read/cache-write, output, reasoning, tool and billed categories; zero, unsupported, not-reported, subset and non-negative cases remain distinct. |
| P16-NF-10 | Tracked follow-on on four/ten: coverage tests distinguish proven no-exchange, observed exchange and dispatch-uncertain attempts; use only observed exchanges for usage coverage, past-horizon observed/uncertain attempts for overdue rate, retain pending and unsupported rows, render zero denominators undefined, and test `t < H`, `t = H` and acceptable late usage after `H`. Migration cases also preserve 1.x successful-only numerator/denominator, error side count, Claude interactive-pool exclusion, Gemini exemption and empty-denominator numeric zero as labelled legacy fields without using them as 2.0 coverage. |
| P16-NF-11 | Tracked extension on four/six/seven: missing usage never becomes zero; the attempt retains unknown usage and the qualified accounting read retains maximum reserved liability until valid settlement or an owned disposition. |
| P16-NF-12 | Attribution test mutates the usage row's feature/model/machine labels and proves the view uses signed run, attempt and register history instead. |
| P16-NF-13 | No-match and multi-match fixtures render unattributed and conflicted usage separately from named-feature totals. |
| P16-NF-14 | Observation-stream fixtures prove partial→final and late-charge causal refinement replaces the current head, equal replay is idempotent, and incompatible same-key or competing concurrent corrections produce `Conflict`. |
| P16-NF-15 | Tracked follow-on on three: after the requested manifest kinds and public decoders land, reject overlaps, missing currency/class/source, invalid categories, unregistered ids and below/equal/above plausibility boundaries as specified. No current positive result exists. |
| P16-NF-16 | A correction changes only reads pinned after its signed fact; rebuilds at an earlier frontier stay byte-equal and stored usage bytes remain unchanged. Window neighbors place an original exchange one clock unit before UTC midnight, one exactly at `start`, and one exactly at `end`; start is included, end is excluded, and usage, price or attribution corrections arriving the next day retain the original dispatch window rather than their append day. |
| P16-NF-17 | Missing, stale, implausible or incompatible prices produce labelled unpriced usage; subscription calls never render as free or per-call settled. |
| P16-NF-18 | Exact-money property tests cover rounding boundaries, large totals and mixed currencies without binary floating authority or cross-currency addition. |
| P16-NF-19 | **Tracked follow-on on six and five/six/eight; window membership is non-executable until `design-measurement-ledgers-seam-request-accounting-window-membership.md` is granted and lands.** Unknown, partial, final, duplicate and above-reservation fixtures use the qualified accounting read once. With reservation 100 and known final charge 20, failed requalification reports `S=0/O=100/C=100`; qualified quiescence reports `S=20/O=0/C=20`; qualified uncertain or delayed-possible execution reports `S=20/O=80/C=100`. The maximum-disposition case reports `S=100/O=0/C=100` and keeps a later charge at or below 100 as an annotation; none releases headroom or proves execution complete. A reservation one clock unit before UTC midnight stays in six's original day when invocation, expiry sweep, settlement or disposition occurs later. A reservation exactly at the end boundary enters the next window. An expired-but-unproved legacy reservation retains maximum exposure and uncertain original membership instead of becoming released headroom. |
| P16-NF-20 | Subscription allocation, when enabled, shows its exact formula and sums once at its declared scope; disabling it returns unknown call cost, not zero. |
| P16-NF-21 | Tracked extension on four: quota fixtures preserve account, window, source, observed/reset times and freshness and distinguish stale, corrupt, missing and unsupported. The migration fixture also reproduces 1.x non-Codex stale-file `null` followed by the stale cached value inside the read cooldown. |
| P16-NF-22 | Unknown quota never sorts as best headroom or becomes 0%/100%; missing-state notification load coalesces once per episode. |
| P16-NF-23 | Static and integration tests prove no quota or measurement projection exports or feeds an allow/place/throttle decision. |
| P16-NF-24 | Resource conformance records named hardware, OS adapter, monotonic interval and process incarnation; rate-limit fixtures also preserve breaker versus session source, two same-ms events, equal replay, restart/collision and counts/rates. Migration fixtures preserve whether a 1.x value came from an own-resource read, PID batch or footprint census; unnamed or origin-lost samples cannot become observed zero. |
| P16-NF-25 | CPU/RSS tests prove one-core versus whole-machine normalization, interval arithmetic, byte units and heap unsupported-state semantics. |
| P16-NF-26 | PID reuse, dead PID, permission denial and partial process-list fixtures create new incarnation or missing samples, never zero-valued continuity. Source-specific cases distinguish failed 1.x own CPU and memory reads, a failed production footprint scan and a failed session PID batch from genuine observed zero CPU, RSS or process count; an old stored zero with lost origin remains uncertain. |
| P16-NF-27 | A limit-plus-one process census uses one bounded batch/page plan, marks truncation and never creates a per-PID spawn storm. |
| P16-NF-28 | Classifier fixtures resolve registered process classes and preserve unmatched relevant counts without storing command lines or environment data. |
| P16-NF-29 | Trend tests reject windows with missing ticks, hardware/classifier changes or insufficient samples and accept a complete named window. |
| P16-NF-30 | Feature rollups keep real exchanges, shed pre-invocation attempts, errors, parser failures, events and unclassified outcomes distinct. Fixtures prove `fired` only from evidence of the registered action predicate, `no-op` only from a completed negative classification, and unknown when the classifier is absent, incomplete or conflicted. |
| P16-NF-31 | **Tracked follow-on — non-executable until `seam-response-judgment.md` and `seam-response-assembly-followup.md` land.** Seven's public resolver must return the full judgment-class, prompt/context, floor/schema, model/settings, scenario and evaluation-contract tuple from current facts, and ten must provide exact current route support referencing that resolution. The landed opaque digest and `measured:false` route are negative cases, never the positive fixture. |
| P16-NF-32 | **Tracked follow-on — non-executable until `seam-response-judgment.md` and `seam-response-assembly-followup.md` land.** One real measured-route eligible control passes; negatives changing only floor, context, setting, criterion or current route support become ineligible. Below/equal/above sample, coverage and machine-share boundaries yield the specified partial/eligible statuses. Production and benchmark populations each retain raw counts and Wilson intervals, and neither may be omitted from the comparison bound. |
| P16-NF-33 | Burn tests distinguish four zero-looking cases: missing/incomplete observation retains an open episode and resets recovery count; complete zero activity closes immediately; complete usage-supported zero-amount activity leaves open state open with undefined share and zero recovery count; adequate nonzero activity below recovery thresholds closes only after the configured consecutive count. Separate fixtures prove the eligible set and `eligibleSampleCount` use only the named feature's deduplicated compatible usage-supported exchanges and programmatic events. A complete census and complete collectors with 75% usage coverage are adequate at a 70% inclusive floor and insufficient at an 80% floor; neither is called incomplete. An event-only population with no model exchanges has undefined, non-applicable usage coverage and is adequate when its event census/collector and sample floor pass; the neighbor with an incomplete event collector is incomplete. An empty baseline has no median and cannot be adequate. Cold baseline, entry boundaries and one notification/investigation per episode are also covered. |
| P16-NF-34 | Pre-instrumentation absence raises coverage debt but no culprit ranking; genuinely metered unresolved usage raises unattributed-spend evidence. |
| P16-NF-35 | Tracked extension on eight: architecture/e2e tests prove findings advisory and remedies owner-routed. Unsafe paid work is `Refused` with `reason: budget-exhausted` for exhausted capacity or `reason: policy` with freeze detail for a current freeze. Only the distinct cap/freeze control subject may be `Success`. |
| P16-NF-36 | Every view pins frontier/register/price generations, `[start, end)`, clock basis, family membership source, query parameters and evaluation clock. Historical-projection bytes are equal for those exact inputs. A sample exactly at start is present and one exactly at end is absent. A late observation or correction changes only a later-frontier read of its original source-time window. Live-accounting bytes are equal only for the exact owner-issued accounting-view input set; qualification loss/restoration, restart or clock advancement creates a new input without changing the historical section. The committed arm is non-executable until `seam-response-loop-followup.md` and the requested accounting-window seam land. |
| P16-NF-37 | Pool merge properties select family membership from owner-recorded source times, then union canonical source ids before all counts, money and percentiles. Fully overlapping replicas equal one replica. Two different compatible attempt instances add once through the registered `aggregateMeasurements` operation and retain both member identities. A pre-midnight source observed by a peer after midnight stays in the first window; an exact-endpoint source stays out. Incompatible identity content conflicts. Different kinds, units, bases or unauthorized aggregate scopes refuse. The committed-money arm is non-executable until the requested accounting-window seam lands. |
| P16-NF-38 | Peer loss and clock-skew tests return local plus admitted peers with missing-peer/last-frontier labels; no response claims a complete pool total. |
| P16-NF-39 | Projection/cache/detail horizons are declared and enforced while canonical measurement, evidence, attempt, settlement and conflict facts remain on the spine. |
| P16-NF-40 | Open evidence pins prevent owned capture removal; lawful removal leaves a tombstone and cannot change unknown usage into zero. |
| P16-NF-41 | Retention work is row/byte/time bounded, off-hot-path and replay-equivalent; interruption resumes without skipped identities. |
| P16-NF-42 | Each configured holder must emit fresh independent running proof; file/table/process/config-only fixtures remain unavailable. |
| P16-NF-43 | Loop tests enforce one live tick, finite page, cursor, lease, backoff, attempt ceiling and no stacked timer callbacks. |
| P16-NF-44 | Restart tests resume durable backfill/reconcile work from an admitted cursor and preserve open coverage and instrument-health obligations. |
| P16-NF-45 | Append refusal and uncertain receipt are surfaced, observed before retry and never converted to an empty-success result or hidden by catch-and-continue. |
| P16-NF-46 | Load tests measure observer cost and Growth observations; one threshold breach/replay opens exactly one five-owned investigation under one six loop, never a second part-two loop. |
| P16-NF-47 | Privacy fixtures reject prompt/response bodies, command lines, environment values, secrets and unrelated identities from default facts and surfaces. |
| P16-NF-48 | Query tests enforce finite windows, dimensions, pages, sort work and export bytes; timeout returns a pinned partial result or typed refusal without full-scan fallback. |
| P16-NF-49 | Tracked follow-on: unit, integration and production-lifecycle tests prove every required landed port delegates to a real implementation. The declaration, observation-intake, qualified-accounting-read, judgment-hold, maximum-disposition, spend-control, usage-category and benchmark-route-support seams each remain unavailable until their owner decoder/port and real wiring exist. |
| P16-NF-50 | **Tracked follow-on — qualified-accounting-read seam required.** Corrupt projection/checkpoint/index, kill at adjacent append/fold boundaries and full genesis rebuild converge to equal historical bytes for the same frontier, generations, query and evaluation clock or a visible defect. The same owner-issued live-accounting inputs also reproduce; qualification loss/restoration and clock advancement are tested as changed inputs. Neither the runnable historical arm nor an unavailable assertion substitutes for the complete two-arm check. |
| P16-NF-51 | Isolation tests prove measurements/views/caches/findings cannot admit spend, alter caps, freeze/unfreeze, route, retry, reap or mutate standing; once the eight seam lands, only its exact payload may perform cap/freeze controls. |
| P16-NF-52 | Independent review records executed positive and negative evidence for every foundation-tranche check and records every tracked follow-on as outside that acceptance. An unavailable assertion cannot count as a positive fixture. Absent evidence prevents held/live claims, full-package approval is not inferred, and operator approval remains separate. |

**Rule — performance bars name workloads and failure actions.** Rules 13, 34, 39, 43, 55, 60
and 64; **checks: P16-NF-05/27/36–38/41/46/48–50**.

| Property | Automatic workload and measurement | Bar and failure action |
|---|---|---|
| dispatch overhead | supported provider/harness matrix at idle, nominal and burst concurrency; wall/CPU/allocation/I/O on named machines | configured release budget must be met at eligible worst sample; otherwise that adapter is not admitted |
| ingestion and coverage lag | complete release corpus, errors, streams, swaps and late receipts with kill cuts | finite declared lag and zero lost census identities; breach opens instrument finding and blocks package activation, never the model call |
| resource sampler cost | process census at limit and limit-plus-one on each OS/hardware class | tick duration, CPU, RSS and spawned-process budgets hold; excess yields bounded incomplete sample and failed activation |
| projection rebuild | cold genesis and checkpoint rebuild across maximum release corpus and peer set | canonical equality within declared memory/time/I/O budget; timeout is a failed rebuild, not an empty view |
| query bound | widest allowed windows/dimensions, worst cardinality, slow/missing peer and export maximum | response or typed partial/refusal within budget; no unbounded fallback scan |
| storage growth | sustained maximum admitted call/resource rate plus package self-measurement | ten's policy compares source-fact and projection growth separately; one breach episode opens one five investigation under six's loop, and only a resulting storage proposal goes to part two |

**Rule — activation needs three tiers and independent evidence.** Rules 34, 37, 62, 65, 72, 73,
81 and 105; **checks: P16-NF-42/46/49/50/52**. Unit tests cover decoders, joins, arithmetic,
classification and pure folds. The foundation tranche integrates only the public earlier-part
contracts that exist at this head and may claim only its explicitly named acceptance set. Its
production lifecycle proves those components are wired and honest; it cannot claim the full
measurement/spend package live. Full-package integration
requires real part-two persistence, part-four observation intake, part-seven attempts/benchmarks,
part-eight effects, six's qualified accounting read, seven/ten's measured-route support and
part-nine assessments under fault cuts. Full-package production-lifecycle tests start the real
assembly, execute real bounded provider and OS samples on named hardware, rebuild both historical
and live views, query eleven's surfaces and prove freeze isolation. Those claims remain follow-on
obligations until their owner seams land. Part nine records holder freshness and semantic
adequacy. Mocks, configured routes, database existence, an unavailable-feature assertion and
document lint cannot make either tranche or package live.

---

## 14. Negative contract fixtures

**Rule — each negative has a realistic positive neighbor.** Rules 34, 36, 37 and 69; **checks:
P16-NF-01–52**.

| Fixture | Stage | Failure exposed; positive neighbor |
|---|---|---|
| P16-NF-01 | build | Missing structure/owner/duty/check or duplicate check id; complete governed inventory passes |
| P16-NF-02 | architecture | Private core type, retry, standing or effect path appears; earlier public doorway passes |
| P16-NF-03 | register | Unit/producer/projection/holder has no current bidirectional entry; complete generation resolves |
| P16-NF-04 | decode | Wrong subject, unit, producer, clock or evidence binding accepts; registered tuple passes |
| P16-NF-05 | semantics | Target/estimate/unnamed machine is called measured; recorded named execution passes |
| P16-NF-06 | conformance | Collector mutates source, invokes work, impersonates conversation or appends directly; requested observation-intake path passes after it lands |
| P16-NF-07 | tracked follow-on | Non-executable until `seam-response-judgment.md` and `seam-response-assembly-followup.md` land with five/six/eight/nine production wiring; afterward a swap/error/benchmark/supervisor exchange lacking one attempt fails and a complete production one-to-one census passes |
| P16-NF-08 | fault | Kill window loses exchange identity or cumulative Codex snapshot adds calls; one honest attempt and replace-in-place session total pass |
| P16-NF-09 | provider | Until ten's seam lands, category support stays unavailable; afterward collapsed/absent/zero/subset-invalid categories refuse and faithful mappings pass |
| P16-NF-10 | tracked follow-on | Before four/ten land, neither neighbor runs; afterward refusal enters exchange denominator, uncertain dispatch disappears, `t < H` becomes overdue, or `t = H` stays pending; exact endpoint sets and acceptable late refinement pass. A migration neighbor preserves the labelled 1.x successful-only/error/excluded/exempt/empty-zero fields while refusing them as canonical 2.0 coverage. |
| P16-NF-11 | tracked extension | Before four/six/seven land, no result is claimed; afterward missing usage becomes zero/free or a raw signed application releases liability; unknown plus qualified maximum exposure passes |
| P16-NF-12 | provenance | Usage row self-label controls feature/model/machine; signed-history resolution passes |
| P16-NF-13 | join | No/multi match hides in a named bucket; unattributed/conflicted rows pass |
| P16-NF-14 | replay | Partial plus final double-counts or late charge conflicts automatically; causal refinement/equal replay pass and competing corrections conflict |
| P16-NF-15 | decode | Check is unavailable before three's seam; afterward overlap/missing fields/out-of-bound point refuses while equality at plausibility bound passes |
| P16-NF-16 | rebuild/window | Price, usage or attribution correction rewrites usage, changes an earlier frontier or moves the member to its next-day append window; original exchanges one clock unit before UTC midnight and exactly at start stay included, exactly at end is excluded, and a later-frontier correction changes only the original dispatch window |
| P16-NF-17 | honesty | Missing price/subscription renders free; unpriced/not-per-call-settled passes |
| P16-NF-18 | arithmetic | Float drift, implicit rounding or mixed currency total accepts; exact scoped totals pass |
| P16-NF-19 | tracked follow-on | Raw signed application releases credit after restart, known charge is added to inclusive exposure, maximum disposition releases headroom/proves completion, late settlement moves a pre-midnight reservation to another day, or former TTL expiry releases an unproved legacy reservation. After the qualified-read and maximum-disposition grants land, the accounting neighbors are failed requalification `S=0/O=100/C=100`, qualified quiescence `20/0/20`, qualified non-quiescence `20/80/100`, and disposition `100/0/100`. Window neighbors are non-executable until `design-measurement-ledgers-seam-request-accounting-window-membership.md` is granted and lands; then pre-midnight/later-settlement remains in the original window and exact end enters the next. |
| P16-NF-20 | policy | Subscription allocation double-counts or hides formula; once-scoped labelled formula passes |
| P16-NF-21 | tracked extension | Account/window/source/time is missing, stale reads current, or 1.x stale-null-then-cached behavior is omitted; complete fresh typed observation and the exact migration counterexample pass after four lands |
| P16-NF-22 | quota | Unknown becomes best/0% or emits 902 notices; unknown and episode coalescing pass |
| P16-NF-23 | architecture | Quota view exports allow/place/throttle; observational read only passes |
| P16-NF-24 | resource | CPU lacks hardware/interval/incarnation or rate events collapse breaker/session, same-ms or restart cases; named sample and source-bound durable events pass, while legacy resource rows keep their source/fallback origin or remain uncertain |
| P16-NF-25 | resource | CPU normalization or byte unit is ambiguous; declared arithmetic passes |
| P16-NF-26 | lifecycle | Reused/dead PID, failed own CPU/memory read or failed footprint scan continues as observed zero; new incarnation/missing/failure passes, and genuine source-reported zero remains valid |
| P16-NF-27 | load | Per-PID fork storm or unmarked truncation; bounded batch with omitted count passes |
| P16-NF-28 | privacy | Unknown process is dropped or command/env stored; count-only unclassified passes |
| P16-NF-29 | trend | Gapped/mixed window claims a trend; compatible complete window passes |
| P16-NF-30 | semantics | Shed/error/unclassified/event becomes a real no-op call, or Grade alone selects fired; the registered action-predicate mapping and unknown case pass |
| P16-NF-31 | tracked follow-on | Non-executable until `seam-response-judgment.md` and `seam-response-assembly-followup.md` land; afterward the landed opaque digest or caller-built tuple fails, while the owner-resolved full tuple plus exact current measured support passes |
| P16-NF-32 | tracked follow-on | Non-executable until `seam-response-judgment.md` and `seam-response-assembly-followup.md` land; afterward `measured:false`, floor/context/settings/criterion/support mismatch, dropped population uncertainty or a boundary error fails, while one real measured-route two-sided control and exact partial/ineligible neighbors pass |
| P16-NF-33 | signal | Missing collection closes, empty baseline supplies a median, complete zero-amount activity enters or recovers with undefined share, or one low nonzero window bypasses recovery count. Complete-census/complete-collector populations with 75% usage coverage must be adequate at a 70% inclusive floor and insufficient at 80%, without either being called incomplete. An event-only population with no model exchanges must treat usage coverage as undefined and non-applicable: a complete event census/collector meeting the sample floor is adequate, while an incomplete event collector is incomplete. The remaining incomplete, inactive, zero-metered-activity and consecutive-recovery neighbors have the specified states and counters. |
| P16-NF-34 | attribution | Pre-instrumentation bucket is blamed as feature; coverage debt passes |
| P16-NF-35 | tracked extension | Finding changes route/cap/process, message impersonates control, frozen extends the refusal vocabulary, or control Success replaces paid-work Refused; `budget-exhausted`/`policy` and distinct subjects pass after eight's seam |
| P16-NF-36 | consistency/window | Query has moving frontier/generation/clock, omits `[start, end)` or membership basis, moves late evidence to arrival day, includes exact end, excludes exact start, or compares different live qualification inputs. Byte-equal historical rows, correct start/end neighbors, late refinement in the original source window and same-owner-observation live rows pass. The committed arm waits for `seam-response-loop-followup.md` and the requested accounting-window seam. |
| P16-NF-37 | merge/window | Full replicas double totals, same attempt overlaps add, different compatible attempt instances refuse, peer arrival time moves a pre-midnight source past midnight, exact end enters, or unauthorized scope/kind/unit adds. Registered aggregate union deduplicates overlaps, adds two disjoint members once, retains both identities and groups by owner-recorded source time. The committed-money neighbor is non-executable until the requested accounting-window seam lands. |
| P16-NF-38 | partition | Missing peer vanishes from complete total; named partial horizon passes |
| P16-NF-39 | retention | Detail prune deletes source facts or hides horizon; disposable view prune passes |
| P16-NF-40 | retention | Open pinned capture disappears or tombstone becomes zero; owned preservation passes |
| P16-NF-41 | load | Prune monopolizes hot path or skips after interruption; bounded resumable pass succeeds |
| P16-NF-42 | liveness | File/table/config/process proves alive; fresh independent probe passes |
| P16-NF-43 | loop | Ticks overlap or retry without bound; leased finite loop passes |
| P16-NF-44 | recovery | Restart loses cursor/open debt; durable resumed work passes |
| P16-NF-45 | failure | Append refusal is swallowed as empty success; typed uncertainty and later observation pass |
| P16-NF-46 | performance | Observer cost is omitted or one growth breach creates duplicate/part-two loops; named self-measurement and one five/six investigation pass |
| P16-NF-47 | privacy | Prompt/response/command/env/secret leaks in default read; bounded metadata passes |
| P16-NF-48 | query | Limit evasion triggers full scan/export; bounded page or typed refusal passes |
| P16-NF-49 | tracked follow-on | A missing owner seam or null/no-op/test-only port appears live; production delegation evidence passes only after all eight named seams land |
| P16-NF-50 | fault | **Tracked follow-on.** Corrupt cache/checkpoint serves drift, ambient clock changes equal-input output, or live qualification changes without a new input; pinned genesis equality plus exact qualified live-input replay, with changed inputs for qualification loss/restoration and clock advancement, or visible defect passes |
| P16-NF-51 | isolation | Metric/view/cache can spend, route, freeze or grant; eight-owned effect boundary passes |
| P16-NF-52 | governance | An unexecuted check, unavailable follow-on or approval is claimed as a foundation positive/held/live result; independent two-sided evidence for every foundation check, follow-ons excluded from acceptance and a separate operator act pass |

---

## 15. Inherited duties and disposition

**Rule — no inherited duty remains parked.** Rules 8, 49, 69 and 71; **checks:
P16-NF-01/03/49/52**.

| Duty | Disposition |
|---|---|
| Token and usage accounting | **Current identity/fold slice plus tracked activation:** refinement/conflict and signed-history attribution are current. The complete production attempt census, including benchmark execution, is non-executable until `seam-response-judgment.md` and `seam-response-assembly-followup.md` land with the named production wiring. Observation ingestion, exact live coverage and expanded categories also wait on their owner seams; no blocked positive neighbor is claimed, P16-NF-07–14. |
| Per-feature model-call and spend accounting | **Held at the read contract:** attribution re-resolves through signed history and totals retain unattributed/conflicted amounts, P16-NF-12–20/30; priced output waits on part three. |
| Price manifests joined on read | **Declared, not implementable yet:** the effective-point and arithmetic contract is specified, but P16-NF-15 and dependent activation wait on the part-three manifest seam. |
| Quota ledger | **Held as observation:** account/window provenance and unknown states are complete; scheduling authority is deliberately re-expressed through earlier owners, P16-NF-21–23/35/51. |
| CPU, memory and process footprint | **Held at the measurement contract, activation blocked in part:** named hardware/incarnations, bounded sampling, rate-event identity and observer self-cost are covered by P16-NF-24–29/46; admission waits on part four. |
| Burn and routing-spend views | **Current burn algorithm plus tracked spend activation:** missing windows retain episodes, complete zero activity closes explicitly, and low nonzero recovery uses consecutive windows. Priced and current-commitment arms wait on parts three and six, P16-NF-33–38. |
| Benchmark connection | **Tracked follow-on, not accepted in the foundation tranche:** the landed seven record supplies only an opaque claimed digest and the landed ten route is necessarily unmeasured. P16-NF-31/32 are non-executable until `seam-response-judgment.md` and `seam-response-assembly-followup.md` land with the resolver, current support, one real eligible positive control and nine's `Grade`/`BenchmarkEvaluation`; until then no comparison can be eligible. |
| Bounded retention | **Held within constitutional limits:** detail projections, caches and workers are finite and rebuildable; source facts remain on two's spine and open pins are honored, P16-NF-39–41. |
| Spend accounting, caps and freeze | **Declared owner split, not landed:** historical settlement remains distinct from six's qualified current exposure. Committed hour/day membership also waits on `design-measurement-ledgers-seam-request-accounting-window-membership.md`; late settlement cannot be assigned by arrival day. Maximum disposition waits on its five/six/eight seam. Cap/freeze actions remain eight-owned and use part one's existing refusal vocabulary, P16-NF-19/35/45/49/51. |
| Holder and activation proof | **Held at the evidence contract:** fresh independent running proof, durable loops and three test tiers are required by P16-NF-42–50/52; no missing seam may report live. |

---

## 16. Operator decisions and honest limits

**Value — detail horizons.** How long should high-cardinality local projections retain per-call
and per-process detail: 30 days, 90 days, or 365 days? I recommend 90 days, with daily aggregates
for the wider read horizon and permanent signed facts underneath. The choice trades local query
cost and casual disclosure against convenient diagnosis; it does not authorize fact deletion.

**Value — subscription allocation.** Should subscription cost be shown only as a period charge,
allocated to active features by token share, or allocated by run time? I recommend period charge
plus an optional token-share view, both labelled reporting-only. Token share is reproducible and
useful, but it must never pretend the provider billed that call or influence a cap.

**Value — currency conversion.** Should the default spend total remain separated by native
currency, or include a converted reporting total from a governed exchange-rate manifest? I
recommend native-currency totals by default and an opt-in converted view. This avoids hiding
rate-source and effective-time uncertainty in a single headline.

**Value — benchmark comparison policy.** The threshold values here are proposed deployment policy,
not measurements derived from a pinned 1.x population. An exploratory comparison would require at
least 10 complete cases and at least 25% Grade coverage in each population, at most 80% of
production cases from one machine, evidence strictly younger than 30 days and 90% Wilson intervals
(`z=1.6448536269514722`). It would be labelled exploratory and could not be a published alignment
claim. A conservative published comparison would require at least 100 complete cases and at least
90% Grade coverage in each population, at most 50% of production cases from one machine, evidence
strictly younger than 14 days and 95% Wilson intervals (`z=1.959963984540054`). I recommend
exposing both tiers while allowing only the conservative tier in the primary/published comparison.
Should the operator approve that proposed two-tier policy, or require conservative-only output and
accept the longer evidence-collection delay?

**Value — burn policy.** Should burn thresholds be one universal package default, a per-feature
policy, or deployment-specific values approved after a measured baseline? I recommend
deployment-specific values with per-feature overrides only where a named risk justifies them.
The chosen values must include separate lower recovery thresholds and recovery-window count. The
signal should ship observed before any notification policy is approved.

**Value — quota presentation.** For providers with no advance-usage surface, should the primary
view show only `unknown`, or `unknown` beside the separately labelled locally observed token total?
I recommend the latter. An estimated provider percentage from an invented plan denominator is
forbidden by the evidence rules and is not an operator option.

**Value — signed-spine growth posture.** Should the operator approve permanent signed accounting
history with published ten-owned growth observations and finite projections, or withhold package
approval pending a separately approved part-two lossless storage change? I recommend the former.
Ten's existing growth episode still opens only one five-owned investigation under six's loop; this
choice neither creates a second trigger nor authorizes deletion.

**Rule — technical completion is not approval or certification.** Rules 34, 65, 80, 82 and 90;
**checks: P16-NF-49/52** and the governed review process. This document claims no deployment,
runtime measurement, review convergence, holder adequacy or operator approval. Implementation
becomes eligible only after the real three-tier, production-lifecycle, reconstruction,
isolation, privacy, load and independent-holder evidence exists. The operator's answers above and
explicit approval remain separate from every technical pass.

---

*Depends on: the approved rules, register, glossary, big-picture design, and parts one through
eleven, especially parts one, two, seven, nine, ten and eleven, and their changelogs.*
