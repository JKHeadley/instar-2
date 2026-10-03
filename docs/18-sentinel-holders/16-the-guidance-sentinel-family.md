## 16. The guidance sentinel family

**Value — guidance empowers; it never removes an ability.** The holders above notice when work has
stopped. A second kind of sentinel watches the agent's own outbound words and actions while it is
working: a cannot-do that is not true, a task handed back that the agent could finish, a promise of
later work that nothing tracks, a claim about itself that its own records contradict, a preference the
operator has already stated and the reply ignores. The aim is a more capable agent: each finding goes
back to the agent as advice it answers, and the agent stays free to keep what it judges right. The
family carries forward the substance of four Instar 1.x mechanisms: the outbound tone gate with its
self-stop family, the deferral detector with action-claim follow-through, claim verification, and
correction and preference learning with its self-violation signal. It leaves out the 1.x shapes the
rule book retired: a live gate that fails closed on an unavailable model, and a keyword verdict.

**Rule — the family is questions on the one reply review, never a second gate.** Rules 4, 10, 12,
57, 66, 86 and 116; **checks: P14-NF-70/71**. Every model-written reply already passes one pre-send
review: Jev reads the reply text against fixed questions, and whatever Jev leaves unresolved goes to
one batched full-context review of the same answer packet, with one exact line per question. Each
guidance member is a named subset of that review's questions:

| Member | Its questions on the reply review | Its arm on the retrospective consumer | How the agent is corrected |
|---|---|---|---|
| Tone and self-stop | `raw_path`, `cli_command`, `config_key`, `api_endpoint`, `quits_on_self`, `claims_blocked`, `parks_on_user`, `unrecorded_blocker` | gravity wells `fatigue-stop`, `needless-deferral` | it answers each objection (accept, or keep its draft with a reason); a real limit is kept and recorded as an investigation, never talked away |
| Deferral | `defers_work` | gravity well `needless-deferral` | it does the work now, or declares the deferral as a loop the runner admits and tracks |
| Claim verification | `self_state_claim` | gravity wells `false-completion`, `invented-memory`, `false-certainty` | it restates the claim to match its recorded state |
| Correction learning | `breaks_preference` | duty `feedback` | it brings the reply back within the operator's active preference |

The credential question is the reply review's exact floor (Rule 4's live secret), not a guidance
member. Claim verification and correction learning judge a reply against the journal's own records:
the self-state and capability sources, the dated items, the declared obligations and
`packet.preferences`. Jev reads only the reply text, so these two **context questions** are never asked
of Jev; they are added to every full-context review that runs, inside the same call. A reply Jev clears
is sent exactly as before, with no new call, no new latency and no new way to hold it.

**Rule — a guidance finding is a signal the agent answers.** Rules 4, 19, 42, 57, 77, 86, 95 and
108; **checks: P14-NF-71**. A guidance objection reaches the agent through the review's existing single
response round inside the shared reply deadline, and the agent's answer is recorded per objection:
accept, reject with a stated reason, or no decision. No guidance member holds a reply or creates a
block. The only whole-reply floor is the credential wall, which belongs to the reply review. The review's
claim-scoped floor removes only a sentence the full-context reviewer named verbatim as an untracked
deferral or an unevidenced cannot-do (Rule 4's deterministic enforcement of a recorded judgment, with
Rule 86's full-context authority). An unavailable review releases the reply with its objections
recorded as unconfirmed, never as a veto.

**Rule — the reviewer's named claim reaches the send it named.** Rules 2, 4, 42 and 86; **checks:
P14-NF-75**. The removal of a named claim locates the claim through the differences a quote carries
without changing its meaning: quote and dash style, spacing, the punctuation the quote ends on, a
trailing ellipsis, and an ellipsis that elides the quote's middle, provided every quoted part is long
enough to be a claim on its own and the parts appear in order inside one sentence. A quote that is not
the reply's own words locates nothing and is recorded as unlocated. A reviewer verdict delivered as an
object whose only field is a string `reply` is read as those verdict lines; any other object stays a
format miss.

**Rule — every member's verdict is measured from durable history alone.** Rules 2, 9, 39, 41, 58,
108 and 116; **checks: P14-NF-72/74**. The family keeps no store of its own. Each member's verdict on
each reviewed reply is projected from what the journal already records: the checks, the per-question
findings, the objections the send carried, the agent's answer to each, and what the send actually
carried. The verdict is one of: fired (a confirmed objection reached the agent), unconfirmed (only Jev
flagged it, with no full-context verdict), clear (judged, nothing found) or not asked. A question no
check judged is reported as not asked, never as clear. Each fired verdict records where the correction
went: the agent's corrected draft was sent, the named claim was removed, the claim could not be located,
the reply was held, the reply went unchanged with the objection recorded, or an older row that recorded
no send record. A sent landing counts only with the transport's receipt: the send record is written
before dispatch, so a send with no receipt (a crash, a refusal, an unknown outcome, or an older capture
that kept none) is recorded as no receipt, with what it selected kept beside it, and never as landed. Correction learning also measures recurrence: the operator stating the same preference
clause again after it was already on file is counted as a restatement. Identity is the journal's own
exact clause, never a keyword match, and a preference recorded from the agent's own reply is not a
correction. The runner's read-only status record carries the per-member counts and the recurring
preferences by source id, never the clause text.

**Rule — every member is proved on recorded live replies.** Rules 34, 36, 43, 106 and 107;
**checks: P14-NF-73**. The proof replays bytes captured from a copy of the live preview journal, never
the live root, and real full-context reviewer outputs on recorded answer packets with this family's
question selection:

| Member | Recorded case | What the replay shows |
|---|---|---|
| Tone and self-stop | update 969390016, 2026-10-02 22:36 PDT: "I can't raise my own model-call limit…" | `unrecorded_blocker` fired; the agent's response round came back uncertain, and the reviewer's elided quote could not be located, so the reply went unchanged; the quote is now located and the named sentence is removed. Update 969390038's comma-ended quote is located; update 969389954's paraphrased quote still locates nothing |
| Deferral | update 969389883 | `defers_work` fired on the full-context review and the reply was held |
| Claim verification | update 969389926 | its live review ran (Jev unsure, then a full-context pass); with the context questions, the real reviewer finds that its own self-claim contradicts its dated records; on 969389883 and 969390016 the records support the claims and it passes |
| Correction learning | updates 969389742, 969389767 and 969389924 restate one preference; reply 969389923 is three sentences | two restatements are measured; the real reviewer finds 969389923 breaks the preference and the two-sentence 969389925 keeps it |

**Value — honest limits.** The context questions reach only replies the full-context review sees: on
the recorded live journal that review ran on 207 of 410 reviewed replies. A reply Jev clears is covered
by the retrospective arms, not live; asking Jev a context question on every reply would widen live
coverage at the cost of a contextual review on most replies, and the measurement above is what decides
that engineering default. The recorded journal also shows the cost of the shared reply deadline: the
tone and self-stop member fired on 23 replies, and the agent's corrected draft never once reached the
send. These counts are measured, not promised, and the status record reports them as
they move.
