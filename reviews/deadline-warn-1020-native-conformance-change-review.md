# Change review — renew native self-host conformance for the deadline-warning composition

Subject base: e61ce6a1304c85539f18aab05bee67a569f96b19
Review state: open
Reviewed content: none
Outcome: The deadline-warning change edits src/rulegraph/graph.ts, src/register/workflow.ts and src/register/index.ts. Those files are inside the certified closure of preview-self-host-native × claude-code-subscription × darwin × self-hosting, so its byte-bound conformance digest no longer matched (R105). On the Studio (Darwin, Node 24.14.1, the declared runtime), the declared native contract passed on the measured composition before any edit. Only the conformance value was then renewed to that measured digest (sha256:8dcd1e469e338f69c6114e76aa2b9689f2dab06b462e2220dcc2d0cc74d1ae43). All 10 native contract cases passed after it, and the architecture check passes.
Affected rules: Rules 105 and 115 (native parity and harness conformance); also 26/34/70 (measured and run, not asserted), 37 (fixed at the declaration source), 90 (register replayed from committed source), 101 (plain commits), 113 (exact Darwin runtime; no new cross-machine authority), 116 (existing contract and generator).
Affected floors: secrets — unchanged; spend cap — unchanged, the contract uses captured provider frames and charged refusals with no retry; stop — unchanged, the contract exercises stop before dispatch; no duplicate sends — unchanged, the contract's journal restart shows no duplicate delivery; durable intake — unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: It renews a support certificate. The supported ability, runtime, entries, artifact, route and evidence are unchanged; only the digest moves, after a passing contract run on the exact composition.
Side effects: The parity register again shows the native tuple supported for the current bytes. No executable, prompt or parser changes.
Undo and recovery: Revert this commit and its generated publication; R105 then reports the mismatch again.
Multi-machine posture: The certificate is Darwin- and runtime-bound by design. Other platforms still check byte-exactness without asserting host identity.
Layer below: Read scripts/composition-digest.mjs (closure and digest) and lintParityRegister in scripts/check-architecture.mjs. Measured which changed files sit in the closure: src/register/index.ts, src/register/workflow.ts and src/rulegraph/graph.ts. The renewal follows the allowance-renew-1019 procedure.
Bug class: none
Bug evidence: none
Hook bypass: none; plain commits, no bypass flags; core.hooksPath unset.
Convergence: none
Decision: deadline-warn-native-renewal | Renew the native certificate on the Studio after the declared contract passed on the measured composition, rather than leave R105 for the desk; the desk's READY gate refused R105 on this head. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/deadline-warn-1020-PROGRESS.md
Prompt review: No model prompt or output interpretation changes; certificate-only.
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Verification: Recorded in the deadline-warn-1020 PROGRESS report.

## ELI16

The Mac self-host setup carries a certificate that says "this exact set of files passed the safety contract". The deadline fix changed three of those files, so the certificate no longer matched and the lint check refused. We ran the real contract on the Mac Studio against the new files. It passed, so we updated the certificate's fingerprint to the new files and ran the whole contract again, which passed.

## Closing block

simplestRobustRoute: The existing contract test and the existing declaration field; measure, run, then renew one value. No new machinery.
80/20: Named native contract before the edit, the whole contract file after it, the architecture check, a register replay and the register check.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
