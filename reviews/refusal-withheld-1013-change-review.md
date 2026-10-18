# Change review — refusal-withheld-1013

Subject base: 0de16e3cdaea380ac746793123a51382aeb9830b
Review state: open
Reviewed content: none
Outcome: Deliver the recorded scope refusal through the existing blocker contract. The actual failure was its 522-byte claim exceeding a 500-byte validator bound; its authority constraint, avenues and future recheck were otherwise valid. Retain the validator's rejection reason in answer and revision records and the reviewer packet.
Affected rules: 4, 18, 20, 21, 23, 26, 34, 36, 37, 41, 42, 49, 57, 60, 74, 77, 84, 99, 101, 102, 103, 108, 111, 113, 116
Affected floors: secrets — diagnostics are fixed text, existing credential checks remain; spend cap — existing bounded revision and review reservations remain; stop — checked before calls and sends; no duplicate sends — unchanged durable intent and receipt path; durable intake — original model outputs and rejected candidates remain retained
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Changes model-authored blocker admission and the diagnostic information passed to contextual review.
Side effects: Pipeline repair MUST-FIX 1 is already implemented in c4995d310cfbb95bfceb66f551ae541f5ae37e13; preserve its single conditional spread and RejectedObligations | undefined selection. The diagnostic projection uses an explicitly typed optional record; the source compiles with the new tests. Regenerate the existing register publications from the committed source head so pin and roster checks cover this change. A quoted claim can occupy up to the existing 4096-byte reply budget rather than 500 bytes. Existing packet and settled-record byte budgets still bound context. New optional rejection reasons survive journal replay; older records without them remain valid. No new state store, retry, grant, refusal category, model route or prompt rule. An unchanged reviewer violation remains a violation.
Undo and recovery: Revert the code and tests before deployment. After a new long blocker has been recorded, older readers with the 500-byte validator cannot reopen it; retain the widened read bound when rolling back writer behavior, or roll forward. The optional reason fields likewise require the new reader for journals containing them. Do not rewrite or delete recorded refusals.
Multi-machine posture: Conversation-owner-local validation and existing replicated journal evidence. Every reader of new records needs this version; no ownership or dispatch changes and no new machine-local store.
Layer below: validAssessment still verifies exact governed constraint/evidence keys and never admits an attempted unauthorized avenue. Claim binding remains exact, future rechecks remain finite, and the send doorway retains stop, resource and idempotency checks. The failed fixture is a quote-size rejection, not proof that a new authority policy is needed.
Bug class: integration
Bug evidence: reproducer=tests/preview/refusal-withheld.test.ts
Hook bypass: none
Convergence: none
Decision: refusal-withheld-1013-existing-contract | Use the existing governed blocker contract under Rules 18/23/99/103/116; outside-standing evidence needs no forbidden attempt, and its recheck reassesses standing rather than attempting access | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/refusal-withheld-1013-repair-100248-PROGRESS.md
Decision: refusal-withheld-1013-quote-bound | Reuse the existing reply byte bound for exact blocker quotes, preserving finite context budgets and all evidence checks; the recorded 522-byte sentence must not be silently lost | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/refusal-withheld-1013-repair-100248-PROGRESS.md
Decision: refusal-withheld-1013-rejection-reason | Record the same validator's first failed check as fixed text, persist it and pass revision rejections to review; never copy rejected model text into diagnostics | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/refusal-withheld-1013-repair-100248-PROGRESS.md
Decision: refusal-withheld-1013-replay-scope | Replay exact F3 writer/Jev/revision/review bytes; explicitly control the final reviewer response only after its missing-record premise becomes false, and separately prove the unmodified recorded violation still holds | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/refusal-withheld-1013-repair-100248-PROGRESS.md
Decision: refusal-withheld-1013-repair-existing-fix | Verify the existing c4995d31 typing repair rather than duplicate it; retain runtime behavior and both rejection assertions, and name Rule 37 explicitly | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/refusal-withheld-1013-repair-100248-PROGRESS.md
Prompt review: No instruction or constitutional wording changes. Model-facing diagnostic context now names a fixed validation failure. The existing obligation guide already describes the full contract and outside-standing evidence. Recorded F3 output is preserved verbatim with frame/update provenance; the controlled final-review neighbor proves wiring and delivery, not fresh provider judgment or a live deployment.

Prompt finding: e8708c7fea24 | protocol-literal | Unchanged attribution instruction; the cited recall test checks that it reaches the packet. This repair adds no phrase-based judgment.
Prompt finding: 849db3a6296a | protocol-literal | Unchanged fixed memory-inventory response; the cited test checks its existing renderer, not a classifier introduced by this change.

simplestRobustRoute: This is the simplest robust route: admit a valid exact quote within the existing reply-size budget and expose the existing validator's reason when a declaration is refused. No separate will-not schema, exception classifier, retry or policy widening is needed. Start guards are exact claim/constraint/evidence validation; end guards are contextual review and durable send receipts; limits remain the existing byte, call, stop and send budgets. Local recorded replay is evidence for the repair; unattended shipped-path acceptance remains the desk's live gate.
80/20: Retain the existing contract and fix the measured size mismatch. Test the real refusal and both sides of length, constraint, missing-record, review, cap, stop and duplicate boundaries. No independent convergence claim.
VERDICT: author submission; independent landing review belongs to the desk
