## 15. Operator decisions and honest limits

**Value — proposed defaults need an answer.** All six decisions are open. The recommendations
are proposals, not recorded operator answers. Accepting the research does not approve these
choices, authorize spending, or permit an additional blocking check. Silence is not consent.

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

Recommendation: Use balanced coverage because the goal is reliable everyday help across all
four situations, including when you do not explicitly ask the agent to remember.

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

Recommendation: Choose separately permitted private use because it can preserve useful
connections while keeping permission to reveal the information separate.

**Value — decision 3: how long better remembering may take.**

Question: How much extra waiting would you accept for the agent to check relevant history?

Choices: Keep it brief; allow a short check; investigate further when I ask.

What it changes:

- Keep it brief prioritizes a prompt reply with an explanation when evidence is missing, so
  some hard connections may remain unresolved.
- Allow a short check aims to add at most two seconds to ordinary conversation and fifteen
  seconds before a major action, with potentially more running cost for the harder checks.
- Investigate further when I ask keeps the ordinary limit short but permits a separately
  agreed time and spending limit for a difficult case.

Recommendation: Allow a short check because it gives relevant history a chance to help without
turning routine conversation into a long investigation.

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

Recommendation: Report both separately over four weeks of repeated interactions because the
result should explain where the agent helps, without hiding the advantage of searchable records.

**Value — decision 5: which major actions deserve an extra history check.**

Question: For which actions would an extra check against earlier conversations be worth a possible delay?

Background: This proposed check looks for an earlier promise, restriction, or conflicting statement
that matters to the action; it would need separate approval before it could delay anything.

Choices: No extra check before acting; email and public posts; all listed major actions.

What it changes:

- No extra check before acting keeps existing safeguards and reviews mistakes afterward, so
  it avoids added delay but misses a chance to catch a historical mistake before it happens.
- Email and public posts adds that chance when earlier exchanges matter to those messages,
  with possible delay or an unnecessary wait.
- All listed major actions also covers publishing software updates, payments, and other specifically agreed
  actions that cannot be undone when earlier exchanges matter, increasing coverage and possible delay.

Recommendation: Propose all listed major actions because a forgotten commitment can matter
beyond messages, but activate this extra check only after it proves useful and receives approval.

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

Recommendation: Try for five minutes because missing information may become available without your
help, while the time limit and updated notice keep the wait visible and finite.

**Rule — decisions stay within explicit ownership and approval.** Rules 7, 11, 13, 28, 42,
57, 66, 77, 82, 86, 90, 93, 94, 95, 98, 103, 108 and 111;
**checks: P21-NF-02/06–09/13–16/18/20–24**. Decision numbers map to stable ids OD-01
through OD-06 in order. OD-01 changes evaluation emphasis, not the all-setting recall contract
in sections 2/5. Incident evidence collection is separate: section 10 requires an authorized
failure, comparable success and missing-source/legitimate-hold control per setting through
`P21-INCIDENT-REPLAY-v1`; the four reported causes remain UNKNOWN until supplied.
OD-02 consumes section 5's current scope policy; its private-use option remains inactive until
that policy is enforceable. OD-03 selects an experience; section 7 holds the engineering caps,
pricing snapshot and proposed US$25 pilot ceiling. Current authorized spend is US$0; a paid run
requires separate explicit approval. Section 10 freezes statistical and false-hold thresholds
before any evaluation, including the proposed C unnecessary-hold target below 1%, which the
small pilot cannot certify.

OD-04 maps to `P21-HUMAN-01` in section 10, with independently graded dimensions and a frozen
population, tools, time allowances and precision plan. OD-05 is an interest/policy choice,
not a waiver: section 8's rulebook reconciliation, measured evidence and exact exception
approval remain mandatory. Ordinary chat cannot acquire a semantic blocking reviewer.
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
No recommendation here changes that posture.

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
