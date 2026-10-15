# Change review — Unchanged revision declaration provenance

Subject base: 48d9f0613dd09e09111e6a4a838b7d1dc19b90d2
Review state: open
Reviewed content: none
Outcome: Adopt explicit promise and fulfillment declarations from a complete selected revision even when its delivered text is unchanged.
Affected rules: Purpose constraint 2; Rules 4, 8, 10, 26, 34, 36, 41, 70, 74, 75, 83, 101, 102, 111, 113, 116.
Affected floors: Secrets retain existing candidate and outbound checks; spend cap retains existing reservations without an added call; stop retains admission; no duplicate sends retains intent and receipt identity; durable intake retains the encrypted journal.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: The production journal chooses declarations for the durable send intent.
Side effects: Explicit empty metadata now overrides original metadata for unchanged selected text. Missing legacy fields still fall back. Rejected, held and excised candidates cannot supply revision declarations. Source publication is regenerated at 73c2bd655ea99b6560bcb7cb0af4279d79383d41 using the existing register builder. Desk owner/inventory rehash found no changed pins.
Undo and recovery: Revert the journal selection change and regression together and regenerate publication. Keep durable revision, intent and receipt records; no schema migration or resend is required.
Multi-machine posture: No new store or owner. Selection reconstructs from the existing shared encrypted journal under the current conversation owner. Crash after revision recording and drain after reopen preserve once-only delivery.
Layer below: Inspected revision completion/projection, final candidate selection including holding and scoped excision, promiseProposals, fulfillmentProposals with offered ids, final quote filtering, and receipt-based settlement. Existing validators remain the admission authority.
Bug class: durability
Bug evidence: reproducer=tests/preview/journal-revision-promises.test.ts; restart=tests/preview/fixtures/rule10-unchanged-repair-result.json
Hook bypass: none; core.hooksPath unset and common hooks directory contains sample files only.
Convergence: none
Prompt review: No prompt or parser contract changes. Recorded answer/revision bytes and archived summary, Jev and review shapes replay alongside synthetic declaration neighbors, explicitly distinguished from historical outputs.
Prompt finding: 849db3a6296a | protocol-literal | Existing memory rendering instruction is unchanged by this repair.
Prompt finding: e8708c7fea24 | protocol-literal | Existing source attribution instruction is unchanged by this repair.
Decision: rule10-unchanged-provenance | Select declaration provenance independently of changed reply bytes, using the existing accepted candidate and journal; no extra model call or review round. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/rule10-promise-1014-repair-092446-PROGRESS.md
Decision: rule10-unchanged-replay | Extend the captured-text regression with synthetic newly declared, explicitly empty and supported fulfillment neighbors, including crash/reopen, and replay existing recorded review shapes. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/rule10-promise-1014-repair-092446-PROGRESS.md

Verification: Four new assertions failed before the code repair; all 160 tests in seven targeted files pass after it. The unchanged revision introduces neither another revision call nor a revision-review reservation. Existing rejected-revision, offered-id, quote validation and restart cases pass. Typecheck and architecture pass. Full-suite and live acceptance remain desk verification, not asserted here.

simplestRobustRoute: This is the simplest robust route: retain which complete revision was selected even when its bytes match, then use its explicit declarations through the existing validators and durable intent. Start guards are existing completion, secret, size and blocker admission checks; end guards exclude held or excised candidates and validate quotes/offered ids before receipt-based settlement. No new call, store, retry or gate. Offline replay is evidence of this bounded repair, not an unattended live deployment claim.
80/20: Repair the demonstrated provenance loss at its source, verify the reported neighbors and existing exclusion paths, and submit to the independent desk gate.
VERDICT: author submission; no independent verdict asserted
