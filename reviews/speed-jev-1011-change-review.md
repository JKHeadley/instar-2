# Change review — isolate Jev latency and reuse bounded audience reads

Subject base: 208a222111a384b04db9bff4ab7f02ba7d452703
Review state: open
Reviewed content: none
Outcome: Reduce Jev admission latency on the requested memlive base using the existing speed-hold implementation, and prove the HTTP/client/worker timing distinction on recorded repository fixtures.
Affected rules: Rules 1, 4, 13, 26, 28, 29, 34, 36, 41, 49, 55, 57, 58, 60, 63, 70, 74, 75, 77, 95, 101, 102, 111, 113 and 116; purpose least revelation.
Affected floors: secrets — unchanged; spend cap — same durable Jev reservation; stop — unchanged; no duplicate sends — reopen/drain checked; durable intake — unchanged.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Reuse the existing bounded read-only optimization without altering a predicate, prompt, model route or parser; add a targeted replay of the shipped Jev boundary.
Side effects: Four read-only identity observations run concurrently between two count observations; physical read concurrency becomes four per probe. Both worker and host still revalidate disclosure. All six successful reads and every failure predicate remain. The shared verifier also benefits other callers; this is exactly the speed-hold change, not a second independent saving.
Undo and recovery: Revert this unit's shared-verifier diff and its matching tests to restore sequential reads. No durable schema, migration, grant or stored state changes. After speed-hold lands, retain its identical verifier and remove only this unit's replay if needed.
Multi-machine posture: Machine-local request scheduling only. Each owner still revalidates current authority and audience; lease, replication, peer receipt and spend admission stay unchanged. The local replay uses single-machine journals and does not claim a replicated-provider latency measurement.
Layer below: Inspected worker guarded ports, reply-jev-reserve and checkReply, the launcher's callJev, typesafeKey, requireGroupDisclosure and groupMembershipReader. Jev already batches ten questions into one in-process fetch, with no per-question process, client construction or HTTP retry. Credentials are a synchronous environment read. The injected-clock baseline isolates the serial membership reads as the six seconds. The host adds its own probe, absent from the desk's worker-only replay.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath unset and shared hooks directory contains sample files only.
Convergence: none
Decision: reuse-audience-optimization | Reuse group-disclosure.ts and its three regression files byte-for-byte from speed-hold 6382465770c7032308b2f59b2ca9554c554e02e1; do not invent a second Jev client or bypass any fresh disclosure check. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/speed-jev-1011-PROGRESS.md
Decision: distinguish-jev-timing | Replay recorded update 969390330 through the real worker and shipped client body with loopback HTTP, separately measuring reservation and HTTP wall time and injected admission time; compare worker-only and worker-plus-host probes. No fresh external model call or under-15-second claim. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/speed-jev-1011-PROGRESS.md
Decision: retain-check-meaning | Keep all ten questions, usage recording, escalation routing, grants, count brackets and identity predicates. No semantic acceptance or refusal change. Reuse recorded-shape replay and boundary controls. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/speed-jev-1011-PROGRESS.md
Decision: publish-shared-source-pin | Regenerate the seven publication files from committed source 1ef04e7a56274be2a9e30292e5fb679b97f594e0 so the gate checks the actual verifier. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/speed-jev-1011-PROGRESS.md
Verification: Before editing the verifier, the local replay passed with worker stage 6164 ms and worker-plus-host stage 12164 ms. After reuse, the same cases pass at 3164 ms and 6164 ms. Each has one HTTP request carrying all ten questions, identical scores and usage, both reviews, and exactly one send after reopening/draining. Injected clock: 1000 ms per membership read plus recorded 164 ms Jev duration, other local work zero. Local HTTP and reservation timings are printed separately; they are not TypeSafe or Studio timings. Typecheck passed. Targeted run: 74 passed; three unchanged group-carry-relocation launcher cases refused startup on WSL and are assigned to the Studio per the remote charter. Final-head gate results are recorded in the remote builder report.

Subject (12 paths): tests/preview/group-disclosure.ts, tests/preview/group-disclosure.test.ts, tests/preview/group-membership-io.test.ts, tests/preview/group-carry.test.ts, tests/preview/jev-stage-latency.test.ts, generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json

## Closing block

simplestRobustRoute: This is the simplest robust route: reuse the already-proven independent-read overlap at the actual latency source and preserve existing batched Jev. New client machinery would prevent no demonstrated failure. Start guards remain current disclosure authority and audience; end-state proof is identical recorded verdicts and one captured send after replay; limits remain bounded fan-out four, existing per-read timeouts, spend reservations and stop. This is fixture evidence for gate submission, not an unattended live deployment claim.
80/20: Controlled before/after and both refusal and admitted paths justify the shared read scheduling change; no speculative client pooling, caching, probe removal or retry policy change. Studio real replay and independent landing review remain the desk's explicitly assigned gate.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
