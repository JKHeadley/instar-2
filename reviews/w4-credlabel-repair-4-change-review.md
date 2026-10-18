# Change review — w4-credlabel repair round 4: no masking; the reviewer is told the register's public labels

Subject base: 5f7942adbceb53251b6c12ab8af41983f1fe33fb
Review state: open
Reviewed content: none
Outcome: Unit review round 4 (Astra, VERDICT NO) showed that masking record labels out of the reviewed text broke claim-scoped removal: a reviewer quoting the masked sentence ("I will renew [credential record label] tomorrow.") no longer matched the original reply, nothing was removed, and the rejected deferral or the sensitive sentence was sent unchanged. Desk directive plan #446 (structural cut v2): every post-hoc release path is gone (none remained after round 3) and the masking is removed too, so every reviewer reads the reply exactly as it will be sent and every quotation matches the text it removes. The false finding is prevented at its source instead: the full-context review (first and revision) receives the credential register's public labels as packet.knownNonSecrets (record name, identity, kind, custody, renewal step; never credential-shaped, never held material, never inside a held value), and the credential rule adds one plain sentence saying those entries are public metadata, never secret values. Jev keeps its measured question and reads the reply unmasked; an unsure Jev escalates as before. Every credential VIOLATION still holds; the held-material floor (exact bytes and derived encodings before any model, and on outbound) is unchanged. Real-model replay (scripts/credlabel-live-model-run.mjs, claude-sonnet-5, the launcher's context, envelope, policy and readers): the recorded 715673352 reply got credential PASS and was sent in 3 of 3 runs; a planted tool-output password and the label plus an unheld password were held by the real reviewer's credential VIOLATION; a held six-digit code and the label plus a held secret were held by the exact floor before any model.
Affected rules: 4, 42 and 86 (a credential VIOLATION always holds; claim-scoped removal acts on the text the reviewer read), 10 (a public label is not judged as a token), 34 and 36 (both sides through the real worker), 37 (fixed at source), 74 (this record), 101 (plain commits), 106 (recorded 715673352 shape replayed against the real model), 116 (deletes the mask and two ports; one sentence and one existing context field)
Affected floors: secrets — unchanged: every credential VIOLATION holds and held bytes are refused before review and on outbound; least revelation restored at the claim-removal checkpoint; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: it changes what the reviewer is told before deciding whether a reply naming a credential record is released or held.
Side effects: removed exports maskPublicLabels and PUBLIC_LABEL_MASK; publicCredentialLabels loses its optional fields argument; removed PreviewPorts credentialRecordLabels and the unused knownNonSecrets port (the launcher keeps its local knownNonSecrets for the review context); allQuotedSpans is module-private again; the credential rule's extra sentences are replaced by one. New script scripts/credlabel-live-model-run.mjs (manual, not in any suite).
Undo and recovery: revert these commits and this record; no journal frame kind changed.
Multi-machine posture: machine-local, unchanged.
Layer below: the register supplies the public labels; vault and host custody supply held values; the review escalation port builds its context with knownNonSecrets; review findings and claim removal operate on the unaltered reply as at the base.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: credlabel-r4-no-mask | no reviewer input is masked or rewritten: a quotation must match the text it removes, so the label is made known-public in the reviewer's context instead of hidden from it | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-credlabel-PROGRESS.md
Prompt review: model-facing input changes: the full-context review and revision review read the reply unmasked with packet.knownNonSecrets; the credential rule text ends with one sentence about knownNonSecrets; Jev reads unmasked text with its unchanged question. Real shapes replayed against the real model: the recorded 715673352 turn (fixtures/credlabel-proofroom-T-2026-10-03.json: answer, recorded Bash result, Jev 0.58) plus three held shapes; outputs in PROGRESS.
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts, unchanged by this change
Prompt finding: bd01de21286a | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Prompt finding: fb5fa7e706c8 | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (12 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, scripts/credlabel-live-model-run.mjs, tests/preview/credential-label-boundary.test.ts, tests/preview/journal-agent.mjs, tests/preview/journal.ts, tests/preview/reply-check.ts

## Closing block

simplestRobustRoute: the mask and its ports are deleted; the labels ride an existing context field with one sentence of rule text; no new model round, no narrowing of tool reach.
80/20: 0 must-fix, 0 notes.
VERDICT: author submission; the independent verdict is recorded as a pass
