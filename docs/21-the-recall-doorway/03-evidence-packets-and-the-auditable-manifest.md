## 3. Evidence packets and the auditable manifest

**Rule — record evidence delivered, not merely evidence intended.** Rules 7, 13, 41, 49,
69, 75, 89 and 108; **checks: P21-NF-05/06/08/15/17a–j/21**. Proposal A is non-model
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

The fields belong to the records below, or to exact recoverable references to equivalent
owner data. Every record has its own schema version and admission identity. The pre-submit
`RecallManifest` is immutable and complete before submission; it requires no future judgment,
submission, output or outgoing-binding reference.

| Record / field group | Required information at that record's creation |
|---|---|
| RecallAttempt / admission identity | Own root/attempt identity; existing parent reference for a child, otherwise not applicable; purpose (PRINCIPAL or MAINTENANCE), admitted work/run/step, generation/incarnation, initiating principal, source policy and resource reservation; audience binding or maintenance not-applicable disposition |
| RecallManifest / identity | Existing attempt and work references; schema/policy version; generation/incarnation; principal; conversation and recipient/target binding for PRINCIPAL work, or maintenance source/result scope |
| RecallManifest / temporal and scope | Observed clock, query time and historical-as-of time; captured frontier; each index frontier/holes; identity and permission policy references; pending conflicts/taint |
| RecallManifest / planning | Current task/input capture; source inventory; selected and unselected strategies with reasons; exact-reference requirements; no-additional-context reason when applicable |
| RecallManifest / query attempts | Adapter id/artifact/contract/model/index version; normalized query plus derivation capture; source status; start/end or explicit unfinished state; candidate counts; truncation, retry and cache behavior |
| RecallManifest / candidate accounting | Source/capture/span identities; rank and evidence kind; selected/excluded disposition and reason; restricted audit reference for large or sensitive lists |
| RecallManifest / selected evidence | Exact original spans or recoverable captures, attribution, event/ingestion/validity times, direct/indirect participation, supersession/contradiction links, allowed use/disclosure |
| RecallManifest / rendering and assembly costs | Ordered packet sections; rendered span offsets; retained qualification/speaker boundaries; actual token/byte count and any trimming; renderer version/digest; assembly-time reserved/spent/residual (still potentially payable or running) owner resource evidence and recall disposition/limits |
| RecallSubmission / actual input | Existing manifest/attempt; judgment-owner request/attempt and actual provider-input capture reference/hash; ordered supplied carrier rows and every subsequent transformation; owner consumption observation or explicit unknown with reason |
| RecallAttempt / appended observations | Existing attempt and, once created, manifest/submission references; owner judgment output, review findings, derived-memory result or final binding when actually present; stage status, limits and current spent/residual resource evidence. Each observation is a new fact, never an update to admission or manifest. |
| OutgoingRecallBinding / final subject | Existing manifest/attempt and applicable submission; judgment output used for the draft, exact prepared effect/notice subject, current deterministic validation and available review findings; fixed non-model notice instead binds captured template/output and not-applicable model submission |

An unresolved required reference is a claimed dependency that its owner cannot resolve as an
admitted record/capture of the required kind with its declared identity and content bindings,
under current owner resolution and access policy. Historical source captures retain their
original work and generation; they need not originate in the work now recalling them.
For `RecallAttempt` admission, the work, policy and reservation must already resolve; later
observations require the existing attempt and only the stage evidence they claim. For
`RecallManifest`, all required assembly evidence must resolve, including its admitted attempt
and selected captures; a submission, model output or outgoing binding is not required or allowed
as a forward reference. For `RecallSubmission`, the manifest and actual judgment-owner input
capture must resolve; no model output or outgoing binding is required. Unknown consumption
cannot replace the required input capture. For `OutgoingRecallBinding`, the manifest, exact
prepared subject and current owner validation must resolve; model-generated output additionally
requires its actual submission/output evidence. Non-model notices use the explicit alternative
above, never a fabricated judgment. A MAINTENANCE root cannot satisfy outgoing admission.
Unknown versions and any unresolved reference required by the chosen record/stage are refused;
a source's honest unavailable status is not a claim that a missing capture was resolved.

**Rule — source outcomes remain distinguishable.** Rules 13, 42, 45 and 95;
**checks: P21-NF-05/06/09/15**. Each source attempt records exactly one primary state and
any separately recorded coverage limits. The following proposed vocabulary must not collapse into `[]`.

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

**Rule — immutable records follow creation order.** Rules 33, 41, 45 and 90;
**checks: P21-NF-05/10/19**. Admit the attempt first, then capture/render its packet and
admit the complete pre-submit manifest. Submit that packet through the judgment owner. Only
after actual input capture exists can a separate `RecallSubmission` reference it and the
manifest. Once output, the exact prepared subject and current final validation exist, admit
`OutgoingRecallBinding` referencing the manifest and applicable submission. Append attempt
observations referencing each record only after it exists. No earlier fact is mutated to say
it was consumed, and a manifest never contains its own digest in the input it hashes.

NF-05/10 must execute that ordinary successful creation order without placeholders or forward
references, as well as each interrupted and non-model case. A crash before manifest admission
leaves only the attempted assembly. A crash after manifest admission but before submission
leaves the manifest intact with submission/output/binding absent, not unknown successes.
A captured input with missing diagnostic linkage remains explicitly unattributed until an
evidence-backed repair appends the join; it never triggers a duplicate provider call for logging.
After submission, interrupted output or preparation leaves the corresponding later records
absent, with observed failure/unknown state appended to the attempt. Actual charge and residual
exposure stay with their owners even when output is absent. A fixed non-model notice skips
`RecallSubmission` entirely and binds its manifest plus captured template/output with submission
not applicable. A completed analysis with no outgoing work, including maintenance, has no
outgoing binding and records that stage as not applicable. These are stage dispositions, not
unresolved reference placeholders.

All inputs, including subordinate calls and large overflow artifacts, stay in authorized
custody. Hashes permit integrity checking but are never the sole memory copy. The ordinary
reader gets the scoped packet, not protected exclusion lists or private audit topology. The
operator read surface must apply its own current permissions; being an audit does not permit
unrestricted export. Proposal A's 64 kibibyte (KiB; 1,024 bytes each) metadata cap in section 7 spills complete lists to
charged, durable referenced artifacts; it never silently drops required lineage.

**Rule — preserve what an evidence span means.** Rules 7, 28, 29, 86 and 89;
**checks: P21-NF-05–07/12/17a–j**. A packet delimits retrieved text as data. It keeps original
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
