# Change review — Integrate the reviewed Telegram capability note

Subject base: ea75ce395d9fdd4f9f2f970e8c278b9fe37a5387
Review state: open
Reviewed content: none
Outcome: Distinguish the journal launcher's active Telegram bot conversation from the switched-off core telegram-conversation-adapter; grant no new ability.
Affected rules: Purpose accurate self-knowledge; 34, 36, 47, 49, 60, 70, 74, 78, 84, 101, 102, 103, 111, 113, 116
Affected floors: secrets — unchanged custody and checks; spend cap — unchanged model and byte bounds; stop — unchanged; no duplicate sends — unchanged send fence; durable intake — unchanged journal
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Model-facing capability clarification in the existing renderer, with recorded-answer replays and no authority or adapter activation change.
Side effects: The rendered note grows by 28 bytes for this launcher and shrinks for other inventories. The unchanged default-context-floor test measures the complete prompt. Existing captured notes are translated only for this explicit wording correction; captured bytes and judge digests remain unchanged. Generated source pins must follow the source commit.
Undo and recovery: Revert the unit and regenerate the source pins. No durable field, migration or activation is introduced.
Multi-machine posture: Repository-shared rendering, evaluated against each launcher's generated inventory. No ownership, replication or machine-local state changes.
Layer below: src/conversation/telegram.ts and its dark declaration; generated/capabilities.json marks preview-conversation available while the core adapter is switched-off; tests/preview/intake-principal.ts records the journal path as telegram-bot-api. The writer, grants and effect doorway remain untouched.
Bug class: integration
Bug evidence: reproducer=tests/preview/capnote-telegram.test.ts
Hook bypass: none; core.hooksPath checked unset, common hooks directory contains sample hooks only
Convergence: none
Decision: sb-capnote-merge | Ordinary merge of c209a1728af767080b282c861585af32a8d7f5f7 into pinned live ea75ce395d9fdd4f9f2f970e8c278b9fe37a5387. Source and tests merge unchanged; seven generated conflicts keep live bytes before replay. Unit report: /Users/dabombstudio/.instar/agents/echo/.instar/lanes/capnote-telegram-1012-PROGRESS.md. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-capnote-telegram-1012-PROGRESS.md
Decision: sb-capnote-publication | Existing desk chain repins zero inventory and owner references and replays publication from merged 97425b853cb693ecac2d2b76cbf19c5b8e294614; no new runtime machinery. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-capnote-telegram-1012-PROGRESS.md
Prompt review: Clarify the two implementations; no answer phrase is demanded, no judge rubric or accept/refuse logic changes. Replay three verbatim answer excerpts supplied by the brief and the captured prior note from capsentence2 update 840342414. Replay all seven existing summary, Jev, review and delivered/empty shapes with the new clarification asserted in the consumer packet. The test does not claim a fresh model judgment.
Prompt finding: 034c5250da92 | protocol-literal | Existing grant/tool guidance retained; historical fixture comparison, not a new phrase gate — fixture-phrase src/assembly/production-provider.ts <- tests/preview/selfdesc-abilities.test.ts: "run without another yes. the operator can tighten or revoke trust through setup-"
Prompt finding: 45e37ea2e9e9 | protocol-literal | Existing grant/tool guidance retained; historical fixture comparison, not a new phrase gate — fixture-phrase src/assembly/production-provider.ts <- tests/preview/selfdesc-abilities.test.ts: "checked when made. workspace work and public reads are already allowed. register"
Prompt finding: 4b98dc2a1b9f | protocol-literal | Existing grant/tool guidance retained; historical fixture comparison, not a new phrase gate — fixture-phrase tests/preview/briefing.ts <- tests/preview/selfdesc-abilities.test.ts: "tools: full claude code set"
Prompt finding: 6af48f94b789 | protocol-literal | Existing grant/tool guidance retained; historical fixture comparison, not a new phrase gate — fixture-phrase src/assembly/production-provider.ts <- tests/preview/selfdesc-abilities.test.ts: "sends remain outside the one-machine closed set. the effect doorway reports any "
Prompt finding: 95e349aaf4ac | protocol-literal | Existing grant/tool guidance retained; historical fixture comparison, not a new phrase gate — fixture-phrase tests/preview/briefing.ts <- tests/preview/selfdesc-abilities.test.ts: "via the doorway's four tests; standing grants need no new approval."
Prompt finding: b00ed403060a | protocol-literal | Existing grant/tool guidance retained; historical fixture comparison, not a new phrase gate — fixture-phrase src/assembly/production-provider.ts <- tests/preview/selfdesc-abilities.test.ts: "checked when made. workspace work and public reads are already allowed. register"

Subject (12 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, tests/preview/briefing.ts, tests/preview/capnote-telegram.test.ts, tests/preview/fixtures/capnote-telegram-2026-10-12.json, tests/preview/group-carry.test.ts, tests/preview/selfdesc-abilities.test.ts

Generated evidence: Regenerated with node scripts/build-register.mjs --replay --commit 97425b853cb693ecac2d2b76cbf19c5b8e294614; feature declarations and availability remain unchanged.

Historical-comparison repair: Apply the same explicit channel-note translation to the older K11a capture as to the two newer captures. Historical fixture bytes and judge digests remain unchanged. All eight selfdesc-abilities tests pass after this correction.

## Closing block

simplestRobustRoute: This is the simplest robust route: merge the independently reviewed unit unchanged and regenerate publication using existing desk tools, qualifying the misleading disabled entry in the existing note. The exact launcher plus available conversation feature guards against falsely claiming a channel for another installation. No new store, channel, authority or model call; the context floor and runtime limits are unchanged. End checks are consumer replays and the standard source gates. No unattended deployment claim.
80/20: Targeted direct-import tests and pinned-text gate only; full-suite and live deployment acceptance belong to the desk.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
