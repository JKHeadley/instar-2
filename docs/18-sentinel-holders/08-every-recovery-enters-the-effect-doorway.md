## 8. Every recovery enters the effect doorway

**Rule — holders request effects; they never perform them.** Rules 29, 41, 42, 55, 58, 60, 61,
63, 74, 86 and 95; **checks: P14-NF-32/36/40/42–47**. A recovery is a part-five run step under a
part-six lease and loop policy. Semantic selection, when needed, is a part-seven judgment. The
selected registered `OperationDefinition` receives an `EffectRequest` through part eight. Validation
re-resolves subject, standing, owner, scope, generation, fence, budgets, conflicting facts and
current need. The adapter returns typed occurrence evidence. Part eight settles application,
quiescence and charge separately. Part nine then assesses whether the recovery restored the named
outcome. No holder imports process, messaging, scheduler, filesystem, git or harness mutation APIs.

The landed effect contract currently requires `EffectRequest.message: string`, and its
`OperationAdapterPort.invoke` accepts only an `OutboundMessage` whose sole purpose is
`ordinary-reply`. It therefore cannot express process kill/spawn/close/compaction, scheduler pause,
account swap, configuration change, filesystem/git mutation, or infrastructure action/result
notice as typed effects. These classes must not be encoded as message text. Part fourteen depends
explicitly on the additive Part Eight typed-payload seam requested in
`.instar/lanes/design-sentinel-holders-seam-request-effect-doorway.md`, request
`P14-P8-typed-recovery-effects-v2`, and the corresponding Part Ten drivers in request
`P14-P10-holder-bindings-and-drivers-v2`. The Part Eight seam is GRANTED but not landed;
P14-NF-42/45/46/51–53 are **non-executable until `seam-response-effects-payloads.md` lands**.
The matching Part Ten driver request is GRANTED in `seam-response-assembly-followup.md`, ledger #9,
but is not landed. P14-NF-42/45/46/49–53 therefore also cannot execute their production-driver
positive neighbors until that grant lands. All affected
effect-capable bindings remain inhibited. An instance is `dry-run` only if section 3's complete
enrollment, intended inhibition and fresh passing observation requirements are independently met;
otherwise it is `diverged`. Only effects already representable by the landed doorway may execute.
The sole existing path used here is an ordinary agent text reply: decode the current
`OutboundMessage`, prepare/adopt the `EffectRequest`, invoke its registered message adapter, obtain
the required Part Nine assessment and let Part Eight settle it. Infrastructure notices and every
recovery mutation remain blocked rather than masquerading as that reply.

Worker input is a separate missing class, not process control or an ordinary reply. The paired
Part Eight payload and Part Ten driver request is
`.instar/lanes/design-sentinel-holders-seam-request-worker-input.md`, request
`P14-P8-P10-typed-worker-input-v1`. It is GRANTED in `seam-response-effects-followup.md` and
`seam-response-assembly-followup.md`, ledger #21. P14-NF-33/56/57 and their P14-NF-49/50
wiring/lifecycle neighbors are **non-executable until both grant files land**.

**Rule — uncertainty never becomes a fresh attempt.** Rules 24, 26, 42, 46, 55, 58, 61 and 107;
**checks: P14-NF-44–47**. After a crash or lost receipt, recovery reconstructs the original logical
effect identity and queries the exact adapter journal. Automatic retry requires independent evidence
that the prior effect did not happen, cannot still happen, and cannot still charge. Otherwise the
effect stays uncertain and its maximum exposure remains visible. A new worker, absent process,
expired timer, missing local log or repeated request is not non-occurrence evidence.

**Rule — destructive local guards remain defense in depth.** Rules 26, 42, 49, 60, 66, 69 and 74;
**checks: P14-NF-03/04/42/45/51–53**. A process kill, file removal, configuration change or git mutation
must first survive the core effect contract and then its adapter's target guard. The 1.x
`SourceTreeGuard`, `SafeGitExecutor` and `SafeFsExecutor` establish only a partial precedent.
`SourceTreeGuard` resolves a nearest existing ancestor and refuses when canonical identity is
unavailable. `SafeFsExecutor` then permits a directory-wide carve-out for paths below `.instar/`;
that is not an exact operation-and-target exception. The 1.x audit row records one target and a
caller stack frame. It does not separately retain the requested target, resolved target and a
verified principal. Audit writing can be disabled and audit failures are fail-soft. Its atomic
write helper replaces one file through a same-directory temporary file, file synchronization and
rename. Neither wrapper supplies a general transaction across filesystem objects or across a git
operation's ref, index and working-tree changes.

The requested Part Ten drivers must add the stronger requirement. They canonicalize both requested
and resolved identities, refuse protected targets on uncertainty, limit an exception to one exact
operation and canonical target, authenticate the principal, and durably audit the request,
resolution, decision and result before reporting settlement. The 1.x wrappers remain defense in
depth, not alternate 2.0 doorways and not evidence that these new guarantees already exist. A local
guard's refusal remains a refusal through settlement.

Each mutation declares its atomic scope and crash result:

| Operation | Atomic scope and permitted claim after a hostile cut |
|---|---|
| Configuration replacement | One exact file may claim old-or-new bytes only when the driver uses a same-filesystem temporary file, synchronizes file and parent-directory state, performs one atomic replace supported by that platform and verifies the resulting digest. Otherwise it reports `uncertain`. |
| Filesystem create or replace | One exact directory entry may make the same old-or-new claim only under the configuration-replacement conditions. A same-filesystem move may claim one atomic name transition only when the platform contract proves it. Recursive removal, cross-filesystem move and multi-target change are multi-object operations and cannot claim atomicity. |
| Git ref update | One compare-and-swap ref update may claim old-or-new for that ref only. Index and working-tree mutations, checkout, merge, reset and multi-ref changes are multi-object operations and cannot inherit the ref claim. |
| Any multi-object mutation | The driver records a durable intent and per-object observations, preserves the original effect identity and maximum exposure, and returns partial or `uncertain` after a cut. Reconciliation inventories actual state before any repair. It never blindly retries. Completion needs an owner-approved transaction adapter that names its commit/rollback protocol, or a later separately admitted compensating operation. |

Part Ten P10-NF-28/29/33 applies to canonical-store persistence, not arbitrary physical mutation
atomicity. The typed filesystem/configuration/git drivers additionally face the operation-specific
Part Fourteen cut in P14-NF-53. Their transaction mechanism is an explicit dependency of the updated
Part Eight and Part Ten seam requests.

---
