# Change review — refresh protocol repair register evidence

Subject base: 935457dd1b06bba40f4ceda405b8ccd48d46c985
Review state: open
Reviewed content: none
Outcome: Refresh generated register provenance from committed repair source 935457dd1b06bba40f4ceda405b8ccd48d46c985 using the existing replay builder.
Affected rules: Rules 5, 49, 69, 74, 90, 101, 105, 113, 115, 116.
Affected floors: secrets — no credential data added; spend cap — no policy change; stop — repair source now matches generated wiring; no duplicate sends — no dispatch change; durable intake — no store change.
Operator questions: none
Suggested tier: critical
Declared tier: maintenance
Tier rationale: Generated provenance-only refresh after committed source repair; no policy or runtime behavior changes in this commit.
Side effects: Generated source commit and generation hashes change. Replay remains shape-only evidence and does not renew the native macOS conformance certificate.
Undo and recovery: Regenerate from an intended committed source; do not hand-edit source pins or delete existing evidence.
Multi-machine posture: Versioned generated source evidence is shared through git; process state remains local under the existing owner.
Layer below: Existing build-register replay and source wiring comparison; verified check-register-wiring and register:check after regeneration.
Bug class: none
Bug evidence: none
Hook bypass: none; ordinary git commit with no bypass flags.
Convergence: none
Deferral: generated/register.json:1 | not-a-deferral=Generated register repeats existing governed text; this commit adds no deferred work.

Subject (7 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json

## Closing block

simplestRobustRoute: This is the simplest robust route: use the existing register replay generator after committing source. No new machinery or autonomous completion claim.
80/20: Only generated provenance changes; verify register, wiring, architecture and change-review checks without a full test suite.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
