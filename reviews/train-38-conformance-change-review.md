# Change review — train-38 native macOS conformance refresh

Subject base: 4b36241bfc08793910c0c819c23948010363e126
Review state: open
Reviewed content: none
Outcome: Refresh the stale native macOS self-host conformance certificate after running its named contract on the supported Studio runtime; make the READY architecture gate pass.
Affected rules: Rules 26, 30, 34, 49, 69, 70, 74, 90, 101, 102, 105, 111, 113, 115, 116.
Affected floors: secrets — existing admission and outbound checks unchanged; spend cap — contract uses captured provider frames and verifies retained charges/refusals; stop — contract proves stopped launches and provider calls refuse; no duplicate sends — journal contract proves restart sends once; durable intake — contract checks durable owner records and accepted input.
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: Evidence-only refresh of one already-supported tuple after an actual contract run on its registered platform/runtime. No support expansion, runtime behavior or test weakening.
Side effects: The existing native Claude subscription self-hosting tuple now binds to the current 255-file composition digest. Runtime, platform, entrypoints, evidence case, supported status and other tuples stay identical. Generated register publication follows the changed declaration.
Undo and recovery: Revert declaration and generated publication together; the original stale-certificate failure returns. If composition changes again, rerun the native contract on the supported runtime before using the existing re-declaration script.
Multi-machine posture: Certification is deliberately bound to the macOS runtime recorded in the tuple. No new machine-local state, replication or ownership behavior. Other doorway/platform tuples retain their existing states.
Layer below: Inspected lintParityRegister, compositionClosure/compositionDigest/currentRuntime, selfHostCompositionEvidence, the named native contract and its captured-frame provider fixture. Host Darwin / DaBombs-Mac-Studio.local. The named contract passed before re-declaration; existing desk merge-live-conformance.mjs computed a complete 255-file closure and changed only the stale conformance value.
Bug class: integration
Bug evidence: reproducer=tests/preview/native-harness-contract.test.ts
Hook bypass: none; ordinary commits with the previously verified unset hooksPath and sample-only hooks directory.
Convergence: none


Verification: Named native contract passed on the old declaration before re-declaration; full tests/preview/native-harness-contract.test.ts then passed all 10 cases, including exact composition certification, stop, refusals, restart uniqueness and readiness deadline. Reports: /Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-38-tool-evidence/native-contract-before-redeclare.json and native-contract-redeclared.json. Typecheck and build pass. Post-build digest recheck remains sha256:22aceca3fa4437bf66c893914191956bcb3c4641d1a8e728579349862fbc5f23, complete 255-file closure. Delegated manifest/inventory refresh changed no pins.

Register publication: Replayed generated/ from committed declaration 814a4a14; no hand-edited source or owner pins. The review range includes both the declaration and generated publication commits.

## Closing block

simplestRobustRoute: This is the simplest robust route: run the existing named native contract on the supported Studio, re-declare with the existing desk digest tool, then test the exact certificate and regenerate the register. No new checker, exemption, handwritten digest, support downgrade or runtime change. The existing exact-composition comparison remains the guard.
80/20: Run the one affected native contract file, typecheck/build, architecture/register/review gates and whitespace checks; no full suite or load testing.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
