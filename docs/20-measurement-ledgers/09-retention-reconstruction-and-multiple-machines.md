## 9. Retention, reconstruction and multiple machines

**Rule — bounded detail does not delete accounting facts.** Rules 7, 32, 33, 39, 43 and 60;
**checks: P16-NF-36/39–41**. Per-call `Measurement`, `Evidence`, judgment, hold, settlement and
conflict facts remain on part two's signed spine. This package declares finite detail horizons
for bounded read presentations, their disposable high-cardinality detail caches, temporary
ingestion buffers and regenerable price indexes. Part two's underlying projection declares
`retention: 'all-identities'`; neither it nor its checkpoints remove an identity because query
time advances. Cache and buffer eviction is bounded by rows, bytes and duration and runs off the
observed path. Rebuilding the source projection from the same facts, pinned frontier and register
generation produces the same complete projection bytes. Rebuilding a read presentation from
those bytes plus the same query, manifest generation and evaluation clock produces the same
bounded result. Advancing the evaluation clock may advance only the presentation cutoff and cache
contents. A detail horizon must not be presented as the beginning of the source projection or
recorded history.

**Rule — evidence pins and lawful redaction still win.** Rules 7 and 26, plus parts two, seven and
nine's owned retention contracts; **checks:
P16-NF-39–41/47**. Content-free accounting facts do not require prompt or response bodies.
Provider payload captures, when required by seven or nine, follow their existing custody and
retention pins. An open authorization, conflict, unsettled charge, benchmark obligation or
verification assessment prevents removal where the owning part says so. Lawful capture removal
leaves two's tombstone and does not permit replacing an unknown quantity with zero. This part
adds no fact-deletion or encryption-key-destruction path.

**Rule — every source projection is rebuildable and pool presentation starts from canonical identities.** Rules
31–33, 39, 45, 69, 95 and 113; **checks: P16-NF-14/16/36–41/50**. A pool query first unions
canonical attempt ids, observation keys, operation ids and current causal heads from all admitted
replicas. Full-replica overlap therefore contributes once; incompatible content under an identity
conflicts; genuinely disjoint identities contribute separately. Only after this union may the
bounded read presentation derive counts, money, coverage denominators or percentiles. The
underlying part-two projection folds only facts plus the register generation, retains all
identities and is checkpointed and rebuilt at its exact folded-through vector. Query parameters,
the evaluation clock and the presentation's detail horizon do not enter that fold. Same-sample arithmetic continues
to require the full subject instance. Cross-instance addition uses only the registered
`aggregateMeasurements` operation and a declared `measurement-window aggregate`; compatible
members match subject kind, unit, category semantics, producer contract, currency/price basis or
hardware profile as applicable, aggregate scope, query frontier and evaluation clock. They do not
need the same attempt or process instance. Every aggregate retains the member observation keys and
full sample identities. It next groups the current observation heads by family-specific quantity
key: equal compatible witnesses of the same source sample contribute one amount, disagreement
about that sample remains unresolved until an owner-produced resolution names all witnesses, and
different exchange or source sample identities add as distinct quantities. Two resource samples
of one process incarnation at different sample times therefore never collapse, even when their
amounts are equal. Thus overlap is removed without mistaking independent evidence for
independent consumption, while disjoint compatible attempts add exactly once.
An unregistered pool scope or a member outside the declared aggregate scope refuses. This part
chooses source-fact aggregation: percentiles are computed from the deduplicated compatible source
observations, never from averaged peer percentiles or an unspecified sketch. Money uses each
operation's one current six-owned accounting state. Latest quota remains per account/window;
resource samples remain per machine/hardware profile. Missing-peer and conflict sets are unioned.
A peer timeout returns a partial response naming the peer and last admitted frontier, never an
unqualified pool total.

**Value — the signed spine grows.** The constitutional design deliberately retains facts. Bounded
read-presentation and cache retention controls working sets and disclosure, but it does not bound the
spine's physical lifetime. Ten's `GrowthPolicy` and `GrowthObservation` measure source-fact and
complete-projection growth separately from presentation-cache growth and open one coalesced
part-five investigation through six's loop. If that work
proposes a lossless fact-storage change, part two owns its design and approval. Rollup retention
is not deletion authority.

---
