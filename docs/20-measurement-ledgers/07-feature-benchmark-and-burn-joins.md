## 7. Feature, benchmark and burn joins

**Rule — feature-call metrics distinguish execution from outcomes.** Rules 13, 26, 39, 41, 58,
75 and 86; **checks: P16-NF-07–10/30**. A real provider exchange, a shed pre-exchange attempt, a
provider error, a parser failure and a programmatic event are different rows. Each feature
registers the action predicate and evidence mapping used by its feature outcome classifier.
`fired` requires current evidence that the declared action occurred. `no-op` requires the
classifier to run over complete, conflict-free evidence and prove that action did not occur.
Missing, incomplete or conflicted classification is `unclassified`, not `no-op`. Seven's
judgment result and nine's `Grade` are inputs to the mapping, not the classes themselves. A
duration percentile is the time at or below which the stated percentage of eligible calls
finished. Every displayed duration percentile names that eligible population and includes
failures where duration is observable.
Rates with insufficient denominators return raw counts and `insufficient evidence`.

**Rule — grade coverage counts canonical cases, not attempts or surviving results.** Rules 13,
39, 58, 69, 75 and 86; **checks: P16-NF-31/32**. The production denominator is every canonical
seven-owned accepted question identity in the comparison's matched scenario class and observation
window at the pinned frontier. Canonical identity is the accepted `JudgmentRequest` logical key
and input digest after seven's deduplication; conflicting content stays conflicted. Provider
attempts, swaps and retries underneath that question do not add denominator members. Refused,
defaulted, cancelled and still-unsettled accepted questions remain members. The production
numerator contains a member only when nine supplies one causally current, complete,
conflict-free `Grade` for that question's sealed `BenchmarkRecord` under the comparison's exact
criterion version. A superseded grade contributes nothing; competing current grades leave the
member ungraded and conflicted. A grade may validly assess a refused, defaulted or cancelled
question, so disposition alone does not exclude a member from the numerator.

The benchmark denominator is the complete planned identity set derived from seven's sealed
`BenchmarkRunRecord`: for every declared scenario version, every declared candidate and every
ordinal from zero through that candidate's declared sample count minus one, the tuple
`(benchmark run, scenario version, candidate, ordinal)` is one member. Every completed, refused,
cancelled and missing planned execution stays in that denominator. The benchmark numerator
contains a member only when its recorded execution has one causally current, complete,
conflict-free nine-owned `Grade` under the exact criterion and the current
`BenchmarkEvaluation` includes that grade without changing the planned set. Extra retries under a
planned execution remain attempts, not new planned members. Unexpected extra execution tuples are
reported but enter neither numerator nor denominator. Each fraction reports its raw identity set,
numerator, denominator, missing/refused/cancelled/pending/conflicted counts and reasons. A zero
denominator is `undefined`; it cannot meet any numeric coverage floor.

**Rule — benchmark comparisons consume seven's compatibility identity and nine's grades.** Rules
13, 39, 58, 69, 75 and 86; **checks: P16-NF-31/32**. The landed seven/ten slice cannot yet supply
an eligible positive comparison. Its benchmark records expose a claimed `compatibilityDigest`,
not an owner-resolved full tuple, while the current `ModelDescription` permits only
`measured:false` and construction rejects any other value. P16 does not interpret that digest as
proof and does not create a route-support authority. P16-NF-31/32 stay outside the runnable
foundation tranche. They are non-executable until the grants in `seam-response-judgment.md` and
`seam-response-assembly-followup.md` land with the eligible positive control. P16-NF-32's
benchmark-window arm additionally remains non-executable until the
`P16-P7-benchmark-run-start-clock-v1` addendum at the end of
`seam-response-judgment.md`, tracked in `SEAM-LEDGER.md` row 73, lands; the landed numeric
`startedAt` is not a comparable clock.

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
| Coverage floors | Production coverage uses accepted-question identities and benchmark coverage uses planned `(run, scenario version, candidate, ordinal)` identities as defined above; both values are at least their inclusive `minimumCoverage`. |
| Concentration ceiling | Maximum single-machine production share is at most the inclusive `maximumMachineShare`. |
| Freshness | Every evidence age is strictly less than `maximumEvidenceAge`; equality at the endpoint is stale under nine's convention. |

Seven owns the compatibility and bounded benchmark-run identity checked by P16-NF-31. Nine owns
complete grades, benchmark evaluation and the advisory conclusion checked by P16-NF-32. Six owns
the single analysis lease and full bounded loop specified by P16-NF-43; that loop check is
non-executable until `seam-response-loop-followup.md` item #25 lands. Sixteen owns only the
pinned, overlap-safe read join. Missing peers remain a P16-NF-38 partial result, never an
alignment claim.

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

Every comparison also segments each population's usable grades by the current Part One
`Evidence.strength` values resolved from the grades' cited evidence: proof, observation,
attestation and inference. It separately identifies the grading rule and grading method from
Nine's current `Grade` criterion, plan version, grader and grading `Decision`, with the matching
`BenchmarkEvaluation` criterion. A legacy strength, rule or rung from 1.x is retained only as a
labelled legacy classification and never silently promoted to a current class. The read reports
the count and share whose evidence is controlled by the interested party, including whether every
settled grade is such a self-report, and states that attestation/self-report or inference does not
provide independent support for that segment. No headline pass rate may blend evidence-strength
classes. Thus equal numerators, denominators and Wilson intervals can still carry materially
different evidence limitations, which P16-NF-32 tests explicitly.
Real production measurements retain machine/workload identity. Targets, predicted rates and
declared prices are never measured. The policy and its threshold values are deployment-selected
Value choices; their decision boundaries are fixed here.

**Value — comparison display profiles.** The tentative profile requires at least 10 production
cases and 10 benchmark cases with current complete, conflict-free grades, at least 25% grade
coverage in each population, no more than 80% of production
cases from one machine, evidence younger than 30 days and the policy multiplier for a 90%
confidence interval. The ready-to-publish profile requires at least 100 such cases in each
population, at least 90% grade coverage in each population, no more than 50% of production cases
from one machine, evidence younger than 14 days and the policy multiplier for a 95% confidence
interval. Section 16 decision 4 chooses whether the tentative profile is shown at all. Only the
ready-to-publish profile may support a primary or published claim.

**Rule — burn detection has a versioned, coverage-aware hysteresis algorithm.** Rules 39, 41, 58,
60, 75, 86 and 87; **checks: P16-NF-10–14/33–35**. A burn policy fixes before evaluation the
current window, every preceding baseline window, the included model-exchange and programmatic-
event sources, their required collectors, exactly one burn amount selection for each activity
source, minimum eligible samples, minimum usage coverage, entry excess/share thresholds, lower
recovery excess/share thresholds and required consecutive recovery windows. Each selection names
either one registered quantity or one registered derivation, including its source categories,
subset treatment, exact formula, output unit and missing-category result. No selection, several
selections for one source or an output unit different from the policy unit refuses before a
population is read. Source observations are canonically deduplicated.

For each window, the eligible sample set is exactly the union of the named feature's
usage-supported observed exchanges for which the model-source selection yields one compatible
observed amount and its registered programmatic events for which their source selection yields one
compatible observed amount. `eligibleSampleCount` is the cardinality of that union after canonical
identity deduplication, quantity-witness resolution and amount derivation. It is scoped to the
named feature, not to all features, attempts, categories or ledger rows. Input and output
quantities on one exchange can feed one derivation but still produce one sample and one selected
amount. Two equal compatible witnesses for one input quantity produce one derivation input. Two
disagreeing witnesses for that quantity produce no eligible sample until their registered owner
supplies the resolution described in section 2; both witnesses and the coverage debt remain
visible. Two different exchange identities remain two samples. A source-reported derived zero
amount remains an eligible sample. An unmetered exchange, absent required derivation input,
dispatch-uncertain attempt or conflicted event is not an eligible sample and remains visible in its
own population.

The exact same selection version and arithmetic apply to the named feature in the current and
every baseline window and to every feature in the comparison-scope denominator. A read may not use
input alone for the current window, input plus output for the baseline or gross usage for the
denominator. A selection labelled `fresh model usage` excludes cache reads under the registered
adapter relation and includes cache-write or cache-creation consumption once. The derivation reads
every registered input-category relation before doing arithmetic. A cache-read category marked
`subset-of-input` is subtracted from total input. A cache-read category marked
`independent-billed` is excluded and is not subtracted. A cache-write or cache-creation category
marked `independent-billed` is added once. A cache-write or cache-creation category marked
`subset-of-input` is already present in total input and is not added again. Output is then added
under its registered relation. Thus total input 100, cache-read 80 as `subset-of-input`,
cache-write 20 as `subset-of-input` and output 10 yields `100 - 80 + 10 = 30`. Exclusive input
20, cache-read 80 as `independent-billed`, cache creation 40 as `independent-billed` and output 10
yields `20 + 40 + 10 = 70`, which preserves the audited 1.x fresh-token metric. A required
cache-write category reported as numeric zero contributes zero and still proves presence. An
absent, `not-reported` or `unsupported` cache-write category required by the registered derivation
yields no compatible amount; it never supplies an implicit zero. The original input, cache and
output categories and their relations remain visible in every representation. These category
relations and expanded-cache neighbors are non-executable until the granted additive usage-
category contract in `seam-response-assembly-followup.md` lands. The landed input/output-only
neighbor remains executable.

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
programmatic feature event in the policy scope. It also requires affirmative no-exchange evidence
for every relevant attempted dispatch: every attempt is a proven no-exchange attempt, with no
dispatch-uncertain or conflicted attempt. Merely enumerating a consumed but unresolved claim does
not prove inactivity. Its usage percentage is undefined because there was no exchange.
That window is `inactive` and closes an open episode immediately as an explicit exception to the
consecutive-window rule. A metered zero-amount exchange is activity, not this exception.
A window with no observed exchange or programmatic event but at least one dispatch-uncertain
attempt retains the open episode, resets the recovery counter, raises coverage debt and displays
the unresolved claim and missing no-exchange evidence. A proven pre-invocation refusal or
cancellation is the neighboring evidence that may satisfy the inactive predicate.

A complete window with one or more eligible samples whose source-reported compatible amounts sum
to zero is `zero-metered-activity`. Its `currentAmount` and `excess` are zero. When the
comparison-scope denominator is positive, its share is the defined value zero; if every other
adequacy condition holds, it participates in the ordinary entry and consecutive-recovery
comparisons and may advance or complete recovery. For example, two eligible zero samples for the
named feature beside 20 compatible units from another feature give denominator 20 and share zero.
Only when the entire comparison-scope denominator is zero is share undefined; then a closed
episode cannot enter, while an open episode stays open and resets its consecutive-recovery counter
because the window cannot prove a share at or below the recovery threshold. It raises no coverage
debt when its census and collectors are complete. The same zero-looking window with incomplete
census or collector evidence remains `incomplete`.
A census- and collector-complete window below its sample or applicable usage-coverage floor is
`insufficient-evidence`, not incomplete. Both states raise coverage debt, retain an open episode
and reset the consecutive-recovery counter. Neither supplies a recovery window.

A closed episode otherwise enters when there is current activity, confidence is adequate, and
both excess and share are greater than or equal to their entry thresholds. An open episode with
defined share recovers only after the configured number of consecutive adequate windows have both
excess and share less than or equal to their recovery thresholds. Values between entry and
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
