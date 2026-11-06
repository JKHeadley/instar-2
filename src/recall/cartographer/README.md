# Cartographer carryover 95 — partial implementation

The raw source baseline is JKHeadley/instar
`4f88880a45f0a119aae3cfd2ccaf9ace26d405b9`. Complete source/spec/test files and their
line counts and byte hashes are in `reference/carryover-95/`. This directory is a
partial adaptation. Row95 remains OPEN; it is not an installed capability.

| Module | Source behavior and adaptation |
|---|---|
| contracts.ts | Original CartographerTree node metadata, code identity and authoring counters. |
| summary.ts | Original secret-path patterns, identifier extraction, quality observations, neutralization and quoting. Reuses recall redaction; escapes tags/labels; injects the hash function. |
| navigator.ts | Original scoring weights, two-phase directory scoring, path peek, collapse, defaults and OID comparison. Charges all node reads including peeks, validates bounds, and reports actual reads and omitted direct edges. |
| tree.ts | Part Two append-only observation facts and a root-specific rebuildable projection. Earlier descriptions and invalidations survive projection rebuild. Source references still require original-content custody at the source owner. |
| service.ts | Partial source-page/session-work composition and Awareness RecallPort consumer. Fixture tests pass its exact evidence manifest into the real buildGrounding renderer. |

A deterministic rank is a code-map suggestion. A matching OID means fingerprint-current,
not correct. Every summary is untrusted. Tree observation and authoring confer no authority.
The source owner must admit root, requester, disclosure destination and committed revision.
The old default-framework ban is not carried into the model-work interface.

Facts use Part Two's shared custody. The projection is machine-local and rebuildable.
Freshness refers to the source owner's pinned local revision, not a peer's fresh label.
This code starts no timer, changes no grants, sends no messages and calls no provider API.

The source-read budget in navigation is tested independently from output size. Fact-store
replay at construction and the underlying fact author/append still read whole stores.
The projection now consumes the signed append receipt without an extra readback scan. These are not
claimed to satisfy production bounded custody. The partial sweep also lacks full cross-page
ordering, freshness aggregates, revalidation and durable scheduler binding. Exact remaining
work and inspected owner contracts are in `docs/defects/carryover-95-owner-composition.md`.

Tests under `tests/recall/cartographer/` retain the 1.x summary/navigation assertions,
including real temporary Git repositories, and add actual-read bounds, custody/rebuild,
freshness, grounding consumption and recorded-shape rejection. No live activation is claimed.

Production source composition lives in `src/assembly/production-cartographer-source.ts`
and `production-cartographer.ts`, connected by `production-composition.ts`. The host
producer is `scripts/cartographer-committed-source.mjs`; it reads only a pinned Git
commit after exact-root admission. Capture stores complete permitted originals using
real exact persistence receipts and mediated custody, then feeds the existing
Awareness consumer. A capture is limited to 4096 entries and 2 MiB; it does not
replace the original large-tree detect worker. Shared persistence and FactStore
traversal limits remain open as documented in the defect record. No installed
configuration, root grant or existing-install migration is supplied by construction.
