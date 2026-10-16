# Change review — owed delivery held-result recovery

Subject base: 3eebffebb421c9cbe839ba998a3f486fff07ea4a
Review state: open
Reviewed content: none
Outcome: a requested result omitted from its consumed delivery intent returns to existing owned rework with its recorded objection, including journal replay, without repeating an UNKNOWN result send.
Affected rules: 4, 8, 10, 26, 28, 29, 34, 36, 38, 39, 42, 46, 52, 55, 57, 60, 63, 64, 68, 70, 74, 83, 84, 86, 87, 92, 93, 101, 102, 107, 111, 113, 116
Affected floors: secrets — credential and audience review still hold; spend cap — existing bounded work and reply allowances; stop — existing work and dispatch gates; no duplicate sends — only results absent from the canonical intent are reworked, sent/UNKNOWN results retain binding and receipt settlement; durable intake — replay the same authenticated journal, no new store.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: repair to requested outbound result lifecycle; no authority or review policy change.
Side effects: a consumed owed occurrence that omitted its result now makes that result eligible for a bounded correction step. Ordinary next-message reports keep their existing transition. Review reason bytes are redacted and bounded before entering rework. A holding notice with UNKNOWN transport outcome is never retried; the result it did not contain remains separate owed work.
Undo and recovery: revert the projection change before deployment if necessary; no new record shape is introduced. Reverting restores the duplicate-occurrence defect for omitted results. Keep existing journal bytes and send bindings; never erase an UNKNOWN intent. Reopening historical holding intents derives rework from the recorded exact result slot, omitted bytes and review objection.
Multi-machine posture: existing conversation ownership, signed scheduler occurrence and replicated journal remain the authority. No new machine-local state, sender, queue or peer path. The same ordered journal projects the same withheld work after restart.
Layer below: inspected applyIntentObligations report binding, owedResultAuthority and action-due slot validation, obligationDue rework slot selection, work packet withheld context, current audience and outbound checks, and complete receipt settlement. UNKNOWN result intents remain bound; only exact absent report text is eligible.
Bug class: unit
Bug evidence: reproducer=tests/preview/owed-delivery.test.ts
Hook bypass: none
Convergence: none
Decision: owed-held-rework | project an omitted owed result through existing withheld work so both current and historical holding intents recover without inventing an occurrence or retrying an actual UNKNOWN result | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/owed-delivery-1015-repair-184857-PROGRESS.md
Prompt review: model-facing context only; no prompt, parser or review accept/refuse policy changes. Replays the recorded report and credential violation from proof-room update 715673352 and the passing credential finding from neighboring update 715673353. The correction step receives the retained report and objection. Existing recorded completed work update 6232091 and summary/Jev/review/delivered/empty-context shapes remain in the targeted tests. This is offline lifecycle evidence; unattended live acceptance remains desk-owned and unclaimed.
Prompt finding: 4106b49fff07 | quoted-evidence | existing historical packet normalization in topic-awareness preserves the immutable capture, unchanged here.
Prompt finding: 849db3a6296a | protocol-literal | existing saved-memory response in journal.ts, unchanged here.
Prompt finding: e8708c7fea24 | protocol-literal | existing source-label guidance in journal.ts, unchanged here.

## Closing block

simplestRobustRoute: this is the simplest robust route: reuse the journal's withheld/rework transition at the consumed intent, with exact slot and absent-text checks. It prevents the reproduced duplicate-ID failure on same-worker polling and replay without a queue, service, classifier, new review round or weaker credential checkpoint. Existing owner/source, stop and cap checks guard entry; complete transport receipts alone close work. Live unattended acceptance is reserved for the desk.
80/20: the regression first failed on same-worker, reopened-journal and UNKNOWN holding-notice cases while its passing-review neighbor passed. The repair retains the existing no-duplicate and split-receipt tests and proves corrected work uses a new slot and delivers once.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
