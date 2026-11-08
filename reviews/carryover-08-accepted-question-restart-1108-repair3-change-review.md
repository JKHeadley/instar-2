# Change review — Carryover 08 repair 3: renew the native Darwin conformance certificate for the stale-marker repair bytes

Subject base: 24a29b2e5b04bdd629fcc756d1d7afb97dc73e02
Review state: open
Reviewed content: none
Outcome: Closes the round-3 unit-review must-fix (R105). The stale-marker repair changed certified source after the previous renewal, so the declaration named sha256:2f31b1a2… while the composition is now sha256:76094657…. On the Studio the existing desk renewal ran the real 10-case native harness contract before (9/10, only the stale certificate failing) and after (10/10) the redeclaration; the digest was written by that tool, not by hand. No source, test or prompt changed. Row 08 stays OPEN for the desk's live restart proof.
Affected rules: 74, 101, 105, 115, 116; architecture R105.
Affected floors: secrets — no content or credential surface touched; spend cap — unchanged, no code changed; stop — unchanged, no code changed; no duplicate sends — unchanged, no code changed; durable intake — unchanged, no code changed.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Re-declares the certificate that binds the native self-host composition to its passing contract.
Side effects: One declaration digest changed in src/assembly/harness.declarations.json; generated register outputs replayed to the renewal commit. Owner-manifest rehash and repin chain ran with 0 pins refreshed.
Undo and recovery: Revert both commits; R105 reports the stale certificate again.
Multi-machine posture: Unchanged; the certificate is a repository declaration checked on every machine, renewable only on the Studio.
Layer below: Read docs/00-the-purpose.md and docs/01-the-rules.md. Inspected the desk's pipeline/merge-live-conformance.mjs --renew path and the native contract tests/preview/native-harness-contract.test.ts it runs before and after writing. 1.x comparison is inherited from the carryover 08 records (JKHeadley/instar stuckMessageRecovery.ts / MessageProcessingLedger.ts); this repair changes no behavior.
Bug class: none
Bug evidence: none
Hook bypass: none; no bypass flag was passed.
Convergence: none
Decision: C08-1108-R3-RENEW-CERT | Renew the certificate through the existing desk contract run on the Studio rather than editing the digest, so the declaration rests on passing evidence for these exact bytes. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-08-accepted-question-restart-1108-PROGRESS.md
Deferral: generated/register.json:1 | not-a-deferral=mechanically replayed register descriptions introduce no deferred work

Subject (8 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, src/assembly/harness.declarations.json

## Verification

npm run build exit 0. merge-live-conformance --renew (Node 24.14.1): NATIVE-CONTRACT before 9/10 (only stale certificate), after 10/10; REDECLARED sha256:2f31b1a2c3513c49ed836d0f4b2cad02712310da0c8d15ca2e19d88fd2ffb889 -> sha256:76094657500b106448a5c54d182c49501fb578cb119c8a6c1fc41beda4eb1e4c (276 files). Evidence: desk lanes carryover-08-accepted-question-restart-1108-repair3-native/{before,after}.json and -repair3-renewal.log. node scripts/check-architecture.mjs: architecture checks passed. npm run lint and npm run register:check exit 0.

## Closing block

simplestRobustRoute: Re-run the existing native contract and let the existing renewal tool redeclare; no source change.
80/20: One must-fix closed by evidence renewal alone; live restart proof remains with the desk.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
