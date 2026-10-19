# Change review — provider-neutral subscription credential labels

Subject base: fabc3f086a650de36a52af5a932ca0c99c5f301a
Review state: open
Reviewed content: none
Outcome: The shared subscription-login fallback describes a subscription sign-in without inventing its provider, including for the registered Codex doorway. Explicit display labels remain authoritative.
Affected rules: 1, 30, 34, 36, 49, 70, 74, 80, 84, 100, 101, 102, 111, 113, 116
Affected floors: secrets — public-fact filtering is unchanged and replayed; spend cap — no model call added; stop — unchanged; no duplicate sends — original notice keys remain unchanged and restart is tested; durable intake — no record or journal rewrite
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: The fallback is supplied to reply-review model facts as well as operator status and reminders.
Side effects: Unlabeled subscription records and newly registered subscription labels no longer claim Claude. Existing explicit labels are retained. Custody names, account identities, expiry schedules and notice keys do not change.
Undo and recovery: Revert the repair commit. No state migration or key rename is required; explicit labels and custody records remain readable.
Multi-machine posture: A pure projection applies identically on every machine running this revision. Existing machine-local custody and journal ownership are unchanged; no new state is added.
Layer below: journal-agent registers the same subscription-login kind for the selected subscription doorway. The real doorway registry identifies codex-cli-subscription as openai. Public credential facts still filter held material, and reminders still deduplicate by the original record name and expiry.
Bug class: user-facing
Bug evidence: reproducer=tests/preview/credential-display.test.ts; live=tests/preview/fixtures/credlabel-proofroom-T-2026-10-03.json
Hook bypass: none
Convergence: none
Decision: w4-credname-repair-124824-neutral-fallback | use the review's provider-neutral fallback and retain explicit labels; this fixes the false Codex provider claim without a classifier or new registry | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-credname-repair-124824-PROGRESS.md
Prompt review: Only the credential label supplied in existing review facts changes. No prompt question, verdict parser, dispatch, acceptance, escalation or refusal logic changes. Existing captured proof-room replays exercise updates 715673352, 715673353 and 6232017, preserving recorded answer bodies, Jev uncertainty, review PASS/VIOLATION and uncertain revision behavior. This is recorded-shape replay, not a fresh model judgment or live-channel completion claim.
Register maintenance: The desk's supplied rehash tool refreshed the existing journal-agent-resources owner-reference hash, and build-register replay regenerated generated/ from commit 4319c050a81c953bff9fc52ad947ac2856634152. The repin chain found no inventory changes. These are source-pin refreshes required by the repair brief, not changes to registry membership or authority.

## Closing block

simplestRobustRoute: This is the simplest robust route: remove the unsupported provider name from the existing fallback, retain explicit labels, and cover the registered Codex shared-kind case at display, reminder and public-fact consumers. Start guard: existing custody records; end-state: focused consumer assertions and recorded worker replay; limits: unchanged secret, spend, stop, intake and send gates. No added machinery or autonomous-completion claim.
80/20: MF1 is repaired at its source with a one-line behavior change and focused regression coverage. Full-suite, independent review and live-channel completion remain the pipeline's gate evidence.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
