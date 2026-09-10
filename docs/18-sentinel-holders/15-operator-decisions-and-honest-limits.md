## 15. Operator decisions and honest limits

**Value — decision 1: how long safety features may watch without acting.**

**Question:** How long may a safety feature watch and report without acting before it must be turned on or rolled back?

**Background:** A watch-only trial can reveal mistakes without changing anything. During that trial, the protected area is still not automatically protected.

**Choices:** Allow no watch-only period; give every approved feature the same deadline; or give each feature its own deadline under one short system-wide maximum.

**What it changes:** No trial gives protection sooner but carries more rollout risk; one deadline is simple but ignores different risks; separate deadlines fit each feature but need tighter oversight.

**Recommendation:** Give each feature its own deadline under a short system-wide maximum because the risks differ while protection must not be postponed indefinitely.

**Value — decision 2: which fixes may run automatically.**

**Question:** Which kinds of recovery may happen without asking for approval each time?

**Background:** Automatic recovery can restore service quickly, but a mistaken recovery can also interrupt work or change important state.

**Choices:** Allow none; approve reversible, low-risk kinds one at a time; or allow every kind after it passes its tests.

**What it changes:** None gives maximum control but slower recovery; one-at-a-time approval limits harm while gaining speed; allowing every tested kind is fastest but gives the system the broadest authority.

**Recommendation:** Approve reversible, low-risk kinds one at a time after a watch-only trial and failure review because that grows authority from observed evidence.

**Value — decision 3: how often failed self-repair should alert you.**

**Question:** After self-repair fails, how many action-needed or result messages should the system be allowed to send?

**Background:** These are messages that need a decision or report a result, not routine status updates.

**Choices:** One combined message per incident; one combined message per incident under an hourly limit; or no push messages, with everything available only on the dashboard.

**What it changes:** One per incident is timely but can be noisy during many incidents; an hourly limit bounds interruption; dashboard-only is quietest but can delay attention.

**Recommendation:** Use one combined message per incident under an hourly limit because it preserves timely action while putting a hard ceiling on interruption.

**Value — decision 4: whether safety limits should vary by machine.**

**Question:** Should timing and automatic-action limits be the same everywhere or tuned after real measurements on each kind of machine?

**Background:** Different machines and installations can have very different normal speeds and capacity.

**Choices:** Use one policy everywhere; use a policy for each kind of machine and installation; or let each agent choose its own values.

**What it changes:** One policy is easiest but may be too strict or loose; grouped policies fit real operating conditions; per-agent values fit most closely but are harder to govern consistently.

**Recommendation:** Use measured policies for each kind of machine and installation under one system-wide safety ceiling because this balances accuracy with consistent control.

**Value — decision 5: which extra protections may inspect running programs.**

**Question:** Beyond the three protections that require it, which additional protections may read the computer's complete list of running programs?

**Background:** Three protections already need this broad view: finding abandoned unfinished work, cleaning up abandoned agent or helper programs, and removing unused checkouts. Reading the same list can improve other stuck-work decisions, but it reveals broad local activity; permission to observe never grants permission to stop a program.

**Choices:** Add no extra readers; add only the stuck-session watcher and idle-session cleanup; or allow every protection that watches a running program.

**What it changes:** No extra readers minimizes exposure; two extra readers improve the two most direct session decisions; every reader maximizes context but spreads sensitive observation most widely.

**Recommendation:** Add only the stuck-session watcher and idle-session cleanup because they directly need the evidence while broader access has no demonstrated benefit.

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

Decision 1 is implemented through the activation and posture contracts in P14-NF-16–23/48–50.
Decision 2 is bounded by P14-NF-40–47/51–53 and the granted effect, assembly and breaker seams.
Decision 3 is bounded by P14-NF-22/24/36–39/45–47 and Rule 53's route. Decision 4 sets the governed
values exercised by P14-NF-06–09/22/24/27/38/39/43–50/66. Decision 5 governs additional consumers
of the conditionally granted process inventory in `seam-response-assembly-followup.md`, ledger #40;
the three mandatory consumers remain P14-NF-61/64/66, and the separate worktree observation remains
ledger #50 in that same grant file.

*Depends on: Parts one through eleven, especially Five (`docs/09-the-run-graph.md`), Seven
(`docs/11-the-judgment-doorway.md`), Eight (`docs/12-the-effect-doorway.md`), Nine
(`docs/13-the-verification-holders.md`), Ten (`docs/14-the-assembly.md`) and Eleven
(`docs/15-the-operator-surfaces.md`).*
