# Change review — Operator standing trust setup

Subject base: 9d8089a6db175d9ed72ae30a7f8347b158301ffe
Review state: open
Reviewed content: none
Outcome: Record operator-selected standing grants once, configure vault-backed MCP servers, and provide narrowing and revocation through the existing effect doorway.
Affected rules: 1, 4, 26, 34, 36, 44, 49, 74, 84, 95, 100, 101, 102, 104, 113, 116
Affected floors: secrets — MCP env uses vault references and existing egress custody checks; spend cap — finite per-effect grant level with aggregate runner limits unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none; the per-installation targets, dollar ceiling and MCP servers remain explicit operator setup choices
Suggested tier: critical
Declared tier: critical
Tier rationale: Effect admission and the model briefing change; both sides of scope, resource and irreversible decisions are tested.
Side effects: A declared undoable effect can run under its existing grant without another authorization request. Exact network request scopes prevent an owned draft route from admitting other paths or verbs on the host. Unknown MCP tools and network writes retain irreversible defaults. Provider briefing bytes change the invocation digest and require desk activation/conformance refresh.
Undo and recovery: Revoke through setup-standing-trust and restart for MCP changes. Revert this commit and restore the previous activation to undo the implementation. No uncertain sends are retried. An interrupted replacement leaves a visible .trust-next file rather than silently accepting uncertain contents.
Multi-machine posture: Installation-local operator policy and MCP configuration, deliberately; each machine's custodian configures its vault references. No new operations join the single-machine closed set and no replication floor changes.
Layer below: decodeEffectPolicy/classifyEffect/admitEffect, admitEgress method override handling, readRootMcp credential references, runner effect-policy reload, and both provider tool briefings.
Bug class: integration
Bug evidence: reproducer=tests/preview/trust-setup.test.ts
Hook bypass: none
Convergence: none
Decision: trust-reuse | Reuse operator effect registrations and grants rather than inventing a trust engine; unregistered writes stay irreversible. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-trust-default-PROGRESS.md
Decision: trust-request-scope | Bind reversible network writes to exact method and path because a host-wide registration also admits unrelated sends. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-trust-default-PROGRESS.md
Decision: trust-tighten | Preserve existing classifications while removing grants or lowering ceilings so revocation cannot restore a permissive default. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-trust-default-PROGRESS.md

## Closing block

simplestRobustRoute: This is the simplest robust route: an operator setup entry point writes the existing two configuration files; the existing doorway, vault and turn reload hold the floors. The only new admission field is exact method/path scope, needed because a host-only registration cannot distinguish a draft edit from a send on the same service. Setup refuses conflicting existing state; tightening cannot widen grants; revoke removes setup trust. The unattended CLI test reads the resulting files through the real consumers. Live Darwin conformance and operator surface verification are desk work, not claimed here.
80/20: Reuse existing readers and admission rather than building a second policy store or authority path.
VERDICT: author submission only; no independent convergence or live readiness claimed
