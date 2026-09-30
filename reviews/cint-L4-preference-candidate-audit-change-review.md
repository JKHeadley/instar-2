# Change review — cint-L4 repair: the provenance audit traces an active preference candidate by its exact clause

Subject base: 6a510352ba249127db55537dd6e1c5e47772f660
Review state: open
Reviewed content: none
Outcome: Live-proof group F (2026-09-29 07:51, head 6a510352) found Rule 33 failing live: the memory-provenance store agreement reported "1 untraced item(s): candidate-text-source" at memoryCandidates[0], source update 969389612. A read-only diagnostic on a copy of the live root showed that candidate is the active reply-style preference: the writer (journal.ts preferenceCandidates) offers each active preference as a candidate carrying only its exact clause (32 chars, contained in the 100-char source turn) with an empty reply. The writer is correct; the audit (journal-audit.mjs) required a candidate message to equal the whole source-turn text, and already accepted the preference's empty reply, so it was wrong for this legitimate case. Fix at the source of the error, the check: a non-channel candidate is also traced when an active preference at the reservation (the audit's existing active-preference map, now computed before the candidate loop, including corrected preferences) has that source and exactly that clause, and the source turn holds the clause. The turn's lost answer was incidental: the prior audit test used a preference quote equal to the whole turn, so the shape never arose. The fixed audit returns 0 findings on the live-root copy; the new test reproduces the live shape (answer lost as uncertain, preference clause inside a longer turn) and fails on the old audit with candidate-text-source, passes on the fix, and proves the other side (an invented clause is still candidate-text-source). No journal record is changed, so the live root stays readable and a rollback needs no data change.
Affected rules: 33, 37, 116
Affected floors: secrets — unchanged, the audit emits no bodies; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged, the journal is only read
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: changes the verdict of the Rule 33 memory-provenance store agreement reported in status and proofs
Side effects: a candidate whose message is an active preference clause held by its source turn is no longer flagged; any other mismatched candidate still is
Undo and recovery: revert this commit and regenerate the register; no durable format or journal record changed
Multi-machine posture: machine-local single runner per journal, unchanged
Layer below: docs/00-the-purpose.md and docs/01-the-rules.md; tests/preview/journal.ts preferenceCandidates and memoryPreferenceState; tests/preview/store-agreements.ts memory-provenance uses auditJournal
Bug class: integration
Bug evidence: reproducer=tests/preview/journal-audit.test.ts
Hook bypass: none
Convergence: none
Prompt review: no system prompt, provider policy or invocationPolicyDigest changed
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (9 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, tests/preview/journal-audit.mjs, tests/preview/journal-audit.test.ts

## Closing block

simplestRobustRoute: one added acceptance in the existing check, reusing the audit's own active-preference map; no new machinery and no data migration (Rule 116).
80/20: the live-root copy audits clean; the new test fails on the old check and passes on the fix, with the invented-clause side still refused; tsc, lint, register:check pass; the full gate reruns on the Mama PC.
VERDICT: author submission; the independent verdict is recorded as a pass
