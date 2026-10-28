# Change review — bounded tool-turn copy candidate

Subject base: f2798733d43ee4460aac33c40e2f9364a0e52d04
Review state: open
Reviewed content: none
Outcome: allow longer tool work on an isolated candidate for desk scoring.
Affected rules: 1, 30, 36, 42, 49, 55, 57, 58, 60, 74, 101, 103, 111, 113, 115, 116.
Affected floors: secrets, spend cap, stop, durable intake, no duplicate sends and output review retain their existing enforcement.
Operator questions: none for building this authorized copy. Its changed policy requires fresh covering authority before activation; an old class or guidance-only pin does not authorize the increase.
Suggested tier: critical
Declared tier: critical
Tier rationale: resource-policy and native composition certification change; existing safety floors remain enforced.
Bug class: none
Bug evidence: candidate capacity increase, verified through targeted boundaries and recorded replays; not a live incident repair.
Multi-machine posture: no new state; each owning runner uses the shared finite policy. Ownership, replication demands and journal authority are unchanged.

simplestRobustRoute: raise the existing three constants and prove the existing boundaries. No new loop, scheduler, grant class, timeout mechanism or override is introduced. The outer journal reserves the entire liability before dispatch, the hook admits tools, and the existing model/output checks handle termination. This is a candidate submission, not an autonomous-completion or live-release claim.

| Bound | Before | Candidate |
|---|---:|---:|
| Claude/Codex parent model calls / native model steps | 8 | 16 |
| Claude/native shared tool calls, including Claude children | 32 | 64 |
| CLI whole-turn timeout, ms | 300000 | 600000 |
| CLI aggregate output-token allowance | 16384 | 32768 |
| Parent plus maximum child model-call reservation, including base call | 16 | 24 |

Codex parent calls and timeout also move 8 -> 16 and 300000 -> 600000 ms, preserving the existing equality contract with the shared reservation; its hook call allowance remains derived from parent calls (8 -> 16). Codex hook timeout likewise follows its turn timeout (300 -> 600 seconds). Native inherits steps/calls; its single-model-call timeout stays 120000 ms, maximum calls per step stays 8, Bash timeout stays 120000 ms, and result clipping stays 4096 characters. There is no new claim of a ten-minute aggregate native deadline. The CLI dollar backstop stays $0.75 ($1 ceiling less $0.25 one-turn margin), children stay 2 × 4 turns, and answer byte bounds stay unchanged. Thus independent bounds can terminate work before the larger turn/call allowance is used.

Layer below: inspected `subscriptionToolsPolicy`, `subscriptionNativePolicy`, provider dispatch bounds, `toolTurnFits`, `toolChildrenFit`, `runToolTurn`, native-loop admission and final-step handling, and the immutable historical `FULL_TOOLS_CEILINGS`. The outer journal genesis defaults remain 16 model calls, 16 replies and 20 inbound turns. With a larger per-answer reservation that tiny default can exhaust immediately or fall back without tools; the desk's copy needs sufficient explicitly granted journal allowance. The change does not raise it automatically. Existing CLI/native shared reservation accounting is retained.

1.x comparison: read the local 1.x `src/core/frameworkSessionLaunch.ts` interactive and headless Claude builders, which add no model-turn or tool-call ceiling, and `src/core/SessionManager.ts`, whose default session-duration safety net is 240 minutes. This is source evidence of a much wider session path, not a measured task-completion equivalence. Doubling the small 2.0 bounds is a finite initial candidate; it does not port 1.x permission bypasses or claim full parity.

Side effects: more parent capacity increases reserved model calls and CLI token liability and can reduce child allowance near an outer cap. The dollar backstop, context/answer byte bounds, host resource limits and downstream review can still bind first. Policy digests and guidance-only pins change. Historical full-tools class grants refuse the candidate; fresh exact-policy authority admits it in offline fixtures. Installed-login and launcher tests use synthetic authority only; no live account or launcher is changed.

Verification: targeted provider dispatch, executable CLI hook and native-loop boundary tests; whole-liability journal reservation tests; offline recorded CLI/native tool replay, stop and real-output replay. Native completion on step 16 succeeds; another tool request there refuses without dispatch. Calls 33 and 64 admit; call 65 refuses. CLI timeout 600000 admits and 600001 refuses before dispatch. Real captured writer, uncertain, Jev, review, delivered and empty candidate shapes replay on newly reachable model call 9. The shell/owner load tests are excluded on the Studio. Final command outcomes and desk-owned check exceptions are in the absolute lanes PROGRESS record.

Copy measurement before release: desk runs the same real tasks on frozen r3 and this exact candidate with the same model/settings and sufficient explicit outer allowance, including tasks needing more than 8 model turns or 32 tools, exhaustion at the new limits, operator stop, and interrupted/uncertain sends. Record accepted completion, review outcome, turns, tools, wall time, resource/spend reservation and actual usage, duplicate sends and durable intake. A better constant alone is not release evidence.

Undo and recovery: revert this candidate commit and use the prior covering activation. Do not mutate a running journal or reuse uncertain sends.
Hook bypass: none; core.hooksPath unset, inspected hooks directory contains sample hooks only.
Convergence: none
Deferral: generated/register.json:1 | not-a-deferral=mechanical publication contains existing register descriptions, not new deferred work

## Closing block

simplestRobustRoute: change existing finite constants and renew their measured composition and register; add no runtime mechanism.
80/20: targeted boundary and replay tests plus native contract and mandatory publication gates; desk owns full-suite and copy scoring.
VERDICT: author submission; no independent verdict asserted
