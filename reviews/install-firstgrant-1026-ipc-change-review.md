# Change review — authenticated setup owner IPC

Subject base: 452f4739edbb3f5d7d0cdca541bd369108b8f029
Review state: open
Reviewed content: none
Outcome: Mount the existing receiver behind mutually authenticated bounded Unix TLS and supply the installer client. Prove the boundary under launchd using existing isolated identities.
Affected rules: 1, 4, 5, 26, 28, 29, 34, 35, 38, 42, 49, 55, 60, 74, 95, 98, 100, 101, 102, 111, 113, 116
Affected floors: Secrets and TLS keys remain outside worker access. No spend cap is widened. Stop, no duplicate sends and durable intake remain with unchanged owners; an authenticated connection grants none of these effects. Missing preparation evidence refuses execution.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: New authenticated host boundary with protected credentials and actual separate-identity platform evidence; no ordinary-install activation or genesis authority.
Side effects: Exact pins and strict path/ACL checks can hold misconfigured installations. Four connections and absolute lifetimes bound unauthenticated traffic. Credentials are read only from protected configuration, never requests. The independently administered host still verifies distribution, privileges and custody. A certificate authenticates a service, not a human act or grant.
Undo and recovery: Close the mounted listener and revert its host composition. Do not unlink an occupied startup socket or retry uncertain owner effects. Existing owner and supervisor records survive; no new authority or recovery store is created.
Multi-machine posture: Machine-local transport. Every host authenticates its own installed services; Two's authority/history and P-08 replication remain unchanged. A local socket is never independent recovery.
Layer below: Inspected existing setupOwnerReceiver, setupPreparationOwners, custodyPlatform, distribution verification, Darwin ACL behavior, Node TLS and the launchd service under the existing three identities. Same-CA different certificates fail exact pin checks. The broker's complete owner implementation is absent, so the platform proof observes actual path/process checks and refuses missing preparation rather than asserting custody or GP.
Bug class: integration
Bug evidence: reproducer=tests/platform/setup-owner-ipc.test.ts
Hook bypass: none
Convergence: none
Decision: firstgrant-1026-ipc-D1 | Use mutual TLS with exact installed pins rather than inventing a challenge protocol or native peer helper; transport creates no approval. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/install-firstgrant-1025-PROGRESS.md
Decision: firstgrant-1026-ipc-D2 | Enforce protected paths, distinct identities, finite byte/connection/lifetime bounds and exact peer identity before dispatch. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/install-firstgrant-1025-PROGRESS.md
Decision: firstgrant-1026-ipc-D3 | Stop at the authenticated IPC review seam with honest launchd evidence; retain explicit custody/recovery and enrollment integration obligations. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/install-firstgrant-1025-PROGRESS.md
Skip: tests/platform/setup-owner-ipc.test.ts:16 | scope=Same-user protocol tests require a non-root broker UID; the separate administrator platform test covers the root installer with a non-root service.
Skip: tests/platform/setup-owner-ipc.test.ts:124 | scope=The real launchd proof requires macOS and explicit INSTAR_SETUP_IPC_PLATFORM=1; it was run successfully on this Studio with that flag.
Validation: Targeted TLS and existing receiver/transport/owner bridge tests, including actual launchd/kernel denials under the three existing identities. Final gate outputs and complete failed-then-passed findings are retained in the progress record. No complete installation, real login or model qualification is claimed.

## ELI16

The setup process can now reach the installed receiver through an encrypted connection that checks both services' identities. A stranger, another certificate or changed credential protection cannot reach the owner. Successful connection still cannot invent the permission needed to create keys.

## UX Impact

Connection failures give one plain installer repair step. No human approval flow changes. The mounted component remains behind its owner's real preparation, supervision and stop checks.

## Closing block

simplestRobustRoute: Reuse the closed receiver and Node TLS, with exact installed pins and existing platform lifecycle. This is the simplest robust route: it prevents a worker or replacement endpoint from impersonating the independently installed service without a custom crypto protocol, new authority store or OS-specific native authentication helper. Protected credentials and distinct identities are start guards; authenticated bounded input is the dispatch guard; existing durable owner reconciliation remains the end guard. No unattended ordinary-install completion is claimed.
80/20: The bounded IPC boundary and separate-identity receiving proof form a coherent review seam. The documented actual custody/recovery and authority composition remain assigned integration work, not fixture successes.
VERDICT: authenticated IPC component implemented; custody and ordinary-install acceptance incomplete
