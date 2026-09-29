# Change review — unit-a2-findings: a held memory correction no longer wedges every later turn

Subject base: c14e24c4bfb4dfd39d9fb0d2bb6684d0bb4c9358
Review state: open
Reviewed content: none
Outcome: on the proof room (cint-L4 91cefaa0, 2026-09-29, updates 715672487-715672489) "Actually, cancel the bird feeder one." matched the memory-correction cue. The rolling summary's oldest prefix (through 715672482) had already failed twice, so every forced summary pass returned at once, and the exhausted-prefix release (settleExhaustedEdit) only covered Telegram edits. The correction stayed pending forever and every later turn was held "earlier turn pending" with no model call. The release now covers every pending memory request: after the bounded two summary attempts the request is recorded memory-undecided, its own turn is answered (the answer is offered the open reminders and cancels the one named), later turns are answered, and the answer packet flags the undecided correction (in undecidedEdits) so a later answer treats the earlier claim as unsettled. A journal already wedged by the old build recovers on its next drain with no hand edit; replayed offline on a copy of the proof-room journal, 487 is settled and answered, the bird-feeder request is cancelled, and 488/489 are answered. The prior test "holds a later answer when the capped summary path cannot record a memory decision" encoded the superseded indefinite hold and now asserts the new contract.
Affected rules: 10, 14, 15, 37, 74, 116
Affected floors: secrets — unchanged; spend cap — unchanged (the two capped summary attempts are unchanged; one answer call per released turn, within the call cap); stop — unchanged; no duplicate sends — unchanged (each released turn is answered once through the existing intent path); durable intake — restored: an intaken turn is no longer held forever behind an undecidable correction
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: a one-condition widening of an existing release (edits to all memory requests) plus one packet warning entry reusing the existing undecidedEdits field; no new record kind, no system-prompt, provider-policy or invocationPolicyDigest change
Side effects: a cued correction whose summary judgment is exhausted is answered with the fixed "couldn't record that memory change" notice when its own answer also fails to decide it, instead of being held; later answers carry the undecided warning
Undo and recovery: revert these commits; journals written by this build carry only existing record kinds (memory-undecided, hold, answer), readable by the prior build
Multi-machine posture: single-machine preview runner only; no shared state changed
Layer below: tests/preview/journal.ts pendingMemory, settleExhaustedEdit, runSummary's exhausted-frontier return, and packetFor's undecidedEdits
Bug class: live-path
Bug evidence: reproducer=tests/preview/journal-correction-wedge.test.ts; live=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/unit-a2-findings-evidence/proofroom-replay.txt
Hook bypass: none
Convergence: none
Prompt review: the only prompt text changed is the undecidedEdits guidance sentence in the answer packet, widened from revisions to revisions and operator corrections; the system prompt is unchanged
Prompt finding: 849db3a6296a | protocol-literal | the runner's fixed reply when no memory is saved; the memory-list test asserts that fixed text (unchanged here)
Prompt finding: bd01de21286a | protocol-literal | the packet instruction to cite sourceLabel, retained verbatim; the hallucination-rate test checks the instruction is carried (unchanged here)
Prompt finding: fb5fa7e706c8 | protocol-literal | the packet instruction for questions about what the operator said, retained verbatim; the test checks the instruction is carried (unchanged here)
Deferral: generated/register.json:1 | not-a-deferral=regenerated register output for the changed test pins; nothing is postponed

Subject (11 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references/preview.json, tests/preview/journal-correction-wedge.test.ts, tests/preview/journal-memory-correction.test.ts, tests/preview/journal.ts

## Closing block

simplestRobustRoute: widen the existing exhausted-prefix release from edits to every pending memory request and reuse the existing undecidedEdits warning; no new record kind, retry loop or quarantine (Rule 116, Rule 37 fixed at the source).
80/20: tsc --noEmit passes; the new reproducer fails without the fix (2 of 3) and passes with it (3/3); ten related preview test files pass (101 tests); an offline replay of the wedged proof-room journal copy recovers on one drain (the live= file; the live-build answer check is the pipeline step after push).
VERDICT: author submission; the independent verdict is pending
