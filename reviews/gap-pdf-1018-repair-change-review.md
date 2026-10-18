# Change review — PDF annotation credential checkpoint and native conformance

Subject base: ce17158819920824514f419a18e9ea6c2c147fdc
Review state: open
Reviewed content: none
Outcome: Decode annotation appearance glyphs before PDF publication, retain clean annotations unchanged and encrypted held-secret originals, and renew the measured Darwin native conformance declaration.
Affected rules: 1, 4, 26, 32, 34, 36, 37, 49, 60, 70, 74, 95, 100, 101, 105, 111, 112, 113, 115, 116; architecture R105; Rule 115/D17
Affected floors: secrets — PDF.js rendering operators decode annotation glyphs into the existing exact credential check before publication; spend cap — no provider call or spending authority added; stop — existing bounded resource owner and publication guards retained; no duplicate sends — delivery ownership unchanged; durable intake — original authenticated encrypted bytes remain available on refusal
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Repairs an actual credential exposure at the existing publication boundary and renews exact native composition evidence.
Side effects: All rendering intents and annotation appearances now pass the existing decoded-text bound and credential check, including print-only appearances and adjacent showText operators. Clean annotation bytes remain unchanged and Read-admitted. Rendering interpretation can consume more of the existing time/memory/output budgets; exhaustion remains a fail-closed derivative refusal with encrypted original custody. No PDF parser, process owner, store, dependency or capability restriction is added. Native declaration changes only its measured digest. Generated register publication is replayed from committed declarations.
Undo and recovery: Revert together with a reviewed credential-safe decoder replacement; reverting just the annotation check reopens the demonstrated leak. Retained encrypted originals permit reprocessing. Native evidence must always match the actual composition; replay the register after changing it.
Multi-machine posture: Deliberately machine-local decode inside the existing admitted resource owner. Shared code changes neither distributed ownership nor intake replication. Native conformance covers only the exact Darwin runtime and composition measured here.
Layer below: Inspected PDF.js worker normalization of Tj/TJ/quote operators to showText glyphs, getOperatorList annotation and intent semantics, actual custody-to-session callback, protection/custody functions, and compositionClosure/compositionDigest/currentRuntime. Real PDF libraries and custody are used; only the PDF host resource execution port is substituted by a bounded child process. Native contract uses real confinement and installed capability execution with recorded provider frames.
Bug class: user-facing
Bug evidence: reproducer=tests/preview/pdf-attachment.test.ts; live=tests/preview/fixtures/gap-pdf-1017.json
Hook bypass: none
Convergence: none
Prompt review: No model prompt or output parser changes. Recorded update 6234449/message 8687 remains an honest historical refusal. Captured summary, uncertain summary, undecided/unsure Jev, reply review, delivered and empty reply bytes are replayed as exact PDF metadata strings alongside clean/held appearances; this exercises publication and does not claim new model comprehension or reinterpret the historical verdicts.
Verification: Red regression: annotation-clean passed, annotation-held failed by exposing a readable derivative before repair. After repair: pdf-attachment.test.ts 30/30 and native-harness-contract.test.ts 10/10 pass, foreground nice -n 10 with one worker. Typecheck and build pass. The native pre-renewal run had 9 passing cases and only the stale certificate assertion failed; computed digest sha256:846d1a5519e2382a841dc759510ce37011f63cba79ec16572f968bbcb3328f46 across 268 files on the declared Node runtime, renewed it, then all ten cases passed. Architecture now passes. Replayed generated publication from source commit 03d709ca081ef78a80ba55ed1ccc24f7de0c5cdf (generation sha256:b3ae2ef2c3cf8906eb3b7d7b41c7e241c10593892a62e8fb287d1eaf29f7ffbe). Final committed-head lint/register/change-review outputs are recorded in /Users/dabombstudio/.instar/agents/echo/.instar/lanes/gap-pdf-1018-repair-PROGRESS.md.
Limitations: The review's unchanged media-understanding.test.ts:64 cleanup-unresolved/allocation-reserved failure is retained for combined Studio verification; no success is asserted for it. No full suite was run per operator direction. This repair does not recertify the entire inherited d0944dba..ce171588 range or claim unattended live model acceptance.

## Closing block

simplestRobustRoute: This is the simplest robust route: ask the installed renderer for decoded glyph runs, then use the existing credential publication checkpoint. Raw stream text and getTextContent alone miss annotation appearances. Both individual runs and adjacent runs are checked within the existing resource/output limits; clean PDFs remain readable and held originals stay encrypted in custody. Reuse the native contract and existing composition digest to renew truthful evidence. Entry remains admitted custody, publication requires completed credential checking, and existing stop/bounds/cleanup own lifetime. No autonomous live completion claim.
80/20: Repair the two must-fixes with the existing decoder and native contract, preserve the review's clean/held pair and recorded shapes, run affected tests and cheap gates; the Studio pipeline owns full-suite and combined live acceptance.
VERDICT: author submission; no independent convergence asserted
