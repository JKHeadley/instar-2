## 14. Operator decisions and honest limits

**Value — decision 1: preserve useful work within evidenced limits.**

The [purpose](../00-the-purpose.md#the-purpose) states: “A limit with no such source is a defect, and it is removed.” Rules 47 and 96 require actual grounding, and Rules 26 and 62 require honest evidence. A tuple that cannot establish required context consumption cannot claim grounded execution. It remains available for separately supported advisory work whose required context delivery is evidenced and whose limitations are stated. This does not waive required history or authorize an ungrounded operation; missing evidence is a repair task, not a reason to disable all useful modes. This is an engineering disposition under those rules, not a new operator opt-in.

**Value — decision 2: how much private session content to keep for diagnosis.**

Question: Beyond the required record of what was sent to and returned by the model, should diagnosis
keep only compact session events, or may it also keep short snapshots of what appeared in a session?

Background: Both choices still capture the exact model input and output required to audit each model
call. This choice affects only extra session diagnostic detail; snapshots can reveal more
private content and use more storage than compact session events.

Choices: Keep only compact extra session events, or also allow limited session snapshots for
approved problem categories.

What it changes: Compact extra events reduce the additional privacy and storage cost but do not
remove the required model-call record. Limited snapshots improve debugging for the approved
categories while increasing that additional exposure.

Recommendation: Keep only compact extra session events by default because snapshots should be
justified by a specific diagnostic need.

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

**Value — decision 4: judge understanding from work.**

The [purpose, constraint 6](../00-the-purpose.md#the-six-constraints) states: “An agent is accepted when a person has used it as they would in ordinary life and it met the mission, agency and self-knowledge statements above.” Delivery evidence proves what reached the model; real-use review judges the result. Inability to prove understanding in advance does not disable an otherwise supported tuple. Rules 26, 34, 62 and 96 retain actual delivery, grounding and outcome evidence.

**Value — decision 5: recover from provider history loss.**

The [purpose, constraint 2](../00-the-purpose.md#the-six-constraints) states: “A context, commitment, or decision that can drop with nobody noticing is a coherence leak, and it is a defect however well the feature works.” Rules 68 and 96 put work and grounding in Instar's durable record. Provider conversation retention is an optimization; losing it triggers a grounded replacement from that record, never a blanket ban on recoverable use or a repeat of uncertain effects.

**Value — decision 6: disclose the actual administrator boundary.**

The [purpose](../00-the-purpose.md#the-purpose) states: “An Instar agent ships able to do everything its role calls for.” Its safeguard rule requires independently administered protection, subject only to its express approval-account exception. The installation records its actual machine, administrator and safeguard custodian and proves the applicable boundary. It need not join a separately approved empty computer list. A missing required safeguard refuses the affected protected operation with that rule as its source; an installation meeting the floor supports its granted role on one machine. Administrator replacement remains an honest trust-boundary limit, not a claim of immunity.

**Value — decision 7: using a paid service whose final charge arrives later.**

The [purpose](../00-the-purpose.md#the-purpose) reserves sign-off for an effect that “commits money or a resource above the level the person named”. Inside the recorded role and that level, a capped service with delayed final billing remains available under the existing reservation and no-repeat rules. Maximum still-possible charge stays reserved until decisive evidence settles it. Missing enforceable bounds refuse under Rules 4, 55 and 60; no extra per-service or per-call approval is created. Other sign-off conditions, including sensitive matters, still apply.

**Value — honest limits.** No adapter can prove that a model understood supplied context, that a
provider will preserve a conversation forever, that an administrator cannot replace the runtime
or observer, or that an opaque vendor billing surface has no later charge. The design can prove
exact delivery boundaries, captured behavior, confinement within the tested host boundary, and
retained uncertainty. The onboarding role and applicable governed policy determine permitted modes;
these residual limits do not create another approval list.

**Rule — technical completion is not approval or certification.** Rules 30,
34, 49, 65, 82, 90, 109 and 115; **checks: P13-NF-02/07/43/44/45/47/48** and the governed review
process. Decisions 4–6 do not waive actual context delivery, current grounding, durable history,
output verification, confinement, or honest trust-boundary disclosure. Decision 7 cannot release
a reservation, close charge exposure, repeat an uncertain call, or claim bounded completion; a capped route accepts role-covered work under its existing uncertainty policy and the purpose's sign-off list.
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
