# Part six — the transport reference adapter, leases, the loop primitive, and recovery

**Status: draft, awaiting approval. Governed.**

**Value — purpose and reading convention.** This part chooses how durable work gets a worker,
how that worker loses permission, how repeated work stays bounded, and how Threadline carries
work without changing its meaning. Plain language is the primary document; no check enforces
whether a reader finds it clear. Every specification paragraph, table, and numbered sequence
below belongs to its enclosing **Rule** or **Value**. A Rule names its automatic check; a Value
names a choice or an honest limit no check enforces as policy. Fixtures can test a chosen Value's
implementation without making the choice constitutionally required.

**Rule — a design is not a running holder.** Rules 26, 69 and part three's P3-NF-28 govern every
check named here. **Check: P6-NF-01**, the implementation coverage manifest, requires every fixture
below at its stated stage and its actual check-run record before its edge can render held.
Until implementation, these are declared checks. The inherited-duty table's held and partial
labels describe contract coverage, not a claim that production protection exists.

## 1. Ownership of the design

**Rule — one owner per type and behavior.** Rules 1, 30, 69, 114; **check: P6-NF-02**, the
schema/import ownership check. Part five owns the run graph, delegation contract, agent-transport
port, awaiting-authorization state, exhaustion runs, session grounding, semantic result collection,
and run completion. This part realizes their required behavior; it does not define their shapes.
Part eight owns operation classification, effect admission policy, external operation adapters,
and effect settlement. Part nine owns independent verification and grading. Part seven owns
judgment and its benchmark record. Parts one through four retain their types and doorways.

**Rule — inventory is closed.** **Check: P6-NF-02**, comparing schemas, constructors and imports
with these tables, enforces rules 5, 69 and 90. This part defines exactly these eight types:

| Defined here | What it represents | Producer |
|---|---|---|
| Lease | A recorded, temporary assignment of one execution scope to one worker incarnation | Lease authority, through verified decoding |
| FenceToken | The scope and increasing ownership epoch checked at execution admission | Derived from a committed lease assignment |
| AdmissionReservation | One durable reservation to attempt a named operation under a fence | Conditional admission at the lease authority |
| LoopPolicy | The registered brakes and resource demands for a repeating activity | Governed declaration decoder |
| LoopRecord | Durable progress, next wake and closure of one bounded repetition episode | Loop primitive through conditional append |
| RecoveryRecord | The facts examined, actions attempted and disposition of one recovery episode | Recovery holder under its recorded standing |
| ThreadlineRoute | Adapter-local mapping from a port conversation and verified peer to transport addresses and key references | Registered adapter, from verified binding evidence |
| ThreadlineReceipt | Adapter evidence for one port delivery-state claim | Adapter decoder of a signed receiver or relay record |

| Named or consumed only | Owner |
|---|---|
| VerifiedPrincipal, StandingGrant, Revocation, Intent, Directive, Authorization, Scope, Provenance, SecretRef | Part one |
| Result, Success, Refused, Outcome, Evidence, Measurement, Profile, Decision, ActionFloor, Conflict, UnresolvedInput | Part one |
| Fact envelope, durability state, version chain, projection, checkpoint, causal frontier, capture status | Part two |
| Declaration, register generation, governed port, check-run record, honesty class | Part three |
| Conversation binding, intake port, event-id authority, session-start evidence, authorization request | Part four |
| Run graph, run/step/child edge, run-acceptance reference, delegation contract, agent-transport port and its delivery states, awaiting-authorization | Part five |
| Judgment request, attempt, provider receipt, ask refinement, benchmark record | Part seven |
| Effect operation and settlement record | Part eight |
| Verification request/evidence acceptance and grade | Part nine, with eight consuming the result |

**Value — feasibility is part of this design's job.** No check enforces a design conversation.
Part five states what work requires; six tests whether it can be realized. Exclusive failover
cannot be obtained by choosing the newest entry in an eventually replicated ownership view.
Nor does checking a lease and then calling an external service close the intervening race.
The realization below therefore uses scoped serialization and durable operation reservations.
It deliberately makes no promise of both exclusive mutation and mutation availability in every
partition. That trade is an operator decision in section 16, not a hidden implementation default.

## 2. The authority that a lease needs

**Value — scoped serialization, not a global fact order.** This design chooses a replicated
conditional-append authority for each execution domain. A domain contains a conversation and its
run admissions; a delegated worker in a different domain receives a separately reserved child
budget and authority. Commands in one domain are serialized. Unrelated domains and the fact
spine retain part two's partial causal order. No check mandates this technology choice.

**Rule — a lease is issued only by a committed conditional transition.** Rules 31, 33, 60, 63;
**checks: P6-NF-03/04/05**. The authority accepts a command only against an exact predecessor
and governed membership epoch. Its storage adapter must provide linearizable conditional append:
one committed successor per predecessor, durable recovery of the committed prefix, and no
acknowledged transition lost within the declared failure tolerance. Freshness-bounded gossip is
not this operation. A read projection may display ownership; it cannot mint execution permission.

**Rule — the serialization contract includes election and recovery.** **Checks: P6-NF-03/04**
exercise competing leaders, delayed acknowledgments, restore and membership change. For N voters,
a commit requires a majority floor(N/2)+1, unique durable acknowledgments of the same domain,
membership epoch, position, predecessor hash and command hash. Majority receipts alone are not a
consensus algorithm: the adapter must also preserve accepted proposals through leader changes,
refuse conflicting commitments, and prove the contract under the fault traces. Membership changes
require approval of the old and new majorities during transition; a partition cannot mint its own
smaller membership. A one-voter installation is legal and has zero voter-loss availability.
For quorum commitment alone, three voters tolerate one unavailable voter; two require both.
This is not a promise that every business effect remains available: part two's known-lineage
staleness and standing checks still apply independently. An offline registered lineage may
therefore close ordinary authority despite a healthy quorum until its governed recovery or
lineage-close path resolves the staleness; quorum membership cannot silently narrow that set. Loss of quorum closes new
execution admissions, never erases pending work. These arithmetic boundaries are fixture inputs,
not a claim of measured deployment performance.

**Rule — the reference authority uses prepare, promise, accept and commit.** Rules 31, 33,
63; **checks: P6-NF-03/04/06**. The following is the protocol obligation, not permission to
implement consensus as a count of acknowledgments. For each domain and next log position:

1. A proposer chooses a ballot `(durable counter, stable proposer id, fresh incarnation)`
   strictly greater than the ballots it has seen. The tuple has a canonical total order, with
   no clock field. It sends prepare for that ballot, membership epoch and position.
2. Each voter first appends a durable promise never to accept a lower ballot at that position.
   Its signed reply includes its highest accepted ballot/value at that position, or none,
   and its committed-prefix proof. A duplicate prepare returns the same promise. Equal ballot
   with a different proposer or value is refused. A voter never votes from a restored snapshot
   until its durable promises and accepted values have been recovered.
3. After a promise quorum, the proposer must carry forward the value with the highest accepted
   ballot returned, if any; it may choose its proposed command only if every reply says none.
   It first recovers missing predecessor positions. Accept carries the promise-quorum evidence,
   selected value and committed predecessor. A voter verifies this selection, its promise,
   membership, predecessor and deterministic transition preconditions before appending an
   accepted-value fact durably. A stale candidate command may therefore lose to a recovered
   command; the caller retries its conditional request against the new committed predecessor.
4. Matching signed acceptance from a quorum chooses the value. Commit evidence references
   those acceptance facts; any recoverer can assemble the same evidence after a proposer dies.
   An accepted but uncommitted slot stays unresolved until this protocol recovers it. No
   application is allowed to discard it or assume the proposal failed. The reducer applies
   each committed slot once and preserves duplicate command ids with their original answers.
5. Competing proposers can delay progress, but cannot choose different values: intersecting
   quorums share a voter whose durable promise excludes the lower ballot, and a higher ballot
   carries forward the highest accepted value from its prepare quorum. A replacement first
   recovers the prefix by this rule, then proposes the new lease epoch. It cannot skip the
   unresolved slot to reserve the same operation again. Progress requires a stable reachable
   majority and bounded proposer contention; the loop primitive controls retries.
6. Membership changes are commands in that same ordered chain. The old quorum commits entry
   into joint membership; subsequent prepare and accept quorums require majorities of both
   sets, including the command completing the new membership. New voters first receive and
   verify the complete promise/accepted/committed state they will serve. Removed voters cannot
   form a valid commit in the new epoch. A restore that cannot prove it retained promises
   remains a nonvoting learner; resetting its ballot counter or wiping its state is not repair.

A single-voter realization uses the same durable conditional prefix and has no autonomous
failover after loss of that voter's state. Quorum signatures authenticate the voting evidence;
part two's `replicated(n)` says how many peers durably stored a fact. Either can exist without
the other and neither substitutes for the other. This contract assumes crash/partition faults,
not a Byzantine quorum; a compromised key follows part two's quarantine and operator recovery.

**Rule — the authority remains part of the history spine.** Rules 7, 32, 33, 90;
**checks: P6-NF-04/06**. Voter proposals, acceptance promises and commit evidence are registered
fact kinds appended under each voter's own system principal and segment lineage. Their bodies
carry the domain, membership epoch, command position, expected predecessor, command hash and
referenced votes. Each voter originates its own facts; a relay does not impersonate another
segment owner. Local consensus indexes are disposable projections of these facts. No private
mutable authority database may survive outside this agreement. A state-machine adapter unable to
recover its promises from the declared record does not satisfy this design. Authority commands
become usable only after their commit evidence is durable and the relevant fact-admission,
standing, taint and register-generation checks pass. A crash before that point yields a pending
proposal, never permission. Commit certificates and causal links supply order; appender clocks
and part two's presentation tiebreak do not.

**Rule — authority enforcement cannot author its own policy.** Rules 4, 66, 103 and P3-NF-27;
**check: P6-NF-07**. The executing admission principal may append operational lease/reservation
facts, but cannot amend the governed membership, lease policy, scope map, resource ceilings,
key set, or transition decoder. Those require the separate governed approval route. The site
registers those protected schemas and policies as its enforced records, not an independently
writable list of workers it dislikes. Ordinary transitions apply the approved state machine;
they do not rewrite its rules. The runtime reference-monitor limitation carried by parts nine
and eleven remains partial protection; listing a file does not prevent its owner editing it.

**Rule — authority maintenance cannot wait on the authority it is creating.** Rules 1, 55,
60, 66; **checks: P6-NF-07/16/19/31**. Genesis grants install the fixed voter-control operations:
append own promise/vote/commit evidence, authenticate protocol messages, and schedule bounded
protocol retries. Their finite local LoopRecords and reserved control-plane credits are written
on the voter's own segment; they do not acquire a conversation lease to elect its issuer.
This is a registered lower-level primitive, not an arbitrary effect escape: the control
principal cannot invoke a provider, send a user message, launch a business worker, issue a grant
or expand membership. Fact append similarly uses part two's verified append primitive rather
than recursively reserving an effect to append its reservation. These exact bootstrap paths
are declared exemptions in the entry-point/import check and carry full authentication, bounds
and preservation. Normal work, repair effects and model calls remain on the composed admission
path. Quarantining the domain being recovered does not quarantine its separately verified local
voter-control segment; corruption of that segment removes that voter until verified recovery.

## 3. Lease and fence lifecycle

**Rule — lease construction is closed and scoped.** Rules 28, 31, 63, 90;
**checks: P6-NF-02/05/08**. Lease and FenceToken follow part one's private-construction,
schema-version, canonical-encoding and typed-refusal conventions. Every Lease field is immutable;
renewal or loss is another fact, never an edit. Identity comparison uses the lease id; value
comparison uses all fields. A repeated id with differing immutable content is refused or
contested through part two, not selected by timestamp.

| Lease field | Required meaning |
|---|---|
| id, schema version | Stable identity and known schema |
| scope, domain | Exact execution scope and its one serialized authority domain |
| holder | Verified worker principal, stable machine identity and fresh process incarnation |
| epoch | Monotonically increasing ownership number within the domain and scope; never reset on restore |
| predecessor, commit evidence | The committed assignment or loss this transition follows |
| grant references, register generation | Standing and approved policy under which this assignment was made |
| issued clock measurement, maximum term | Scheduling evidence and finite local execution ceiling, never a cross-machine winner |
| resource reservation references | The budget already reserved for this worker, including ancestor constraints |

**Rule — a FenceToken confers no standing.** **Checks: P6-NF-05/08/09**. It contains domain,
scope, membership epoch, lease epoch, holder incarnation and committed-assignment reference.
It is not a bearer secret or an Authorization. Every admission compares it against the current
committed state, revalidates standing and stop state, and rejects a token for a different scope,
incarnation or epoch. A copied valid token presented by a different authenticated principal fails.
A high numeric epoch without commit evidence fails. Losing a lease never gives its holder the
right to close a run, release a successor's resources or acquire another child.

**Rule — lifecycle transitions have exact predecessors.** Rules 55, 63, 68;
**checks: P6-NF-03/05/08/10** hold every row:

| Transition | Preconditions and committed result |
|---|---|
| Acquire | Eligible work, current standing, no live assignment, available reserved capacity and no stop; commit a new epoch before starting a worker |
| Renew | Same holder/incarnation/epoch and current authority; commit a bounded extension; repeat command id returns its original outcome |
| Release | Same current holder and expected assignment; commit loss, preserving admitted operations; release only identified unused reservations |
| Expire | Authority's bounded timer proposes loss; committed loss advances the fence; expiry is never a run-completion record |
| Revoke / hand off | Authorized loss then new assignment, serialized in the same scope; successor inherits pending-operation references, not old standing |
| Lose locally | Renewal refusal, stale authority, stop or local term ceiling immediately inhibits new admissions; loss notice is advisory to safety, because the boundary also rejects the token |
| Restore | Verify committed prefix and maximum epoch before issuing anything; a backup lacking that proof stays unable to issue leases |

**Value — time bounds availability; committed fences hold safety.** No check chooses a lease
term for all workloads. The reference policy proposes a 30-second maximum term, renewal by
10 seconds, and immediate inhibition when the worker cannot establish a current admission.
Timers use an injected monotonic clock within a process incarnation. A restarted authority treats
old timer deadlines as suspect and commits expiration before reassignment; it never reconstructs
permission from wall-clock subtraction. A premature expiration can waste work but cannot authorize
two admitted operations with the same identity. The exact safety checks are P6-NF-03/05/10.
No claim depends on synchronized wall clocks or a loss notification reaching a partitioned worker.

## 4. Operation admission and the seam part eight consumes

**Rule — the fence is checked where a reservation is committed.** Rules 60, 63, 68, 114;
**checks: P6-NF-09/11/12**. Every worker start, run transition with resource consequences,
transport dispatch and external effect requests an AdmissionReservation. Chargeable model calls are included, even when their business output
is only advice. It carries:

| Field | Meaning |
|---|---|
| id, operation identity | Reservation id and part five/eight's stable logical operation reference; neither changes on retry |
| scope, owner, fence | Authenticated initiating principal and current FenceToken |
| request digest | Exact operation class, destination, payload/artifact digest and expected predecessor |
| required authority references | Grants, current register generation, stop state, evidence and authorization references supplied by their owning parts |
| resource demands | Exact credits reserved from finite domain and child allocations |
| durability demand and proof | The operation's part-eight demand and part-two acknowledgment evidence |
| attempt identity, state, predecessor | Owning part's attempt reference and one of prepared, dispatch-claimed, observed, closed; transitions append successor facts |
| result / observation references | References to the owning part's Result, Outcome and evidence, absent until supplied |

**Rule — the judgment seam has one owner per record.** Rules 41, 55, 60, 63, 75, 114;
**checks: P6-NF-09/12/13/35/39**. This map governs chargeable judgment calls:

| Record | Sole owner | How the other parts use it |
|---|---|---|
| Logical judgment request | Seven | Five persists its pending-step reference; six preserves it across recovery |
| Attempt | Seven | Its stable attempt id identifies one provider invocation proposal, including its request and input digests |
| Operation identity / reservation | Six | A canonical mapping from `(request id, attempt id)` to one operation id and immutable reservation; five and seven only reference it |
| Provider receipt | Seven | The original provider response/usage evidence; eight assesses effect/charge settlement, six records references |
| Spend reservation | Six | Credit allocation in the same AdmissionReservation and authority transition as ownership admission; no separate judgment spend ledger |
| Run-acceptance reference | Five | Conditional incorporation of the decoded answer against the pending run predecessor |

Transport retries, lost receipts and recovery keep the same seven-owned attempt and six-owned
operation mapping. Mapping is injective and immutable: neither a different payload under the
same attempt nor two reservations for it can decode as new work. A genuinely new seven-owned
attempt gets a new operation id only after the prior attempt's execution and charge uncertainty
are reconciled. A proposed new attempt may be recorded while waiting but may not dispatch.
The original unresolved reservation stays charged at its maximum exposure. Seven's metering
records observations; it cannot debit or release six's credits. Eight owns effect settlement;
six alone applies it to convert reserved credit into actual charge and release unused credit,
idempotently by settlement reference. A never-dispatched prepared operation can release credit
only after a conditional close proves no dispatch-claim exists. A dispatch-claimed operation
requires eight's settlement, including proof it cannot still execute. Budget remaining must
cover an upper bound on the charge before dispatch; an adapter with no enforceable finite upper
bound cannot use automatic chargeable admission. Actual charge above the reserved maximum is
recorded as a cap violation, never hidden by releasing a different reservation.

**Rule — one composed order covers judgment and later action.** **Checks: P6-NF-09/12/13/35/39**:

1. Five persists the pending step and seven's logical judgment request.
2. Six grants ownership; admission validates predecessor, stop and resources; five grounds
   the worker at actual start.
3. Seven persists the attempt; six persists its exact operation identity mapping.
4. Six conditionally admits and durably reserves that operation under the fence and spend bound.
5. The call dispatches through eight's effect boundary to the registered model adapter, using
   the reservation's one dispatch-claim. The caller cannot invoke the provider directly.
6. Seven records provider receipt, part one's Outcome and decoded answer/Decision, with the
   raw evidence references eight needs to settle execution and charge. An answer arriving
   without decisive charge evidence does not release the reservation.
7. Five conditionally accepts the answer into the run, then advances. A duplicate answer
   keeps the original acceptance; a stale predecessor or stop prevents new acceptance while
   the receipt and charge remain recorded.
8. A later business effect gets its own operation identity, authorization checks and admission.
   Having paid for a judgment grants no permission to perform what it proposed.

**Rule — the transition order is durable and cannot be skipped.** **Checks: P6-NF-09/11/12/13**:

1. The run/effect owner fixes operation identity and digest and persists pending work.
2. Part eight validates actual operation, standing, authorization, current evidence, taint and
   its durability requirement. Lease admission checks current fence and exact predecessor and
   reserves capacity; no observation or stale read is usable as this decision.
3. A prepared reservation is committed at the required durability. A repeated command returns
   the existing reservation; the same operation identity with a different digest produces Conflict.
4. Immediately before handing the operation to the executor, a conditional dispatch-claim checks
   the current fence and stop state again and commits the one attempt identity. All executors use
   this path, including the process launcher and Threadline sender.
5. The operation adapter consumes that claim once. It passes the stable operation identity to a
   destination that supports deduplication. It records the owning part's Result and Outcome, then
   closes the attempt; part five advances from those records, never from a socket return.
6. A crash after dispatch-claim leaves an unresolved attempt even when no bytes actually left.
   Recovery observes it before requesting a retry. An effect can require replication stronger
   than the lease authority's own quorum; satisfying one requirement does not satisfy the other.

**Rule — a reservation does not promise atomicity with the outside world.** Rules 24, 26, 42;
**checks: P6-NF-11/13/14**. Admission serializes permission, not the remote effect. An executor
paused immediately after its dispatch-claim may cross the external boundary after lease loss or
stop. That attempt is already in flight and must stay in the recovery set. The successor cannot
repeat it merely because its own lease is newer. A remote destination supporting fencing rejects
older epochs at its own mutation point. Without that support, at-most-once attempt issuance and
uncertainty preservation are the attainable contract; instantaneous revocation of an admitted
external call is not claimed. A process launcher must expose a stable, queryable launch identity
and prevent two processes consuming one launch claim; a stale process with direct external
credentials would evade this design, so workers receive effect-port capabilities, not those
credentials. The executable capability-isolation proof belongs to part ten; no launch family
can claim this protection before that proof exists.

**Rule — observation precedes effect retry, and absence is not proof.** Rules 24, 26, 42;
**checks: P6-NF-13/14**. An unresolved dispatch is represented to the owner as Outcome uncertain.
Recovery enqueues verification using the same operation identity and asks part eight to query the
external adapter. Happened closes from verified evidence; did-not-happen allows a new bounded
attempt only when evidence also proves the old claim cannot still execute and any charge has settled. A delayed old executor
must be fenced at the destination or proven quiescent. A missing search result, timeout, canceled
socket or process disappearance is insufficient by itself. An adapter lacking decisive lookup
and deduplication leaves the attempt uncertain; no fresh key, alternate transport or regenerated
payload escapes that hold. Independent observations are retained even when their originating
worker no longer owns the run. The non-occurrence and quiescence bar applies to another
execution attempt of the uncertain effect. It does not forbid section 7's explicitly read-only
retrieval of a receipt or result already stored for a semantic message. That retrieval has its
own delivery-attempt identity and bounded observation admission; it cannot submit missing work,
invoke a provider, release the original reservation or treat a missing record as non-occurrence.
P6-NF-40 checks this separation in both directions.

**Rule — eight and nine retain settlement authority.** **Checks: P6-NF-14/15**. Six provides the
owned wakeup and evidence references, not a new effect verdict type. Eight owns reconciliation
of the operation and admission of its settled Outcome; nine owns the declared verification bar
and independent evidence assessment. A missing eight/nine evidence contract keeps the operation
family unable to enable automatic retry. The partial duty is explicit: six can prove that
verification was scheduled and that uncertainty blocked retry, not that a third party's evidence
is sufficient. Their integration fixture must supply both decisive and inconclusive responses.

## 5. The loop primitive

**Rule — all operational repetition has the same brakes.** Rules 8, 55, 60, 61;
**checks: P6-NF-16/17/18/19**. Retries, renewal, polling, reconnect, catch-up, monitors, recovery
and periodic jobs use the loop primitive. A finite pure iteration over already-bounded data is
not an operational loop. Network-library automatic retries and reconnect timers are disabled
or included in the declared attempt/cost counters; dependency wrappers are in the enumeration.
The architecture check refuses other timer, requeue and self-spawn entry points. Runtime-loaded
plugins remain part three's measured enumeration residual, never a claim of complete coverage.

**Rule — LoopPolicy has no unbounded arm.** **Checks: P6-NF-16/17/19**. Each policy declares id,
schema version, owner, operation class, initial delay, maximum delay, backoff multiplier, jitter
range, attempt cap, per-episode duration ceiling, per-attempt timeout, concurrent-work cap,
resource limits, failure threshold, breaker cooldown, half-open trial count, cadence, fail
direction per consumer, due-by action and close-evidence requirement. All counts are finite
nonnegative integers; zero means zero, never a default. Positive repeating schedules have a
positive minimum delay. The governor validates cross-field relations and references to real
registered bounds. Clock arguments are Measurements. Resource/spend arithmetic uses exact units.

**Rule — LoopRecord survives its worker.** **Checks: P6-NF-17/18/20**. It contains stable loop
and episode ids, policy version, owning run/obligation reference, current fence, durable attempts
and reserved credits, failure count, next wake, breaker state, last outcome, pending operation
references and closure evidence. States are scheduled, running, waiting, open-breaker,
half-open, stopped and closed. Stopped is not closed. A close requires the declared terminal
proof or a deliberate cancellation accepted by the owning obligation; a timer cannot complete
an unfinished run or expire a Directive. Same episode id and conflicting immutable policy
identity produce Conflict. Budget counters never reset when the worker, machine or route changes.

**Rule — bounded episodes do not abandon continuing duties.** Rules 8, 55, 61, 68, 97;
**checks: P6-NF-17/18/20/21**. An attempt reserves its cost before running. Failures increase
backoff up to the maximum, with injected jitter chosen and recorded once per wake. Hitting the
failure threshold opens the breaker, inhibits attempts and persists a cooldown wake. Half-open
admits at most the declared trial count; success closes the breaker, failure reopens it. An
attempt cap or duration ceiling stops execution and records Success with capacity applied to
the loop control operation; it is never Success for the unfinished business operation. An
unsafe start beyond a cap is Refused budget-exhausted with preserved input. Expected capacity
enforcement and an attempted policy violation therefore remain distinct.

**Rule — a new episode cannot reset pressure.** **Checks: P6-NF-18/19/21**. Periodic duties open
bounded episodes under one persistent parent duty with a shared rolling attempt/resource budget,
minimum cadence and breaker. Recovery episodes share the failing operation family's budget;
recovery cannot recursively create a fresh uncharged family. A due tick missed during outage
coalesces into one wake with a missed-count fact, not one revival per missed instant. Operator
stop, revoked grant and a hard off-switch inhibit automatic new episodes. A resource-blocked
obligation stays owned and visible with a bounded recheck under the observation budget; it never
sends an unbounded stream of requests to the operator. The work owner supplies the next useful
step or honest blocker, rather than relabeling repeated restarts as progress.

**Rule — delegation transfers credits without duplicating them.** Rules 60, 61, 114;
**checks: P6-NF-19/35**. The parent authority commits a debit and immutable allocation id before
a child domain can credit that allocation. Child admission verifies the parent's debit evidence
and accepts each allocation once. An allocation in transit is unavailable to the parent; lost
acknowledgment never refunds it. Returning unused credits requires the child domain's committed
close proving no further dispatch can consume them and all admitted charge uncertainty is
settled; the parent then credits the return once. Concurrent returns or conflicting allocation
digests fail. A partition may strand credits but cannot multiply them. Local physical resource
admission also reserves on the target machine's finite resource domain before launch, using the
same debit/acknowledge/close discipline. No transaction across domains is assumed atomic; each
intermediate state is durable, owned and recoverable. A model-call spend reservation belongs to
one domain's remaining allocation, so it needs no second independent global spending ledger.

**Value — starting loop parameters are explicit tuning choices.** No check chooses the best
backoff. A reference transport episode uses 1-second initial delay, multiplier 2, 60-second
maximum, jitter in [0.5,1] of that delay, eight attempts, a five-minute episode ceiling,
15-second attempt timeout, one concurrent send per operation, breaker after four consecutive
failures, 60-second cooldown and one half-open trial. The parent allows at most 32 attempts per
hour per peer and shares a finite installation budget. Policies for renewal and emergency-stop
propagation are separate declarations, not these send defaults. P6-NF-17/18 tests enforcement;
measurements in section 13 determine whether a governed policy change is warranted.

## 6. Threadline as the reference adapter

**Value — local source audit, not a claim of live conformance.** No check enforces the choice to
reuse Threadline. The following bounded audit informs that choice. The source checkout inspected
was `/Users/dabombstudio/.instar/agents/echo` at commit
`5b36623a99327e74abe5ef04d63019f9aca6b1c5`, obtained with
`git -C /Users/dabombstudio/.instar/agents/echo rev-parse HEAD`. These are source observations,
not measured runtime guarantees. In the commands below, `S` abbreviates that absolute checkout
path; expanding it does not change the command's subject.

| Numbered observation | Number and command producing it | Consequence for this proposed adapter |
|---|---|---|
| A1: encryption allocates a message id inside encrypt | 1 match: `rg -c 'crypto.randomUUID\(' "$S/src/threadline/client/MessageEncryptor.ts"`; inspected `sed -n '140,215p'` on that file | Retrying by re-encrypting must not create a new logical operation; preserve port identity independently |
| A2: relay success follows socket send in the inspected route | 1 return at line 147: `rg -n 'return \{ delivered: true' "$S/src/threadline/relay/MessageRouter.ts"`; `sed -n '120,150p'` on that file shows send then return | Map that observation only to transport acceptance, never to durable worker delivery |
| A3: the inspected in-memory queue removes a recipient queue during drain | 3 deletion callsites: `rg -c 'this.queues.delete\(recipientId\)' "$S/src/threadline/relay/OfflineQueue.ts"`; `sed -n '154,182p'` distinguishes the drain case | A relay queue acknowledgment cannot replace an end-recipient durable receipt |
| A4: session state is represented separately from delivery | 4 variants: `rg -n '^export type SessionState' "$S/src/threadline/SessionLifecycle.ts"` yields active, parked, archived, evicted | A parked/active label is not delivery evidence or a durable run identity |

**Rule — evidence anchors these observations.** Rule 13 and the user's source-evidence rule;
**check: P6-NF-22**, the source-audit manifest, re-runs the counted commands against the pinned
checkout and records file hashes. The inspected encryption file SHA-256 is
`74d45dbff90893939774a98486e19f66e5311a510b4d110f96bf448ba40022e3`; the queue file SHA-256 is
`5d8648e6c563916e101ff3292fda3aac3aae37236cf58da94154eef3c090f1eb`, produced by
`shasum -a 256` on those two paths. A moving source tree changes the evidence, not this design's
claim of conformance. No 1.x deployment is certified by this four-observation audit.

**Value — topology and wire choices.** No check mandates a relay provider. The reference uses
an optional relay for discovery and encrypted store-and-forward, plus authenticated direct paths
when available. Discovery proposes addresses; it confers no trust or standing. Relay loss permits
a bounded alternate-route lookup for the same semantic message under section 7. Resubmitting
an uncertain effect still requires section 4's bar; route choice does not authorize it.
Wire frames are schema-versioned, length-bounded canonical encodings of the port's envelope and adapter receipt;
the core never switches on a Threadline name. The crypto implementation is an adapter dependency,
not a second constitutional decoder. The design calls for signed end-to-end authenticated
encryption through a reviewed library; it does not infer forward secrecy from the presence of
an ephemeral key or certify the existing implementation's cryptographic claims.

**Value — reference wire and key choices, with bounded claims.** No check mandates a cipher
suite. The proposed Threadline suite uses Ed25519 signatures, X25519 key agreement,
HKDF-SHA256 key derivation and XChaCha20-Poly1305 authenticated encryption, implemented through
reviewed library adapters rather than handwritten primitives. The protocol version and suite id
are authenticated fields; unknown suites refuse, never negotiate downward. Each logical frame
binds sender, recipient, conversation, message/operation identity, payload hash and schema version
in canonical signed bytes. Encryption authenticates that signed frame and the same routing
identifiers as associated data; relay-visible metadata reveals those identifiers and ciphertext
length, a privacy cost this choice accepts. Relays hold ciphertext, not grants or secret values.
Re-encryption for a changed route preserves the inner logical identity and digest. Keys are
SecretRefs held by the signing/decryption adapter, never exposed to the worker. The design
promises authenticated confidentiality under its library/key threat model, not forward secrecy
against later recipient-key compromise. Captured fixtures and tamper tests P6-NF-23/24 must
verify the implemented suite; this paragraph is not a security certification of the source audit.

**Rule — transport identity evidence is owned here for Threadline.** Rules 28, 29, 36, 89, 114;
**checks: P6-NF-23/24/25**, combined with P4-NF-02/03/09/28/29. This part claims the
per-transport authenticationClass follow-on for this reference adapter. Other conversation
adapters' identity contracts remain part ten's, because their evidence comes from their own
platforms. The following declarations are part of the Threadline parser entry:

| Required declaration | Threadline realization |
|---|---|
| authenticationClass | verified only when part one's decoder verifies the peer signature and key binding over exact envelope bytes; relay/socket authentication alone is channel-attested about that transport, not proof of the peer's directive |
| Sender identity | Stable VerifiedPrincipal from the governed peer key binding; no display name, address or shortened fingerprint is a principal key |
| Conversation identity | Signed sender and destination principal ids, port conversation id and delegation edge reference; a route string cannot change the conversation binding |
| Forwarding | Preserve the original signed bytes and add an attributable forwarding record; the relay cannot become the sender or widen delegated authority |
| Key change | Rotation requires the governed verification path with old/new binding evidence; unexplained churn holds authority-inert until resolved, never silently trusts first contact |
| eventIdAuthority | Signed peer-minted message id scoped to authenticated sender, recipient and port conversation, plus stable port operation identity; same key/different digest is Conflict |
| Replay window | Recent receipt indexes may be bounded, but a retired index consults permanent admission/terminal facts; elapsed replay window never makes an old operation new |
| ackPolicy | bound-only for authenticated bound peer conversations; protocol rejection does not expose conversation content or the operator identity to an unbound peer |
| Probe | Captured-frame regression replay on a cadence; live identity challenge and worker-delivery canary remain the part-nine verification seam |

**Rule — unknown or hostile transport input preserves the intake boundary.** **Checks:
P6-NF-23/24/25**. Signed does not mean authorized: peer grants, scope, evidence references and
budget still pass part four's intake and part one's decoders. Wrong recipient, invalid signature,
unknown key, replay collision, future schema and malformed length each have a distinct captured
fixture. Unknown-schema replication holds follow part two; an unsupported new live command is
refused with preserved metadata. Ordinary captures and secret custody follow part four, including
its best-effort scan residual. A bridge to a chat platform cannot convert channel attestation
into verified approval. No bridge is enabled unless its own parser contract and identity mapping
pass these fixtures. Trust bootstrap uses a verified operator act or approved org-intent peer
binding; trust-on-first-use discovery is not the authority path.

**Rule — ThreadlineRoute is a mapping, not a grant.** **Checks: P6-NF-02/24/26**. Fields are id,
schema version, verified peer principal reference, local agent identity, port conversation
reference, adapter thread id, key-binding version, endpoint candidates with observation time and
freshness, and causal source references. Immutable conversation/peer identity disagreement under
one id is Conflict. Endpoint replacement appends a new observation. Only the local endpoint
cache is machine-local and disposable; the mapping facts are shared. A route resolves neither
operator standing nor run completion. Capability-aware placement consumes registered capabilities
and measured reachability, then part five records its reason; a transport cannot silently place
an unsupported worker or pick a stronger grant to make delivery succeed.

## 7. Delivery claims and receipt evidence

**Rule — message, delivery attempt and effect have distinct identities.** Rules 26, 42, 63,
114; **checks: P6-NF-25/29/40**. These are identity fields and references in the existing
contracts, not additional types or a second definition of part five's port:

| Identity | Owner and meaning | Behavior across delivery and recovery |
|---|---|---|
| Semantic-message identity | Five owns the logical request/result identity, scoped to authenticated sender, recipient and conversation and bound to its immutable content digest; six carries it unchanged | Stable across routes, worker replacement and duplicate delivery; a result additionally names the request it answers |
| Delivery-attempt identity | Six assigns a unique identity to one transport send or receipt/result lookup, with its mode, semantic-message reference and exact digest | Each separately admitted transmission has its own identity; retransmitted bytes retain theirs; transport duplication is not another logical request |
| Effect identity | Six's stable reserved operation identity, interpreted and settled by eight, including the unchanged seven-attempt mapping in section 4 | Independent of both message and delivery-attempt identity; recovery never changes it to evade an uncertain execution or charge |

A semantic request can refer to child work containing several effects; the receiver's durable
admission links the message to that one child and its effect references. A delivery attempt names
whether it submits the initial message or retrieves stored evidence. A lookup references the
original effect where relevant but is not an execution attempt of it. A transport transmission
that itself needs an effect reservation carries its own reservation reference, separate from the
child's effect identity. Changing a delivery-attempt id never mints a new semantic message,
provider attempt or child-effect reservation. Only initial submission enters the work-creation
path; lookup mode has no create-if-missing arm.

**Rule — the adapter implements the port's states without redefining them.** Rules 26, 42, 98,
114; **checks: P6-NF-25/27/28**. ThreadlineReceipt contains id, schema version, semantic-message
identity, delivery-attempt reference and separately named effect references, envelope digest,
claimed port state, authenticated receipt producer,
authoritative record reference, achieved durability, causal predecessor receipts, clock
measurement and capture reference. All fields are immutable; duplicate identical receipts
collapse, incompatible receipts remain evidence of conflict. This table is the adapter mapping
into part five's vocabulary, not a second port union:

| Port state | Evidence this adapter must supply |
|---|---|
| accepted-by-transport | Relay or direct transport accepted these bytes; no claim of durable custody or worker receipt |
| durably-queued | Named custody store's durable admission for the exact message with durability state; sender-local custody is labeled sender-local, never remote acceptance |
| delivered-to-worker | Signed receiving agent record binding the message to an actual grounded worker delivery, persisted after the harness acknowledged receipt; writing stdin without worker acknowledgment is insufficient |
| answered | Signed result reference, tied to the same semantic request and destination, admitted durably by the result owner |
| refused | Authentic typed refusal from the named boundary, preserved unchanged; transport denial is distinguished from worker refusal |
| uncertain | No adequate proof of a stronger state, or an unresolved dispatch; carries the last proven state and missing evidence |

**Rule — lost acknowledgment recovers evidence, never resubmits uncertain work.**
Rules 26, 42, 63, 114; **checks: P6-NF-27/28/29/40**. The sender preserves an outbox fact
before initial submission. Receiver intake durably records the semantic request and its child
reference before a durable receipt. If the acknowledgment is lost, the sender retains the
original unresolved effect and requests a receipt/result lookup by semantic-message identity,
using a new delivery-attempt identity in lookup mode. It does not repeat the initial submission.
The authenticated lookup consumer checks sender, recipient, conversation and digest, then reads
the existing admission/result facts. It has no work-creation, worker-launch or provider-call
capability. Its responses have these exact meanings:

| Existing record | Lookup response and permitted consequence |
|---|---|
| Durable admission, work pending | Return that receipt and pending status; sender records proven custody, keeps waiting, and does not restart the child |
| Durable result | Return the same stored result identity, digest, provenance and original effect references; sender's five-owned collector conditionally accepts it once |
| Durable collection acknowledgment | Return that same collection evidence; sender of the result can settle its delivery bookkeeping without generating another result |
| Record absent, stale, inaccessible or conflicted | Return unavailable/unknown or Conflict as appropriate; preserve uncertainty and the original reservation; never create missing work or infer non-occurrence |

A receiver keeps its stored result until the sender's result owner acknowledges durable
collection. If that acknowledgment is lost, the receiver looks up collection by the result's
semantic identity. A collector already holding the result returns its existing acknowledgment.
If collection is not yet proven, an authorized collector may fetch the already-stored result
through lookup mode and conditionally collect it; this transfers evidence, not child work.
Lost lookup responses permit another bounded lookup delivery attempt. The observation path uses
registered authentication, disclosure limits, loop/resource admission and any required transport
reservation; it never bypasses an uncertain chargeable observation effect's own section-4 bar.
It cannot perform a fresh chargeable model call to reconstruct a missing result. A historical
receipt retains its original authoritative record and time even when returned by a new attempt;
the new lookup timestamp does not establish fresh worker delivery or reset a peer deadline.

Duplicates of the original submission already in flight still enter intake's semantic dedup:
an existing matching admission returns its stored receipt instead of launching another child;
a changed digest is Conflict. This handles duplicate arrival, not permission to retry an
uncertain submission. If the receiver cannot prove its dedup state, it holds rather than creating
work. A relay TTL may expire its custody copy, not the sender's work obligation. Terminal indexes
derive from permanent facts, so pruning a cache cannot resurrect a child. Unknown delivery state
cannot be upgraded on a timer. Receipt transitions use evidence and causal links, not a numeric
ranking that would erase a refusal.

**Rule — a peer deadline begins on proven peer receipt.** Rule 98, P4-NF-23;
**check: P6-NF-28**. Concurrence needs the peer's signed worker-delivery receipt that binds the
declared deadline/floor and the request the peer was shown. Transport acceptance, sender-local
queue durability or an unauthenticated relay ack cannot start the silence clock. The deadline
must allow at least the declared floor after that proven receipt; delayed delivery invalidates
an earlier unusable deadline and requires a new request. No peer deadline produces Authorization.

## 8. Recovery and startup

**Rule — recovery is durable work through the same doors.** Rules 20, 23, 46, 55, 61, 68;
**checks: P6-NF-13/15/20/30/31**. RecoveryRecord contains id, schema version, incident key,
affected domain/run/operation references, authenticated observer, trigger fact, observed vector,
current register generation, acquired fence reference, attempted repairs with Result references,
next wake, resource/loop references and disposition. Its immutable identity is the incident plus
affected subject; repeated triggers join one episode. Dispositions are recovered, waiting,
stopped-at-bound and blocked-with-evidence. Only recovered closes a successful recovery episode;
none completes the underlying run. Updating disposition means appending a successor record.

**Rule — startup earns admission per scope.** Rules 14, 15, 31, 46, 63, 95;
**checks: P6-NF-30/31/32** hold this order:

1. Verify the independent minimal-plane anchor and open its communication/diagnostic functions
   under their own standing and reserved resources. Failure of that anchor enters the separately
   tested out-of-band repair path, not an unverified conversational impersonation.
2. Verify segment watermarks and checkpoints, then folds and register generation per parts two
   and three. Quarantine only the affected dependency scope; label last-known-good reads.
3. Recover the lease authority's committed prefix and fence epochs. Without quorum or intact
   authority evidence, preserve work and inhibit that domain's mutation families.
4. Enumerate accepted intake without a run acknowledgment, due loop episodes, active runs with
   lost workers, unresolved dispatches and uncollected results. Rebuild indexes from facts.
5. Admit one bounded recovery episode per subject, acquire fresh ownership where needed, and
   reconcile uncertain attempts through section 4. Do not turn process absence into completion.
6. Offer resumable work to part five, which obtains fresh session-start grounding before its
   worker acts. Then enable each validated mutation family and continue ordinary intake there.

**Rule — a wakeup is level-triggered.** Rules 46, 68, 83;
**checks: P6-NF-20/30/33**. A durable next-wake fact remains due until a conditional admission
records its disposition. A dropped timer, server restart or missed notification therefore cannot
lose the wake. Multiple schedulers may discover it; only the exact predecessor and current fence
can claim it. Backlog scans are paged and checkpointed, with per-domain fairness and no full-history
scan on every tick. Healthy scheduling eventually offers every eligible item when its declared
resources and authority are available; indefinite partition does not justify an unqualified
bounded completion promise. Waiting age and stopped-at-bound state remain visible.

**Rule — repair has finite reserved capacity.** Rules 15, 60, 61, 77;
**checks: P6-NF-19/31/32**. The minimal plane's reserved process/memory capacity is deducted
before ordinary allocations, never unlimited extra capacity and never borrowable by ordinary
work. Its local authority domain cannot grant itself the disputed conversation's lease. It can
preserve incoming messages, expose signed infrastructure status, diagnose and execute already
permitted repair operations in its own scope. It forwards or queues conversation work until a
valid conversation owner exists. Part eleven names the live minimal session and its surfaces;
this part guarantees scheduling isolation, not a live-session implementation it does not own.

## 9. Conversation serving across machines

**Rule — ownership and operator binding answer different questions.** Rules 28, 31, 63, 113;
**checks: P6-NF-05/24/32/34**. Part four's binding says whose directions apply. The conversation
lease says which worker may serve them now. Routing never changes the binding. A non-owner may
receive and preserve input through intake, forward its stable reference, and retain it until
durable owner acknowledgment; it cannot start a second conversational worker or send an agent
response on that conversation's behalf. Transport acknowledgments are labeled infrastructure
receipts under their own registered operation, not an invented conversational voice.

**Rule — handoff is break-before-make at admission.** **Checks: P6-NF-11/32/34**. Record the
handoff intent and pending input/result positions; commit loss of the old epoch; assign the new
one; reconcile its unresolved reservations; then start the freshly grounded replacement. Already
admitted external calls remain in-flight exceptions accounted for in section 4, never erased.
A partitioned old holder is fenced even if it never receives the handoff notice. Reconnection
reconciles queued input and receipts by their stable identities. Moving machine, harness, route
or model never creates new logical work identity.

**Value — one conversational voice has an availability price.** No check decides the policy
trade. With unavailable ownership authority, this design preserves and queues conversation work
and keeps the independently authorized repair surface usable; it does not authorize duplicate
agent responses. This is the strict rule-63 reading. If the operator wants conversation responses
from both partition halves, that is a constitutional change, not a fail-open setting quietly
added to an adapter. Sections 12 and 16 record this boundary plainly.

## 10. Six-field cross-part declarations

**Rule — every interaction names all six fields.** Rules 33, 69, 95, 114;
**check: P6-NF-35**, the seam-manifest and wiring fixture, exercises the named transition in both
success and failure directions. Record references denote the owning part's type, never a local
copy. These declarations are obligations of this proposed realization; sibling approval is not
asserted by their presence.

| Interaction | Producer | Consumer | Authoritative record | Transition order | Fail direction | Closure owner |
|---|---|---|---|---|---|---|
| Run ownership/resume | Five submits pending work; six grants ownership/recovery | Five's run and session admissions | Six's committed lease/reservation; five's run facts for work state | Pending work → lease → fence/stop/resource check → grounding → dispatch reservation → result → advance | Close execution on uncertain authority; preserve work and diagnosis | Six closes ownership/recovery attempt; five closes run step |
| Fact persistence | Six's voters, adapter and recovery holder | Two's append/admission and projections | Signed segment facts and referenced committed command evidence | Preserve command → verified append/votes → durable commit evidence → permission | Close permission on insufficient evidence; retain pending input | Two owns admission; six owns command resolution |
| Register/policy | Three's anchored generation and policy declarations | Six's decoders and admission | Entering-force record and protected policy/schema versions | Decode generation → resolve declarations → check current policy → construct component | Close affected admission; independent minimal plane continues | Three owns generation validity; six owns component activation |
| Peer intake | Threadline adapter | Four's intake; five's delegation receiver | Original signed envelope, intake fact and semantic child edge | Capture → provenance → admission → child dedup → worker receipt | Preserve unresolved input; close authority, never infer standing | Four closes intake disposition; five closes delegated work |
| Effect and retry | Eight supplies classified operation and evidence demand; six supplies reservation/wake | Eight's executor and reconciliation | Reservation plus eight's Result/Outcome and nine's accepted verification evidence | Validate → reserve → dispatch-claim → effect → record; on uncertainty schedule verification before retry | Close new/repeated effects on uncertainty; preserve observations | Eight settles effect; nine judges evidence; six closes wake/attempt |
| Judgment and charge | Seven supplies request/attempt; six reserves operation and spend | Eight's model-effect dispatch; five's answer acceptance | Seven's provider receipt/Decision; six's reservation; eight's settlement; five's acceptance | Pending request → ownership/grounding → attempt → fenced spend reserve → effect dispatch → receipt/Outcome/answer → conditional run acceptance | Unresolved execution or charge blocks new attempts; declared default stays within floor | Seven owns answer; eight settles charge; six alone releases credits; five accepts run progress |
| Cancellation/stop | Four authenticates stop; five records run cancellation | Six's admissions, loops and adapter | Four's stop fact, five's causal run state, six's fence | Preserve authenticated stop local-durable → inhibit local admissions → propagate boundedly → reconcile in-flight evidence | Stop locally without waiting for quorum; unknown remote halt stays unknown | Five settles cancellation/work; six drains its reservations and wakeups |
| Results and peer silence | Receiving five through ThreadlineReceipt | Sending five; four's concurrence consumer | Receiver worker/result facts and authenticated receipt binding deadline | Worker receipt → answer → sender durable collection; lost ack → read-only evidence lookup → receipt retention decision | Uncertain never becomes delivered or concurrence | Five collects result; four owns concurrence; six owns delivery evidence |
| Verification/observability | Six's probes, metrics and recovery records | Nine's holders; eleven's operator surfaces | Check/probe observations with subject, capture and clock | Record attempts → measure outcome → evaluate freshness → aggregate surface | Stale proof is unknown/red, not green; status does not close user channel | Nine owns verification adequacy; eleven owns surface action; six owns remediation attempt |
| Assembly and isolation | Ten's registered adapters and executable assembly | Six's authority, timer, launcher and transport ports | Wiring/isolation check-run records and adapter declarations | Verify adapters and authority storage → reserve minimal capacity → activate domains | Close affected family; preserve minimal repair | Ten owns capability isolation; six owns runtime admission |

## 11. The five shared failure traces

**Rule — the trace assertions run across parts, not only inside lease code.** Rules 24, 31, 42,
63, 68, 114; **checks: P6-NF-11/13/25/29/34/35/40**. The integration fixture records each side's
causal evidence and checks the following answers:

1. **Crash after effect, before record.** Worker A has committed dispatch-claim K and the remote
   system applies K; A dies before recording its result. B acquires a new epoch but finds K
   unresolved. B queries K, records decisive happened evidence through eight, and five advances
   once. If lookup is inconclusive, K stays uncertain and the bounded verification loop remains
   owned. If no bytes left, absence still needs proof the old executor cannot later send. A new
   lease or route is never a new operation key.
2. **Duplicate delivery.** Relay and direct path both deliver signed message M. Four deduplicates
   stimulus admission; five deduplicates its delegation/result semantic key across distinct fact
   ids; six deduplicates its command ids and receipts. Two facts are not necessarily two
   operations. Same key with different digest yields Conflict and no new permission. Lost result
   acknowledgment triggers lookup of stored collection/result evidence as in trace five, never
   another submission of the child request.
3. **Cancellation racing completion.** An authenticated stop is preserved local-durable and then inhibits new admissions
   on the fast path; its durable stop fact precedes the halt per four. If an effect was
   already dispatch-claimed, it may still happen and its evidence survives. Completion causally
   before cancellation remains completed evidence; cancellation before a proposed success blocks
   new success admission; concurrent incompatible run terminal proposals remain Conflict under
   five's rules. Six never chooses the terminal winner by clock. Delayed remote stop cannot be
   represented as instantaneous remote halt. Wake cancellation does not delete outstanding effects.
4. **Stale authority.** A's lease is fenced while it is partitioned. Its next admission fails on
   exact epoch/incarnation even if its UI says active and no loss notice arrived. It may submit
   authenticated observations under observer standing; those are not run progress. It cannot
   release B's resources or restart a child. B reconciles A's unresolved claims before retrying.
   A stale register, grant, key binding or tainted fact independently refuses authority, even
   when B has a current lease.
5. **Lost acknowledgment after a durable receipt.** Sender A submits semantic request M in
   delivery attempt D1; receiver B durably admits M, links child C and effect E, and records
   receipt R. R's acknowledgment is lost. A does not know E's outcome. E's reservation
   stays held by its authority while A sends lookup attempt D2 for M; D2 does not execute E. B returns
   the existing R, and either pending status or its already-stored result S. A verifies the
   binding and records R; five conditionally collects S once if present. If S has not been
   produced, A waits for C rather than creating C again. If A's collection acknowledgment is
   then lost, B looks up collection of S and gets A's original collection evidence. Repeated
   lookup responses do not duplicate acceptance. If either lookup finds unavailable evidence,
   uncertainty remains; absence never licenses another E. The fixture asserts unchanged child,
   provider-invocation and child-effect-reservation counts while the distinct delivery-attempt count
   grows within its loop bound, and also tests lost lookup responses and conflicting digests.

## 12. Register declarations and inherited-duty dispositions

**Rule — stores are enumerated with agreements.** Rules 7, 32, 33, 69, 113;
**checks: P6-NF-06/07/35**. These are proposed declarations effective when the implementation is
admitted live, not claims of current deployment. Every row has owner part-six and status live at
that admission, with standards as shown. Projections explicitly fold or ignore every fact kind
and inherit part two's merge-class, taint and pinned-rebuild tests.

| Store / instance family | Growth / memory | Machine scope and reason | Agreement | Standards |
|---|---|---|---|---|
| Authority and reservation facts, loop and recovery facts, route/receipt facts | Existing fact store: unbounded / yes | Shared; each machine writes its own segment | One committed predecessor chain per domain; no permission without committed facts | 7, 31, 32, 33, 63, 68, 90 |
| Lease/admission indexes | deletes / no | Machine-local, rebuildable views | Exact committed prefix; never authorize from a mere cached view | 26, 32, 33, 63 |
| Due-work and recovery indexes | deletes / no | Machine-local, rebuildable scheduling views | Every unfinished episode is due, waiting, running or visibly stopped | 8, 32, 33, 46, 68 |
| Transport outbox, inbox and result-custody views | deletes / no | Machine-local views of shared custody facts | A removed view item has durable recipient/owner receipt or explicit retained terminal | 32, 33, 42, 46, 114 |
| Endpoint and recent-receipt caches | deletes / no | Machine-local; endpoints and acceleration are local observations | Cache miss consults durable identity/receipt facts; never fresh permission | 26, 32, 33 |
| Payload captures | Existing capture store policy / yes | Part two's scope, with local judgment-capture exceptions unchanged | Every live reference resolves or is explicitly unavailable; taint propagates | 7, 26, 100 |

**Rule — gates and active holders declare their actual subjects.** Rules 4, 38, 39, 43, 66;
**checks: P6-NF-07/35/36**. Lease/reservation admission, loop scheduling and Threadline receipt
validation are blocking-site entries: authority block; governed-state rungs name their protected
policy/schema and decoder; the stop and spend rungs are ruled-three. Inputs are preserved through
capture/refusal stores. Each declares closed for execution/authority and open for preserving user
input and informational diagnosis. No code-only filter may infer a new safety boundary. The
Threadline parser carries section 6's full parser facts. The transport and recovery features
carry Profile(control, costly, user, chat, bounded by their actual loop/resource entries), and
the authority feature carries Profile(control, costly, agent, none, bounded). Derived significant,
critical and user-facing flags require three test tiers, live probes and step supervision.
A light judgment supervisor validates recovery step evidence through seven; it cannot waive
fencing, caps or uncertainty, and its unavailability cannot swallow the minimal channel.

**Rule — distinguish inherited deferrals from forward contracts.** Rules 69, 71 and P3-NF-24;
**check: P6-NF-37**, the duty manifest, records the empty inherited set and compares the
following forward obligations with their named checks. No approved part defers a named duty
to part six. Parts one through four supply constraints and types, not a backward list of
six-owned deferred fixtures. The Threadline identity-evidence follow-on is explicitly claimed
in section 6. The big picture's section 6 supplies the effect requirements below; five and
eight must be able to consume their realization without inventing missing behavior.

| Forward consumer and requirement | Rules / source | Disposition in six |
|---|---|---|
| Five: exclusive run/conversation admission and takeover | 31, 63, 68, 113, 114; big picture §4 | Held contract: scoped authority protocol, FenceToken, P6-NF-03/04/05/34; five owns run transitions |
| Five: bounded loops, durable wake and resource carriage | 8, 46, 55, 60, 61, 68, 83, 97; §4/§11 | Held contract: persistent episode/parent budgets and level-triggered wake, P6-NF-17/18/19/20/21/33 |
| Five: transport delivery/result/cancellation semantics | 26, 42, 63, 98, 114; §4/§10 | Held transport half: signed receipts, semantic-id preservation and trace evidence, P6-NF-25/27/28/29/34; partial business terminal semantics remain five's |
| Eight: acquire ownership and idempotency before effect | 60, 63; §6 | Held contract: operation identity, conditional reservation and dispatch-claim, P6-NF-09/11/12 |
| Eight: record uncertainty across crash and takeover | 24, 26, 42; §6 | Held contract: retained reservation and Outcome references, P6-NF-11/13/14; eight owns settled Outcome |
| Eight: schedule verification before retry | 24, 26, 55, 68; §6 | Held scheduling and retry inhibition, P6-NF-13/14/15; partial evidence adequacy is the eight/nine integration contract |
| Eight: do not replace its durability or authority checks | P2-NF-63/73, P4-NF-18; §6 | Held boundary requirement P6-NF-12; partial complete effect policy belongs to eight, not this lease authority |
| Five/seven/eight: chargeable judgment composition | 41, 55, 60, 63, 75, 114; §6 | Held six ownership/reservation/recovery half P6-NF-39; seven owns attempts/receipts, eight settles effect/charge, five conditionally accepts answer |
| Four/ten: Threadline identity evidence | 28, 29, 36, 89, 114; four's parser contract | Held Threadline contract P6-NF-23/24/25; partial all-channel parity remains ten's |
| Eleven: serving and repair during degraded ownership | 14, 15, 31, 63, 77, 95; §11 | Partial: six reserves finite repair capacity and scopes closure P6-NF-31/32; eleven owns the live session/surface; no full conversation-availability promise without authority |

**Rule — partial coverage stays visible.** Rules 26, 69; **checks: P6-NF-01/35/37**. These
contract dispositions remain declared until implemented and run, and remain semantically
unreviewed until nine's review. Process isolation and remaining adapter parity are ten's proof;
the live minimal plane is eleven's; independent effect-evidence adequacy is eight/nine's;
judgment supervision is seven's doorway; protected runtime enforcement retains the nine/eleven
anchor gap. No row calls those protections held merely because it names a consumer.

## 13. Operational bounds and checks

**Rule — non-functional properties have subjects, budgets and failure actions.** Rules 13, 34,
38, 39, 43, 60; **checks: P6-NF-19/31/32/33/36/38**. Each measurement names domain/operation/
peer or machine, time and registered producer. Test thresholds below are reference acceptance
budgets, not observed latency claims. A slower implementation reports failure against its policy
instead of silently changing the unit or excluding failed samples.

| Property | Automatic check and reference condition | Failure action |
|---|---|---|
| Exclusive admission | Model-based interleavings, 1/2/3/5 voters, partitions and restore; zero conflicting committed reservations for one operation | Close affected domain; retain evidence |
| Stop responsiveness | Integration measures receipt of authenticated stop to local admission inhibition; reference ceiling 1 second under saturated ordinary work | Critical defect; minimal stop path stays isolated; no remote-latency fiction |
| Recovery scheduling | Under healthy quorum and free reserved capacity, due eligible work offered within two scheduler periods; reference period 5 seconds | Owned backlog defect and bounded repair |
| Memory/process bounds | Unit arithmetic plus integration flood runs; allocation never exceeds declared finite ordinary plus pre-reserved repair capacity | Refuse excess before allocation; expected cap recorded distinctly |
| Transport fairness | Saturate one peer while another has admissible work; second peer gets service within one declared fair scheduling round | Peer-bound violation; coalesce offender's queued wakes |
| Replay cost | Measure scanned facts, bytes and duration; incremental recovery reads committed suffix and indexes, not genesis on each tick | Budget-stopped recovery with next bounded work, not successful rebuild |
| Delivery honesty | Kill at every send/capture/receipt/collection boundary; zero unsupported worker-delivery or answer claims | Uncertain and verification wake |
| Three-tier liveness | Unit reducer tests; integrated ports with actual persistence/decoders; production assembly on two machines with authenticated channel and actual worker receipt | Feature cannot declare live without all evidence |
| Supervisor and probe life | Cadenced signed proof of supervision and real adapter canary; fixture replay alone not live identity proof | Unknown/stale holder posture, scoped integrity closure |
| Retention | Prune caches, expire relay custody, rebuild at same vector; zero lost work obligations or resurrected semantic operations | Agreement defect; reconstruct from permanent facts |

**Value — reference ceilings are tunable.** No check enforces their suitability for every fleet.
The governed policy supplies finite deployment values and their rationale; the checks above
verify those values and publish the measured distribution including timeouts. Fleet size, voter
placement and quorum latency must be measured before choosing a production term. No busy-waiting
or shorter backoff may conceal an unmet target.

**Rule — stalls are enumerated before live registration.** Rule 59;
**check: P6-NF-38** requires these classes and their actual harness-specific captured evidence:

| Stall | Detection evidence | Bounded recovery |
|---|---|---|
| Transport unavailable / relay down | Failed authenticated send or challenge; last proven receipt | Loop-governed evidence lookup on alternate route; effect retry only under section 4 |
| Worker never receives input | Receiver custody exists, no worker acknowledgment | Preserve input; verify launch; resume only under fresh fence |
| Worker dies after receipt | Grounded worker receipt then missing worker plus pending run | Recover run and unresolved operations, never infer answer |
| Worker alive but no progress | Cadenced progress evidence absent beyond registered threshold | Signal supervisor; bounded diagnosis, not blind respawn |
| Resource or model unavailable | Typed capacity/provider outcome | Preserve work; bounded recheck/registered provider path |
| Quorum unavailable / stale authority | Failed current conditional admission | Queue work; preserve repair plane; never elect from gossip |
| Projection/capture invalid | Verification failure or explicit unavailable capture status | Quarantine only affected scope; rebuild/observe, never authorize from stale view |
| Reconnect/recovery churn | Persistent family attempt and resource counters | Breaker and stopped episode, retained obligation |

## 14. Negative contract fixtures

**Rule — every fixture has both a refusing case and a valid neighboring case.** Rules 34, 36,
37, 69; **check: P6-NF-01** verifies stage, registration, execution and assertions. Tests below
are required implementation artifacts, not tests this document claims already exist.

| Fixture | Stage | Failure the check must expose |
|---|---|---|
| P6-NF-01 | build | Declared checks reported as held without executed records; missing fixture or positive neighbor |
| P6-NF-02 | build / decode | Foreign-owned type redefined; open constructors; protocol branch in core; unknown schema accepted |
| P6-NF-03 | model test | Two leaders commit incompatible successors; stale projection issues lease; majority without leader-recovery safety |
| P6-NF-04 | integration | Restore loses promised vote/epoch; unilateral membership shrink; acknowledged command lost within tolerance |
| P6-NF-05 | contract | Wrong scope/incarnation/epoch or copied token admits action; high uncommitted epoch trusted |
| P6-NF-06 | integration | Authority journal not reconstructable from facts; view mutation or rebuild drift; undeclared fold input |
| P6-NF-07 | build | Admission principal can change enforced policy; missing declared gate or preserved refusal input |
| P6-NF-08 | contract | Duplicate renew/release changes result; old owner releases successor capacity; local timeout completes run |
| P6-NF-09 | integration | Effect/launch calls adapter without committed reservation and dispatch-claim; standing omitted because lease is live |
| P6-NF-10 | model test | Wall-clock jump or restored timer resurrects lease; delayed loss notice allows admission |
| P6-NF-11 | integration | Crash at any reservation/send/result boundary repeats a logical operation or loses its unresolved record |
| P6-NF-12 | integration | Lease quorum substitutes for effect durability demand; provisional or stale authority permits dispatch |
| P6-NF-13 | integration | Uncertain attempt retried on timeout, route change, new key, weak absence or still-live old executor |
| P6-NF-14 | contract | Inconclusive verification settles Outcome; recovery owns eight/nine's verdict; stale worker observation treated as permission |
| P6-NF-15 | integration | Verification wake missing after unresolved dispatch; repair escalation claims exhaustion without five's evidence |
| P6-NF-16 | build | Operational timer/retry/self-spawn outside primitive; hidden library retries uncharged |
| P6-NF-17 | unit | Zero becomes default; invalid bounds accepted; cap/backoff/breaker bypassed; omitted consumer fail direction |
| P6-NF-18 | model test | Restart/route/episode resets counters; concurrent half-open trials exceed bound |
| P6-NF-19 | integration | Nested child allocations exceed parent or physical cap; ordinary work borrows minimal-plane reserve |
| P6-NF-20 | integration | Lost timer strands work; two schedulers claim one wake; machine loss deletes due record |
| P6-NF-21 | unit / integration | Loop capacity Success becomes business Success; stopped duty silently closes; restart manufactures new budget |
| P6-NF-22 | evidence check | Source observation's count/hash differs from pinned capture, or source finding labeled live proof |
| P6-NF-23 | captured contract | Signature/recipient/schema/length negative accepted; attestable relay information labeled peer verified |
| P6-NF-24 | contract | Discovery/rename/key churn/bridge changes peer or operator standing; route implies grant |
| P6-NF-25 | integration | Duplicate signed message or same-id changed payload repeats semantic work; expired cache accepts replay anew |
| P6-NF-26 | integration | Route/schema migration changes logical conversation/operation identity or weakens standing |
| P6-NF-27 | integration | Socket send or local custody reported as worker delivery; refusal becomes successful delivery |
| P6-NF-28 | integration | Peer silence starts before authenticated worker receipt or below deadline floor; yields Authorization |
| P6-NF-29 | integration | Lost collection ack re-executes child; relay TTL deletes obligation; results stranded by parent death |
| P6-NF-30 | lifecycle | Boot enables scope before verified prefix; session revival skips five's fresh grounding; duplicate recovery episodes |
| P6-NF-31 | lifecycle | One non-minimal corrupt dependency closes unrelated scopes; last-known-good view authorizes mutation |
| P6-NF-32 | lifecycle | Quorum loss starts duplicate conversation worker; resource saturation denies independent repair session |
| P6-NF-33 | integration | Starved eligible domain, full-history work every tick, or overdue wake has no owned disposition |
| P6-NF-34 | multi-machine | Handoff grants old/new admission together; cancellation discards in-flight evidence; timestamps choose terminal state |
| P6-NF-35 | wiring | Missing six-field seam, no-op dependency, mismatched closure owner, undefined effect/verification evidence contract |
| P6-NF-36 | lifecycle | Live feature without three tiers, actual channel proof, metrics, supervisor or fresh critical-outcome probe |
| P6-NF-37 | build | Empty inheritance misrepresented; a forward requirement lacks disposition or check; declared protection inflated into held |
| P6-NF-38 | onboarding / lifecycle | Stall class absent, detected only by label, or recovery bypasses finite loop/authority admission |
| P6-NF-39 | integration | Chargeable model call before fenced spend reservation; attempt maps to multiple operations; takeover double-charges; unknown charge releases credit; seven mutates a parallel spend ledger; stale answer advances run |
| P6-NF-40 | integration | Lost ack after durable receipt resubmits uncertain effect, creates missing work, re-calls provider or duplicates collection; lookup miss clears uncertainty; delivery-attempt id substitutes for semantic/effect identity; returned old receipt resets peer deadline |

## 15. Terms introduced here

**Rule — the load-bearing vocabulary is explicit.** Rule 69 and part three's resolver;
**checks: P6-NF-02/35** require these proposed term entries and structured references at conversion.
Names owned by earlier parts retain their existing definitions.

| Term | Meaning |
|---|---|
| Execution domain | The scope grouping whose ownership, stop and resource admissions share one serialized authority |
| Conditional admission | Committing a requested transition only against an exact current predecessor and authority |
| Quorum | A declared intersecting voter set needed for committed authority; never a count of gossip sightings |
| Worker incarnation | One process lifetime, distinct from durable principal and machine identity |
| Fence | An increasing committed ownership epoch rejected when it is no longer current at admission |
| Operation reservation | Durable allocation of one logical operation and its credits before dispatch |
| Dispatch-claim | The committed single-attempt handoff into an executor; unresolved until its outcome is established |
| Loop episode | A finite execution window under one persistent duty and shared budgets |
| Breaker | Durable inhibition after sustained failure, with bounded cooldown and half-open trials |
| Level-triggered wake | Work remains discoverably due until a durable disposition, regardless of lost timer signals |
| Recovery episode | Owned, bounded reconciliation of an incident and its still-pending work/effects |
| Semantic-message identity | Stable authenticated logical request/result identity owned by five; unchanged across transmission attempts |
| Delivery-attempt identity | Six's identity for one admitted transmission or evidence lookup, never an identity for child work |
| Effect identity | Six's reserved operation identity settled by eight; independent of message and transmission identities |
| Evidence lookup | Authenticated read of stored receipt/result/collection facts with no create-if-missing or effect-execution capability |
| Custody receipt | Authenticated evidence that a named store durably holds exact message bytes/references |

## 16. Operator decisions and honest limits

**Value — recommended decision: scoped quorum authority.** No automatic check chooses whether the
availability cost is acceptable. Adopt the scoped conditional-append design, with three voters
where automatic one-voter-loss failover is required, or one voter with explicitly unavailable
failover for smaller installations. This does not change the spine into a global ordered stream.
A demand for full conversation execution through every partition conflicts with strict ownership;
changing that policy belongs to the operator, not the transport adapter.

**Value — recommended decision: preserve uncertain effects indefinitely as obligations.** Bound
active retries and observation episodes, not truth. A destination with no decisive lookup can
leave an operation uncertain permanently until a standing-covered resolution supplies evidence
or explicitly accepts an outcome risk. No check decides whether that product trade is desirable;
the checks ensure it is not silently presented as failure or success. An operator-authorized new
risk-taking action is separately recorded, never relabeled proof that the old action did not happen.

**Value — technical choices do not require a mid-run operator interruption.** No additional
constitutional boundary is proposed. Threadline-only identity scope, no authority from discovery,
finite policy defaults and immutable reservation identity are reviewable choices in this design.
The reference-monitor, live minimal-session, cryptographic implementation assessment and eight/nine
evidence-adequacy limits are explicitly partial with their owners above. They are not omitted
sections and not claims that those parts are already complete. No check enforces the usefulness
of these choices; the independent review desk judges feasibility before the operator approves
this governed document.
