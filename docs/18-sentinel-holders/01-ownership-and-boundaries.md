## 1. Ownership and boundaries

**Rule — part fourteen defines no new core type.** Rules 1, 30, 45, 49, 69, 90 and 113;
**checks: P14-NF-01–04**. This is an adapter, holder and package design over the landed core. A
holder package means the current Part Ten `LocalCapabilityPackage`, its exact `declarationIds`,
the referenced `VerificationPlan` instances and their executable bindings. It is not a register
kind or a new persisted core schema. Earlier parts own every consumed type.

| Earlier part | Types and authority consumed here |
|---|---|
| One — constitutional types | typed identity, evidence, freshness, standing, refusal, conflict, measurement and disposition primitives |
| Two — durable facts | append-only facts, signed history, source vectors, capture references, projections and conflict-preserving replay |
| Three — register | declarations, holder entries, `holds`/`freshnessProbe`/`scope`/`authority` facts, rule graph, check-run records and honesty classes |
| Four — intake | authenticated intake, principal and conversation binding, authorization classification and preserved refusal |
| Five — run graph | durable runs, steps, transitions, budgets, exit tests, progress, worker grounding, continuation and delegation edges |
| Six — execution | leases, fences, admission reservations, `LoopPolicy`, `LoopRecord`, `RecoveryRecord` and bounded recovery ownership |
| Seven — judgment doorway | `JudgmentRequest`, attempts, resolutions, declared floors, model provenance and benchmark definitions |
| Eight — effect doorway | `OperationDefinition`, `EffectRequest`, validation, observation, settlement, `OutboundMessage` and adapter ports |
| Nine — verification holders | `VerificationPlan`, `VerificationRequest`, `VerificationAssessment`, `ProbeRecord`, `RetrospectiveReviewRecord`, `SemanticReviewRecord`, `Grade`, `AssessmentClosure` and `GuardPostureView`; nine owns later grading and outcome review |
| Ten — assembly | `AssemblyManifest`, `AssemblyAdmission`, `LocalCapabilityPackage`, `PackageTransition`, public adapter seams, confinement, production wiring and a hostile-cut harness (a test driver that stops the responsible process between adjacent durable steps and reconstructs from owned history); the complete worktree observation consumed here is the conditionally granted read-only worktree-observation operation in `seam-response-assembly-followup.md`, ledger #50, and is not landed |
| Eleven — operator surfaces | authenticated pull views, the minimal plane, bounded notices and operator action surfaces; the real guard-and-repair pull operation is granted in `seam-response-operator-followup.md`, with its Part Ten production wiring granted in `seam-response-assembly-followup.md`, ledger #51, and neither is landed |

**Rule — the package cannot reinterpret an earlier owner.** Rules 4, 26, 30, 42, 45, 57, 63,
66, 86, 95 and 107; **checks: P14-NF-03/04/10/11/16/25/27/32/36/40/42**. It cannot infer
standing from a session, turn a signal into a block, swallow a refusal, choose a winner among
conflicting facts, create a retry rule, edit a durable run, or call an adapter directly. Each
consumer re-resolves the current signed source vector and required standing before relying on a
finding or starting an effect. A field reported by the holder about its own authority, posture,
ownership or success is evidence to assess, never authority.

**Value — package boundary.** One package is preferable to independent daemons because one
registered inventory can expose missing coverage, duplicate voice, shared resource pressure and
cross-holder races. The package remains replaceable. A deployment may substitute different
executables while preserving the same plans, evidence bars and public ports.

---
