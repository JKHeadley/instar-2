## 4. The replaceable retriever family

**Rule — engines are adapters behind owner-governed ports.** Rules 1, 4, 30, 33, 40,
57, 66 and 69; **checks: P21-NF-02/04/06/08/09/19/20**. Proposed
`RecallSourcePort.describe/query` reports capabilities and returns bounded candidate references.
The P21 coordinator owns policy selection, budget allocation, deduplication, ranking composition
and evidence rendering. The source-access owner mediates every read and hydration. An adapter
may narrow the supplied scope for efficiency; it cannot widen or decide the permission boundary.
No adapter has ambient source credentials, sender access, an unbounded filesystem root, or a
private provider path. Hosted vector/reranker calls require owner-approved data egress too.

Every adapter declaration includes id/version/artifact, source/capture kinds, lookup modes,
index schema and coverage behavior, owner port handles, query/candidate/byte limits, resource
charges, cancellation and late-result behavior, supported platforms, failure vocabulary,
positive/negative fixtures, migration/rebuild policy and explicit unsupported modes. Read-only
does not mean zero cost or unlimited scope. A replacement must pass the same family suite and
the active owner contract before it replaces an installed adapter.

| Family / proposed port mode | Input and bounded output | Required failure/boundary fixture |
|---|---|---|
| Exact history | Fact/message/capture ids, conversation and temporal range; original adjacent turns and verified source spans | Referenced retained fact bypasses lagged index through custody; unavailable capture is not “never said”; bounds preserve omitted-range accounting |
| Lexical | Task-derived terms, quoted names/phrases and permitted corpus handle; exact-body matches with source offsets | Negation and qualifier crossing a chunk boundary survive hydration; successful zero-match differs from unavailable search |
| Semantic | Task/query embedding under a pinned model, dimension and index generation; dense candidates and optional lexical fusion | Lexical-mismatch evidence reaches actual packet; missing embeddings and changed models expose coverage and compatibility limits |
| Relationship/person | Owner-resolved person/agent ids, time and conversation links; permitted original exchanges plus labeled notes/arcs/pins | Same-name people stay separate; imported note does not become direct participation; relationship state is not current standing |
| Cross-conversation joins | Explicit Part 16 conversation mapping and owner-authorized relation edges; source paths spanning scoped conversations/channels | Two authorized topics join; unverified alias, wrong account, restricted intermediate node and missing email custody refuse or limit only the affected path |
| Recursive search | An unresolved evidence question, current candidate references, allowed adapters and remaining root handle; traced expansion and stopping reason | Cycles, repeated queries, uncooperative children, depth/call exhaustion and forbidden hops cannot create new roots or concealed work |

**Rule — exact history remains a first-class fallback.** Rules 7, 45, 77 and 96;
**checks: P21-NF-05/09/11/17**. Derived structures accelerate discovery but are never the
only route to retained originals. An explicitly referenced fact or a known index gap selects
bounded raw lookup before the coordinator concludes that evidence is unavailable. If the
necessary range exceeds the live budget, record the uncovered range and follow the per-consumer
fail direction. Do not scan all history covertly, skip the range silently, or claim a summary
contains it. Multi-hop answers should hydrate a sufficient original support path before using
an extracted graph edge as if it were the underlying exchange.

**Rule — ranking does not decide truth or permission.** Rules 13, 28, 57, 86 and 108;
**checks: P21-NF-06/07/09/12/15**. The policy may combine lexical/dense rank and recency,
importance, relationship or task cues using declared normalization and tie-breaking. Raw scores
from unlike engines are not directly comparable. Deduplication uses source/span identities and
preserves distinct contradictory claims; repeated paraphrases of one source do not become
independent corroboration. A rarely used old constraint is not obsolete merely because it has
low activation. Current-versus-historical validity is resolved separately.

Selection reserves room for exact obligations and required attribution/qualification before
optional broad summaries. The concrete quota policy is versioned and compared with a common
final context cap. Adapter rank, owner exclusions, policy displacement and renderer truncation
are separate diagnostic stages. A cache hit reports the original query/source identity and
current revalidation, not a fictitious fresh search.

**Rule — recursive search is bounded exploration, not recursive authority.** Rules 40, 41,
57, 75 and 114; **checks: P21-NF-04/08/09/19**. Each hop records its parent candidate,
question, edge/source, scope resolution, charge and stopping reason. The owner keeps a visited
set bound to source/version and query, charges backend fan-out, and stops on support found,
no new permitted evidence, cycle, depth ceiling, cancellation or budget exhaustion. Model-planned
search is optional and subordinate. A precomputed summary tree is a different adapter/index
strategy from iterative query planning; each declares its construction and read costs.

**Value — selection follows measured contribution.** The candidate progression is exact/raw
and lexical first, then matched-budget dense/hybrid, then temporal/person channels, then
graph/tree or deeper search when ablations justify them. It is a proposed experiment order,
not a claim of a universally best portfolio. [R3 §§2–6](research/03-external-research.md)
and [R4 §§2–5](research/04-compare-and-contrast.md) compare these mechanisms and document
extraction losses and competing simple controls. Pins and relationship summaries may help but
must not make the user responsible for manually flagging every fact worth remembering.
