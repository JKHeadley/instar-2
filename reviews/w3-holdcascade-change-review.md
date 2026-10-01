# Change review — w3-holdcascade: an unsure Jev credential score whose escalation yields no verdict is answered, never held

Subject base: 72fb5a824ce8c0535c223f146fba8eb9c3cf78fa
Review state: open
Reviewed content: none
Outcome: Plan #144. Turn 969389800 on Justin's preview (cint-L13 72fb5a82, "What's my current gym locker code?", verified operator) was held as "reply check unavailable" and stayed held. Its recorded rows: Jev answered credential 0.51 (verdict unsure; Jev's confident credential line is 0.70), the full-context subscription review (the cascade's stronger tier) ended UNKNOWN after 1.5 s with no output and no usage (model-call outcome "uncertain", reply-review-state "uncertain"), the reply-check row recorded the review unavailable, and jevCredentialFlag counted Jev's unsure credential flag as a secret finding, so "unavailable" plus that flag became a hold. Plan #102 says an unsure check escalates and never ends in a refusal. Fix at the source: the hold class for an unavailable review now needs a confident Jev credential score (the recorded score at or above 0.70, or a legacy violation row without scores); an unsure-band flag whose escalation gave no verdict is released with the flag and the unavailable review recorded on the send. The exact credential-shape wall, the send-time outbound secret wall, a confident Jev credential flag and a review naming a credential all still hold. A hold already recorded by an earlier build stays as recorded (existing Rule 52 design), so 969389800 itself is not re-sent hours later; the operator re-asked at 969389804 and was answered.
Affected rules: 4 (only exact tests decide alone: the exact credential wall is untouched), 14 and 77 (the operator's own question is answered), 42 (the unavailable review stays recorded with the release), 86 (a low-context unsure flag is a signal; the secrets exception keeps Jev's confident flag and the review's credential finding), 95 (reachability fails open), 106 by plan #102's cascade, 116 (one predicate change, no new mechanism)
Affected floors: secrets — the exact credential wall, the outbound wall and the confident-flag hold are unchanged and tested; spend cap — unchanged, nothing is re-dispatched; stop — unchanged; no duplicate sends — unchanged, a restart replays the recorded rows and sends once; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: one predicate in the preview runner's hold decision plus one status counter that follows it; no prompt, provider or record shape change; the credential floors are proven on both sides by test
Side effects: a reply whose Jev credential score sits in the unsure band (0.50 to 0.69) is sent when the stronger review cannot give a verdict (UNKNOWN outcome, malformed twice, call cap reached, budget spent), with release review "unavailable" and the credential objection recorded; reviewUnavailableReleases now counts those releases under credential
Undo and recovery: revert the fix commit and this record; no journal record shape changed, so journals replay under either version
Multi-machine posture: single-machine preview runner only; no shared state changed
Layer below: tests/preview/reply-check.ts interpretJev positive lines; tests/preview/journal.ts held-class decision and the earlier-build hold skip
Bug class: live-path
Bug evidence: reproducer=tests/preview/held-cascade-replay.test.ts; live=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w3-holdcascade-evidence-969389800.json
Hook bypass: none
Convergence: none
Decision: w3-holdcascade-unsure-credential | an unsure-band Jev credential flag with no stronger verdict is a signal released with the reply, because plan #102 forbids an unsure check ending in a refusal and Rule 86 reserves blocking for an unambiguous secret | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w3-holdcascade-PROGRESS.md
Prompt review: no prompt text changed
Prompt finding: 849db3a6296a | protocol-literal | the runner's fixed reply when no memory is saved; the memory-list test asserts that fixed text (unchanged here)
Prompt finding: bd01de21286a | protocol-literal | the packet instruction to cite sourceLabel, retained verbatim; the hallucination-rate test checks the instruction is carried (unchanged here)
Prompt finding: fb5fa7e706c8 | protocol-literal | the packet instruction for questions about what the operator said, retained verbatim; the test checks the instruction is carried (unchanged here)

Subject (7 paths): reviews/w3-holdcascade-change-review.md, tests/preview/format-retry.test.ts, tests/preview/held-cascade-replay.test.ts, tests/preview/journal-summary-crash.test.ts, tests/preview/journal.ts, tests/preview/reply-check.ts, tests/preview/review-layers-canary.test.ts

## Closing block

simplestRobustRoute: the required outcome is that an unsure check never ends held while a real secret stays refused; the simplest route is the existing confidence line Jev already uses, applied at the one hold predicate. Retrying the UNKNOWN paid review was rejected (an UNKNOWN call is never repeated); a new escalation tier was rejected (no named failure the release does not already cover)
80/20: 0 must-fix, 0 notes — one predicate and its both-sides tests
VERDICT: author submission; the independent verdict is recorded as a pass
