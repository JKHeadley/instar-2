# Change review — Keep harness loop bookkeeping out of unrelated answers

Subject base: 4a2635bc2064d5eaec5e451360634eeabecaad9d
Review state: open
Reviewed content: none
Outcome: A Claude ScheduleWakeup stop-only call cancels its own session loop without manufacturing an approval blocker. New harness wakes stay refused with the existing durable scheduling route. A local revision timeout preserves earlier model-route evidence.
Affected rules: 1, 2, 4, 8, 21, 23, 26, 30, 34, 35, 36, 41, 42, 49, 56, 60, 62, 68, 70, 74, 83, 93, 101, 103, 111, 113, 116
Affected floors: secrets — existing hook and outbound checks; spend cap — no new wake or model reservation; stop — exact boolean cancellation only, existing stop latch unchanged; no duplicate sends — existing journal fence and restart test; durable intake — original messages and tool trace retained
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: Small adapter classification and observation fix with recorded regression, real executable hook, journal replay and isolated Claude surface proof.
Side effects: ScheduleWakeup stop no longer enters the consequential-effect doorway. New wakes cannot bypass host lifecycle/reservations even with an effect grant. Other effect refusals retain their notices. Local timeouts no longer overwrite a working map with unavailable; evidence still expires normally. Reported model mismatch remains changed, never verified by alias assumption. Physical doorway ids replace the logical preview-subscription label in the map only; old entries retire, journal route names stay compatible.
Undo and recovery: Revert the implementation and matching tests together. No durable schema changes. Historical refusals and sent replies remain unchanged; old doorway entries retire through existing installation reconciliation.
Multi-machine posture: Session cancellation is local to its harness process; future work stays with the existing durable promise owner. Each root observes its own selected doorway. No new state, scheduler, replication or ownership path.
Layer below: Pinned Claude Code 2.1.280 ScheduleWakeup returns its session cancellation before scheduling; the executable hook normalizes input and durably records admission. Journal effect notices were appending the recorded refusal to a completed weather answer. The resource owner imposed the short revision timeout; successful provider frames report different model ids, which remain visible.
Bug class: integration
Bug evidence: reproducer=tests/preview/sched-tool-replay.test.ts
Hook bypass: none; core.hooksPath unset and common hooks directory inspected (samples only)
Convergence: none
Decision: sched-tool-host-lifecycle | Reuse harness stop-only bookkeeping and the existing durable promises/dated path for future work; no second scheduler or unsupported future model spend. Local timeout is no provider availability verdict. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sched-tool-1022-PROGRESS.md
Prompt review: Only the wake refusal reason changes model-facing guidance. It identifies the actual lifecycle/spend limit and existing response protocol, never instructs a reviewer to pass. No reply judgment rules or parsers change. Actual writer, Jev/summary uncertainty, review and delivered/empty bodies are replayed; a separate Claude room proves delivery.

1.x reuse: anthropic-headless/capability/toolAccess.ts and SessionManager tool policy prefer harness tools; scheduler/JobScheduler.ts separately owns durable timed work with capacity, quota and ownership checks. Use that separation through existing 2.0 mechanisms, not a scheduler transplant. Reuse codex-doorway-1022's selected-adapter map wiring; its source commit is not an ancestor of this base, and the already-present exchange parser alone did not correct local timeout handling.

Verification: Recorded train-133 update 367053122 gave three failing tests before repair. Targeted hook/map tests pass; architecture and typecheck pass. Expanded replay verifies the exact weather body through send and restart. Final source-targeted checks passed 90 tests in seven files, then 71 direct-consumer tests in nine files. Register outputs were regenerated from final documented source 85013dc2eafea4d945c02f2ccc9a28268915983a with the existing replay generator; authority remains shape-only and prerequisites unchanged. The first pinned gate passed all 120 tests in eight files. Final pushed-head gates and live proof results are recorded in the absolute PROGRESS report.

## Closing block

simplestRobustRoute: Classify the existing built-in operation by its exact stop input; refuse unreserved new wakes with the existing host scheduling path. Preserve the last real exchange when the host cancels a call. This is the simplest route: no scheduler bridge, new model judgment, special reply-review exemption or timer. Existing start authority, per-call budget, durable trace, stop and send fences remain. Unattended proof evidence is recorded before READY in the progress report.
80/20: The captured tool input, forced notice and local timeout identify the causes. Positive/negative neighbors exercise cancellation versus scheduling, local cancellation versus provider failure, freshness expiry, model mismatch and send replay.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
