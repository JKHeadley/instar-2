# Change review — Attention queue journal and authenticated operator consumer

Subject base: b5806d1e015dc650cdc1dee2e0accab05a849d4b
Review state: open
Reviewed content: none
Outcome: Preserve the deterministic Attention queue and acknowledgement lifecycle in the existing encrypted journal and expose it through the installed operator dashboard. Carryover row 88 remains OPEN; this is a tested partial carryover, not whole-feature parity.
Affected rules: 1, 7, 28, 31, 32, 33, 34, 36, 39, 42, 44, 46, 52, 53, 55, 60, 63, 74, 79, 84, 87, 95, 101, 102, 105, 113, 116, 118
Affected floors: secrets — existing PIN verifier, hashed receipt, redacted presentation and encrypted journal; spend cap — no model or provider call; stop — owner, stop, expiry and current activation checks precede mutations; no duplicate sends — no notification/send doorway added and status apply is atomic; durable intake — fsync precedes success, replica confirmation precedes confirmed acknowledgement.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Durable operator state with cross-machine recovery needs restart, replication, authenticated consumer and installed launcher evidence. Independent review and live acceptance remain desk gates.
Side effects: The dashboard gains non-authority Attention tracking forms. Its approval, decline, grant and stop routes remain absent. New non-additive journal events deliberately refuse rollback to an unaware reader, including after compaction. Existing roots acquire no new state until an attention event occurs.
Undo and recovery: Revert the UI/producer together before any Attention event exists. After events exist, retain this reader or a compatible successor; preserve the original encrypted journal and replica. Do not downgrade by deleting Attention frames. No live root is changed by this builder.
Multi-machine posture: All queue state lives in the existing shared journal. Only its current owner writes. Acknowledgement intent is durable before application; replication is required for confirmation on a paired installation. The real replica adoption test resumes the intent on a successor. A standalone standby intake endpoint is not implemented and remains in row 88's named next unit.
Layer below: Read purpose, rule book, register contract, current 1.x queue/condition/remote-ack/surfacer/binder code, existing journal append/compaction/replay, replication and operator PIN verification. Copied complete source/test baseline before adaptation. Existing journal fsync and replica receipts replace 1.x best-effort file writes. Existing signature/custody and ordinary send paths are unchanged.
1.x reference: TelegramAdapter.ts AttentionItem, create/upsert/reopen/status and persistence methods; AttentionConditionStore.ts; RemoteAckStore.ts; attentionApi.ts. Complete original modules and tests retained outside the tree for provenance; no unrelated TelegramAdapter content imported. Attention aliases are copied with own-key lookup so inherited object properties cannot become statuses, and clean EOF formatting; episode, identity, refresh, pending acknowledgement and attempt semantics are adapted to the journal.
Bug class: unit
Bug evidence: reproducer=tests/preview/attention-api-normalization.test.ts
Hook bypass: none
Convergence: none
Prompt review: No model prompt, model-output parser or meaning-inference decision is changed. Supplied recorded summary/review fixtures are replayed by their existing direct-consumer tests. They do not cover HubIntentClassifier or openConversationBrief and are not claimed as hub evidence.

Decision: AQ88-journal | Reuse the existing encrypted, replicated journal rather than port best-effort private files; atomic apply closes the acknowledgement crash window. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-88-evidence-resume-1105-PROGRESS.md
Decision: AQ88-surface | Bind the existing PIN-authenticated operator to tracking-only forms, with CSRF checks and current owner/activation revalidation; this is not an approval port. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-88-evidence-resume-1105-PROGRESS.md
Decision: AQ88-evidence | Proceed with deterministic behavior using supplied genuine recordings; leave full Threadline hub parity open until its actual transport consumer and model-specific captured outputs are available. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-88-evidence-resume-1105-PROGRESS.md
Decision: AQ88-retention | Keep inactive episode counters and terminal/exhausted acknowledgements instead of deleting them; a finite admission bound prevents unbounded active populations and the journal retains history. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-88-evidence-resume-1105-PROGRESS.md

Decision: AQ88-alias | Preserve the documented 1.x aliases while rejecting inherited object properties, which are not status or priority tokens. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-88-evidence-resume-1105-PROGRESS.md

Prompt finding: 4106b49fff07 | protocol-literal | Existing reply-only obligation guidance and its exact scoped-tools replacement key; the fixture reconstructs historical briefing bytes. No phrase or model assembly changes in this queue port.
Prompt finding: 849db3a6296a | protocol-literal | Deterministic empty-memory response and undo recognizer, asserted by the consumer test; this is state rendering, not a model answer supplied from a fixture.
Prompt finding: 85544c20941f | protocol-literal | Existing fixed model-outage notice with its replay recognizer; the fixture verifies durable intake messaging, not intent dispatch.
Prompt finding: e8708c7fea24 | protocol-literal | Generic evidence-citation requirement; the test removes that exact clause to measure the recall guidance boundary, not to select a fixture answer.

## Closing block

simplestRobustRoute: This is the simplest robust route for the completed subset: existing journal, replica, writer ownership and PIN surface, carrying the original queue identities and status vocabulary. Revision checks prevent stale closure; atomic apply prevents replay ambiguity; no new store, notifier or model call is introduced. Full autonomous hub behavior is not claimed.
80/20: Preserve and test deterministic work now. Remaining row 88 work is tracked in the local handoff report and remains OPEN: Threadline hub transport/binding/model adaptation, proactive producer routing, standby remote acknowledgement ingress and channel parity. No behavior is declared omitted because 2.0 supposedly does it better without evidence.
VERDICT: author submission; no independent verdict or live proof claimed.
