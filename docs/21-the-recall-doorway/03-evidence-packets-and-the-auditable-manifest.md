## 3. Evidence packets and the auditable manifest

**Rule — record evidence delivered, not merely evidence intended.** Rules 7, 13, 41, 49,
69, 75, 89 and 108; **checks: P21-NF-05/06/08/15/17/21**. Proposal A is non-model
accounting. `RecallManifest` is Part Twenty-One's package-owned assembly receipt; Part 11
retains model input/output custody and the assembly owner retains its contextManifest carrier.
P21 supplies references and digests to those existing owners, not an alternative capture store.

`src/judgment/contracts.ts:12–21` exposes separate question/context/submitted captures.
`src/assembly/contracts.ts:33–49` exposes class/reference/digest carrier rows and consumption
observations. These landed shapes do not provide every join below. Production binding is
**NON-EXECUTABLE-UNTIL-row-85-judgment-recall-consumer** and
**non-executable until `seam-response-assembly-followup.md` and
`seam-response-rungraph-followup.md` row-45 addenda land** (ASSEMBLY-CURRENT-CONTEXT);
operator inspection additionally awaits
**OPERATOR-CONTEXT-CONSUMERS**, all defined in section 14.

The proposed manifest requires these fields or exact recoverable references to equivalent
owner data. Decoder admission rejects unknown versions, unresolved required references and
asserted successful submission without the owner's capture evidence.

| Record group | Required information |
|---|---|
| Identity | Schema/policy version; root/attempt/parent; run/step/judgment; generation/incarnation; principal; conversation and recipient/target binding |
| Temporal and scope | Observed clock, query time and historical-as-of time; captured frontier; each index frontier/holes; identity and permission policy references; pending conflicts/taint |
| Planning | Current task/input capture; source inventory; selected and unselected strategies with reasons; exact-reference requirements; no-additional-context reason when applicable |
| Query attempts | Adapter id/artifact/contract/model/index version; normalized query plus derivation capture; source status; start/end; candidate counts; truncation, retry and cache behavior |
| Candidate accounting | Source/capture/span identities; rank and evidence kind; selected/excluded disposition and reason; restricted audit reference for large or sensitive lists |
| Selected evidence | Exact original spans or recoverable captures, attribution, event/ingestion/validity times, direct/indirect participation, supersession/contradiction links, allowed use/disclosure |
| Rendering | Ordered packet sections; rendered span offsets; retained qualification/speaker boundaries; actual token/byte count and any trimming; renderer version/digest |
| Submission | Intended packet reference, actual provider-input capture reference/hash, ordered supplied carrier rows, every subsequent transformation, owner consumption observation or explicit unknown |
| Output and costs | Judgment output and prepared effect references; review findings if any; final binding reference; reserved/spent/residual resources, status and limitation references |

**Rule — source outcomes remain distinguishable.** Rules 13, 42, 45 and 95;
**checks: P21-NF-05/06/09/15**. Each source attempt records exactly one primary state and
any orthogonal coverage limits. The following proposed vocabulary must not collapse into `[]`.

| State | Meaning |
|---|---|
| available-empty | A successful bounded query of an available source returned no candidates; not a proof no relevant history exists |
| not-indexed | The requested source has no admitted index coverage |
| behind-frontier | Some requested source history lies beyond covered spans or in a known hole |
| scope-filtered | Owner policy excluded candidates or a source; recipient-visible detail must not reveal protected existence |
| unavailable | Required custody/index/service cannot be resolved or reached |
| timed-out | The admitted attempt exceeded its deadline; late results are separately observed and unusable for that attempt |
| budget-excluded | Work or content was eligible but not admitted under the remaining budget |
| not-requested | The policy did not query that source, with its selection reason |
| available-results | The bounded query returned candidates; packet delivery and useful behavior remain separate facts |

**Rule — two immutable stages avoid a circular receipt.** Rules 33, 41, 45 and 90;
**checks: P21-NF-05/10/19**. The pre-submit manifest binds the proposed packet and its
selection. After submission, a separate `RecallSubmission` references that immutable manifest
and the owner-captured actual input. An `OutgoingRecallBinding` later references submission and
effect bytes; a fixed non-model notice instead references its captured template/output and
not-applicable submission disposition. None updates an earlier fact to say it was consumed.
A manifest does not contain
its own digest in the input it hashes. A crash before submission leaves an attempted assembly,
not a completed judgment. A captured input with missing diagnostic linkage remains explicitly
unattributed until an evidence-backed repair appends the join.

All inputs, including subordinate calls and large overflow artifacts, stay in authorized
custody. Hashes permit integrity checking but are never the sole memory copy. The ordinary
reader gets the scoped packet, not protected exclusion lists or private audit topology. The
operator read surface must apply its own current permissions; being an audit does not permit
unrestricted export. Proposal A's 64 KiB metadata cap in section 7 spills complete lists to
charged, durable referenced artifacts; it never silently drops required lineage.

**Rule — preserve what an evidence span means.** Rules 7, 28, 29, 86 and 89;
**checks: P21-NF-05–07/12/17**. A packet delimits retrieved text as data. It keeps original
speaker distinct from quoted author, forwarder, observer, and this agent. “Agent B heard A say X”
cannot render as “I promised X.” A generated key, title, belief, anchor or summary is labeled
derived and links to its support; a matching entity name cannot substitute for its body.
Conflicting or historically superseded passages remain identifiable rather than silently merged.
Content containing tool instructions or an old approval is evidence only. Current authority
comes from its owner, never from the retriever's confidence or the packet's tone.

**Value — proof of input enables diagnosis, not proof of understanding.** The three executed
fixtures in [R5 §7](research/05-proposals-and-evaluation.md#7-executed-baseline-fixtures--installed-methods-synthetic-collaborators)
show successful-looking counts beside omitted material. Dawn's inspected access check is
stronger than self-attestation but weaker than actual provider-input binding
([R2 §4](research/02-dawn-grounding.md#4-grounding-before-email-x-and-reddit)). The required
correct-evidence-but-unused control therefore compares exact submitted spans to behavior;
the manifest cannot award itself a coherence success.
