# Change review — Keep cache freshness out of activation identity

Subject base: 06792bbb960e6f50b185a84907f704137b564958
Review state: open
Reviewed content: none
Outcome: Validate the complete subscription stamp while excluding only confirmed_at from the activation-bound projection. Darwin verification completed in the companion finish review. The pre-existing pre-launch failure reply gap is owned by w4-prelaunch-honest under observer #222/#224; it is outside this minimal outage fix.
Affected rules: 1, 24, 26, 36, 49, 70, 74, 77, 95, 101, 102, 113, 116
Affected floors: secrets — no new reads or disclosure; spend cap — existing admission unchanged; stop — unchanged; no duplicate sends — no delivery or retry changes; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Changes the effective configuration digest used by provider admission, with real captured cache fixtures and boundary tests.
Side effects: Existing profiles that include a stamp need their digest re-derived once because the projection changes; subsequent freshness confirmations do not invalidate them. Identity, content hash, stamp presence and effective restrictions still participate. All inspection consumers share this projection.
Undo and recovery: Revert this commit and re-derive profile/activation bindings together. Do not delete cache files or automatically renew grants. An old digest safely holds calls until the desk updates its consumers.
Multi-machine posture: Machine-local, deliberately: each host inspects its own isolated CLI cache. No ownership transfer, replication or remote authority is introduced.
Register maintenance: Replayed generated register artifacts against the source repair commit with build-register; no pin was hand-edited.
Layer below: Complete stamp shape validation, cache identity/content fields, activation digest comparison, and physical child dispatch test. The WSL resource shim returned exit 125 for a standalone node version probe; the subsequent Studio finish passed all 81 subscription tests and all 9 native harness contracts on Darwin.
Bug class: integration
Bug evidence: reproducer=tests/assembly/production-provider-subscription.test.ts
Hook bypass: none
Convergence: none
Decision: server-policy-freshness-projection | Validate confirmed_at but omit it from the activation projection because restamping unchanged policy changes freshness, not authority. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-server-policy-repair-141637-PROGRESS.md
Decision: server-policy-reply-evidence-block | Leave the pre-launch reply repair open because observer 106 requires recorded live/proof-room journal shapes and the Mama charter explicitly marks those roots unreachable. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-server-policy-repair-141637-PROGRESS.md

## Closing block

simplestRobustRoute: Exclude one validated freshness field from the existing digest; preserve the complete schema and all identity/content bindings. No watcher, grant renewal or retry mechanism is needed.
80/20: The Studio finish closes the disclosed WSL physical-launch and conformance evidence gaps; this record retains their history. The desk still owns independent review, cutover and live restoration evidence.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
