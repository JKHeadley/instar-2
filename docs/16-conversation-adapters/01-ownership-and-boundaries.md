## 1. Ownership and boundaries

**Rule — part twelve defines no new core type.** Rules 1, 30, 49, 69 and 90; **checks:
P12-NF-01–03**. A conversation adapter is a concrete package behind public ports already owned by
earlier parts. Adapter methods, platform constants, and private protocol state are implementation
details. Durable records use the following owned types. This part creates no second message,
principal, binding, queue, retry, effect, receipt, verification, assembly, or surface schema.

| Owner | Names consumed here |
|---|---|
| One | `VerifiedPrincipal`, `StandingGrant`, `Revocation`, `Intent`, `Directive`, `Authorization`, `Scope`, `Result`, `Outcome`, `Evidence`, `Measurement`, `Profile`, `Decision`, `Conflict`, `UnresolvedInput`, provenance and secret references |
| Two | fact envelope, durability state, capture reference/status, causal frontier, lineage, projection, checkpoint, folded-through vector, taint, redaction and replay |
| Three | declaration, parser entry, register generation, governed port, check-run record, rule graph, freshness and activation state |
| Four | intake port, conversation binding, event-id authority, acknowledgment policy, operation classification, authorization request and session-start evidence |
| Five | durable run, run step/transition/exit, `SessionGrounding`, agent-transport envelope and delivery evidence; `ContinuityAccounting` is designed by Five but is not in its landed record union |
| Six | lease, fence token, admission reservation, operation and delivery-attempt identity, dispatch-claim, loop record, recovery record and custody receipt |
| Seven | judgment request/resolution, advisory decision, benchmark record and measured hold cost |
| Eight | `OperationDefinition`, `EffectRequest`, `EffectValidation`, `OperationObservation`, `EffectSettlement`, `OutboundMessage` and `OperationAdapterPort` |
| Nine | verification plan/request/assessment, probe record, semantic review, grade, assessment closure and independent witness posture |
| Ten | `AdapterEvidenceContract`, `AdapterConformance`, `AssemblyManifest`, `AssemblyAdmission`, `HarnessLaunchSpec`, `HarnessObservation`, `AssemblyHistoryReadPort`, concrete binding, confinement and package lifecycle |
| Eleven | verified pairing/binding surfaces, minimal-plane dependencies, operator views and whole-slice acceptance |

Two required owner additions are not in the landed contracts. Secret-bearing intake depends on
`design-conversation-adapters-seam-request-intake-custody.md`. The Four-owned consumer is granted in
`seam-response-intake-followup.md`, and the Ten-owned custodian is granted by reference in
`seam-response-assembly-followup.md`. P12-NF-12's secret-safe positive is non-executable until both
grant files land and their implementations are integrated. The operation keeps original secret
bytes exclusively in secret custody and gives ordinary intake consumers only a redacted capture.

Slack direction, organization permission, and ambient handling depend on
`design-conversation-adapters-seam-request-intake-policy.md`. Four's structural direction,
organization-permission, and channel-policy record and consumer are granted in
`seam-response-intake-followup.md` (SEAM-LEDGER row 18). Seven's versioned intake-policy judgment
consumer, which does not require an existing Part Eight effect request, is granted in the dated
addendum to `seam-response-judgment.md` (SEAM-LEDGER row 35). P12-NF-19/20's policy-bearing
positives and Slack activation are non-executable until both named grant files land and their
implementations are integrated. None of these granted but unlanded records or operations is
treated as present in the executable slice.

Slack ephemeral delivery has its own Part Eight audience dependency. The single-member payload and
evidence contract is granted in the 09:10Z addendum to `seam-response-effects-followup.md`
(SEAM-LEDGER row 53), extending the conversation variants in
`seam-response-effects-payloads.md`. P12-NF-32's positive is non-executable until both grant files
land and their implementations are integrated. The operation names exactly one channel member
resolved from signed Part Four history, reports unsupported when private delivery to that member is
unavailable, records the audience actually reached, and never widens to channel text on retry or
fallback.

Five's landed `SessionGrounding` describes the history, clock, worker, harness, and current-work
coverage for `start`, `recovery`, and `resume`. Its landed consumption validator, however, accepts
only a flat compatibility receipt with top-level `worker`, `harness`, and JSON-string `hashes` and
`classes`. Ten's production evidence is instead a signed `HarnessObservation` stored under
`body.record` and resolved through Ten's public `AssemblyHistoryReadPort`. The initial-context arm
follows its admitted `HarnessLaunchSpec` under the dated 06:33Z grant in
`seam-response-rungraph-followup.md` (SEAM-LEDGER row 38). The later-delivery contract is refined by
the 08:48Z grants in `seam-response-assembly-followup.md` and
`seam-response-rungraph-followup.md` (SEAM-LEDGER row 45). Ten's immutable context-delivery
specification binds the current candidate step, intake/input and digest, ordered current manifest,
generation, execution context, unchanged incarnation, delivery reason, admitted delivery
operation, one-use claim, and predecessor delivery. Five resolves that current specification and
its consumption observation rather than requiring later input or context to equal the launch's
original input or manifest.

The `GroundingReadPort.read` invoked by `RunGraphPort.ground()` owns one complete actual-start
sequence: sample the fresh clock and current history/run/directive/register/pending-work state;
append and resolve the current Ten delivery specification; drive its admitted delivery; witness and
re-resolve `context-consumed`; then return `SessionGrounding` with the clock sampled inside that
read. `transition(start)` repeats resolution of the launch, current delivery specification,
consumption observation, grounding, current step/input, and current Six execution context. The
initial input, a second distinct inbound, and changed post-compaction context therefore produce
three immutable, distinct delivery records on one unchanged incarnation. P12-NF-43/44/48's
production positives are non-executable until both row-45 grant files land and their Ten/Five
implementations are integrated; row 38 remains the initial-context arm only. The flat receipt
remains valid only for isolated compatibility fixtures. Stale, wrong-kind, partial, conflicted,
mismatched, non-consumed, incomplete-manifest, pre-completed, or retimestamped evidence refuses.

Compaction has a separate dependency. Five's `ContinuityAccounting` producer is granted in
`seam-response-run-closure.md`, its public producer/reader follow-up is granted in
`seam-response-rungraph-followup.md`, and Eight's first-reply consumer requested by
`design-conversation-adapters-seam-request-rungraph-continuity.md` is granted in
`seam-response-effects-followup.md`. The complete compaction case in P12-NF-43 is non-executable
until all three grant files land and their implementations are integrated. Part Twelve retains the
final family obligation but does not call the missing record existing.

Two further owner gaps block the real positive chain. The Nine/Eight outcome-consumption contract
requested in `design-conversation-adapters-seam-request-effect-assessment-consumption.md` is granted
in `seam-response-effects-followup.md`. P12-NF-35/44's settlement positive is non-executable until
that grant file lands and its Nine/Eight implementations are integrated. It preserves Nine's
original predicate-shaped evidence.

The Seven/Eight provider operation requested in
`design-conversation-adapters-seam-request-model-provider-effect.md` is granted on Seven's side in
`seam-response-judgment.md` and on Eight's side in `seam-response-effects-followup.md`.
P12-NF-43/44/48's real-model positives are non-executable until both grant files land and their
implementations are integrated. Neither the Nine stand-in nor Seven's reference executor is
treated as a landed positive.

Item-level ordinary-service fairness has a separate Part Six gap. The landed `LoopPolicy` has no
per-route backlog or eligible-route capacity. Its `BoundedDueScanPort` pages caller-supplied keys
but does not admit an item, establish first-in-first-out route position, freeze item-level round
membership, refuse overload, or record first service. The separately granted `pageBatch` arm in
`seam-response-loop-followup.md` bounds enumeration only and expressly remains selection-only.
P12-NF-40 therefore depends on the Part Six route-service policy, `admitRouteServiceItem`, and
round open/opportunity/close contract granted in the dated 08:03Z addendum to
`seam-response-loop-followup.md` (SEAM-LEDGER row 43). Its positive is non-executable until that
grant file lands and the resulting owner implementation is integrated.

Idempotent held and expired intake recovery has a separate Part Four gap. The landed duplicate
branch joins only an `intake-admitted` item. A matching redelivery of an `intake-held` item creates
another receipt and another hold with a later expiry. `IntakePort.recover(receiptId)` calls
`receive` again, so recovery of the original receipt does the same. The required Four-owned
receipt-continuation operation is granted in the dated addendum to
`seam-response-intake-followup.md` (SEAM-LEDGER row 46). P12-NF-09/38 and the held-or-expired
redelivery and recovery arms of P12-NF-13/19/20/22/51 are non-executable until that grant file
lands and its implementation integrates. An adapter-local cache or private terminal filter
cannot satisfy this dependency.

**Rule — translation cannot become policy.** Rules 4, 28, 30, 42, 63, 66, 89 and 103;
**checks: P12-NF-03–05**. An adapter may authenticate a protocol exchange, preserve bytes, expose
capabilities, render an already admitted message, invoke one admitted platform operation, and
return observations. It may not select standing, establish a conversation binding, classify an
ask by prose, turn an advisory into a wall, turn a refusal into success, choose a retry, mint a
replacement effect, or bypass the register. Core packages contain no Telegram, Slack, WhatsApp,
iMessage, or browser-protocol branch. Part ten binds exactly one concrete adapter instance to each
declared account and mode.

**Value — a narrow adapter is easier to replace.** Platform libraries often offer routing,
authorization, retries, queues, formatting, commands, and session management in one object. This
design accepts the extra composition work of separating them. That cost buys one authority model
and one recovery model across every channel.

---
