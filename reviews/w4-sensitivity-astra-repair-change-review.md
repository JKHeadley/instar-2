# Change review — w4-sensitivity Astra repair: a shared audience is released only on a completed review

Subject base: 650a99208afd0fca81b10b0a87cb4b03bb680676
Review state: open
Reviewed content: none
Outcome: Astra's unit review of w4-sensitivity (round 1, base d4a3170d, head 650a9920) returned NO with three MUST-FIX disclosures reproduced at the checkpoint; each is fixed at its source with no new gate, store, model call or classifier, and no tool, recall or audience removed. (1) tests/preview/reply-check.ts: a reviewer's quote shorter than CLAIM_MATCH_MIN names a sentence only when it is exactly one whole reply sentence (namedClaimsIn; segmentCarries matches such a claim only as the whole segment), so a confirmed violation quoting "Code: 5521." removes it and the long-sentence control is unchanged; a short fragment of a longer sentence still names nothing. quotedSpans keeps its old contract. (2) tests/preview/journal.ts: the operator-echo shortcut runs only when the audience is the verified operator's private chat, and a cached pass stands for a shared audience only when it is a completed full-context (subscription) review, so a Jev-only pass or one interrupted before its review is re-reviewed or treated as unavailable. (3) tests/preview/journal.ts: for a shared audience an unavailable review (thrown, refused reservation, shared deadline, interrupted reservation) sends the existing content-free holding note with the draft kept in the journal; the operator's own chat keeps its advisory release. Part 18 §16 and §13 (P14-NF-77) state the shared-audience fail direction; changelog revision 6 records the repair.
Affected rules: Purpose least revelation (no disclosure to a shared audience without a completed review), 4 and 86 (the claim-scoped floor removes only what the reviewer named, now including an exact short sentence), 42 (an unlocated short fragment stays unnamed rather than silently counted), 57 (the model's absence can only narrow what a shared audience receives), 95 (each consumer declares its fail direction: the operator's chat releases, a shared audience holds), 36 and 106 (worker-level both-sides tests on the real journal and worker; the recorded live shapes still replay), 69 (P14-NF-77 extended), 90 and 91 (changelog revision 6, appended), 101, 116
Affected floors: secrets — unchanged: the exact credential wall and the credential question still decide live secrets for every audience; spend cap — no new call: a shared-audience echo now uses the existing review inside the existing reservation and cap, and nothing is retried beyond the existing cap; stop — unchanged; no duplicate sends — unchanged: one send through the existing path, an interrupted reservation is never repeated; durable intake — unchanged: the held draft stays in the journal
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: it changes when a reply to a shared audience may leave and which sentence the claim-scoped floor removes.
Side effects: the operator's own private chat is unchanged (operator echo, cached pass and unavailable release keep their behavior). For an audience other than the operator alone (none on the live path), an operator echo now goes to the full-context review, and an incomplete review sends the holding note instead of the draft. Any claim-scoped reason that quotes a short whole sentence now removes that sentence for every held class.
Undo and recovery: revert this change and this record. No journal frame, view field or store is added; held turns recorded meanwhile replay unchanged.
Multi-machine posture: machine-local, as the reply review it changes.
Layer below: sharedAudience (unchanged) read once per turn in the worker; repeatsOperatorOnly (unchanged); checkReply/reviewReply (unchanged); exciseNamedClaims (unchanged) fed by namedClaimsIn; the holding-note branch (one more condition).
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: w4s-repair-short-whole-sentence | a short quote names a sentence only when it equals a whole reply sentence (folded), so the length protection still refuses ambiguous fragments; no classifier or model call | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-sensitivity-PROGRESS.md
Decision: w4s-repair-echo-audience | the operator-echo shortcut and a non-subscription cached pass are restricted to the operator's own private chat; a shared audience always reaches the existing contextual review | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-sensitivity-PROGRESS.md
Decision: w4s-repair-shared-fail-direction | supersedes w4s-fail-direction-existing: for a shared audience an incomplete review sends the content-free holding note, keeping the draft; the operator's chat keeps its release (Rule 95 consumer declaration) | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-sensitivity-PROGRESS.md
Prompt review: no prompt text changes; the reviewer, revision and answer questions are byte-identical.
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts, unchanged by this change
Prompt finding: bd01de21286a | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Prompt finding: fb5fa7e706c8 | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Deferral: generated/register.json:1 | not-a-deferral=generated register content, not a promise
Deferral: tests/preview/sensitivity.test.ts:329 | not-a-deferral=a test input proving the short fragment "later" names nothing

## Closing block

simplestRobustRoute: the required outcome is that a shared audience never receives a private detail the review named, bypassed or could not judge. The simplest robust route is three conditions on existing machinery: an exact-whole-sentence allowance in the claim locator, an audience condition on the two existing shortcuts, and the existing holding note as the shared-audience fail direction. No new gate, call, retry, store or reduced ability. Start guard: the existing Jev check and review reservation; end-state guard: the holding-note branch and send record; limit guards: the shared deadline and call cap, unchanged. Unattended shipped-path result: worker-level tests drive the real journal and worker through each of Astra's probes and their private-chat controls.
80/20: 0 must-fix, 1 note — the call-cap refusal is proved at the check (the worker keeps review headroom after the answer call, so a worker-level refusal is not reachable in a short probe); the worker consumes that result through the same unavailable branch the thrown-review test covers.
VERDICT: author submission; the independent verdict is recorded as a pass
