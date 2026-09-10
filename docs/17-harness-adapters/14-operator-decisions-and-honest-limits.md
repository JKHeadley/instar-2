## 14. Operator decisions and honest limits

**Value — decision 1: what to do when we cannot verify that the assistant used its background.**

Question: Should a safely confined setup remain available for clearly labeled advisory work when
we cannot verify that it used the supplied background, or should we turn it off?

Background: A safely confined setup still sends every outside action through the normal safeguards.
Advisory work can help a person, but it cannot make the stronger claim that the assistant worked
from all required history and instructions.

Choices: Keep it available as advisory-only, or disable it entirely.

What it changes: Advisory-only preserves useful human-directed work with a prominent limitation.
Disabling it removes that use until the missing proof becomes available.

Recommendation: Keep it advisory-only because honest labeling preserves useful work without
pretending the stronger guarantee exists.

**Value — decision 2: how much private session content to keep for diagnosis.**

Question: Should diagnosis keep only compact event records, or may it also keep short snapshots of
what appeared in a session?

Background: Session snapshots can make rare failures easier to understand, but they may contain
more private content than event records.

Choices: Keep compact event records only, or also allow limited snapshots for approved problem
categories.

What it changes: Event records only reduce privacy and storage exposure. Limited snapshots improve
debugging for the approved categories while increasing that exposure.

Recommendation: Keep event records only by default because snapshots should be justified by a
specific diagnostic need.

**Value — decision 3: whether old diagnostic content should be removed automatically.**

Question: Should we keep diagnostic content until an already permitted removal reason applies, or
open a separate policy change that allows removal just because content is old?

Background: The current rules do not make age alone a reason to remove evidence. Without a new
policy, a full store keeps existing content and refuses new affected capture work.

Choices: Keep the current policy, or separately review an age-based removal policy with clear
delays, protections, and consequences.

What it changes: Keeping the current policy preserves evidence but may stop new capture when storage
is full. A new policy could free space but would make some later investigation impossible.

Recommendation: Keep the current policy for initial activation because evidence should not
disappear before the removal policy is reviewed on its own merits.

**Value — decision 4: using an assistant when understanding cannot be proved.**

Question: Should an otherwise fully tested assistant remain available even though we can prove
what background it received but cannot prove that it understood that background?

Background: Delivery evidence can show what reached the assistant, while the quality of its
understanding remains something we judge from its work.

Choices: Allow the assistant with this stated limit, or disable every setup that uses an assistant.

What it changes: Allowing it keeps normal tested and reviewed uses available while accepting the
risk of a mistaken interpretation. Disabling it removes all assistant work because no setup can
eliminate that risk.

Recommendation: Allow it because independent checks of outputs can catch mistakes even though they
cannot prove understanding in advance.

**Value — decision 5: using a provider that may lose its saved conversation.**

Question: Should a tested setup remain available when the provider may lose its saved conversation,
provided our durable work and current history remain available for a replacement?

Background: A provider's saved conversation can make continuation faster, but it is not the
authoritative record of the work.

Choices: Allow recoverable use without a forever-retention promise, or require a provider that
guarantees permanent conversation retention.

What it changes: Recoverable use keeps normal work available but may require a slower fresh start
after provider data loss. Requiring permanent retention keeps the setup unavailable unless a
provider supplies that guarantee.

Recommendation: Allow recoverable use because the durable work record preserves the assignment
without depending on a vendor's storage promise.

**Value — decision 6: trusting the machine administrator.**

Question: Should we enable the fully safeguarded mode on the proposed trusted machines while
accepting the administrator risk, or leave that mode disabled there?

Background: A machine administrator can replace the programs and observers that run on that
machine, so this risk cannot be removed by the adapter itself.

Choices: Enable the fully safeguarded mode on the listed trusted machines, or leave it disabled on
those machines.

What it changes: Enabling it makes fully safeguarded work available on those machines, with
administrator compromise as the remaining risk. Leaving it disabled removes that work there while
independently hosted limited communication can remain available where its own safeguards still hold.

Recommendation: Accept this trust only for explicitly trusted administrators because pretending
the administrator is constrained by software it controls would be misleading.

**Value — decision 7: using a paid service whose final charge arrives later.**

Question: Should a paid service remain available when its final charge cannot be seen promptly,
but the company charging us enforces a cap on the total possible charge?

Background: A delayed bill can leave part of the budget unusable because the system must reserve
for the largest charge still possible and must not repeat an uncertain call.

Choices: Allow capped use while treating the largest still-possible charge as spent, or disable
that paid service.

What it changes: Capped use continues until the available budget is exhausted and accepts a later
charge up to the enforced cap. Disabling the service avoids that billing uncertainty but removes
all work that depends on it. A paid service without an enforceable cap remains unavailable under
either choice.

Recommendation: Allow capped use because the financial risk stays bounded and uncertainty cannot
silently release budget or authorize a repeat.

**Value — honest limits.** No adapter can prove that a model understood supplied context, that a
provider will preserve a conversation forever, that an administrator cannot replace the runtime
or observer, or that an opaque vendor billing surface has no later charge. The design can prove
exact delivery boundaries, captured behavior, confinement within the tested host boundary, and
retained uncertainty. The operator decides whether those residual limits are acceptable for each
mode.

**Rule — technical completion is not approval or certification.** Rules 30,
34, 49, 65, 82, 90, 109 and 115; **checks: P13-NF-02/07/43/44/45/47/48** and the governed review
process. Decisions 4–6 do not waive actual context delivery, current grounding, durable history,
output verification, confinement, or honest trust-boundary disclosure. Decision 7 cannot release
a reservation, close charge exposure, repeat an uncertain call, or claim bounded completion; it
only selects whether a capped route may accept work under its existing uncertainty policy.
Activation is mandatory for each exact harness package and artifact digest, registered
model doorway and route, platform, and capability mode. One complete tuple never activates its
family or another doorway. The builder may use tmux, another PTY driver, a direct subprocess, or a
structured protocol as an interchangeable package implementation. Every choice must prove the same
contract. Replacement at a fresh grounded boundary is the default account-change mechanism. A
proven in-session switch is only an implementation exception when it independently satisfies the
same authority, credential-custody, pin, conformance, observation, and recovery requirements.

This document claims no deployment, runtime measurement, independent review convergence, or
operator approval. Independent design convergence and exact-content operator approval are the
design gate that permits implementation. After an implementation exists, the separate activation
gate requires executed three-tier, wiring, confinement, hostile-cut, stall-matrix, resource, and
live-hardware evidence for the exact Claude Code, Codex, or future tuple. It also requires the
applicable runtime evidence review. No implementation may be called active or live before that
second gate passes.

*Depends on: Parts One through Eleven, especially Part Five (`docs/09-the-run-graph.md`), Part Six (`docs/10-the-transport-and-leases.md`), Part Seven (`docs/11-the-judgment-doorway.md`), Part Ten (`docs/14-the-assembly.md`), and Part Eleven (`docs/15-the-operator-surfaces.md`).*
