## 16. Memory failures and the learning loop

**Value — a forgotten fact is evidence, and evidence should change the agent.** When the
operator has to say "I told you that", the agent's memory failed in a way the agent could not
see from inside the turn. Each such failure says something specific: a summary dropped the fact,
recall missed it, or it was in front of the agent and went unused; and when the original cannot
be found, the record says so rather than guessing. The aim
is an agent that forgets the same thing less often over time, by changing how it recalls, not by
writing a note about the failure and hoping a later session reads it.

**Rule — a memory failure is recorded from two model-judged signals, never from a word
list.** Rules 2, 10, 11, 12, 85 and 116; **checks: P21-NF-25/26**. A failure is recorded when:

- **the operator corrects a fact the agent stated.** The existing correction path already asks
  the answer model to name the agent's replies that restated the old fact (`replies`, or
  `in: "reply"` for a correction of the agent's own answer). A correction that names such a
  reply is a memory failure. An operator correcting their own earlier statement, which the agent
  never repeated, is a fact correction and records no failure.
- **the operator shows the agent should already have known something.** After any answer to the
  operator in a conversation, whether given from the whole history, from behind a summary, below
  the set-aside floor, or through a memory lookup, the next verified operator message there carries
  a structural offer, `memoryFailureDecision` with `searchedTurn` naming that answer. If the
  message shows the agent should have known something, the answer model returns `memoryFailure`
  with the clause of the message that states the fact and, when it can name one, the earlier
  message where the operator said it. The offer is placed by structure, never by the message's
  words. A full-history answer is offered too: a plain "I don't know" states no wrong value, so
  the correction signal cannot cover it. The offer is the packet's lowest-priority guidance and
  yields first under byte pressure, so a packet that fit without it still fits unchanged.

The runner stores the report on the turn's answer row only as validated: the quote must be the
operator's own words (otherwise the whole message, bounded, stands in for it), and a named source
must be an earlier operator message that preceded the failed answer (otherwise it is dropped, and
an exact earlier statement of the clause is looked for instead). Replay applies the same rule, so a
report the offer could not have carried fails replay. Both signals cover the four ways a failure
shows: an "I told you", a correction of a recalled fact, a memory search that found nothing for a
fact the journal holds, and a contradiction between what memory returned and what the journal says.

**Rule — the record says what was asked, what memory returned, the truth and the likely cause,
and the cause comes from recorded evidence.** Rules 2, 7, 13, 26, 39 and 108;
**checks: P21-NF-25/26**. Each failure names the trigger, the failed turn and its question, the
reply the operator saw with how many summarized turns recall offered and the lookup's words and
hits, the operator's words for the truth and the message that held it. The cause is read from the
failed turn's recorded packet grounding and the summaries in force then, not from the model:

| Cause | Recorded evidence |
|---|---|
| source unresolved | the report named no original and no earlier operator message states its words exactly; since a wording miss is not evidence of absence (Rule 11), whether the fact was stored is recorded as unknown |
| wrongly stored | the original was right, and a summary passage expressed the old value |
| summarized away | the original lay behind the summary, which kept neither the fact nor meaning cues for it |
| not retrieved | memory held the original (verbatim-reachable, or kept by the summary) and recall did not select it |
| shown, not used | the original was in the answer packet and the answer still missed it |

The record is a projection over durable rows: the answer rows, the memory changes and the failed
turn's grounding all replay unchanged after a restart, so there is no second store to lose or to
disagree with the journal.

**Rule — the learning loop changes recall, inside the one recall owner.** Rules 7, 8, 11, 24,
25, 55, 60 and 116; **checks: P21-NF-26/27**. Two lessons are derived from the failures on every
read, and both act through the existing recall owner rather than a new engine:

- **Retrieval hint.** When memory held the fact and recall missed it, or a summary dropped it, or
  the original could not be resolved (the reminder then holds the fact), the words of the
  question that missed are added to the meaning cues of the message holding the answer. The next
  question asked that way reaches it through the meaning index. At most twelve words per source.
- **Pinned fact.** When the same source fails twice or more, recall carries it on every turn whose
  verbatim history no longer shows it. At most four pinned facts, the most recently failed first,
  and each yields late under packet pressure through the existing drop order.

A source the operator has since forgotten or corrected teaches nothing and is never pinned: what
was withdrawn is not carried forward. Both lessons are bounded by construction and recomputed from
the journal, so they need no loop, timer or retry of their own.

**Rule — the operator can see it.** Rules 39, 78, 84 and 87; **checks: P21-NF-27**. The
operator's pull status reply carries one line: how many failures, by cause, and how many retrieval
hints and pinned facts are in force. The runner's read-only status record carries the same counts
by signal and cause and the latest five failures by update number; the quoted texts stay in the
journal, which the inspection surface reads. Nothing is pushed to the operator.

**Value — scope this design keeps honest.** A plain "I don't know" given with the whole
conversation in front of the agent is offered like any other answer, and its miss is classed as
shown, not used, from the recorded grounding. The model's
response to the new offer is proved on recorded room shapes and stub reports; the first live report
on a real root is what will measure how often the model makes one.

**Rule — fixture truth for this section.** Rules 34, 36 and 106; **checks: P21-NF-25/26/27**.
The proofs replay proof room two's recorded recall room (`fixtures/proofroom2-recallrank-2026-10-02.json`)
under its recorded index sample where the paraphrase question misses the fact, with the verbatim
real answers recorded for it: two answers that do not know the fact the journal holds, a memory
lookup that found nothing, and an ordinary answer that carries no report. The recorded operator
correction of their own statement (live updates 969389720 and 969389737) records no failure. The
reminder message and the model's report are stated as test inputs, because no recorded answer yet
carries the new field.
