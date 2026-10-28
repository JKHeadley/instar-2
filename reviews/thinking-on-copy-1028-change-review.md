# Change review — Enable subscription thinking within existing generation limits

Subject base: f2798733d43ee4460aac33c40e2f9364a0e52d04
Review state: open
Reviewed content: none
Outcome: Enable thinking for candidate subscription calls within the existing total-generation and answer-token limits; no deployment or provider call.
Affected rules: 1, 30, 36, 49, 60, 74, 75, 101, 102, 113, 116
Affected floors: secrets — custodian and env allowlist retained; spend cap — calls, retries, total generation and answer limits unchanged; stop — existing check before each command retained; no duplicate sends — no delivery edits; durable intake — no journal edits.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Changes model thinking configuration, with unchanged prompts, parser and resource limits.
Side effects: Adaptive models choose their own thinking depth within the total output ceiling and may leave less room for an answer. Numeric 2048 is a fixed budget only on models supporting fixed thinking, not an adaptive thinking cap. Cost and answer quality require the desk copy comparison. Existing activation policy digests do not include env settings; candidate source identity must be reviewed by the desk before switching.
Undo and recovery: Revert this commit and rebuild the copy. No persisted format or migration is introduced.
Multi-machine posture: Identical adapter configuration wherever this candidate is built. Ownership and journal replication unchanged; no new state.
Layer below: Read both constitutional documents in full. Inspected adapter env, generation allowance, usage accounting, activation validation and 1.x frameworkSessionLaunch.ts. Official Claude Code env reference confirms positive MAX_THINKING_TOKENS enables adaptive thinking but its numeric value is ignored on adaptive models.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: thinking-existing-headroom | Enable adaptive thinking with positive 2048 while preserving the already allocated generation headroom and answer-token accounting; do not import 1.x effort pins or widen limits. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/thinking-caps-copy-1028-PROGRESS.md
Prompt review: No prompt or decision parser changes. Existing protocol literals below are unchanged; offline real captured usage and summary outputs exercise enabled launch, with existing recorded-shape regressions covering review and empty replies.
Prompt finding: 0d4664ea9de7 | protocol-literal | Existing unchanged protocol guidance, not a new keyword decision — fixture-phrase src/assembly/production-provider.ts <- tests/preview/selfdesc-abilities.test.ts: "run without another yes. the operator can tighten or revoke trust through setup-"
Prompt finding: 14d7eeccc218 | protocol-literal | Existing unchanged protocol guidance, not a new keyword decision — fixture-phrase src/assembly/production-provider.ts <- tests/preview/selfdesc-abilities.test.ts: "checked when made. workspace work and public reads are already allowed. register"
Prompt finding: 38a2c5d186f1 | protocol-literal | Existing unchanged protocol guidance, not a new keyword decision — fixture-phrase src/assembly/production-provider.ts <- tests/preview/act-first.test.ts: "give a brief decision rationale supported by the relevant evidence."
Prompt finding: 45e37ea2e9e9 | protocol-literal | Existing unchanged protocol guidance, not a new keyword decision — fixture-phrase src/assembly/production-provider.ts <- tests/preview/selfdesc-abilities.test.ts: "checked when made. workspace work and public reads are already allowed. register"
Prompt finding: 9781075d458e | protocol-literal | Existing unchanged protocol guidance, not a new keyword decision — fixture-phrase src/assembly/production-provider.ts <- tests/preview/selfdesc-abilities.test.ts: "the effect doorway reports any refusal and its reason; say so plainly."
Prompt finding: b1bb3946362d | protocol-literal | Existing unchanged protocol guidance, not a new keyword decision — fixture-phrase src/assembly/production-provider.ts <- tests/preview/act-first.test.ts: "you are an instar 2.0 agent,"

Subject (6 paths): src/assembly/production-provider.ts, tests/assembly/production-provider-subscription.test.ts, tests/preview/journal-provider.test.ts, tests/preview/live-failure-catalog.test.ts, tests/preview/reply-review-corpus.test.ts, tests/preview/stage2-recovery.test.ts

Validation: Portable Claude replay includes the seven captured summary-writer, summary-uncertain, Jev-undecided, Jev-unsure, reply-review, delivered-reply and empty-reply shapes from retrospective-duty-followup-train-1-2026-10-08.json. Their text is exact; their CLI wrapper and usage are synthetic. Transport preserves those shapes for the existing downstream readers; no fresh model-output claim.

Combined-copy provenance: original thinking-only report destination was /Users/dabombstudio/.instar/agents/echo/.instar/lanes/thinking-on-copy-1028-PROGRESS.md; the combined handoff now also names the inherited decision. Original commits and replay evidence remain in history.

Prompt finding: 42faf877ba82 | protocol-literal | Unchanged existing protocol guidance; no prompt edits in either candidate — fixture-phrase src/assembly/production-codex-provider.ts <- tests/preview/act-first.test.ts: "you are an instar 2.0 agent,"
Prompt finding: 7a4f0c3f557c | protocol-literal | Unchanged existing protocol guidance; no prompt edits in either candidate — fixture-phrase src/assembly/production-codex-provider.ts <- tests/preview/act-first.test.ts: "give a brief decision rationale supported by the relevant evidence."

## Closing block

simplestRobustRoute: This is the simplest robust route: change the existing env-only off setting to 2048, reusing generation headroom already present. No routing table, new flag, cap increase or migration. Exact activation, spend reservation and stop checks remain start guards; answer admission and reply review remain end guards. This is an offline candidate, not an unattended live completion claim.
80/20: One runtime value changes; targeted admission, refusal and replay checks establish configuration and accounting. The desk owns independent review and live cost/quality comparison.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
