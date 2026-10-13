# Change review — truthful unresolved cancellation outcomes

Subject base: 9f1e2db42b1418551aabf272cf67b41b08aecf1e
Review state: open
Reviewed content: none
Outcome: Resolve a plain answer's missing request decision through the existing bounded retry, or disclose that cancellation was not recorded even when advisory review is unavailable. Keep a resolved unrelated answer quiet.
Affected rules: Purpose constraint 3; Rules 10, 12, 26, 36, 42, 49, 52, 55, 57, 60, 70, 74, 75, 77, 93, 95, 101, 102, 111, 112, 113, 116.
Affected floors: secrets — existing redaction and outbound checks retained; spend cap — reuse the existing single reserved format retry without increasing limits; stop — existing pre-retry and pre-send checks retained; no duplicate sends — durable reservations and intents retained; durable intake — existing encrypted journal and quoted cancellation admission retained.
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: Repair the existing request decision and outcome disclosure path; no new store, permission, model port or independent gate.
Side effects: A plain answer with open requests may consume the existing one format retry. The model, not keywords, decides whether the message withdraws anything. If neither attempt supplies a decision, even an unrelated question can carry the truthful unchanged-state disclosure; without a contextual decision, code cannot safely distinguish it from a cancellation. Ordinary communication remains open when advisory reviewers are absent or unavailable. A successful no-withdrawal decision keeps the answer quiet. A retry that only wraps its prose without a request decision remains unresolved. A failed or UNKNOWN retry retains the existing outcome and reservation behavior; no uncertain paid call is repeated.
Undo and recovery: Revert the repair commit and regenerate pins. No journal schema or migration changes. Already recorded cancellations remain durable and previously recorded answers retain their historical bytes.
Multi-machine posture: The same owner journal determines request state on each host. No new machine-local state, replication route or ownership policy. Studio retains final full-suite and live-surface acceptance.
Layer below: Checked declarationDefect, formatReask, exact offered-id/operator-quote admission, answer replay, reminderUnsettled, openRequests, reply-review fail-open and durable send intent. Prose and reviewer absence cannot establish a cancellation. A completed recorded cancellation suppresses the reminder across restart; an unrecorded one does not.
Bug class: integration
Bug evidence: reproducer=tests/preview/journal-requested-action.test.ts
Hook bypass: none; core.hooksPath unset and shared hooks directory inspected, containing sample hooks only.
Convergence: none
Prompt review: The existing bounded format repair asks the same model to decide withdrawals against offered reminders and the unchanged operator message. It requests either quoted withdrawals or an empty decision without prescribing the semantic verdict. Exact captured answer bytes are replayed before a simulated repair decision. No new live model or Telegram proof is asserted.
Prompt finding: 849db3a6296a | protocol-literal | Existing fixed empty-memory renderer output; no operator-intent classifier is added.
Prompt finding: e8708c7fea24 | protocol-literal | Existing source-attribution instruction; unchanged here and not a fixture-specific verdict.
Decision: status-truth-repair-resolution | Reuse the single capped format retry for plain output with open requests, preserving model interpretation and quoted admission. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/status-truth-1013-repair-113359-PROGRESS.md
Decision: status-truth-repair-disclosure | Disclose unchanged requests when resolution remains missing, independent of reviewer availability; preserve quiet resolved unrelated answers. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/status-truth-1013-repair-113359-PROGRESS.md
Decision: status-truth-repair-replay | Replay recorded answer and non-decision shapes and distinguish simulated repair judgments from fresh live semantic evidence. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/status-truth-1013-repair-113359-PROGRESS.md
Decision: status-truth-repair-pins | Regenerate owner-reference and register pins with the delegated desk tools rather than editing hashes manually. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/status-truth-1013-repair-113359-PROGRESS.md

Subject: tests/preview/journal.ts, tests/preview/journal-requested-action.test.ts, tests/preview/status-truth-live.test.ts, register-source/owner-references/preview.json, generated/

## Closing block

simplestRobustRoute: Reuse the existing format retry, request quote admission and bounded standing-request outcome line. This is the simplest robust route: the missing decision gets one already-metered repair attempt, then honest disclosure, not a keyword classifier or a new reviewer dependency. Existing stop, spend, intake and send guards remain. No autonomous-completion or live-surface acceptance claim is made.
80/20: Repair the demonstrated plain-cancellation regression, prove admitted and unresolved cancellation plus unrelated-answer neighbors, and replay actual recorded shapes. Studio owns the full gate and live semantic acceptance.
VERDICT: author submission; no independent acceptance asserted — the desk records its own verdict
