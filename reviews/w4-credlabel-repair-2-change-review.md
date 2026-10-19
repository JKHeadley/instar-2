# Change review — w4-credlabel repair round 2: a credential finding is released only on exact register labels

Subject base: d49d5908dc5f6b6dcd415430cdd6142be7bda5f8
Review state: open
Reviewed content: none
Outcome: Unit review round 2 (Astra, VERDICT NO) showed the round-1 word-shape test still released a password: a finding that quoted the public label and named an alphabetic password (`marigold`) unquoted, or named a tool-read password only indirectly, was dismissed. Desk directive plan #444 (structural cut): stop inferring public metadata from word shapes. The valueWords and quoted-span heuristics (spanIsPublic, substring and runner-line matching) are deleted. A credential finding is now released only when it quotes at least one value; every quoted span, trimmed, is EXACTLY one of the credential register's public labels the runner gives the reviewer (name, identity, kind, custody, renewal step) and appears in the reply; the reply carries no held secret material or credential shape; and the reply repeats no line of the conversation's recorded tool output that the operator's own message did not supply. An incomplete tool record (omitted calls or a clipped excerpt) releases nothing. Tests: the recorded 715673352 reply is released (also with its recorded tool output); the label plus a held six-digit code is held; three tool-output passwords (unquoted, short alphabetic, indirect) are held; a runner line, a label fragment, a label with more text and a tool-output span are not labels.
Affected rules: 4, 42 and 86 (a credential finding not shown public by exact match keeps its hold), 10 (a public label is not a secret), 34 and 36 (both sides through the real worker), 37 (fixed at source), 74 (this record), 101 (plain commits), 106 (recorded 715673352 shape replayed, plus the reviewer's two probes), 116 (exact checks over existing records; no new model round)
Affected floors: secrets — strengthened: no word-shape inference can release a credential finding; tool output the reply repeats keeps the hold; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: it changes what decides whether a reply carrying a possible credential is released or held.
Side effects: credentialFindingPublic takes the exact label list, the recorded tool-output lines and the operator's message; new export toolOutputLines. Runner reminder lines are no longer release evidence (only exact labels are). A conversation whose recorded tool output was clipped at the 160-character excerpt never releases a credential finding (fails toward hold).
Undo and recovery: revert these commits and this record; no journal frame kind changed.
Multi-machine posture: machine-local, unchanged.
Layer below: the register supplies labels; vault custody supplies held values; the journal's recorded tool attempts supply tool output; review findings drive release/hold selection; the outbound guard reuses the held-material matcher.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: credlabel-r2-exact-labels | per desk plan #444, release requires every quoted span to equal a register public label exactly; no word-shape or substring inference remains | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-credlabel-PROGRESS.md
Decision: credlabel-r2-tool-lines | a reply repeating any recorded tool-output line the operator did not supply keeps the hold, because a free-form reason can name a tool-read secret indirectly and no exact test of the reason can see that; earlier turns count, since a kept session can repeat them | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-credlabel-PROGRESS.md
Prompt review: no model-facing text changes: the reviewer prompt, knownNonSecrets and Jev's masked text are as in 2adbc8cd. Only which recorded credential findings are released changes. Real shapes replayed: the recorded 715673352 turn (fixtures/credlabel-proofroom-T-2026-10-03.json: the reviewer's credential VIOLATION quoting the label, Jev 0.58, the UNKNOWN revision, the recorded Bash result) through the real worker.
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts, unchanged by this change
Prompt finding: bd01de21286a | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Prompt finding: fb5fa7e706c8 | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (10 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, tests/preview/credential-label-boundary.test.ts, tests/preview/journal.ts, tests/preview/reply-check.ts

## Closing block

simplestRobustRoute: two deleted heuristics replaced by exact equality to register labels and exact containment of recorded tool-output lines, over existing records; no new model round, no narrowing of tool reach.
80/20: 0 must-fix, 0 notes.
VERDICT: author submission; the independent verdict is recorded as a pass
