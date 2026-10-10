# Change review — Fit forum reply review inside its admitted output allowance

Subject base: 5aea0755ed90da19cfc99dd75b7bb5716e385815
Review state: open
Reviewed content: none
Outcome: A captured forum answer was replaced with a holding notice when the reviewer produced 2136 tokens against its 2048-token ceiling. Ask for compact reasoning and verdict reasons, including on the format re-ask, so the review can finish within the existing allowance. The real replay completes at 1048 tokens and the journal worker sends the original candidate once.
Affected rules: 4, 34, 36, 37, 41, 49, 55, 57, 58, 60, 70, 74, 75, 77, 86, 95, 101, 111, 112, 113, 116
Affected floors: secrets — exact material checks and shared-audience review remain mandatory; spend cap — identical 2048-token provider ceiling, call reservations and deadlines; stop — existing checks unchanged; no duplicate sends — restart regression proves one send; durable intake — original draft remains journaled even when review is unavailable
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Changes the instruction sent to the model whose review controls group disclosure; no authority, tool or framework capability changes.
Side effects: All reply reviews receive a smaller prose request. The parser still accepts complete reasons up to its existing 600-character ceiling; the actual replay includes a reason over the new requested length and is accepted. Every selected rule and its full context remains supplied. The prompt is guidance, not a guarantee: an over-cap or unavailable reviewer still holds a group candidate.
Undo and recovery: Revert the prompt repair and regenerate register provenance. No production state migration. Existing review reservations remain charged; UNKNOWN calls are never retried by this change.
Multi-machine posture: Machine-local prompt assembly, identical on each owner; no changes to ownership, replication, transport or durable journal format.
Layer below: Inspected subscriptionConversationPolicy and createClaudeCodeSubscriptionRoute token admission, journal-agent invokeSubscription/escalate, reply-check selected-rule construction and parser, journal.ts shared-audience hold and restart deduplication. The failing recorded review has null output and 2136 usage; the particular text that consumed those tokens is unavailable, so verbose reasoning is a prompt-level risk, not a claimed recovered transcript.
Bug class: integration
Bug evidence: reproducer=tests/preview/reply-review-budget.test.ts
Hook bypass: none; core.hooksPath unset and common hooks directory contains only samples, checked locally
Convergence: none
Prompt review: Rule meanings, verdict completeness and full-context inputs are unchanged; only prose allocation changes. No literal test answer, keyword decision, authority widening or additional paid retry is introduced. The real claude-sonnet-5 replay uses the captured review envelope with only its task question replaced; the exact prompt SHA is asserted in the regression.
Decision: bounded-review-prose | Reuse the existing reviewer and unchanged provider ceiling; ask for all verdicts in compact form instead of enlarging caps or releasing unreviewed shared replies | reported=sb-w4-group-combo-repair-PROGRESS.md

Evidence: Read-only forum-answer-copy-20261010-115108 update 715675387, journal SHA and exact review input retained in fixtures/forum-review-budget-2026-10-10.json. Original Jev unsure, subscription uncertain, delivered holding notice and the new real reviewer output are captured. Worker replay proves complete review sends the candidate exactly once and unavailable review still holds across restart. Recorded disclosure refusal and fragment/coherent verdicts from update 969390330 remain enforced. Existing proof-room replay includes summary uncertain and Jev undecided at 715672479–715672500; captured delivered/empty context bytes at 715672479/715672550 remain distinct. Empty context is not represented as an actual empty Telegram send.

## Closing block

simplestRobustRoute: This is the simplest robust route: make the existing review ask fit its already enforced allowance. No new gate, service, retry or parsing rule. Start guards retain exact audience and context; the end guard requires all verdicts; token/call/deadline limits, stop, credential wall, durable cause and no duplicate sends remain enforced. A real isolated model replay completed unattended at 1048 tokens; this is not a claim of deployment or a fresh Telegram answer check.
80/20: Focused reply-check and recorded-budget worker regressions pass 70/70. Required recorded-shape checks and typecheck results are in the external PROGRESS; saved full-gate contracts are checked at their original root without altering receipts. No full suite run on this machine and no fresh full-suite claim. The pipeline owns the next live answer check and gate.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
