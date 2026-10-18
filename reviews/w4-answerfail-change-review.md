# Change review — w4-answerfail: a correct answer is no longer refused for two envelope slips (plan #455)

Subject base: 716cc69d6eefb292c0d7ea11138d4851111098ed
Review state: open
Reviewed content: none
Outcome: On live cint-L44 (9ee1c2bd) three trivial messages got "I couldn't produce an answer to that" in ten minutes. Every answer call completed with the right answer; the launcher refused the envelope around it, both attempts, and sent the fixed failure reply. Two slips, read from the incident journals (decoded read-only from copies) and the kept Claude Code sessions: (1) update 715673368 ("are you there?"): the floor echo was {"actions":["work"],"default":"work","schemaVersion":1} with no type, so decisionWithinFloor refused it (recorded bare-wrong-fields x2; the answer was "Yes, I'm here."); (2) updates 6232026, 6232027 (both attempts) and 6232028 (first attempt): one stray } after the object-valued conclusion.value closed the Decision early, so ,"floor":{...}} followed it (recorded multiple-objects). Fixes at the source of each refusal: an absent descriptive floor field asserts nothing and widens nothing, so it reads as the local floor (every present field must still match; the action list stays required); on the answer side only (the consumer already allowed to discard a wrapper), a premature close is dropped when the continuation parses and only adds fields after the first object's own (a repeated key, a non-JSON continuation, no comma, or JSON structure in the surrounding text all still refuse). Gates keep the narrow reading. A scan of every preview journal (10,415 answer calls) found 17 distinct refused outputs; this change recovers the 7 from the incident plus nothing else changes for the other 10, which are the older prose-with-brackets class (the k6 residual rule, deliberately left unchanged here and reported in PROGRESS).
Affected rules: 57 (a returned floor still never defines or widens: absent fields assert nothing, present ones must equal the local floor, the action list is required and the choice must lie inside it), 95 and 77 (the answer consumer's declared fail direction is toward reachability; gate consumers keep refuse), 36 (tests replay the real captured outputs verbatim), 42 (no refusal is converted: a model refusal or an unparseable answer still produces the failure path; only a correct answer misread as malformed is now read), 34 and 37 (unit tests both sides, suite green on the touched files), 74 (this record), 101 (plain commits), 116 (two narrow readings in the two existing predicates; no prompt change, no new retry, no new service)
Affected floors: secrets — unchanged (the repair reads only the model's own object; text around it is discarded as before); spend cap — unchanged (fewer format retries); stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: it changes which model outputs the launcher accepts as an answer, on the answer side only; gate verdicts are untouched.
Side effects: ModelJsonShape gains 'early-close' (counted as a tolerated shape in model-json-shapes.json by the existing recordShape path); decisionWithinFloor accepts an object echo that omits type, schemaVersion or default.
Undo and recovery: revert these commits and this record; no journal frame or file format changed.
Multi-machine posture: machine-local, unchanged.
Layer below: parseModelJson (the one launcher parse site, wrapped: wrappedPolicyOf(role)) and decisionWithinFloor, called by invokeSubscription for every answer, tool-turn answer and format retry.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: answerfail-floor-absent-field | an echo that omits a descriptive floor field is the local floor, since an absent field cannot widen it; present fields must still equal the envelope's | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-answerfail-PROGRESS.md
Decision: answerfail-early-close | the premature-close repair is answer-side only and admits only a continuation that adds fields; it is not extended to the prose-with-brackets class, which the k6 rule refuses deliberately | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-answerfail-PROGRESS.md
Prompt review: no prompt text changed. Model-facing acceptance changed: replayed the 7 real refused answer outputs from proofroom1-q-20261003-214628 (update 715673368, two attempts) and proofroom2-dshort15-20261003-214951 (6232026 x2, 6232027 x2, 6232028 x1) verbatim (fixtures/answer-envelope-slips-live-2026-10-03.json); each now yields the answer the model wrote, and a gate (refuse policy) still sees multiple-objects. A scan of all 10,415 recorded answer outputs in every preview root: ok 10298 -> 10308, no previously accepted output changed.

Subject (5 paths): reviews/w4-answerfail-change-review.md, tests/preview/answer-envelope-slips-live.test.ts, tests/preview/fixtures/answer-envelope-slips-live-2026-10-03.json, tests/preview/model-call-boundary.ts, tests/preview/model-json.ts

## Closing block

simplestRobustRoute: the two refusals were each a too-strict reading in an existing predicate; each predicate now reads the one live slip that cannot widen anything, with no prompt change, no extra retry and no new mechanism.
80/20: 0 must-fix, 0 notes.
VERDICT: author submission; the independent verdict is recorded as a pass
