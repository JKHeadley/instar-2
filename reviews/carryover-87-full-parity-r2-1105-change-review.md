# Change review — Carry update restart policy into the admitted runner

Subject base: 3209ca956a5ab9f7df729aa1b47583cbec2d3f43
Review state: open
Reviewed content: none
Outcome: Preserve the earlier installer fixes and port the 1.x update policy, gate, dampener, handshake, template inventory and read-side LiveConfig. The admitted runner owns ticking/idle drain and the existing host watchdog owns replacement launches and failure recovery. This is preserved partial work, not a full row-87 parity or live activation claim.
Affected rules: 4/66/95 (closed update checkpoints); 7/32/113 (existing local transaction/lock); 26/42 (actual running version and successful poll); 34/70 (real installed CLI and admitted-process tests plus policy tests); 39 (runtime pull state); 44/45 (existing roots and actual settings consumers); 49/69 (source adaptation table); 52/87/89 (local observations, no direct sends); 55/60/61 (shared crash primitive, durable three-failure breaker, watchdog bounds, cooldown/coalescing); 74/102 (this record); 78/84 (inventory and capability); 101 (no bypass); 116 (existing transaction, runner, watchdog and admission).
Affected floors: secrets — no credential logging or authority changes; spend cap — no model call or cap mutation; stop — controller and runner recheck latches/ownership/expiry; no duplicate sends — no new send path, no journal replay; durable intake — ordinary runner drains work and reopens its journal, never restores it from an update backup.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Shipped restart and runtime-settings behavior changes, without model prompts, parsers or judgment changes.
Side effects: The runner's first healthy poll starts automatic release checks. The existing watchdog can select a validated installed release; all admission checks run again. Failed candidate boot preserves handshake evidence and selects the prior runner. Durable update-state receives observations, SHA findings and a failure brake. Host-wide inventory reads known template locations but never writes another root. Live settings cannot change admission, caps or authority. Generated inventory is replayed with shape-only authority and is not runtime approval.
Undo and recovery: Revert source to the subject base to retain only the earlier installer fixes. Preserve update-state and failed staging for diagnosis. Never restore a root backup over live journal or authority. Automatic failure pause is durable; explicit resume must be bound to its observed pause. Independent candidate admission can refuse a replacement without widening authority.
Multi-machine posture: Update transaction, installed versions, crash state and template findings are machine-local. A host scan observes other deployment files read-only. Conversation ownership and shared admission remain the runner's existing fences.
Layer below: Read full constitution/current main differences, prior report, 1.x AutoUpdater/Gate/Dampener/Handshake/LiveConfig/drift source, original gate and policy test shapes, existing installer, runner and host-watch composition. Avoided a second supervisor by adapting the existing host-watch launch port. Remaining consumer mapping and unattended replacement evidence are explicitly incomplete in docs/update.md and the report.
Bug class: integration
Bug evidence: reproducer=tests/preview/update-runtime.test.ts
Hook bypass: none
Convergence: none
Decision: c87r2-policy | Copy tuned 1.x policy and reuse the existing transaction, runner, crash primitive and host watchdog; no parallel update ledger or supervisor. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-87-full-parity-r2-1105-PROGRESS.md
Decision: c87r2-health | Complete a handshake only from expected running version plus a healthy admitted poll; preserve failure evidence and keep immutable custody/admission independent. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-87-full-parity-r2-1105-PROGRESS.md
Decision: c87r2-drift | Port host enumeration and SHA dedup into the existing transaction; scope shipped history to actual 2.x MCP artifacts and preserve unknown customizations and foreign roots. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-87-full-parity-r2-1105-PROGRESS.md
Decision: c87r2-config | Use read-side LiveConfig for non-authority updater/drift settings; do not claim remaining 1.x consumer parity without its mapping and tests. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-87-full-parity-r2-1105-PROGRESS.md
Decision: c87r2-proof | Separate real runner tick/handshake and installer evidence from injected replacement outcomes; preserve partial work with the exact remaining unit instead of calling it READY. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-87-full-parity-r2-1105-PROGRESS.md

## Closing block

simplestRobustRoute: This uses the existing updater transaction and lock, admitted runner, watchdog and shared crash primitive. The only additional adapters preserve tuned 1.x behavior at their actual 2.x owners. The runner rechecks idle/stop at drain; installed bytes are validated before selection; the replacement independently re-enters custody. The failure breaker and retained handshake prevent repeated failed self-action. No autonomous-completion claim follows from injected launch outcomes; complete replacement evidence remains outstanding.
80/20: Tests cover both sides of restart holds, coalescing, cooldown, stop, installed mismatch, malformed state, durable failure pause, template classification/dedup and settings consumption. Real runner and installed-command checks cover consumers. Remaining full-parity proof is named rather than hidden by passing focused tests.
VERDICT: author submission; independent judgment belongs to the desk
