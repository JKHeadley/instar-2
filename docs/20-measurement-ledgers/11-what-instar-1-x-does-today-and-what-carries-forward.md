## 11. What Instar 1.x does today and what carries forward

**Rule — the audited 1.x layer below is described as code behaves, not as 2.0 aspires.** Rules 39,
41, 58, 60, 75, 86, 87 and 111; **checks: P16-NF-05–14/21–35/39–46/49/51**. The audit covered the
named 1.x modules and their matching operator guidance; typed distinctions required by 2.0 but
collapsed in 1.x are corrections below, not carried-forward guarantees.

| 1.x module | Behavior and guarantee carried forward | Incident that earned it |
|---|---|---|
| `TokenLedger` and `TokenLedgerPoller` | Claude transcript scanning retains an incremental offset per source. Source files are read-only. Identity or head replacement resets scanning safely. Long scans yield. Poller ticks do not overlap. Codex rollouts take a separate whole-file path. The last cumulative per-session total is upserted by session id, replacing prior totals rather than adding them. Cached input, output, reasoning output and primary/secondary quota percentages occupy separate numeric columns. Repeated identical and growing snapshots must therefore remain one session row. However, `CodexRolloutParser.num()` converts an absent or malformed token category to numeric zero, and `ingestCodexSession()` persists that zero without any source-presence field. An existing 1.x row therefore cannot prove that its zero was explicitly reported. Codex cumulative rows are intentionally absent from Claude `token_events`, `summary()` and `BurnDetector`. Aggregate Codex visibility is not per-exchange coverage or burn attribution. Sources: `TokenLedger.ts` schema/upsert and `ingestCodexSession`, `TokenLedgerPoller.ts`, `CodexRolloutParser.ts`. | A 119,000-file, 12 GB history blocked the event loop. A 202 MB ledger with about 390,000 sentinel rows made synchronous attribution backfill stall health into a boot failure loop. The 2.0 correction is a registered cumulative-session subject or an explicit unsupported-attribution limitation, never promotion of cumulative snapshots into invented calls. Migration reparses original rollout evidence where available to distinguish absent, malformed and explicit zero categories; without it, an origin-lost legacy zero stays uncertain. |
| `TokenLedger.ingestLine()` Claude transcript path | A Claude assistant line with a usage object becomes one `token_events` row. The ingest path applies `?? 0` independently to input, output, cache-creation and cache-read categories, so an absent or runtime-null value becomes numeric zero. The table stores those four numeric columns but no category-presence flag. A retained Claude zero therefore cannot prove whether the source reported zero. Migration reparses the original Claude transcript bytes when available and preserves absent, null and explicit numeric zero as distinct states. Without those bytes, the numeric value remains legacy evidence with uncertain origin. | A plausible zero can otherwise hide missing metering and distort coverage or fresh-token burn after migration. The same lost-origin discipline must cover Claude events as well as Codex cumulative rows. |
| `TokenLedger` | Schema additions precede indexes and queries that use them; migrations are idempotent; native database failure is surfaced through the existing availability path | Creating the attribution index before adding its column left existing installations with `no such column` and permanent token-route unavailability |
| `TokenLedger`, `FeatureMetricsLedger` and `BurnDetector` | Missing attribution remains visible; coverage is distinct from burn; a finished burst is not an active burn. `TokenLedger.byAttributionKey()` computes 1.x `freshTokens` as input plus output plus cache-creation tokens, while its gross total additionally adds cache-read tokens; `BurnDetector` uses that fresh value when present. Cache-read tokens therefore remain visible but do not increase 1.x fresh burn. The 2.0 design carries that distinction as an explicit registered amount selection rather than inferring one amount from a shared `tokens` unit. | Putting every older event in one pre-attribution bucket produced a permanent 100% burn alarm; a completed burst repeatedly produced a contradictory projected-zero burn notice for a full day |
| `FeatureMetricsLedger` call outcomes | Its caller-supplied classifier records `fired` when the gate acted and `noop` when it ran and took no action. A completed call without a usable classifier is `unclassified`. `shed` means the circuit refused before provider invocation, so it is not a real round trip. Errors and programmatic events remain separate. | Treating calls with no verdict classifier as no-op fabricated a 0% fire rate. |
| `FeatureMetricsLedger` usage and model views | Usage presence counts rows with a reported value, including zero, instead of summing tokens. Feature-by-model and aggregate-by-model partitions come from the same bounded read, and read models rebuild from raw truth. | One large token row could otherwise hide many calls with missing usage; repeated full-window scans multiplied synchronous SQLite work. |
| `FeatureMetricsLedger` coverage denominator and exemptions | The 1.x `usageCoverage` denominator includes only successful `fired`, `noop` and `unclassified` call rows. Error rows are reported beside it but do not enter that denominator. Claude `interactive-pool` success rows are excluded, `gemini-cli` is marked exempt, and an empty success denominator renders numeric zero. These are 1.x presentation rules, not complete-exchange coverage and not guarantees carried into 2.0. The 2.0 migration keeps the old numerator, denominator, exclusions and exemption marker as labelled legacy fields while its canonical exchange coverage remains undefined on an empty denominator and keeps errors in the observed-exchange population. | A numeric 1.x zero can mean no eligible successful rows rather than measured zero coverage. Exclusion and exemption can also hide unmetered real exchanges if copied as authority. |
| `BenchmarkDivergenceAnalyzer`, `benchmarkDivergenceCore` and `FeatureMetricsLedger` quality/by-model rows | The serving-lease holder reads bounded matured windows and bounded peer aggregates. Stale mirrors, unverifiable hashes, prompt drift and mixed prompt identities stop both positive and negative conclusions. Missing peers, orphaned outcomes and incomplete grading stay partial or insufficient. Production and benchmark samples each retain a Wilson half-width; the larger uncertainty participates in the advisory verdict. The 1.x quality read also groups winning grades by `evidenceStrength`, `ruleId` and grading `rung`, exposes those as `byStrength`, `byRule` and `byRung`, and puts `selfReportShare` plus `selfReportOnly` beside its otherwise blended flat grade distribution. In 2.0, section 7 preserves the disclosure rather than the private classification scheme: current strength resolves through One's `Evidence`, current grading rule/method resolves through Nine's `Grade` and `BenchmarkEvaluation`, and old strength/rule/rung values remain labelled legacy evidence. The new read segments strength before any rate and states self-report/attestation and inference limits; it never emits a blended headline rate. | A stale, drifted, tiny or interested-party-graded benchmark must not manufacture praise or blame for a model. One missing machine or a self-report-only population must not disappear behind a plausible aggregate. |
| `QuotaTracker.getState()` cache and file read | A cached state inside the read cooldown returns before any file existence or freshness check. Outside the cooldown, a missing file returns `null`. A stale file also returns `null`, but on non-Codex paths it keeps the old cache and updates `lastRead`, so the next call inside the cooldown returns that stale cached value. Codex clears the cache on stale or corrupt input. Corrupt non-Codex input may return the prior cache immediately. | The 2.0 design corrects these collapsed and contradictory states with typed missing, stale, corrupt and unsupported observations; its migration fixture preserves the stale-null-then-cached-value counterexample. |
| `QuotaTracker.shouldSpawnSession()` | Codex unknown state refuses session creation before provider invocation. Most missing non-Codex state fails open. Non-authoritative or implausible estimates use bounded degraded handling. The separately injected pool-placeability path has its own unknown rules. The quota read does not schedule by itself; callers choose to invoke this decision helper. | A non-authoritative 186% estimate stopped all work; an absent file warned 902 times per day; a provider with 1.3 million observed tokens still reported 0%; account-blind allowance disagreed with placement and fed a respawn loop. |
| `ResourceLedger`, `ResourceLedgerPoller`, `ResourceSampler` and `ProcessFootprintMonitor` | The SQLite ledger durably records breaker `circuit-open`/`circuit-recover` separately from session-sentinel `throttle`/`quota`/`529`; summaries expose counts, first/last time and breaker trips/hour. Event identity is `source:timestamp:process-local-sequence`: same-process same-millisecond emissions remain distinct and an equal identity is ignored, but sequence resets on restart, so a repeated timestamp/sequence can collide and must not be overstated as a cross-restart identity guarantee. CPU/RSS history is observe-only and bounded. Sources: `ResourceLedger.ts:eventId/recordRateLimitEvent/rateLimitSummary/rateLimitByKind` and `ResourceLedgerPoller.ts:start`. | Multiple full agent stacks and heavy Chromium/Electron tool servers accumulated until the host hit an `os_refcnt` kernel panic on 2026-06-26; a load-average misread caused false heavy-load deferral on 2026-06-19. The 2.0 fixture must cover two same-ms events, equal replay, restart collision and durable restart recovery. |
| `ResourceSampler` failed own-resource reads | The 1.x sampler records CPU as zero when its own CPU read fails, when no prior baseline exists or when wall time does not advance. It records RSS as zero and heap as absent when its own memory read fails, then includes those values in the aggregate. These are synthetic failure zeros, not observations of idle CPU or empty memory. Session PID sampling instead omits a PID when the batched read fails or returns no row. The 2.0 migration must preserve the source distinction where available and mark an old zero with lost origin as uncertain rather than observed zero. | Read-only instrumentation was kept from crashing the server, but its fallback can turn missing evidence into a plausible number. |
| `ProcessFootprintMonitor` production scan failure | `defaultListProcesses()` catches a failed `ps` call and returns an empty list. The monitor treats that successful empty return as a new sample with zero processes and zero RSS. Only a thrown injected `listProcesses` call keeps the last sample or returns an unretained zero when none exists. The 2.0 collector records scan failure or genuine observed empty census as different states. An old zero whose origin cannot be recovered remains uncertain. | A quiet-looking footprint point can be a failed host scan, masking the process accumulation the monitor exists to reveal. |
| `routingSpendView` and `routingPriceAuthority` | Immutable usage is priced on read; unpriced metered usage is loud; subscription access is labelled not per-token billed; provider settlement and internal derivation remain distinct. For a declared subscription, `routingSpendView` divides monthly price by 30.4375 average Gregorian days and multiplies by the door's distinct active UTC calendar days in the window. It displays the full derivation. The same door-level amount is attached to each model row for context, while totals deduplicate by door and count it once across models. The 2.0 compatibility view preserves that calendar allocation. A token-share view would be a separately labelled policy addition or explicit replacement, not a description of current behavior. | Earlier spend surfaces could make missing price or subscription billing look like $0 per-call cost and could blur reporting totals with committed money |
| `ProviderCostReportStore`, `ProviderReconciliationSweep` and conditional `AgentServer` wiring | The reporting store retains valid, invalid and comparison rows. Its provider, internal and committed columns can describe different populations. A failed sweep can leave no row or a durable prefix while returning zero counters. Construction is conditional, and the audited production tree has no producer callsite. Detailed preservation and activation requirements follow this table. | Provider-reported cost can disagree with internal pricing without rewriting committed money. Invalid or absent evidence, mismatched populations and incomplete sweeps must remain visible. |
| `MeteredSpendLedger` and its `AgentServer` wiring | The enabled money layer appends before updating its disposable totals cache and rebuilds that cache from its JSONL source. Its timer expiry, read-failure and malformed-row behavior can release or omit liability without decisive evidence. Detailed durability and migration requirements follow this table. | Append-first accounting and concurrent reservations protect cap headroom. Timer expiry and permissive rebuild are availability shortcuts, not execution or charge evidence. |
| `RoutingSpendCapsStore`, `MeteredSpendGate`, `moneyLayerEnable` and `meteredCallEntry` helper path | `adjustCaps()` changes positive caps but does not arm a door. `setGoLive()` is a separate operator action that arms/disarms one door and designates its machine. `MeteredSpendGate.admit()` refuses an absent or disabled go-live record before checking caps. The helper checks freeze first, then calls the current `servingReady` predicate; requested enablement or construction alone is not serving readiness. Only after both checks does it enter the cap/reservation gate. These are real helper/control-path guarantees, and the readiness probe exercises the gate with a no-network provider. | A positive cap must not become permission to spend. A disable flag captured only at construction could remain cosmetically off while calls still admitted; placing freeze inside a failed money layer could take down the emergency brake with the machinery it must stop. |
| `meteredCallEntry` production dispatch integration | No 1.x production paid-provider call invokes `admitMeteredCall`; the module names that dispatch seam as future work. Probe and helper evidence therefore do not prove that a real paid exchange is protected end to end. | A chokepoint that no paid dispatch calls is a required integration seam, not current spend protection. |

**Rule — 2.0 records, but does not silently inherit, 1.x's separate door activation and live
readiness.** Rules 4, 26, 40, 42, 49, 60, 82, 86 and 95; **checks:
P16-NF-35/45/49/51**. In 1.x, `setGoLive()` is genuinely separate from positive caps and the helper
checks `servingReady` before entering the cap/reservation gate. The approved 2.0 Part Eight and Part
Ten designs contain neither an equivalent arm/disarm operation nor the requested current readiness
read. `SEAM-LEDGER.md` row 65 REFUSES
`design-measurement-ledgers-seam-request-paid-door-readiness.md` as beyond those approved designs.
Section 16 decision 8 therefore chooses whether 2.0 intentionally retires the 1.x arm step and
treats positive-cap plus not-frozen as open, or amends both designs to carry separate activation
and readiness forward. Until the choice is recorded, the activation-policy arms are
non-executable and no test may assume either behavior. The separate GRANTED cap/freeze scope in
`seam-response-effects-followup.md` remains unchanged. The 1.x production-dispatch gap also
remains: neither helper fixtures nor a readiness probe proves a real paid call traverses the
doorway.

**Rule — the 1.x provider reconciliation populations remain distinct.** Rules 13, 26, 39, 58,
86 and 111; **checks: P16-NF-14/17/36/44**. When the routing-spend view is enabled and
construction succeeds, `AgentServer` opens a reporting-only provider store. It prunes that store
at boot. It also starts a reconciliation timer. The store retains valid and invalid provider
reports as separate rows inside its configured horizon. An invalid present numeric becomes an
invalid row with null numeric fields. That invalid row does not enter aggregates. For each metered
call, the 1.x store selects the latest valid captured report, so a response report and a later
provider report do not both enter its aggregate. The provider column selects latest valid reports
whose report timestamps fall between the inclusive sweep endpoints. The internal column consumes
whole UTC daily token buckets. Its admitted bucket start can be as early as `sinceMs - one day`,
so it can include a pre-window call. The committed column is the key's current lifetime committed
spend, so it can include older bookings. `ReconRecord` stores one nominal start and end beside
those three values. It stores no per-column population or time basis. A completed 1.x sweep
therefore does not prove a matched comparison window.

**Rule — the 1.x reconciliation writer exposes partial prefixes and missing presence.** Rules 26,
39, 41, 58, 86 and 111; **checks: P16-NF-14/17/36/44/49**. When provider evidence has no
matching internal key, the sweep persists `internalUsd: 0`. It records no field proving whether
that zero was derived from present internal evidence. The sweep appends each key's comparison and
may emit its signal before moving to the next key. It has no enclosing sweep transaction. It has
no persisted completion marker. Failure before the first append leaves no comparison row.
Failure on a later key preserves every earlier durable row and signal. The outer catch still
returns `{compared: 0, drifted: 0}` for either failure. Those counters prove neither an empty nor
a complete interval. Retry waits for the next cadence. Construction is conditional and
non-fatal. The audited production tree supplies the store to read surfaces but contains no
production caller of `append` or `extractProviderReport`. A constructed store, timer and read
route therefore prove neither populated evidence nor end-to-end capture.

**Rule — provider-report migration preserves evidence without promoting it.** Rules 26, 33,
41, 58, 69, 86 and 111; **checks: P16-NF-14/17/36/44/49**. Migration retains every valid,
invalid and comparison row with its source identity and missing-state labels. It retains the
numeric synthetic internal zero as legacy evidence. It marks that zero's presence uncertain
unless original inputs independently reconstruct internal evidence. It retains each column's
actual population and time basis when reconstructable. It labels an unreconstructable population
or basis unknown. It preserves a failed sweep's durable prefix as historical evidence. It marks
the sweep window incomplete unless independent evidence proves completion. It selects current
provider evidence by the 2.0 quantity-witness rule, not capture arrival. It reproduces
provider/internal/committed columns without collapsing their owners. Only a newly rebuilt
comparison with proved compatible membership may claim a matched comparison window. Provider
extraction remains ten-owned. Attempt and receipt binding remains seven-owned. Measurement and
evidence remain one-owned facts admitted through four and preserved through two. Current
committed accounting remains six-owned. Adequacy and discrepancy findings remain nine-owned.
The human view remains eleven-owned.

**Rule — the 1.x money ledger flushes before updating its cache.** Rules 13, 26, 33, 40,
60 and 111; **checks: P16-NF-19/36/44**. When the 1.x money layer is enabled,
`AgentServer` constructs `MeteredSpendLedger` and supplies it to `MeteredSpendGate`. The server
runs an expiry sweep at boot. It repeats that sweep every five minutes. A booking row is appended
before the in-memory fold and disposable totals cache change. The writer then calls the operating
system's `fsync` operation to request a durable flush of that row. A successful durable flush
means the preceding file bytes and required metadata reached the ledger's declared local
durability boundary before success was acknowledged. The cache is atomically replaced on a
best-effort basis. Construction rebuilds totals from the JSONL source. A file-size high-water
mismatch triggers another rebuild. The append-before-cache and rebuild guarantees carry forward
through part two's durable spine and six's accounting fold.

**Rule — 1.x money-ledger expiry and permissive rebuild are not settlement proof.** Rules 24,
26, 40, 42, 60, 86 and 111; **checks: P16-NF-19/36/44**. Elapsed 1.x reservation time-to-live
appends `expire`. An expired reservation then contributes zero committed spend without proof that
dispatch or charge became impossible. A later settlement can book actual cost on the settlement
day instead of the reservation day. A rows-file read failure is treated as empty history. A
malformed row is skipped. Those behaviors do not carry forward. Eight's `EffectSettlement`,
six's `SettlementApplication` and the qualified accounting grant in
`seam-response-loop-followup.md` replace them. Window membership is non-executable until the
granted `accountingWindow` addendum in that same file lands. An expired but unproved legacy
reservation remains uncertain at maximum exposure in its original owner window. It never creates
released headroom.

**Rule — 1.x mechanisms are re-expressed through the 2.0 core.** Rules 24, 30, 31, 33, 49, 69,
86 and 95; **checks: P16-NF-02/12/16/23/31/35–45/51**. SQLite tables, JSON quota files,
process-local maps, source-side feature tags, timer ownership and private cap stores are not
portable authorities. Measurement and evidence become part-one payloads on part two. Register
entries and declarations replace string enums and private manifests after the requested
part-three shapes land. The requested part-four operation admits observations. Five and six own
durable scans, cursors, leases, retry and settlement application; the full adaptive collector
loop remains non-executable until `seam-response-loop-followup.md` item #25 lands. Seven owns attempts, benchmark
records and, once its landed seam exists, hold cost. Eight owns settlement and, once its payload
seam exists, cap/freeze effects. Nine owns instrument adequacy and signals. Ten owns concrete
adapters, usage-category observations and persistence. Eleven owns the human read and
authorization surfaces. The provider transcript scanner may remain one adapter, but it is not
the ledger. Retained 1.x `ProviderCostReportStore` rows migrate as provider-observation evidence,
including invalid rows and missing numeric fields; its current-row choice by capture time does not
migrate as authority. Retained `ReconRecord` rows migrate as historical advisory comparison
evidence with provider, internal and committed columns kept separate. Each column retains its
reconstructable population, time basis and source-presence state. The 1.x internal zero remains
numeric legacy evidence but is uncertain when migration cannot distinguish a provider-only
fallback from an explicitly derived zero. A nominal or independently completed sweep window does
not promote unmatched or unknown column bases to a matched comparison window. New comparisons are
rebuilt from the current quantity witnesses, manifest and six-owned accounting read and may claim
a matched window only when compatible membership is proved. Neither old nor new comparison
evidence can lower committed money or certify that an unconnected capture path ran.

**Rule — 2.0 forecloses the audited design mistakes.** Rules 26, 30, 41, 49, 58, 69, 75 and 86;
**checks: P16-NF-02/07/10–14/17/22/23/30/35/42/45/51**. No observability store may also expose a
scheduler decision. No writer may swallow an instrumentation refusal without a coverage deficit
and instrument-health record. No source label is authority for feature, doorway, model or
account. No permanent exemption removes an actual call from the coverage denominator. No timer
may host unrelated authority work merely because its cadence is convenient. No empty list or
zero substitutes for a failed read. No configured file or constructed object proves a live
holder. No read-time price, credit, estimate or burn threshold opens or closes spend authority.

---
