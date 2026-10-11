# Change review — holding train-5 missing reply anchor repair

Subject base: 0dfe13ebf30b23fdaf41579f181fed4edf8d75be
Review state: open
Reviewed content: none
Outcome: Deliver the reviewed answer or terminal notice to its existing topic even when the original intake message has disappeared.
Affected rules: 37, 42, 49, 63, 70, 74, 77, 89, 95, 101, 102, 107, 111, 112, 113, 116
Affected floors: secrets — disclosure and outbound checks retained; spend cap — no provider or reservation change; stop — existing checks retained; no duplicate sends — one dispatch, no added retry or changed UNKNOWN classification; durable intake — existing intent admission and replication retained
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: One Telegram request field repairs optional same-topic reply anchoring; no prompt, model parsing, authority or delivery classification changes.
Side effects: Telegram may omit the reply link when the original is missing. The chat, message_thread_id, text and provenance remain bound to the original send. Present originals still anchor normally. Existing ownership, disclosure, admission, replication and stop checks run before dispatch. Generated source pins are refreshed with the delegated desk tools and register generator.
Undo and recovery: Revert the repair and regenerate pins to restore mandatory anchoring; this reintroduces the missing-original refusal. No durable state format or migration changes.
Multi-machine posture: The same physical request construction applies on every owner host. Shared admission still requires the durable signed intent and claim before one send; no new machine-local state or coordination.
Layer below: Inspected the actual host send body and classifyTelegramSend. Regression cases execute that body with a constructed Telegram API-contract response and the real classifier, covering present and missing originals for an answer and both final notices, with one intent admission and one physical invocation. This is not live Telegram evidence.
Bug class: integration
Bug evidence: reproducer=tests/preview/group-carry-requests.test.ts
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains sample files only
Convergence: none
Decision: holding-train5-repair-optional-anchor | Add allow_sending_without_reply to the existing same-topic reply_parameters object; preserve the topic and use one send, with no fallback protocol. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-holding-onto-train5-repair-131012-PROGRESS.md
Decision: holding-train5-repair-pin-refresh | Regenerate affected source pins with the delegated desk scripts and register generator; never edit pin values by hand. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-holding-onto-train5-repair-131012-PROGRESS.md
Prompt review: No model-facing change. Targeted existing tests also replay the recorded CEDAR answer for update 969390331 and the captured unavailable-review fixture; the missing-original transport responses are explicitly constructed controls.

Subject (outside reviews): tests/preview/journal-agent.mjs; tests/preview/group-carry-requests.test.ts; generated/capabilities.json; generated/capabilities.md; generated/coverage.md; generated/glossary.md; generated/register.json; generated/rules.md; generated/source.json. Register replay binds generation sha256:d502010e115576cb553f1d2e220f286dffa7fd81e4106d3ed6c6d2567897ebb5 to source commit 586b12a54012ad378bc722366c1d458cebbb7d72; no owner-manifest or grounding-inventory pin changed.

## Closing block

simplestRobustRoute: This is the requested simplest robust route: one optional-anchor flag on the existing signed, admitted send. Start guards remain provenance, ownership, disclosure, stop and durable admission; completion still requires the exact accepted receipt; resource and UNKNOWN non-repeat limits remain unchanged. No new mechanism or autonomous-completion claim.
80/20: Fix the one reviewed delivery regression, verify both original-message conditions at the shipped send boundary, run targeted tests and cheap checks, then submit the pushed repair for independent landing review. Saved gate results were unavailable through the specified Studio API; no full-suite or live-deployment claim.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
