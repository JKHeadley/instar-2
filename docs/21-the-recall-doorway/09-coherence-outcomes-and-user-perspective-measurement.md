## 9. Coherence outcomes and user-perspective measurement

**Rule — record outcomes separately from their explanations.** Rules 13, 26, 39, 41,
58, 75, 85, 86 and 108; **checks: P21-NF-05/12/14/15/16/22**. P21's proposed
`CoherenceOutcome` binds a canonical principal opportunity to its admitted work, trigger,
permitted source/support paths, recall attempt/submission, response/prepared effect, any actual
delivery observation, criterion, grader and source frontier. It records observed behavior and
evidence separately from the inferred failure stage. A user saying “I already told you” is an
intake observation and candidate case, not automatic proof of a retrieval defect.

The record contains schema/version, stable case identity, setting/cue form/effect class,
expected time and audience, custody/index conditions, observed labels, adjudication state,
original/derived/lesson distinction, raw numerator/denominator membership, source availability,
charges/latency references and causal corrections. Labels may coexist; they are not an exclusive
four-way enum. Adjudication is proposed, confirmed, disputed or unassessable. Later evidence
supersedes an assessment through a new record without rewriting the original outcome or window.

| Outcome label | Denominator and failure event |
|---|---|
| missed | Opportunities requiring retained, permitted evidence: behavior omits its relevant constraint or needlessly asks the user to repeat it. Explicit history questions and spontaneous ordinary use are separate rates. |
| obsolete | Current-state opportunities with an established change: behavior treats superseded state as current. Correctly answering a past-date question is a success, not this error. |
| unnecessary-hold | Legitimate effects permitted by evidence and authority: memory/review blocks, defers or exceeds the policy cap without a valid prerequisite reason. Existing justified authority refusals are separate. |
| wrong-audience | Evaluated audience-sensitive opportunities: forbidden information enters model context, draft, prepared final output or actual delivery. Report each stage separately, including internal-use and disclosure violations. |

No runtime may decide that all unlabeled opportunities passed. An independent opportunity census
records every principal root, no-additional-context turn, refused/defaulted/cancelled/pending
case, and sampled ungraded case. Healthy-evidence recall denominators exclude missing custody
only by an explicit labeled stratum; total user burden still includes those failures. Forbidden
source knowledge is not a healthy recall target. Counts of legitimate abstentions, unsupported
certainty, fabricated recollection and confident denial with unavailable history remain visible.

**Rule — stage diagnosis requires stage evidence.** Rules 13, 41, 58, 86 and 108;
**checks: P21-NF-05/09/15/17/22**. Classify capture, index, query, selection, permission,
rendering, submission, reader-use, review, or delivery failure only when its evidence supports
that conclusion. Candidate recall is not input recall; input recall is not behavior. The
correct-evidence-but-unused measure includes only cases whose sufficient permitted support
path is confirmed in the actual provider input, and reports position/conflicting distractors.
Successful internal drafting is not successful user delivery. A later complaint can refine the
case without counting a second independent failure opportunity.

| User-perspective metric | Required reporting |
|---|---|
| Repetition burden | Needless repeat requests, volunteered corrections, repeated explanation turns and time until satisfactory completion; user survey alongside adjudicated cases |
| Spontaneous coherence | Correct behavior on ordinary task cues without an explicit “remember” instruction, separately for the same long conversation, a different conversation, email, and another person or agent’s report |
| Attribution and temporal consistency | False first-person claims, wrong speaker, known corrections honored, historical-as-of correctness |
| Prospective behavior | Due commitments honored, cancellations respected, false cues ignored, unjustified actions and missed cues separately |
| Availability and completion | ACK, first substantive answer, effect disposition and final user completion; silence, abandonment and unresolved cases remain counted |
| Review benefit/harm | Initially wrong drafts repaired, initially correct drafts harmed, residual errors, introduced/unnecessary holds and hold-resolution time |
| Accounting fidelity | Actual-input span agreement, false-success receipts, missing lineage and correct diagnosis under injected faults |
| Latency and resources | Added and total duration: p50, p95 and p99 are the durations below which 50%, 95% and 99% of observations fall; max is the longest. Report censored timeouts (attempts still unfinished at the deadline), queue time, cancelled residual work, model/embedding/read/build/storage/curation costs |

**Rule — Part 20 owns measured joins, not a local P21 scoreboard.** Rules 13, 39, 41,
58, 69 and 75; **checks: P21-NF-15/16/18/20/21**. P21 proposes registered feature
event/action-predicate and outcome mappings to Part 20. It submits evidence and quantities
through the owner, retaining canonical case/root identity so multiple child calls, retries and
graders do not multiply the denominator. Each observation window includes its start and excludes
its end, so an event on a shared boundary counts once, in the window starting there. Windows use
comparable owner clocks, never append time as a substitute. Late grades refine the original case's window.
Zero denominator is undefined; missing pricing is unknown, not free; missing peers are partial.

The [Part 20 feature/benchmark join contract](../20-measurement-ledgers/07-feature-benchmark-and-burn-joins.md)
requires accepted-question and planned-execution populations with visible missing/refused/
cancelled/pending members. The landed A1 code admits category/value tuples, not evidence-bound
aggregates (`src/measurement/operations.ts:70–90`; `src/measurement/README.md:3–11`).
Production coherence totals, cost attribution and operator/export views are therefore
**NON-EXECUTABLE-UNTIL-row-93-measurement-a2-coherence** and its inherited benchmark/clock/surface
dependencies in section 14. An offline experiment logger is permitted as a labeled research
artifact, not a substitute production owner or proof of paid-service readiness.

**Rule — corrections feed learning with accountable promotion.** Rules 24, 58, 85, 86,
89 and 108; **checks: P21-NF-12/15/16/22/24**. A correction preserves the original
exchange, proposed explanation and procedural repair as three distinct records. Retrospective
review samples successes, failures and unclassified turns, including no-additional-context
decisions and silence, to avoid measuring only complaints users chose to report. A production
benchmark scenario is promoted only from a real graded case through the judgment/verification
owners. Synthetic cases in section 10 remain test/research fixtures; they cannot be relabeled
production-derived to satisfy the rulebook's real-case benchmark requirement.

**Value — measure the relationship experienced by the user.**
[R5 §10](research/05-proposals-and-evaluation.md#10-metrics-denominators-and-error-attribution)
defines these outcomes and denominators; [R3 §§3, 8](research/03-external-research.md) explains
why static question-answer tests are insufficient. Audits should show that relevant history changed the answer or
action appropriately, not reward fluent familiarity, extra citations or a busy sentinel.
