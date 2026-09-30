# Intake slice contract

`@instar/constitutional-types/intake` implements the requester-message portion of
`docs/08-the-intake.md` required by part eleven's first vertical slice. It is a library
port, not a running messaging adapter or a claim that the whole vertical slice is live.
It imports constitutional values, fact admission, projections and register construction
through the owning parts' public entry points.

## Assembly

1. Install `intakeFactSchemas(scope)` in the part-two schema registry. Install
   `intakeWorkRegistration(boundary, observerId)` and
   `intakeStopRegistration(boundary, observerId)` for receiver/rebuild consumers. The intake
   factory installs the same owner decoders in its local fact context automatically.
   Operator-surface assemblies opt into the additive seam separately with
   `intakeVerifiedActFactSchemas(scope)`; omitting it preserves the complete legacy
   `receive`/`recover`/`expireHolds` construction and makes only `admitVerifiedAct` unavailable.
2. Supply a part-ten durable capture provider, segment storage, live context/capture index,
   a verified system observer and machine signing key, and the clock. The observer is a
   stable logical principal shared by the participating intake replicas; machine signing
   identities remain distinct. A storage receipt must follow fsync-equivalent durability,
   not an in-memory write. No capture deletion interface is introduced.
3. Supply P3's **VerifiedRegister**, obtained through `loadRegister` with the spine's
   extract, entering-force and currency verification, plus its construction context.
   Generated replay JSON or a cast is not runtime authority. The factory requires
   its `intake-slice` feature and the adapter's live `parsers` declaration. That declaration
   supplies the authentication classes and event-id policy. Slice messages require stable,
   provider-minted event ids and no hash fallback. Provider metadata is separate from prose.
4. Supply independently observed `dedupGeneration()` lineage currency and a finite
   `dedupStalenessBound`. The port consumes P2's authority-answering projection; it does not
   manufacture fresh peer observations from receipt time. P2's `exclusive-singleton` merge
   produces Conflict on concurrent admissions of one logical key.
5. Supply a named work owner and positive finite hold age/active-slot bounds. The port
   returns requester-level Intent work blocked on `run-admission`; part five creates and
   owns the actual Run. No Run, Lease, Authorization or effect type is redefined here.

### Governed consumers

The adjacent sidecar declares `intake.contract` and all five executing blocking
sites. Dedup, authentication, resolution and admission call P3's pair-aware
`readEnforcedRecord` before their actual owner consumer in the same function:

| Site | Enforced contract consumer |
| --- | --- |
| intake.dedup | P2 store read → snapshot → fold → `readProjection`, with the same `intakeDedupDefinition` |
| intake.authentication | P1 `decode('Provenance')` against governed transport keys and captures |
| intake.resolution | P1 `decode('VerifiedPrincipal')`; existing binding/historical-standing resolution stays unchanged |
| intake.admission | P2 `authorAndAppend` using the real installed `IntakeWork` owner decoder and causal ladder |
| intake.stop | Ruled-three, safety-open exact stop; P2 append still runs the installed `IntakeStop` owner decoder |

The four governed-state sites declare separate directions for retained delivery
(open: receipt/capture/hold survives) and standing/work admission (closed). They
never turn inability to decide into lost input or fabricated permission. Ordinary
admission guards do not run on maintenance receipts, held-input records or stops.
An unavailable dedup/admission gate therefore does not strand the authenticated
brake. Missing authentication/resolution authority produces a retained hold, not
an unauthenticated halt. Stop requires its live ruled-three/open declaration.

`register-source/owner-references/part-four.json` pins the actual public modules,
implementation artifacts, governed document and P4-NF-06 assertions through P3's
strict resolver. `node scripts/pin-intake-owner-references.mjs` refreshes those
derived pins after artifact edits; then commit sources and regenerate P3 output
from that exact commit. The source checker separately proves calls/registration
flow; no caller-written `reads`/`invokes` list is runtime evidence. Dynamic calls
remain the owner's declared bounded-static-proof residual.

Replay lists missing entering-force/approval and writer/executor separation
prerequisites; it remains shape-only, never a production activation waiver.
The tests use an explicitly test-only approved extract and injected spine provider
through `loadRegister`, including a fresh loader witness on every process boot.
Production assembly must supply real spine verification and approved policy history;
these fixtures supply neither production approval nor a live adapter probe.

The transport adapter implements `authenticate(raw, route, at)` and `parse(raw)`. The former
returns P1 provenance evidence and authenticated channel/sender/identity-epoch metadata that
must match the independent route. Its actual evidence class must match its registration.
The latter translates captured UTF-8 text into one closed slice protocol:

```json
{"schemaVersion":1,"kind":"message","text":"ordinary conversation"}
{"schemaVersion":1,"kind":"stop","command":"/stop"}
```

The first shape is pre-decision conversational input, never an authority-bearing command.
Natural-language claims in it cannot bind, grant or approve anything. An optional message
`signal: cannot-decide` is delivered with a durable flag, not blocked. Unknown versions,
operation requests, additional command fields, malformed payloads and near/quoted stop
commands produce a `needs-judgment` hold. The full authority-command parser and part-seven
refinement are designed, not yet built. There is no model or keyword-classification fallback.

## Durable order and recovery

`receive(raw, route)` samples the clock once, durably stores the exact UTF-8 capture, then
appends `intake-receipt` through P2 with a canonical, uninterpreted `ingress` encoding of
the complete route before validating it, deduplicating or parsing. The receipt's signed
clock is the original arrival clock, not the last retry's clock.
The adapter must make its new capture and authentication records available in the supplied
capture index. Capture and fact-storage failures return Refused and never invoke the parser.
`recover(receiptId)` obtains route and bytes from that receipt and the durable capture index;
it needs no lost caller route or raw text. Authentication is performed again, never restored
as live authority from a historical view. A scheduler may enumerate retained receipts and
invoke this port. Overlapping calls preserve their receipt before the per-instance recursion
guard defers interpretation; the refusal identifies the receipt to recover. This is durable
queue substrate, not an autonomous scheduler or proof that the capture-only pre-receipt cut
has an acknowledged transport event.

The logical identity hashes adapter, authenticated channel, sender, identity epoch and
provider event id. The epoch prevents recycled platform identities inheriting an old key.
Each redelivery still has its own durable receipt. An equal-hash completed admission appends
an `intake-collapse` referencing the original. The first eligible observer receipt commits the hash, including
before authentication or holding. A changed hash appends an `intake-mismatch`
attack signal and refuses. A duplicate returns a reference, never a fresh executable Intent.
Native provider ids are retained as `lastInboundId` and on the durable receipt/resolution/work
facts. A final same-ledger recheck collapses interleaving ports; the P4 owner decoder also
rejects a second admission in the same causal history. Partitioned concurrent admissions
remain the P2 singleton Conflict case, not a claimed distributed lock.

Only an **eligible observer receipt** establishes that first hash/clock commitment. P2
authenticates the envelope; P4 independently requires the configured verified system observer,
a bounded complete provider route, and matching capture/hash metadata. One total consumer
applies this policy in receive, recovery, work admission and stop validation. Malformed routes
(including invalid JSON ingress) and other principals' signed observations remain retained,
but are inert for arrival indexing. They cannot preempt a sender's event, become observer
arrivals through recovery, or poison unrelated admission/stop scans. Eligibility is derived
from authenticated envelope identity and independent configuration, never a self-asserted
body flag. Genuine observer receipts received through P2 replication remain eligible; the
replication provider supplies their observed causal frontier and projection currency.

Authentication uses P1's actual Provenance and VerifiedPrincipal decoders. Unresolved
identity becomes P1 UnresolvedInput in an observer-authored `intake-held` fact; the result
remains Refused, with the hold fact as its preserved reference. Holds have an owner, expiry
and bounded active slots. Overflow is counted by durable coalesced observations; raw captures
remain individually recoverable. `expireHolds()` writes receipted expired terminals and is
idempotent; the assembly schedules this package-authenticated maintenance port. An admitted
retry closes only its matching logical-id/hash hold and retains the first receipt's arrival time while
its new fact records resolution/admission time. No timeout becomes consent.

A pre-existing `conversation-binding` fact is an operator/conferring, causally bound fact
under P2's admission ladder, with a verified operator grant. Intake never creates one.
Bindings contain adapter, channel, sender, identity epoch, principal id, grant id, Scope and
`supersedes` (`none` for the initial binding). Receiver history is consumed through genuine
P1 historical grants and historical liveness; it is not cast back into live authority.
Selection is unique, scope-covered and live at the receipt's causal position. First senders,
other participants, identity churn and ambiguous binding heads confer no operator selection.
Even a selected operator's ordinary message is admitted only as requester service in this slice.

Ordinary work records `intake-resolved` before `intake-admitted`. Work's P4-owned body decoder
enforces a nonempty owner, `blockedOn: run-admission`, requester standing and the durable
receipt/raw identity. Active in-cone directives are derived from facts and included in
`Intent.under`; the owner decoder independently refuses omissions at P2 append. Grounding
coverage and the fresh actual-start read remain part five's, not an intake-time substitute.

An exact stop from a bound or previously bound operator bypasses resolution-work creation
and held-queue maintenance. It appends one local-durable `intake-stop` naming binding, reach,
authenticated identity/capture, receipt and clock. A replay authenticates again and returns
the same stop fact (a new delivery receipt is still preserved). Receiver-side P4 validation
refuses other authors and altered binding reach. A stop fact inhibits new intake work in its
scope across restart, including work whose broader or differently dimensioned scope is not
proved disjoint. Disjoint members of the same scope kind remain serviceable. The P4 work
decoder enforces this at the candidate's own causal position for both origin and historical
rebuild; a later stop does not retroactively invalidate a pre-stop admission. A narrow binding
cannot select operator context for a broader port. The returned fact reference and `fencingOwner: part-six` identify the
fencing handoff: this port does not acquire leases, fence effects or claim already-running
work has halted. A requester's exact stop produces a highest-priority, non-halting signal.

## Limits and posture

Designed, not yet built: candidate grants/recurrence; secret-store custody and redaction;
webhook floors/fingerprint policy; full registered authority-command surface; authorization
routing, framing, rate limits and awaiting workflow; peer-silence concurrence; acknowledgment
delivery policy; live adapter canaries/cadence; verified operator-surface binding and stop UI;
and session-side grounding/coverage. The skipped P4 checks carry these specific slice reasons.
In particular, this module must not be advertised as a production credential-intake surface.

Intake facts, bindings, dedup and stops are shared facts. The active held-queue view is local
and rebuildable. Replication lag is bounded by the supplied projection currency contract;
uncertain or conflicted authority reads refuse with input retained. Conversation ownership,
effect fencing, platform authentication implementations, live probes and scheduling remain
their named owners' ports. The new feature declaration feeds P3's generated awareness;
the declaration does not claim a live platform deployment.

Side effects: additive package export, owner decoders, schema declarations and tests only.
No Instar 1.x agent state, hooks, installed configuration or deployed service is changed.
Rollback is reverting these source commits; immutable facts require keeping their registered
decoders available for historical readers. Nothing rewrites or deletes retained history.

Verification uses unit contracts, real P1/P2/P3 integration, and a fresh-process harness with
fsync-backed isolated storage. The harness exits after capture, receipt, resolution, admission
and stop boundaries, then boots the same public port and rebuilds projections. It uses test
credentials and is not part eleven's live-platform acceptance proof. `check-p4-contract-map.mjs`
maps all 29 design checks to actual executed tests and explicit out-of-slice skips.

## Capabilities

- `intake-slice`: captures and receipts or holds every inbound message before any work; an uncertain arrival is kept.
  Details: every inbound requester message is captured and receipted or held before any work, with an exact dedup, authentication, resolution and operator-stop brake; an uncertain arrival is kept, never discarded.
