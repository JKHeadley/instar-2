## 6. Recovery, crash-loop control, and honest reporting

**Rule — recovery uses the one loop and one identity.** Rules 8, 24, 46, 55, 61, 68 and 92;
**checks: P15-NF-21/23/24/46**. Retry, delayed observation, quota wait, lease takeover, worker
replacement, notification delivery and crash recovery use part six's LoopPolicy and LoopRecord.
Observation and worker replacement preserve the original Run, step, attempt and operation
identities. A permitted fresh invocation preserves the logical Run and step but uses seven's new
attempt and six's new linked operation after complete settlement of the predecessor. Backoff,
attempt limit, deadline, resource budget, next wake and exhaustion destination are durable.
Restart does not reset them. An operator retry is a separately admitted event and cannot erase the
earlier uncertain Run or bypass its execution and charge settlement.

**Rule — crash-loop pausing is a durable circuit state.** Rules 26, 42, 55, 60 and 88;
**checks: P15-NF-46/47/48**. A registered breaker policy evaluates accepted Run outcomes within a
declared **causal window**. At a pinned frontier, Part Six first consumes Part Two's current view
after causally effective corrections and retractions. It then takes the maximal accepted outcome facts in the remaining
partial order as one causal cohort, removes that whole cohort, and repeats until it has selected
the policy's last `N` cohorts or exhausted the family. Every concurrent fact at the oldest selected
boundary stays in the window; a fold sort or timestamp never chooses one. `N`, the counted outcome
classes, correction/retraction rules and failure threshold are immutable policy fields. A
correction replaces its target only when it is causally effective at the pinned frontier. A
retraction removes its target only under the same condition. Concurrent incompatible correction,
retraction or outcome testimony is contested; it remains visible and inhibits automatic breaker
closing until its owner resolves it. Thus equal frontiers produce equal membership and result
under every delivery permutation.

The breaker can count failures, spawn refusals, early terminal failures and repeated resource
exhaustion, while distinguishing no-work, operator cancellation, capacity-applied inhibition and
timeouts with unresolved effects. A cohort containing both counted success and counted failure
contributes both; failure is not erased by its concurrent success. A half-open episode closes only
when its required accepted outcomes are causally effective and no cohort in the policy's selected
causal window contains a counted failure or contested member. This is the only automatic closure
predicate; trial success does not replace or narrow that window. Crossing the failure threshold
inhibits new ordinary
executions for that job and records one pause episode with supporting Run ids. It does not disable
the manifest, rewrite history, classify a timeout as harmless, or reset because work moved
machines. This behavior is non-executable until the GRANTED `seam-response-loop-breaker.md` and
`seam-response-loop-followup.md`, GRANTED at `SEAM-LEDGER.md` row 33 but unlanded, land; the landed
`stub-closed` policy supplies no such breaker state.

**Rule — pausing stops waste without deleting the duty.** Rules 8, 14, 46, 55 and 88;
**checks: P15-NF-47/48/49**. While the breaker is open, due ticks still enter intake and receive
durable paused, nonterminal Run transitions. **Half-open** means the open breaker admits only its
declared finite trial count after cooldown while all ordinary executions remain inhibited. Every
accepted trial outcome enters the same causal-cohort window used by the closure predicate above. A
counted failure reopens the episode. A success closes it only when the selected window has the
required accepted outcomes and contains no counted failure or contested member. If the finite trial
allowance ends without satisfying that predicate—including when one successful trial leaves the
triggering failure inside a two-cohort window—the episode returns to `open-breaker`, records the
unsatisfied closure evidence, and persists the policy's bounded next cooldown wake or verified-
operator-action obligation. It never remains half-open without an owned next action and never gains
extra trials. The breaker follows part six's bounded half-open and recovery policy,
or waits for a verified operator action when policy requires one. Essential observation, emergency
stop, diagnosis and breaker probe work use their separately reserved minimal capacity and cannot
be paused by the failing job. A critical job has an explicit approved fail direction; a hardcoded
never-pause list is not authority.

**Rule — every due occurrence is reportable as fact.** Rules 26, 41, 42, 87 and 89;
**checks: P15-NF-20/31/38/48/50**. The part-eleven schedule projection joins current signed
manifest history, part-four intake receipts, part-five runs, part-six reservations and loops,
part-seven supervision, part-eight settlements and part-nine assessments. It exposes pending,
admitted, running, waiting, no-work, coalesced, shed, paused, refused, failed, uncertain and
completed cases with reasons and source references. It shows actual machine, framework, model,
billing lane, measured use and evidence freshness when known. Missing facts remain unknown. A
record's own `status`, `lastRun`, `nextScheduled`, percentage or success string is never accepted as
authority without re-resolution against its owners' signed history.

**Rule — notification is quiet but loss is never silent.** Rules 52, 53, 54, 87, 88 and 106;
**checks: P15-NF-49/50**. Routine successful and no-work occurrences remain pull-first. One
episode-scoped aggregate reports persistent shedding, pause, repeated failure, overdue uncertainty,
exhaustion, invalid manifests, dead holders and undelivered prior alerts to the configured alert
destination. Delivery uses Part Eight's granted `infrastructure-notice` payload, which carries
infrastructure provenance and the causal episode rather than impersonating an agent or operator.
Part Ten's granted confined notice driver accepts only that decoded payload and the current Part Six
one-use claim. Delivery records attribution and receipt stage, retries within a finite budget, and
keeps unsent status visible. A missing sink or failed send cannot mark the alert delivered or hide
the underlying run. P15-NF-49 is non-executable until both
`seam-response-effects-payloads.md` and `seam-response-assembly-followup.md` land and pass their
infrastructure-notice and confined-driver acceptance evidence.

---
