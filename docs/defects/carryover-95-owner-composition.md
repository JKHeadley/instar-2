# Carryover 95 — unfinished producer and consumer composition

**Status:** OPEN
**Owner:** carryover-95 builder and assembly integration owner.
Recheck: 2026-11-06 at review-desk handoff.
Exit test: full row95 source, sweep, bounded navigation and installed/live proof.

The supplied base is 990678d5996737c1fd13d8a49b4e0c9a1045d196. The following existing
owner implementations were inspected directly, alongside src/ searches and their history:

- `src/assembly/custody.ts` reads exact admitted encrypted positions with a byte budget.
- `production-custody-wiring.ts` binds those positions to authenticated peer, grant,
  generation, scope and stop, then durably records access before releasing bytes.
- `src/assembly/tool-inventory.ts` admits listed process/port proposals. Its registered
  Git commands are status and diff; its tests refuse an unregistered shell proposal.
- `src/assembly/harness.ts` delegates launch/deliver/observe to the effect-owned driver.
- `production-session-work.ts` exposes admitted model work with resource and stop floors.
- `src/recall/README.md` documents whole-store reads and unresolved production bindings.

The source adapter now has a production implementation in
`src/assembly/production-cartographer-source.ts`: real exact append/flush receipts
and the existing `createProductionCustodyReader` enforce current standing, scoped
positions, expiry, generation and stop before releasing captured committed bytes.
`scripts/cartographer-committed-source.mjs` adapts the original batched Git identity
read with exact-root admission, finite population/byte/command limits and pinned
revision rechecks. `production-cartographer.ts` constructs the real Awareness
consumer; `production-composition.ts` exposes it only with the installed shared
fact and persistence owners. This is source composition, not installed activation.

The finite capture currently refuses a repository exceeding 4096 entries or 2 MiB;
it is not the complete original incremental large-tree worker. Receipt projection
removes the extra per-observation readback scan. The actual shared storage paths
still block the required work-bound claim: `createCartographer` construction calls
`FactStorePort.read`; `authorAndAppend` and FactStore append verify whole segments;
`ProductionStorage.persistence.readExact` decodes `exact.encrypted` and searches
all rows. A returned page/output cap does not bound those reads. The smallest
continuation is indexed/budgeted reads and replay at the existing Two/Ten owners,
then binding this adapter to their bounded path; no new storage authority is needed.

Required remaining work:

- Complete the scoped committed-Git producer through the existing tool and
  custody owners: root selection/canonical identity/revision checks, finite byte/CPU/heap
  work, incremental batched OIDs, committed blob originals and retained source references.
  Preserve RootAuthority/RootRegistry behavior and structural-only navigation where applicable.
- Bind bounded source custody to projection rebuild/readback; current whole-store reads
  do not satisfy that production work bound.
- Complete the 1.x detect/worker adaptation: cross-page deepest-first and starvation
  ordering, oldest-fresh quality revalidation, quarantine recovery, full freshness
  observations, worker ceilings and restart-persistent cursor/breaker behavior.
- Bind returned sweep state to existing durable scheduled-work occurrences, and bind the
  actual declared session/tool consumer and generated awareness to its matching manifest.
  The constructed Awareness consumer is exercised, but installed source configuration,
  real session delivery and generated capability registration still need integration.
- Complete existing-install source and reader migration, independent review, combined
  full tests, native conformance and installed/live proof. Production roots stay closed.

These are not approved omissions or claims that 2.x does better. Raw 1.x source and tests
remain available with hashes. Until this list is complete, the whole-feature exit test
has not passed and the source handoff must not be labelled READY.
