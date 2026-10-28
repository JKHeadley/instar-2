# Change review — Renew combined copy pins and native certificate

Subject base: b4bb458faa44ef75922abde24dfb9ebf6a33d818
Review state: open
Reviewed content: none
Outcome: Renew generated owner reference hashes and the native self-host declaration for the exact combined copy after its macOS contract passed; no runtime behavior changes.
Affected rules: 1, 30, 36, 49, 74, 101, 102, 105, 111, 115, 116
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: The existing native declaration names the exact static import closure and runtime; renewing it follows a composition change and requires actual contract evidence.
Side effects: Generated hashes and the declaration now refer to this combined copy. They do not approve live use or alter any grant.
Undo and recovery: Discard this gate branch and continue with frozen r3; no live state was touched.
Multi-machine posture: Same source bytes and declared macOS runtime; no ownership or replication change.
Layer below: The native contract's behavior cases passed on macOS before declaration renewal. The certification assertion initially failed solely on the old digest, then all 10 cases passed after renewal. Architecture now passes; register generation still follows the source commit.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: combined-copy-cert-renewal | Renew only the exact native composition digest after the macOS contract passed, and recalculate the two changed owner reference hashes. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/thinking-caps-gate-1028-PROGRESS.md

Subject (2 paths): register-source/owner-references/preview.json, src/assembly/harness.declarations.json

## Closing block

simplestRobustRoute: Keep the existing native contract and owner-reference manifests; renew their byte-bound records after running the contract. No new certifier or gate.
80/20: The exact macOS contract passed 10/10. Full suite, independent review and same-five-task scoring remain separate release gates.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
