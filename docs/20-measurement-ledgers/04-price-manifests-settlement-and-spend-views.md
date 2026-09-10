## 4. Price manifests, settlement and spend views

**Rule — usage is stored independently of price.** Rules 7, 13, 26, 32, 58 and 69; **checks:
P16-NF-15–18**. Token and provider-usage measurements contain no mutable current-price answer.
The required manifests are the explicit part-three prerequisite in section 1, not a kind this
part may invent. Once that seam lands, a routing-spend read calls two's public
`FactStorePort.readForProjection()` and receives one current owner-issued source history input. It
pins that snapshot's canonical digest, supplies that exact object to the source fold, and uses the
fold's actual `foldedThrough` vector as the read frontier. It resolves the owner-issued manifest
decoder and effective point for each attempt's dispatch time and billing class, and then computes
derived cost. Repeating the fold and presentation while that owner snapshot remains current, with
the same register generation, manifest generation, query and explicit evaluation clock, produces
equal canonical bytes. The complete envelopes supply acceptance, prepared and dispatch membership
clocks and source-history joins that the body-only projection does not retain. Manifest generation,
query parameters, source-history metadata and evaluation time are never fold inputs.

A price correction appends signed history and invalidates the old owner snapshot. Even though the
old snapshot's encoded bytes and digest have not changed, `foldProjection()` must refuse it with
`integrity`, and `readProjection()` must refuse the view previously folded from it with
`stale-base`. The read then obtains a fresh snapshot through `readForProjection()`, folds the new
frontier and may produce a different current presentation. The correction never edits usage or
moves the exchange out of its dispatch window. This package does not promise to reconstruct the
former frontier after the store advances, because the landed owner port supplies no historical-
frontier read. Copying or deserializing the old snapshot is not an owner-issued reconstruction.
P16-NF-15 remains a tracked follow-on until the manifest seam lands; neither its unavailable state
nor its written fixture counts as a positive result.

**Rule — every dollar-like figure says what kind of figure it is.** Rules 13, 26, 39, 58 and 86;
**checks: P16-NF-17–20**. Each row separates provider-settled cost, manifest-derived gross cost,
subsidy or credit allocation, net derived cost, committed window total and unpriced usage. Money is
kept as exact decimal or integer minor units with an explicit currency. Totals do not add unlike
currencies. A conversion appears only through the requested part-three exchange-rate declaration,
with its effective time and a separately labelled converted total. A point is implausible exactly
when its exact rate is below the manifest's inclusive `minimumRate`, above its inclusive
`maximumRate`, or, when configured, its ratio to the causally prior current point is greater than
the inclusive maximum-step ratio. Equality at a bound is valid. Missing required bounds yield
`insufficient policy`, not implausible. A zero prior rate for a ratio test also yields
`insufficient policy`. An incomparable prior point yields `insufficient policy`. A missing point
produces unpriced usage with a missing-point reason. A stale point produces unpriced usage with a
stale reason. An incompatible point produces unpriced usage with an incompatible reason. An
implausible or insufficient-policy point produces unpriced usage with that exact reason. None
becomes zero cost.

**Rule — provider settlement outranks estimation without erasing disagreement.** Rules 31, 33,
58, 86 and 95; **checks: P16-NF-18/19/36**. Eight supplies settlement evidence; six alone applies
it and owns `SettlementApplication` history. A signed application is historical accounting
evidence, not necessarily six's currently usable admission state. After restart, six retains the
reserved maximum until eight's live settlement consumption qualifies the exact application again
and its original durability demand succeeds. The landed public `inspect()` does not expose that
distinction. Current committed totals therefore remain unavailable until the requested six-owned
qualified accounting read lands.

Once the six-owned `readAdmissionAccounting` seam and its granted `accountingWindow` addition
land, the view selects operations by that stable membership and then unions canonical operation
ids, including each member once.
The selection uses the reservation's owner-issued window even when dispatch or settlement occurs
in another hour or day. A missing or conflicted owner window makes the committed total partial and
retains maximum exposure; query time never reassigns it.
For operation `o`, let `E(o)` be six's qualified conservative exposure, `A(o)` its qualified
non-negative final provider charge when present, and `M(o)` its qualified maximum-disposition
amount when present. The read computes `S(o)=max(0,A(o),M(o))` as accounted spend,
`O(o)=max(0,E(o)-S(o))` as outstanding exposure, and `C(o)=S(o)+O(o)` as the committed
contribution. A known `A(o)` is always displayed as a provider-charge annotation, even when
`M(o)` controls `S(o)` or unresolved execution means `E(o)` remains larger. This formula prevents
the same known charge from appearing inside both addends while preserving six's conservative
total. A partial settlement later refined to final replaces that operation's current input. Equal
replay adds nothing. A conflict makes the total partial.

A restart fixture reserves 100 and records an unchanged signed application charging 20. Failed
requalification or unmet original durability exposes the charge only as historical and reports
`S=0`, `O=100`, `C=100` with one unresolved operation. Successful requalification with required
durability and proved quiescence reports `S=20`, `O=0`, `C=20` and 80 released. Successful
requalification without quiescence, including an `Outcome.uncertain` case and a final-charge case
where delayed execution remains possible, reports the known provider charge 20, `S=20`, `O=80`,
`C=100`, zero released and one unresolved operation. It reports neither 20 nor 120 as the
committed total.

The conservative maximum disposition is a separate tracked extension. Before it, the maximum is
outstanding exposure. After the requested five/six/eight seam applies it, the same maximum moves
to maximum-disposition spend, outstanding exposure becomes zero, and the committed total is
unchanged. A later provider charge at or below that maximum remains a known-charge annotation and
does not add again; a charge above it becomes the controlling accounted amount and carries
`capViolation`. That disposition releases no headroom and proves nothing about execution
completion or safe repetition. Every actual charge is recorded in full, never clipped. Seven's
`JudgmentHoldCost` is observational evidence about waiting and is never added again. The view
retains manifest-derived amount as comparison. Subsidy, credit or subscription allocation is a
reporting adjustment with its own source and scope and cannot reduce six's exposure or reopen cap
headroom.

**Rule — subscription access is never presented as free.** Rules 26, 39, 41 and 86; **checks:
P16-NF-17/20**. A doorway billed by subscription displays `not per-call settled`, its observed
tokens and quota state. If the operator has supplied a governed allocation policy, the view may
also display an allocated subscription cost with the complete formula, period and basis. That
allocation stays separate from provider settlement and cap enforcement. With no policy, cost is
unknown at call level rather than zero. The 1.x formula divides a declared monthly door price by
30.4375 average Gregorian days and multiplies by an active-day count, but its result is grain-
dependent: it regroups daily buckets before collecting active dates. Day grain therefore counts
the original daily buckets, while month and total grain retain only each model's first regrouped
bucket date and may undercount the door's actual active days. With one $304.375 monthly door, two
active UTC days and two models active on both days, 1.x reports $20.0000 at day grain but $10.0000
at month and total grain. Migrated reports keep those values only as labelled legacy evidence.

The 2.0 calendar allocation corrects the defect by counting the door's distinct original active
UTC calendar days before any display regrouping. The same example therefore yields $20.0000 at
day, month and total grain. This corrected result is not described as byte-compatible 1.x output.
The complete derivation is displayed. The door-level amount may appear beside each model row for
context, but the total counts it exactly once across every model using that door. Any token-share
allocation approved for 2.0 is a separately labelled additional view or an explicit policy
replacement; it cannot silently replace this calendar view or be presented as provider billing.

**Rule — routing-spend surfaces disclose their horizon and completeness.** Rules 26, 32, 39, 41,
69, 86 and 113; **checks: P16-NF-10/16–20/36–38/48**. Hour, day, feature, model, doorway, account,
machine, benchmark and run slices derive from the same pinned joins and the family-specific
membership sources in section 2. Every request declares `[start, end)`, its clock basis and an
explicit evaluation-clock `Measurement`; freshness, evidence-horizon endpoints and detail-horizon
selection use that value rather than an ambient clock. Every response includes the causal
frontier, register and price-manifest generations, source-history and source-projection digests,
evaluation clock, requested and available time
ranges, coverage counts, partial peers, conflicts, projection folded-through vector, last
successful rebuild and whether settlement is final. A reporting total and an authoritative
committed liability are never collapsed into one number.

The response has two independently labelled sections. `historicalPresentation` is a bounded,
deterministic read over `sourceProjection` plus the exact current source history input from which
that projection was folded. The source is part two's pure fold of the owner-issued snapshot at the
frontier that fold actually reached and the register generation, with
`retention: 'all-identities'`; it takes no query, manifest or clock input and drops no identity
because a display window moved. The presentation reads envelope clocks,
machine/principal/provenance, predecessors and status evidence only from the separately supplied
source history input. It then applies the pinned manifest generation, query parameters, membership
rules, detail horizon and evaluation clock. Equal still-current source-history bytes and digest,
source-projection bytes and other presentation inputs produce byte-equal canonical rows.
Its optional detail cache is disposable, finite and non-authoritative;
eviction changes neither the projection nor the result rebuilt from it.

Here `historicalPresentation` describes rows grouped by historical occurrence time at the current
frontier. It is not authority from a former frontier. Once the store advances, the old input set is
no longer executable through the owner port; only an already completed render may remain as
labelled audit evidence.

`liveAccounting` is present only after the requested six-owned read seam lands. It is a pure
presentation of the exact owner-issued `AdmissionAccountingView` observations captured for the
query, including their read-operation ids, host incarnations, accounting revisions,
qualification/durability evidence, canonical digests and the same evaluation clock. Replaying
those exact view bytes produces byte-equal live-accounting rows. Re-running the owner read may
lawfully change that section after restart, qualification loss or restoration, durability change
or clock advancement. It does not alter the source projection or historical presentation and
does not make an earlier signed application current. P16-NF-36 compares source-projection bytes
only while the exact owner-issued source snapshot remains current and the register generation is
equal, compares `historicalPresentation` bytes for that same executable source-history/projection
input and equal presentation inputs and, when a live input set is supplied, compares the
`liveAccounting` bytes for that exact set. It separately proves that a history advance invalidates
the old snapshot/view and that a fresh owner read succeeds. It never compares two different live
observations as though their inputs were equal.

---
