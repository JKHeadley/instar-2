# Change review — train-8 accurate outward-action self-description

Subject base: db78988f1e562b8099698ab7950e42b8002843a9
Review state: open
Reviewed content: none
Port provenance: Four authorized picks onto inrole-act-live; this record retains original train-8 evidence. Current branch-specific evidence and decisions are in selfdesc-unit-1011-change-review.md.
Outcome: Self-description includes listed outward actions as abilities under the granted role. Missing grants are described as authority conditions, with the needed grant named, rather than blanket inability or a new approval on every action. The existing shared capability rendering and trusted answer instructions deliver the same guidance.
Affected rules: Purpose identity/self-knowledge, limits name their source, role granted at onboarding; 18, 34, 36, 47, 49, 70, 74, 78, 84, 101, 103, 104, 111, 113, 116
Affected floors: secrets — custody and enforcement unchanged; spend cap — attempts and expiry unchanged; stop — enforcement unchanged; no duplicate sends — delivery state unchanged; durable intake — journal and causal records unchanged
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: model-facing wording and delivery through existing answer instructions; no capability, authority, parser, effect, model routing or persistence change
Side effects: capability-note and instruction bytes/hashes grow; context-floor and direct importer checks cover fitting and boundary parity. Historical captures remain immutable, with explicit identity-only translations. The wording is application guidance and confers no grant. Generated feature descriptions, toolsBriefing, MCP count, custody limits, runtime limits and judge rubric are unchanged.
Undo and recovery: revert briefing, affected assertions and replay fixture together; regenerate register source pins. No journal migration or authority rollback is needed.
Multi-machine posture: repository-shared wording on every machine; no new state, owner, transport or replication behavior
Layer below: sourcePacket and capabilityBriefing inventory/provenance; prepareJournalEnvelope trusted instructions versus quoted context; unchanged toolsBriefing and generated/capabilities.json inventory; actual recorded tool-turn prompt and the unchanged provider system prompt; current doorway and standing grants remain authoritative
Bug class: integration
Bug evidence: reproducer=tests/preview/selfdesc-abilities.test.ts
Hook bypass: none; core.hooksPath checked unset and common hooks directory contains samples only
Convergence: none
Decision: train8-selfdesc-grant | Put general grant-versus-ability guidance in existing shared self-description and trusted answer instructions. Recorded replays showed the quoted note alone still encouraged approval-checkpoint phrasing; the explicit ability classification is supplied as application guidance too. No authority or judge changes. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-8-selfdesc-PROGRESS.md
Prompt review: Guidance applies generally to listed abilities, never a canned answer or a keyword gate. Real preswitch update 840342287 is replayed from its read-only journal prompt with only self-description and its instruction delivery changed. Earlier captured outputs remain evidence rather than being edited. The existing group-carry replay now asserts that the changed capability note reaches all seven real recorded shapes: summary, uncertain summary, Jev uncertain and undecided, reply review, delivered reply and empty reply in recorded context. No new live send, deployment or independent convergence is claimed.
Prompt finding: 034c5250da92 | protocol-literal | unchanged standing-grant protocol compared against a historical provider prompt; no production-provider edit
Prompt finding: 3e21e10a7cfe | protocol-literal | immutable prior identity sentence translated explicitly for historical comparisons; not a fixture-derived reply
Prompt finding: 45e37ea2e9e9 | protocol-literal | unchanged provider grant protocol preserved by historical comparison
Prompt finding: 6af48f94b789 | protocol-literal | unchanged one-machine provider protocol preserved by historical comparison
Prompt finding: b00ed403060a | protocol-literal | unchanged provider grant protocol preserved by historical comparison

Verification: Stable-source targeted run passed 280 tests (20 existing opt-in live cases skipped), across 29 changed/direct-importer files, with --maxWorkers 1 and nice -n 10. Current typecheck, build, architecture and change-review checks passed. Original preswitch update 840342287 remains K11 FAIL point 2; the final real-model replay passes the identical k11a-rubric-v2 against the original note. Both verdict digests are checked in the replay test. Register regenerated through build-register --replay at exact source c3d8313e5277b7e341defb07e3551bf89d863f07: 289 entries, 116 rules, 34 terms, shape-only authority; seven derived files update source metadata, with capability inventory equality explicitly checked. Full suite and live deployment are not claimed.

Deferral: tests/preview/fixtures/doorway-notice-held-2026-10-11.json:95 | not-a-deferral=Immutable captured review output, not a new promise.
Deferral: tests/preview/fixtures/doorway-notice-offload-review-2026-10-11.json:12 | not-a-deferral=Immutable captured review output, not a new promise.
Deferral: tests/preview/fixtures/selfdesc-unit-2026-10-11.json:13 | not-a-deferral=Immutable captured model output, not a new promise.
Deferral: tests/preview/fixtures/selfdesc-unit-2026-10-11.json:14 | not-a-deferral=Immutable captured model output, not a new promise.

## Closing block

simplestRobustRoute: This is the simplest robust route: reuse the existing shared briefing and trusted instruction channel to distinguish authority from ability, leaving the capability inventory and effect doorway intact. No new gate, parser, service or runtime model call. Start guards remain verified durable intake and source pins; end evidence is targeted boundary tests and recorded real-model replay; all resource and effect floors remain unchanged. No autonomous deployed-completion claim is made.
80/20: targeted files and direct briefing importers only, foreground nice -n 10 and --maxWorkers 1. Existing bounded capture helper and unmodified k11a-rubric-v2 judge supply model evidence. Full suite and independent review belong to the pipeline.
VERDICT: author submission; independent review pending
