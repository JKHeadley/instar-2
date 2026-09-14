## 15. Operator decisions and honest limits

**Value — decisions are derived from the constitution.** Each of the six decisions below names
the purpose statement, pillar, or constraint that decides it, under the purpose's Rule that
“a design question this document cannot decide is a gap in this document.” The agent owns
measurement and tuning within those constraints. Decision 5 depends on the candidate purpose
amendment in PR #71, whose approval remains the operator's. These decisions authorize no
spending or additional blocking check. Silence is not consent.

**Value — decision 1: where to measure better remembering first.**

Question: Which everyday situations should get the most attention in the first trial?

Choices: Balanced coverage; long conversations first; connections across conversations first.

What it changes:

- Balanced coverage gives equal attention to long chats, other chats, email, and information
  from other people or agents, but learns less about each from a small trial.
- Long conversations first gives a clearer early answer about forgetting within one chat,
  while evidence about the other situations takes longer to collect.
- Connections across conversations first emphasizes whether earlier email and other exchanges
  help later work, while same-chat improvements receive less early study.

DECIDED: Balanced coverage. The purpose's constraint Rule 2, “nothing that mattered is
silently lost,” applies to every channel equally; the coherence pillar requires continuity
across sessions, machines and time. Together they decide equal initial coverage across all
four situations, including when the user does not explicitly ask the agent to remember.
Owner of the measurement tuning: the agent.

**Value — decision 2: using information learned from someone else.**

Question: How should information learned from one person help in conversations with someone else?

Background: Permission to use something privately and permission to tell another person are
separate; remembering a private detail does not make it shareable.

Choices: Shared information only; separately permitted private use; an agreed shared group.

What it changes:

- Shared information only means cross-person help uses information explicitly cleared for that
  audience, so useful private connections may be missed.
- Separately permitted private use lets private information improve help only with permission
  for that use, while revealing it still needs separate permission.
- An agreed shared group lets members benefit from information explicitly shared within that
  group, while anything outside the agreement stays restricted.

DECIDED: The floor is separately permitted private use. Rules 86 and 95 decide a
deterministic, fail-closed permission boundary because disclosure is irreversible: permission
to use a fact privately never grants permission to reveal it. This is enforcement of recorded
permission, not a low-context judgment of meaning.

Above that floor, the purpose's Value “wisdom is what coherence is for” governs use-or-withhold
judgment. Sensitivity is assessed per fact; every judgment is recorded with its reason and
graded against outcomes under the grader's standing. Rule 57 keeps judgment within the
permission floor: it may narrow permitted use, never widen authority. The follow-on owner
design, “judgment of use,” specifies that layer; it is not specified here.

**Value — decision 3: how long better remembering may take.**

Question: How much extra waiting would you accept for the agent to check relevant history?

Choices: Keep it brief; allow a short check; investigate further when I ask.

What it changes:

- Keep it brief prioritizes a prompt reply with an explanation when evidence is missing, so
  some hard connections may remain unresolved.
- Allow a short check aims to add at most two seconds to ordinary conversation and fifteen
  seconds before a consequential effect, with potentially more running cost for the harder checks.
- Investigate further when I ask keeps the ordinary limit short but permits a separately
  agreed time and spending limit for a difficult case.

DECIDED: Allow a short check, initially about two seconds for ordinary conversation and
fifteen seconds before a consequential effect. Rule 77, “the user experience is the product,”
decides timely, coherent help and measurable reachability and response time. These durations
are initial tuning owned and measured by the agent, not a policy question or a claim of
measured performance. Section 7 holds the engineering caps and separate spend authorization.

**Value — decision 4: what better than human remembering should mean.**

Question: Should the agent be compared with people remembering unaided, people searching their
records, or both?

Choices: Unaided memory; searchable records; report both separately.

What it changes:

- Unaided memory shows how the agent compares with what people remember without looking
  things up, but gives the agent an advantage from its archive.
- Searchable records tests whether the agent helps more than a person who can look up the
  same exchanges, but takes more participant time.
- Report both separately shows each comparison clearly, but requires a larger study.

DECIDED: Report unaided and record-assisted human recall separately over four weeks of
repeated interactions. The purpose's wisdom Value decides this measurement method: wisdom
is measured, never conferred. Separate results expose the archive advantage and show where
the agent helps. The agent owns the method, with the frozen comparison and grading contract
in section 10; this decision does not authorize paid study work.

**Value — decision 5: which major actions deserve an extra history check.**

Question: For which actions would an extra check against earlier conversations be worth a possible delay?

Background: This check looks for an earlier promise, restriction, or conflicting statement
that matters to the action. Its activation still requires the approvals and evidence in
section 12.

Choices: No extra check before acting; email and public posts; all listed major actions.

What it changes:

- No extra check before acting keeps existing safeguards and reviews mistakes afterward, so
  it avoids added delay but misses a chance to catch a historical mistake before it happens.
- Email and public posts adds that chance when earlier exchanges matter to those messages,
  with possible delay or an unnecessary wait.
- All listed major actions also covers publishing software updates, payments, and other specifically agreed
  actions that cannot be undone when earlier exchanges matter, increasing coverage and possible delay.

DECIDED BY: The consequential-effect definition in purpose revision 3 (PR #71). The extra
history check covers exactly the effects that pass any of its four tests:

- The effect cannot be undone by the agent alone.
- It commits money or a resource above a level the operator names.
- It reaches outside the scope the operator granted for the work.
- It touches a matter the operator has marked as policy-sensitive.

Email, public posts, releases and payments are instances, not the definition. The effect
owner applies the constitutional classification; the operator owns the threshold and policy
markings. A qualifying effect does not bypass section 8's historical-prerequisite selector,
owner checks, measured-benefit requirement or exact exception approval. This decision is
pending the operator's approval of revision 3; until then the live-review arm stays inert exactly as section 12 already requires.

**Value — decision 6: what happens when an action needs missing evidence.**

Question: When an otherwise permitted action needs evidence the agent cannot yet find, how should it wait?

Choices: Tell me immediately; try for one minute; try for five minutes.

What it changes:

- Tell me immediately makes no automatic recheck and leaves the action unresolved for your
  next instruction, with one notice explaining the missing evidence.
- Try for one minute makes bounded rechecks, shows one waiting notice and updates it with
  the result; if time runs out, the action stays unsent and awaits your instruction.
- Try for five minutes gives a temporary outage longer to recover, with the same single
  updated notice; if time runs out, the action stays unsent and awaits your instruction.

DECIDED: Rule 95 decides the fail direction: a consequential effect missing required evidence
fails closed and waits; reachability fails open. The agent owns the initial tuning of a
five-minute window, at most two rechecks and one logical notice updated with the result.
These numbers bound recovery and make the wait visible; they do not grant authority or
release an unresolved effect when the window ends.

**Rule — decisions stay within explicit ownership and approval.** Rules 7, 11, 13, 28, 42,
57, 66, 77, 82, 86, 90, 93, 94, 95, 98, 103, 108 and 111;
**checks: P21-NF-02/06–09/13–16/18/20–24**. Decision numbers map to stable ids OD-01
through OD-06 in order. OD-01 changes evaluation emphasis, not the all-setting recall contract
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
population, tools, time allowances and precision plan. OD-05 derives the qualifying effects
from the pending constitutional definition; it grants no waiver. Section 8's rulebook
reconciliation, measured evidence and exact exception approval remain mandatory. Ordinary chat cannot acquire a semantic blocking reviewer.
OD-06 chooses only waiting duration and notifications. The effect owner retains the exact
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

Questions for the operator — judgment questions: [] (none).

Pending item:

- decision 5 rests on purpose revision 3 (PR #71), awaiting operator approval.

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
