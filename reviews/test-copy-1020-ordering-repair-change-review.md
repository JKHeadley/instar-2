# Change review — Preserve copied history across bot update streams

Subject base: 0f59947c60cf0743909b31ca765c3ef1f1de3a75
Review state: open
Reviewed content: none
Outcome: New test-bot intake follows the copied chronological frontier, so ordinary history, summaries and recall remain visible even when the new bot's wire counter starts lower.
Affected rules: 7, 28, 29, 34, 35, 44, 45, 70, 74, 96, 101, 102, 113, 116. Rule 96 requires ordinary history rather than a saved-memory substitute; Rules 7/44/45 require replay and compaction to preserve its meaning. Existing principal, audience and effect checks remain at their doorways.
Affected floors: secrets — raw custody and writer verification unchanged; spend cap — existing accounting and bounds retained; stop — existing intake/dispatch stop checks retained; no duplicate sends — bot-qualified turn ids, raw update ids, cursors and effect receipts retained; durable intake — chronological position recorded in the same intake frame before processing.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: This repairs model grounding across a bot rebind, and checks chronology without changing authority or broadening the copy audience.
Side effects: Copied turns now use a journal-local chronological update for consumers already ordering on Turn.update. Telegram wire update, raw evidence, cursor and bot-qualified identity stay unchanged. Edit lineage must compare chronological positions and must not link a source bot's private-chat message to a different bot's edit. Non-copy intake retains its existing numbering.
Undo and recovery: Revert the repair before creating new copies. Once new historyUpdate frames have been written, retain this reader or a forward fix: older readers do not understand the additional position and can refuse later chronological intents. Never renumber existing signed or reserved evidence. Legacy rows without the field retain their original projection; subsequent corrected intake follows the complete frontier.
Multi-machine posture: Deliberately machine-local, as the existing test-copy store is. The durable intake position replays identically on another reader or after snapshot compaction; no new store, coordination service, authority or transport is introduced.
Layer below: Inspected intake authentication and raw writer binding, bot-qualified turn identity, waiting/cursor suppression, edit lineage, journal projection/snapshots, synthetic turn positions, history/summary/recall frontier consumers, and outgoing intent matching. Source encrypted bytes remain unchanged.
Bug class: integration
Bug evidence: reproducer=tests/preview/test-copy-ordering.test.ts
Hook bypass: none
Convergence: none
Decision: test-copy-ordering-1020-D1 | Persist historyUpdate on copied intake and project it as Turn.update, retaining wire ids and cursors. This repairs every existing chronological consumer without a new service or renumbering old evidence. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/test-copy-1020-repair-102419-PROGRESS.md
Decision: test-copy-ordering-1020-D2 | Match edit lineage within the current bot stream, using chronological comparison; equal private-chat message numbers in different bot streams cannot establish lineage. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/test-copy-1020-repair-102419-PROGRESS.md
Prompt review: No prompt wording, output parser, judgment or refusal policy changed. The model context now includes the ordinary copied history required by Rule 96. Recorded proof-room rows and model-output shapes are replayed; fresh model-port answers are deterministic test responses, not claims of live judgment quality.
Prompt finding: 4106b49fff07 | protocol-literal | Existing guidance tells an agent how to describe attempted work; the quoted invariant is unchanged by this ordering repair.
Prompt finding: 849db3a6296a | protocol-literal | Existing exact empty-memory status protocol is unchanged by this repair.
Prompt finding: e8708c7fea24 | protocol-literal | Existing source-label provenance instruction is unchanged by this repair.

## Closing block

simplestRobustRoute: Persist a chronological position only on intake after the existing durable test-copy rebind, while retaining the raw wire identity. Existing history, summary and recall consumers then work unchanged. The extra field prevents unrelated bot counters from hiding copied history; its persistence prevents replay from reinterpreting old evidence. Existing authentication, resource limits, stop and dispatch guards remain the start, limit and end-state guards. This is the simplest robust route; no autonomous live-completion claim is made by these offline tests.
80/20: Confined to the review's ordering defect and its immediate identity, edit and durability neighbors. No service, capability restriction or new review pipeline.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
