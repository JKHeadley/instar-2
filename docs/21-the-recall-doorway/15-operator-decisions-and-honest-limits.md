## 15. Operator decisions and honest limits

**Value — policy decisions and experimental settings have different owners.** The constitution
settles the permission, action-classification and missing-evidence boundaries below. The agent
chooses and measures trial settings within those boundaries. No item authorizes spending or
an additional blocking check. Silence is not consent.

**Value — decision 1: where to measure better remembering first.**

Agent-owned setting, bounded by “nothing that mattered is silently lost”; initial choice:
balanced attention to long chats, connections across chats, email, and information from other
people or agents; changed by measurement, not by operator decision.

Reason: Equal starting attention can expose gaps across all four situations. It gives less
detail about each in a small trial, so the agent may adjust the balance as evidence accumulates.
Preserving important information in every channel does not require equal trial allocation.

**Value — decision 2: using information learned from someone else.**

Question: How should information learned from one person help in conversations with someone else?

Background: Permission to use something privately and permission to tell another person are
separate. A private detail might help the agent avoid an insensitive suggestion without being
repeated or hinted at to anyone else. Even that private use needs permission.

Choices: Shared information only; separately permitted private use; an agreed shared group.

What it changes:

- Shared information only avoids using private connections that might have helped.
- Separately permitted private use can improve help while keeping the private detail hidden.
  Sharing it still needs separate permission.
- An agreed shared group benefits from what members have explicitly shared within that group.
  Other information stays restricted.

Decision: Use private information only when that use is permitted, and reveal it only when
sharing is separately permitted. If permission cannot be established, keep it private and
unused. This boundary is settled by the constitution.

Recommendation: Within that boundary, consider who could be helped or hurt by using, sharing,
or withholding each detail. Record the choice and reason, then compare it with what happened.
Feedback counts only from people entitled to assess that outcome. This helps improve care
without turning a useful connection into permission to disclose it.

**Value — decision 3: how long better remembering may take.**

Agent-owned setting, bounded by timely help and a reachable response; initial choice:
a short history check within the measured time and spending limits; changed by measurement,
not by operator decision.

Reason: A brief check can recover useful context without making ordinary conversation wait
for an open-ended investigation. When evidence remains missing, say so. A deeper investigation
needs its own agreed time and spending limits.

**Value — decision 4: what better than human remembering should mean.**

Agent-owned setting, bounded by measuring useful judgment and supporting claims with evidence;
initial choice: compare people remembering unaided and people searching their records,
reporting each separately; changed by measurement, not by operator decision.

Reason: Separate comparisons expose the advantage of having an archive and show whether the
agent helps beyond searching it. They require more participant time. The constitution requires
honest measurement; it does not choose the comparison groups or the study length.

**Value — decision 5: which major actions deserve an extra history check.**

Question: When should an action receive an extra check against earlier conversations?

Background: These actions include sending an email, posting publicly, releasing software,
paying, and other things the agent cannot undo on its own. An earlier promise, restriction,
or conflicting statement may matter to whether the prepared action is right. The extra check
compares that action with the permitted earlier conversations. Ordinary conversation does not
receive this extra blocking check.

Permission for an extra check means you explicitly agree which actions may pause before they
happen while the agent checks that history, and when missing evidence must leave them unsent.
That also needs approval through the process that governs the agent's rules. Neither agreement
permits the underlying email, post, release or payment; each still needs its usual permission.

Choices: Review afterward; check email and public posts before acting; check all listed actions
before acting when earlier promises, restrictions or conflicting statements matter.

What it changes:

- Reviewing afterward avoids added delay but misses a chance to catch a historical mistake first.
- Checking email and public posts may catch a mistake before sending, but can add an unnecessary
  wait and leaves releases, payments and other agreed actions to later review.
- Checking all listed actions when history matters also covers releases, payments and other
  agreed actions the agent cannot undo on its own. It offers more coverage and possible delay;
  actions without a relevant earlier promise, restriction or conflict do not get the extra check.

Recommendation: Test the third choice—checking all listed actions when history matters—in
isolated trials. Earlier promises can matter to a payment or release as much as to an email;
this trial can show whether broader coverage catches more mistakes than it introduces errors
or unnecessary waits. A trial uses prepared examples without controlling real actions. This
recommendation gives no permission to switch the check on or spend money on a trial.

Decision status: The choice for real actions is deliberately deferred until the trial evidence
and your explicit choice are available and the required rule approval is recorded. Until then,
extra history review stays afterward or in isolated trials; existing permission and required
evidence checks still apply before acting.

**Value — decision 6: what happens when an action needs missing evidence.**

Question: When an otherwise permitted action needs evidence the agent cannot yet find, what happens?

Background: Required evidence cannot be replaced by a guess or by waiting long enough.

Choices within that boundary: Wait for your instruction; make limited rechecks while keeping
you informed.

What it changes:

- Waiting for your instruction avoids automatic retries but needs your attention to resume.
- Limited rechecks can recover from a short outage without repeated notices. If they fail,
  the action remains unsent and you can see what still needs attention.

Decision and recommendation: Keep the action unsent and keep its status reachable. This is the
constitutional requirement and avoids treating silence or a timeout as permission.

Agent-owned setting, bounded by that unsent action and reachable status; initial choice:
a brief recovery window with limited rechecks and one notice updated with the result;
changed by measurement, not by operator decision. When the window ends without evidence, the
action stays unsent and awaits further instruction.

**Rule — decisions stay within explicit ownership and approval.** Rules 7, 11, 13, 28, 42,
57, 66, 77, 82, 86, 90, 93, 94, 95, 98, 103, 108 and 111;
**checks: P21-NF-02/06–09/13–16/18/20–24**. Decision numbers map to stable ids OD-01
through OD-06 in order.

Basis for decision 1: Purpose, “nothing that mattered is silently lost,” coherence pillar and “Who decides what”; section 10, P21-PILOT-01; OD-01.

Basis for decision 2: Purpose, “wisdom is what coherence is for” and authority constraint; rules 57/86/95; section 5 current scope policy; OD-02. The follow-on “judgment of use” owner design is not specified here.

Basis for decision 3: Rule 77; section 7 owns the initial two-second ordinary and fifteen-second history-review candidate ceilings and separate spend authorization; OD-03.

Basis for decision 4: Purpose, wisdom Value, evidence constraint and “Who decides what”; section 10 owns P21-HUMAN-01 and the initial four-week horizon; OD-04. No paid study is authorized.

Basis for decision 5: Purpose’s sole consequential-effect definition, PR #71, operator-approved and merged at e281a2c2; sections 1/8 selector and governing-rule reconciliation; section 12 activation; OD-05. The class allowlist is a proposal within that boundary, not a second constitutional definition or an approved runtime exception.

Basis for decision 6: Rule 95; section 7 owns the initial five-minute window, at most two rechecks and one logical notice; sections 12/14 retain activation and owner dependencies; OD-06.

OD-01 changes evaluation emphasis, not the all-setting recall contract
in sections 2/5. Incident evidence collection is separate: section 10 requires an authorized
failure, comparable success and missing-source/legitimate-hold control per setting through
`P21-INCIDENT-REPLAY-v1`; the four reported causes remain UNKNOWN until supplied.
OD-02 consumes section 5's current scope policy; its private-use option remains inactive until
that policy is enforceable. OD-03 sets agent-owned experience tuning; section 7 holds the engineering caps,
pricing snapshot and proposed US$25 pilot ceiling. Current authorized spend is US$0; a paid run
requires separate explicit approval. Section 10 freezes statistical and false-hold thresholds
before any evaluation, including the proposed C unnecessary-hold target below 1%, which the
small pilot cannot certify.

OD-04 maps to `P21-HUMAN-01` in section 10, with independently graded dimensions and a frozen
population, tools, time allowances and precision plan. OD-05 inherits consequential
classification from the purpose by reference. The operator retains ownership of resource
thresholds and policy-sensitive markings. History-review candidates are section 8’s
selected actions whose earlier promises, restrictions or conflicting statements matter;
selection grants no waiver. The live before/after-review choice remains deferred. Section 8's rulebook
reconciliation, measured evidence and exact exception approval remain mandatory. Ordinary chat cannot acquire a semantic blocking reviewer.
OD-06’s fail direction is constitutionally decided; its waiting duration and notification
counts are agent-owned settings. The effect owner retains the exact
attempt, the scheduling owner performs at most two bounded rechecks within the selected window,
the run graph retains outstanding work, and operator surfaces own status and follow-up actions.
There is one logical notice updated with the result and a pull-visible record. Expiry never
means approval, proved non-occurrence, deletion, or expiry of the underlying directive.
Stop and current revocation take precedence; a late reviewer result cannot release an expired
attempt. Sections 7/14 specify the engineering assignment and the requested pending seam.

Every ungranted earlier-owner dependency is REQUESTED in section 14 and remains
non-executable until its named request is GRANTED and implemented. Granted dependencies remain
non-executable until the cited grant lands with current owner evidence. Section 14 is the sole
per-check dependency authority; section 12 derives its execution posture from that map.
No decision here changes that posture.

Questions for the operator — pending live-policy choice: OD-05, whether to review afterward,
check email/public posts before acting, or check all listed history-dependent actions before
acting. The third option is recommended for isolated trials; choosing and enabling the live
policy is deferred pending evidence, explicit operator choice and governing-rule reconciliation.
The purpose settles consequential classification and permission boundaries, not that selection.
Section 8 records the candidate narrow exception for that governing process; it is not an approved
purpose or rule change. No-pending-policy status may be claimed only after this choice is resolved
or the live proposal is withdrawn. OD-02/06 retain their constitutional boundaries; OD-01/03/04
and OD-06's numeric settings remain agent-owned. Engineering settings live in sections 7/10 and
change by measurement within those boundaries. Runtime exception and paid-run approvals remain
separate activation conditions; this list supplies neither. A new policy question that the
purpose cannot decide must be recorded as a candidate purpose amendment before convergence.

**Value — honest limits.** The design has source-grounded mechanisms, three measured installed
method failures, a prepared synthetic corpus and explicit experiments. It has no production
memory-coherence measurement, no Dawn runtime verdict, no diagnosis of the four private incidents,
no executed repaired regression, no paid pilot and no human comparison. Research provenance is
in [R1](research/01-instar-1x-memory.md), [R2](research/02-dawn-grounding.md),
[R3](research/03-external-research.md), [R4](research/04-compare-and-contrast.md) and
[R5](research/05-proposals-and-evaluation.md). R3's historical pending-source note is superseded
as an evidence-status matter by R2's completed source audit; runtime traces remain unknown.
External mechanism descriptions and author-reported benchmark results are not local validation.
Beyond-human coherence is a measured outcome to earn, not an assertion in the architecture.
