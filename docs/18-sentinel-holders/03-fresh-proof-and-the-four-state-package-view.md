## 3. Fresh proof and the four-state package view

**Rule — a configured holder is never presumed alive.** Rules 9, 13, 26, 39, 43, 73 and 95;
**checks: P14-NF-06–09/17/18**. Every enabled instance emits fresh proof of running from recorded
execution on named hardware. The proof identifies plan generation, executable and fixture digest,
logical slot, attempt, start/end observations, result, exact subject population, machine identity,
clock basis and independent witness. A never-run, late, incomparable-clock, copied, self-witnessed,
wrong-generation or wrong-machine result is not fresh. Freshness is evaluated when consumed from
source history, never refreshed by copying into a dashboard row.

**Rule — enrollment, protection obligations and required execution are separate populations.**
Rules 13, 26, 33, 42, 43, 69, 73 and 95; **checks: P14-NF-16–21/54**. The enrolled population is
the complete package, declaration, per-instance plan and binding join in section 2. It does not
shrink when execution is deliberately inhibited.

At the same pinned source vector, the **protection-obligation population** is derived independently
from current Part Three critical-outcome declarations and their `requiredFacts.probe` references,
plus the current holder declarations' `holds` edges. Those registered relationships are joined to
the exact `VerificationPlan.subject.rules`, holder, governed subject, required arm and production
instance. Each row names the critical outcome, rule, holder, plan, raw Part Nine arm and instance.
It remains required until the critical outcome or holder relationship is retired or superseded in
signed history. A `dark`, `retired`, inhibited or unbound execution state does not delete it. A
missing join is itself a protection gap, never a smaller denominator.

The currently required execution population is derived separately for each enrolled instance. For
`live`, it contains every required observation and effect arm. For `soaking`, it contains every
required observation arm and any effect arm whose binding admission says it is currently intended
active; a deliberately inhibited effect arm remains enrolled but is not treated as if it executed.
For `dark` or `retired`, it is empty only while fresh independent assembly evidence proves every
binding deliberately inhibited or retired for that declaration state and no later execution
occurred. Missing, stale, conflicting or unexpected inhibition evidence never shrinks the required
execution population or the independently derived protection-obligation population.

**Rule — the operator-facing family view uses exactly four labels without replacing part nine's
posture.** Rules 13, 26, 33, 42, 43, 69, 73 and 95; **checks: P14-NF-16–20/54**. A Part Two
projection first folds only admitted facts and the pinned register generation. That facts-only fold
derives enrollment, protection-obligation and required-execution populations plus the source
references needed by the consumer. It never reads or stores `GuardPostureView`, another projection,
or a clock.

At consumption time, the family query takes an explicit evaluation clock and calls Nine's public
`VerificationRuntimePort.posture(plan, clock)` resolver for each exact current plan against the same
pinned source snapshot. If the facts-only fold and Nine resolver cannot prove the same source vector
and generation, the query refuses the comparison as `diverged` rather than mixing horizons. It then
renders the four labels from the folded populations, current binding observations and Nine's
clock-evaluated raw per-arm posture. This rendering is not a new authority or stored truth. For each
enrolled instance it applies the rows below in order and stops at the first match. Raw posture,
missing arms, binding admissions, declaration facts, evaluation clock and evidence references
remain visible.

| Label | Derivation |
|---|---|
| `diverged` — precedence 1 | Enrollment is empty or incomplete; sources conflict; a binding disagrees with its declaration, intended mode, plan, governed subject or runtime; a claimed inhibition lacks fresh independent evidence; or any arm in the currently required execution population is missing, never run, stale, failed, inconclusive, errored, unknown, wrong-generation or unwitnessed. A fresh failed required observation reaches this row. Unexpected inhibition or activation also reaches this row. |
| `off` — precedence 2 | The declaration is `dark` or `retired`; enrollment is complete; fresh independent evidence proves every binding deliberately `inhibited` or `retired` for that exact current declaration and admission generation; no later execution is observed; and precedence 1 did not match. No execution arm is required merely to prove it did not run. Off is current evidenced inactivity, never protection. |
| `dry-run` — precedence 3 | The declaration is `soaking`; every required observation binding is active and has fresh passing independent evidence; every effect binding is accounted for; at least one effect binding is deliberately inhibited by a current admission matching the declared soak; every effect binding intended active has fresh passing independent evidence; and precedence 1 did not match. A never-executed deliberately inhibited effect arm does not defeat this label. No prevented effect is claimed. Zero effect inhibitions cannot produce this label. |
| `on-confirmed` — precedence 4 | The declaration is `live` or `soaking`; every required binding is intended active and active in production; every required arm has a fresh passing result for that per-instance plan and independent witness; no effect binding is inhibited; and precedence 1 did not match. |

**Rule — family aggregation is ordered and mutually exclusive.** Rules 26, 33, 42, 43, 59, 69
and 73; **checks: P14-NF-19–22/48/54**. First, an empty/incomplete enrolled-instance population or
any `diverged` instance makes the family `diverged`. Second, all enrolled instances `off` makes it
`off`. Third, if every enrolled instance is `dry-run` or `on-confirmed` and at least one is
`dry-run`, the family is `dry-run`. Fourth, all enrolled instances `on-confirmed` makes it
`on-confirmed`. Every
other mixture, including `off` mixed with an active state, is `diverged`. One green arm therefore
cannot paint siblings green. A complete population count travels separately from any bounded list
so truncation cannot resemble an all-clear.

The aggregation is evaluated within that same consumption-time query and evaluation clock. It is
not appended to the facts-only fold.

**Rule — load-bearing gaps are explicit owned findings.** Rules 8, 15, 43, 64, 68, 71, 73 and
87; **checks: P14-NF-21–24/54**. For every protection-obligation row, the consumption-time query reads the raw
Part Nine arm posture without changing its meaning. An obligation is satisfied only when all three
facts join at the same current source vector: the exact binding is intended active and independently
observed active for this holder, plan, arm, instance and generation; the raw Part Nine arm is
`healthy`; and that posture is backed by exact current-generation fresh independent evidence. A
binding is not current active when its admission is inhibited, retired, missing, conflicting, stale,
for another generation or contradicted by runtime observation. Such a binding retains a gap even
while an earlier independent pass is fresh and Nine therefore still reports raw `healthy`.
`failed`, `stale`, `unknown` and `inactive` also expose a load-bearing gap; missing arm or instance
joins expose a gap as well. The four-state package label is displayed beside the gap but is never
compared as if it were an arm posture. An intentionally `off` instance whose critical-outcome
relationship still exists therefore retains its obligation and its gap even though its required
execution population is empty. A required never-run arm remains raw `unknown` under Nine; Fourteen
does not relabel it `inactive`. `dry-run` and `diverged` instances likewise expose their unsatisfied
obligations. The finding names the affected rule/outcome, instance, raw arm posture, binding
admission and observation, first observed source vector, current evidence, owner, safe fail direction
and next due assessment.
Activation policy may permit a bounded soak—an owner- and deadline-bound observation period in
which selected effects remain inhibited while their gap stays visible—or an explicit accepted risk,
but neither relabels the gap as protected. The pull surface shows all gaps. A push notice is a
part-eight effect and follows section 8.

---
