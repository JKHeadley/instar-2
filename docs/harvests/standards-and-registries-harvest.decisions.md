# Decision sheet — the 33 tensions, one line each

**Status: draft, awaiting the operator's rulings. Read this page only; the evidence behind each line is in the harvest beside it (Part 3, same numbers).**

How to use it: each line is a question, then my recommended answer, then one sentence of why.
Reply "yes" to a line, or overrule it in your own words. Nine lines are marked **your call** —
those are the ones worth stopping on. The other twenty-four I expect you to wave through.

## The nine that are genuinely your call

**3. Who merges, and how many human gates?** — *Recommend:* I merge anything that is honestly green. You are asked only for changes to the constitution and to a short list of protected paths that the register names. An approval wait may never outlive the proof it approves; if main moves, the request is re-issued, not left hanging. *Why:* this is the one place the record has you saying both "don't wait on me at all" and "approve constitution changes, that's it" — both hold if the protected list is written down. **Your call.**

**11. Letter versus purpose.** — *Recommend:* deviating from the letter of a rule is allowed only by your waiver, given before the act. Disclosure afterwards does not make it authorized; it is recorded as a violation, even when the outcome was good. *Why:* the alternative lets every agent decide for itself when the rule doesn't apply. **Your call.**

**16. When work may stop, and when the next window starts.** — *Recommend:* a window closes the moment its exit test passes or is proven unreachable, never on the clock; the clock is only a safety ceiling. A window with nothing left to do and the exit test unmet closes as failed, not idle. A solvable constraint (memory, quota with tools to fix it) is never a reason to stop. The next window starts on its own the moment the boundary review is posted — it does not wait for your "go". *Why:* you ruled each of these separately in the record; the only new piece is the start side, which is why it's flagged. **Your call.**

**17. Reporting cadence and audience.** — *Recommend:* cadence is set per role, written in the charter. Observer: one synthesis every 3 hours, no play-by-play. Workers: no messages to you at all. A correction to a wrong claim goes out promptly and is exempt from the cadence, but a session that corrects itself more than twice in a window has a process defect, not a cadence exemption. *Why:* "30 minutes" and "every 3 hours" were both said, to different roles. **Your call.**

**19. What may hard-block.** — *Recommend:* exactly four classes may block without a model's judgment: a live secret leaving, spend past a cap, the self-stop family (quitting on a context or fatigue excuse), and your emergency stop. Everything else is advisory — it signals, records, and never deletes. A block always preserves its input; no classifier verdict destroys state. *Why:* this sets how much power a dumb check has over an agent, which is yours to set. **Your call.**

**20. Cost-bearing actions and the PIN.** — *Recommend:* the PIN is required only above a spend threshold you set, measured against your monthly cap, and for arming a paid door the first time. Below it, your written yes in chat from your verified account is enough and is recorded by message id. *Why:* you said "I already authorized, no need for PIN" and the code still demanded one; a threshold reconciles them. **Your call.**

**23. Full re-read versus a declared basis.** — *Recommend:* the full re-read is the rule, with no exemption. Substituting memory, or a partial read, for the full read is a violation even when it is declared. *Why:* two window-only re-grounds passed unrefused before you caught it; a declared shortcut is how it happened. **Your call.**

**26. The 2.0 fork of the constitution.** — *Recommend:* the fork is allowed, with one condition: the register records the reconciliation as an open loop with an owner and a date, and the build fails if that date passes. *Why:* you ruled the fork; the no-drifting-copies rule is also yours, and a dated loop is how both hold. **Your call.**

**27. Directive persistence.** — *Recommend:* a directive from you persists until you supersede it or it is done. It never expires on a timer. *Why:* this was decided by me under pre-approval and built; it needs to be in your words. **Your call.**

## The twenty-four to wave through

**1. Convergence bar** — Judgment decides: findings shrinking to detail at 80/20, judged by the independent reviewer, never the author. A round count is a floor and a confusion detector, never the stopping rule.

**2. Exact-match floor versus "only a full-context gate may block"** — Write the exception into the rule: a deterministic floor for secrets and money may block; every other string check only signals.

**4. Machine moves and pins** — Place by session role, not by load: orchestrators and observers stay where they started, workers go to the second machine. A session never moves without the gate asking. A move in progress carries an expiring "on the way" label.

**5. Fail direction** — A field per consumer of a signal, not per check: reachability fails open, change and release integrity fail closed. A held gate must be distinguishable from a dead one.

**6. Rule 37 versus red-then-green** — Scope the rule to main: no red on main or at merge. Red-then-green on a branch is fine. A test whose result depends on the calendar or a live server is quarantined until controlled arms attribute it.

**7. Plain English versus a verbatim tenet** — When quoting you, the verbatim words win. Plain language allows proper nouns. Evidence that is itself blocked text travels by a channel the gate does not review.

**8. "Approved" in chat versus approved = merged** — The merge commit is the record of approval. Your chat "yes" is the authorization that permits the merge, kept as provenance by message id. Approval and convergence are separate gates. When a document and a message disagree, the document wins and the difference is recorded.

**9. Tree relationships** — Parent is declared, children are derived. A merge never deletes: the merged rule stays as a named subsection with its enforcers. A citation that quotes a superseded rule keeps pointing at it.

**10. Silence** — Your silence is never consent. Between peers, silence past a declared read boundary is concurrence.

**12. Strongest model versus scheduled checks** — Script detects, mind judges. Review is retrospective by a strong model by default; live judgment only at irreversible moments. The second observer runs on a different model family. A guard watches for a judging lane being silently downgraded.

**13. The second observer's scope** — A reviewer, not a spec author. Pushing back before an action, including refusing to manufacture an artifact to match a manager's wording, is a sanctioned outcome.

**14. Silence by default versus "never told"** — A report on a dark feature is a result, not chatter, and goes out.

**15. Privacy** — Internally, everything is captured and recoverable (text everywhere, images only where no text form exists). Anonymization happens only at the point of sharing outside.

**18. Counts versus judgment** — Counts are inputs a judgment must cite. They are never the verdict.

**21. Approval of the output versus the process** — Your approval of a result does not erase a skipped required step. The result stands; the skip is recorded as a violation.

**22. Operator-directed graduation** — Your stated need is a valid path to turning a feature live, recorded as operator-directed, with the evidence collected afterwards.

**24. The docs-only path** — Docs-only commits may carry evidence and deferral records. They may never carry rule text or tracking markers that skipped review.

**25. Advisory checks** — A check is advisory only if the register says so. A red required check is red, full stop. Overriding a gate's verdict needs a citation and a condition under which the override is void, and is recorded.

**28. Work-in-progress limit** — One thing at a time applies to the orchestrator's own hands. The delegate pool runs in parallel.

**29. Does one spec pay the convergence cost?** — Yes. Fix the exemption: one pull request is exempt; one foundational spec is not.

**30. Fix first or review the class first** — When you are blocked, restore comes first. The class review goes in the record afterwards.

**31. First occurrence births a standard; recurrence is a failure** — Yes, with the corrections register to tell the two apart.

**32. Where a governed evidence corpus lives** — Governed does not mean on main. The register gains a "durable location" fact; a large corpus lives on a named, protected branch or tag.

**33. One silent re-run** — The first red is the defect. A re-run is allowed only to gather evidence and a defect is filed either way; a passing re-run is never exoneration.
