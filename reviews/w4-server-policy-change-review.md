# Change review — Reviewed restrictive subscription server policy

Subject base: afa6be392876eb17c2789651090fa90b83a81f92
Review state: open
Reviewed content: none
Outcome: Restore subscription profile inspection for the captured Claude Code 2.1.280 restrictive server policy, with unknown fields and values held before launch and every accepted cache file bound to the managed configuration digest, excluding validated cache freshness.
Affected rules: 1, 4, 26, 32, 34, 36, 44, 45, 49, 57, 66, 70, 74, 95, 101, 105, 113, 115, 116
Affected floors: secrets — no credential reads or new disclosure; spend cap — unchanged activation and accounting; stop — existing launch stop remains; no duplicate sends — no retry or delivery change; durable intake — untouched
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Provider launch admission changes; exact configuration acceptance and stale-digest refusal require real captured bytes and physical-route tests.
Side effects: All users of subscription profile inspection share the policy check. Adding, changing or removing accepted effective policy or stamp identity/content invalidates the managed digest. The complete stamp is validated, but confirmed_at is excluded from the activation projection; a valid timestamp-only refresh retains the binding. A desk migration must update the profile, conversation/tool/session activation records and sealed grants together. Profiles with no server cache retain their existing digest. Unknown policy shapes fail closed with a field-specific reason.
Undo and recovery: Revert this change and its conformance declaration together to restore the blanket refusal. The desk keeps predecessor profile, activation, authority and launcher records for rollback. With the server cache still present, the old build remains held; never delete server policy to bypass that hold. No automatic resend or reservation reset is introduced.
Multi-machine posture: Machine-local, deliberately: server policy is a CLI cache in the machine's isolated profile. Each machine inspects its own paths and pins its own effective policy; no cross-machine authority transfer is added.
Layer below: Physical file inspection and digest construction; captured cache bytes compared with the live files; profile digest matching in validateSubscriptionActivation; authority scope matching in resolveActivationAuthority; grant-tools-for.sh and grant-session-for.sh reviewed read-only. Refreshed native harness conformance for the changed host closure.
Bug class: integration
Bug evidence: reproducer=tests/assembly/production-provider-subscription.test.ts
Hook bypass: none
Convergence: none
Decision: server-policy-shape | Only allowed:false restrictions and the observed token stamp kind are admitted; no upstream stamp-hash interpretation is needed because both contents enter the existing managed digest. | reported=reviews/w4-server-policy-change-review.md

Scope: MUST-FIX 2 is a pre-existing gap owned by w4-prelaunch-honest. Per observer #222/#224, the outage fix stays minimal. At the completed Darwin step-1 checkpoint (2026-10-10 14:29 PDT), the companion had no unit Astra YES in lanes/pipeline/driver.log and its own report ended BLOCKED; it was not merged and this unit did not wait. Honest pre-launch replies remain the companion unit's responsibility.

## Closing block

simplestRobustRoute: This is the simplest robust route: replace the existing blanket hold with an exact reviewed shape check and reuse its existing managed digest and activation gate. No new policy engine, approval mechanism, prompt, output parser or delivery behavior.
80/20: One physical helper and focused real-fixture/refusal tests restore the known configuration while preserving the unknown-policy hold. Desk deployment and independent landing review remain separate from builder verification; this record makes no live-restoration claim.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
