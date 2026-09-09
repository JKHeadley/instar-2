## 11. Operator decisions and honest limits

**Value — operator decision: missed-work policy.** Should a recurring job that missed several
instants execute once for the latest missed group or record all as missed without execution?
Options are `latest` and `none`; both retain one durable disposition per occurrence. The
recommendation is `latest` for maintenance and observation jobs, with `none` required for
time-sensitive sends or effects whose usefulness expires.

**Value — operator decision: local-time behavior.** Should repeated local wall times choose the
earlier instant, the later instant, or create both occurrences? The recommendation is the earlier
instant, paired with a visible missed disposition for nonexistent wall times. It best matches the
ordinary meaning of one daily calendar duty while keeping behavior deterministic.

**Value — operator decision: unknown-quota posture.** Should ordinary model jobs with unknown but
not known-exhausted quota inhibit only low priority, inhibit low and medium, or refuse all new model
work? The recommendation is to inhibit low priority, retain finite exposure for medium and high work,
and require separate evidenced reserve for critical work. Known short-window walls always refuse.

**Value — operator decision: fairness envelope.** Which service share and delay should the
selected admission policy deliver under the declared saturation workload? Option A guarantees
maintenance at least 10 percent of eligible admissions and limits eligibility-to-admission time for
ready critical work to 30 seconds. Option B uses 20 percent and 60 seconds. Option C uses 25 percent and 120
seconds. The recommendation is B: it gives maintenance a meaningful floor
without presenting starvation or an unbounded delay as an admissible policy.

**Value — operator decision: breaker recovery.** Should an opened job breaker recover only after
verified operator action, or allow one bounded half-open probe after its cool-down? The
recommendation is a single half-open probe for reversible and observation-only jobs, and verified
operator action for irreversible or authority-changing jobs. Neither option suppresses due-tick
accounting or diagnosis. A successful probe still must satisfy the same selected causal-window
closure predicate; it does not erase a triggering failure that remains in that window.

**Value — operator decision: compatibility horizon.** A **release train** is one published Instar
version together with the finite migration window in which that version is rolled across all
supported installation cohorts; the next train starts at the next published version. Should 1.x
job definitions remain readable for one release train, two release trains, or indefinitely? The
recommendation is two release trains with a one-way importer, preserved source bytes, an explicit
residue report, and no dual runtime authority. Indefinite live compatibility would preserve the
split-brain manifest and claim mistakes this design removes.

**Value — honest limits and costs.** Calendar correctness still depends on the selected time-zone
data and clock source. Exactly-once scheduling cannot prove exactly-once external effects. A total
loss of the required durable fact replicas can lose obligations within the declared loss model.
Opaque providers can leave quota, charge, or execution unresolved. Strong fencing and source-aware
capacity reduce availability during partitions and telemetry outages. Complete occurrence history,
independent probes, model supervision and retained uncertainty consume storage, latency and money.
No check decides that those costs are worthwhile for every installation.

**Rule — technical completion is not approval or runtime certification.** Rules 34, 65, 82, 90
and 109; **checks: P15-NF-02/52** and the governed review process. This document claims no
deployment, live holder, measured performance, review convergence or operator approval.
Implementation becomes eligible only after this exact design independently converges and the
operator records approval. Implementation does not itself establish a live claim. Activation and
runtime certification then require section 8's real unit, full-port integration, multi-machine,
fault-cut, load, isolation, semantic-review and production-lifecycle evidence. Approval is separate
from both technical construction and live evidence.

*Depends on: Part one — constitutional values; Part two — the fact envelope; Part three — the
register; Part four — intake; Part five — the durable run graph; Part six — transport, leases,
loops and recovery; Part seven — the judgment doorway; Part eight — the effect doorway; Part nine
— verification holders; Part ten — assembly; Part eleven — operator surfaces.*
