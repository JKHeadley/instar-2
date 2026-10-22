# Change review — Renew native conformance after the idle cleanup slice

Subject base: 742d989abc919491119b07da02073c9c1f325c8e
Review state: open
Reviewed content: none
Outcome: Repair the READY gate's stale native conformance certificate by executing its named contract on this Studio composition and publishing the measured certificate through the existing register.
Affected rules: Rules 26, 30, 34, 49, 69, 74, 101, 105, 111, 113, 115, 116.
Affected floors: secrets — captured provider frames require no live credentials; spend cap — native contract checks charged attempts and no retries; stop — contract checks refusal before provider dispatch and native launch; no duplicate sends — journal restart contract covers one delivery; durable intake — existing custody and journal records are unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: A supported harness claim certifies executable bytes and must follow a passing native contract on those bytes.
Side effects: Only the supported preview-self-host-native / claude-code-subscription / darwin / self-hosting conformance digest changes, with its dependent generated register publication. Runtime, entry points, support status, evidence reference and runtime behavior remain unchanged. Register replay is shape-only publication evidence, not a full-suite report.
Undo and recovery: Revert with its matching executable composition and regenerate the register. An old certificate does not certify new bytes; repeat the existing native contract before renewing another digest.
Multi-machine posture: This certificate binds the measured Darwin composition and exact Node executable on the Studio. It adds no claim for another runtime, platform or model doorway. Shared custody and owner fences are unchanged.
Layer below: Read compositionClosure/compositionDigest/currentRuntime, selfHostCompositionEvidence, the native contract and parity consumer. Measured the same complete 268-file closure and runtime before and after the passing declared contract. The contract launches real confined native tests and a capability probe, with captured provider frames; it verifies admission, accounting, stop, refusal and timeout behavior.
Bug class: none
Bug evidence: Evidence renewal: /Users/dabombstudio/.instar/agents/echo/.instar/lanes/sentinel-reaper-1022-native-certificate.json binds identical before/after measurements to the actual passing native-contract-before.json report. The original R105 rejected digest 4ff889f348277e7b854b4b884b2450a15143ef3db111a9776e93f33ebc43d83a; the measured composition is ddad779a5a789c28df0567160e7675fe7d099e3bd4b9e0cfb474a27186740bd1.
Hook bypass: none; core.hooksPath is unset and the inspected common hooks directory contains only sample hooks.
Convergence: none

Subject (8 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, src/assembly/harness.declarations.json

## Closing block

simplestRobustRoute: This is the simplest robust route: run the existing named native contract, verify unchanged composition, renew the one digest and regenerate the register. No new machinery, weakened check or substituted proof. The evidence establishes native conformance, not live answer quality or full production acceptance.
80/20: The exact native contract passed before renewal. Targeted native-contract and shipped-client tests check the renewed certificate and negative cases for altered composition/runtime and absent evidence. Final lint, register, pinned READY tests and change-review checks verify the pushed publication.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
