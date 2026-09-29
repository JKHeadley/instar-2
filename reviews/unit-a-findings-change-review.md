# Change review — unit-a-findings: the audit expects the history the packet grounds on (Rule 96); live-shape promise proof (Rule 10)

Subject base: 91cefaa085713d50518f1bdcf64263331510fadf
Review state: open
Reviewed content: none
Outcome: Live-proof group A on 91cefaa0 (results A-20260929-092352). A3b failed: last.history was 85 while status counted 86 earlier turns under historyMode complete. A read-only diagnostic on a copy of the live root found the one omitted turn is the build switch's desk probe (update 969389640, "Build check 91cefaa0: reply with the word ok"), which the packet deliberately skips as audit evidence since 60297773. Nothing is double-counted. The journal audit was never taught that exclusion, so it expected the probe and reported history-coverage: the live memory-provenance agreement "1 untraced item(s): history-coverage". The packet's selection is now one exported groundingHistory (accepted, not a desk probe, not an edit's replaced original, after the summary) that both the packet and the audit read, so they cannot drift again. On the live-root copy the base audit reports history-coverage and this build reports no findings. A5a failed: the reply was sent (api-accepted, not held) and declined to promise because the preview has no scheduler, so an empty agentPromises is the correct outcome and the check is UNTESTED, not a defect; a new test built from that recorded reply proves no promise is recorded for it, and that a promise in non-template wording the answering model proposes is recorded as {action: promised, quote, open}.
Affected rules: 10, 33, 37, 96, 116
Affected floors: secrets — unchanged, the audit emits no bodies; spend cap — unchanged, no model call added; stop — unchanged; no duplicate sends — unchanged, no send path touched; durable intake — unchanged, the journal is only read
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: changes the verdict of the Rule 33 memory-provenance store agreement reported in status and proofs, and moves the packet's history selection into a shared helper
Side effects: the packet's history bytes are unchanged (same predicate, moved); the audit no longer flags a desk probe turn or an edit's replaced original as missing history; a packet that drops an ordinary turn or carries a probe is still refused
Undo and recovery: revert these commits and regenerate the register; no durable format or journal record changed
Multi-machine posture: machine-local single runner per journal, unchanged
Layer below: docs/00-the-purpose.md and docs/01-the-rules.md; commit 60297773 (probe turns out of operator memory) and tests/preview/probe-traffic-replay.test.ts; tests/preview/agent-commitment.ts promiseProposals and recordedPromises; tests/preview/store-agreements.ts memory-provenance uses auditJournal
Bug class: integration
Bug evidence: reproducer=tests/preview/journal-audit.test.ts
Hook bypass: none
Convergence: none
Prompt review: no system prompt, provider policy or invocationPolicyDigest changed; the packet's text is byte-identical
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts, unchanged by this change
Prompt finding: bd01de21286a | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Prompt finding: fb5fa7e706c8 | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (11 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, tests/preview/journal-audit.mjs, tests/preview/journal-audit.test.ts, tests/preview/journal-commitments.test.ts, tests/preview/journal.ts

## Closing block

simplestRobustRoute: the packet's existing history predicate moved into one exported function the audit also calls, instead of teaching the audit a second copy; no new machinery, no data migration (Rule 116). Item 2 needed no code change.
80/20: the new audit test fails on the old audit with history-coverage and passes on the fix, with both refusal sides still caught; the live-root copy audits clean; the promise test passes; tsc, lint, register:check pass; neighbouring probe-traffic, reply-grounding and commitments tests pass; the full gate reruns in the pipeline.
VERDICT: author submission; the independent verdict is recorded as a pass
