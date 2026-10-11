# Change review — Consume standing trust MCP launches in Codex and certify Darwin

Subject base: 4aed08ec22f6e6630dd155cec432f338cf56d021
Review state: open
Reviewed content: none
Outcome: Setup MCP servers reach the actual Codex configuration consumer through the existing vault launcher; revoke removes per-turn overrides. Publish the source-linked authorization inventory and certify final native Darwin composition.
Affected rules: 1, 4, 26, 30, 32, 34, 36, 37, 49, 70, 74, 95, 100, 101, 102, 103, 104, 105, 111, 113, 115, 116
Affected floors: secrets — vault references become socket-backed launchers, no secret values in TOML; spend cap — reservations unchanged; stop — existing latch and hooks preserved; no duplicate sends — no retry or dispatch changes; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Fix actual harness consumption of scoped tools and supported native composition evidence without changing authority or model judgment.
Side effects: Codex sees setup servers on each prepared turn; invocation-local overrides leave independently installed login-home tools intact. MCP root changes retain the documented restart requirement. Claude still reads the same JSON launch file.
Undo and recovery: Revert repair and regenerate composition/register evidence; Codex then loses setup wiring again. Revoke setup trust and restart under the custodian for operational rollback. Never retry unknown effects.
Multi-machine posture: Installation-local deliberately: each custodian supplies its own vault and root configuration. Derived launch objects have turn lifetime and introduce no durable state; replication and closed operation set are unchanged.
Layer below: Read configureTrust, readRootMcp, prepareToolTurn, both provider launch consumers, effect classification/admission, explicit-yes and verified approval consumers. Real codex mcp list consumes the prepared launch overrides in a fresh home, then removal. Native contract binds its complete 253-file composition and physical confined launches.
Bug class: integration
Bug evidence: reproducer=tests/preview/trust-setup.test.ts
Hook bypass: none
Convergence: none
Prompt review: No prompt, output parser or accept/escalate/refuse model judgment changed. Existing recorded-shape setup rejection replay remains exercised for summary/uncertain, Jev undecided/unsure, reply review, delivered reply and empty candidate; provenance and update ids in repair PROGRESS.
Prompt finding: 450c79237a95 | protocol-literal | Existing ambiguous-memory conversation wording is unchanged; this repair changes launch wiring only.

Subject (7 paths): docs/standing-trust-setup.md, src/assembly/harness.declarations.json, src/assembly/production-codex-provider.ts, src/assembly/production-provider.ts, tests/preview/tool-turn.mjs, tests/preview/tool-turn.test.ts, tests/preview/trust-setup.test.ts

Register maintenance: Ran delegated owner-manifest rehash and desk repin chain; no owner/inventory pins changed. Replayed generated register from b1a0532d07f924c40776870ad92ed67b20184c22, generation sha256:118747f543ce46d70f8b4ee8d64fd1d77df827cc8d0182fa45714644ad68a50d. This record covers the source repair and generated publication.

Evidence: Typecheck/build pass; setup 8, Codex adapter 18, tool-turn 15 and native contract 9 tests pass (50 total, foreground nice -n 10, one worker). Eight saved-report contract checkers pass; p5/assembly require current-revision process/assertion evidence and p11 requires the new setup file absent from the parent report. The new file passes targeted. Full gate remains pipeline-owned; no current full-run result is asserted.

## Closing block

simplestRobustRoute: This is the simplest robust route: pass the exact prepared vault-wrapped launches to the existing Codex TOML configuration mechanism. It prevents the observed silent loss of setup servers without new IO in core, registry, authority classifier, or live model call. Existing admission and model budget hooks remain start/limit guards; actual CLI consumption/removal and native contract verify end state.
80/20: Targeted adapter/consumer, real CLI and native conformance evidence address the three review failures; full suite remains the pipeline duty. No independent acceptance is asserted.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
