# Change review — Verify server-policy freshness repair on Darwin

Subject base: 03351d139a0b1db1d878c0d4be0ce7f20b93ba2d
Review state: open
Reviewed content: none
Outcome: Certify the changed native harness composition after the freshness repair and verify real physical launches on Darwin. Valid timestamp-only cache refreshes keep working; unknown policy and changed identity/content remain held.
Affected rules: 1, 4, 24, 26, 32, 34, 36, 44, 45, 49, 57, 66, 70, 74, 77, 95, 101, 102, 105, 111, 113, 115, 116
Affected floors: secrets — no new reads or disclosure; spend cap — admission and accounting unchanged; stop — existing latch verified; no duplicate sends — no reply or retry change; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Native harness conformance follows a physical provider-admission change; physical launch, fail-closed neighbors and exact composition evidence are required.
Side effects: The conformance declaration now matches the freshness projection's actual closure. Profiles prepared with the full stamp digest must be re-derived once with every activation/grant consumer. Timestamp-only refreshes then retain that binding. Updated desk cutover instructions mark old candidates and digests obsolete.
Undo and recovery: Revert the freshness source change and conformance together, then let the desk restore matching profile/activation/authority/launcher records together. Reverting can restore the original hold; never delete policy files or retry unknown work.
Multi-machine posture: Machine-local, deliberately. Each host inspects its own CLI cache and binds its own profile; this finish certifies the declared Darwin native harness only. No cross-machine authority or ownership change.
Layer below: Rebuilt dist with npm run build; the architecture checker re-derived the composition digest; all 9 native harness contracts passed against it, including actual confined launch, durable owner admission, stop, refusal and timeout. All 81 subscription tests passed, including six physical child commands across the initial and timestamp-refreshed invocations and zero commands for unsafe policy.
Bug class: integration
Bug evidence: reproducer=tests/assembly/production-provider-subscription.test.ts
Hook bypass: none
Convergence: none
Decision: server-policy-minimal-finish | MUST-FIX 2 is a pre-existing gap owned by w4-prelaunch-honest under observer #222/#224. At step-1 completion on 2026-10-10 14:29 PDT, driver.log had no unit Astra YES and the companion report was BLOCKED; do not merge or wait. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-server-policy-finish-PROGRESS.md

Evidence: Darwin subscription 81/81 (23.79 s total); native harness 9/9 (24.54 s total), both foreground, nice -n 10, --maxWorkers 1, --configLoader runner. Build, typecheck and check-architecture exited 0. No load generator or live modification. Real external parser bytes are the three files in tests/fixtures/claude-server-policy-2.1.280; no prompt, model-output parsing or reply judgment changed, so observer #106 model-output replay is owned by the companion, not claimed here. The desk owns full-suite and live-channel cutover proofs under Rules 34/62.

## Closing block

simplestRobustRoute: This is the simplest robust route: retain the existing exact cache parser and activation binding, omit only validated freshness, and certify the existing native composition with its contract. No watcher, automatic grant renewal, delivery mechanism or policy bypass is added.
80/20: Darwin reproduces neither the 33 WSL physical-launch failures nor stale native conformance; all targeted tests pass. Submit the minimal outage repair with the separate reply gap and live cutover obligations explicitly owned.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
