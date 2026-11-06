# Change review — Cartographer committed-source custody continuation

Subject base: f56d91cdc992a918b92b6e74cffa63534c1dc696
Review state: open
Reviewed content: none
Outcome: Connect a finite committed-source capture to real mediated custody and the production Awareness constructor. Row95 remains OPEN: this is tested partial source work, not a READY submission.
Affected rules: 7, 26, 32, 33, 44, 45, 55, 60, 63, 74, 84, 95, 101, 102, 113, 116.
Affected floors: secrets — exclude secret paths before blob reads and reject credential-bearing capture; spend cap — existing SessionWorkPort unchanged; stop — before/after Git and mediated reads; no duplicate sends — no send path; durable intake — exact append/flush receipts and signed observations retained.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Changes physical source capture, current custody disclosure and production owner composition; independent review remains required.
Side effects: Scoped Git reads and encrypted custody appends only inside explicitly constructed owners. Tests use disposable Git repositories and physical encrypted storage. No installed config, credentials, grants, shared service or live probe changed.
Undo and recovery: Revert code before installation; keep existing originals and source receipts. No live migration was performed. Prior projection can rebuild retained observation facts.
Multi-machine posture: Signed observations retain shared Part Two scope; exact originals use the existing Ten persistence demand and disclose only through current binding. Local projection/revision do not prove peer freshness or replication. Author lease remains required.
Layer below: Inspected createProductionCustodyReader/createMediatedStoreReader, openProductionStorage exact append/read/flush, FactStorePort/read/authorAndAppend, production-composition, createAwareness and its bounded grounding renderer. Existing whole-segment and exact-row reads remain an explicit blocker to complete work bounds.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Prompt review: No author question or acceptance criteria changed. Grounding evidence now precedes summary text so its existing line cap preserves source identity; original recorded-shape acceptance tests are rerun. New tests invoke no real model.

Subject (9 paths): docs/defects/carryover-95-owner-composition.md, scripts/cartographer-committed-source.mjs, src/assembly/production-cartographer-source.ts, src/assembly/production-cartographer.ts, src/assembly/production-composition.ts, src/recall/cartographer/README.md, src/recall/cartographer/service.ts, src/recall/cartographer/tree.ts, tests/recall/cartographer/production-source.test.ts

Decision: C95R-custody | Preserve complete finite committed captures using actual append/flush receipts and current mediated reads; never invent exact positions. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-95-cartographer-1105-repair-1601-PROGRESS.md
Decision: C95R-consumer | Construct the actual Awareness reader in production composition and place source evidence before truncatable summary text. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-95-cartographer-1105-repair-1601-PROGRESS.md
Decision: C95R-receipt | Project the signed append receipt directly, removing the extra per-observation full-store readback. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-95-cartographer-1105-repair-1601-PROGRESS.md
Decision: C95R-bounds | Keep row95 OPEN: the existing FactStore and exact persistence readers still need bounded indexed traversal, followed by the original full detect/sweep and migration duties. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-95-cartographer-1105-repair-1601-PROGRESS.md

1.x comparison: inherited original main 154a09ffd and assigned source
4f88880a45f0a119aae3cfd2ccaf9ace26d405b9, history 2aaac4288. All 47 raw
source/spec/test files remain byte-preserved. The host producer adapts
CartographerTree.ts:217–234 (batched NUL-delimited ls-tree identities) and committed
blob semantics; the rest of the new source/custody/consumer code is 2.x adaptation,
not claimed verbatim carryover. ONEX-LESSONS memory/coherence principles retain
originals while bounding projections and require evidence at the actual consumer.
The original server.ts:17327–17515 producer and routes.ts:8984–9333 consumer remain
in the pinned wiring excerpts. No missing full-feature behavior is claimed retired.

Consumer failure neighbor: when the captured revision becomes unavailable, real Awareness
grounding retains the unanswered user message and reports degraded recall with zero items.

## Closing block

simplestRobustRoute: Adapt the original pinned Git identity reader and use the existing exact persistence, mediated custody, signed observation and Awareness owners. This is that route; no private service, grant registry or second memory truth.
80/20: The source-to-custody-to-Awareness path is concrete and tested. Existing bounded replay/storage, full incremental detect/sweep, migration and installed-consumer duties remain in the OPEN defect; no full-port acceptance is claimed.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
