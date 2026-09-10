## 8. Delivery evidence, durable recovery, and no silent loss

**Rule — delivery claims are distinct and source-bound.** Rules 9, 26, 42, 62 and 89;
**checks: P12-NF-34/35**. The landed `OperationObservation` contains only its record identity,
request, operation, claim, digest, account, conversation, recorder stage, wake, capture reference
and hash, and the `local-recorder` attestation. Its stage names the recorder phase. The allowed
values mean: `executor-accepted`, the local executor consumed the claim; `response`, invocation
returned captured response bytes; `unknown`, invocation produced no conclusive response;
`observer-accepted`, a six-owned read-only observation wake was consumed; and `lookup`, that query
returned captured bytes. None of these values means delivered, displayed, or read.

The surrounding signed fact envelope supplies recorder principal, provenance, clock, and causal
predecessors. Provider receipt identifiers and response details remain inside the immutable bytes
named by `capture.reference` and `capture.hash`; they are not extra observation fields. Part Nine's
registered evidence decoder authenticates those bytes, binds them to the observation's exact
account, conversation, operation, and digest, and emits `Evidence` references. Here, quiescence
means evidence that an old executor can no longer apply the operation. The current
`VerificationAssessment` applies the plan's stage-specific bar as separate occurrence,
non-occurrence, quiescence, and charge predicates, naming missing evidence and limitations in each
predicate reason. A Bot API response can therefore support “provider accepted this exact post”
without supporting “a person received or read it.” A later delivery, display, or read claim needs
its own authenticated callback or lookup capture and an assessment bar that admits that source.

A P12-NF-34 observation case records this exact closed shape inside its fact envelope:

```json
{
  "type": "OperationObservation",
  "schemaVersion": 1,
  "id": "observation:example",
  "request": "request:example",
  "operation": "operation:example",
  "claim": "claim:example",
  "digest": "sha256:example",
  "account": "telegram:bot-example",
  "conversation": "telegram:chat-example:topic-example",
  "stage": "response",
  "wake": "",
  "capture": { "reference": "capture:provider-response", "hash": "sha256:response" },
  "attestation": "local-recorder"
}
```

The referenced bytes contain the provider's message id and acceptance response. Part Nine accepts
only the provider-acceptance occurrence predicate; the human-delivery and read claims remain
insufficient. HTTP success, socket write, local log, or adapter return alone cannot be promoted
further, and the adapter cannot grade itself.

The landed positive stops at that assessment. Nine accepts occurrence Evidence whose predicate is
`operation-occurred` and whose object-valued claim contains the exact digest. Its returned
`Outcome` retains those source Evidence ids. Eight currently requires each retained Evidence claim
to use the digest itself as predicate and `happened` as its value before it will append settlement.
One immutable Evidence record cannot satisfy both contracts, and an adapter-created replacement
would usurp Nine. P12-NF-35's real settlement positive and P12-NF-44's settled Telegram path
therefore depend on `design-conversation-adapters-seam-request-effect-assessment-consumption.md`.
That contract is granted in `seam-response-effects-followup.md`, and P12-NF-35/44's settlement
positive is non-executable until that grant file lands and its Nine/Eight implementations are
integrated. It keeps every original observation and Evidence record unchanged, gives Nine one current
owner-validated outcome view bound to the operation, attempt, digest, bar, and source evidence, and
lets Eight consume that view without applying a second predicate convention. Acceptance requires a
joint real Nine/Eight settlement fixture; the landed Nine stand-in in Eight's fixture is not that
evidence.

**Rule — unsupported negative evidence leaves an owned uncertainty.** Rules 26, 42, 63
and 68; **checks: P12-NF-34–36**. Each mode declares whether it supports stable receipt lookup,
decisive non-occurrence, exclusion of delayed execution, and any final charge. Telegram and other
send-only modes do not gain those capabilities by belonging to the conversation family. A timeout,
eventual search miss, missing chat display, expired history, local process death, or new credential
does not prove the old send failed. The original operation remains owned, its maximum application
and charge exposure remains visible. No replacement effect runs in the landed slice. A future
successor for the unchanged logical request and digest requires the shared Part Eight/Six retry contract requested in
`design-harness-adapters-seam-request-retry.md`, granted by `seam-response-effects-followup.md` and
`seam-response-loop-followup.md`, plus current Part Nine evidence.

**Rule — the durable outbox is a projection of facts, not a private queue.** Rules 7, 32, 33,
42, 45, 46 and 68; **checks: P12-NF-33/37–39**. Prepared operations, claims, observations,
settlements, recovery episodes, and notification duties live on the fact spine. An adapter-local
queue may accelerate dispatch but is disposable and cannot acknowledge custody by itself. Restart
and takeover rebuild due work from facts, preserving original semantic and attempt identities.
Every accepted item is due, claimed under a current fence, settled, explicitly refused, or held
with an owner. “Dead letter” is a visible retained terminal or pending obligation, never deletion
of the message or evidence.

**Rule — current send recovery observes; it does not retry.** Rules 8, 42, 46, 55, 60, 61, 68
and 88; **checks: P12-NF-36–40**. Part Six owns cadence, backoff, concurrency, elapsed-time,
resource, and breaker limits for repeated observation. Rate-limit hints are observations supplied
to that loop, not policy executed inside a platform client. Repeated bounded scans rediscover due
unknown operations. Each wake may call only the landed read-only `OperationAdapterPort.observe`
for the unchanged operation and digest. It makes zero additional `invoke` calls. One failing
account or conversation cannot starve another eligible one. Zero is a valid configured cap.
Exhaustion keeps the operation, uncertainty, evidence, and owner visible and creates Part Five's
bounded follow-through rather than silence or an infinite timer. The landed `EffectSettlement`
always has `retryEligible: false`, and Six's accounting preserves that restriction. No successful
send-retry case exists in the executable slice. A future unchanged-request, unchanged-digest attempt after proved non-occurrence,
old-executor quiescence, and final charge closure depends on the shared additive owner contract in
`design-harness-adapters-seam-request-retry.md`, granted by `seam-response-effects-followup.md` and
`seam-response-loop-followup.md`. P12-NF-37's successful successor positive is non-executable until
both grant files land and their implementations are integrated. An adapter or Six cannot create
that permission itself.

**Rule — a service round has item membership, bounded backlog, and a finite service bound.** Rules
13, 14, 46, 55, 60, 61 and 77; **check: P12-NF-40**. The deterministic stop path is outside service
rounds. A first-service head is the earliest admitted intake, dispatch, or observation item on that
route that has neither received its first service opportunity nor reached an owner-derived terminal
disposition. It becomes eligible when it is due, its owner state permits ordinary service, and it
is not already under a live ordinary claim. Eligibility belongs to that item, not to the route in
the abstract. Its first-service membership ends after that opportunity even when the owner result
is uncertain. The underlying intake or operation remains owned and unresolved; it is not marked
complete to advance the route.

At round opening, the loop records the causal frontier and freezes at most the eligible
first-service head from each admitted route. Each frozen member is an exact item identity paired
with its route and eligibility clock. The round ends only when every member has received one
bounded service opportunity or has a recorded owner-derived reason it ceased to be eligible. An
item that becomes a first-service head after opening enters the first later round opened after its
eligibility clock. It does not enlarge the current frozen population.

Later observation wakes for an uncertain operation obtain service membership as distinct,
already-preserved observation items. Each wake keeps the same operation and immutable digest,
records its own stable owner reference and due clock, and enters through
`admitRouteServiceItem` at the route tail. It may be selected after its predecessors have each
received a first opportunity or reached an owner-derived terminal disposition. Re-admitting the
same wake is idempotent. Serving a wake permits only its registered observation action; it neither
replays the uncertain invocation nor declares the underlying operation complete.

Each exact adapter mode uses a Part Six route-service policy with a positive maximum round duration,
positive maximum selection count, positive maximum admitted item count per route, and finite maximum
eligible-route count. The eligible-route count must fit within the round selection count. Ordinary
service admission records an item's stable owner reference, route, admission clock, first-in-first-out
predecessor, and bounded backlog position. An item admitted at position `p` receives its first
service opportunity within at most `p + 1` declared round durations from admission. The extra round
is the worst case for admission immediately after a round opens. Once the item becomes first-service head,
it receives its first opportunity by the close of the first round opened after that eligibility
clock.

An item beyond the per-route or eligible-route cap is not admitted into ordinary service. Part Six
returns an explicit `budget-exhausted` refusal to the owning intake or run, which retains the
already preserved owner record and records the disposition. The item never enters an unbounded private queue.
Continued overload therefore cannot lengthen an admitted member's deadline or create an ownerless
item. Coalescing means only that notices sharing one declared episode identity occupy one bounded
notification item; it never removes an admitted service item.

The measurement records item identity, route, admission clock, backlog position, eligibility clock,
round open and close clocks, frozen item population, selection count, first-service clock, and every
timeout or refusal. P12-NF-40 fails and activation is inhibited if the head deadline, the positional
backlog deadline, or either capacity invariant fails. These records require the additive Part Six
route-service contract granted in the dated 08:03Z addendum to
`seam-response-loop-followup.md` (SEAM-LEDGER row 43). P12-NF-40's positive is non-executable until
that grant file lands and its owner implementation is integrated.

Every platform sends its native deterministic stop affordance directly through Four's intake path,
outside ordinary service scheduling. Stop recognition occurs only after Four preserves, deduplicates,
authenticates, and resolves the binding. A recognized bound-operator stop appends Four's local-durable
stop fact first and applies Six's local halt immediately.
Neither a live ordinary claim on that route, an open round, the ordinary eligibility set, nor a
replication peer may delay that fact or halt. A resolved requester's stop-shaped signal also bypasses
the ordinary claim and round, but remains Four's highest-priority non-authorizing signal: it surfaces
immediately and cannot halt by itself. An ambiguous “maybe stop” remains ordinary intake. The stop
measurement records recognition, the stop fact, halt application, and their precedence over every
ordinary selection on the affected scope.

**Rule — failure notices do not create a recursive message storm.** Rules 14, 52, 53, 54, 87
and 95; **checks: P12-NF-40/41**. The original operation is repaired when safe. A required notice
uses part eight, the existing alert destination, stable coalescing identity, and finite episode
budget. It never creates one topic or notice per retry. If the conversation route itself is down,
the notice remains a visible obligation on an independent operator surface. Failure to send the
failure notice cannot mark the original delivered or launch an unbounded notice-about-notice loop.

---
