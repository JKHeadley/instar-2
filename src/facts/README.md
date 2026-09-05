# Fact contracts

Implementation of `docs/06-the-fact-envelope.md`. Imports constitutional values and decoders through the part-one public package entry. The public fact surface is `@instar/constitutional-types/facts`; projections are exposed at `@instar/constitutional-types/projections`.

`envelope.ts` validates canonical content hashes, Ed25519 signatures, key-position windows and origin identity. `admission.ts` selects causal history, checks standing, validates registered body fields through part one, and gates repairs. `contracts.ts` holds only part-two records and named provider ports. `boundary.ts` adapts part one's extension-decoder framework without constructing Result or constitutional values locally.

`store.ts` exposes an append-only port over a part-ten durable-storage adapter. `stores.ts` contains bounded refusal metadata and pending replication holds. `captures.ts` validates delayed, operator-authorized capture tombstones. `version-chain.ts` validates approval/base/landing bindings and keeps the reviewed incumbent during a fork. `../projections/fold.ts` folds a closed data-only projection definition, preserving conflicts, correction pairs, retractions, exact quantities, causal vectors and authority taint.

No database or replication transport is selected here. Storage, host/git resolutions, the minimal-plane trust root, scheduling and network transport remain explicit provider ports. A RAM test double is not advertised as local durability. Historical reconstruction consumes part one's origin-pinned reader; its repair is being coordinated with lane one.

Reversible implementation choices: schema-1 hashes use part one's canonical JSON and SHA-256; envelope signatures sign the UTF-8 `sha256:...` hash string. Clock fold keys use signed Unix milliseconds shifted into a fixed-width unsigned 64-bit encoding. Exact quantities are signed decimal integer strings in declared minor units. Projection folds are a closed data language rather than arbitrary callbacks, which prevents ambient effects structurally.

Causal admission time is the maximum operator-governed time anchor within the fact's declared cone, with the installation-pinned genesis clock as the base case. Neither the appender's `at` nor the receiver clock determines authority. In-cone revocation is causally effective even if its testimony clock is ahead of an anchor. The minimal-plane provider must admit the anchor facts before providing them.

Multi-machine posture: signed fact histories are shared; each machine owns its lineage. Pending/refusal stores and projection caches are machine-local. No fact deletion port exists. Replay uses the original bytes and does not rewrite schemas in place.

Side effects and rollback: additive package subpaths and contract implementations only; no running Instar 1.x state, deployed hooks or installed agent configuration changes. Removing the new subpaths and reverting the implementation commits restores the prior package. No migration is required for uninstalled source modules.

Verification: numbered P2 tests live under `tests/facts/` and `tests/projections/`; integration and fresh-process tests exercise the public entry points. The completion note records any checks awaiting a named provider and the actual executed check map. The independent review desk, not this builder, determines convergence.
