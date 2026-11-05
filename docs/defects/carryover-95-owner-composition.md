# Carryover 95 — unfinished producer and consumer composition

Status: OPEN. Owner: carryover-95 builder and assembly integration owner.
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

The new CartographerSourcePort remains an interface supplied by tests, not an implemented
committed-Git source adapter. Existing public owners can support an adaptation, but this
branch has not connected them into the required producer. This is incomplete work, not a
claim that the platform cannot support it or that the operator must grant new authority.

Required remaining work:

- Implement and verify the scoped committed-Git producer through the existing tool and
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
  Fixture buildGrounding consumption is component evidence, not production wiring.
- Complete existing-install source and reader migration, independent review, combined
  full tests, native conformance and installed/live proof. Production roots stay closed.

These are not approved omissions or claims that 2.x does better. Raw 1.x source and tests
remain available with hashes. Until this list is complete, the whole-feature exit test
has not passed and the source handoff must not be labelled READY.
