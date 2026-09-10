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
| burn amount selection | For one burn-policy version and one named activity source, either one registered quantity category or one registered package derivation over an ordered set of resolved quantity categories. A derivation declares its exact arithmetic, output unit, every input category and category relation, how totals and subsets are combined without double-counting, and what happens when a referenced category is missing, unsupported, conflicted or unresolved. Such an input yields no amount; it never supplies an implicit zero. A category deliberately outside the selection is not a missing input. The selection is a package-policy field, not a new core type, and yields at most one amount for one canonical activity member. |
| compatible observed amount | The single resolved quantity chosen directly by the policy's burn amount selection, or the single result of its registered derivation, when the selection version, activity source, category semantics, unit and applicable currency or hardware basis match the policy at the pinned frontier and evaluation clock. Several source categories can feed one derived amount without creating several samples. |
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
| detail horizon | The finite time range exposed by a bounded read presentation or kept in its disposable adapter cache. `High-cardinality` means that key count grows with attempts, observations or process incarnations rather than a fixed category roster. The horizon never changes part two's complete `all-identities` projection or licenses removing spine facts. |
| rollup | A summary made from existing observations, such as grouped counts or totals. It does not import older observations or create new source facts. |
| backfill | Importing older observations that predate the currently collected range while retaining their source identity and evidence. |
| hot path | Work on the latency-critical request path whose delay directly adds to the time needed to answer or admit the request. |
| OS | Operating system: the host software whose registered adapter supplies process and machine observations. |
| UTC | Coordinated Universal Time: the default civil-time basis for displayed hour and day boundaries in this part. |
| CPU | Central processing unit: the processor resource whose consumed process time is sampled over a named monotonic wall interval. |
| MiB | Mebibyte: 2²⁰ bytes. |
| I/O | Input/output: work that reads or writes data across a process, storage or network boundary. |
| durable flush | An operating-system `fsync` request that asks the storage adapter to force already-written file bytes and required metadata through the declared local durability boundary before success is reported. |
| heap | The runtime-managed memory area reported by a process runtime. It excludes memory outside that managed area and is not interchangeable with OS-reported RSS. |
| PID | A reusable operating-system process number and lookup locator, never process identity by itself. |
| RSS | Resident set size: bytes the named OS adapter reports resident for the named process incarnation at the sample instant, subject to that adapter's documented accounting limits. RSS covers resident process memory visible to the OS, not only the runtime-managed heap. |
| source sample identity | The producer-contract identity of the actual observation point or interval before witnesses are considered. For a sampled family it includes the owner-recorded subject and sample or snapshot time/interval needed to distinguish successive observations. It is shared by independent witnesses of that same actual sample and differs from each witness's source-event identity. |
| quantity key | The family-specific identity of one amount before evidence about it is considered. An exchange quantity uses the canonical exchange, category, unit, registered category relation and applicable billing basis. A resource quantity uses the machine and process incarnation or machine aggregate, source sample identity, category, unit, hardware basis and interval semantics. A quota quantity uses the account, provider window, source snapshot identity, category and unit. A cumulative-session quantity uses the framework/session, source snapshot identity, category and unit; a separate current-total fold selects the causally maximal snapshot for that session. A programmatic-event or package-cost quantity likewise includes its registered event or holder/run sample identity. Every form deliberately excludes witness producer authority, witness source-event id and observation phase. |
| observation stream | One witness's history for a quantity key, identified by producer authority and source-event identity. Its causal heads describe that witness through partial, final and correction phases. |
| quantity witness | The causally current acceptable head of one observation stream, retained with its full `Measurement`, `Evidence`, producer and source-event identity as support for the quantity key. |
| resolved quantity | The one amount a read may use for a quantity key. One acceptable witness resolves it. Several compatible witnesses resolve it once when their normalized amounts agree. Disagreeing witnesses leave it unresolved unless a causally later owner-produced resolution names every competing witness and the resolved amount under the registered producer contract. All witnesses remain evidence whichever result applies. |
| cumulative-session usage | A provider/framework total for one registered session whose later snapshot replaces the earlier current snapshot. It is aggregate evidence with `per-call attribution unsupported` unless an independent exact attempt mapping exists. |
| origin-lost legacy numeric evidence | Any stored numeric token-category value migrated from 1.x without original bytes that prove the source supplied a JSON number whose value was a non-negative integer in that category. The number is retained with a labelled legacy-evidence status, but it is never called source-reported usage. This applies to zero and nonzero values alike because the old Codex parser accepted JavaScript-coercible non-numbers and preserved negative and fractional numbers. |
| routing-spend view | A bounded read presentation over part two's complete `all-identities` projection. It applies the requested window, detail horizon, price and attribution joins without becoming a projection fold, money ledger or cap authority. |
| source history input | The exact current owner-issued `FactSnapshot` returned by part two's public `FactStorePort.readForProjection()` for one read. Its statuses carry decoded bodies, conflicts and taint; each status's `fact` carries the complete signed envelope, including the source clock and causal metadata. The presentation consumes it beside, not through, the source projection and records its canonical digest. The source fold records the frontier it actually reached. If the store advances, the old snapshot and its projection become invalid for folding or serving; copied old bytes are not a historical-frontier input. It is a package input name, not a new core type. |
| feature outcome classifier | A registered mapping from current attempt, decision, effect/event and grading evidence to the feature's declared action predicate. It yields `fired` only when that action is proved to have occurred, `no-op` only when complete evidence proves it did not occur, and `unclassified` when the mapping is absent, incomplete or conflicted. A `Grade` or judgment result alone is not this classifier. |
| shed attempt | Work refused before provider invocation by admission or a circuit breaker. It has no provider exchange and is distinct from a completed `no-op`. |
| full sample identity | One source observation's subject kind and instance, source sample identity, category, unit, producer authority, witness source-event identity and causal head. It is preserved even when an explicit cross-instance aggregate is computed. |
| matched comparison window | A comparison whose columns each prove membership from compatible authoritative source times over the same declared window. Sharing nominal start/end fields or completing one sweep does not establish this property. |
| measurement-window aggregate | The registered derived `Measurement` subject for one family, scope, start-inclusive/end-exclusive window, dimension set, pinned frontier and evaluation clock. Its instance is the canonical digest of those inputs and its membership manifest retains every full sample identity. |
| coverage debt | The visible count and identity set of expected observations that are absent, late, unsupported or unusable for a declared population. It is an instrumentation deficit, not usage attributed to a feature. |
| grade coverage | A fraction over canonical cases, never provider attempts. Production grade coverage is the number of in-scope accepted question identities with one current usable `Grade` divided by all in-scope accepted question identities. Benchmark grade coverage is the number of planned execution identities with one current usable `Grade` divided by all execution identities planned by the run's scenario, candidate and ordinal manifest. Pending, refused, cancelled, missing, incomplete and conflicted cases remain in the denominator. Refused or cancelled cases may enter the numerator when nine supplies a current complete grade; missing, pending, incompletely graded or conflicted cases do not. A zero denominator is `undefined`. |
| hysteresis | A state rule with a stricter threshold for opening than for recovery, plus consecutive recovery windows, so small boundary movements do not repeatedly open and close an episode. |
| z-value | A policy-fixed statistical multiplier selecting the confidence level of an interval. A larger z-value makes the interval wider for the same sample. |
| Wilson half-width | The margin on either side of a Wilson estimated pass rate after sample size is considered. A larger half-width means the observed rate is less precise. |

**Rule — every window uses an owner-recorded membership time.** Rules 13, 26, 32, 33, 58
and 69; **checks: P16-NF-16/19/32/36/37/50**. Every requested window is half-open: it includes a
member whose authoritative source time equals `start` and excludes one whose source time equals
`end`. Both endpoints and the member time must be comparable `Clock` values in the declared
basis. An incomparable clock makes the result partial; append time, arrival time and the query's
evaluation clock cannot substitute for membership time. UTC is the default display basis for
ordinary hour and day slices. A provider/account policy or six-owned budget policy may instead
name another basis, which the response must display.

For every envelope-clock row below, the presentation reads `FactStatus.fact.at` from its exact
source history input. It does not ask the body-only projection for that value. The accepted-request
and prepared/dispatch bodies contain no substitute clock. The same source-history digest is pinned
beside the source-projection digest so a replay cannot combine projection bytes from one snapshot
with envelope times or status evidence from another.

| Family | Authoritative membership source | Late evidence and correction rule |
|---|---|---|
| attempt census | The `at` clock on the part-two envelope holding seven's first accepted `prepared` observation for the canonical attempt | Later dispatch, response, usage, resolution or correction facts refine the attempt but do not move its census window |
| provider exchange, model usage, price join, feature-call and model-call burn | The dispatch clock recorded by seven's first causally current `dispatch-observed` attempt phase; the fact-envelope clock is used only where the landed phase has no separate owned clock | Late response, usage, charge, attribution, grade or correction stays in the original dispatch window; an already completed earlier render remains unchanged as labelled audit evidence, while a new current read re-resolves through a fresh owner snapshot |
| production grade-coverage accepted question | The `at` clock on the part-two envelope holding seven's first accepted `JudgmentRequest` for the canonical logical key and input digest | Every accepted question is selected by acceptance time, including one that is refused, cancelled, still pending or never dispatches. A delayed first dispatch, terminal resolution or late grade changes no denominator membership |
| benchmark grade-coverage planned population | Seven's owner-issued resolution of the actual benchmark-run start as a comparable Part One `Clock`, bound to the exact `BenchmarkRunRecord` and start evidence. The addendum at the end of `seam-response-judgment.md` conditionally grants that source under `P16-P7-benchmark-run-start-clock-v1`, tracked in `SEAM-LEDGER.md` row 73; it remains unavailable until the grant lands. The landed bare numeric `startedAt` is unsupported and is never reinterpreted as UTC or another clock basis | Once the owner seam lands, the complete planned set enters one window together. A missing or never-dispatched execution remains in the denominator, while a later execution disposition, retry or grade changes no membership |
| cumulative model session, quota, resource and package-cost sample | The part-one `Measurement.at` clock on that source observation; the source sample identity also retains the snapshot or interval identity that distinguishes successive samples. A quota sample additionally retains its provider account/window identity | A causal successor corrects one identified sample at later frontiers while retaining that sample's measurement window; a different sample or snapshot time is a different quantity. A current cumulative-session read selects the causally maximal snapshot for the session rather than adding snapshots. No sample moves to its ingestion day |
| programmatic feature event | The registered event occurrence clock carried by its source `Evidence.observedAt`, not the time the collector appended it | Late collection or correction stays in the original occurrence window; an event without a comparable occurrence clock is incomplete and ineligible for burn |
| benchmark execution usage or cost sample | The dispatch clock of the benchmark attempt, under the same rule as a production exchange | Late grade or evaluation evidence changes eligibility at later frontiers but not the execution window. This row does not select the planned grade-coverage denominator |
| committed accounting | Six's stable accounting-window id and membership clock fixed when the reservation consumed capacity | Settlement, requalification, maximum disposition, restart and correction retain that original owner window; a legacy or conflicted unknown remains uncertain at maximum exposure rather than being assigned to the query day |

The committed-accounting row is not implementable from the landed `AdmissionReservation` or
`SettlementApplication`. The granted-but-unlanded addendum in `seam-response-loop-followup.md`,
tracked in `SEAM-LEDGER.md` row 34, adds `accountingWindow` to the `AdmissionAccountingView`
returned by `readAdmissionAccounting`. Its checks remain non-executable until that grant lands.
Part sixteen does not derive a money window from a reservation's authority-local tick or a later
fact's append clock.

**Rule — every quantity has one registered subject, unit and producer.** Rules 13, 26, 32, 39,
58, 69 and 75; **checks: P16-NF-03–06/09/15/24/25**. The register contains the measurement
subjects below, their allowed units, their producer adapters and their evidence requirements.
Each `Measurement.subject.instance` is an existing registered identity: a judgment attempt for
call usage, an account/window plus source snapshot for quota, a framework/session plus source
snapshot for cumulative usage, a machine plus process incarnation and source sample for
resources, or a holder/run plus source sample for the package's own cost. The family-specific
quantity key retains the sample or snapshot identity independently of witness identity.
Cross-subject addition and unregistered units refuse at decode. Evidence binds the sample to its
source observation and capture reference where one is required.

| Family | Required measurements | Required subject and evidence |
|---|---|---|
| model call | input tokens, cache-read input tokens, output tokens, provider-billed token categories, elapsed duration and call count | Seven's exact attempt id; resolved provider doorway/model/account and receipt. The relation in the registered adapter contract controls cache semantics: `subset-of-input` requires cache-read input to be no greater than total input, while an `independent-billed` cache category may accompany input that already excludes cache reads and has no subset constraint |
| cumulative model session | input, cached-input, output, reasoning-output and total tokens plus exposed quota-window percentages | Registered framework/session id and source snapshot identity; a current-total fold selects the causally maximal snapshot, never adds snapshots, and does not invent an attempt |
| money | provider-settled amount, reserved maximum liability and derived price amount, each separately labelled | Seven's attempt/hold and eight's settlement; currency and settlement source are explicit; derived amount names the price-manifest point |
| quota | used and remaining quantity when exposed, window size, reset time and collector age | Registered account, provider window and source snapshot identity; original provider observation, collector and observation time; unavailable fields remain unknown |
| rate-limit event | breaker open/recover count, session-sentinel throttle/quota/529 count and breaker trips per declared duration | Registered account/source episode and event identity; breaker and session detections are separate populations, not duplicate evidence for one event |
| resource | process CPU time, sampled wall interval, RSS bytes, process count and classified footprint RSS | Registered machine and process incarnation or machine aggregate, plus source sample identity; OS source, hardware profile and sample interval |
| package cost | scan duration, rows/bytes examined, projection lag, append failures, queue depth and storage bytes | Exact holder/run, machine and source sample identity; used to account for the observer's own resource cost |

**Rule — sample identity and aggregate compatibility are different checks.** Rules 13, 26, 32,
39 and 69; **checks: P16-NF-04/14/37**. Ordinary comparison and arithmetic retain part one's full
subject-instance check. Cross-instance addition occurs only through the registered
`aggregateMeasurements` package operation. That operation resolves a declaration mapping one
source subject kind to its `measurement-window aggregate` subject kind, additive units, allowed
dimensions and scope. It then requires equal source kind, unit, category semantics, producer
contract, currency or hardware basis where applicable, query frontier and evaluation clock. The
member instances and source sample identities may differ because that is the operation's purpose.
Successive resource observations at different sample times therefore remain different quantities
and time-series points even when their amounts are equal. Independent witnesses of the same
source sample retain one shared quantity key and are reconciled rather than added. The output instance is the
canonical digest of the aggregate scope, half-open window, dimensions, frontier and evaluation
clock. Its members are resolved quantities, not observation rows. Before arithmetic, the read
selects the current head of every observation stream, groups those heads by quantity key and
resolves at most one amount for that key. One acceptable witness supplies that amount. Multiple
compatible witnesses with equal normalized amounts supply the equal amount once. Different
amounts remain unresolved unless a causally later `Evidence` claim from the quantity's registered
owner names every competing witness and supplies the resolved amount under that producer
contract. Arrival order, source-event id, highest value and lowest value cannot choose a winner.
The membership manifest retains every contributing and disagreeing witness's full sample identity
and evidence reference even when one amount is selected. Duplicate observation keys are rejected;
different observation keys for one quantity are reconciled rather than added. Different source
sample identities are different quantities and are never reconciled merely because their subject,
category and amount match. No ordinary
same-instance comparison is weakened, and no caller may widen the registered scope merely by
asking for a pool total.

**Rule — collection is observational and failure is explicit.** Rules 14, 31, 41, 46, 58, 75,
86 and 95; **checks: P16-NF-04–08/21–23/42–46**. Adapters observe a dispatch, provider receipt,
operating-system sample or quota response and submit existing `Measurement` and `Evidence`
payloads through the requested part-four observation-intake operation. The landed conversational
`IntakePort` cannot yet accept that flow. The real operating-system producer is also unavailable:
the GRANTED CONDITIONAL process-inventory addendum in `seam-response-assembly-followup.md`, tracked
in `SEAM-LEDGER.md` row 40 and buildable only after docs/18 approval, has not landed. The same grant
file now explicitly grants `P16-P10-process-resource-observation-v1` as a conditional addendum with
the required CPU interval, RSS point and observation-state fields; `SEAM-LEDGER.md` row 63 records
that grant under the same docs/18 condition. P16-NF-24/49's production resource arms remain
non-executable until row 63 lands together with row 40 and the Four intake grant.
Collectors never call a provider, start a process, choose
an account, admit work or mutate the observed source. A rejected measurement append returns a typed result
to the adapter and raises a nine-owned instrument-health obligation. It does not rewrite the
already determined model-call or process outcome. Missing evidence is carried as missing; zero
is accepted only when the source actually reported zero.

---
