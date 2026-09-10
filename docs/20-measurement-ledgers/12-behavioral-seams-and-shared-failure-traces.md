## 12. Behavioral seams and shared failure traces

**Rule — every cross-part interaction has one producer, record, order and closure owner.** Rules
24, 31, 33, 42, 45, 49, 68 and 69; **checks: P16-NF-02/07/12/15/23/31/35/42–45/51**.

| Seam | Ordered record flow | Failure direction and closure owner |
|---|---|---|
| model usage | seven attempt → six claim → eight dispatch observation → ten adapter evidence → requested four observation intake → two facts → sixteen source projection → bounded read presentation | Call outcome stands; missing usage stays unknown; nine owns instrument finding; seven owns attempt/receipt; expanded categories wait on the ten seam |
| price and spend | requested three manifest + usage + eight settlement → six `SettlementApplication` history → requested six qualified accounting read → pinned read join → eleven view | Missing/incompatible price is unpriced; raw application bytes cannot lower current exposure; three owns manifest repair and six owns current accounting truth |
| quota/rate limits | provider or breaker/sentinel observation → ten adapter → requested four observation intake → two facts → account/window/source view | Missing/stale stays unknown; breaker and session events stay separate; no scheduling answer; nine owns collector adequacy |
| resources | GRANTED CONDITIONAL Ten process inventory in `seam-response-assembly-followup.md` row 40 plus requested interval semantics → requested four observation intake → two facts → machine view/finding | Production arm is non-executable until the row-40 grant's docs/18 condition is met and that contract lands, `design-measurement-ledgers-seam-request-resource-observation.md` receives a named Part Ten grant and GRANTED/BUILT ledger row and that contract lands, and intake lands; missing sample breaks completeness; no kill or throttle; ten repairs adapter and nine assesses |
| benchmark | requested seven compatibility resolver + requested ten current measured-route support + nine `Grade`/`BenchmarkEvaluation` + production measurements → pinned eligible join → nine advisory finding | The landed opaque digest and `measured:false` route cannot produce a positive control; after the seam lands, mismatch/staleness/conflict/current-support failure is ineligible and threshold shortfall is partial; seven, ten and nine repair their owned evidence |
| growth | ten `GrowthPolicy` + `GrowthObservation` → one coalesced episode → one five investigation under six loop → optional proposed part-two storage change | Observation never deletes facts; ten owns measurement, five/six own follow-through, two owns any later storage design |
| maximum disposition | five-owned conservative disposition → requested eight settlement variant → six application and qualified accounting read → pinned view | Before disposition the maximum is outstanding; after it the maximum is separately accounted with no headroom release or execution conclusion; unavailable until its five/six/eight seam lands |
| cap/freeze and door activation | operator act through eleven/four → one authorization → requested eight cap/freeze or distinct door-activation payload → current Ten paid-service posture + six accounting/fence → settlement/receipt | Positive cap does not arm; arm plus not-ready does not admit; measurement outage does not block stop; stale/replayed/widened authority refuses; a frozen paid operation uses `reason: policy`; cap/freeze waits on the GRANTED `seam-response-effects-followup.md`, while activation/readiness is non-executable until `design-measurement-ledgers-seam-request-paid-door-readiness.md` receives a named Eight/Ten grant and GRANTED/BUILT ledger row and that contract lands |
| measurement/spend surface | pinned source history + source projection + requested manifests + optional exact live-accounting inputs → package bounded read → requested Eleven authenticated pull operation → Ten production surface binding | Pure renderer/privacy checks stay local; a mock, screenshot or part-fourteen guard surface is not the positive; real-surface arms are non-executable until `design-measurement-ledgers-seam-request-operator-surface.md` receives a named Eleven/Ten grant and GRANTED/BUILT ledger row and that contract lands |

**Rule — four failure traces have exact answers.** Rules 14, 24, 31, 33, 41, 42, 46 and 86;
**checks: P16-NF-08/10/14/17/22/26/38/42/45/50/51**.

1. A provider returns output but no usage at clock `t`, with evidence-horizon endpoint `H`. The
   attempt and output outcome remain. For `t < H`, the exchange is pending and is not yet
   unmetered or overdue. At `t = H` and afterward, absent acceptable usage is overdue and the
   observed exchange is unmetered; spend remains unpriced or at maximum liability. An acceptable
   late usage observation after `H` causally refines the current row to usage-supported for fresh
   owner reads that include it. An already completed earlier render remains unchanged as labelled
   audit evidence; it is not rebuilt as current authority. Reconciliation
   continues under six. No zero usage or free-call claim appears.
2. A process exits and its PID is reused before the next sample. The new start evidence creates a
   new process incarnation. The old run gets no later resource sample, and the missing interval
   remains visible.
3. A price correction and a feature-attribution correction arrive while a pool spend query is in
   flight. If the query completed before the store advanced, that already rendered result remains
   labelled evidence of what was displayed at its recorded frontier, not current authority. If the
   store advanced first, part two invalidates the old snapshot: folding it refuses with `integrity`
   and reading its projection refuses with `stale-base`. The retry obtains a fresh owner snapshot
   through `readForProjection()`, folds the new frontier and may differ; neither path rewrites usage
   or settlement, and copied old bytes cannot reconstruct the former frontier.
4. The measurement package fails while paid spend appears runaway. Reads report the instrument
   outage. Once the requested part-eight control seam is implemented, its independently admitted
   operator freeze path still executes without this package; later rebuild reconciles observations
   without unfreezing anything. Before that seam lands, the stop capability is an explicit gap,
   not a claim of current protection.

---
