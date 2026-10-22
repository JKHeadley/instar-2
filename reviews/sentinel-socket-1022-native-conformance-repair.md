# Change review — Renew socket sentinel native conformance

Subject base: 1adb531b3c327cbd8723d9eef2199772c6ef2b95
Review state: open
Reviewed content: none
Outcome: Certify the socket sentinel composition on its declared Darwin runtime using the existing native contract, and refresh dependent register publication.
Affected rules: 26, 34, 37, 49, 70, 74, 90, 95, 101, 107, 111, 112, 113, 115, 116; architecture R105. Rule 62 remains a separate combined-build live acceptance requirement.
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake retain their existing enforcement and native contract coverage.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Renews exact native composition conformance evidence; executable behavior is unchanged.
Side effects: The supported native tuple and dependent publication certify the composition that the contract actually exercised.
Undo and recovery: Restore a declaration only together with the matching composition and replay publication. The older certificate cannot certify these bytes. The original socket notice journal rollback requirement remains in its own review.
Multi-machine posture: Certification covers only the exact declared Darwin Node runtime measured on the Studio; it makes no claim about other platforms or changes to distributed ownership.
Layer below: compositionClosure/compositionDigest/currentRuntime, native-harness-contract.test.ts, the desk pipeline/merge-live-conformance.mjs --renew helper, and register replay.
Bug class: none
Bug evidence: Evidence renewal. Before renewal nine of ten native cases passed, with only the stale-certificate assertion failing; after renewal all ten passed. Reports: /Users/dabombstudio/.instar/agents/echo/.instar/lanes/sentinel-socket-1022-repair-conformance/before.json and after.json. The helper verified the declared runtime and complete 275-file closure and would restore the declaration on a behavioral failure.
Hook bypass: none; core.hooksPath unset and common hooks directory inspected, containing only samples
Convergence: none
Decision: socket-native-certificate-renewal | Reuse the existing desk contract-gated renewal helper on Darwin and retain the supported claim only after all ten cases pass; no manual hash rewrite or capability restriction. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sentinel-socket-1022-repair-PROGRESS.md
Deferral: generated/register.json:1 | not-a-deferral=mechanically replayed register descriptions introduce no deferred work

Scope: This repair renews evidence only. The prior review covers the unit changes from 4a2635bc2064d5eaec5e451360634eeabecaad9d; it does not recertify the entire inherited train range. Current-head Telegram delivery of the new line remains separate from recorded-frame replay and native harness conformance, under Rules 34/62/70/76. No model prompt, output parser or acceptance decision changes in this repair.

simplestRobustRoute: Run the existing native contract on the declared runtime through the desk renewal helper, accept only the stale certificate assertion before renewal, require ten passing cases afterward, and replay publication. This is that route; no new mechanism, gate exception, runtime behavior or reduction of ability.
80/20: Before/after native contract, declaration consumer checks, typecheck, architecture and wiring lint, publication replay check, change-review check and required pinned READY checks. The Studio pipeline owns the full suite.
VERDICT: author submission; this record asserts no independent verdict
