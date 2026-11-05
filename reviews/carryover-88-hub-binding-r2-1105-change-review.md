# Change review — durable collaboration consumer

Subject base: b7389364305899f9d20baa11f51b073901342f6b
Review state: open
Reviewed content: none
Outcome: Adapt the 1.x CollaborationSurfacer and explicit hub binding to the existing encrypted owner journal and authenticated Threadline endpoint. Row 88 remains OPEN until production composition, production model composition, independent standby receipts and channel parity are complete.
Affected rules: 1, 4, 7, 14, 26, 28, 31, 32, 34, 39, 42, 44, 46, 49, 52, 53, 60, 63, 74, 79, 84, 87, 95, 101, 102, 105, 113, 116
Affected floors: secrets — existing redactor and encrypted journal; spend — model requests require the injected existing reserved model doorway; portable tests make no provider calls; stop — current host admission before append or dispatch; no duplicate sends — durable dispatch fence and stable effect identity; intake — authenticated endpoint custody retained before hub processing.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Shared encrypted journal schema and a transport consumer require integration, restart and handoff evidence; a component test is not a production composition claim.
Side effects: A new collaboration journal frame retains hub routing, accepted input, binding and effect evidence. Unknown effects are never automatically retried. Existing readers must understand this non-additive frame before they adopt such a journal.
Undo and recovery: Before any collaboration frame, revert the change. Afterward retain this reader or a compatible successor; never delete frames to downgrade. No live installation or authority is changed.
Multi-machine posture: Existing encrypted owner journal and replication demand; no second journal writer, private JSON store, execution authority or physical sender. The host supplies its existing admitted effect doorway. Dispatch fences are replicated before effects. Retained identities survive compaction and successor adoption.
Layer below: Constitution and register; 1.x CollaborationSurfacer.ts, hubCommands.ts, HubIntentClassifier.ts and openConversationBrief.ts; existing Threadline authenticated adapter/custody and AgentEndpoint admission; journal fsync, projection, compaction and replication.
1.x reference: CollaborationSurfacer.ts:113-231 routing, first-contact identity, silent housekeeping, readable gist and most-recent unbound; hubCommands.ts:98-163 explicit binding/ambiguity. Private files and history eviction are replaced by the existing journal. Full model/physical composition is not claimed.
Bug class: unit
Bug evidence: reproducer=tests/preview/collaboration-hub.test.ts
Hook bypass: none
Convergence: none
Prompt review: Exact 1.x hub-intent-v1 and open-conversation-brief-v1 prompt functions and parsers are adapted in hub-model-contract.ts. Request defaults remain .85 confidence, 6/400/40 classifier context, 200 tokens/4s and 10/800 brief context, 320 tokens/15s, 40-character name/600-character summary. Hash tests compare prompts against independently evaluated original source. hub-model-contract.test.ts uses explicit fixtures. hub-recorded.test.ts additionally hash-verifies six private actual isolated Studio provider outputs from carryover-88-hub-capture-1105-evidence and replays them through command/open/bind. No live-user acceptance or Telegram update IDs exist for those authored-corpus observations. The bounded production doorway remains required before acceptance.

Decision: AQ88-hub-custody | Consume admitted envelopes through the existing authenticated endpoint without changing its receipts, lookup or execution authority. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-88-hub-binding-r2-1105-PROGRESS.md
Decision: AQ88-hub-routing | Preserve one silent hub, parent content routing, explicit ambiguous-binding 409 and stable thread/notice identities in the existing encrypted journal. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-88-hub-binding-r2-1105-PROGRESS.md
Decision: AQ88-hub-fence | Separate prepared intents from replicated dispatch fences so unsent prepared work can resume while unknown effects never repeat. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-88-hub-binding-r2-1105-PROGRESS.md

Decision: AQ88-model-contract | Preserve the original prompt/parser/bounds and per-field fallback; require operator proof for bind/open, retain the chosen brief, and pass uncertain judgments through. The host must enforce call reservation/deadlines; six genuine isolated capture replays are supplied separately from deterministic neighbors; production composition remains outstanding. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-88-hub-binding-r2-1105-PROGRESS.md

Decision: AQ88-hub-publication | Merge the single owning Attention publication repair 06ec5baa/83356433, add only the new dark hub component fixture and regenerate the actual final source roster. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-88-hub-binding-r2-1105-PROGRESS.md

Prompt finding: 4106b49fff07 | protocol-literal | Existing session capability boundary describes observed tool availability, not an expected fixture answer. This change only adds a journal frame and does not alter that prompt.
Prompt finding: 849db3a6296a | protocol-literal | Existing empty-memory wording is conditional on the actual memory projection; the fixture quotes that governed-state branch. No prompt edit here.
Prompt finding: 85544c20941f | protocol-literal | Existing retained-input acknowledgement names actual custody, not a target answer supplied by this hub change.
Prompt finding: e8708c7fea24 | protocol-literal | Existing source-label grounding instruction is general and names uncertainty; it does not inject a test answer.
Skip: tests/preview/hub-recorded.test.ts:43 | scope=Private actual-provider recordings are supplied with INSTAR_HUB_CAPTURE_ROOT; absent evidence visibly skips, and never counts as recorded proof. This unit explicitly ran all six cases with hash-verified private bytes.

## Closing block

simplestRobustRoute: Adapt the existing surfacer's routing to the existing journal and transport endpoint. One serialized consumer prevents concurrent duplicate hub creation. A replicated dispatch fence prevents duplicate effects after owner loss; retained prepared state distinguishes work that can still drain. No new provider, timer, store or execution owner. Physical deployment and unattended shipped-path completion are not claimed by the portable component tests.
80/20: Focused deterministic consumer evidence first. Row 88 tracks the uncompleted production composition, model evidence, independently authenticated owner-offline receipt intake and channel parity. The 44 earlier failures remain unresolved under the desk diagnosis.
VERDICT: author submission only; independent review and actual installed proof remain required.
