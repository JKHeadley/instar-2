## 8. Non-functional checks and activation

**Rule — activation follows the governed dependency order.** Rules 34, 43, 65, 66, 72, 73,
78, 83 and 103; **checks: P15-NF-03/08/42/45/50/52**. A job family first needs approved manifest
and feature declarations. Its package must be assembled, and every referenced port must be real.
That requirement includes every prerequisite in section 1. Supervision and verification coverage
must be present. Compatibility import must be complete. Unit, full-port integration and
production-lifecycle evidence must exist. Dark and dry-run states
remain distinct. Dry run admits challenge occurrences and records intended admission decisions but
cannot invoke the business entry point. Activation of one job cannot silently activate another.
For a model-backed family, P15-NF-52's normal production lifecycle includes ledger #23's real first
provider-call preparation and Eight-governed observation and settlement. It also includes ledger
#27's current Part Seven route. That arm is non-executable until the GRANTED
`seam-response-effects-followup.md` and `seam-response-judgment.md` land with joint evidence.
Ledger #30 joins those prerequisites only when the route is claimed measured or benchmark-supported.

The bounded-history lifecycle requires ledger #37's paged input, ledger #44's current authority,
ledger #47's verified mutation, ledger #48's Run reconstruction and ledger #54's effect
reconstruction. Those five grants are GRANTED but unlanded. Row 54 is the dated 09:23Z addendum in
`seam-response-effects-followup.md`. Rows 47 and 48 are the dated 08:38Z addenda in
`seam-response-facts-followup.md` and `seam-response-rungraph-followup.md`.

The lifecycle also requires the pending owner requests
`design-scheduled-work-seam-request-bounded-judgment-history.md`,
`design-scheduled-work-seam-request-bounded-verification-history.md` and
`design-scheduled-work-seam-request-bounded-assembly-history.md`. They cover Seven's own judgment
fold, Nine's verification and assessment fold, and Ten's assembly and growth-evidence fold. The
bounded-history arm is non-executable until all three requests are granted, entered in
`SEAM-LEDGER.md`, landed with the five existing grants and pass one instrumented joint trace.

The complete scheduled lifecycle separately requires the dated 08:38Z
`seam-response-intake-followup.md` addendum at row 49. That grant is GRANTED but unlanded. Its real
operator-surface arm also depends on the pending
`design-scheduled-work-seam-request-operator-schedule.md`. That arm is non-executable until Eleven's
requested public operations and Part Ten's production wiring land and pass their joint evidence.

**Rule — the scheduler is a held runtime outcome.** Rules 9, 38, 41, 43 and 78; **checks:
P15-NF-24/42/52**. Part nine holds the scanner, calendar expansion, intake path, reservation path,
worker path, breaker, reporting projection and notification path. Fresh proof includes an
independently originated challenge scheduled instant, actual scan on the named installation,
matching dedup identity, run admission, bounded execution or deliberate no-work result, and an
independent witness. A loaded manifest, active process, heartbeat, timer registration or self-
reported green status is insufficient. Missing or expired proof renders the affected holder stale
or unknown and blocks only consumers whose approved policy requires it.

**Rule — performance and pressure claims are measured on named subjects.** Rules 13, 39, 40, 43,
60, 61, 64 and 75; **checks: P15-NF-26/30/37/50/52**. Activation records hardware, operating
system, assembly, storage mode, time-zone data, manifest population, schedule density, concurrent
workers, provider/account class, fault schedule and sample completeness. It measures discovery-to-
admission delay, due-debt age, eligibility-to-admission duration, reservation time, run duration, recovery time, projection
rebuild, CPU, memory, bytes, tokens, money, notification volume and fairness. Failed, timed-out,
shed and missing samples stay in the population. A configured goal or successful-only percentile
is never labelled measured.

For these measurements, an interval uses one named monotonic clock on the executing machine. Its
start and end are recorded clock observations from the same producer. A cross-machine interval is
comparable only when Part One's subject-bound Clock evidence establishes a common basis and carries
the uncertainty; otherwise the sample is unknown. **Discovery-to-admission delay** starts when a
bounded scan first records the occurrence as due and ends when Part Four records its admission or
final Refused disposition. **Admission eligibility** starts when a due candidate first passes every
current non-ordering gate—standing, stop, breaker, capability, placement, quota and resource
availability—and enters the priority-class selection set. The high-priority
eligibility-to-admission interval ends when the candidate's complete Part Six reservation is
committed; time before eligibility is not charged to fairness.

**Due debt** is the population of due occurrences at the pinned frontier that still lack a durable
terminal scheduling disposition. Each occurrence starts contributing at its absolute scheduled
instant. It stops at the recorded clock of its Part Five terminal RunExit, its committed missed/no-
execution coverage disposition, or a Part Four Refused that the registered occurrence policy
explicitly accepts as final. A waiting, shed, paused, uncertain or non-finally-refused occurrence
continues contributing. At a measurement-window end, an unfinished interval is retained as a
lower-bound sample from its start through that end. A lower bound already over policy is a breach;
a lower bound at or below policy is unknown and cannot support a passing claim. Timeouts, absent end
events and clock-incomparable samples remain in the denominator.

The deployment policy supplies the following finite values before instrument or job activation.
Each value carries units, registered subject and producer, exact workload shape, sample population
and accountable part-five investigation owner. Part ten's `GrowthPolicy` and
`GrowthObservation` contract supplies the common measurement envelope; part five supplies the
owned breach Run. Missing policy, producer or complete sample refuses activation. A runtime breach
inhibits only the affected admission class, retains due work, and opens one deduplicated breach
Run; it never edits the target to make the sample pass.

| Scheduling measurement | Required declared workload and policy values | Acceptance comparison and overrun action |
|---|---|---|
| Discovery-to-admission delay and due-debt age | Name the hardware, assembly and monotonic clock producer. State retained fact and byte counts, including a corpus above 4,096 Part Six domain records. State job count and due instants per minute. Declare page item, byte, decode, hash, replay and duration bounds. State peer count, fault schedule, measurement-window end, `maxDiscoveryToAdmission` and `maxDueDebtAge`. | Each finished interval compares its recorded duration with the matching bound. Exactly at the bound passes. One clock unit over breaches. An unfinished lower bound over the limit breaches. Any other unfinished or incomparable interval is unknown and prevents a passing claim. Each owner reports its enumeration, decoding, hashing, replay, reference-resolution and memory work. After a cold restart above 4,096 records, one real occurrence must cross the bounded Part Two, Four, Five, Six, Seven, Eight, Nine and Ten paths. The trace ends only after effect settlement, Six's settlement application and release, Nine's consumed assessment, and Ten's resolved growth evidence. A candidate page, keyed view, caller filter or partial snapshot is not completion. Overrun retains the due occurrence, inhibits the affected activation or class, and opens the owned breach Run. The trace is non-executable until ledger rows 37, 44, 47, 48 and 54 land. It also requires the pending Seven, Nine and Ten bounded-history requests named above to be granted, ledgered and landed. Row 54 is the dated 09:23Z `seam-response-effects-followup.md` addendum. Row 44's keyed authority view does not supply it. The complete scheduled lifecycle separately requires the row-49 `seam-response-intake-followup.md` grant. |
| Fair service and eligibility-to-admission duration | Named class weights; nonzero `minimumMaintenanceShare`; fair-round admission count and duration; sustained arrivals per class; zero/boundary/boundary-plus-one caps; named monotonic clock producer; `maxHighPriorityEligibilityToAdmission` | Observed eligible service per completed fair round meets the declared share. Every high or critical candidate that enters the selection set contributes one eligibility-to-committed-reservation interval. Exactly the declared duration passes and one clock unit over breaches. An unfinished interval follows the lower-bound/unknown rule above. Missing, unknown or breached values inhibit the policy and open the breach Run; they cannot select strict starvation. |
| Projection rebuild | Named corpus with manifest, occurrence, Run, attempt and evidence counts plus canonical bytes; cold/warm mode; `maxProjectionRebuildDuration` and `maxProjectionRebuildMemory` | Equal-vector rebuild must be complete and byte-equal within both bounds. Timeout, partial data, divergence or bound overrun blocks the affected live projection and opens the breach Run while the fact spine remains authoritative. |

**Rule — contract-check inventory is complete and executable.** Rules 34, 36, 37, 69 and 91;
**checks: P15-NF-01/02**. The implementation test manifest must map every Rule block to at least
one check below and to its executed check-run record. P15-NF-01 through P15-NF-52 are distinct
contract checks. Shared traces may reuse one execution record when the manifest declares the
alias; duplicated labels cannot inflate coverage.

---
