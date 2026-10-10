# Change review — identify the current forum topic and shared memory sources

Subject base: afa6be392876eb17c2789651090fa90b83a81f92
Review state: open
Reviewed content: none
Outcome: The forum packet always identifies the current message topic, including General, and shared datedPending, dated and memory candidates carry their original topic with the existing source label. Recall and other existing provenance use the same name for General. Known topic names, including a renamed General, come from captured service events. Recent history and reply destinations remain per topic; facts remain shared.
Affected rules: 2, 7, 11, 26, 34, 36, 49, 70, 74, 89, 96, 101, 106, 111, 113, 116
Affected floors: secrets — existing redaction, group disclosure and outbound checks; spend cap — no added call or changed reservation; stop — unchanged checks; no duplicate sends — unchanged intent and delivery state; durable intake — unchanged capture and replay
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Changes model-facing context used for a user-visible forum reply, without changing effect authorization or journal schema.
Side effects: Forum packets gain bounded per-item topic/source fields and a clearer current-topic instruction. General's source labels now say General instead of main chat; a captured General rename is retained in the existing topic-name projection. Added bytes participate in existing packet limits and omission counts. Private packets retain identical bytes, verified against afa6be39. No new persisted state, migration, model round, dependency or service.
Undo and recovery: Revert the source change and replay the register. Existing journals remain readable in both directions; topic labels are derived on replay, so no data rollback is needed. Do not replay prior send intents.
Multi-machine posture: Pure projection from the existing replicated journal on each serving host; no new store, authority or ownership. The existing conversation owner and disclosure checks remain the effect boundaries.
Layer below: Forum boundThread canonicalizes General to undefined; topicNames reads only matching-chat service events; turnLabel supplies existing provenance; packet selection bounds optional material; reserve/intent/sent records and the existing disclosure gate retain their floors.
Bug class: user-facing
Bug evidence: reproducer=tests/preview/topic-awareness.test.ts; live=tests/preview/fixtures/topic-awareness-live-2026-10-10.json
Hook bypass: none
Convergence: none
Prompt review: The forum-only instruction distinguishes the current topic from the topic where a shared fact was learned; it includes no fixture word or expected answer. Actual forum updates 969390330-332 reproduce the old omitted audience.conversation and unlabelled CEDAR pending item. Corrected packet replay through the subscription model answers General; a separate attribution question answers General and attributes CEDAR to topic 3, citing 969390331. Both actual model outputs replay through worker parsing and a captured send port. This is model replay and fixture delivery, not a new live Telegram send or an independent gate verdict. All 384 real proof-room rows (715672479-715672500) replay against old and new workers with identical private packets: accepted summaries 480/481/484, uncertain reservations 492/496/497, Jev unsure/unavailable, reply-review and delivered answers. No real empty delivered bubble is present in that capture; the existing synthetic empty-answer neighbor ran in journal-conversations.test.ts and is not misreported as recorded evidence.
Prompt finding: 849db3a6296a | protocol-literal | existing memory-list protocol wording, unchanged
Prompt finding: bd01de21286a | protocol-literal | existing source citation guidance, unchanged
Prompt finding: fb5fa7e706c8 | protocol-literal | existing grounding protocol guidance, unchanged
Decision: w4-topic-awareness2-labels | reuse topicNames and turnLabel, add fields only for forum roots, and identify the current topic through the existing audience.conversation field | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-topic-awareness2-PROGRESS.md

## Closing block

simplestRobustRoute: This is the simplest robust route: use the existing current-topic and source-label projections. The missing labels caused the concrete CEDAR failure; no new state or gate is needed. Start guards are authenticated topic identity and current disclosure, the end state is a correctly grounded answer, and existing packet/spend/send limits remain unchanged. Actual model replay identifies General and the source topic without assistance; live installation certification belongs to the pipeline after push.
80/20: Targeted routing, memory, recorded-shape and model-replay tests pass; typecheck and architecture pass. Private packet equality is measured against the original build. No independent convergence or full-suite result is claimed by this author submission.
VERDICT: author submission; independent review and full-suite gate belong to the pipeline
