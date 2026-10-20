# Change review — Renew native evidence for the repaired Opus composition

Subject base: fc2441924250cdceb9dc19f8d0158e233306a152
Review state: open
Reviewed content: none
Outcome: Renew the existing native self-hosting declaration for the repaired composition after its declared contract passes on the declared macOS runtime, and replay the generated register evidence.
Affected rules: 26/70/115 (actual composition and runtime evidence); 37 (reproduced failing architecture and passing repair); 49/74/111 (scope, effects, recovery and foundation); 101 (plain commits); 102 (recorded decision); 112/113 (preserved history and explicit machine posture); 116 (existing contract and declaration).
Affected floors: secrets — custody and disclosure unchanged; spend cap — reservations and total usage accounting unchanged; stop — existing latch retained and exercised; no duplicate sends — dispatch uniqueness and retry policy unchanged; durable intake — existing durable cause and receipt capture retained.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Evidence-only renewal of an existing supported tuple. No model-facing behavior, capability, checkpoint, test or checker changes.
Side effects: The native adapter can truthfully report supported conformance for the current bytes. Generated register and capability views consume the renewed certificate. No capability is disabled and no new mechanism is added.
Undo and recovery: Revert this declaration change and regenerate the register for the intended composition. The previous digest will correctly fail against current bytes; certify any replacement composition through the existing contract before claiming support. No state migration is needed.
Multi-machine posture: The certificate is specific to the declared macOS runtime. No shared state, ownership, peer dependency, replication or durability demands change. Other tuples retain their existing declarations.
Layer below: Inspected scripts/composition-digest.mjs, scripts/check-architecture.mjs, tests/preview/self-host-harness.mjs and tests/preview/native-harness-contract.test.ts. The complete 268-file closure computes sha256:94197754d75be41d659eec96a0d5cfff06453414a397fda0ba8e52daacb57d79 on node-24.14.1@sha256:91d3afb67a7dc211f642f2328f822505ff1c1ad381e98ffdd21b003970deeeda, matching the review finding. Architecture reproduced exactly one R105 before renewal. The named native contract passed before renewal (one selected test), exercising real confined package testing, installation and probe, owned provider and tool admissions, stop, refusal and timeout without retries. After renewal all 10 tests in the native contract file passed, including certificate matching and the injected slow-path deadline. Architecture passed; wiring identified only the expected stale declaration pin. The delegated rehash/repin reported zero changed pins. Typecheck and build passed. Logs are retained in the absolute desk lanes directory as i1b-opus-1020-native-contract-before-renewal.log and i1b-opus-1020-native-contract-after-renewal.log.
Bug class: none
Bug evidence: none — refresh existing conformance evidence; the source repair and captured numeric evidence were accepted by the supplied independent review.
Hook bypass: none
Convergence: none
Decision: i1b-native-renewal | Step back to the sole remaining obligation: run the existing native contract, renew its single digest and replay generated evidence. Retain the reviewed numeric and snapshot fixes because removing them restores the demonstrated regression. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/i1b-opus-1020-repair-PROGRESS.md
Prompt review: No model-facing change in this round. The prior recorded usage replay remains the numeric evidence; this captured-frame native contract makes no live-model or combined-build Opus completion claim.
Deferral: generated/register.json:1 | not-a-deferral=deterministically replayed existing register descriptions; no new commitment

Generated evidence: Replayed the existing register at source commit d975be8c9c3184f7c9528bfdafeb46bc996253dc. This record covers the certificate commit and the subsequent generated-output commit; all seven generated files derive from that replay.

## Closing block

simplestRobustRoute: Run the existing native contract on the declared runtime, update the existing certificate from its actual composition digest, and replay the register. This is that route. Start guard: exact runtime and complete closure. End guard: passing native contract and architecture for the same bytes. Limit guards: unchanged secrets, spend, stop, uniqueness and durable intake. No added machinery or unattended live-model completion claim.
80/20: One evidence-only repair resolves the sole must-fix. No further source repair or capability restriction is justified; the Studio pipeline owns full-suite and combined-build live checks.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
