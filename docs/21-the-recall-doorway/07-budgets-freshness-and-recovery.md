## 7. Budgets, freshness, and recovery

**Rule — one attempt spends one finite envelope.** Rules 13, 39, 55, 57, 60, 61, 75, 95 and
114; **checks: P21-NF-04/08/10/14/18/23**. The resource owner reserves capacity before
work starts. The P21 coordinator admits each source call and child against the same root account.
Parallel adapters, retries, loading cached originals, review and draft repair do not create
new allowances.
Zero remains zero. A caller cannot bypass a cap by renaming a query or opening another child.

The following are **proposed pilot ceilings, not approved expenditure, measurements, provider
prices or service-level promises**. They adopt [R5 §§3–6](research/05-proposals-and-evaluation.md)
and add explicit backend/queue bounds for review. They implement the proposed experience in
operator decision OD-03 in section 15.
Here, p95 is the duration below which 95% of observations fall. KiB and MiB mean
1,024 and 1,048,576 bytes respectively; token counts use the selected model's tokenizer.

| Resource per root | Ordinary conversation | Qualifying consequential effect |
|---|---|---|
| Combined added work | 2 s wall time including accounting and final recall validation | 15 s total. Recall, review and repair each take at most 5 s. Overhead fits within that total. |
| Inserted recall context | 4,000 tokenizer-measured tokens | 6,000 tokenizer-measured tokens |
| Logical evidence reads | 6 total | 10 total, including at most 2 used by reviewer |
| Backend fan-out | At most 2 backend operations per logical read; at most 2 concurrent operations per root | Same, maximum 20 backend operations per root |
| Loaded candidate text | 256 KiB total. At most 64 candidates. | 512 KiB total. At most 96 candidates. |
| Backend scan | Declared indexed-query resource bound; raw fallback at most 1 MiB per root | Same; opaque/unmeterable backends declare unsupported hard scan guarantees |
| Helper model calls | 0; no ordinary live semantic-review arm | At most 3 total: recall helper, review, one repair; a retry consumes a slot |
| Helper tokens | 0 | Recall: 4,000 input/500 output tokens. Review: 8,000/800. Repair: 8,000/1,200. Each pair is a ceiling. |
| Recursion | No model-planned search; bounded deterministic source composition | Search depth at most 2, still within total reads/calls |
| Accounting | 0 model calls. At most 64 KiB new metadata. Larger required lineage uses charged referenced artifacts. | Same |
| Accounting target | Added local p95 at most 25 ms, tested including slow storage | Same; not an extra deadline outside 15 s |
| Queue and retries | Queue time included in the 2 s; at most 1 retry per failed read, still within all root caps | Queue time included in the 15 s; same read retry rule; no try-until-agreement review |

The proposed paid pilot has a US$25 total ceiling only after a separate explicit run approval.
Currently authorized spend is US$0. Freeze the provider, model, embedding and price snapshot,
then admit the complete affordable plan before evaluation. If it does not fit, resize the plan
and record the statistical limit before running it. No provider price or per-root dollar estimate
is asserted here. Permit two concurrent backend reads per root and one background worker per
declared pool. Set the pool-wide active-root cap from measured capacity before activation;
a missing cap inhibits admission. These settings are versioned engineering proposals serving
OD-03, subject to the operator's approved time and spending limits.

The added-work duration is the sum of non-overlapping recall/accounting/review/repair/final-check
stage intervals, including their queue time; parallel reads within a stage count wall time once.
It is not a two-second promise for the entire answer. The work/judgment owner separately supplies
a finite absolute total-work deadline that includes principal drafting. Every stage deadline is
the earlier of that overall deadline and its remaining added-work allowance. P21 cannot extend
the enclosing deadline, exclude a helper as “principal drafting,” or reset either budget on
restart. Missing finite owner deadlines inhibit admission. Reserve final-check overhead before
search so an otherwise valid answer does not routinely exhaust its validation allowance.

The primary reader's original drafting cost is separately measured and included in end-to-end
totals; review-induced repair is added work in this envelope. Query embeddings count even when
they are not helper LLM calls. Retained captures, indexing, rebuilds, storage and retrospective
curation are billed in lifecycle totals. A successful return at 2 s is not proof the underlying
work stopped: residual processor work, calls and charges remain visible and reserved until reconciled.

**Rule — cancellation bounds actual work.** Rules 55, 57, 60, 61, 75 and 95;
**checks: P21-NF-04/08/10/19**. Use a monotonic local deadline and cancellation handle;
convert persisted owner deadlines on restart using verified clock evidence, never by resetting
the original window. Admission reserves overhead so three five-second slices do not promise
fifteen seconds plus unbounded finalization. A cooperative child is cancelled; an uncooperative
child is isolated and prevented from returning usable evidence after expiry. Its maximum
outstanding exposure remains charged under the resource owner. No new call starts on an expired
root. Providers without enforceable cancellation report that limit; their residual exposure
cannot be counted as zero or admitted beyond the root's reserved maximum.
The owner basis is [transport sections 3–6](../10-the-transport-and-leases.md), including
monotonic timer recovery, bounded loops and retained reservation exposure, and
[effect settlement](../12-the-effect-doorway.md). The landed contracts retain that division:
`src/transport/contracts.ts:70–89` records settlement accounting and
`src/effects/contracts.ts:41–47` binds final charge, delayed-execution exclusion and retained
exposure. Recall-specific composition remains non-executable until row 90 of
`seam-response-recall-doorway-grants.md` lands with section 14's loop/owner dependencies.

**Rule — reuse binds evidence and permission currency.** Rules 28, 31, 33, 45, 90 and 95;
**checks: P21-NF-07/09/10/18**. Cache keys bind principal/provider scope, recipient set,
conversation mapping, current task, exact references, query, source/permission frontier,
retriever/index/model/renderer and policy versions. Same prompt text is insufficient. Proposed
maximum reuse age is 15 s, with exact current revalidation even inside that age. When reliable
dependency invalidation is unavailable, any changed relevant frontier invalidates reuse; an
unknown relevance relationship also invalidates it. An index rebuild never serves one model's
vectors under another model's declared dimension/version.

Contradictions use event time, ingestion time and validity time separately. For a current-state
question, newer ingestion does not automatically defeat an older event's later correction. For
an as-of question, a superseded fact may be the correct historical answer. Unresolved conflicting
sources remain visible and cannot be resolved by popularity, machine arrival order or a cache’s
time-to-live (TTL), the maximum age at which it may be reused.

**Rule — crash and outage keep an honest disposition.** Rules 42, 45, 55, 60, 61, 77, 83 and 95;
**checks: P21-NF-05/10/13/14/18/21/24**.

| Failure cut | Required durable disposition and next owner action |
|---|---|
| Source read/index unavailable | Mark source state; try permitted raw/exact fallback if budget permits; ordinary reply qualifies only material uncertainty |
| Packet assembled, provider not invoked | Preserve attempt; after restart re-resolve scope/frontier and remaining reservation; no submission claim |
| Provider input captured, manifest join absent | Owner retains real capture; append missing diagnostic join only from actual evidence; do not repeat provider call merely to recreate a log |
| Review times out or returns late | No silent approval; apply only the registered effect policy; expired result cannot release the effect |
| Pending consequential prerequisite | Effect owner holds original work/draft/target and policy cause; scheduling owner owns bounded recheck; operator surface exposes status/expiry |
| Dispatch possibly happened | Existing effect/transport observation and settlement rules govern; P21 refresh cannot replay, invent non-occurrence or change operation identity |
| Accounting storage unavailable | No false-success receipt; preserve mandatory owner refusal, expose diagnostic gap through the independently reachable owner path |

An unrelated missing memory never automatically blocks an effect. A genuine authority violation
retains its owner's refusal regardless of reviewer availability. Bounded pending recovery ends
as resolved, explicitly still-unresolved/expired, cancelled or superseded under the effect owner;
expiry does not authorize execution or erase the original directive. Proposed recovery is at
most two rechecks within five minutes, one logical notice updated with the result plus a
pull-visible record. This is **NON-EXECUTABLE-UNTIL-row-92-effect-recall-pending** and the selected
operator policy. The effect owner retains the pending attempt; transport/scheduling owns
bounded rechecks; the run graph retains outstanding work; operator surfaces own status and
expiry actions. OD-06 selects the waiting experience, not those engineering boundaries.
The request and its transitive dependencies are specified in section 14.

**Rule — multi-machine history is partial until proved otherwise.** Rules 32, 33, 45 and
113; **checks: P21-NF-07/10/11/18**. Originals and durable recall records follow the fact
spine's replication/custody rules. Indexes and caches are machine-local rebuildable views,
deliberately. Each answer names the known lineage frontier and missing peer coverage to the
authorized audit. Partition does not mean “no history.” A successor placement invalidates
incarnation-bound receipts, re-resolves current permissions and retains the original budget and
pending effect identity through the owners. The narrow landed grounding refusal for multiple
lineages (`src/rungraph/graph.ts:108`) is not broadened by this proposal. Production multi-lineage
start/resume is non-executable until `seam-response-rungraph-followup.md`'s history-coverage
addendum (SEAM-LEDGER row 52) lands, with the transitive dependencies in section 14.
