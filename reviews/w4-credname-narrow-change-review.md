# Change review — activation wording in self-state only

Subject base: 26ba472680a770a9f35a7050809a1d6d323b60c7
Review state: open
Reviewed content: none
Outcome: The model's journal-derived self-state explicitly names “your activation” with its effective end date. Conversation history, summaries, memory candidates, quotes, approval identities and credential records retain their exact original text.
Affected rules: 4, 7, 11, 13, 34, 36, 37, 49, 70, 74, 80, 83, 84, 93, 96, 100, 101, 102, 111, 113, 116
Affected floors: secrets — existing custody, redaction and outbound checks; spend cap — no model call added; stop — existing stop line takes precedence; no duplicate sends — existing identities and receipts; durable intake — no record rewrite
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: One model-facing self-state line changes; exact evidence consumers must retain their input.
Side effects: The briefing supplies the canonical activation wording instead of only saying “Trial ends”. Existing assistant replies may still contain internal labels and remain available as exact history, expressly required by this task. This change does not guarantee a model will never repeat a historical name.
Undo and recovery: Revert the source and test change. No stored field, schema, key, custody reference or journal identity changes; no migration or state repair is needed.
Multi-machine posture: Stateless projection of the same journal state on each runner. Ownership, replication, custody and send receipts are unchanged; no additional machine-local state.
Layer below: selfStateBrief uses the effective journal expiry, including accepted renewal frames; credentialDisplayLabel derives the activation label from its kind. No registry lookup or historical text formatter is added. Exact projectMemoryClause, scheduleRequests/actionBlocked, memoryFrom and summary memoryItems admission remain byte-identical to base. Public credential review facts and renewal-request status already omit raw activation names.
Bug class: user-facing
Bug evidence: reproducer=tests/preview/credential-self-state.test.ts; live=tests/preview/fixtures/credential-answer-live-2026-10-09.json
Hook bypass: none
Convergence: none
Decision: w4-credname-narrow-self-state | reuse the existing activation label at the journal-derived activation-end line; preserve all conversation and exact evidence paths after the live probe located the raw names only in historical assistant replies and their memory candidates | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-credname-narrow-PROGRESS.md
Prompt review: Re-probed update 969390298 in the live encrypted journal read-only, verified the committed capture equals its exact recorded history and delivered reply, and proved journal/registry bytes unchanged. Both raw identifiers occur only in history and copied reply candidates, never the recorded self-state, capability sources or renewal status. The new self-state line gives the model the canonical activation wording and effective date without rewriting that evidence. Recorded uncertain summary writers, Jev undecided verdicts, reply-review violations/passes, delivered replies and an empty reply in recorded context replay with the new line present. Empty context is not claimed to be an empty Telegram delivery. The launcher test confirms actual prepared prompts contain the line and persisted credential keys remain original. Three Astra regressions cover active/withdrawn/corrected reminders, exact copied correction candidates and exact copied summary memoryItems, with invalid-quote rejection and reopen checks.

## Closing block

simplestRobustRoute: This is the simplest robust route: change the existing record-derived activation-end sentence using credentialDisplayLabel and the journal's effective expiry. No new parser, filter, record lookup, gate or model call. Start guard: existing validated installation and journal; end-state: labelled self-state with intact exact history; limits: existing stop, caps, custody, durable intake and send receipts. The live record disproved a fresh self-state identity leak, so no broader sanitizer is justified. No unattended live-answer or deployment claim; the desk owns the combined and live gate.
80/20: Targeted real-launcher, recorded-shape replay and exact-evidence regressions cover the scoped change. Register source repinning and independent review remain the assigned desk steps.
VERDICT: author submission; no independent verdict claimed
