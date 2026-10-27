# Change review — Renew native evidence after the summary cap repair

Subject base: 16bb79712f0aafa2a410edc165dbc78e34e0ad47
Review state: open
Reviewed content: none
Outcome: Renew the existing native self-hosting certificate after its declared contract passes on the declared Studio runtime, and replay the generated register evidence.
Affected rules: 26/70/105/115 (actual composition and runtime evidence); 37 (reproduced failure and verified repair); 49/74/111 (scope, effects, recovery and foundation); 101 (plain commits); 102 (recorded decision); 112/113 (preserved history and explicit machine posture); 116 (existing contract and declaration).
Affected floors: secrets — custody and disclosure unchanged; spend cap — reservations and total usage accounting unchanged; stop — existing latch exercised; no duplicate sends — dispatch uniqueness and retry policy unchanged; durable intake — durable cause and receipt capture retained.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Evidence-only renewal of an existing supported tuple. No model-facing behavior, capability, checkpoint, test or checker changes.
Side effects: Native support and generated register views describe the current, actually exercised composition. No capability is disabled and no new mechanism is added.
Undo and recovery: Revert this declaration and replay the register for the intended composition. The previous digest correctly fails against current bytes; certify any replacement through the existing native contract before claiming support. No state migration is needed.
Multi-machine posture: The certificate is specific to the declared macOS runtime. No shared state, ownership, replication, peer dependency or durability demands change. Other tuples retain their existing declarations.
Layer below: Inspected scripts/composition-digest.mjs, scripts/check-architecture.mjs, tests/preview/native-harness-contract.test.ts and the prior i1b-opus-1020-native-renewal-review.md procedure. The desk reproduced the sole R105 mismatch on head 16bb79712f0aafa2a410edc165dbc78e34e0ad47 and explicitly requested its repair on the Studio. The complete 275-file closure computes sha256:14b5033f054a0b073da1548f2e9111453a54ee5ea1b4dfa887d9c1d5ffab2a54 on node-24.14.1@sha256:91d3afb67a7dc211f642f2328f822505ff1c1ad381e98ffdd21b003970deeeda. The named native contract passed before changing the declaration, exercising real confined package testing, installation and probe, owned provider/tool admissions, stop, refusal and timeout without retries. The certificate itself is excluded from the composition closure by the existing digest procedure. Evidence is retained under the absolute desk lanes directory in s-summary-cap-1026-evidence/native-contract-before-renewal.log and native-contract-after-renewal.log.
Validation: The named contract passed before renewal (1 selected test); all 10 native contract tests passed after renewal, including certificate matching and the injected slow-path deadline. Architecture passed with no findings. Final generated-register and READY checks are recorded in PROGRESS.
Bug class: none
Bug evidence: none — renewal of existing conformance evidence; the measured summary repair and real-model replay remain in s-summary-cap-1026-change-review.md.
Hook bypass: none
Convergence: none
Decision: s-summary-native-renewal | Run the declared native contract on the exact Studio runtime, renew its one composition digest only after it passes, then replay register evidence and run the final READY checks. Keep the measured summary repair and unchanged answer acceptance cap. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/s-summary-cap-1026-PROGRESS.md
Prompt review: No model-facing change in this round. The prior recorded calls and test-login real-model replay remain the model-facing evidence; this captured-frame native contract makes no live-model completion claim.
Deferral: generated/register.json:1 | not-a-deferral=deterministically replayed existing register descriptions; no new commitment

Generated evidence: Replayed the existing register at source commit 7824ffe12de341bc1fec64973aef424f830a5236 (generation sha256:afcf6698470ad0f3060d79b362c8206195af6ad273d164aa8582dc1051ba7ec7). This record covers both the certificate commit and the subsequent seven generated-output files.

## Closing block

simplestRobustRoute: Run the existing native contract on the declared runtime, update its existing certificate from the actual composition digest and replay the register. This is that route. Start guard: exact runtime and complete closure. End guard: passing native contract and architecture for the same bytes. Limit guards: unchanged secrets, spend, stop, uniqueness and durable intake. No new machinery or unattended live-model completion claim.
80/20: One evidence-only repair resolves the desk's remaining R105 failure. No further behavior change or capability restriction is justified; the pipeline owns the full suite and combined-build live checks.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
