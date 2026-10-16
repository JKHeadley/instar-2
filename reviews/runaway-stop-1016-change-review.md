# Change review — durable safety-ceiling halt

Subject base: 17dfeb44673820f6196086e9f62f7b12ccc56a14
Review state: open
Reviewed content: none
Outcome: The existing conversation owner records deadline/spend halts durably before cleanup; the independent watchdog records its exact cause and the journal emits an honest, signed infrastructure result once.
Affected rules: Rules 1, 4, 8, 15, 26, 34, 36, 42, 49, 52, 55, 60, 61, 63, 68, 74, 89, 93, 97, 101, 102, 111, 113, 114 and 116; purpose durable cause and no silent loss.
Affected floors: secrets — existing outbound check retained; spend cap — existing allowance and refusal remain enforced; stop — operator stop remains separate and suppresses sending; no duplicate sends — original reply operation and durable intent retained; durable intake — original queued inputs and uncertain effects preserved.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Resource enforcement and durable cause cross the physical worker and reply boundaries.
Side effects: A safety halt inhibits new work under the same allowance after restart. It does not reset budgets or authorize retry. The additive optional fields retain old records. The watchdog now shares the driver's existing bounded lock so a renewed turn cannot race past the halt check. An unwritable halt prevents actuation, preserving the durable-cause floor; the model admission checkpoint still enforces its independent deadline/call bounds. Failed cleanup keeps the worker identity, never claims it gone. An unrelated exit or unreadable accounting stays uncertain without a false limit claim.
Undo and recovery: Revert the code change together, retain all journal and conversation state. Do not remove halt records or uncertain input history to resume work. A halt needs explicit reconciliation and a newly admitted allowance, not automatic revival. The desk must validate native composition before deployment.
Multi-machine posture: The existing conversation ownership fence serializes the host-owned durable conversation state. The independent watchdog is deliberately machine-local and can close only its exact verified local session identity under the shared driver journal lock. Replies still pass the existing ownership and replication admission. No peer, private queue, alternate sender or new store is introduced.
Layer below: Read the constitution in full, D18 sections 6/10/14 and NF-59, D15 section 5 and D16 section 8; inspected session journal lock/fsync, exact identity observation, admission close, lease release, retained uncertain input and the journal's signed durable send path. Older design grant inventories are intent, not a reason to replace the landed owner with a new service.
Bug class: integration
Bug evidence: reproducer=tests/assembly/production-conversation-session.test.ts
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains sample hooks only.
Convergence: none
Prompt review: No model prompt or semantic parser changed. Exact infrastructure deadline/spend evidence is kept separate from worker/model text. Recorded worker rows and summary, Jev, review and delivered-reply shapes are replayed as data under an injected deadline; available bytes never substitute for a correlated completion. The existing normal answer parser remains unchanged.
Decision: runaway-existing-owner | Extend the existing conversation state, independent watchdog and journal notice operation rather than introduce another watcher, store or model judgment. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/runaway-stop-1016-PROGRESS.md
Decision: runaway-cause-before-close | Persist the exact infrastructure limit before closing resources and retain uncertainty if closure fails; never synthesize operator stop or completion. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/runaway-stop-1016-PROGRESS.md
Decision: runaway-one-result | Carry the safety cause through the existing uncertain reply record and signed notice with the original operation identity. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/runaway-stop-1016-PROGRESS.md


Publication: Refreshed the existing preview owner-reference hash for the changed journal conversation test and the grounding inventory hashes for contracts/harness, with the inventory checker digest. Used the desk-provided rehash/repin scripts without changing populations or declarations. Native macOS self-host conformance is intentionally left for the desk's actual contract run. Register publication is regenerated from the committed source.
Prompt finding: 4106b49fff07 | protocol-literal | Unchanged no-tools briefing sentence from the base: the tool-aware renderer removes this exact instruction when tools are active. The test checks that rendering boundary; it does not introduce a phrase-based semantic verdict.
Prompt finding: e8708c7fea24 | protocol-literal | Unchanged recall/sourceLabel evidence instruction from the base. The fixture checks that source-attribution guidance is delivered; this change adds no model decision keyed to those words.
Prompt finding: 849db3a6296a | protocol-literal | Unchanged fixed rendering for an empty saved-memory list and its exact history classification. It is a deterministic store-empty result, not a semantic gate or a fixture-derived answer to arbitrary input.

simplestRobustRoute: This is the simplest robust route: additive cause fields in existing owned state, reuse of the driver's journal lock and the existing close and signed reply paths. The cause fields prevent a dead worker from erasing why work stopped and a restart from silently reopening the same exhausted work. The shared lock prevents turn renewal racing the independent deadline. No new service, store, timer or model call. Exact authority and identity guard entry, retained uncertain work and resource cleanup guard exit, and the installed time/call ceilings remain the limits. Tests establish offline behavior; no unattended shipped-path or live deployment claim is made.
80/20: Test-first positive outcome and negative neighbours, direct-consumer tests, recorded-shape replay, typecheck, architecture, register and pinned READY checks. The Studio desk owns native/full-suite/live proof.
VERDICT: author submission; independent desk review remains separate
