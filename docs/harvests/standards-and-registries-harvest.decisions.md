# Decision sheet — the 33 tensions

**Status: draft, awaiting the operator's remaining rulings. Read this page only; the evidence behind each line is in the harvest beside it (Part 3, same numbers).**

How to use it: each line is a question, then the proposed answer, then one sentence of why.
Five lines you have already ruled on — they are recorded at the top and need nothing more.
Three are reworked from your review comments and need a confirm. Two are re-explained and
need a first ruling. The rest are restated in plainer words for your wave-through: reply
per line, or "all except N and M".

## Ruled (your review of Aug 25 — recorded, nothing more needed)

**3. Who merges?** — Ruled: I merge anything that is honestly green. You are asked only about changes to the constitution and to a short protected list the register names. If main moves while an approval is waiting, the request is re-issued, not left hanging. *(Your comment: "Agreed.")*

**11. When a rule's letter gets in the way.** — Ruled: breaking the letter of a rule needs your waiver, given before the act; without it, the act is a violation even when the outcome was good. **With your amendment:** waivers are collected proactively as feedback on the rules themselves — every waiver is recorded, and a rule that keeps needing waivers is a rule that should evolve, with the waiver record as the evidence that drives the change. *(Your comment: "Agreed, but we should be proactive about this and collect waivers as feedback as to how the rules might evolve.")*

**16. When work stops, and when the next window starts.** — Ruled: a window closes when its exit test passes or is proven unreachable, never on the clock — the clock is only a safety ceiling. A solvable constraint is never a reason to stop. The next window starts on its own the moment the boundary review is posted. *(Your comment: "Agreed.")*

**20. When the PIN is needed.** — Ruled: the PIN is required only above a spend threshold you set and for arming a paid door the first time. Below that, your written yes from your verified account is enough, recorded by message id. *(Your comment: "Agreed.")*

**27. Do your directives expire?** — Ruled: never on a timer. A directive from you holds until you supersede it or it is done. *(Your comment: "Agreed.")*

## Reworked from your comments — confirm the wording

**17. How often a session reports, and to whom.** — Your comment: the observer/orchestrator/worker roles come from the 1.x "converge to coherence" effort, not from Instar fundamentals — and corrections should be rare because the checks are tuned well, not forgiven by a cadence. Reworked answer: the fundamental is only this — every autonomous session has a check-in cadence; the default is one hour; it is adjustable per session and per role by whatever charter governs it. A correction to a wrong claim always goes out promptly, outside the cadence — and a session that keeps correcting itself has a defect in its checks, which gets fixed at the source rather than absorbed by the cadence. The convergence-effort structures (paired observers, orchestrator, tenets) stay a 1.x working pattern; whether any of them become Instar fundamentals is a real discussion I propose we hold when we design the 2.0 execution model in the types step — it is noted as an open loop so it cannot be forgotten.

**19. Which checks may decide, and what a dumb check may do.** — Your comment: the old line conflated two questions, so here they are separately. **(a) What may a check with no model behind it do?** Decide on its own only where the test is exact and a miss is irreversible: a live secret leaving, spend past a cap, your emergency stop. **(b) Which checks decide at all, versus inform?** Deciding power belongs to a short, named list in the register; every check not on that list — dumb or smart — only informs and advises, and the agent makes the call. In both cases a block preserves its input: no check ever destroys state.

**23. What a new session must read.** — Your comment: this tension came out of the convergence work, but the general thing underneath matters. Reworked answer: a new session reads the full history of its topic, up to a generous size threshold; history beyond the threshold is covered by rolling summaries kept current by background jobs. Substituting memory, or a partial skim, for that read is a violation whether declared or not.

## Re-explained — these two need a first ruling

**2. May an exact-match check ever block?** — Plainly: two of your rulings collide. One says a check that just matches strings must never block a message — only a judge that understands the full context may. The other says some protections must be deterministic — a literal live credential in an outbound message is stopped cold, no model consulted. The question is which wins. Proposed: write the exception into the rule — exact-match blocking is allowed for exactly two things, secrets and money; everywhere else an exact match may only flag, never block. *Why: those two are the cases where a single miss is irreversible and the match is unambiguous.*

**26. Two copies of the constitution now exist.** — Plainly: the 1.x repo carries the constitution today, and this repo now carries its own copy of the same rules — and the two will drift apart as 2.0 evolves, which your own no-drifting-copies rule forbids. The question is whether the 2.0 copy is allowed to exist as a deliberate fork. Proposed: yes — on the condition that the register carries an open item, "reconcile the two constitutions", with an owner and a date, and the build fails if that date passes silently. *Why: that keeps both of your rulings true at once — the fork you ordered, and no silent drift.*

## The rest, in plainer words

**1. When is a review finished?** — When findings stop changing the outcome — the 80/20 judgment, made by an independent reviewer, never by the author. Round counts are a floor and a confusion detector, not the stopping rule.

**4. Which machine runs what.** — Sessions are placed by role, not by load: coordinating sessions stay where they started, workers may go to the second machine. Nothing moves without the gate asking first, and a move in progress carries an expiring "on the way" label.

**5. When a check breaks, which way does it fail?** — Decided per consumer of the check, not per check: anything about reachability fails open (you can always reach me), anything about changes and releases fails closed (nothing ships unverified). A gate that is holding must look different from a gate that is dead.

**6. Is red-then-green ever acceptable?** — On a branch, yes. On main or at merge, never. A test whose result depends on the calendar or on a live server is quarantined until the cause is pinned down.

**7. Plain English versus your exact words.** — When quoting you, your exact words win. Plain-language rules may still use proper nouns. Evidence that would itself trip a filter travels by a channel the filter does not review.

**8. What counts as "approved"?** — The merge commit is the record of approval. Your "yes" in chat is the authorization that permits the merge, kept as provenance by message id. When a document and a chat message disagree, the document wins and the difference is recorded.

**9. How rules relate to each other.** — A rule declares its parent; children are derived, never hand-maintained. Merging rules never deletes one — the merged rule survives as a named subsection. A citation to a superseded rule keeps pointing at it.

**10. Is silence a yes?** — From you, never. Between agents, silence past a declared deadline counts as concurrence.

**12. The strongest model always, or scheduled checks?** — Scripts detect, minds judge. Judgment review is retrospective on a strong model by default; live judgment is reserved for irreversible moments. The second reviewer runs on a different model family, and a watch exists for a judging lane being quietly downgraded to a weaker model.

**13. What the second observer may do.** — Review, not authorship. Pushing back before an action — including refusing to produce an artifact that merely matches a manager's wording — is a sanctioned outcome, not obstruction.

**14. Reporting on a feature that is switched off.** — A result about a dark feature is still a result, and it goes out. "Silent by default" applies to chatter, never to findings.

**15. What is recorded, and what is shared.** — Internally, everything is captured and recoverable — text everywhere, images only where no text form exists. Anonymization happens only at the moment something leaves, never at capture.

**18. Numbers versus judgment.** — A judgment must cite its numbers; the numbers alone are never the verdict.

**21. Does approving a result forgive a skipped step?** — No. The result stands; the skip is recorded as a violation anyway.

**22. Can "I need this" turn a feature on?** — Yes. Your stated need is a valid path to going live, recorded as operator-directed, with the evidence gathered afterwards.

**24. What docs-only commits may carry.** — Evidence and deferral records, yes. Rule text or tracking markers that skipped review, never.

**25. When is a check advisory?** — Only when the register says so. A red required check is red, full stop. Overriding a verdict needs a citation and a stated condition under which the override dies, and the override is recorded.

**28. One thing at a time — for whom?** — For the orchestrator's own hands. The delegated pool runs in parallel.

**29. Does a foundational spec pay the full review cost?** — Yes. The exemption is for one small pull request, not for one foundational spec.

**30. Fix first, or study the failure class first?** — When you are blocked, restoring you comes first. The class review follows, in the record.

**31. First failure versus repeat failure.** — The first occurrence of a new failure births a standard; a recurrence against an existing standard is a defect. The corrections register is what tells the two apart.

**32. Where big evidence lives.** — Governed does not mean on main. The register records a durable location for each governed thing; a large corpus lives on a named, protected branch or tag.

**33. Is one quiet re-run acceptable?** — The first red is the defect, and a defect is filed either way. A re-run may only gather evidence; passing on the re-run is never exoneration.
