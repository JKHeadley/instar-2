# Change review — Codex model map evidence renewal

Subject base: 1c8432b32c21f02aca6c1f28476cb4b1146f36ba
Review state: open
Reviewed content: none
Outcome: Renew the expired Codex model-map observation from a fresh CLI catalog, retaining its model, finite freshness window and estimated subscription subsidy; regenerate the register from committed source.
Affected rules: 26, 36, 37, 49, 56, 70, 74, 95, 101, 102, 107, 111, 112, 113, 116
Affected floors: secrets — public catalog fields only; spend cap — no inference and no limit changes; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: Evidence renewal and derived publication only; executable code and routing policy are unchanged.
Side effects: The existing Rule 56 check admits the reviewed catalog for the same finite interval from its actual fetched time. The subsidy remains explicitly estimated, never upgraded to measured. No model activation or native conformance claim is renewed.
Undo and recovery: Revert the declaration and capture, then regenerate publication through the existing tools; stale evidence must again refuse. Preserve failed gate evidence and historical commits.
Multi-machine posture: The CLI catalog was observed on Mama PC; the public projection and declaration are shared through git. It does not assert another machine's login, activation, inference or native conformance is healthy.
Layer below: Read the full purpose and rule book from origin/main, Rule 56 modelEntryFresh/checkDeadlines, the declaration and existing subscription route, Codex CLI catalog, 1.x merged registry reader and scan contract. A catalog listing is availability evidence, not a successful inference.
Bug class: none
Bug evidence: Supplied fast-train-188-1c8432b3 log reports model map stale for preview-subscription-codex. The new public projection retains fetchedAt, clientVersion and the exact listed model fields; no authentication identity, instructions or credentials are copied.
Hook bypass: none
Convergence: none

1.X FIRST: Searched actual JKHeadley/instar origin/main bc4355b8075dad89e8667ab082c526c0460b0455 src/, docs/specs/ and history for model-map freshness. Read src/core/DoorwayRegistryReader.ts, scripts/doorway-scan.mjs probeCliDoor, scripts/model-registry-freshness.manifest.json Codex row, docs/specs/model-registry-freshness-guard.eli16.md and matching DOORWAY-MODEL-KNOWLEDGE-REGISTRY-SPEC passages. History: 35b02553b (fresh scan state), c12128176 (merged reader), e42db45df (prober), dfdd69e1d (derived frontier). Read ONEX-LESSONS sections 4 and 6. Fit: preserve evidence freshness and distinguish model catalog from inference/reachability. Mismatch: the 1.x filesystem/scan-state reader is not the 2.0 typed immutable declaration; reuse the existing 2.0 Rule 56 age check and publication, with a current public catalog projection rather than new machinery or a timestamp-only assertion. Inherited train-188 census/cache comparisons remain in existing reviews.

Decision: train-188-catalog-renewal | Use the fresh CLI catalog for the unchanged registered model; preserve its freshness window and estimated subsidy, without a model call or fabricated activation proof. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-188-repair-203545-PROGRESS.md
Decision: train-188-gate-publication | Regenerate through existing desk repin and register replay; preserve the original failing gate log and leave unmodified host-dependent tests to the Studio. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-188-repair-203545-PROGRESS.md

Verification: typecheck and build passed; 42 targeted tests passed across catalog freshness, declaration contracts and Codex adapter recorded-shape coverage. Desk repin changed zero pins. Register replay from exact source 1ec6b6266f878318759d4b0dd3a8f3e043d3f3bd generated sha256:2a4a586bf9946c89f6006c764a3dffccc7ab0ecdc9d5577552d5c9199b629c01 (298 entries, 121 rules; shape-only). The original Studio test failures remain in the repair report for gate rerun.

## Closing block

simplestRobustRoute: This is the simplest robust route: inspect current catalog evidence, renew the existing declaration and replay publication. No new refresh service, looser age check, longer window or routing change. Existing malformed/stale/future evidence refusals, authority, stop and resource guards remain enforced. This is a source handoff, not autonomous runtime acceptance.
80/20: Targeted catalog-age boundary, nested declaration and Codex adapter tests plus typecheck/build and the required cheap gates; full-suite and macOS acceptance remain with the Studio pipeline.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
