# Change review — renew train-175 native Darwin conformance

Subject base: 6df52e219b15e6e36ef1d6b05b14e98e1ba573a5
Review state: open
Reviewed content: none
Outcome: Renew the native Darwin certificate for the repaired subscription composition using the desk's actual contract workflow, so the READY lint gate accepts the proven bytes.
Affected rules: 26, 34, 37, 42, 49, 70, 74, 101, 105, 111, 113, 115, 116
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake retain their existing runtime enforcement; native contract cases verify owner admission, durable cause, stop and refusal behavior.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: The byte-bound native conformance declaration and its publication change; executable behavior does not.
Side effects: The declaration certifies the current 275-file composition and exact runtime. Generated register and owner references follow the measured certificate. No rule, checker, supported capability, grant or runtime behavior is weakened.
Undo and recovery: Revert with the matching composition and regenerate publication. An old certificate cannot certify changed code. The renewal tool restores the prior declaration if the post-renewal contract fails.
Multi-machine posture: Certifies only the declared Darwin runtime measured on the Studio. No certificate is claimed for another host or doorway.
Layer below: Existing parityMatrix, compositionClosure, compositionDigest and currentRuntime; actual native-harness-contract.test.ts; desk merge-live-conformance.mjs --renew; owner rehash, repin chain and register replay.
Bug class: none
Bug evidence: Evidence maintenance, not a new runtime repair. Before/after native contract reports are retained under /Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-175-r105-evidence.
Hook bypass: none
Convergence: none
Prompt review: No model prompt, response parser, judgment or runtime guard changes.

1.x comparison: Inherited cache-repair comparison at cc11e45f92e2590dd1bbd3c3facb5b849532f0fc. Additionally searched actual JKHeadley/instar origin/main src/ and docs/specs/ plus git history for compositionDigest, native conformance and self-host contracts. Only docs/specs/reports/telegram-message-origin-review.md (history a29957130) matched general conformance language; it has no corresponding native byte-bound certification implementation. Read ONEX-LESSONS Testing Integrity and its docs/specs/TESTING-INTEGRITY-SPEC.md reference: test actual assembly. Reuse 2.0's existing native contract and digest/publication workflow; no 1.x code transplanted.

Decision: train-175-r105-renew | The desk's follow-up explicitly requests repairing the rejected gate on this Studio. Use its existing --renew workflow: only the stale certificate assertion may fail before renewal, all ten contract cases must pass afterward, exact Darwin runtime required, automatic restoration on failure. No blind pin editing. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-175-repair-PROGRESS.md

Deferral: generated/register.json:1 | not-a-deferral=Mechanically replayed existing register wording introduces no postponed implementation.

Verification: native contract before renewal passed 9/10 with only the stale certificate assertion failing; after renewal all 10/10 passed. Reports are in the evidence directory above. Complete composition: 275 files, sha256:6efe6f69549488a25f9327c71388df30639ba870aa420366aaf972ad826b67fa. Build passed; delegated owner rehash and repin passed with zero changes. Register replay from 19f47a9209257361b678daf54316d06a1e1e1645 published generation sha256:a9652c8d6c6bad9442be96152c0d0fd0e07548b789ff7fc942fe2fad27321958. This record covers the certificate and generated publication commits.

## Closing block

simplestRobustRoute: Reuse the desk's native contract renewal and the repository's composition digest, then regenerate dependent publication. This is the simplest robust route; no new checker, certificate mechanism or runtime restriction. Matching bytes skip renewal; an actual contract failure refuses certification.
80/20: One targeted native contract file and cheap gates; no full suite. The existing pipeline owns live answer and full-suite acceptance.
VERDICT: author submission; no independent verdict asserted
