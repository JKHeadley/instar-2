# Change review — Carry answer-token usage through the production owner checkpoint

Subject base: e351ef727d46c966296e2f2792acf8902b2e5de2
Review state: open
Reviewed content: none
Outcome: The production invocation owner admits the recorded Opus answer (1238 answer tokens, 3286 total, cap 2048). Subscription usage carries validated answerTokens alongside total outputTokens through the data-only capture boundary. The answer cap uses that quantity; absent metadata retains the total-token fallback. Invalid quantities and oversized answers remain refused. Native composition evidence is renewed after its existing macOS contract passes.
Affected rules: 13/45 (explicit quantity semantics through all checkpoint consumers); 24/51 (repair recurring false refusal at source); 36/70 (recorded usage replay through route and owners); 75 (retain total accounting); 37 (both sides tested); 111 (owner layer below adapter); 113 (stateless multi-machine posture); 115 (native contract); 116 (reuse one calculation and existing observation); 101 (no hook bypass).
Affected floors: secrets — custody and data-only receipt copying remain; spend cap — charge, call reservations and total metering remain; stop — deadline and stop checkpoints remain; no duplicate sends — no dispatch/retry change, tests assert one invocation; durable intake — causal preparation and persistence remain.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Repairs the owner consumer of the existing answer-token cap without changing prompts, policy limits, authority or provider selection. Tests exercise real effect/invocation owners and the subscription adapter with captured usage; native conformance covers the supported composition.
Side effects: New subscription receipts include optional answerTokens. Legacy receipts omit it and preserve existing semantics and encoding. Malformed answer-token metadata cannot relax admission. outputTokens continues to include thinking for accounting and existing budget consumers.
Undo and recovery: Revert the repair commits, rebuild, renew the resulting native certificate from its contract and regenerate register pins. This restores the prior false refusal. No durable schema or ownership migration is introduced; old receipts remain readable.
Multi-machine posture: The calculation and validation are stateless and identical on each machine. No store, ownership transfer, replication demand or peer dependency changes. Native evidence is specific to the declared macOS Node 24.14.1 runtime.
Layer below: Read production-provider, provider-invocation, ProviderObservation, observationCheck and provider-path receipt consumers; exercised the actual effect doorway, transport reservation and invocation owners with captured usage. All 100 tests in production-provider-subscription pass, including acceptance, exact boundary, oversize, malformed/absent thinking, invalid answer quantities, accessor nonexecution and charge refusal. tsc --noEmit and build pass. The native harness contract case passed before certificate renewal; all 10 native-harness-contract tests then passed with the new certificate sha256:7caa6b1f52ff200c30483f076b4ebf8102ac926974bf81b0db788f84569c1c89. The delegated desk scripts regenerated the grounding inventory pins and register outputs; final checks are recorded in the repair PROGRESS.
Bug class: live-path
Bug evidence: tests/preview/fixtures/thinking-floor-opus-2026-10-20.json, recorded retrospective:0 of proofroom3-ps-20261020-131859. tests/assembly/production-provider-subscription.test.ts replays its exact usage through the adapter and owners. The full retrospective answer was not recovered; the numeric replay uses an explicit synthetic envelope. Group I live completion remains the combined build proof, not claimed here.
Hook bypass: none
Convergence: none
Prompt review: No prompt or semantic judgment changes. The existing fixture text findings below are unchanged; this repair changes numeric usage propagation and admission only.
Prompt finding: 0d4664ea9de7 | quoted-evidence | Existing unchanged fixture phrase; numeric usage repair does not alter this prompt.
Prompt finding: 14d7eeccc218 | quoted-evidence | Existing unchanged fixture phrase; numeric usage repair does not alter this prompt.
Prompt finding: 450c79237a95 | quoted-evidence | Existing unchanged fixture phrase; numeric usage repair does not alter this prompt.
Prompt finding: 45e37ea2e9e9 | quoted-evidence | Existing unchanged fixture phrase; numeric usage repair does not alter this prompt.
Prompt finding: 9781075d458e | quoted-evidence | Existing unchanged fixture phrase; numeric usage repair does not alter this prompt.
Prompt finding: b1bb3946362d | quoted-evidence | Existing unchanged fixture phrase; numeric usage repair does not alter this prompt.


Deferral: generated/register.json:1 | not-a-deferral=deterministically replayed register containing existing descriptions, not a new commitment

## Closing block

simplestRobustRoute: Carry the existing validated answer calculation through an optional observation field and the existing owner receipt, while retaining total usage and all monetary/resource checks. This is the simplest robust route: no retry, classifier, extra cap or policy mechanism. Start guard is valid bounded usage, end guard is answer-cap admission, limit guards remain charge, bytes, deadline, stop and uniqueness. No unattended live completion is claimed.
80/20: The source consumer mismatch is repaired and tested on both sides. Native evidence is renewed only after its contract passes. Full-suite and combined-build live proof are owned by the Studio pipeline per the repair brief.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
