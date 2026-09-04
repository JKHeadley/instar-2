# Changelog — `06-the-fact-envelope.md`

_Generated from `06-the-fact-envelope.changelog.json` by `scripts/render-changelog.mjs` — do not edit by hand._
The document itself reads as a first version; every change to it is recorded here, newest first,
each linked to the git change that made it (rule 91).

## Revision 8 · 2026-09-04 · draft — operator answers, round one: question 2 confirmed with a scope direction

- **The scope of the operator's explicit yes is stated so it cannot inflate: only versions of governing things demand one; ordinary work merges on green with no human approval, and operator approval is designed to be rare.** — The operator confirmed the two-anchor reading of rule 90 and directed that approval must not become a routine step on every pull request. _(topic 52075, operator message 2026-09-04 16:29 PDT)_

## Revision 7 · 2026-09-04 · draft — operator review on PR #16; review desk round 6 (final) — internal confirmation: zero findings, converged; the external reviewer's five minor items folded editorially

- **Replication-path facts with a newer schema version hold in the pending set until schema support arrives, instead of terminally refusing mid-rolling-upgrade.** — An older machine receiving a valid future-schema fact from an upgraded peer is seeing an upgrade in progress, not corruption. _(review desk round 6, external finding 1)_
- **The operator lineage-close is a minimal-plane operation verified against the genesis anchor, independent of the authority projection it unblocks.** — Freeing authority reads from a dead machine's lineage must not depend on the projection that lineage is blocking. _(review desk round 6, external finding 2)_
- **The admission ladder's two ports are named — authorAndAppend constructs, verifyAndAdmit verifies — sharing decoders, reasons, and rungs.** — Local append and replication receipt trust and generate different fields; naming the split prevents an implementer conflating them. _(review desk round 6, external finding 3)_
- **Capture-referencing reads carry captureStatus (available / tombstoned / expired / missing); a bare historical hash is never presented as live evidence.** — After redaction or expiry the hash proves only the identity of unavailable bytes. _(review desk round 6, external finding 4)_
- **Effect bounding joins part one's language capability floor.** — The projection-purity lint is beyond a best-effort grep in most languages; the toolchain requirement is stated rather than assumed. _(review desk round 6, external finding 5)_

## Revision 6 · 2026-09-04 · draft — operator review on PR #16; review desk round 5 — internal: zero design findings, converged; external dropped to minor; residuals folded

- **Origin-only frontier honesty check: a fact whose declared frontier omits a relevant revocation head its own machine had folded refuses at origin (P2-NF-77); receivers never re-run it.** — Omitting what the appender provably held was the one way left to write an honest-looking fact around a known revocation. _(review desk round 5, external finding 1)_
- **P2-NF-49/50 are enforced by an import-and-effect lint (pure except own storage/checkpoints), not implied by the fold signature.** — A signature convention alone cannot exclude ambient stores, clocks, files, globals, or network. _(review desk round 5, external finding 2)_
- **A host that does not sign review events yields only channel-attested records, which cannot anchor a protected artifact — a refusal, not a downgrade; at-rest access control for replicated stores is explicitly part ten's requirement; the causal frontier is declared exactly once (the cone is the predecessors closure); provisional marks are homed in the fact-store register row; a lifecycle table walks every state a standing-gated fact can occupy.** — Round-5 external findings 3-5 and the internal round's two precision pins. _(review desk round 5)_

## Revision 5 · 2026-09-04 · draft — operator review on PR #16; review desk round 4 — first quiet internal round (all round-3 closures verified); residual lifecycle + external refinements folded

- **The provisional marker's full lifecycle: scoped to the fact's named grant scopes, homed as machine-local sidecar state, level-triggered clearing at the staleness horizon (P2-NF-75).** — A marker with an asserted but unspecified lifecycle would be built ad hoc. _(review desk round 4, internal F4-1)_
- **Taint is a fold primitive: provisional / contested / evidence-unavailable propagates into every derived view or authority output refuses (P2-NF-76); redaction dependencies ride the same taint.** — Contested authority must not launder into a clean-looking answer through any projection. _(review desk round 4, external findings 1 and 4)_
- **predecessors carries a compact causal frontier (one (epoch, position) pair per machine lineage — bounded by machine count); the crash-only failure model with the compromised-key Byzantine case is stated; a happy-path walkthrough precedes the ladder.** — Per-fact causal metadata must not grow with history; substrate assumptions were semantic, not implementation detail. _(review desk round 4, external findings 2, 3, 5)_

## Revision 4 · 2026-09-04 · draft — operator review on PR #16; review desk round 3 — all round-2 closures verified; remaining findings localized to the standing machinery

- **Rung 9 standing is a deterministic function of the fact's declared causal cone — identical verdict on every replica; an out-of-cone revocation routes to reconciliation, never an ingest refusal; causal references resolve before standing so an unresolved grant holds instead of terminally refusing.** — Two honest replicas must never disagree about admissibility, and an ordering accident must not quarantine an honest stream. _(review desk round 3, internal D1/D2)_
- **Partition-admitted authority is marked provisional and feeds no irreversible effect (P2-NF-73); merge classes are declared per folded kind including cap-checked aggregates (P2-NF-74); the reconciliation predicate, appender, and dedup key are pinned; the genesis segment's out-of-band anchor is named; the bounded-suffix read-through interface is fixed; a worked partition example added.** — Round-3 external findings 1-5 and internal D3-D6 with the precision sweep. _(review desk round 3)_

## Revision 3 · 2026-09-04 · draft — operator review on PR #16; review desk round 2 — all round-1 closures verified; the high cluster: time base, genesis, key lifecycle

- **Standing resolves at causal position, never the appender's clock; the minimal plane bootstraps the first grants and keys; key validity windows are segment-position ranges with compromise quarantine (P2-NF-69/70); the partition carve-out (append within locally-provable standing, retroactive conflict flagging); incumbent-stays-in-force fork degradation with idempotent replay collapse (P2-NF-71/72).** — An adversary who cannot beat the steady state goes for the time base, the genesis, and the keys. _(review desk round 2, security N1-N5)_
- **Redaction bounded to closed reasons with protected references, a delay window, and at-rest honesty; segment lineage/epochs for the folded-through vector; the admission ladder reordered (hash before signature, parse phase named); register growth values on the closed list with standards/status columns; retraction requires a reason (P2-NF-68); rule-112 verdict honest; ten operator questions.** — Round-2 external findings and the rules-conformance partials (69, 112). _(review desk round 2)_

## Revision 2 · 2026-09-04 · draft — operator review on PR #16; review desk round 1 — external GPT-tier reviewer plus security, adversarial, scalability, rules-conformance: ~80 findings; full rewrite

- **The envelope gains signature and pinned provenance (integrity vs authenticity separated); admission gains a standing rung so appending cannot mint authority; retraction and correction are standing-gated; the version chain's two anchors (approvedIn = explicit-yes review record, landedIn = merge commit) replace the merge-commit anchor that contradicted part one; projections must be commutative over concurrent facts; refusals retain metadata only; checkpoints, durability states, growth instruments, the per-rule discharge table, and staged P2-NF fixtures.** — The first draft had integrity without authenticity, an authority-free write port, and an approval anchor the agent itself could produce. _(review desk round 1)_

## Revision 1 · 2026-09-04 · draft — initial draft: the fact envelope, the version chain, and the projection contract

- **First complete draft of part two.** — Next part in the dependency order after part one's approval. _(docs/04-the-big-picture.md section 13)_
