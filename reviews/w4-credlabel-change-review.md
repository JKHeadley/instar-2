# Change review — w4-credlabel: a credential is decided against held secret material, never a public label; repair round 1

Subject base: 383c10943305c47a850b43fcad9b125c864791c5
Review state: open
Reviewed content: none
Outcome: Plan #442 (observer #157; proof room group T, update 715673352): a correct sandboxed tool answer was held because the runner's own reminder line named the activation record's public identity label and the reply review called it "an activation token". 2adbc8cd added an exact held-material floor (preview vault SecretRefs and host custody, exactly or base64/hex/URL-encoded) beside the shape floor, gave the reviewer the register's public labels, masked those labels in the text Jev reads, and let a credential finding naming only public text stand as an advisory objection. Unit review round 1 (Astra, VERDICT NO) named three must-fix defects, each fixed at its source: (1) admitted tool output is no longer treated as public, since an authorized read may return a password; tool execution itself is unchanged. (2) A credential finding is refuted only when its whole allegation is public metadata: every quoted span is in the reply and is a public label or runner line, and the rest of the reason names no value-like word the reply carries; a reason that quotes the label but also names a password holds. (3) Every nonempty held secret is matched and concealed, with no length exemption, so a six-digit login code is withheld. Both sides of each boundary are tested end to end through the real worker, and the recorded 715673352 answer still replays as sent.
Affected rules: 4, 42 and 86 (secrets never exposed; a credential finding that is not shown to be public keeps its hold), 100 (the revision model never receives held material), 10 (a public label is not a secret), 34 and 36 (unit tier through the real worker; both sides of every boundary), 37 (fixed at source, nothing quarantined), 74 (this record), 101 (plain commits), 106 (recorded live shapes replayed), 116 (pure functions over existing ports; no new model round)
Affected floors: secrets — strengthened: exact held-material floor at review, revision and send, including short values; tool output and incidental public quotes no longer release a credential finding; spend cap — unchanged, no added paid call; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: it changes what decides whether a reply carrying a possible credential is released or held.
Side effects: new exports in reply-check.ts (secretMaterialIn, concealSecretMaterial, publicCredentialLabels, maskPublicLabels, PUBLIC_LABEL_MASK, credentialFindingPublic); the worker gains heldSecrets and knownNonSecrets ports; the review packet may carry knownNonSecrets. A held value of any length now withholds any reply containing it or its encodings (fails toward hold).
Undo and recovery: revert these commits and this record; no journal frame kind changed, so any root opens under either build.
Multi-machine posture: machine-local, unchanged.
Layer below: credential register fields carry metadata, never values; vault resolution supplies held values; tool admission authorizes execution, not publication; the journal's review findings feed release/hold selection; the outbound check reuses the same matcher.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: credlabel-r1-no-tool-authority | admitted tool output clears nothing: tool provenance is not disclosure authority, and keeping the tool's full reach costs nothing because a benign tool answer the reviewer passes is sent | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-credlabel-PROGRESS.md
Decision: credlabel-r1-whole-allegation | a finding is refuted only when its quoted spans are all public and the remaining reason names no value-like word (four or more characters with a digit or inner punctuation) the reply carries outside public labels; anything else keeps the hold, with no extra model round | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-credlabel-PROGRESS.md
Decision: credlabel-r1-no-min-length | every nonempty held value is matched and concealed; a short value may over-hold, which is the safe direction | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-credlabel-PROGRESS.md
Prompt review: model-facing in 2adbc8cd: the reviewer's credential rule says names, identity labels, kind, custody, expiry and renewal steps are public, and the review packet carries knownNonSecrets; Jev keeps its question and reads text with public labels replaced by "[credential record label]". The repair changes no model-facing text; it narrows which credential findings are released as advisory. Real shapes replayed: the recorded 715673352 turn (fixtures/credlabel-proofroom-T-2026-10-03.json: Jev unsure at credential 0.58, the reviewer's credential VIOLATION quoting the label, the UNKNOWN revision, the neighbour's PASS) through the real worker; the answer is sent with the objection kept on the record.
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts, unchanged by this change
Prompt finding: bd01de21286a | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Prompt finding: fb5fa7e706c8 | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (14 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references/preview.json, tests/preview/credential-label-boundary.test.ts, tests/preview/fixtures/credlabel-proofroom-T-2026-10-03.json, tests/preview/journal-agent.mjs, tests/preview/journal.ts, tests/preview/reply-check.test.ts, tests/preview/reply-check.ts

## Closing block

simplestRobustRoute: pure checks over the existing ports and the existing release/hold selection; the repair removes an exemption and a length threshold and adds one word-overlap condition, with no new model round and no narrowing of tool reach.
80/20: 0 must-fix, 0 notes.
VERDICT: author submission; the independent verdict is recorded as a pass
