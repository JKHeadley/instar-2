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
| RecallAttempt | Immutable attempt identity and append-only admission/completion observations; work, purpose, source policy and resource reservation |
| RecallManifest | Selection and rendered-packet account before submission; exact original/derived evidence references and exclusions |
| RecallSubmission | Post-submission join to the actual judgment-owner capture; never a self-issued consumption assertion |
| OutgoingRecallBinding | Exact final effect/notice subject and current validation bound to the attempt, submission or non-model disposition |
| CoherenceOutcome | Opportunity, expected/observed behavior, labels and separately falsifiable diagnosis; measurement and grade owners retain their records |
| Source/projection/policy declarations | Register-owned declarations of P21 adapter contracts, immutable derived-memory versions, scope/resource hooks and activation requirements |

All durable records enter through Part 2's public fact admission and retain generation,
predecessor/cause, schema version, author and source evidence. No model emits an admitted record
directly. P21-A1/A2/A3 specify the eventual closed decoders; this draft supplies no private core
type cast or production fact kind. Retrospective corrections append new evidence rather than
overwriting an earlier attempt's result.

Document path numbers and owner package numbers differ in this repository. This design uses
the requested document numbers when saying “Part 11” or “Part 20”; a quoted exported owner
tag keeps its actual value. For example, `src/judgment` calls itself `part-seven`, although
its design is `docs/11-the-judgment-doorway.md`. A numeric coincidence never selects an owner.

| Consumed document / package owner | Duty retained by that owner | Part Twenty-One's use |
|---|---|---|
| Part 2 fact spine: `docs/06-the-fact-envelope.md`, `src/facts`, `src/projections` | Durable signed facts, original captures, causal history, taint, correction and projection law | Read permitted originals; append recall records through its public admission; declare rebuildable informational indexes |
| Register: `docs/02-the-register.md`, `src/register` | Declarations, governed versions, ports, checks and activation | Enumerate every retriever, producer, consumer, blocker, store, resource policy and required owner seam |
| Part 4 intake: `docs/08-the-intake.md`, `src/intake` | Authenticated sender, custody before acknowledgment, binding and classification | Consume captured task and sender evidence; never authenticate from remembered text |
| Part 5 run graph: `docs/09-the-run-graph.md`, `src/rungraph` | Work identity, actual start/resume grounding, continuity and run lifecycle | Bind roots and child charges to work; supplement grounding with relevant recall; never claim recall replaces full-history coverage |
| Part 9 verification owner: `docs/13-the-verification-holders.md`, `src/verification` | Assessment, grades and independent review evidence; document 9's run graph is separately consumed above | Memory findings do not manufacture an independent assessment |
| Part 11 judgment: `docs/11-the-judgment-doorway.md`, `src/judgment` | Model-call admission, input/output captures, advisory judgment and benchmark records | Supply evidence packet and assembly receipt; resolve actual submission after all transformations |
| Part 12 effects: `docs/12-the-effect-doorway.md`, `src/effects` | Current authority, exact effect binding, dispatch, observation, settlement | Validate outgoing recall coverage and return findings; never invoke, retry, approve or settle an effect privately |
| Part 16 conversations: `docs/16-conversation-adapters.md`, intake and concrete adapters | Durable scoped conversation tuples and verified mappings | Join permitted evidence through explicit identities; never collapse people or authorities by similarity |
| Part 20 measurement: `docs/20-measurement-ledgers.md`, `src/measurement` | Quantities, accounting attribution, burn, aggregation and read surfaces | Produce coherence observations with denominator membership; use the owner for measured totals and costs |
| Assembly/operator/harness: `docs/14-the-assembly.md`, `docs/15-the-operator-surfaces.md`, `src/assembly` | Custody, confinement, context carrier, production composition, operator visibility | Bind packet references into the carrier; require actual consumption and a reachable recovery surface |

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
| Coherence opportunity | A later behavior whose permitted source evidence and expected use can be adjudicated. Unlabeled turns are not assumed successes. |

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
