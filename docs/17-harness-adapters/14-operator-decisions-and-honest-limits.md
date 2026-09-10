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

**Value — decision 4: how to handle limits that cannot be proved away.**

Question: For each exact setup, should we accept a clearly stated unprovable limit, or keep that
setup unavailable?

Background: Examples include proving that a model understood supplied information, that a provider
will preserve a conversation forever, that an administrator cannot replace an observer, or that a
vendor will never post a later charge.

Choices: Accept the named limit for that exact setup, or keep that setup unavailable.

What it changes: Acceptance makes the setup available with that limit. Keeping it unavailable
avoids offering a guarantee that the evidence cannot support.

Recommendation: Keep the setup unavailable until concrete evidence makes its remaining limit
specific enough for deliberate acceptance.

**Value — honest limits.** No adapter can prove that a model understood supplied context, that a
provider will preserve a conversation forever, that an administrator cannot replace the runtime
or observer, or that an opaque vendor billing surface has no later charge. The design can prove
exact delivery boundaries, captured behavior, confinement within the tested host boundary, and
retained uncertainty. The operator decides whether those residual limits are acceptable for each
mode.

**Rule — technical completion is not approval or certification.** Rules 30,
34, 49, 65, 82, 90, 109 and 115; **checks: P13-NF-02/07/43/44/45/47/48** and the governed review
process. Activation is mandatory for each exact harness package and artifact digest, registered
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
