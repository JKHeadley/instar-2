# Changelog — `00-the-purpose.md`

_Generated from `00-the-purpose.changelog.json` by `scripts/render-changelog.mjs` — do not edit by hand._
The document itself reads as a first version; every change to it is recorded here, newest first,
each linked to the git change that made it (rule 91).

## Revision 12 · 2026-10-03 · approved — Operator Justin (verified) approved the exact sentence with 'yes please' at 12:20 PDT 2026-10-03 in topic 102965 (Telegram message 122028), answering the proposal to add to the purpose: 'The agent's ability is never reduced to satisfy a safeguard that a checkpoint can enforce instead.' Plan row #415.

- **Add the sentence 'The agent's ability is never reduced to satisfy a safeguard that a checkpoint can enforce instead.' to the constraints, closing the Value 'Rule 5: the agent does not widen its own authority', so the constraint on authority is paired with its counterpart on ability.** — The operator decided that where a safeguard can be enforced at a checkpoint, the agent keeps its ability and the checkpoint enforces the safeguard; removing ability is not an acceptable substitute. It sits beside Rule 5 as a Value because, like Rule 5, it is stated without a new check of its own. _(Operator approval: topic 102965, Telegram message 122028, 2026-10-03 12:20 PDT, 'yes please'; plan row #415)_

## Revision 11 · 2026-10-02 · draft — Operator amendment 2026-10-02: an operator may accept, by a recorded statement naming the account and installation, approvals from an account the agent can also use; disclosed, revocable; the agent's duty not to approve as the operator stated as a value. Operator direction: topic 102965 messages 121802 and 121804; exact wording ruled by the reviewer 12:22; exact-content approval pending at the time of this commit.

- **Amend 'the agent never administers its own safeguards' to carry one named exception: an operator may explicitly accept, in a recorded statement naming the account and installation, that approvals from an account the agent can also use count as the operator's yes. The exception changes only the approval-account access requirement; independently enforced safeguards stay independently administered, every approval taken under it carries the shared-access disclosure wherever it is recorded, displayed or exported, and the operator may withdraw the acceptance at any time. Extend the check to accept either the absent-access showing or a citation of the current recorded acceptance, and to require the withdrawal check and the disclosure. Add the value that the operator's approval remains the operator's act — with shared account access a duty, not an independently verified guarantee.** — The operator decided the approval rule stays the default but that he may override the agent-cannot-use-the-account requirement by a recorded acceptance; the exception is the smallest principle that permits it while keeping the loss of independence disclosed, revocable and never reported as verified. _(Operator direction: topic 102965, messages 121802 and 121804, 2026-10-02 12:10 PDT; reviewer wording ruling 2026-10-02 12:22; exact-content operator approval PENDING)_

## Revision 10 · 2026-09-29 · approved — Operator Justin (verified) approved the exact amendment wording with 'Yes' at 18:57 PDT 2026-09-29 in topic 102965 (message 2227093), relayed to the desk by the topic session and observer note #91: 'Instar may accept a recorded, one-use approval of an exact, unexpired request from an operator account held with a named service that the agent cannot use or administer, without a separate device signature or independent approval verifier, while independently enforced safeguards remain independently administered.' His 18:08 yes adopted the approval design (plan rows #91, #93).

- **Amend 'the agent never administers its own safeguards' to admit a recorded, one-use approval of an exact, unexpired request from an operator account held with a named service the agent cannot use or administer, without a separate device signature or independent approval verifier, and extend its check to name the service, the absent agent access path and one-use consumption.** — The adopted approval design is account-authenticated, which the signed-only clause rejected; the ruling's sentence is the smallest principle that permits it while keeping independently enforced safeguards independently administered and the evidence class honest. _(lanes/astra-approval-necessity-ruling.md (section 4 decision sentence); LIVE-PATH-PLAN.md row #91; topic 102965, 18:08 PDT 2026-09-29)_

Approved in: PR #139.

## Revision 9 · 2026-09-24 · draft — Bounded Slack second-channel constitutional amendment from astra-slack-closedset-ruling.md; operator approval PENDING; no merge or runtime activation.

- **Add the bounded Slack ordinary-reply send to the one-machine profile’s accepted closed set.** — The same durable-cause, exact P-08 membership, accepted loss model and no-repeat safeguards can support the bound operator’s Slack conversation. _(astra-slack-closedset-ruling.md, Exact minimal governing edits and approval procedure (2026-09-24); approval PENDING)_

## Revision 8 · 2026-09-21 · draft — Justin, verified operator, 2026-09-21 ~09:30 PDT: "again, the driving rule/standard should be: an instar agent with only one avaiblable machine should still be FULLY FUNCTIONAL". Reaffirms the 2026-09-19 supported single-machine ruling. Draft for operator approval; actual HEAD/base 76b60b6984a4628e976fb5fdd83a5976390cc7d1; edits unstaged, desk owns commit.

- **Require a fully functional single-machine installation as a general Rule with a review Check.** — A reading that makes a needed function impossible on the supported one-machine shape is a wording defect; safeguards remain intact. _(Operator conversation, 2026-09-21 ~09:30 PDT; astra-m4-launch-amendment-review-d0e4ace.md finding 1; astra-m4-launch-amendment-ROUND2-DONE.md, The operator's remaining question; draft against 76b60b6984a4628e976fb5fdd83a5976390cc7d1)_
- **Limit the existing provider/reply closed-set acceptance and membership check to irreversible effects; separately require all four ordinary-operation tests, finite enforced bounds and the whole causal record durable at least locally.** — The two operations were singled out because the agent cannot undo them alone. Ordinary reversible bounded work must have a supported local path without widening that irreversible set. _(Operator conversation, 2026-09-21 ~09:30 PDT; astra-m4-launch-amendment-review-d0e4ace.md finding 1; astra-m4-launch-amendment-ROUND2-DONE.md, The operator's remaining question; draft against 76b60b6984a4628e976fb5fdd83a5976390cc7d1)_
- **State the one-disk loss cost and why it is acceptable under all four tests.** — The record of a reversible bounded operation may be lost with the disk; uncertainty does not authorize repetition or weaken irreversible-effect protection. _(Operator conversation, 2026-09-21 ~09:30 PDT; astra-m4-launch-amendment-review-d0e4ace.md finding 1; astra-m4-launch-amendment-ROUND2-DONE.md, The operator's remaining question; draft against 76b60b6984a4628e976fb5fdd83a5976390cc7d1)_

## Revision 7 · 2026-09-19 · draft — operator amendment requiring compatibility when only one machine is available

- **State durable authorization and causal preparation as the invariant and make the fixed single-machine installation a supported deployment shape rather than a proposal.** — Replica count remains operator policy, while the installation must work without inventing a peer when only one machine exists. _(`1b5ac4c`)_
- **Bind one install-time acceptance to the profile-enumerated provider-call and reply-only Telegram operation set and its permanent-loss model.** — The operator accepts the fixed set once for the installation instead of hand-listing each operation. _(`1b5ac4c`)_

## Revision 6 · 2026-09-19 · draft — M2 independent design review 1 repair R5 and governed-body history cleanup

- **Keep the local-loss text as a proposal pending independently verified operator acceptance while removing pull-request process wording from the governed rule.** — Authority comes from the operator's entered acceptance, not from review-history language in the purpose body. _(`f106575`)_

## Revision 5 · 2026-09-19 · draft — operator-directed M2 proposal for one explicitly scoped single-machine installation; acceptance or rejection belongs to the pull request

- **Propose a narrow P-08 local-loss exception for exact listed operations with complete local causal durability, while retaining the independently failing second-machine peer as the default and fallback.** — The approved policy register and Parts Eight and Ten permit a recorded local-loss policy, while the purpose previously required an independently failing copy without stating how that operator policy could apply. _(`1b960e7`)_

## Revision 4 · 2026-09-14 · approved — operator's direction in topic 52075 on 2026-09-14 ('three tiers'): the constitution holds general principles and amends rarely; specific operating choices belong to a per-deployment operator policy register; the first application of the gap rule had produced 19 over-specific candidate amendments; approved by the operator in topic 52075 at 02:59Z 2026-09-14 ('Approved 75 and 76')

- **The gap Rule's check now recognises three dispositions (decided by this document; operator policy per deployment, recorded in a policy register; agent-owned engineering default) and makes amendments rare general principles.** — Applied literally, the first check turned every undecided deployment choice into a proposed constitutional amendment. _(topic 52075, operator messages of 2026-09-14 02:36Z and 02:51Z; docs/harvests/decisions-sweep-2026-09-13.md)_
- **Five general principles added: the agent never administers its own safeguards; least revelation; nothing outward by default; an irreversible act outlives the machine that decided it; automatic suggestions never widen themselves.** — These are the general principles the 19 candidates reduced to; each decides a class of questions, and its deployment-specific defaults move to the policy register. _(docs/harvests/decisions-sweep-2026-09-13.md consolidated candidates CA-01, 03, 04, 05, 06, 07, 09, 10, 13)_

Approved in: PR #75, merge `296bf4235`.

## Revision 3 · 2026-09-13 · approved — operator's confirmation in topic 52075 on 2026-09-13 that undecidable design questions are constitution gaps; the memory design's decision 5 (which effects get an extra history check) was undecidable because 'consequential' had no definition; approved by the operator on GitHub (review) and in topic 52075 at 00:06Z 2026-09-14

- **Added one constitutional definition of a consequential effect (four tests), of user-facing, and of significant/critical resolving to consequential, with a registration-time classification check on the effect doorway.** — The rule book records that rules 34, 38, 43, 62 and 76 are blocked on 'significant', 'critical' and 'user-facing' having no definition; the memory design's decision 5 was undecidable for the same reason. _(rule book: 'Rules 34, 38, 43, 62 and 76 hinge on significant, critical, or user-facing'; memory design section 15 decision 5; topic 52075)_

Approved in: PR #71, merge `e281a2c27`.

## Revision 2 · 2026-09-13 · approved — operator direction in topic 52075 on 2026-09-13: wisdom in the use of knowledge is the aim above coherence, and the constitution must be complete enough to decide every design question; approved by the operator in topic 52075 on 2026-09-13 23:26Z ('approved')

- **Added the Value 'wisdom is what coherence is for': coherence is the precondition; the aim is wisdom in the use of knowledge, with complete recall as the baseline and recorded, graded use-or-withhold judgment above it.** — The purpose named coherence, trust, sovereignty and alignment but not wisdom; rule 57 bounds judgment without naming its growth as a goal. The operator stated that wisdom is core to the project. _(topic 52075, operator message of 2026-09-13 22:48Z)_
- **Added the Rule 'a design question this document cannot decide is a gap in this document', with the check that every part design's decision list names the purpose statement, pillar, or constraint that decides each question, and that an undecidable question is filed as a candidate amendment.** — The operator asked that the constitution work as a north star complete enough to give every design decision a clear answer, and that unclear decisions be treated as evidence of what the constitution is missing. _(topic 52075, operator message of 2026-09-13 23:02Z)_

Approved in: PR #69, merge `c83db0106`.

## Revision 1 · 2026-09-05 · approved — the purpose, the name, and the decision boundary

- **Initial purpose statement, the four pillars, the five constraints, and who decides what.** — Every other document is written in service of this one. _(PR #19)_

Approved in: PR #19, merge `192bf356e`.
