# Change review — Carryover 95 partial source adaptation; production composition open

Subject base: 990678d5996737c1fd13d8a49b4e0c9a1045d196
Review state: open
Reviewed content: none
Outcome: Partial source preservation and adaptation; whole row95 is incomplete and remains OPEN. This is not a readiness submission.
Affected rules: 1, 7, 12, 26, 27, 32, 33, 41, 44, 45, 55, 58, 60, 63, 74, 75, 84, 95, 101, 102, 109, 111, 113, 116, 118.
Affected floors: secrets — shared recall redaction and secret-path exclusion; spend cap — authoring only through existing SessionWorkPort, not a provider; stop — before work and after awaits; no duplicate sends — no send path; durable intake — append-only observations through existing signed FactStore.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: New recall source and model-facing authoring composition need independent constitutional review, even though production binding is incomplete.
Side effects: Only branch source, tests and reference evidence change. No installation, root grant, credentials, live model probe, scheduled activation or messages. Tests create disposable Git repositories and fixture fact storage.
Undo and recovery: Revert this branch before installation. Observation facts retain original descriptions and invalidations; the projection is rebuildable. No live store migration has run.
Multi-machine posture: Shared signed observation facts; machine-local projection and freshness against the pinned local revision. Current lease gates authoring. No cross-machine author uniqueness or durable scheduled occurrence is claimed by this partial composition.
Layer below: Checked actual Part Two FactStore/authorAndAppend, Part Ten mediated custody and production-custody-wiring, tool-inventory admission, native harness and production-session-work, scheduled runner intake/startOnce, and awareness RecallPort/grounding. Missing bounded committed-source producer and production consumer/scheduler wiring are recorded in docs/defects/carryover-95-owner-composition.md.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Prompt review: The author question asks for a code description and structured summary, with quoted source context. It contains no fixture-trigger routing or provider-specific exemption. Recorded summary, uncertain/undecided review, delivered reply and empty-reply shapes are replayed as untrusted outputs; acceptance requires covered identifiers and quality observations. This deterministic quality check is not authority or semantic correctness proof.
Deferral: reference/carryover-95/1x/docs/specs/CARTOGRAPHER-SWEEP-EVENTLOOP-SAFETY.md.txt:46 | not-a-deferral=historical 1.x source/spec/test text preserved byte-for-byte; not a new promised task
Deferral: reference/carryover-95/1x/docs/specs/CARTOGRAPHER-SWEEP-EVENTLOOP-SAFETY.md.txt:70 | not-a-deferral=historical 1.x source/spec/test text preserved byte-for-byte; not a new promised task
Deferral: reference/carryover-95/1x/docs/specs/CARTOGRAPHER-SWEEP-EVENTLOOP-SAFETY.md.txt:72 | not-a-deferral=historical 1.x source/spec/test text preserved byte-for-byte; not a new promised task
Deferral: reference/carryover-95/1x/docs/specs/CARTOGRAPHER-SWEEP-EVENTLOOP-SAFETY.md.txt:76 | not-a-deferral=historical 1.x source/spec/test text preserved byte-for-byte; not a new promised task
Deferral: reference/carryover-95/1x/docs/specs/CARTOGRAPHER-SWEEP-EVENTLOOP-SAFETY.md.txt:77 | not-a-deferral=historical 1.x source/spec/test text preserved byte-for-byte; not a new promised task
Deferral: reference/carryover-95/1x/docs/specs/CARTOGRAPHER-SWEEP-EVENTLOOP-SAFETY.md.txt:84 | not-a-deferral=historical 1.x source/spec/test text preserved byte-for-byte; not a new promised task
Deferral: reference/carryover-95/1x/docs/specs/CARTOGRAPHER-SWEEP-EVENTLOOP-SAFETY.md.txt:130 | not-a-deferral=historical 1.x source/spec/test text preserved byte-for-byte; not a new promised task
Deferral: reference/carryover-95/1x/docs/specs/CARTOGRAPHER-SWEEP-EVENTLOOP-SAFETY.md.txt:135 | not-a-deferral=historical 1.x source/spec/test text preserved byte-for-byte; not a new promised task
Deferral: reference/carryover-95/1x/docs/specs/CARTOGRAPHER-SWEEP-EVENTLOOP-SAFETY.md.txt:138 | not-a-deferral=historical 1.x source/spec/test text preserved byte-for-byte; not a new promised task
Deferral: reference/carryover-95/1x/docs/specs/CARTOGRAPHER-SWEEP-EVENTLOOP-SAFETY.md.txt:142 | not-a-deferral=historical 1.x source/spec/test text preserved byte-for-byte; not a new promised task
Deferral: reference/carryover-95/1x/docs/specs/cartographer-sweep-eventloop-safety.eli16.md.txt:22 | not-a-deferral=historical 1.x source/spec/test text preserved byte-for-byte; not a new promised task
Deferral: reference/carryover-95/1x/docs/specs/reports/cartographer-sweep-eventloop-safety-convergence.md.txt:13 | not-a-deferral=historical 1.x source/spec/test text preserved byte-for-byte; not a new promised task
Deferral: reference/carryover-95/1x/docs/specs/reports/cartographer-sweep-eventloop-safety-convergence.md.txt:31 | not-a-deferral=historical 1.x source/spec/test text preserved byte-for-byte; not a new promised task
Deferral: reference/carryover-95/1x/docs/specs/reports/cartographer-sweep-eventloop-safety-convergence.md.txt:74 | not-a-deferral=historical 1.x source/spec/test text preserved byte-for-byte; not a new promised task
Deferral: reference/carryover-95/1x/src/core/CartographerSweepEngine.ts.txt:12 | not-a-deferral=historical 1.x source/spec/test text preserved byte-for-byte; not a new promised task
Deferral: reference/carryover-95/1x/src/core/CartographerSweepEngine.ts.txt:216 | not-a-deferral=historical 1.x source/spec/test text preserved byte-for-byte; not a new promised task
Deferral: reference/carryover-95/1x/src/core/CartographerSweepEngine.ts.txt:290 | not-a-deferral=historical 1.x source/spec/test text preserved byte-for-byte; not a new promised task
Deferral: reference/carryover-95/1x/src/core/CartographerSweepEngine.ts.txt:472 | not-a-deferral=historical 1.x source/spec/test text preserved byte-for-byte; not a new promised task
Deferral: reference/carryover-95/1x/src/core/CartographerSweepEngine.ts.txt:473 | not-a-deferral=historical 1.x source/spec/test text preserved byte-for-byte; not a new promised task
Deferral: reference/carryover-95/1x/src/core/CartographerSweepEngine.ts.txt:474 | not-a-deferral=historical 1.x source/spec/test text preserved byte-for-byte; not a new promised task
Deferral: reference/carryover-95/1x/src/core/CartographerTree.ts.txt:83 | not-a-deferral=historical 1.x source/spec/test text preserved byte-for-byte; not a new promised task
Deferral: reference/carryover-95/1x/src/core/CartographerTree.ts.txt:105 | not-a-deferral=historical 1.x source/spec/test text preserved byte-for-byte; not a new promised task
Deferral: reference/carryover-95/1x/src/core/CartographerTree.ts.txt:533 | not-a-deferral=historical 1.x source/spec/test text preserved byte-for-byte; not a new promised task
Deferral: reference/carryover-95/1x/src/core/CartographerTree.ts.txt:658 | not-a-deferral=historical 1.x source/spec/test text preserved byte-for-byte; not a new promised task
Deferral: reference/carryover-95/1x/src/core/CartographerTree.ts.txt:669 | not-a-deferral=historical 1.x source/spec/test text preserved byte-for-byte; not a new promised task
Deferral: reference/carryover-95/1x/src/core/CartographerTree.ts.txt:676 | not-a-deferral=historical 1.x source/spec/test text preserved byte-for-byte; not a new promised task
Deferral: reference/carryover-95/1x/src/core/CartographerTree.ts.txt:687 | not-a-deferral=historical 1.x source/spec/test text preserved byte-for-byte; not a new promised task
Deferral: reference/carryover-95/1x/src/core/CartographerTree.ts.txt:729 | not-a-deferral=historical 1.x source/spec/test text preserved byte-for-byte; not a new promised task
Deferral: reference/carryover-95/1x/src/core/cartographerDetect.ts.txt:19 | not-a-deferral=historical 1.x source/spec/test text preserved byte-for-byte; not a new promised task
Deferral: reference/carryover-95/1x/src/core/cartographerDetect.ts.txt:73 | not-a-deferral=historical 1.x source/spec/test text preserved byte-for-byte; not a new promised task
Deferral: reference/carryover-95/1x/src/core/cartographerDetect.ts.txt:87 | not-a-deferral=historical 1.x source/spec/test text preserved byte-for-byte; not a new promised task
Deferral: reference/carryover-95/1x/src/core/cartographerDetect.ts.txt:568 | not-a-deferral=historical 1.x source/spec/test text preserved byte-for-byte; not a new promised task
Deferral: reference/carryover-95/1x/src/core/cartographerDetect.ts.txt:583 | not-a-deferral=historical 1.x source/spec/test text preserved byte-for-byte; not a new promised task
Deferral: reference/carryover-95/1x/src/core/cartographerDetect.ts.txt:585 | not-a-deferral=historical 1.x source/spec/test text preserved byte-for-byte; not a new promised task
Deferral: reference/carryover-95/1x/src/core/cartographerDetect.ts.txt:606 | not-a-deferral=historical 1.x source/spec/test text preserved byte-for-byte; not a new promised task
Deferral: reference/carryover-95/1x/src/core/cartographerDetect.ts.txt:627 | not-a-deferral=historical 1.x source/spec/test text preserved byte-for-byte; not a new promised task
Deferral: reference/carryover-95/1x/src/core/cartographerDetect.ts.txt:628 | not-a-deferral=historical 1.x source/spec/test text preserved byte-for-byte; not a new promised task
Deferral: reference/carryover-95/1x/src/core/cartographerPopulation.ts.txt:88 | not-a-deferral=historical 1.x source/spec/test text preserved byte-for-byte; not a new promised task
Deferral: reference/carryover-95/1x/tests/unit/cartographerDetect.test.ts.txt:12 | not-a-deferral=historical 1.x source/spec/test text preserved byte-for-byte; not a new promised task
Deferral: reference/carryover-95/1x/tests/unit/cartographerDetect.test.ts.txt:145 | not-a-deferral=historical 1.x source/spec/test text preserved byte-for-byte; not a new promised task
Deferral: reference/carryover-95/1x/tests/unit/cartographerDetect.test.ts.txt:220 | not-a-deferral=historical 1.x source/spec/test text preserved byte-for-byte; not a new promised task
Deferral: src/recall/cartographer/contracts.ts:58 | not-a-deferral=runtime sweep defer counter or disposition, not a postponed engineering promise
Deferral: src/recall/cartographer/service.ts:61 | not-a-deferral=runtime sweep defer counter or disposition, not a postponed engineering promise
Deferral: src/recall/cartographer/service.ts:149 | not-a-deferral=runtime sweep defer counter or disposition, not a postponed engineering promise
Deferral: src/recall/cartographer/service.ts:171 | not-a-deferral=runtime sweep defer counter or disposition, not a postponed engineering promise
Deferral: src/recall/cartographer/service.ts:173 | not-a-deferral=runtime sweep defer counter or disposition, not a postponed engineering promise
Deferral: src/recall/cartographer/service.ts:213 | not-a-deferral=runtime sweep defer counter or disposition, not a postponed engineering promise
Deferral: src/recall/cartographer/service.ts:217 | not-a-deferral=runtime sweep defer counter or disposition, not a postponed engineering promise
Deferral: src/recall/cartographer/tree.ts:21 | not-a-deferral=runtime sweep defer counter or disposition, not a postponed engineering promise
Deferral: src/recall/cartographer/tree.ts:51 | not-a-deferral=runtime sweep defer counter or disposition, not a postponed engineering promise

Subject (65 paths): docs/defects/carryover-95-owner-composition.md, reference/carryover-95/1x/docs/specs/CARTOGRAPHER-CONFORMANCE-AUDIT.md.txt, reference/carryover-95/1x/docs/specs/CARTOGRAPHER-DOC-FRESHNESS.md.txt, reference/carryover-95/1x/docs/specs/CARTOGRAPHER-DOC-TREE-SCHEMA.md.txt, reference/carryover-95/1x/docs/specs/CARTOGRAPHER-SUBTREE-NAV.md.txt, reference/carryover-95/1x/docs/specs/CARTOGRAPHER-SWEEP-EVENTLOOP-SAFETY.md.txt, reference/carryover-95/1x/docs/specs/cartographer-conformance-audit.eli16.md.txt, reference/carryover-95/1x/docs/specs/cartographer-doc-freshness.eli16.md.txt, reference/carryover-95/1x/docs/specs/cartographer-doc-tree-schema.eli16.md.txt, reference/carryover-95/1x/docs/specs/cartographer-subtree-nav.eli16.md.txt, reference/carryover-95/1x/docs/specs/cartographer-sweep-eventloop-safety.eli16.md.txt, reference/carryover-95/1x/docs/specs/reports/cartographer-doc-freshness-convergence.md.txt, reference/carryover-95/1x/docs/specs/reports/cartographer-doc-tree-schema-convergence.md.txt, reference/carryover-95/1x/docs/specs/reports/cartographer-sweep-eventloop-safety-convergence.md.txt, reference/carryover-95/1x/src/core/CartographerNavigator.ts.txt, reference/carryover-95/1x/src/core/CartographerRootAuthority.ts.txt, reference/carryover-95/1x/src/core/CartographerRootRegistry.ts.txt, reference/carryover-95/1x/src/core/CartographerSweepEngine.ts.txt, reference/carryover-95/1x/src/core/CartographerTree.ts.txt, reference/carryover-95/1x/src/core/ProjectMapper.ts.txt, reference/carryover-95/1x/src/core/cartographerDetect.ts.txt, reference/carryover-95/1x/src/core/cartographerDetect.worker.ts.txt, reference/carryover-95/1x/src/core/cartographerDetectWorker.ts.txt, reference/carryover-95/1x/src/core/cartographerPopulation.ts.txt, reference/carryover-95/1x/src/core/cartographerSummary.ts.txt, reference/carryover-95/1x/src/core/liveTailRedaction.ts.txt, reference/carryover-95/1x/src/core/skipDirs.ts.txt, reference/carryover-95/1x/src/monitoring/CartographerSweepPoller.ts.txt, reference/carryover-95/1x/tests/e2e/cartographer-dev-gate-lifecycle.test.ts.txt, reference/carryover-95/1x/tests/e2e/cartographer-freshness-lifecycle.test.ts.txt, reference/carryover-95/1x/tests/e2e/cartographer-lifecycle.test.ts.txt, reference/carryover-95/1x/tests/e2e/cartographer-navigate-lifecycle.test.ts.txt, reference/carryover-95/1x/tests/integration/cartographer-eventloop-worker.test.ts.txt, reference/carryover-95/1x/tests/integration/cartographer-navigate-route.test.ts.txt, reference/carryover-95/1x/tests/integration/cartographer-refresh-route.test.ts.txt, reference/carryover-95/1x/tests/integration/cartographer-root-registry.test.ts.txt, reference/carryover-95/1x/tests/integration/cartographer-routes.test.ts.txt, reference/carryover-95/1x/tests/unit/PostUpdateMigrator-cartographerDevGate.test.ts.txt, reference/carryover-95/1x/tests/unit/cartographer-freshness-ratchet.test.ts.txt, reference/carryover-95/1x/tests/unit/cartographer-ls-tree-stream.test.ts.txt, reference/carryover-95/1x/tests/unit/cartographer-navigator.test.ts.txt, reference/carryover-95/1x/tests/unit/cartographer-root-authority.test.ts.txt, reference/carryover-95/1x/tests/unit/cartographer-summary.test.ts.txt, reference/carryover-95/1x/tests/unit/cartographer-sweep-engine.test.ts.txt, reference/carryover-95/1x/tests/unit/cartographer-sweep-poller-breaker.test.ts.txt, reference/carryover-95/1x/tests/unit/cartographer-sweep-routing.test.ts.txt, reference/carryover-95/1x/tests/unit/cartographer-tree.test.ts.txt, reference/carryover-95/1x/tests/unit/cartographerDetect.test.ts.txt, reference/carryover-95/adaptation-lines.json, reference/carryover-95/manifest.json, reference/carryover-95/wiring-manifest.json, reference/carryover-95/wiring/src-commands-server.ts.txt, reference/carryover-95/wiring/src-server-routes.ts.txt, src/recall/cartographer/README.md, src/recall/cartographer/contracts.ts, src/recall/cartographer/index.ts, src/recall/cartographer/navigator.ts, src/recall/cartographer/service.ts, src/recall/cartographer/summary.ts, src/recall/cartographer/tree.ts, tests/recall/cartographer/bounds.test.ts, tests/recall/cartographer/git-fixture.ts, tests/recall/cartographer/navigator.test.ts, tests/recall/cartographer/service.test.ts, tests/recall/cartographer/summary.test.ts

Decision: C95-baseline | Preserve all discovered Cartographer source/spec/test originals before adaptation, with byte hashes and exact line correspondence. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-95-cartographer-1105-PROGRESS.md
Decision: C95-budget | Charge root, sibling and path-peek reads before access; cache missing reads and obey depth before peeking. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-95-cartographer-1105-PROGRESS.md
Decision: C95-owners | Use existing FactStore, SessionWorkPort and Awareness RecallPort; a new source interface alone does not prove production custody. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-95-cartographer-1105-PROGRESS.md
Decision: C95-defaults | Restore the 1.x production authoring and quality defaults; discard the private default-framework routing ban in favor of the admitted session owner. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-95-cartographer-1105-PROGRESS.md
Decision: C95-scope | Keep the entire carryover OPEN because scoped committed-source, durable sweep, detect-worker and production consumer composition remain unfinished. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-95-cartographer-1105-PROGRESS.md
Deferral: docs/defects/carryover-95-owner-composition.md:24 | commitment=docs/defects/carryover-95-owner-composition.md


## 1.x comparison and exact carryover

Assigned original: JKHeadley/instar `4f88880a45f0a119aae3cfd2ccaf9ace26d405b9`.
Inspected actual main `154a09ffd`, Cartographer history at `2aaac4288`, the canonical
carryover/reconciled snapshots and ONEX-LESSONS memory/coherence area. D21 section11
retains both the source and bounded consumer; copies alone do not complete it.

`reference/carryover-95/manifest.json` identifies 47 complete raw source/spec/test
files, every line and byte hash. `wiring-manifest.json` pins the exact producer
(server.ts:17327–17515) and route consumer (routes.ts:8984–9333) excerpts.
`adaptation-lines.json` maps every exact retained block: contracts 65/74 lines,
navigator 457/516, summary helpers 172/181, navigator tests 295/299, summary tests
100/104. The remaining lines in those files and tree/service/bounds/service tests
are new adaptation, not falsely claimed verbatim carryover. Original navigation
scores and summary heuristics survive; hidden peeks below the depth limit do not.

2.x's model admission owns routing/resources/stop/spend, so the 1.x private routing
ban is not copied as authority. Part Two owns originals instead of overwriteable
summary files. No missing feature is claimed superseded: full root selection,
committed source custody, off-thread detect/revalidation, full health snapshots,
inline refresh, durable scheduling, migrations and live use remain in the OPEN
owner-composition record. Fixtures are component evidence, not live installation.

Verification: targeted four test files include the 1.x 19 navigation/14 summary
assertions and owner/bounds/recorded-shape tests. build/typecheck/architecture,
register and change-review results are reported in the remote handoff. Independent
review, combined full/native gates and installed/live proof are still required.

## Closing block

simplestRobustRoute: Carry actual 1.x source and tuned navigation, then compose existing custody, session and awareness owners; do not create a private timer or permission registry.
80/20: Preserve the tested bounded reader and append-only observations now, while leaving full source-owner, worker and installed-consumer completion explicitly open.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
