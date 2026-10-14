## 10. Reuse, implementation boundaries and simplification

**Value — reuse working mechanisms in small pieces.** The code inventory distinguishes a
usable building block from evidence that the whole conversation runs through it. Commit-pinned
inspection evidence belongs in the change review and changelog; implementation status must be
rechecked at the build's head.

| Existing surface | What serves the contract | Required disposition |
|---|---|---|
| `src/harness-adapters/adapter.ts`, `admission.ts`, `holder.ts`, `records.ts` | Exact handle custody, attempt deduplication, correlated output ranges, progress and refusal preservation. | Route later inputs through their own context record; stop comparing all input to the launch's original input. Extend the existing package, not another wrapper with its own truth. Update the README when wiring the holder lifecycle it currently calls absent. |
| `src/assembly/contracts.ts`, `context-delivery.ts`, `harness.ts` | Public launch/observation contract and an existing immutable `ContextDeliverySpecification` with a production delivery arm. | Make that arm the common path for first and later inputs; add typed reply/turn/cursor/control behavior. The legacy first-input arm is not conversation conformance. Preserve producer provenance and current-authority checks. |
| `src/assembly/production-session-driver.ts` | Exact tmux target syntax, durable launch reservations and delivery journal, caps/deadlines, resume-or-rebuild behavior, lifecycle inbox. | Move vendor parsing/flags and process behavior behind their adapters. Replace pane-derived authoritative completion with correlated terminal evidence. Adapter-local recovery and stop become public operations; normalize busy/refused/uncertain results. |
| `src/assembly/production-conversation-session.ts` on the conversation build branch | Reuses one admitted worker across inputs, reserves the whole conversation allowance, reads per-input result output and closes admission/resources. | Retain its common orchestration and budgeting. Durable queue/dedup/cursors belong to owner records, not its in-memory sets. Consume reply and turn-end observations through the public port instead of a second driver/result-file contract. Every actual respawn needs a new incarnation. |
| `tests/preview/native-loop.mjs` and its tool worker | Multi-step model/tool loop, admission and bounded tool execution. | Ship loop and host bindings in the product behind the native adapter. The extracted `src/harness-adapters/native-loop.ts` is a reusable loop, not by itself a continuing-session adapter or self-hosting proof. |
| `production-provider.ts` and preview tool admission | Existing model routing, reservations and tool-call admission. | Keep provider choice separate from harness choice. Move live consumers to the public owners, including connected-account bindings and all auxiliary model usage. No direct provider/tool path survives in the conversation host. |

**Rule — preserve incident-earned behavior, not whole legacy managers.** Rules 26/42/46/55/59/63/68;
checks P13-NF-15/19/24/29/35/36/38/40/46/51/52. The inspected 1.x mechanisms supply these
regression requirements; none is credited as a 2.0 live pass:

| Behavior and source | Named failure the contract prevents |
|---|---|
| `PendingInjectStore` boot recovery | Accepted input lost in a process-local map; unreadable directory misreported as an empty queue. Use owner intake custody and explicit unknown. |
| `CompactionSentinel` deduplication and bounded recovery | Three recovery triggers race each other or a zombie killer. Use one recovery episode and exact-worker evidence, not growth of the newest account-wide rollout. |
| Asynchronous `SessionWatchdog` probes | A slow probe freezes the server or timeout becomes death. Use bounded asynchronous probes and tri-state evidence. |
| Protected external waits and pipeline consumers | Quiet healthy work is killed while its producer or check still runs. Use actual operation/child evidence and finite wait horizons. |
| `PermissionPromptAutoResolver` | Remote work hangs on an already-authorized prompt, or clearing it widens all future permissions. Bind allow-once to the exact call/menu/incarnation; unknown menus remain visible. |
| `HelperWatchdog` | Background work survives an idle parent invisibly. Use registered child scope, budget, result and cancellation. |
| `SubscriptionPool`, quota windows and swap brakes | Unknown quota becomes zero, another account's window is borrowed, or repeated swaps kill busy work. Preserve subject/freshness/unknown and enforce bounded placement changes. |
| `SessionRecovery` and context-wedge handling | Poisoned transcript is resumed forever, or a failed/empty capture is called compaction success. Require real clearance or an admitted fresh rebuild. |
| tmux literal target and process identity | A syntactically successful call affects the wrong pane or a reused PID. Bind the exact `=session:` target and current start identity inside the adapter. |

**Value — remove machinery with no necessary consumer.** Four is not a constitutional limit
on method count: a typed, admitted `control` avoids private stop/recovery APIs. The contract needs
no new queue store, second session engine, adapter-specific model router or separate “conversation
turn” authority. Resume is an optimization over durable grounding, not a required vendor feature.
Do not require one fresh process per message, an empty connector list, or a universal “do not
reply” scheduled-work prompt: none has a constitutional source and each defeats the role.

The activation contract is the observable floors and paired tests below, not a chain of dated
seam letters whose absence forever labels an entire family unavailable. Missing owner behavior
is recorded against the responsible build unit, with an executable acceptance condition. Preserve
actual owner admission, durable cause, context evidence, isolation, stop and metering; eliminating
historical paperwork does not make an unbuilt floor hold. No new simplicity service or gate is
needed; Rule 116 is judged in the existing independent review.
