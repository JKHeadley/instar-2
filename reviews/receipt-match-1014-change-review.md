# Change review — canonical reply preparation

Subject base: c458547406d4ad8f3c7988f8247befb73775f618
Review state: open
Reviewed content: none
Outcome: Terminal whitespace is removed before reply sizing, signing, journaling and dispatch, so the intent and exact expected receipt describe the canonical text. The model answer remains unchanged.
Affected rules: Rules 1, 4, 26, 34, 36, 41, 42, 49, 57, 70, 74, 77, 89, 101, 102, 108, 111, 113, 116; purpose constraints 2 and 3.
Affected floors: secrets — existing outbound scanning still sees the canonical full reply and every part; spend cap and stop — unchanged admission; no duplicate sends — exact receipt classifier and durable UNKNOWN non-repeatability unchanged; durable intake — original intake and answer retained.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Changes preparation of user-facing signed send intents, with exact-receipt and reopen regressions.
Side effects: Only terminal whitespace is removed; interior and leading whitespace remain. Canonicalization precedes size measurement, so whitespace alone cannot cause unnecessary splitting. A preserved operator-request tail is canonicalized together with the body and remains whole. Existing intents are never rewritten or resent. No matcher leniency, new state, retry, model call or prompt change.
Undo and recovery: Revert the code commit for future preparation; keep every existing journal and receipt. Previously dispatched UNKNOWN intents remain non-repeatable in either version. No data migration is needed.
Multi-machine posture: Pure deterministic preparation on the current conversation owner, before the existing durable signed intent. No new store, owner, transport or replication rule; existing ownership and journal durability apply on every host.
Layer below: Inspected splitReply, journal signing and intent construction, Telegram HTML encoding and exact chat/thread/text/positive-id classifier, per-part send state, and the existing-intent no-resend guard. The batch test uses the shipped host modelBatch closure and conversation coordinator, with counterfactual Telegram responses passed through the real classifier.
Bug class: live-path
Bug evidence: reproducer=tests/preview/receipt-match.test.ts; live=tests/preview/fixtures/receipt-match-c1-2026-10-14.json
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains only sample hooks.
Convergence: none
Prompt review: No prompts, output parsers or semantic verdicts change. Recorded c1 answer update 46040043 exercises the new preparation; existing journal-topic-sessions replays recorded summary, uncertain summary, Jev, reply-review and delivered/empty reply shapes through the canonical send path. Receipts are explicitly counterfactual because the original provider response was not retained.
Prompt finding: 849db3a6296a | quoted-evidence | Existing memory-list wording is unchanged; this change prepares reply bytes and adds no semantic matcher.
Prompt finding: e8708c7fea24 | quoted-evidence | Existing recall wording is unchanged; no prompt or meaning decision is introduced.

Decision: receipt-match-canonical | Normalize terminal whitespace in the existing preparation, before any signed intent, keeping exact receipt checks and original answer custody. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/receipt-match-1014-PROGRESS.md
Decision: receipt-match-evidence | Replay captured c1 answer with clearly labeled counterfactual receipts; do not claim the absent raw response proves provider normalization. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/receipt-match-1014-PROGRESS.md
Decision: receipt-match-completeness | Report the separate semantic completeness defect and smallest candidate repair under brief item 3; do not guess a model-quality fix from a transport repair. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/receipt-match-1014-PROGRESS.md

Decision: receipt-match-publication | Regenerate the register with the existing replay builder from the pushed source commit; change no native conformance declaration. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/receipt-match-1014-PROGRESS.md

Subject (12 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, tests/preview/fixtures/receipt-match-c1-2026-10-14.json, tests/preview/journal-topic-sessions.test.ts, tests/preview/journal.ts, tests/preview/receipt-match.test.ts, tests/preview/reply-parts.ts

simplestRobustRoute: This is the simplest route: trim terminal whitespace in the existing preparation, retaining the existing splitter, signing, journal, receipt classifier and no-resend guard. No added product machinery. Start guards remain authority, stop, spend and secret checks; end evidence remains exact provider receipts for every part. Offline replays prove the specified boundary, not live provider normalization or unattended deployment acceptance.
80/20: Targeted reply/sending/batch tests and required typecheck, architecture, register, review and pinned-text checks. Full-suite and live-surface gates belong to the desk under this brief.
VERDICT: author submission; no independent convergence or live acceptance claim
