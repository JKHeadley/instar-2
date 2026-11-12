# Change review — Model-window context defaults and truthful fixed-context recovery

Subject base: e3cb0f08d3a74d70c9e059edbd64fc457492bfff
Review state: open
Reviewed content: none
Outcome: A fresh journal derives its complete-prompt allowance from the selected model’s captured window and the measured fixed packet; existing journals retain their own cap. Fixed-context overflow produces an honest saved-input notice and retains that input for recall after an authorized raise.
Affected rules: 4, 7, 13, 14, 15, 30, 36, 40, 42, 44, 47, 55, 60, 75, 77, 78, 84, 95, 96, 101, 103, 113, 116, 123; purpose: no arbitrary capability limit and no loss of self-knowledge
Affected floors: secrets — existing redaction/custody; spend cap — same call/turn/output/effect bounds, finite larger input and unchanged subscription UNKNOWN charge; stop — same checks; no duplicate sends — same durable intent/receipt and replay test; durable intake — unchanged encrypted originals, including context-limited input after repair
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Changes a default resource budget and the existing root-creation/notice/recovery paths; preserves provider admission and journal authority.
Side effects: Higher possible input-token/quota use and latency, fewer unnecessary short-history summaries; unknown new models need measured context-window configuration. Older journals do not migrate automatically. Migration export now names the intended model.
Undo and recovery: Revert source and regenerate register. Journals keep their recorded limits and usage; the existing raise-caps doorway changes a pinned limit under recorded operator authority. Original message bytes are retained even if older software renders the old size notice.
Multi-machine posture: No new store or sharing path. Existing journal ownership/replication carries caps and notice frames; each conversation retains its own pinned allowance. A peer cannot change it by choosing a different launch default.
Layer below: Read constitution in full; traced journal replay/cap authority, envelope system-byte accounting, provider raised-prompt admission and 1 MiB ceiling, sourcePacket/yieldSources, per-source bounds and summary ladder, product-run argv, and migration export/import.
Bug class: integration
Bug evidence: reproducer=tests/preview/default-context-floor.test.ts; restart=tests/preview/default-context-floor.test.ts; live=recorded proof-room fixtures replayed in default-root-conversation.test.ts and summary-cascade-stall.test.ts; provider=tests/assembly/production-provider-subscription.test.ts
Hook bypass: none
Convergence: none
Decision: context-window-default | Reserve fixed measured bytes plus one quarter of remaining recorded window, with one byte per token conservative accounting and existing 1 MiB ceiling; same bounded inputs work on every harness. | reported=reviews/context-default-1112-change-review.md
Decision: context-notice-retention | Persist one optional notice flag so restart, status and post-raise recall distinguish fixed-context overflow from oversized user input. | reported=reviews/context-default-1112-change-review.md
Prompt review: No capability line, system prompt or answer instruction is shortened. A larger permitted packet retains existing source text. The runner-authored context-limit notice distinguishes installation capacity from message length. Recorded summaries, uncertain/undecided verdicts, reply reviews and empty historical replies are replayed by the existing suites.
Prompt finding: 105c1569b6bb | protocol-literal | Existing protocol or infrastructure wording, unchanged; the fixture tests that wording rather than defining a model decision — fixture-phrase tests/preview/journal.ts <- tests/preview/closing-notice-boundary.test.ts: "once stopped, this installation refuses renewal."
Prompt finding: 4106b49fff07 | protocol-literal | Existing protocol or infrastructure wording, unchanged; the fixture tests that wording rather than defining a model decision — fixture-phrase tests/preview/journal.ts <- tests/preview/topic-awareness.test.ts: "you attempted nothing outside this reply, so never call an avenue tried; a missi"
Prompt finding: 7ef11b68103f | protocol-literal | Existing protocol or infrastructure wording, unchanged; the fixture tests that wording rather than defining a model decision — fixture-phrase tests/preview/journal.ts <- tests/preview/closing-notice-boundary.test.ts: "after that it cannot read or answer messages here. its activation must be renewe"
Prompt finding: 849db3a6296a | protocol-literal | Existing protocol or infrastructure wording, unchanged; the fixture tests that wording rather than defining a model decision — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: 85544c20941f | protocol-literal | Existing protocol or infrastructure wording, unchanged; the fixture tests that wording rather than defining a model decision — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-conversation-session.test.ts: "your messages are kept and i'll answer them then; you don't need to resend them."
Prompt finding: 9f0106c66027 | protocol-literal | Existing protocol or infrastructure wording, unchanged; the fixture tests that wording rather than defining a model decision — fixture-phrase tests/preview/journal.ts <- tests/preview/plain-task-stop.test.ts: "the reason is unknown. your request and this incomplete attempt are saved. this "
Prompt finding: bac6ce7485d9 | protocol-literal | Existing protocol or infrastructure wording, unchanged; the fixture tests that wording rather than defining a model decision — fixture-phrase tests/preview/journal.ts <- tests/preview/plain-task-stop.test.ts: "work on your request stopped before a finished answer was available."
Prompt finding: e8708c7fea24 | protocol-literal | Existing protocol or infrastructure wording, unchanged; the fixture tests that wording rather than defining a model decision — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel; disclose unknown sources."

Subject (14 source paths, plus derived register output): register-source/owner-references/preview.json, docs/product-run.md, scripts/product-run.mjs, tests/assembly/production-provider-subscription.test.ts, tests/preview/README.md, tests/preview/default-context-floor.test.ts, tests/preview/default-root-conversation.test.ts, tests/preview/journal-agent.mjs, tests/preview/journal-agent.test.ts, tests/preview/journal-migrate.mjs, tests/preview/journal-migrate.test.ts, tests/preview/journal.test.ts, tests/preview/journal.ts, tests/preview/product-run.test.ts

## 1.x comparison and measured engineering decisions

JKHeadley/instar main db3ed6d3052cfcc24888b6c8bc86086abcfc2987: src/memory/WorkingMemoryAssembler.ts
(800/400/300/500 per-source tokens, 2000 total; full/compact/name-only),
docs/specs/context-budget-layered-summaries.md (window-relative budget, preserved user content,
retrievable originals, proposed 400K backstop within a 1M window), and history 511aca1835,
5129779c36, df4446717d and fb0b84d3d2. Carry the separation of fixed instructions, bounded
supplemental sources and whole-window budget; retain 2.0’s journal/summary/recall owners and
NF-52-compatible core. No filesystem/clock/keyword-search assembler is copied into the pure core.
ONEX-LESSONS was unavailable in the named local paths; remote snapshot URLs were omitted.

context-window-default: actual provider result fixtures report 1M tokens for Sonnet 5/Opus 4.8/Opus 5.5
and 200K for Haiku 4.5. Defaults are 23459 + floor((window - 4096 - 23459)/4): 266570 and 66570 bytes.
The quarter is an engineering allocation leaving room for harness/tool growth; one byte per token is a
conservative bound, not a claim about natural-language token density. A model absent from the measured
map needs an explicit measured window at installation; a supplied cap cannot bypass the model ceiling.
Sixteen maximally filled 266570-byte packets total 4265120 input bytes (previously 524288), while an ordinary
fresh packet stays about 26–30 KB. Subscription billed charge is UNKNOWN; increased quota/latency is possible.
Existing tool budget arguments, output limits and effect spend admission are unchanged.

context-notice-retention: fixed-context failure is detected by rerunning the existing fitting path with
an empty user message. The saved original remains available to history, summaries and recall after an
operator-authorized raise. Reopening cannot duplicate its notice. The full capability-note source remains
byte-for-byte; the existing compact routing map may still yield without removing capability-note lines.

Train-240 e3cb0f08d3a74d70c9e059edbd64fc457492bfff measured text/tool first packets 26146/29604 bytes;
train-242 5609a711f measured 26280/29738 (+134). Maximum-reply reviews: 32234/32441 and 32368/32575.
Tests inject that measured growth without merging train-242, as the brief permits. These are fresh-root
measurements with the full desk report, not the live operator’s 160990-byte history-bearing packet.

Team posture: all members retain existing principal/audience checks; no guest or member receives new
visibility or authority. Installation allowance is operator-owned; private source content and full intake
remain under their existing journal and sharing rules. Team-of-one works identically.

Full desk handoff report: /Users/dabombstudio/.instar/agents/echo/.instar/lanes/context-default-1112-build-report.md.
This off-Studio builder supplies the requested M5 handoff for the desk to copy there. The committed decision
report above is also readable in the Studio checkout and is the Rule 102 evidence for both decision rows.

## Independent implementation review

Reviewer: GPT-6 Astra, independent read-only agent, context-default-1112/astra_review, 2026-11-12.

VERDICT: YES — implementation accepted.

Reviewed context-budget, launcher, migration, provider admission, notice/replay/recovery changes and
supporting tests. Both earlier findings are resolved. Selected-model defaults preserve pinned journals;
saved ordinary input remains available after an authorized increase; complete capability-note text and
existing safety floors remain intact. The implementation follows Rule 116’s simplest robust route.

Verification limitation: the reviewer ran no tests and did not independently witness live delivery.
Reported test results support implementation acceptance, not readiness or live completion. Final required
checks remain the author’s responsibility. The requested subject-list correction is included above.

The preview fixture artifact pin was recomputed with the existing canonical hash function after all 25 journal-agent launcher tests passed; register output is replay-generated from the committed source. No native conformance certificate or governed changelog number is edited.

Register reproduction: replay from source ec3632ea81ec29a9feb842fd580582b9b7419820 produced generation sha256:580b24d6954f7ee76e7027fd7f67b330fb5b9b136a7946a62a0ccb1fa98a3ddc, committed in a77442ab9. Eight generated files changed mechanically; they add no product mechanism.

## Closing block

simplestRobustRoute: This is the simplest route: derive the genesis budget beside the existing measured floor; keep per-source limits, summary/retrieval, encrypted intake, cap records and raised-prompt provider admission. One durable notice flag prevents misclassifying saved ordinary input after repair. No new allocator, tokenizer, store, service or authority mechanism.
80/20: Targeted boundary, recorded-shape, restart, provider, migration and launcher tests establish the changed behavior; build/typecheck, architecture, lint, register and final pinned tests are recorded in the handoff report. No live deployment claim.
VERDICT: implementation accepted by independent Astra review above; the Studio landing gate remains the desk’s responsibility.
