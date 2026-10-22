# Change review — Preserve the installed wakeup checkpoint

Subject base: 35ac5650e5af900866979ea04416da25e3aae664
Review state: open
Reviewed content: none
Outcome: New ScheduleWakeup calls reach an installed host checkpoint; exact boolean stop cancellation remains bookkeeping and routes without enforcement retain their refusal.
Affected rules: 1, 4, 8, 34, 36, 41, 42, 49, 60, 68, 70, 74, 101, 102, 103, 111, 113, 116
Affected floors: secrets — existing held-secret checkpoint unchanged; spend cap — existing claim allowance and durable reservation unchanged; stop — existing stop/closed-claim enforcement and per-step cap retained; no duplicate sends — existing effect identity/preparation and recorded restart replay retained; durable intake — existing journal and effect preparation unchanged
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Restores an existing effect route without adding a scheduler or changing authority; tests exercise both routing and actual checkpoint refusal.
Side effects: Gated new wakes now receive the effect owner's decision rather than an unconditional budget refusal. A gate result is not permission to run; the hook must ask the owner. Ungated wake guidance and exact stop input normalization remain unchanged.
Undo and recovery: Revert this repair and its tests together; no schema or stored-state migration. Reverting reinstates the reviewed capability restriction.
Multi-machine posture: No new state or placement path. The installed host checkpoint remains responsible for its claim and existing ownership, authority, resource and durable effect records. Cancellation stays local to its harness session.
Layer below: Inspected admitToolCall's shared effect route, createAdmissionGate and createToolEffectOwner. The checkpoint checks closed claims/stop, held secrets, authorization, stable identity and durable preparation; model calls consume the claim allowance and durable reservation before dispatch. The hook consumes gate decisions before execution.
Bug class: integration
Bug evidence: reproducer=tests/preview/admission-gate.test.ts
Hook bypass: none; core.hooksPath unset and common hooks directory contains samples only
Convergence: none
Decision: sched-tool-checkpoint-authority | Preserve the existing effect route when config.gate is a string; retain the ungated budget refusal and exact stop exception, because the owner can enforce the floors without removing ability. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sched-tool-1022-repair-160336-PROGRESS.md
Prompt review: No prompt or refusal wording changes. The repair changes when the existing refusal is used. Recorded train-133 and historical writer, summary uncertainty, Jev undecided/unsure, reply-review and empty reply shapes replay through the existing regression suite; those are historical transport evidence, not a fresh live wake execution.

1.x reuse: Retains the built-in harness tool and host-owned scheduling/effect separation already inspected in the parent unit's toolAccess.ts, SessionManager.ts and JobScheduler.ts review. No transplanted scheduler or new reviewer.
Verification: Targeted tool-admission, admission-gate and sched-tool-replay tests: 32 passed. The new gated neighbor reaches the checkpoint, which refuses absent authority and a closed claim. Both stop forms, ungated wake refusal and call cap are covered. Remaining final gates are recorded in the progress report.

## Closing block

simplestRobustRoute: Send non-stop wakes through the already-installed effect checkpoint and keep the exact cancellation exception. This is that route: one conditional, no new machinery. Existing start authorization, end-state effect records, stop, call allowance and duplicate fences remain authoritative. No new unattended live-wake completion is claimed.
80/20: Repairs the one must-fix at its source, with routing neighbors and a real checkpoint refusal; existing captured-shape/restart evidence verifies retained behavior.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
