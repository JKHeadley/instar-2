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
| Three | declarations, registered identifiers, governed ports, register generation, profiles, rules and check-run records |
| Four | intake port, event identity, operation classification, authorization request, original evidence custody and session-start evidence |
| Five | durable run, run step, run budget, exhaustion record, continuity accounting and delivery evidence |
| Six | lease, fence, admission reservation, spend reservation, bounded loop, recovery record and transport receipt |
| Seven | `JudgmentRequest`, `JudgmentAttemptRecord`, `BenchmarkRecord`, `BenchmarkRunRecord`, `JudgmentHoldCost` and provider receipt |
| Eight | operation definition, admitted effect, provider dispatch, settlement, freeze/cap effect and verification obligation |
| Nine | verification plan, holder, probe, assessment, grade, retention pin, finding and external protection broker |
| Ten | model, process, persistence and channel adapter ports; executable assembly; store custody; `GrowthPolicy` and `GrowthObservation` |
| Eleven | registered operator surface, scoped read, verified operator act and independently witnessed receipt |

**Value — boundary choice.** Sixteen owns the observational package and its read semantics. Seven
owns why a model was asked and the benchmark against which its result is judged. Eight owns every
action that can spend, reserve, freeze, throttle, kill or change a cap. Nine owns whether the
collectors and projections are presently adequate. Ten realizes the adapters and storage. Eleven
presents the views and operator actions. Keeping those owners separate makes a missing metric a
visible defect instead of an accidental veto or grant.

---

## 2. Vocabulary and the registered measurement plane

**Rule — package terms are narrow aliases, not hidden core concepts.** Rules 26, 49 and 69;
**checks: P16-NF-01/03/04**.

| Term | Meaning in this part |
|---|---|
| usage coverage | The ratio and counts obtained by joining every eligible model-dispatch attempt to acceptable usage evidence at one causal frontier. A zero denominator is `undefined`, not 0% or 100%. |
| unmetered model call | An eligible attempt with no acceptable usage measurement or provider settlement after its declared observation horizon. It remains an attempted call and carries unknown usage. |
| unattributed usage | Metered usage for which no registered feature, run or judgment point resolves from signed history. |
| unattributed spend | Priced or settled usage that remains unattributed. It is a subset of spend, not a feature named `unknown`. |
| price manifest | A part-three governed declaration of effective-dated billing rates, currency, token categories, billing class, subsidy basis, freshness and source. It is read-time input, not a measurement fact or gate. |
| committed liability | Seven's measured or maximum reserved hold cost plus eight's unsettled admitted settlements. It is not an estimate reconstructed from a dashboard total. |
| detail horizon | The finite time range kept in a disposable high-cardinality projection or adapter cache. It never licenses removing facts from the part-two spine. |
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
| money | provider-settled amount, reserved maximum liability and derived price amount, each separately labelled | Seven's attempt/hold and eight's settlement; currency and settlement source are explicit; derived amount names the price-manifest point |
| quota | used and remaining quantity when exposed, window size, reset time and collector age | Registered account and provider window; original provider observation, collector and observation time; unavailable fields remain unknown |
| resource | process CPU time, sampled wall interval, RSS bytes, process count and classified footprint RSS | Registered machine and process incarnation or machine aggregate; OS source, hardware profile and sample interval |
| package cost | scan duration, rows/bytes examined, projection lag, append failures, queue depth and storage bytes | Exact holder/run and machine; used to account for the observer's own resource cost |

**Rule — collection is observational and failure is explicit.** Rules 14, 31, 41, 46, 58, 75,
86 and 95; **checks: P16-NF-04–08/21–23/42–46**. Adapters observe a dispatch, provider receipt,
operating-system sample or quota response and submit existing `Measurement` and `Evidence`
payloads through part four. They never call a provider, start a process, choose an account,
admit work or mutate the observed source. A rejected measurement append returns a typed result
to the adapter and raises a nine-owned instrument-health obligation. It does not rewrite the
already determined model-call or process outcome. Missing evidence is carried as missing; zero
is accepted only when the source actually reported zero.

---

## 3. Model-call census, tokens and attribution

**Rule — the attempt census is the denominator.** Rules 39, 41, 58, 69, 75 and 86; **checks:
P16-NF-07–11**. Every route through a model boundary creates or references one seven-owned
`JudgmentAttemptRecord` before exchange. The census includes provider errors, cancellations,
timeouts, streamed partials, breaker refusals, swaps, retries admitted by six, benchmark
candidates, supervisors, background features and interactive work. A refusal before network
exchange is an attempt with no provider call. It is not counted as a real round trip. A provider
exchange is counted once even when its response is later rejected by a parser.

**Rule — one exchange has one usage join identity.** Rules 14, 32, 33, 58 and 75; **checks:
P16-NF-07–09/12–14**. The provider operation id, six's one-use claim and seven's attempt id bind
dispatch observation, token measurements, receipt and settlement. Duplicate equal observations
are idempotent. Differing observations for the same identity create `Conflict`; a projection
does not pick the largest, latest or cheapest row. Input, cache-read input, output, reasoning,
tool and provider-billed categories stay separate when the provider distinguishes them. An
adapter may map categories only through its registered conformance contract.

**Rule — coverage counts absence instead of normalizing it away.** Rules 13, 39, 41, 58, 75 and
86; **checks: P16-NF-09–11/14**. For a declared window, coverage reports eligible attempts,
network exchanges, exchanges with acceptable usage, exchanges with provider settlement,
unmetered exchanges, conflicted joins and attempts still within the observation horizon.
Coverage is partitioned by adapter artifact, provider doorway, model, account, machine, feature
and outcome. A provider mode proven by ten to expose no usage surface is labelled
`unsupported-by-adapter`; it remains in the denominator and is not treated as healthy coverage.
An error response without usage remains unknown even if successful calls from the same provider
usually report it. Unknown usage carries seven's maximum reserved liability until settlement or
an authorized disposition closes it.

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
A routing-spend read pins a causal frontier, resolves the governed price manifest and effective
point for each attempt's billing time and class, and then computes derived cost. A price
correction appends signed history and changes later reads at a later frontier; it never edits
usage. Rebuilding at the same frontier, manifest generation and query parameters produces equal
canonical rows.

**Rule — every dollar-like figure says what kind of figure it is.** Rules 13, 26, 39, 58 and 86;
**checks: P16-NF-17–20**. Each row separates provider-settled cost, manifest-derived gross cost,
subsidy or credit allocation, net derived cost, committed liability and unpriced usage. Money is
kept as exact decimal or integer minor units with an explicit currency. Totals do not add unlike
currencies. A conversion appears only with a governed exchange-rate source, effective time and
separately labelled converted total. A missing, stale, incompatible or implausible price point
produces unpriced usage and a reason; it never produces zero cost.

**Rule — provider settlement outranks estimation without erasing disagreement.** Rules 31, 33,
58, 86 and 95; **checks: P16-NF-18/19/36**. Where a provider-origin settlement covers the exact
attempt, the view reports it as settled and retains the manifest-derived amount as a comparison.
Signed drift, token-basis mismatch and unsettled amount remain visible. A subsidy, credit or
subscription allocation is a reporting adjustment with its own source and scope. It cannot
reduce eight's committed liability or reopen cap headroom.

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
unclassified judgments use seven's registered outcome and grade evidence; absence of a verdict
classifier is not a no-op. Latency percentiles name their eligible population and include
failures where duration is observable. Rates with insufficient denominators return raw counts
and `insufficient evidence`.

**Rule — benchmark comparisons join exact recorded execution.** Rules 13, 39, 64, 69, 75 and 86;
**checks: P16-NF-31/32**. The join key is the seven-owned judgment point, model doorway, prompt or
artifact digest and benchmark record identity resolved from signed history. Real production
measurements retain machine and workload identity. A benchmark target, predicted pass rate or
declared model price is never called measured. Stale benchmark evidence, prompt drift, missing
coverage, model mismatch or dominant-machine concentration makes the comparison partial or
ineligible; it cannot label a model aligned or divergent.

**Rule — burn detection is coverage-aware, active and signal-only.** Rules 39, 41, 58, 60, 75,
86 and 87; **checks: P16-NF-10–14/33–35**. A burn projection reports an absolute amount or share,
a recent activity window, a comparison baseline, eligible sample count, coverage and confidence.
The baseline needs the declared history before it can fire. A completed burst with no current
activity is not a live burn. The bucket representing instrumentation not yet run can raise a
coverage finding but cannot be accused as a spending feature. Genuinely metered yet unresolved
usage can raise an unattributed-spend finding. Threshold crossings coalesce into one episode and
close only on recorded exit evidence or authorized disposition.

**Rule — no metric decides its own remedy.** Rules 4, 24, 41, 49, 82 and 86; **checks:
P16-NF-33–35/51**. Reliability, effectiveness, benchmark drift, quota pressure, resource pressure
and burn findings are evidence submitted to part nine. They do not alter routing, models,
prompts, schedules, accounts, caps or processes. A proposed remedy becomes a part-five run or a
part-eight effect after part four resolves the requester and operation. The metric producer does
not grade its own adequacy or close the resulting verification obligation.

---

## 8. Spend caps and freeze through the effect doorway

**Rule — cap authority never comes from an observational projection.** Rules 4, 26, 40, 49, 82,
86 and 95; **checks: P16-NF-18/19/35/51**. Eight's spend operation reads the current authorized
cap policy, six's fenced reservations, seven's hold cost and eight's settlements at the required
durability state. It does not read a routing-spend total, quota bar, burn finding, cached price or
provider estimate as authority. Concurrent reservations are serialized by six's owned mechanism.
Unsettled calls retain maximum liability. A successful cap refusal is a part-one `Success`
because the protection was applied.

**Rule — changing a cap and releasing a freeze require operator authority.** Rules 28, 79, 82,
89, 98, 101 and 109; **checks: P16-NF-35/51/52**. The action begins as an exact authorization
request through part four, completes on eleven's verified surface and executes once through
eight. The rendered subject includes account or key, doorway scope, old and proposed values,
currency, time window, current base digest and consequences. Silence, chat wording, a dashboard
read, a metric threshold and a configured default are not approval. A stale base, widened scope
or replay refuses.

**Rule — freeze is a separately reachable stop effect.** Rules 15, 40, 42, 60, 77, 82 and 95;
**checks: P16-NF-35/45/51**. Eight evaluates freeze before ordinary spend admission and records
the effect independently of this package's construction. If the measurement package, price join
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

**Rule — evidence pins and lawful redaction still win.** Rules 7, 26, 44 and 100; **checks:
P16-NF-39–41/47**. Content-free accounting facts do not require prompt or response bodies.
Provider payload captures, when required by seven or nine, follow their existing custody and
retention pins. An open authorization, conflict, unsettled charge, benchmark obligation or
verification assessment prevents removal where the owning part says so. Lawful capture removal
leaves two's tombstone and does not permit replacing an unknown quantity with zero. This part
adds no fact-deletion or encryption-key-destruction path.

**Rule — every projection is rebuildable and every merge is explicit.** Rules 24, 31–33, 39,
45, 69, 95 and 113; **checks: P16-NF-14/16/36–41/50**. Additive quantities merge only after
subject, unit, currency, price basis, causal frontier and process/account identity agree.
Percentiles merge from compatible sketches or source facts, never by averaging percentiles.
Latest quota state remains per account and window. Resource samples remain per machine and
hardware profile. Coverage denominators and missing counts add. Conflicts and partial peers are
unioned and remain visible. A peer timeout produces a partial response naming the missing peer
and last admitted frontier; it never serves a pool total without that qualification.

**Value — the signed spine grows.** The constitutional design deliberately retains facts. Bounded
projection and cache retention controls working sets and disclosure, but it does not bound the
spine's physical lifetime. Part two's replay-duration instrument is the honest trigger for any
future lossless compaction design. This part declines to disguise deletion as rollup retention.

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

**Rule — the audited 1.x guarantees that remain load-bearing are preserved.** Rules 2, 39, 41,
58, 60, 75, 86 and 87; **checks: P16-NF-05–14/21–30/33/39–46**. The audit covered the named 1.x
modules and their matching operator guidance.

| 1.x module | Behavior and guarantee carried forward | Incident that earned it |
|---|---|---|
| `TokenLedger` and `TokenLedgerPoller` | Incremental source reads, source files never mutated, inode/head reuse detection, incomplete trailing lines retained, bounded scans, event-loop yields, non-overlapping ticks and bounded background backfill | A 119,000-file, 12 GB history blocked the event loop; a 202 MB ledger with about 390,000 sentinel rows made the earlier synchronous attribution backfill stall health long enough to enter a boot failure loop |
| `TokenLedger` | Schema additions precede indexes and queries that use them; migrations are idempotent; native database failure is visible and repairable | Creating the attribution index before adding its column left existing installations with `no such column` and permanent token-route unavailability |
| `TokenLedger`, `FeatureMetricsLedger` and `BurnDetector` | Missing attribution remains visible; coverage is distinct from burn; a finished burst is not an active burn; cache-read tokens remain visible but do not masquerade as fresh usage | Putting every older event in one pre-attribution bucket produced a permanent 100% burn alarm; a completed burst repeatedly produced a contradictory projected-zero burn notice for a full day |
| `FeatureMetricsLedger` | Real calls, shed calls, errors, unclassified outcomes and programmatic events remain distinct; usage-presence uses row presence rather than token sums; read models are rebuilt from raw truth | Treating calls with no verdict classifier as no-op fabricated a 0% fire rate; a large token row could otherwise hide many calls with missing usage |
| `QuotaTracker` | Stale, missing, estimated, implausible and permanently unavailable quota are distinct; unknown is never best headroom; repeated absence warns once per episode | A non-authoritative 186% estimate stopped all work; an absent file warned 902 times per day; a provider with 1.3 million observed tokens still reported 0%; account-blind allowance disagreed with placement and fed a respawn loop |
| `ResourceLedger`, `ResourceSampler` and `ProcessFootprintMonitor` | CPU/RSS/resource history is observe-only, sampled off the hot path, batched, idle-aware and bounded; slow process-count growth is measured separately from spawn bursts | Multiple full agent stacks and heavy Chromium/Electron tool servers accumulated until the host hit an `os_refcnt` kernel panic on 2026-06-26; a load-average misread also caused a false heavy-load deferral on 2026-06-19 |
| `routingSpendView` and `routingPriceAuthority` | Immutable usage is priced on read; unpriced metered usage is loud; subscription access is labelled not per-token billed; provider settlement and internal derivation remain distinct | Earlier spend surfaces could make missing price or subscription billing look like $0 per-call cost and could blur reporting totals with committed money |
| `RoutingSpendCapsStore`, `MeteredSpendGate` and `meteredCallEntry` | Cap/freeze authority is independent of reporting; reservations are bounded and atomic; freeze is checked before normal enable state; releasing money needs operator authority | A disable flag captured only at construction could remain cosmetically off while calls still admitted; placing freeze inside a failed money layer could take down the emergency brake with the machinery it must stop |

**Rule — 1.x mechanisms are re-expressed through the 2.0 core.** Rules 24, 30, 31, 33, 49, 69,
86 and 95; **checks: P16-NF-02/12/16/23/31/35–45/51**. SQLite tables, JSON quota files,
process-local maps, source-side feature tags, timer ownership and private cap stores are not
portable authorities. Measurement and evidence become part-one payloads on part two. Register
entries and declarations replace string enums and private manifests. Four admits observations.
Five and six own durable scans, cursors, leases and retry. Seven owns attempts, benchmark records
and hold cost. Eight owns settlement, caps and freeze. Nine owns instrument adequacy and signals.
Ten owns concrete adapters and persistence. Eleven owns the human read and authorization
surfaces. The provider transcript scanner may remain one adapter, but it is not the ledger.

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
| model usage | seven attempt → six claim → eight dispatch observation → ten adapter evidence → four intake → two facts → sixteen projection | Call outcome stands; missing usage stays unknown; nine owns instrument finding; seven owns unresolved attempt/hold |
| price and spend | three price declaration + usage/settlement facts → pinned read join → eleven view | Missing/incompatible price becomes unpriced; eight never consumes the view; three owns manifest repair |
| quota | provider observation → ten adapter → four intake → two facts → account/window view | Missing/stale stays unknown; no scheduling answer; nine owns collector adequacy |
| resources | OS observation on named machine → ten adapter → four intake → two facts → machine view/finding | Missing sample breaks completeness; no kill or throttle; ten repairs adapter and nine assesses |
| benchmark | seven benchmark/run records + production attempt measurements → pinned compatible join → nine advisory finding | Stale/mismatched/under-covered comparison is ineligible or partial; seven owns benchmark evidence |
| cap/freeze | operator act through eleven/four → one authorization → eight effect using six reservations and seven/eight money facts → settlement/receipt | Measurement outage does not block stop; stale/replayed/widened authority refuses; eight owns effect settlement |

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
   outage. The independent operator freeze path still executes through eight, and later rebuild
   reconciles observations without unfreezing anything.

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
| P16-NF-06 | Adapter conformance proves collectors only observe and submit through intake; a source mutation, provider invocation or hidden effect fails. |
| P16-NF-07 | Callsite census and production assembly test prove every model exchange path creates one seven-owned attempt, including swaps, failures, benchmarks and supervisors. |
| P16-NF-08 | Kill/fault cuts before dispatch, after provider acceptance, during streaming, after receipt and before usage append preserve one call identity and honest unknown outcome. |
| P16-NF-09 | Provider fixtures preserve input, cache-read, output, reasoning, tool and billed categories; subset and non-negative invariants reject invalid mappings. |
| P16-NF-10 | Coverage test derives the denominator from the attempt census, includes errors and unsupported usage surfaces, and renders a zero denominator undefined. |
| P16-NF-11 | Missing usage never becomes zero; the attempt retains unknown usage and maximum reserved liability until valid settlement or owned disposition. |
| P16-NF-12 | Attribution test mutates the usage row's feature/model/machine labels and proves the view uses signed run, attempt and register history instead. |
| P16-NF-13 | No-match and multi-match fixtures render unattributed and conflicted usage separately from named-feature totals. |
| P16-NF-14 | Equal duplicate observations are idempotent; unequal observations produce `Conflict` and cannot be selected by latest/largest/cheapest policy. |
| P16-NF-15 | Price-manifest decoder rejects overlapping effective ranges, missing currency/billing class/source, invalid category semantics and unregistered doorway/model ids. |
| P16-NF-16 | A correction changes only reads pinned after its signed fact; rebuilds at an earlier frontier stay byte-equal and stored usage bytes remain unchanged. |
| P16-NF-17 | Missing, stale, implausible or incompatible prices produce labelled unpriced usage; subscription calls never render as free or per-call settled. |
| P16-NF-18 | Exact-money property tests cover rounding boundaries, large totals and mixed currencies without binary floating authority or cross-currency addition. |
| P16-NF-19 | Provider settlement remains separate from derived gross/subsidy/net and committed liability; credit changes cannot reopen cap headroom. |
| P16-NF-20 | Subscription allocation, when enabled, shows its exact formula and sums once at its declared scope; disabling it returns unknown call cost, not zero. |
| P16-NF-21 | Quota fixtures preserve account, window, source, observed/reset times and freshness and distinguish stale, corrupt, missing and unsupported. |
| P16-NF-22 | Unknown quota never sorts as best headroom or becomes 0%/100%; missing-state notification load coalesces once per episode. |
| P16-NF-23 | Static and integration tests prove no quota or measurement projection exports or feeds an allow/place/throttle decision. |
| P16-NF-24 | Resource conformance records named hardware, OS adapter, monotonic interval and process incarnation; unnamed or wall-clock-only CPU samples refuse. |
| P16-NF-25 | CPU/RSS tests prove one-core versus whole-machine normalization, interval arithmetic, byte units and heap unsupported-state semantics. |
| P16-NF-26 | PID reuse, dead PID, permission denial and partial process-list fixtures create new incarnation or missing samples, never zero-valued continuity. |
| P16-NF-27 | A limit-plus-one process census uses one bounded batch/page plan, marks truncation and never creates a per-PID spawn storm. |
| P16-NF-28 | Classifier fixtures resolve registered process classes and preserve unmatched relevant counts without storing command lines or environment data. |
| P16-NF-29 | Trend tests reject windows with missing ticks, hardware/classifier changes or insufficient samples and accept a complete named window. |
| P16-NF-30 | Feature rollups keep real exchanges, refusals, errors, parser failures, events and unclassified outcomes distinct and never infer no-op from missing classifier. |
| P16-NF-31 | Benchmark join requires exact judgment point, model doorway, artifact/prompt digest and benchmark identity from signed history. |
| P16-NF-32 | Benchmark comparison rejects targets as measurements and marks stale, drifted, under-covered or machine-dominated populations partial/ineligible. |
| P16-NF-33 | Burn tests cover current-activity floor, cold-start history, amount/share thresholds, sample floor, hysteresis and one episode notification. |
| P16-NF-34 | Pre-instrumentation absence raises coverage debt but no culprit ranking; genuinely metered unresolved usage raises unattributed-spend evidence. |
| P16-NF-35 | Architecture and e2e tests prove every finding is advisory and every remedy, cap change or freeze crosses the owned intake/effect/authorization path. |
| P16-NF-36 | Every view pins frontier/register/price generations; same inputs rebuild equal while later lawful facts can change only later reads. |
| P16-NF-37 | Pool merge property tests enforce compatible subject/unit/currency/basis identities and derive percentiles from mergeable source data, never averaged percentiles. |
| P16-NF-38 | Peer loss and clock-skew tests return local plus admitted peers with missing-peer/last-frontier labels; no response claims a complete pool total. |
| P16-NF-39 | Projection/cache/detail horizons are declared and enforced while canonical measurement, evidence, attempt, settlement and conflict facts remain on the spine. |
| P16-NF-40 | Open evidence pins prevent owned capture removal; lawful removal leaves a tombstone and cannot change unknown usage into zero. |
| P16-NF-41 | Retention work is row/byte/time bounded, off-hot-path and replay-equivalent; interruption resumes without skipped identities. |
| P16-NF-42 | Each configured holder must emit fresh independent running proof; file/table/process/config-only fixtures remain unavailable. |
| P16-NF-43 | Loop tests enforce one live tick, finite page, cursor, lease, backoff, attempt ceiling and no stacked timer callbacks. |
| P16-NF-44 | Restart tests resume durable backfill/reconcile work from an admitted cursor and preserve open coverage and instrument-health obligations. |
| P16-NF-45 | Append refusal and uncertain receipt are surfaced, observed before retry and never converted to an empty-success result or hidden by catch-and-continue. |
| P16-NF-46 | Load tests measure scanner/projector CPU, RSS, processes, I/O, duration, queue and storage on each supported hardware class and enforce declared budgets. |
| P16-NF-47 | Privacy fixtures reject prompt/response bodies, command lines, environment values, secrets and unrelated identities from default facts and surfaces. |
| P16-NF-48 | Query tests enforce finite windows, dimensions, pages, sort work and export bytes; timeout returns a pinned partial result or typed refusal without full-scan fallback. |
| P16-NF-49 | Unit, integration and production-lifecycle tests prove every required port delegates to a real implementation and every registered surface reports honest availability. |
| P16-NF-50 | Corrupt projection/checkpoint/index, kill at adjacent append/fold boundaries and full genesis rebuild all converge to equal pinned outputs or a visible defect. |
| P16-NF-51 | Isolation tests prove measurements, views, price caches, quota snapshots and findings cannot admit spend, alter caps, freeze/unfreeze, route, retry, reap or mutate standing. |
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
| storage growth | sustained maximum admitted call/resource rate plus package self-measurement | measured fact and projection growth published separately; projection horizons hold; spine growth reopens part two's loop at its threshold |

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
| P16-NF-06 | conformance | Collector mutates source or invokes work; observe-and-submit adapter passes |
| P16-NF-07 | census | Swap/error/benchmark/supervisor exchange lacks one attempt; complete one-to-one census passes |
| P16-NF-08 | fault | Kill window loses identity or duplicates exchange; one honest attempt/outcome passes |
| P16-NF-09 | provider | Token category collapses or cache exceeds input; faithful mapped categories pass |
| P16-NF-10 | accounting | Errors/unsupported calls leave denominator or zero denominator becomes a percentage; complete counts/undefined pass |
| P16-NF-11 | accounting | Missing usage becomes zero/free or releases liability; unknown plus maximum hold passes |
| P16-NF-12 | provenance | Usage row self-label controls feature/model/machine; signed-history resolution passes |
| P16-NF-13 | join | No/multi match hides in a named bucket; unattributed/conflicted rows pass |
| P16-NF-14 | replay | Unequal duplicate is silently chosen; equal idempotence or explicit `Conflict` passes |
| P16-NF-15 | decode | Price ranges overlap or omit currency/basis/source; valid governed point passes |
| P16-NF-16 | rebuild | Price correction rewrites usage or changes earlier frontier; later read-only change passes |
| P16-NF-17 | honesty | Missing price/subscription renders free; unpriced/not-per-call-settled passes |
| P16-NF-18 | arithmetic | Float drift, implicit rounding or mixed currency total accepts; exact scoped totals pass |
| P16-NF-19 | authority | Derived/credited amount replaces settlement/liability; separated comparison passes |
| P16-NF-20 | policy | Subscription allocation double-counts or hides formula; once-scoped labelled formula passes |
| P16-NF-21 | quota | Account/window/source/time is missing or stale reads current; complete fresh observation passes |
| P16-NF-22 | quota | Unknown becomes best/0% or emits 902 notices; unknown and episode coalescing pass |
| P16-NF-23 | architecture | Quota view exports allow/place/throttle; observational read only passes |
| P16-NF-24 | resource | CPU lacks hardware/interval/incarnation; named monotonic sample passes |
| P16-NF-25 | resource | CPU normalization or byte unit is ambiguous; declared arithmetic passes |
| P16-NF-26 | lifecycle | Reused/dead PID continues old series or reads zero; new incarnation/missing passes |
| P16-NF-27 | load | Per-PID fork storm or unmarked truncation; bounded batch with omitted count passes |
| P16-NF-28 | privacy | Unknown process is dropped or command/env stored; count-only unclassified passes |
| P16-NF-29 | trend | Gapped/mixed window claims a trend; compatible complete window passes |
| P16-NF-30 | semantics | Shed/error/unclassified/event becomes real no-op call; distinct outcomes pass |
| P16-NF-31 | benchmark | Name-only or self-reported benchmark join accepts; exact signed identities pass |
| P16-NF-32 | evidence | Target/stale/drifted/small sample claims measured alignment; ineligible/partial passes |
| P16-NF-33 | signal | Finished burst/cold baseline chatters; active mature deduped episode passes |
| P16-NF-34 | attribution | Pre-instrumentation bucket is blamed as feature; coverage debt passes |
| P16-NF-35 | authority | Finding directly changes route/cap/process; admitted owned effect passes |
| P16-NF-36 | consistency | Query has moving frontier/generation; pinned reproducible read passes |
| P16-NF-37 | merge | Unlike units/currencies or averaged percentiles merge; compatible fold passes |
| P16-NF-38 | partition | Missing peer vanishes from complete total; named partial horizon passes |
| P16-NF-39 | retention | Detail prune deletes source facts or hides horizon; disposable view prune passes |
| P16-NF-40 | retention | Open pinned capture disappears or tombstone becomes zero; owned preservation passes |
| P16-NF-41 | load | Prune monopolizes hot path or skips after interruption; bounded resumable pass succeeds |
| P16-NF-42 | liveness | File/table/config/process proves alive; fresh independent probe passes |
| P16-NF-43 | loop | Ticks overlap or retry without bound; leased finite loop passes |
| P16-NF-44 | recovery | Restart loses cursor/open debt; durable resumed work passes |
| P16-NF-45 | failure | Append refusal is swallowed as empty success; typed uncertainty and later observation pass |
| P16-NF-46 | performance | Observer cost is omitted or exceeds budget unnoticed; named self-measurement passes |
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
| Token and usage accounting | **Held:** one attempt census, category-preserving measurements, coverage, conflicts and unknown-liability behavior are pinned by P16-NF-07–14. |
| Per-feature model-call and spend accounting | **Held:** attribution re-resolves through signed run/judgment history and every total retains unattributed/conflicted amounts, P16-NF-12–20/30. |
| Price manifests joined on read | **Held:** governed effective points never rewrite usage; settlement, derivation, subsidy, subscription allocation and unpriced usage remain separate, P16-NF-15–20/36. |
| Quota ledger | **Held as observation:** account/window provenance and unknown states are complete; scheduling authority is deliberately re-expressed through earlier owners, P16-NF-21–23/35/51. |
| CPU, memory and process footprint | **Held:** named hardware/incarnations, bounded sampling, classification loss and observer self-cost are covered by P16-NF-24–29/46. |
| Burn and routing-spend views | **Held:** activity, baseline, coverage, pinned joins, partial peers and signal-only disposition are covered by P16-NF-33–38. |
| Benchmark connection | **Held:** exact compatible production attempts join seven's benchmark records; stale, drifted and under-covered comparisons cannot conclude, P16-NF-31/32. |
| Bounded retention | **Held within constitutional limits:** detail projections, caches and workers are finite and rebuildable; source facts remain on two's spine and open pins are honored, P16-NF-39–41. |
| Spend caps and freeze | **Held by the claimed split:** observations stay read-only; operator-authorized cap/freeze actions and money settlement remain eight-owned and independently reachable, P16-NF-35/51/52. |
| Holder and activation proof | **Held:** fresh independent running proof, durable loops, all three test tiers and production wiring are required by P16-NF-42–50/52. |

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

**Value — burn policy.** Should burn thresholds be one universal package default, a per-feature
policy, or deployment-specific values approved after a measured baseline? I recommend
deployment-specific values with per-feature overrides only where a named risk justifies them.
The signal should ship observed before any notification policy is approved.

**Value — quota presentation.** For providers with no advance-usage surface, should the primary
view say unknown, show only locally observed tokens, or estimate a percentage from plan limits?
I recommend unknown beside locally observed tokens. An estimated percentage invites operators to
read an invented denominator as provider headroom.

**Value — spine growth.** Is the permanent signed accounting history acceptable until part two's
measured replay-duration trigger reopens a lossless compaction design, or should this part remain
unapproved until such a design exists? I recommend accepting the permanent spine with published
growth measurements and finite projections. Deleting facts privately would be a worse and less
honest answer.

**Rule — technical completion is not approval or certification.** Rules 34, 65, 80, 82, 90 and
109; **checks: P16-NF-49/52** and the governed review process. This document claims no deployment,
runtime measurement, review convergence, holder adequacy or operator approval. Implementation
becomes eligible only after the real three-tier, production-lifecycle, reconstruction,
isolation, privacy, load and independent-holder evidence exists. The operator's answers above and
explicit approval remain separate from every technical pass.

---

*Depends on: the approved rules, register, glossary, big-picture design, and parts one through
eleven, especially parts one, two, seven, nine, ten and eleven, and their changelogs.*
