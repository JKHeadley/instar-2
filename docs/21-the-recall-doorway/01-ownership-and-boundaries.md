## 1. Ownership and boundaries

**Rule — one recall owner, existing authority owners.** Rules 1, 4, 7, 28, 30, 33, 49,
66, 69, 89 and 103; **checks: P21-NF-02–07/20/21**. Part Twenty-One owns the recall
contract, retriever-family contracts, memory-sentinel policy hooks, and coherence-outcome
records. It introduces package-owned, versioned recall records, not another constitutional
principal, authorization, fact envelope, run, effect, verification grade, or measurement type.
Its public operations must be registered before use. Its proposed record names below are
contract vocabulary for implementation, not exports that already exist.

| Proposed package-owned artifact | P21 responsibility; owner references retained |
|---|---|
| RecallAttempt | Immutable attempt identity and append-only admission/completion observations; work, purpose, source policy and resource reservation (capacity set aside before starting work) |
| RecallManifest | Selection and rendered-packet account before submission; exact original/derived evidence references and exclusions |
| RecallSubmission | Post-submission join to the actual judgment-owner capture; never a self-issued consumption assertion |
| OutgoingRecallBinding | Exact final effect/notice subject and current validation bound to the attempt, submission or non-model disposition |
| CoherenceOutcome | Opportunity, expected/observed behavior, labels and separately falsifiable diagnosis; measurement and grade owners retain their records |
| Source/projection/policy declarations | Register-owned declarations of P21 adapter contracts, immutable derived-memory versions, scope/resource hooks and activation requirements |

All durable records enter through Part 2's public fact admission and retain generation
(the owner-verified register version applicable to the record), predecessor/cause, schema version, author and source evidence. No model emits an admitted record
directly. P21-A1/A2/A3 specify the eventual closed decoders (validators that accept only the
declared record shapes); this draft supplies no private core type cast or production fact kind. Retrospective corrections append new evidence rather than
overwriting an earlier attempt's result.

Document path numbers and owner package numbers differ in this repository. This design uses
the requested document numbers when saying “Part 11” or “Part 20”; a quoted exported owner
tag keeps its actual value. For example, `src/judgment` calls itself `part-seven`, although
its design is `docs/11-the-judgment-doorway.md`. A numeric coincidence never selects an owner.

| Document label and path | Package / part owner | Imported contract names and retained duty | Part Twenty-One's use |
|---|---|---|---|
| Document 05 — `docs/05-the-types.md` | One — `src/types`, `src/decode` | `VerifiedPrincipal`, `Directive`, `Measurement` (including `Clock`), `StandingGrant`, `Authorization`, `Revocation`, `Provenance`, `Evidence`, `Decision`, `Scope`, `Result`, `Outcome`: constitutional identity, authority, evidence, decisions and quantities | Consume verified values and current owner resolution; never construct authority from remembered prose. Measurement ledgers consume One's quantity type; they do not own it. |
| Document 06 — `docs/06-the-fact-envelope.md` | Two — `src/facts`, `src/projections` | `FactEnvelope`, `CausalFrontier`, `CapturedContent`, `AuthorityTaint`, `ProjectionDefinition`, `ProjectedView`: signed history, original captures and declared views | Read permitted originals; append recall records through public admission; declare rebuildable informational indexes. Taint retains provisional, contested or evidence-unavailable qualifications. |
| Documents 02/07 — `docs/02-the-register.md`, `docs/07-the-declarations.md` | Three — `src/register`, `src/terms`, `src/rulegraph` | `Declaration`, `RegisterGeneration`, `VerifiedRegister`: declarations, version resolution, ports, checks and activation | Enumerate every retriever, producer, consumer, blocker, store, resource policy and owner seam; governed recall-owner enrollment remains pending under section 14 key D. |
| Document 08 — `docs/08-the-intake.md` | Four — `src/intake` | `InboundRoute`, `SenderEvidence`, `IntakePort`, `IntakeCapturePort`: authenticated sender, custody before acknowledgment, binding and classification; the capture port is implemented by Ten | Consume captured task and sender evidence; never authenticate from remembered text. |
| Document 09 — `docs/09-the-run-graph.md` | Five — `src/rungraph` | `Run`, `SessionGrounding`; designed `ContinuityAccounting` remains unlanded: work identity, actual start/resume grounding and run lifecycle | Bind roots and child charges to work; supplement grounding with relevant recall; full-history and continuity duties remain Five's. |
| Document 10 — `docs/10-the-transport-and-leases.md` | Six — `src/transport`, `src/transport/loop-a1` | `Lease`, `FenceToken`, `AdmissionReservation`, `LoopPolicy`, `LoopRecord`, `SettlementApplication`: current ownership, reservations, bounded loops and retained resource exposure | Reserve finite recall work, charge children and retain remaining exposure across restart. Existing narrow reservation/loop contracts do not supply recall composition; section 14 R/L grants must land. |
| Document 11 — `docs/11-the-judgment-doorway.md` | Seven — `src/judgment` | `JudgmentRequest`, `BenchmarkRecord`, `BenchmarkRunRecord`: model-call admission, question/context/submitted captures, advisory judgment and benchmark provenance | Supply evidence packet and assembly receipt; resolve actual submission after all transformations. |
| Document 12 — `docs/12-the-effect-doorway.md` | Eight — `src/effects` | `OperationDefinition`, `OutboundMessage`, `EffectRequest`, `EffectValidation`, `EffectSettlement`: current authority, exact effect binding, dispatch, observation and settlement | Supply outgoing recall coverage and findings; no private invocation, retry, approval or settlement. |
| Document 13 — `docs/13-the-verification-holders.md` | Nine — `src/verification` | `VerificationPlan`, `VerificationAssessment`, `Grade`, `FeedbackDisposition`: assessment, independent review evidence and feedback obligations | Memory findings cannot manufacture an independent assessment or close improvement work. |
| Document 14 — `docs/14-the-assembly.md` | Ten — `src/assembly` | `HarnessLaunchSpec` (including its `contextManifest` field), `HarnessObservation`: custody, confinement, context carrier and production composition | Bind packet references into the existing carrier; require actual consumption. Acceptance of launch input alone is insufficient. |
| Document 15 — `docs/15-the-operator-surfaces.md` | Eleven — operator surfaces; no landed `src/operator` package | Consumes earlier-owner values for authorized inspection, approvals and reachable recovery; no new core type or landed operator export is assumed | Require current context/outcome views and phone-complete pending actions; section 14 O awaits Eleven and its cited grant. |
| Document 16 — `docs/16-conversation-adapters.md` | Twelve — conversation adapters over Four/Eight/Ten | Scoped conversation tuples and verified mappings under the existing intake/effect contracts; no general cross-channel resolver is landed | Join permitted evidence through explicit identities; no identity or authority merge by similarity. |
| Document 19 — `docs/19-scheduled-work.md` | Fifteen — `src/scheduled`, with Six/Ten runtime owners | `ScheduledWorkPackagePort`: declarative bounded work planning; runtime admission remains section 14 W | Open maintenance roots only for owner-admitted jobs, not merely planned occurrences. |
| Document 20 — `docs/20-measurement-ledgers.md` | Sixteen — `src/measurement` | Registered category/value admission through `MeasurementLedgerPort`; One retains `Measurement`; A2 evidence/quantity joins remain pending | Produce coherence observations with denominator membership; use the owner for measured totals, attribution, costs and read surfaces. |
| Document 21 — `docs/21-the-recall-doorway.md` and its indexed sections | Part Twenty-One — proposed recall owner; package enrollment unlanded | Proposed `RecallAttempt`, `RecallManifest`, `RecallSubmission`, `OutgoingRecallBinding`, `CoherenceOutcome`, `RecallPort.prepare`, `RecallSourcePort.describe/query` | Own evidence assembly, retriever contracts and derived recall records only; none is a landed export or a replacement for the owners above. |

The imported spellings above follow their owners' documents and landed contracts:
`src/types/values.ts:10–96`, `src/facts/contracts.ts:5–51`,
`src/projections/fold.ts:18–42`, `src/register/types.ts:22–50`,
`src/intake/contracts.ts:8–61`, `src/rungraph/types.ts:23–82`,
`src/transport/contracts.ts:7–89`, `src/judgment/contracts.ts:12–120`,
`src/effects/contracts.ts:8–49`, `src/verification/contracts.ts:19–108`,
`src/assembly/contracts.ts:33–49`, `src/scheduled/contracts.ts` and
`src/measurement/contracts.ts`. Document concepts with different exported spellings are
mapped here, not silently minted as new types. In particular, Two's envelope/capture/frontier
and projection concepts (`docs/06`, “The envelope every fact carries” and the projection
contract) map to the six exports in its row; Three's anchored register generation and verified
consumption (`docs/07`, “The generator”) map to `RegisterGeneration` and `VerifiedRegister`.
Four's route, authenticated sender and capture-before-acknowledgment port (`docs/08`, “The port
and its adapters”) map to the four intake exports. Six's application of Eight's settlement
(`docs/10`, section 4) maps to `SettlementApplication`; Six does not own effect settlement.
The public scheduled-work and measurement ports implement their documents' package boundaries
(`docs/19`, sections 1–2; `docs/20`, sections 1–2); their exported port names are implementation
spellings, not additional constitutional types. Legacy names in section 11 identify 1.x
sources only; research method names identify experiment evidence, not consumed core contracts.

**Rule — name the terms that carry a decision.** Rules 13, 26, 28, 95 and 108;
**checks: P21-NF-02/03/06/14/15**.

| Term | Contract meaning |
|---|---|
| PRINCIPAL judgment | A decision that produces a substantive reply to a person or selects an external effect, including scheduled/proactive work. This classification is not the `VerifiedPrincipal` identity type. |
| Recall root | One owner-admitted evidence-assembly attempt with an immutable resource account and purpose. A PRINCIPAL root serves the decision above and binds its audience. A MAINTENANCE root serves an admitted background memory work item, has no outgoing audience or sender capability, and produces only derived memory. Section 2 defines both admission paths; only a PRINCIPAL root can support final dispatch reuse. |
| Original episode | Retained evidence of an exchange or observation, with source attribution and custody. A summary of an episode is derived evidence. |
| Derived belief | A source-linked interpretation of what appears true, including validity interval, uncertainty and contradiction. It is not the speaker's own statement. |
| Procedural lesson | A proposed or accepted way to act, with originating evidence and evaluation. It is neither an episode nor a standing grant. |
| Evidence frontier | The per-lineage admitted-history boundary visible for this attempt, plus each queried index's covered spans and holes. It is not “all history everywhere.” |
| Consequential effect | A concrete operation selected by an approved owner policy from email, public posting, deployment, money or other irreversible effects; class membership alone does not authorize semantic blocking. |
| Coherence opportunity | A later behavior whose permitted source evidence and expected use can be assessed against the recorded criteria. Unlabeled turns are not assumed successes. |

**Rule — build claims bind inspected bytes.** Rules 13, 49, 69, 90 and 111;
**checks: P21-NF-01/02/20/21**. The verified main snapshot is
`dd38f07ae4e12e04373ffde7fdf006b08381cf15`. The following are the bounded landed-code
claims used by this design.
They agree with [R4 §7](research/04-compare-and-contrast.md#7-implementation-seams-checked-against-current-main).

| Verified path at that snapshot | What exists | What it does not establish |
|---|---|---|
| `src/facts/contracts.ts:3`, `:10`, `:51`; `src/projections/fold.ts:18`, `:36` | Frontier, fact/capture and informational/authority projection contracts | An automatic memory index, complete remote history, or lossless summary |
| `src/intake/contracts.ts:8`, `:25`, `:48` | Authenticated route/capture dependencies and admitted/duplicate/stop dispositions | Complete email or external-agent custody on every deployment |
| `src/rungraph/types.ts:70`; `src/rungraph/graph.ts:98` | SessionGrounding and validation of actual captured history/consumption | Above-threshold summary or multi-lineage continuity; `graph.ts:108–110` explicitly refuses these narrow-slice cases |
| `src/rungraph/closure-records.ts:405–419` | Closure rejects unsupported continuity fields, including ContinuityAccounting | Landed ContinuityAccounting; it remains absent despite closure landing |
| `src/judgment/contracts.ts:12–21` | JudgmentRequest binds question, context, submitted captures and resource budgets | A universal recall producer or proof that evidence influenced the answer |
| `src/assembly/contracts.ts:33–49`; `src/assembly/harness.ts:20`, `:36–40` | HarnessLaunchSpec contextManifest, consumption mode and observation digests; delivery checks against launch input | Full evolving-context or operator-consumer integration; the carrier is landed, its pending consumers are not |
| `src/measurement/README.md:3–11`; `src/measurement/operations.ts:70` | A1 producer/policy/record and category-value admission | A2 attribution, historical/export/read integration or live recall metrics |
| `src/harness-adapters/README.md:3–8`; `src/transport/loop-a1/index.ts:1`; `src/scheduled/index.ts:1` | Narrow harness A1, loop A1, and scheduled-work packages | P21 recursion prevention, memory curation jobs or a live memory sentinel |

**Value — useful recall without invented closure.** The known gap is getting relevant retained
evidence into behavior, not inventing a second history system. The migration and comparative
evidence in [R1](research/01-instar-1x-memory.md), [R2](research/02-dawn-grounding.md), and
[R4](research/04-compare-and-contrast.md) supports combining mechanisms while measuring each
contribution. Dependencies are named, owned and activation-blocking in section 14; an owner
contract fixture does not stand in for that owner's production implementation.
