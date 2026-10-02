# Change review — cint-L27 Astra repair: a failed cancellation quote check is reported as unverified

Subject base: 5ffeb4c5a2d8197628479bd93e8f539dccd9d51f
Review state: open
Reviewed content: none
Outcome: Astra round 1 MUST-FIX 1. When a cancellation citation failed the quote check (a bare id, a fabricated quote, a span too short), the runner told the operator "Nothing in that message withdrew a request", a claim about the operator's meaning that the failed check does not support: the operator could have written "Actually, cancel the bird feeder one." The refusal now says "I couldn't verify that cancellation, so no request was cancelled; your open requests still stand." The refusal kind is renamed from no-withdrawal to unverified to match. The exact-quote admission check and the conservative open-request state are unchanged. The two existing refusal assertions (the "also" request that cancels nothing, and the explicit-withdrawal citation cases) now require the new sentence. tsc passes; tests/preview/reminder-words.test.ts passes 9/9 in a targeted run.
Affected rules: 10 (code no longer turns absent valid evidence into a conclusion about what the operator meant), 2 (the two refusals still say different facts), 37 (fixed at the source; no quarantine), 69 and 90 (register replayed from committed sources), 74 (this record), 116 (a one-sentence wording change; no classifier, model call or retry added)
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: one fixed refusal sentence and its internal label change; admission logic, state and authority are untouched.
Side effects: the operator sees the new refusal sentence where the old one appeared.
Undo and recovery: revert the two commits and this record to return to 5ffeb4c5. Nothing persisted differs; the refusal kind is not journaled.
Multi-machine posture: unchanged; preview-only reply wording.
Layer below: tests/preview/journal.ts cancellation admission (listed/offered ids, quote containment against the redacted operator message), read and unchanged
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: cint-L27-astra-cancel-wording | the refusal states that the cancellation could not be verified, as Astra's smallest fix named; not chosen: a meaning classifier or extra model call to decide whether a withdrawal was meant (Rule 116, and Rule 10 keeps meaning with the model) | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/cint-L27-PROGRESS.md
Prompt review: no prompt text changed; only a fixed reply sentence.
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts, unchanged by this change
Prompt finding: bd01de21286a | protocol-literal | existing wording in journal.ts, unchanged by this change
Prompt finding: fb5fa7e706c8 | protocol-literal | the packet instruction for questions about what the operator said, retained verbatim; the test checks the instruction is carried (unchanged here)
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (9 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, tests/preview/journal.ts, tests/preview/reminder-words.test.ts

## Closing block

simplestRobustRoute: this is that route: the refusal sentence states only what the failed check proves.
80/20: 1 must-fix fixed, 0 notes
VERDICT: author submission; the independent verdict is recorded as a pass
