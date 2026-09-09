## 15. Operator decisions and honest limits

**Value — accepted-gap and soak question.** Which effect classes, if any, may remain deliberately
inhibited as visible load-bearing gaps during rollout, and for how long before graduation or
rollback? Options: no accepted soak gaps; a single fleet duration for named classes; or governed
per-class durations below a fleet ceiling. **Recommendation:** per-class durations below a short
fleet ceiling, each with an owner, deadline and rollback. Every such instance remains unprotected.
It is `dry-run` only while enrollment is complete, every required observation is fresh and passing,
and inhibition evidence is current; missing, failed or stale observation/inhibition evidence makes
it `diverged` until repaired. Only live evidence can make it `on-confirmed`.

**Value — automatic recovery question.** Which recovery classes may graduate from signal-only to
automatic effects? Options: none; reversible low-risk classes individually; or every registered
class after tests. **Recommendation:** graduate reversible low-risk classes one by one after dry-run,
hostile-cut evidence and retrospective review; keep destructive or identity-uncertain cases held
unless their specific operation policy is approved.

**Value — eligible notification-budget question.** After eligible self-heal fails, what bounded
budget should action-needed and result-bearing pushes consume? Options: one aggregate per causal
episode; one aggregate per episode with a fleet hourly ceiling; or disable pushes and retain only
the complete pull view. **Recommendation:** one aggregate per episode under a fleet hourly ceiling.
Routine status and churn remain pull-only in every option.

**Value — deployment budget question.** Who chooses freshness windows, detection ceilings and
self-action limits after the tests expose actual distributions? Options: one fleet policy; per
hardware/deployment class; or per agent. **Recommendation:** governed per hardware/deployment class,
with a fleet safety ceiling and no value published as measured until named-hardware evidence exists.

**Value — process-inventory consumer question.** If this design is approved, how broadly beyond the
three required consumers should the conditionally granted read-only Part Ten process-inventory
observer in `seam-response-assembly-followup.md`, ledger #40, be exposed? The process-population
reaper, orphaned-work holder and clean-worktree reclamation holder are mandatory consumers because
P14-NF-61/64/66 require its complete snapshot. Options for genuinely additional consumers are:
neither; both the session-watchdog and session-reaper; or every holder that observes a process.
**Recommendation:** add the session-watchdog and session-reaper, producing five named consumers in
total: process-population reaper, orphaned-work holder, clean-worktree reclamation holder,
session-watchdog and session-reaper. The inventory grants observation only; it never grants disposal
authority. Every selected target or checkout still requires fresh action-time identity
revalidation through Eight and Ten. Clean-worktree reclamation also requires the conditionally
granted but unlanded worktree-observation operation in `seam-response-assembly-followup.md`, ledger
#50; the process snapshot does not replace it.

**Value — honest limits.** These holders can prove that registered observations ran and expose
known gaps. They cannot prove that every future stall shape is enumerated, that an opaque provider
reported truth, that a semantic judgment is wise, or that an observer survives total machine and
independent-witness loss. Those limits remain visible in coverage, source horizons and
retrospective populations rather than being converted into green posture.

**Rule — technical completion is not approval or runtime certification.** Rules 34, 65, 82, 90,
109 and 111; **checks: P14-NF-49/50** and the governed review process. This document claims no
deployment, actual measurement, live holder, independent convergence or operator approval.
An independent desk must converge and the operator must approve the exact governed content before
implementation. After implementation, activation becomes eligible only after the real three-tier,
hostile-cut, named-hardware, independent-witness, channel and reconstruction evidence exists.
Those executions provide runtime certification. The document check and successful build are
technical evidence only.

*Depends on: Parts one through eleven, especially Five (`docs/09-the-run-graph.md`), Seven
(`docs/11-the-judgment-doorway.md`), Eight (`docs/12-the-effect-doorway.md`), Nine
(`docs/13-the-verification-holders.md`), Ten (`docs/14-the-assembly.md`) and Eleven
(`docs/15-the-operator-surfaces.md`).*
