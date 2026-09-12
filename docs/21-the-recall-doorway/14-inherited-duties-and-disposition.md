## 14. Inherited duties and disposition

**Rule — a dependency is a named owner obligation, not an assumed schema.** Rules 8, 33,
49, 69, 71, 90, 95 and 111; **checks: P21-NF-02/10/18/20/21**. The following are
stable design dependency ids. They are proposed seam/slice names for tracking this contract;
they do not claim an owner grant was issued or code landed. Every
`NON-EXECUTABLE-UNTIL-<id>` in this design resolves here. Where an earlier owner design already
names a granted-but-unlanded seam, this design inherits that obligation rather than substituting
a local implementation. All required dependencies must be resolved at the active generation,
with real public decoder/port and joint tests, before the affected positive activates.

| Dependency id / accountable owner | Required deliverable and present disposition | Affected checks |
|---|---|---|
| P21-A1 / recall owner | Proposed bounded root/recall/manifest/submission contracts, retriever coordinator, owner-mediated source access, closed decoders and contract map. Design-only, no runtime exports claimed. | 02–10, 19, 20 |
| P21-A2 / recall owner | Proposed indexing/derived-memory producers, frontier/holes, migration and permanent regression implementations. No write-side implementation claimed. | 11, 12, 17, 18, 23 |
| P21-A3 / recall owner | Proposed coherence-outcome producer, replay importer/runner and frozen pilot evaluation integration. Public schema is supplied; runtime pending. | 15, 16, 22 |
| P21-A4 / recall owner | Proposed selective-review and retrospective/write-watch hook consumers. No independent holder or effect authority. | 13, 14, 24 |
| JUDGMENT-RECALL-CONSUMER / Part 11 document, `src/judgment` owner Seven | Add owner-resolved principal/subordinate classification, required pre-submit recall disposition and exact post-transformation manifest join. Landed captures at `src/judgment/contracts.ts:12–21` are consumed, not relabeled a complete recall producer. | 03, 05, 21 |
| EFFECT-RECALL-CONSUMER / Part 12 document, `src/effects` owner Eight | Consume current outgoing recall binding at every message/consequential operation and invalidate changed bytes/audience/authority; preserve dispatch/settlement ownership. New requested seam, not asserted landed. | 03, 07, 10, 13, 21 |
| INTAKE-CONVERSATION-RECALL-SCOPE / Part 4 intake, Part 16 family, operator/assembly owners | Public verified person/conversation relation and internal-use/provider/disclosure read-scope resolution, including aliases, revocation, intermediate joins and metadata. Landed route/sender evidence at `src/intake/contracts.ts:8–23` is narrower. | 06, 07, 09, 12, 18 |
| INTAKE-EMAIL-AGENT-CUSTODY / intake and concrete source adapters | Complete body/quote/attachment and external-agent exchange custody/attribution/frontier contract, with unavailable/partial traces; original capture remains Part 2/assembly custody. Production traces UNKNOWN. | 09, 16, 21, 22 |
| RUNGRAPH-CONTINUITY / Part 5 `src/rungraph`, effects consumer and assembly | ContinuityAccounting producer/decoder/reader and first-reply consumption; exact uncovered input after compaction. Not landed: `src/rungraph/closure-records.ts:405–419`. Inherits the `seam-response-run-closure.md`, `seam-response-rungraph-followup.md`, `seam-response-effects-followup.md` dependencies named by Part 16 section 1; these names are owner grant references, not files supplied by P21. | 10, 17, 21 |
| RUNGRAPH-MULTILINEAGE-GROUNDING / Part 5 run graph | Actual multiple-lineage grounding/ordering and source completeness at start/resume, replacing the explicit narrow-slice refusal at `src/rungraph/graph.ts:108–110`; P21 cannot broaden it privately. | 18, 21 |
| ASSEMBLY-CURRENT-CONTEXT / assembly owner Ten plus run graph | Current immutable context-delivery specification and consumption for later intake/resume, bound to current step/input/incarnation; consume the landed HarnessLaunchSpec carrier. Inherits row-45 owner grants in `seam-response-assembly-followup.md` and `seam-response-rungraph-followup.md`, as Part 16 section 1 explains. | 05, 10, 17, 21 |
| OPERATOR-CONTEXT-CONSUMERS / operator-surface owner Eleven and assembly | Current authorized manifest/context/outcome and pending/expiry read/action surfaces, including mobile use and minimal-responder reachability. Consumers pending; contextManifest carrier already landed at `src/assembly/contracts.ts:33–49`. | 14, 15, 21, 24 |
| RESOURCE-RECALL-RESERVATIONS / transport/resource owner Six, judgment and assembly | Public reservation/child-charge/cancellation/remaining-exposure binding for recall fan-out and background work across restart/placement. Existing loop A1 exports (`src/transport/loop-a1/index.ts:1`) do not establish P21 recursion/resource composition. | 04, 08, 10, 18, 23 |
| SCHEDULED-MEMORY-WORK / scheduled/transport owner with P21 producers and assembly | Durable indexing, curation and retrospective work triggers, bounded fairness/backlog, retries, clock and recovery. Scheduled exports exist (`src/scheduled/index.ts:1`); memory job wiring is proposed. | 11, 23, 24 |
| EFFECT-RECALL-PENDING / proposed effect owner Eight, scheduling owner Six, run graph and operator surfaces | Exact pending effect/draft/cause, recovery/expiry, cancellation and reachable status. Owner assignment/defaults require OD-06; no private P21 queue or timeout-as-approval. The full proposed consumer is unlanded. | 10, 14, 24 |
| MEASUREMENT-A2-COHERENCE / Part 20 document, `src/measurement` owner Sixteen | A2 evidence-bound quantities, canonical outcome/denominator joins, attribution, costs, peer completeness, historical reads and operator/export composition; A1 only is landed (`src/measurement/README.md:3–11`). P21 outcome mapping additionally needs owner acceptance. | 15, 16, 18, 21 |
| MEASUREMENT-BENCHMARK-COMPATIBILITY / judgment, verification, assembly, transport and Part 20 | Owner-resolved compatibility tuple, comparable benchmark-run start clock, independent grades/evaluation, measured route support and bounded analysis. Inherits Part 20 section 7's `seam-response-judgment.md`, `seam-response-assembly-followup.md` and loop dependencies, including its row-73 clock seam. No measured positive inferred from numeric timestamps or opaque digests. | 15, 16 |
| ASSEMBLY-RECALL-LIFECYCLE / assembly/operator owner with all P21 consumers | Real confined provider/harness/effect/custody composition, registered capability and awareness, startup/resume/update wiring and user-surface proof. Existing fixture adapters are not production substitutes. | 02, 03, 10, 17, 19–21, 24 |
| LIVE-REVIEW-OWNER-POLICY / effect/judgment/verification owners and operator | OD-05's explicit rulebook reconciliation, effect allowlist, qualifying historical prerequisites, bounded findings-to-hold consequence and evidence bar; D1 proposes, does not approve. | 13, 14, 21 |

**Rule — all inherited duties receive a disposition.** Rules 7, 8, 33, 49, 69, 71,
77, 95, 105 and 113; **checks: P21-NF-02/11/15/18/20/21**.

| Duty | Disposition in Part Twenty-One |
|---|---|
| Durable original history and lossless memory under rule 7 | Held as a design contract: originals remain in Part 2 custody; indexing/reflection/export never delete unique evidence. Runtime proof awaits P21-A2 and custody composition. |
| Authenticated intake, standing and audience | Consumed from Part 4/identity owners; no recall inference creates principal/permission. General join/internal-use service explicitly requested and pending. |
| Full-history SessionGrounding at start/resume | Consumed exactly as landed within its narrow limits. B adds relevance selection; it cannot replace or relax grounding, clock, threshold or current-work coverage. |
| Compaction disclosure and uncovered inbound accounting | Retained with run graph/effect/assembly owners through RUNGRAPH-CONTINUITY; ACK or manifest is not a substitute. |
| Part 11 actual judgment input audit | P21 assembles and accounts; judgment/assembly retain capture and consumption. Carrier present, broader consumers pending, no second capture law. |
| Part 12 attributable outgoing effects | Final binding and selective findings are required proposed consumer duties; authority, retries, unknown dispatch and settlement stay with effects/transport. |
| Part 9 verification owner duties | Independent grades and evidence strength remain with verification; P21 findings and self-confidence are not independent witness proof. Run-graph document 9 is consumed separately above. |
| Part 16 cross-channel identity/parity | Exact scope/tuple/alias semantics inherited, with no automatic person merge; each email/agent/platform source needs its own real custody and permission proof. |
| Part 20 measurement and benchmark compatibility | Coherence records map to owner outcomes/quantities; A2/compatibility remain declared dependencies. Offline pilot never impersonates a production ledger. |
| Sentinel/scheduled/limited-response duties | Existing owners retain lifecycle, stop precedence, user reachability and bounded notices; memory hooks add evidence, not another reaper or outbound loop. |
| Multi-machine and migration parity | Original facts replicate under custody; local indexes declare partial coverage and rebuild; installed consumers migrate together; no false fleet completeness or uncertain-send replay. |
| Agent/operator awareness | Implementation must enumerate sources and limits in capability/awareness templates and actual operator surfaces, including update migrations; this docs branch does not claim availability. |

**Value — closure requires owner evidence.** Echo's implementation planning should assign each
requested seam to its owner slice, preserve its inhibited consumers, and recheck at assembly.
The statuses follow the verified paths in section 1 and
[R4 §7](research/04-compare-and-contrast.md#7-implementation-seams-checked-against-current-main).
A future landing changes the executable posture only after its real integration checks pass;
it does not retroactively make this design's unexecuted claims measured.
