# Change review — Bound process census and reconcile completed resource debits

Subject base: b5806d1e015dc650cdc1dee2e0accab05a849d4b
Review state: open
Reviewed content: none
Outcome: Stream the complete current-user process census with the existing normalized command projection before bounded materialization, and re-observe completed unresolved rows under their same live owner at existing admission pressure before returning actual Six debits. Selection and settlement are fenced against an in-flight sampler and pending membership evidence.
Affected rules: 26, 36, 37, 60, 61, 66, 74, 95
Affected floors: secrets — retain typed metadata only, no argv or private payload in failure records; spend cap — original Six allocations and ceilings remain, unknown and surviving work retain reservations; stop — queued stop/deadline checks remain in the existing waiter; no duplicate sends — no messaging path or send identity changes; durable intake — no journal/root rewrite or abandonment.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Physical resource admission and settlement alter whether a process may start. Complete fresh owner evidence and actual Six settlement must be independently reviewed.
Side effects: The query adapter spawns only the existing fixed ps census and kills only its own bounded query child on read failure. Same-owner reconciliation is read-only with respect to processes and returns a debit only after complete fresh census plus global recorded-incarnation absence. Existing waiter wake supplies retries; full status adds no queries and there is no new daemon.
Undo and recovery: Keep serving b580 until ordinary release gates. Revert the source candidate if rejected. Retain unresolved ledger rows and Six facts; never discard allocations or rewind conversation journals. Durable settlement precedes ledger removal and resumes idempotently after a write failure.
Multi-machine posture: UID census, PID incarnation evidence and the host lease remain local. Existing Six public authority and stores decide settlement. No peer, grant, credential, allowlist or trust changes.
Layer below: Read exact failed proof snapshots, owned launches and Six facts; distinguish failed census from generic model refusal. Native old2s/1MiB query reproduced MAXBUFFER with six isolated long-argv holders, all reaped; historical null errors do not establish that subtype. Read Ten decoder/membership and existing admission, cleanup and recovery contracts before implementation. Actual same-owner nine-debit positive and recorded-survivor negative exercise real Six allocations.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: Resource-pressure retry is single flight on the existing waiter wake, at existing sample cadence; failed, stale, unreadable or live-member evidence retains the debit. Status remains a passive projection.
Prompt review: No model prompt or parser behavior changed.
Decision: sampling-order-fence | Independent review found and actual fault-order reproduction confirmed raw-ledger recovery could settle before late membership publication; defer while sampling and exclude/recheck pending membership before settlement. | reported=.instar/lanes/resource-census-stream-1105-PROGRESS.md
Decision: census-stream | Preserve the existing command projection and full population before materialization; direct comm substitution would change the Ten command contract. | reported=.instar/lanes/train168-first-memory-model-start-1105.md
Decision: same-owner-settlement | Existing crash recovery skips a live owner; use bounded nonsignalling current-owner completed-row re-observation on admission pressure and retain unknown/survivor allocations. | reported=.instar/lanes/train168-first-memory-model-start-1105.md
Migration parity: Static import closure carries the new physical helper through the existing install/update path; no config default, hook, template, installed-agent file or grant format changed. Register is regenerated from the committed source.
Conformance boundary: Actual fixtures prove the named physical read and allocation decisions; historical OS error subtype and delivered operator alarm for persistent cleanup pressure remain unproved. The latter is a separate notice-wiring unit, not a delivered effect asserted here.

Subject (8 paths): register-source/owner-references/preview.json, tests/register/live-rule-four-admissions.test.ts, scripts/process-census-query.mjs, scripts/process-inventory.mjs, scripts/resource-owner.declarations.json, scripts/resource-owner.mjs, tests/integration/process-census-query.test.ts, tests/preview/resource-census-recovery.test.ts

## Closing block

simplestRobustRoute: Retain the existing census population, metadata and first4096 normalized command characters while streaming away tails already omitted by its decoder. Preserve2second and1MiB materialized bounds. Reuse current owner and Six settlement at admission pressure rather than add a recovery daemon or enlarge capacity.
80/20: Author runs focused physical and semantic tests, typecheck/build and register/source checks. Normal full, independent Astra and pre/post release gates remain desk-owned and required.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

Publication: Fixture reference uses the existing owner canonical content hash; replay output is shape-only and does not certify native compatibility or delivered alarms.
