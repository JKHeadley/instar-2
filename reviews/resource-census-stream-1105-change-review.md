# Change review — Bound process census and reconcile completed resource debits


## M1 — 1.X FIRST researched reuse decision

Before this repair, the existing1.x implementation was inspected at `/Users/dabombstudio/.instar/agents/echo/.instar/shadow-install/node_modules/instar/dist/` (instar1.3.1672). Exact deployed implementation sources and SHA256:

- `monitoring/ResourceSampler.js`: `50f7f2e340326ad8f3625ad9fd99dd176d246662d3f9b60206c063b1d24059fe`. Existing batched PID metadata sampling and single-flight cadence are reusable patterns. It is explicitly off-hot-path telemetry, samples tracked PIDs with5second/1MiB queries and never gates; direct substitution would omit complete UID membership and change the2second contract.
- `monitoring/ProcessFootprintMonitor.js`: `b377fe0a815b1d1fcf41e9c895c024e7434fcc3096b785631b2838b57fc548b7`. Its actual defaultListProcesses enumerates whole-host process metadata but uses15seconds/32MiB and returns[] on failure as no observational sample. Reusing that query for cleanup would enlarge caps and collapse unknown into empty.
- `monitoring/OrphanProcessReaper.js`: `b59bd7d29c0b1acf47e34c1417bc110f23c239a317702872212b69822eea53b6`. Existing tracked/project-orphan versus external/report-only ownership boundaries are appropriate. Its reaping/signalling role does not establish Six settlement and must not add control authority to this nonsignalling repair.
- `core/hostSpawnSemaphore.js`: `2b212dfc3d3021c6aadac315c240e369b1f3b7347f16bba61aad774204655e73`. Locked read/prune/decide/write and same-host dead-PID+stale-heartbeat reclaim protect1.x spawn slots. release(id) removes that holder; it does not prove a still-live2.x owner’s launch descendants quiescent or return a Six multi-domain ResourceAllocationSet.
- `monitoring/FrameworkProcessProvenance.js`: `daeb60189add39041c5b73173fa2d827037d68ef6f0d5a95453b3ad52dd1ed5b`. Existing incarnation/executable/inode/path evidence and protected-unknown bounded retry support the evidence discipline. Its targeted executable proof is not a complete UID/member absence census.

Reuse selected: preserve the already-wired2.x Ten inventory decoder/membership and the existing public Six allocation/settlement authority; reuse the current admission waiter wake rather than introduce a daemon or another capacity ledger. Stream the existing command projection before bounded materialization. This follows the1.x batched-read, single-flight and protected-unknown patterns while retaining the actual2.x proof and authority subjects. The comparison is scoped to the inspected1.x modules, not a claim that all1.x code lacks alternatives. The initial publication omitted this required brief comparison; it is now included before the repaired submission, with the external report retaining the honest timing.

Review constraint alignment: Rules60/61/116 directly govern resource ownership and fixture lifetime;26/36 govern physical observations/parsing;66/95 govern refusal;74 governs review;44 covers the existing installation closure. Rules38/75/105 remain reviewed context/native conformance constraints, not new supervisor/model-call/channel behavior. No constitutional document changes.

Subject base: b5806d1e015dc650cdc1dee2e0accab05a849d4b
Review state: open
Reviewed content: none
Outcome: Stream the complete current-user process census with the existing normalized command projection before bounded materialization, and re-observe completed unresolved rows under their same live owner at existing admission pressure before returning actual Six debits. Selection and settlement are fenced against an in-flight sampler and pending membership evidence.
Affected rules: 26, 36, 37, 38, 44, 60, 61, 66, 74, 75, 95, 105, 116
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
Convergence: none
Convergence note: Resource-pressure retry is single flight on the existing waiter wake, at existing sample cadence; failed, stale, unreadable or live-member evidence retains the debit. Status remains a passive projection.
Prompt review: No model prompt or parser behavior changed.
Prompt finding: 4106b49fff07 | protocol-literal | Existing unchanged protocol/status text asserted by tests; no new keyword intent decision — fixture-phrase tests/preview/journal.ts <- tests/preview/topic-awareness.test.ts: "you attempted nothing outside this reply, so never call an avenue tried; a missi"
Prompt finding: 849db3a6296a | protocol-literal | Existing unchanged protocol/status text asserted by tests; no new keyword intent decision — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: 85544c20941f | protocol-literal | Existing unchanged protocol/status text asserted by tests; no new keyword intent decision — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-conversation-session.test.ts: "your messages are kept and i'll answer them then; you don't need to resend them."
Prompt finding: e8708c7fea24 | protocol-literal | Existing unchanged protocol/status text asserted by tests; no new keyword intent decision — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel; disclose unknown sources."
Decision: sampling-order-fence | Independent review found and actual fault-order reproduction confirmed raw-ledger recovery could settle before late membership publication; defer while sampling and exclude/recheck pending membership before settlement. | reported=docs/release-evidence/train-174-p2-report.md
Decision: census-stream | Preserve the existing command projection and full population before materialization; direct comm substitution would change the Ten command contract. | reported=docs/release-evidence/train-174-p2-report.md
Decision: same-owner-settlement | Existing crash recovery skips a live owner; use bounded nonsignalling current-owner completed-row re-observation on admission pressure and retain unknown/survivor allocations. | reported=docs/release-evidence/train-174-p2-report.md
Integration note: train-174 repointed the three Decision locators above to its committed report docs/release-evidence/train-174-p2-report.md (train-174-record-repair) and changed no other sentence of this record; this note was last touched in the train's final record commit so the locators resolve against the final report.
Migration parity: Static import closure carries the new physical helper through the existing install/update path; no config default, hook, template, installed-agent file or grant format changed. Register is regenerated from the committed source.
Conformance boundary: Actual fixtures prove the named physical read and allocation decisions; historical OS error subtype and delivered operator alarm for persistent cleanup pressure remain unproved. The latter is a separate notice-wiring unit, not a delivered effect asserted here.

Publication: Fixture reference uses the existing owner canonical content hash; replay output is shape-only and does not certify native compatibility or delivered alarms.

Native conformance: Existing merge-live-conformance --renew tool ran the actual ten local native cases before and after. Before9/10 only the stale certificate failed; after10/10 PASS. The tool alone updated the computed conformance hash to sha256:2bfdee011906e84e71d6a3e4e5d2860f5f1d2343342f40c74c734c9ce88bcb61. Evidence: .instar/lanes/resource-census-stream-1105-native-renewal/{before,after}.json; no provider or live model calls.

Register publication: Shape-only replay generation sha256:2069fcec89299141b913cfdab0902a643ff3ae125af3da938c89c6f26397db15 from source a17ada1587777dae8291369396836fbb22b86151; register --check and lint (architecture plus register wiring, issues0) pass. Independent peer source rereview YES on fca3a8667; canonical Astra/full/combined pre/post gates remain required. Historical author-review check remains pending and is not represented as passing.

Astra round1 repair: The real survivor fixture now has the same intrinsic25second finite self-exit principle as the ordering fixture. A real child test with unavailable cleanup observations waits for normal code0 self-exit without a signal. Exact-incarnation proof still gates early cleanup. Production source and limits are unchanged.

Round1 repair validation: Real finite-survivor and unavailable-observation fallback cases2/2 PASS (26.895s, normal code0 self-exit25.029s); typecheck PASS; canonical fixture hash refreshed; shape-only register generation cf3f067431b1784cbb37ad4d084b24ad9d21634f529bc8e1f317d675b00b0263 from4c3e83425a2a39837121faa6afcdc4fb8af14c1d passes --check; lint architecture and register wiring pass with issues0. Existing production source is unchanged from5871; fresh canonical unit review remains required.

Subject (8 paths): register-source/owner-references/preview.json, tests/register/live-rule-four-admissions.test.ts, scripts/process-census-query.mjs, scripts/process-inventory.mjs, scripts/resource-owner.declarations.json, scripts/resource-owner.mjs, tests/integration/process-census-query.test.ts, tests/preview/resource-census-recovery.test.ts

Deferral: docs/defects/rule-36-genuine-parser-captures.md:9 | not-a-deferral=Exact main text restored by the train; actual reviewed deadline declarations unchanged.
Deferral: docs/defects/rule-36-genuine-parser-captures.md:10 | not-a-deferral=Exact main text restored by the train; actual reviewed deadline declarations unchanged.
Deferral: generated/conversion.json:1 | not-a-deferral=Regenerated governing text, not a new commitment.
Deferral: generated/register.json:1 | not-a-deferral=Regenerated governing text, not a new commitment.
Deferral: docs/evidence/train-192-notice-owner/constitution-attributed-statements-change-review.md:29 | not-a-deferral=Copied historical review evidence from live quotes the old deferred:slack-intake-v1:36 deadline refusal; the train-188 merge preserves it verbatim and makes no new deferral. Current register verification passes.
Deferral: docs/evidence/train-192-notice-owner/constitution-one-constitution-change-review.md:30 | not-a-deferral=Copied historical review evidence from live quotes the old deferred:slack-intake-v1:36 deadline refusal; the train-188 merge preserves it verbatim and makes no new deferral. Current register verification passes.
Deferral: docs/evidence/train-192-notice-owner/constitution-person-decides-change-review.md:29 | not-a-deferral=Copied historical review evidence from live quotes the old deferred:slack-intake-v1:36 deadline refusal; the train-188 merge preserves it verbatim and makes no new deferral. Current register verification passes.

## Closing block

simplestRobustRoute: Retain the existing census population, metadata and first4096 normalized command characters while streaming away tails already omitted by its decoder. Preserve2second and1MiB materialized bounds. Reuse current owner and Six settlement at admission pressure rather than add a recovery daemon or enlarge capacity.
80/20: Author runs focused physical and semantic tests, typecheck/build and register/source checks. Normal full, independent Astra and pre/post release gates remain desk-owned and required.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
