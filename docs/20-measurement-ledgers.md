**Status: draft, awaiting approval. Governed.**

# Part sixteen — the measurement and spend ledgers

**Value — purpose.** The operator should be able to ask what Instar consumed, what it cost, what
work caused it, and how confident the answer is without turning observation into permission.
This part makes token, quota, resource, feature-call and spend history one inspectable package
over the signed record. It also makes missing metering visible. A model call that cannot be
accounted for is not made cheap by the absence of a number.

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
| Three | `Declaration`, registered identifiers, `GovernedPort`, register generation, profiles, rules and check-run records |
| Four | `IntakePort`, event-id authority, operation classification, authorization request, original evidence custody and session-start evidence |
| Five | `Run`, `RunStep`, `RunBudget`, `ExhaustionRecord`, `ContinuityAccounting` and `DeliveryEvidence` |
| Six | `Lease`, `FenceToken`, `AdmissionReservation`, spend reservation, `SettlementApplication`, `LoopPolicy`, `LoopRecord`, `RecoveryRecord` and transport receipt |
| Seven | `JudgmentRequest`, `JudgmentAttemptRecord`, `BenchmarkRecord`, `BenchmarkScenario`, `BenchmarkRunRecord`, `JudgmentHoldCost` and provider receipt |
| Eight | `OperationDefinition`, `EffectRequest`, `OperationObservation`, `EffectSettlement` and verification obligation |
| Nine | `VerificationPlan`, `ProbeRecord`, `VerificationAssessment`, `Grade`, `BenchmarkEvaluation` and the existing retention/protection contracts |
| Ten | `ModelAdapterPort`, process, persistence and channel adapter ports; executable assembly; store custody; `GrowthPolicy` and `GrowthObservation` |
| Eleven | registered operator surface, scoped read, verified operator act and independently witnessed receipt |

**Value — boundary choice.** Sixteen owns the observational package and its read semantics. Seven
owns why a model was asked and the benchmark against which its result is judged. Eight owns every
action that can spend, reserve, freeze, throttle, kill or change a cap. Nine owns whether the
collectors and projections are presently adequate. Ten realizes the adapters and storage. Eleven
presents the views and operator actions. Keeping those owners separate makes a missing metric a
visible defect instead of an accidental veto or grant.

**Rule — approved owner contracts and landed implementations are reported separately.** Rules 26,
30, 49 and 69; **checks: P16-NF-02/06/09/15/35/49/51**. The design may depend on an approved
owner contract, but activation also requires its public landed decoder, port and production
wiring. The following prerequisites are not implemented by this package and cannot be replaced by
private types or prose conventions.

| Owner prerequisite | Approved design position | Landed public contract at this head | P16 consequence and filed seam |
|---|---|---|---|
| Three: governed price and exchange-rate manifests | Three owns declarations, strict decoding, approval and entering-force generations | The closed declaration union has no effective-dated price or exchange-rate payload | P16-NF-15 is unimplementable, and P16-NF-16–20/36 cannot activate, until `design-measurement-ledgers-seam-request-declarations.md` lands |
| Four: measurement-observation intake | Four owns authenticated intake, event identity and original custody | `IntakePort` exposes `receive`, `recover` and `expireHolds` for conversational/stop intake only | P16-NF-03/04/06/08/21/24/42/44/45/49 ingestion arms depend on `design-measurement-ledgers-seam-request-intake-observations.md` |
| Seven: `JudgmentHoldCost` | Seven defines the hold-cost meaning and producer | `JudgmentRecord` and its landed decoder omit it; the slice manifest calls cohort/queue hold metrics out of scope | P16-NF-03/04/11/49 hold-cost arms remain unavailable until `design-measurement-ledgers-seam-request-judgment-hold-cost.md` lands |
| Eight: cap/freeze effects | Eight owns effect payloads, validation, invocation and settlement | `EffectRequest` and `OperationAdapterPort.invoke` accept only `OutboundMessage`; there is no cap/freeze/unfreeze payload | P16-NF-35/45/49/51 cap/freeze arms depend on `design-measurement-ledgers-seam-request-spend-control-effects.md` |
| Ten: provider usage categories | Ten realizes `ModelAdapterPort`; seven records its receipt | `ProviderObservation.usage` is exactly input tokens, output tokens, charge and source; extra category fields are rejected | P16-NF-03/04/09/10/14/49 category arms depend on `design-measurement-ledgers-seam-request-model-usage.md` |

---

## 2. Vocabulary and the registered measurement plane

**Rule — package terms are narrow aliases, not hidden core concepts.** Rules 26, 49 and 69;
**checks: P16-NF-01/03/04**.

| Term | Meaning in this part |
|---|---|
| proven no-exchange attempt | A canonical attempt whose evidence proves refusal or cancellation before provider invocation. It is retained in the attempt census but is not a provider exchange. |
| observed exchange | A canonical attempt with evidence that a provider invocation occurred, whether it completed, failed, streamed partially or returned unusable output. |
| dispatch-uncertain attempt | A canonical attempt whose one-use claim was consumed but whose available evidence proves neither provider invocation nor pre-invocation refusal. It is neither silently promoted to an exchange nor dropped. |
| usage-supported exchange | An observed exchange with current acceptable usage evidence for every category its registered adapter contract says it reports; a metered exchange may validly report zero. |
| usage coverage | For a pinned window, `usage-supported exchanges / observed exchanges`. Proven no-exchange and dispatch-uncertain attempts are displayed separately and enter neither term. A zero exchange denominator is `undefined`, not 0% or 100%. |
| pending evidence | An observed or dispatch-uncertain attempt still inside its declared evidence horizon; retained in counts and excluded from an overdue rate until the horizon ends. |
| overdue evidence | An observed or dispatch-uncertain attempt past its declared horizon without the evidence needed to resolve its category. `overdue / past-horizon observed-or-uncertain attempts` is reported separately from usage coverage. |
| unmetered model call | An observed exchange past its evidence horizon with no acceptable usage observation. It remains a real exchange and carries unknown usage. |
| unattributed usage | Metered usage for which no registered feature, run or judgment point resolves from signed history. |
| unattributed spend | Priced or settled usage that remains unattributed. It is a subset of spend, not a feature named `unknown`. |
| price manifest | The requested part-three governed declaration of effective-dated billing rates, currency, token categories, billing class, subsidy basis, plausibility policy, freshness and source. Until that seam lands this is a prerequisite, not an existing declaration kind. |
| settled spend | The exact charge in six's latest current `SettlementApplication` for each operation whose eight-owned settlement is final; each canonical operation contributes once. |
| outstanding exposure | The unreleased conservative exposure in six's current accounting state for an operation without final releasable accounting, including an authorized maximum write-off; it is not seven's observational hold metric. |
| committed window total | `settled spend + outstanding exposure` after unioning canonical operation identities and selecting each operation's one current six-owned accounting state. |
| detail horizon | The finite time range kept in a disposable high-cardinality projection or adapter cache. `High-cardinality` means that key count grows with attempts, observations or process incarnations rather than a fixed category roster. The horizon never licenses removing spine facts. |
| PID | A reusable operating-system process number and lookup locator, never process identity by itself. |
| RSS | Resident set size: bytes the named OS adapter reports resident for the named process incarnation at the sample instant, subject to that adapter's documented accounting limits. |
| observation stream | The exchange, measurement category, producer authority and source-event identity whose causal heads describe one quantity through partial, final and correction phases. |
| cumulative-session usage | A provider/framework total for one registered session whose later snapshot replaces the earlier current snapshot. It is aggregate evidence with `per-call attribution unsupported` unless an independent exact attempt mapping exists. |
| routing-spend view | A disposable projection that joins usage and settlement history to price manifests and attribution history at read time. It is not a money ledger or cap authority. |

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
usually report it. Outstanding exposure remains in six's accounting state until a current
`SettlementApplication` releases or resolves it.

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
owner-issued manifest decoder and effective point for each attempt's billing time and class, and
then computes derived cost. A price correction appends signed history and changes later reads at
a later frontier; it never edits usage. Rebuilding at the same frontier, manifest generation and
query parameters produces equal canonical rows. P16-NF-15 is unimplementable until that seam
lands; dependent checks remain declared rather than falsely held.

**Rule — every dollar-like figure says what kind of figure it is.** Rules 13, 26, 39, 58 and 86;
**checks: P16-NF-17–20**. Each row separates provider-settled cost, manifest-derived gross cost,
subsidy or credit allocation, net derived cost, committed window total and unpriced usage. Money is
kept as exact decimal or integer minor units with an explicit currency. Totals do not add unlike
currencies. A conversion appears only through the requested part-three exchange-rate declaration,
with its effective time and a separately labelled converted total. A point is implausible exactly
when its exact rate is below the manifest's inclusive `minimumRate`, above its inclusive
`maximumRate`, or, when configured, its ratio to the causally prior current point is greater than
the inclusive maximum-step ratio. Equality at a bound is valid. Missing bounds, a zero prior rate
for a ratio test or another incomparable prior point yield `insufficient policy`, not implausible. A missing, stale, incompatible,
implausible or insufficient-policy point produces unpriced usage and a reason; never zero cost.

**Rule — provider settlement outranks estimation without erasing disagreement.** Rules 31, 33,
58, 86 and 95; **checks: P16-NF-18/19/36**. Eight supplies the current supported settlement;
six alone applies it and owns `SettlementApplication` history. The view unions canonical operation
ids, selects each operation's current causally valid six-owned accounting state and includes it
once: a final application's exact charge contributes settled spend, while an unresolved
application or reservation contributes outstanding exposure. The committed window total is the
sum of those disjoint per-operation amounts. A partial settlement later refined to final replaces
that operation's current accounting contribution; an equal application replay adds nothing; a
conflicting application makes the total partial. An actual charge above reservation is recorded
in full with `capViolation`, never clipped. An authorized maximum write-off converts the maximum
to settled spend without reducing the committed total or manufacturing headroom. Seven's
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
69, 86 and 113; **checks: P16-NF-10/17–20/36–38/48**. Hour, day, feature, model, doorway, account,
machine, benchmark and run slices derive from the same pinned joins. Every response includes the
causal frontier, register and price-manifest generations, requested and available time ranges,
coverage counts, partial peers, conflicts, projection folded-through vector, last successful
rebuild and whether settlement is final. A reporting total and an authoritative committed
liability are never collapsed into one number.

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
75 and 86; **checks: P16-NF-07–10/30**. A real provider exchange, a pre-exchange refusal, a
provider error, a parser failure and a programmatic event are different rows. Fired, no-op and
unclassified judgments use seven's judgment outcome evidence and nine's `Grade`; absence of a verdict
classifier is not a no-op. Latency percentiles name their eligible population and include
failures where duration is observable. Rates with insufficient denominators return raw counts
and `insufficient evidence`.

**Rule — benchmark comparisons consume seven's compatibility identity and nine's grades.** Rules
13, 39, 58, 69, 75 and 86; **checks: P16-NF-31/32**. Seven supplies the exact compatibility
identity: judgment class, prompt and context assembly digests, action-floor and output-schema
digests, model plus relevant settings, and evaluation-contract digest. Nine supplies `Grade` and
`BenchmarkEvaluation` evidence at the pinned frontier. A production comparison is `eligible` only
when all compatibility fields match, the scenario class and observation window match, every
included Grade is complete and conflict-free under the same criterion version, the current route
still has measured support, sample count is at least `minimumSamples`, grade coverage is at least
`minimumCoverage`, maximum single-machine share is at most `maximumMachineShare`, and every
evidence age is strictly less than `maximumEvidenceAge`. Equality satisfies the first three
inclusive thresholds; equality at the age endpoint is stale under nine's freshness convention.

The versioned comparison policy fixes those values and a binary mapping from the chosen Grade
dimension before the population is read. For `x` mapped passes among `n` complete cases and the
policy's fixed z-value `z`, Wilson confidence has
`center=(x/n+z²/(2n))/(1+z²/n)` and
`half=z*sqrt((x/n)*(1-x/n)/n+z²/(4n²))/(1+z²/n)`; the interval is
`[center-half, center+half]`. No mapping, zero population or missing fixed z-value yields
`insufficient evidence`, not a percentage. A population below a
sample, coverage or concentration threshold is `partial`. A compatibility, criterion, freshness,
conflict, completeness or current-support failure is `ineligible`. Only `eligible` may report a
comparison; all statuses retain raw numerator, denominator, machine shares and missing reasons.
Real production measurements retain machine/workload identity. Targets, predicted rates and
declared prices are never measured. The policy and its threshold values are deployment-selected
Value choices; their decision boundaries are fixed here.

**Rule — burn detection has a versioned, coverage-aware hysteresis algorithm.** Rules 39, 41, 58,
60, 75, 86 and 87; **checks: P16-NF-10–14/33–35**. A burn policy fixes before evaluation the
current window, preceding baseline windows, registered amount unit, minimum eligible samples,
minimum usage coverage, entry excess/share thresholds, lower recovery excess/share thresholds
and required consecutive recovery windows. Source observations are canonically deduplicated.
`currentAmount` is the compatible named feature amount in the current window;
`baselineAmount` is the median of complete compatible preceding windows (the middle sorted value,
or the exact arithmetic mean of the two middle values for an even count);
`excess = max(0, currentAmount - baselineAmount)`; and `share = currentAmount / all compatible
metered current-window amount`, undefined when that denominator is zero. The confidence status is
`adequate` exactly when sample count and coverage meet their inclusive minima and the current and
baseline populations are complete; otherwise it is `insufficient evidence`, with raw counts.

A closed episode enters when there is current activity, confidence is adequate, and both excess
and share are greater than or equal to their entry thresholds. An open episode recovers only after
the configured number of consecutive adequate windows have both excess and share less than or
equal to their recovery thresholds. Values between entry and recovery retain prior state. A zero
current amount is `inactive` and closes the episode on that recorded window, so a completed burst
is not live. An insufficient window neither opens nor closes an episode. The instrumentation-not-
yet-run bucket raises coverage debt but cannot be a culprit; genuinely metered unresolved usage
may raise unattributed-spend evidence. One threshold episode produces one notification and one
part-five investigation run; six's one bounded loop governs follow-through.

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
Unsettled calls retain maximum exposure. When capacity enforcement prevents an unsafe start, the
paid business operation remains its own part-one `Refused` with reason `budget-exhausted` (or
`frozen`). Only the separate control operation that applied the cap/freeze may return `Success`.
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
Rebuilding from the same pinned frontier forgets the same projection identities in the same
order. A projection horizon must not be presented as the beginning of recorded history.

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
view derive counts, money, coverage denominators or percentiles. Additive values also require
matching subject, unit, currency, price basis, query frontier and process/account identity. This
part chooses source-fact aggregation: percentiles are computed from the deduplicated compatible
source observations, never from averaged peer percentiles or an unspecified sketch. Money uses
each operation's one current six-owned accounting state. Latest quota remains per account/window;
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
41, 58, 60, 75, 86, 87 and 111; **checks: P16-NF-05–14/21–30/33/39–46**. The audit covered the
named 1.x modules and their matching operator guidance; typed distinctions required by 2.0 but
collapsed in 1.x are corrections below, not carried-forward guarantees.

| 1.x module | Behavior and guarantee carried forward | Incident that earned it |
|---|---|---|
| `TokenLedger` and `TokenLedgerPoller` | Claude transcripts use incremental offsets, source files are read-only, identity/head changes reset safely, scans yield and poller ticks do not overlap. Codex rollouts take a separate whole-file path: the last cumulative per-session total is upserted by session id, replacing prior totals rather than adding them; cached input, output, reasoning output and primary/secondary quota percentages stay separate. Repeated identical and growing snapshots must therefore remain one session row. Codex cumulative rows are intentionally absent from Claude `token_events`, `summary()` and `BurnDetector`; aggregate Codex visibility is not per-exchange coverage or burn attribution. Sources: `TokenLedger.ts` schema/upsert and `ingestCodexSession`, `TokenLedgerPoller.ts`, `CodexRolloutParser.ts`. | A 119,000-file, 12 GB history blocked the event loop; a 202 MB ledger with about 390,000 sentinel rows made synchronous attribution backfill stall health into a boot failure loop. The 2.0 correction is a registered cumulative-session subject or an explicit unsupported-attribution limitation, never promotion of cumulative snapshots into invented calls. |
| `TokenLedger` | Schema additions precede indexes and queries that use them; migrations are idempotent; native database failure is surfaced through the existing availability path | Creating the attribution index before adding its column left existing installations with `no such column` and permanent token-route unavailability |
| `TokenLedger`, `FeatureMetricsLedger` and `BurnDetector` | Missing attribution remains visible; coverage is distinct from burn; a finished burst is not an active burn; cache-read tokens remain visible but do not masquerade as fresh usage | Putting every older event in one pre-attribution bucket produced a permanent 100% burn alarm; a completed burst repeatedly produced a contradictory projected-zero burn notice for a full day |
| `FeatureMetricsLedger` | Real calls, shed calls, errors, unclassified outcomes and programmatic events remain distinct; usage-presence uses row presence rather than token sums; read models are rebuilt from raw truth | Treating calls with no verdict classifier as no-op fabricated a 0% fire rate; a large token row could otherwise hide many calls with missing usage |
| `QuotaTracker` | `getState()` returns `null` for missing or stale files, so those conditions collapse at its public state result even though warnings differ. On corrupt/unreadable JSON it clears cache and returns `null` for Codex, but for non-Codex frameworks it can return the prior cached Claude state. `shouldSpawnSession()` then applies framework-dependent behavior: Codex unknown sheds fail-safe, most missing non-Codex data fail open, non-authoritative/implausible estimates use bounded degraded handling, and the separately injected pool-placeability path has its own unknown rules. Job scheduling occurs only because callers invoke that method; the observation itself does not schedule. Source: `QuotaTracker.ts:getState/shouldSpawnSession/evaluateAccountQuota`. The 2.0 design requires typed missing/stale/corrupt/unsupported observations rather than claiming 1.x already exposes them. | A non-authoritative 186% estimate stopped all work; an absent file warned 902 times per day; a provider with 1.3 million observed tokens still reported 0%; account-blind allowance disagreed with placement and fed a respawn loop |
| `ResourceLedger`, `ResourceLedgerPoller`, `ResourceSampler` and `ProcessFootprintMonitor` | The SQLite ledger durably records breaker `circuit-open`/`circuit-recover` separately from session-sentinel `throttle`/`quota`/`529`; summaries expose counts, first/last time and breaker trips/hour. Event identity is `source:timestamp:process-local-sequence`: same-process same-millisecond emissions remain distinct and an equal identity is ignored, but sequence resets on restart, so a repeated timestamp/sequence can collide and must not be overstated as a cross-restart identity guarantee. CPU/RSS history is observe-only and bounded. Sources: `ResourceLedger.ts:eventId/recordRateLimitEvent/rateLimitSummary/rateLimitByKind` and `ResourceLedgerPoller.ts:start`. | Multiple full agent stacks and heavy Chromium/Electron tool servers accumulated until the host hit an `os_refcnt` kernel panic on 2026-06-26; a load-average misread caused false heavy-load deferral on 2026-06-19. The 2.0 fixture must cover two same-ms events, equal replay, restart collision and durable restart recovery. |
| `routingSpendView` and `routingPriceAuthority` | Immutable usage is priced on read; unpriced metered usage is loud; subscription access is labelled not per-token billed; provider settlement and internal derivation remain distinct | Earlier spend surfaces could make missing price or subscription billing look like $0 per-call cost and could blur reporting totals with committed money |
| `RoutingSpendCapsStore`, `MeteredSpendGate` and `meteredCallEntry` | Cap/freeze authority is independent of reporting; reservations are bounded and atomic; freeze is checked before normal enable state; releasing money needs operator authority | A disable flag captured only at construction could remain cosmetically off while calls still admitted; placing freeze inside a failed money layer could take down the emergency brake with the machinery it must stop |

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
| price and spend | requested three manifest + usage + eight settlement → six `SettlementApplication` → pinned read join → eleven view | Missing/incompatible price is unpriced; each operation contributes one current six-owned state; three owns manifest repair |
| quota/rate limits | provider or breaker/sentinel observation → ten adapter → requested four observation intake → two facts → account/window/source view | Missing/stale stays unknown; breaker and session events stay separate; no scheduling answer; nine owns collector adequacy |
| resources | OS observation on named machine → ten adapter → requested four observation intake → two facts → machine view/finding | Missing sample breaks completeness; no kill or throttle; ten repairs adapter and nine assesses |
| benchmark | seven compatibility identity/run records + nine `Grade`/`BenchmarkEvaluation` + production measurements → pinned eligible join → nine advisory finding | Mismatch/staleness/conflict/current-support failure is ineligible; threshold shortfall is partial; seven and nine repair their owned evidence |
| growth | ten `GrowthPolicy` + `GrowthObservation` → one coalesced episode → one five investigation under six loop → optional proposed part-two storage change | Observation never deletes facts; ten owns measurement, five/six own follow-through, two owns any later storage design |
| cap/freeze | operator act through eleven/four → one authorization → requested eight control payload using six's current accounting → settlement/receipt | Measurement outage does not block stop; stale/replayed/widened authority refuses; eight owns effect settlement; unavailable until its seam lands |

**Rule — four failure traces have exact answers.** Rules 14, 24, 31, 33, 41, 42, 46 and 86;
**checks: P16-NF-08/10/14/17/22/26/38/42/45/50/51**.

1. A provider returns output but no usage. The attempt and output outcome remain. Coverage records
   one unmetered exchange, spend remains unpriced or at maximum liability, and reconciliation
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

**Rule — the complete contract-check list is executable.** Rules 13, 34, 36, 39, 43, 55, 60,
69, 75, 86 and 113; **checks: P16-NF-01–52**.

| Check | Executable contract |
|---|---|
| P16-NF-01 | Governed-doc lint and architecture inventory prove the required structure, owner table, duties, decisions and exactly one P16 check sequence with no gaps or duplicates. |
| P16-NF-02 | Dependency lint rejects a new core schema, private earlier-part import, retry loop, standing resolver, effect executor or register bypass in the package. |
| P16-NF-03 | Register build resolves every measurement subject, unit, producer, projection, holder, surface and bidirectional dependency; one missing or stale id fails activation. |
| P16-NF-04 | Decoder fixtures reject wrong subject kind, instance namespace, unit, clock, producer or evidence binding and accept the realistic registered neighbor. |
| P16-NF-05 | Measurement rendering refuses the word measured for a target, estimate, configured threshold or unnamed hardware/workload and accepts recorded execution evidence. |
| P16-NF-06 | After the part-four observation seam lands, adapter conformance proves collectors only observe and call that public intake operation; source mutation, provider invocation, conversation masquerade or direct fact append fails. |
| P16-NF-07 | Callsite census and production assembly test prove every model exchange path creates one seven-owned attempt, including swaps, failures, benchmarks and supervisors. |
| P16-NF-08 | Kill/fault cuts preserve one exchange identity and honest unknown outcome; repeated and growing Codex cumulative-session snapshots replace one registered session total, never add calls or enter exchange coverage/burn without attribution. |
| P16-NF-09 | Blocked on the part-ten usage-category seam: once landed, provider fixtures preserve input, cache-read/cache-write, output, reasoning, tool and billed categories; zero, unsupported, not-reported, subset and non-negative cases remain distinct. |
| P16-NF-10 | Coverage tests distinguish proven no-exchange, observed exchange and dispatch-uncertain attempts; use only observed exchanges for usage coverage, past-horizon observed/uncertain attempts for overdue rate, retain pending and unsupported rows, and render zero denominators undefined. |
| P16-NF-11 | Missing usage never becomes zero; the attempt retains unknown usage and maximum reserved liability until valid settlement or owned disposition. |
| P16-NF-12 | Attribution test mutates the usage row's feature/model/machine labels and proves the view uses signed run, attempt and register history instead. |
| P16-NF-13 | No-match and multi-match fixtures render unattributed and conflicted usage separately from named-feature totals. |
| P16-NF-14 | Observation-stream fixtures prove partial→final and late-charge causal refinement replaces the current head, equal replay is idempotent, and incompatible same-key or competing concurrent corrections produce `Conflict`. |
| P16-NF-15 | Unimplementable until the requested part-three manifest kinds and public decoders land; then reject overlaps, missing currency/class/source, invalid categories, unregistered ids and below/equal/above plausibility boundaries as specified. |
| P16-NF-16 | A correction changes only reads pinned after its signed fact; rebuilds at an earlier frontier stay byte-equal and stored usage bytes remain unchanged. |
| P16-NF-17 | Missing, stale, implausible or incompatible prices produce labelled unpriced usage; subscription calls never render as free or per-call settled. |
| P16-NF-18 | Exact-money property tests cover rounding boundaries, large totals and mixed currencies without binary floating authority or cross-currency addition. |
| P16-NF-19 | Six applies each supported eight settlement once: unknown, partial, final, duplicate, above-reservation and authorized-maximum-writeoff fixtures keep settled spend, outstanding exposure and committed total disjoint; credits and seven hold metrics cannot create headroom. |
| P16-NF-20 | Subscription allocation, when enabled, shows its exact formula and sums once at its declared scope; disabling it returns unknown call cost, not zero. |
| P16-NF-21 | Quota fixtures preserve account, window, source, observed/reset times and freshness and distinguish stale, corrupt, missing and unsupported. |
| P16-NF-22 | Unknown quota never sorts as best headroom or becomes 0%/100%; missing-state notification load coalesces once per episode. |
| P16-NF-23 | Static and integration tests prove no quota or measurement projection exports or feeds an allow/place/throttle decision. |
| P16-NF-24 | Resource conformance records named hardware, OS adapter, monotonic interval and process incarnation; rate-limit fixtures also preserve breaker versus session source, two same-ms events, equal replay, restart/collision and counts/rates; unnamed samples refuse. |
| P16-NF-25 | CPU/RSS tests prove one-core versus whole-machine normalization, interval arithmetic, byte units and heap unsupported-state semantics. |
| P16-NF-26 | PID reuse, dead PID, permission denial and partial process-list fixtures create new incarnation or missing samples, never zero-valued continuity. |
| P16-NF-27 | A limit-plus-one process census uses one bounded batch/page plan, marks truncation and never creates a per-PID spawn storm. |
| P16-NF-28 | Classifier fixtures resolve registered process classes and preserve unmatched relevant counts without storing command lines or environment data. |
| P16-NF-29 | Trend tests reject windows with missing ticks, hardware/classifier changes or insufficient samples and accept a complete named window. |
| P16-NF-30 | Feature rollups keep real exchanges, refusals, errors, parser failures, events and unclassified outcomes distinct and never infer no-op from missing classifier. |
| P16-NF-31 | Benchmark join requires seven's full judgment-class, prompt/context, floor/schema, model/settings and evaluation-contract compatibility identity plus nine's Grade/Evaluation at the pinned frontier. |
| P16-NF-32 | One eligible control passes; negatives changing only floor, context, setting, criterion or current route support become ineligible, while below/equal/above sample, coverage and machine-share boundaries yield the specified partial/eligible statuses and Wilson confidence. |
| P16-NF-33 | Burn tests cover cold baseline, zero current activity, insufficient data, below/at/above entry, separate below/at/above recovery thresholds, consecutive recovery windows and exactly one notification/investigation per episode. |
| P16-NF-34 | Pre-instrumentation absence raises coverage debt but no culprit ranking; genuinely metered unresolved usage raises unattributed-spend evidence. |
| P16-NF-35 | Architecture/e2e tests prove findings advisory and remedies owner-routed; after the eight seam lands, unsafe paid work is `Refused budget-exhausted` while only the distinct cap/freeze control subject may be `Success`. |
| P16-NF-36 | Every view pins frontier/register/price generations; same inputs rebuild equal while later lawful facts can change only later reads. |
| P16-NF-37 | Pool merge properties union canonical source ids before all counts, money and percentiles: fully overlapping replicas equal one replica, disjoint replicas add, incompatible identities conflict, and unlike subject/unit/currency/basis refuses. |
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
| P16-NF-49 | Unit, integration and production-lifecycle tests prove every required landed port delegates to a real implementation; each filed seam remains unavailable until its owner decoder/port and real wiring exist. |
| P16-NF-50 | Corrupt projection/checkpoint/index, kill at adjacent append/fold boundaries and full genesis rebuild all converge to equal pinned outputs or a visible defect. |
| P16-NF-51 | Isolation tests prove measurements/views/caches/findings cannot admit spend, alter caps, freeze/unfreeze, route, retry, reap or mutate standing; once the eight seam lands, only its exact payload may perform cap/freeze controls. |
| P16-NF-52 | Independent review records executed positive and negative evidence for every P16 check; absent evidence prevents held/live claims and operator approval remains separate. |

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
classification and pure folds. Integration tests use real part-two persistence, part-four intake,
part-seven attempts/benchmarks, part-eight effects and part-nine assessments under fault cuts.
Production-lifecycle tests start the real assembly, execute real bounded provider and OS samples
on named hardware, rebuild views, query eleven's surfaces and prove freeze isolation. Part nine
records holder freshness and semantic adequacy. Mocks, configured routes, database existence and
document lint cannot make the package live.

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
| P16-NF-07 | census | Swap/error/benchmark/supervisor exchange lacks one attempt; complete one-to-one census passes |
| P16-NF-08 | fault | Kill window loses exchange identity or cumulative Codex snapshot adds calls; one honest attempt and replace-in-place session total pass |
| P16-NF-09 | provider | Until ten's seam lands, category support stays unavailable; afterward collapsed/absent/zero/subset-invalid categories refuse and faithful mappings pass |
| P16-NF-10 | accounting | Refusal enters exchange denominator, uncertain dispatch disappears, pending becomes overdue early or zero denominator becomes a percentage; exact disjoint sets pass |
| P16-NF-11 | accounting | Missing usage becomes zero/free or releases liability; unknown plus maximum hold passes |
| P16-NF-12 | provenance | Usage row self-label controls feature/model/machine; signed-history resolution passes |
| P16-NF-13 | join | No/multi match hides in a named bucket; unattributed/conflicted rows pass |
| P16-NF-14 | replay | Partial plus final double-counts or late charge conflicts automatically; causal refinement/equal replay pass and competing corrections conflict |
| P16-NF-15 | decode | Check is unavailable before three's seam; afterward overlap/missing fields/out-of-bound point refuses while equality at plausibility bound passes |
| P16-NF-16 | rebuild | Price correction rewrites usage or changes earlier frontier; later read-only change passes |
| P16-NF-17 | honesty | Missing price/subscription renders free; unpriced/not-per-call-settled passes |
| P16-NF-18 | arithmetic | Float drift, implicit rounding or mixed currency total accepts; exact scoped totals pass |
| P16-NF-19 | authority | Hold plus settlement, partial plus final or duplicate application double-counts; one current six-owned state per operation passes, including full over-bound charge and max write-off |
| P16-NF-20 | policy | Subscription allocation double-counts or hides formula; once-scoped labelled formula passes |
| P16-NF-21 | quota | Account/window/source/time is missing or stale reads current; complete fresh observation passes |
| P16-NF-22 | quota | Unknown becomes best/0% or emits 902 notices; unknown and episode coalescing pass |
| P16-NF-23 | architecture | Quota view exports allow/place/throttle; observational read only passes |
| P16-NF-24 | resource | CPU lacks hardware/interval/incarnation or rate events collapse breaker/session, same-ms or restart cases; named sample and source-bound durable events pass |
| P16-NF-25 | resource | CPU normalization or byte unit is ambiguous; declared arithmetic passes |
| P16-NF-26 | lifecycle | Reused/dead PID continues old series or reads zero; new incarnation/missing passes |
| P16-NF-27 | load | Per-PID fork storm or unmarked truncation; bounded batch with omitted count passes |
| P16-NF-28 | privacy | Unknown process is dropped or command/env stored; count-only unclassified passes |
| P16-NF-29 | trend | Gapped/mixed window claims a trend; compatible complete window passes |
| P16-NF-30 | semantics | Shed/error/unclassified/event becomes real no-op call; distinct outcomes pass |
| P16-NF-31 | benchmark | Name-only or partial compatibility accepts; exact seven identity plus nine Grade/Evaluation passes |
| P16-NF-32 | evidence | Floor/context/settings/criterion/support mismatch or boundary error claims alignment; exact eligible, partial and ineligible statuses pass |
| P16-NF-33 | signal | Cold/insufficient/finished burst opens, equality misclassifies or hysteresis chatters; exact entry/recovery and one episode investigation pass |
| P16-NF-34 | attribution | Pre-instrumentation bucket is blamed as feature; coverage debt passes |
| P16-NF-35 | authority | Finding changes route/cap/process, message impersonates control or control Success replaces paid-work Refused; distinct owner path/subjects pass after eight's seam |
| P16-NF-36 | consistency | Query has moving frontier/generation; pinned reproducible read passes |
| P16-NF-37 | merge | Full replicas double totals, overlaps add, or percentiles average; canonical union deduplicates overlap and adds disjoint source observations |
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
| P16-NF-49 | wiring/e2e | Null/no-op/test-only port appears live; production delegation evidence passes |
| P16-NF-50 | fault | Corrupt cache/checkpoint serves drift; genesis equality or visible defect passes |
| P16-NF-51 | isolation | Metric/view/cache can spend, route, freeze or grant; eight-owned effect boundary passes |
| P16-NF-52 | governance | Unearned check/live/approval claim appears; independent evidence and separate operator act pass |

---

## 15. Inherited duties and disposition

**Rule — no inherited duty remains parked.** Rules 8, 49, 69 and 71; **checks:
P16-NF-01/03/49/52**.

| Duty | Disposition |
|---|---|
| Token and usage accounting | **Held at the join contract, activation blocked in part:** one attempt census, exact coverage sets, refinement/conflict and unknown-exposure behavior are pinned by P16-NF-07–14; expanded categories wait on the four/ten seams. |
| Per-feature model-call and spend accounting | **Held at the read contract:** attribution re-resolves through signed history and totals retain unattributed/conflicted amounts, P16-NF-12–20/30; priced output waits on part three. |
| Price manifests joined on read | **Declared, not implementable yet:** the effective-point and arithmetic contract is specified, but P16-NF-15 and dependent activation wait on the part-three manifest seam. |
| Quota ledger | **Held as observation:** account/window provenance and unknown states are complete; scheduling authority is deliberately re-expressed through earlier owners, P16-NF-21–23/35/51. |
| CPU, memory and process footprint | **Held at the measurement contract, activation blocked in part:** named hardware/incarnations, bounded sampling, rate-event identity and observer self-cost are covered by P16-NF-24–29/46; admission waits on part four. |
| Burn and routing-spend views | **Held at the algorithm contract:** activity, baseline, exact coverage, hysteresis, pinned joins, overlap-safe peers and signal-only disposition are covered by P16-NF-33–38; priced arms wait on part three. |
| Benchmark connection | **Held:** exact seven compatibility plus nine `Grade`/`BenchmarkEvaluation` evidence controls eligibility; stale, mismatched and threshold-short populations cannot conclude, P16-NF-31/32. |
| Bounded retention | **Held within constitutional limits:** detail projections, caches and workers are finite and rebuildable; source facts remain on two's spine and open pins are honored, P16-NF-39–41. |
| Spend caps and freeze | **Declared owner split, not landed:** observations stay read-only; cap/freeze actions remain eight-owned, and P16-NF-35/45/49/51 wait on the requested effect seam. |
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

**Value — benchmark comparison policy.** What minimum complete sample count, Grade coverage,
maximum single-machine share, evidence age and Wilson confidence level should each deployment
approve before a comparison becomes eligible? I recommend per-judgment-class policies calibrated
from measured workloads, with no universal fallback. The algorithm and equality boundaries in
section 7 are fixed; only these policy values remain an operator choice.

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
