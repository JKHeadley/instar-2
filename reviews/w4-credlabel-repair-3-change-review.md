# Change review — w4-credlabel repair round 3: every credential VIOLATION holds; record labels are masked from what reviewers read

Subject base: 3c33e174de0e6e79712e14096657996dc0580292
Review state: open
Reviewed content: none
Outcome: Unit review round 3 (Astra, VERDICT NO) showed the round-2 release still sent a password: a finding quoting only the public label while alleging, unquoted, a tool-read password was cleared whenever the reply did not repeat a whole recorded output line (`password=marigold`) or the result was nested JSON (no lines at all). No exact test over a finding's prose or over tool-output overlap establishes that the complete allegation is public, so the release is deleted: credentialFindingPublic and toolOutputLines are gone, and every credential VIOLATION holds as at the base. The recorded false hold is closed at the input instead: the register's record labels (each record's name and identity, filtered as before so no label is credential-shaped, held material or inside a held value) are masked by exact whole occurrence out of the text Jev, the full-context review and the revision review read. An occurrence joined to more letters, digits, `-` or `_` is not masked, so a longer value carrying a label reaches the reviewer whole; generic register words (kind, custody, renewal step) are not masked. The send keeps the real label. Tests: the recorded 715673352 reply is sent, both reviewers reading the mask, with the replay reviewer reproducing both recorded verdicts (VIOLATION when it reads the label, the neighbouring turn's PASS when not); the same replay without masking holds; both round-3 probes (longer output line, nested result) hold through the real worker; the label plus a held six-digit code is held.
Affected rules: 4, 42 and 86 (a credential VIOLATION always keeps its hold; no inferred release), 10 (a public label is not judged as a token), 34 and 36 (both sides through the real worker), 37 (fixed at source), 74 (this record), 101 (plain commits), 106 (recorded 715673352 and 715673353 shapes replayed, plus the reviewer's two probes), 116 (deletes two heuristics; exact masking over existing register records; no new model round)
Affected floors: secrets — strengthened: no reading of a finding can release a credential hold; only exact whole record labels are hidden from reviewers, and held bytes are refused before any review; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: it changes what a reviewer reads before deciding whether a reply carrying a possible credential is released or held.
Side effects: new optional port credentialRecordLabels (journal-agent wires publicCredentialLabels(records, held, 'record')); publicCredentialLabels takes an optional fields argument; maskPublicLabels masks only whole occurrences; Jev now masks only record labels (no longer kind, custody or renewal step); the credential rule text names the mask. Removed exports: credentialFindingPublic, toolOutputLines.
Undo and recovery: revert these commits and this record; no journal frame kind changed.
Multi-machine posture: machine-local, unchanged.
Layer below: the register supplies labels; vault and host custody supply held values; the review escalation port (first review and revision review) and the Jev port receive masked text; reserveEscalation and the journal keep the unmasked candidate; review findings drive hold selection unchanged from the base.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: credlabel-r3-no-release | a credential VIOLATION always holds: neither quoted-span equality nor tool-output overlap can show a free-form finding's whole allegation is public (the reviewer's two probes) | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-credlabel-PROGRESS.md
Decision: credlabel-r3-mask-record-labels | the public label is kept out of every reviewer's input by exact whole-occurrence masking of each record's name and identity, so the recorded false hold cannot arise and whatever a reviewer still names is not a label; generic register words stay visible so a coincidental tool value is never hidden | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-credlabel-PROGRESS.md
Prompt review: model-facing input changes: Jev and the full-context review (first and revision) read the candidate with record labels masked as `[credential record label]`; the credential rule text adds one sentence naming that mark. Real shapes replayed: the recorded 715673352 turn (fixtures/credlabel-proofroom-T-2026-10-03.json: the reviewer's credential VIOLATION quoting the label, Jev 0.58, the UNKNOWN revision, the recorded Bash result) and the recorded 715673353 credential PASS, through the real worker.
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts, unchanged by this change
Prompt finding: bd01de21286a | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Prompt finding: fb5fa7e706c8 | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (11 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, tests/preview/credential-label-boundary.test.ts, tests/preview/journal-agent.mjs, tests/preview/journal.ts, tests/preview/reply-check.ts

## Closing block

simplestRobustRoute: two inference paths deleted; one exact mask over existing register records applied at the two reviewer ports; no new model round, no narrowing of tool reach.
80/20: 0 must-fix, 0 notes.
VERDICT: author submission; the independent verdict is recorded as a pass
