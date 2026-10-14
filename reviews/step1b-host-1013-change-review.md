# Change review — durable continuing host and public worker protocol

Subject base: 4a5a9628dd33ef4a6409ad1f4eccee6bcbc47e33
Review state: open
Reviewed content: none
Outcome: Replace step 1's private worker calls and volatile input tracking with the versioned public five-method port, durable host queue/cursors, fresh process admission, normalized reply/turn-end evidence and bounded continuation under one retained allowance.
Affected rules: Rules 1, 2, 4, 5, 7, 26, 29, 30, 32, 34, 36, 42, 46, 49, 55, 60, 63, 68, 74, 75, 96, 101, 102, 105, 111, 113, 114, 115, 116.
Affected floors: secrets — encrypted host snapshot uses existing custody key outside worker scope; spend cap — parent liability is retained and every model dispatch durably charges it before forwarding; stop — existing independent stop closes dispatch and exact claim/incarnation control retires the worker; no duplicate sends — no new sender and unresolved input is never replayed; durable intake — accepted inputs, outcomes and cursors survive atomic snapshot reopen.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Changes continuing-worker admission, persistence and lifecycle while retaining the opt-in proof-room activation and existing custody/effect boundaries.
Side effects: Snapshot grows with retained inputs under explicit finite limits and backpressure; old processes are retired on host restart, preserving unresolved input as uncertain. Process renewal does not renew money or grant authority. The physical driver still uses bounded synchronous tmux operations; asynchronous public methods do not claim nonblocking physical probes. The current composition no longer has the old macOS certificate, so its declaration is truthfully unproven pending the desk's real gate.
Undo and recovery: Disable the conversation option or revert the code; preserve the encrypted conversation snapshot and all journal/driver records. Do not delete records or reactivate old claims. Interrupted parent reservation is an explicit reconciliation hold; old input effects are never guessed absent. Existing installations get the compiled code and hook copy on launch without overwriting operator data.
Multi-machine posture: Machine-local process evidence and encrypted host snapshot under the existing conversation owner fence. No peer transfer or additional ownership authority is introduced; another machine must not adopt these local handles. The outer journal and configured durability policy retain their current roles.
Layer below: Inspected production-session-driver, production-session-work, physical session IO, journal SessionWorkEdge projection, admission gate, harness-user custody layout and Stop hook. The projection charges every top-level edge, so renewal uses drawsOn and exactly one parent reservation. Transcript counts miss dispatched calls before output, so the checkpoint now requires the host's durable charge before forwarding on this route. The worker identity cannot traverse the runner repository; the hook uses a readable installed copy and scoped inbox.
Bug class: durability
Bug evidence: reproducer=tests/assembly/production-conversation-session.test.ts; restart=tests/assembly/conversation-host-store.test.ts
Hook bypass: none; core.hooksPath was unset and the shared hooks directory contained sample hooks only.
Convergence: none
Prompt review: The answer decoder is retained without phrase-based routing. The host adds its current injected clock and recorded prior outcomes to the existing quoted memory packet at actual delivery. No user text selects a lifecycle branch; identities, recorded state, stop, current authority and finite limits do. Existing recorded answer envelopes remain replayed; the brief explicitly assigns live/replay certification to the desk for this unit.
Decision: step1b-host-1013-port | Version the existing HarnessAdapterPort: retain first-input v1 and require the five-method v2 for continuing workers. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1b-host-1013-PROGRESS.md
Decision: step1b-host-1013-custody | Persist queue, exact duplicate outcomes, replies, cursors and process generations in an encrypted host-owned atomic snapshot; never replay uncertain input. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1b-host-1013-PROGRESS.md
Decision: step1b-host-1013-liability | Reserve one parent liability, persist every model charge before forwarding, and give replacements only the remainder; interrupted reservation stays held. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1b-host-1013-PROGRESS.md
Decision: step1b-host-1013-process | Give every replacement a fresh claim/incarnation and retire only its exact admitted predecessor before continuing from current records. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1b-host-1013-PROGRESS.md
Decision: step1b-host-1013-observe | Require correlated Stop-hook evidence, emit reply and turn-end separately, and persist their outcome with the cursor. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1b-host-1013-PROGRESS.md
Decision: step1b-host-1013-grants | Revalidate changed signed activation and refresh grants by safe-boundary replacement, preserving the original allowance and stopping revoked active work. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1b-host-1013-PROGRESS.md
Decision: step1b-host-1013-certificate | Mark the changed macOS composition unproven rather than falsely transplant its prior certificate; the desk owns the real proof. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1b-host-1013-PROGRESS.md

Decision: step1b-host-1013-parent-lifetime | Renew only process lifetime; every process deadline stays beneath the already admitted parent lifetime, and current time/prior outcomes are delivered from host records. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1b-host-1013-PROGRESS.md

Decision: step1b-host-1013-store-declarations | Declare bounded retained host memory and accumulating machine-local hook copies beside their actual writers, then regenerate source wiring. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1b-host-1013-PROGRESS.md

Decision: step1b-host-1013-grant-withdrawal | Fence a withdrawn grant separately from operator stop, revalidate on the idle tick and bind replacement to changed signed bytes; never turn routine renewal into permanent host closure. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1b-host-1013-PROGRESS.md

Generated register: regenerated from the committed source head; includes both store declarations and current source wiring. This is shape-only replay evidence, not a new runtime certificate.

simplestRobustRoute: Reuse the admitted physical driver, model/tool checkpoint, journal reservation and host work tick behind the existing versioned port. The added owner snapshot prevents busy-input loss and replay across restart; durable model charges prevent replenishing in-flight exposure; exact process generations prevent reusing dead identity. No second scheduler, sender, grant store or provider loop is added. Start guards remain current ownership, signed activation, resource admission and durable parent liability; end guards require correlated reply/turn end; stop/spend/custody limits remain mandatory. No unattended live completion is claimed.
80/20: Target fake-worker lifecycle, physical-driver receipts, durable store reopen and real local admission forwarding, then direct importers and static gates. The desk's real copy walk and macOS certificate remain the acceptance boundary specified by the brief.
VERDICT: author submission for the desk gate; no independent convergence or live production readiness claim
