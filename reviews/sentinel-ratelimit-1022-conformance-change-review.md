# Change review — Renew throttle recovery native conformance

Subject base: a91ee29230f0aa68d3b1838e5545309243799eb8
Review state: open
Reviewed content: none
Outcome: Certify the changed native composition on its declared Darwin runtime after the desk renewal procedure passes the real contract, and publish its dependent register.
Affected rules: 26, 34, 49, 70, 74, 90, 95, 101, 107, 111, 112, 113, 115, 116; architecture R105
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake retain their existing enforcement and native contract coverage.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Updates the evidence supporting an exact native composition; executable behavior is unchanged.
Side effects: The supported tuple and generated publication now bind the tested bytes.
Undo and recovery: Restore a certificate only with the composition it certifies, then regenerate publication. An old certificate cannot certify the current bytes. The original throttle change's journal rollback constraint remains in its review.
Multi-machine posture: Certifies only the declared Darwin runtime measured on the Studio. No authority or evidence is transferred to other platforms.
Layer below: Repository compositionClosure/compositionDigest/currentRuntime, native harness contract, desk merge-live-conformance.mjs --renew procedure and register replay.
Bug class: none
Bug evidence: Evidence maintenance. Before renewal nine of ten cases passed, with only the stale certificate assertion failing; after renewal all ten passed. Reports: /Users/dabombstudio/.instar/agents/echo/.instar/lanes/sentinel-ratelimit-1022-r105-renewal/before.json and after.json.
Hook bypass: none; core.hooksPath unset and common hooks directory contains only samples
Convergence: none
Deferral: generated/register.json:1 | not-a-deferral=mechanically replayed register descriptions introduce no deferred work

Publication: Declaration and contract review committed as 25a7c43b00c8d38e66dde34c486393190d23c9fa; dependent register publication committed as 26cfff980a96db5d33933ca9b956da75b4792acd. This review covers both. Replay generation sha256:875fdc9046c88379839d312b54c4b65b59f8c01732adbe2ebd5cd3ec7a9b3765 is shape-only and grants no runtime authority. On the published head, lint and register:check both exit 0.

simplestRobustRoute: Reuse the desk's existing renewal procedure on the Studio. It checks the declared runtime, accepts only the stale certificate failure before writing, requires all ten cases afterward, and restores the declaration on behavioral failure. No blind hash replacement, gate exception, new mechanism or changed runtime behavior.
80/20: Before/after native contract, direct shipped-client tests, architecture lint, register replay check, review check and the pinned READY gate. The pipeline owns the full suite.
VERDICT: author submission; independent review belongs to the desk
