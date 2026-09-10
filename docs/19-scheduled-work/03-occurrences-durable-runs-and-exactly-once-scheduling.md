## 3. Occurrences, durable runs, and exactly-once scheduling

**Rule — occurrence identity is constitutional and stable.** Rules 7, 26, 28, 33 and 90;
**checks: P15-NF-18/19**. Every due occurrence uses part four's scheduled-tick identity `(stable
job instance id, scheduled instant)`. All installations use one registered scheduled-ingress
adapter namespace. Part Four's ordinary intake logical id remains the canonical hash of
`(adapter, channel, sender, identityEpoch, eventId)`. Within an installation the authenticated
route is exactly: adapter id from that entry, channel `scheduled:<installation id>`, sender equal
to the package-minted system principal, identity epoch equal to that principal's signed key epoch,
and event id equal to the canonical hash of `(namespace version, job instance id,
RFC-3339-Z scheduled instant)`. The canonical tick bytes contain only schema version, job instance
id, scheduled instant, package digest, calendar-policy version and time-zone-data version, in part
one's canonical encoding. Discovery clock and source machine are separate part-one `Evidence`
testimony referencing the event id; they never enter the route or tick bytes.

The Four-owned `ScheduledOccurrenceBinding` granted in the dated 08:38Z addendum to
`seam-response-intake-followup.md` (`SEAM-LEDGER.md` row 49; GRANTED but unlanded) maps the separate semantic key
`(namespace version, installation id, job instance id, scheduled instant)` to the original intake
admission. It neither changes nor replaces the complete ordinary intake tuple. Each delivery is
still authenticated under its supplied epoch. After an authorized key rotation, Four accepts the
new epoch only when it proves the same registered scheduled-principal lineage and current grant,
then resolves equal tick bytes to the binding's original admission. A genuinely new scheduled
instant has a new semantic key and remains independently admissible.

Two active package versions that select the same job instance and instant therefore use the same
event id and semantic key. Equal bytes resolve to the original intake admission even across an
authorized principal-key epoch change. Different package or calendar bytes under that identity
produce Part Four's mismatch/conflict result; arrival order cannot choose a winner. This contract
is non-executable until the GRANTED/BUILT `seam-response-intake-scheduled.md` and the ledger-49
grant in `seam-response-intake-followup.md` land because
the current source head admits neither this scheduled payload nor its cross-epoch semantic binding.

**Rule — one conditional chain selects the intake-to-Run binding.** Rules 26, 33, 45, 68 and 90;
**checks: P15-NF-18/20/21/22**. The package first calls Part Four's granted
`receiveScheduledTick`. Four's granted conditional `ScheduledOccurrenceBinding` makes an
admitted result or either same-epoch or authorized-successor-epoch duplicate resolve to the one
original authoritative intake-admission fact. That selected fact is the opening reference. The package uses Part Five's
exported `runIdFor(opening)` and submits the complete Run root through the public
`RunGraphPort.open`; it never calls the injected Six-owned `RunAdmissionPort.create`. The root
causally requires the intake fact and carries that exact reference as its opening. A clock callback,
discovery testimony or part-six reservation cannot select a different Run.

A crash after intake admission leaves its existing `blockedOn: run-admission` obligation visible.
Recovery enumerates those scheduled admissions through the granted
`IntakePort.readScheduledOccurrence` bounded read and
returns each semantic binding's original admission. It then reconstructs the complete root bytes
only from the opening fact and the immutable package
version named by that fact. `createdAt` is the opening fact's clock. Every directive, authority,
budget, cadence, wake, destination and generation reference is the exact admitted or
package-pinned value. Reconstruction takes no recovery or discovery clock. The package calls
`RunGraphPort.open` directly with those bytes. That public operation returns the identical existing
root when it is already present and preserves a Refused when the immutable opening disagrees or
another admission condition fails. Recovery never branches on `RunGraphPort.read`, whose landed
refusal does not distinguish absence from conflict. A crash before root creation therefore opens
the reconstructed root, and a crash after root creation but before acknowledgement returns the
same root. During a partition, peers may record
separate discovery testimony, but required intake/Run durability and part-six ownership inhibit
business execution until one causally valid binding is visible. Equal competing roots merge by
identity; unequal roots conflict and remain inhibited. No peer mints work from its local discovery
clock or chooses a winner by arrival time. P15-NF-18/21 are non-executable on this source head
until the GRANTED/BUILT `seam-response-intake-scheduled.md` lands, the dated 08:38Z
`seam-response-intake-followup.md` addendum, GRANTED at `SEAM-LEDGER.md` row 49 but unlanded,
lands, and the
bounded Part Two/Five dependencies named below land with joint evidence.

**Rule — exactly once means one durable scheduling disposition, not one successful effect.** Rules
26, 33, 42, 45, 68 and 90; **checks: P15-NF-18/20/21/22**. Concurrent delivery, restart replay,
late peer delivery and operator refresh return the same intake receipt, Run binding or missed-group
coverage. The current projection is re-derived from signed history at a pinned causal frontier. A
Run's own reported state, a last-run field or a machine-local queue is never authority. The exact
mapping is:

| Scheduling condition | Intake and control record | Run mapping and lawful closure |
|---|---|---|
| Not yet due | No scheduled intake exists | No Run exists; pending is derived from the manifest and supplied clock |
| Due and admitted for execution | One Part Four intake admission; Part Six reservation results remain narrow control Results | Exactly one deterministic Run root; only a Part Five completed, demonstrated-unreachable or scope-covering cancelled `RunExit` is terminal |
| Equal redelivery or replay | Duplicate receipt references the original admission | Returns the same Run; it creates no step or attempt |
| Refused before work admission | Part Four preserves the tick and its `Refused` | No Run is invented; the registered policy owns any later fresh observation |
| Queue, quota or breaker inhibits execution | Capacity enforcement may be `Success` with capacity applied for that control operation; the Run appends a waiting or halted `RunTransition` | The admitted business obligation remains open, owned and visible; `shed` is only a presentation label for this inhibited no-execution state, never a `RunExit` |
| Optional occurrence deliberately does no work | The manifest's immutable exit test explicitly accepts named no-execution evidence for this occurrence class | The accepted no-work Result is the business-step outcome. If learning is `required`, its lawful disposition must be accepted next. Only then may a checked `completed` RunExit close the Run after the original exit test accepts the no-work evidence; queue pressure or a capacity Result cannot substitute. |
| Missed group | Requested Part Six selection and bounded coverage chunks give every member a disposition and link any previously admitted member | Members deliberately not executed have no individual Run; only the latest member may bind its ordinary opening-derived catch-up Run exactly as defined below |

**Rule — this guarantee does not claim exactly-once effects.** Rules 24, 26, 42 and 63;
**checks: P15-NF-21/23**. Part fifteen promises one logical scheduled run and at most one admitted
provider invocation for each admitted attempt identity. A logical step may have sequential,
bounded attempts only through the fresh-attempt contract below. Part eight and part nine determine
whether an external effect happened. A timeout, lost callback, expired lease, new worker, changed
provider or new budget cannot turn uncertainty into safe repetition. Recovery observes the
original operation identity. Uncertainty stays visible until independently assessed
non-occurrence, exclusion of delayed execution and final charge all settle it.

**Rule — due discovery is level-triggered and bounded.** Rules 8, 46, 55, 61 and 68;
**checks: P15-NF-24/25/26**. The scheduler holder uses part six's persistent loop, due index and
scan cursor. The due index is a disposable package projection, not authority. It contains only the
stable candidate key, manifest generation, next possible due instant, unresolved-obligation bit,
source vector and source-reference digest needed to select a bounded candidate page. Its builder
advances through Part Two's granted `FactStorePort.readForProjectionPage` with its owner-issued
`ProjectionReadCursor`, checkpoints its own cursor, and publishes a new index generation only
after the whole pinned frontier has been consumed and an equal-frontier rebuild agrees. The prior
complete generation remains readable while a successor is building. Each candidate-source call
declares maximum keys, encoded bytes, decoded facts, hash work, replay work, memory and monotonic
duration. It returns a `ProjectionReadCursor` even when the page contains no due key. It never
materializes all retained keys or calls the complete history read on each tick.

Part Six's granted `BoundedDueScanPort.pageBatch` arm binds each bounded candidate page to the
persistent `ScanCursor` and continues from its recorded `nextCandidateAfter`. Six still returns
selection only; the package derives due status and Part Four admits each selected tick. Each recurring job is one
persistent parent duty. Its due instants open bounded episodes under the parent's shared rolling
budgets and breaker. **Level-triggered** means an unsettled due condition remains selectable on
every bounded scan; no one-time callback edge is needed to preserve it. A current occurrence remains due
until its Run has a durable admission and disposition; losing a callback merely causes another
lookup. Each pass has finite pages, work, duration and resource bounds. Fair paging prevents one
dense schedule from starving other jobs. A configured holder is not live because its manifest
exists: part nine requires fresh evidence of an actual scan, a challenge occurrence, its intake
receipt, and the matching run observation. Persistent parent budgets and breaker behavior are
non-executable until the GRANTED `seam-response-loop-breaker.md` lands; conditional coverage is
also non-executable until `seam-response-loop-followup.md`, GRANTED at `SEAM-LEDGER.md` row 33 but
unlanded, lands. P15-NF-24/25/26 are also non-executable until `seam-response-facts-followup.md`
and the dated 06:27Z `seam-response-loop-followup.md` addendum, GRANTED at `SEAM-LEDGER.md` row 37
but unlanded, land and pass their joint acceptance evidence. That grant bounds candidate selection
only. P15-NF-26 and the long-history arm of P15-NF-52 additionally remain non-executable until
the dated 08:25Z Part Six producer addendum in `seam-response-loop-followup.md` and the dated
08:25Z Seven/Eight consumer addenda in `seam-response-judgment.md` and
`seam-response-effects-followup.md`, GRANTED at `SEAM-LEDGER.md` row 44 but unlanded, land and the
resulting Six/Seven/Eight `readCurrentAuthority` path passes the restart-to-settlement evidence.
Those granted paths still stop before Part Four scheduled admission, Part Five Run reconstruction,
and Part Two's actual append verification. The dated 08:38Z addenda in
`seam-response-facts-followup.md`, `seam-response-rungraph-followup.md` and
`seam-response-intake-followup.md`, GRANTED at `SEAM-LEDGER.md` rows 47, 48 and 49 respectively
but unlanded, cover those paths. P15-NF-26 and the long-history arms of P15-NF-18/21/52
therefore remain non-executable until those grant files land and pass
the same instrumented occurrence trace. A small candidate page, keyed authority view, or Run view
is never permission to append and never substitutes for complete signed-history verification.
Eight's own effect-domain reconstruction is a separate prerequisite: the dated 09:23Z addendum in
`seam-response-effects-followup.md`, GRANTED at `SEAM-LEDGER.md` row 54 but unlanded, supplies
`EffectStateCheckpoint` and `advanceEffectState`. The bounded-history program for P15-NF-26 and
the long-history arm of P15-NF-52 is non-executable until ledger rows 37, 44, 47, 48 and 54 all
land and pass one joint cold-restart-to-settlement trace. Four's row-49 scheduled-intake grant
remains an additional prerequisite for the complete scheduled lifecycle.

**Rule — missed instants are counted, coalesced, and never erased.** Rules 26, 42, 46, 55 and 68;
**checks: P15-NF-14/20/24/27**. After sleep, outage, restart, or partition healing, the loop derives
every eligible scheduled instant since its conditional temporal-coverage predecessor in bounded
pages. Part six coalesces the wake. Through the granted Part Six `selectMissedCoverage` operation
it records one `MissedCoverageSelection`; `appendMissedCoverageChunk` then records bounded, ordinal
`MissedCoverageChunk` values. Each chunk
has finite member and encoded-byte maxima, a predecessor chunk and a digest chained into the group
commitment. `none` records deliberate no-execution for every member. `latest` does the same for
older members and selects the latest member's canonical Part Four tick as the catch-up stimulus.
If that member already has an admitted Run, coverage references and reuses it. Otherwise the
package admits that member's tick and opens its Part Five opening-derived Run by the ordinary
binding rule above. A group id never becomes a Run id or an opening stimulus.

A previously admitted member remains linked to its existing Run and is never absorbed into a new
no-execution claim. An incomplete group resumes from its committed discovery page or first open
member without loading earlier chunks. It cannot move the boundary or repeat its catch-up Run.
Only after every chunk is complete may Part Six record `MissedCoverageCompletion` through
`completeMissedCoverage` and conditionally advance the temporal-coverage head. Recovery uses the
paged `readMissedCoverage` operation. The selection-only `ScanCursor` may witness bounded
enumeration, but it neither selects coverage
nor commits dispositions. Crashes before selection, between selection and the first chunk, between
chunks, before Run binding, and after Run binding all resume this order. A job cannot run early
merely because it has never run. Occurrences before the package activation instant do not exist.
This coverage is non-executable until the GRANTED `seam-response-loop-breaker.md` and
`seam-response-loop-followup.md`, GRANTED at `SEAM-LEDGER.md` row 33 but unlanded, land.

**Rule — a manifest change has a clean temporal boundary.** Rules 33, 44, 90 and 97;
**checks: P15-NF-16/19/28**. Activation records the first instant governed by the new package
version. Past occurrence identities keep their admitted package digest. An occurrence discovered
under an old active version completes under that run's immutable contract unless a current
authority or safety check refuses its next effect. A changed schedule governs only not-yet-named
future instants. Conflicting activation boundaries inhibit affected admission and surface a part-two
Conflict; no clock winner chooses one.

**Rule — every-machine jobs expand into registered machine-scoped instances.** Rules 32, 33, 60,
63 and 113; **checks: P15-NF-18/30/36/51**. A manifest selects either `global-once` or
`every-eligible-machine`. The latter is permitted only when each result is a physical fact of the
target machine or another registered machine-local outcome. At the pinned expansion frontier, the
package derives one stable job instance id from `(job id, target machine id)` for every eligible
target. Each instance receives its own tick, Run, lease, scope check, local resource reservation
and Result. A target already processed is deduplicated by its instance identity; adding a target
creates only that target's future instances.

An every-machine instance cannot emit a shared or conversation-scoped effect unless a separate
global-once Run admits and deduplicates that effect. Ordinary shared-effect jobs remain
`global-once` and use one cross-machine occurrence identity. Compatibility import maps 1.x
`perMachineIndependent: true` to every-eligible-machine only after its declared effects and storage
are proven machine-local; otherwise import inhibits the job and reports residue. The two-machine
fixture requires two local scan Results for the former and one global effect for the latter.

---
