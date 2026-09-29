# Seam response — Part Four follow-up bundle (GRANTED, additive; builds on seam-intake-scheduled)

Decision: GRANTED as ONE additive owner-owned change to Part Four (src/intake), built on top of branch
seam-intake-scheduled once it lands. Basis: docs/08-the-intake.md specifies secret-safe custody, observation intake,
and conversation-policy classification; the landed port is a bounded conversation/stop slice. GUARD: verify each named
record/behavior against the approved design before implementing; unnamed behavior is not granted. `receive`, `recover`,
`expireHolds`, `classifySlicePayload`, `admitVerifiedAct`, `receiveScheduledTick`, `pendingScheduledAdmissions` keep
their behavior byte-for-byte.

- #17 design-conversation-adapters-seam-request-intake-custody.md — the secret-safe two-artifact preservation boundary
  (a confined Part Ten custodian receives original bytes and writes secret material; Part Four's receipt/dedup/handoff/
  recovery consume the redacted consumer artifact + capture reference/hash; Part One SecretRef) exactly as requested;
  the Part Ten custodian half belongs to seam-response-assembly-followup.md's scope and is granted there by reference.
- #18 design-conversation-adapters-seam-request-intake-policy.md — Four-owned structural direction / organization-
  permission / channel-policy inputs and their recorded disposition (incl. an explicit unsupported-content result), with
  any semantic ambient choice routed to Part Seven inside a registered action floor; adapters supply authenticated
  structural evidence only, never permission or disposition.
- #12 design-measurement-ledgers-seam-request-intake-observations.md — `submitObservation` on IntakePort accepting an
  existing Part One Measurement + Evidence with the closed input listed in the request; admits nothing but the
  observation fact.
- #16 legacy-import (Part Four share) — authority-inert legacy conversation-reference evidence usable by routing and
  Part Eleven's verified-binding surface; it never establishes a verified operator or binding.
Acceptance evidence: the union of the request files' acceptance sections as REAL three-tier tests in Part Four's
contract map; every pre-existing Part Four fixture decodes and behaves identically.

- (added 08:38Z from astra-design-conversation-adapters-2fcf9823.md CA-02 via design-conversation-adapters-seam-request-intake-held-recovery.md; basis docs/08 lines 227-234 + 325-333 [preservation before deduplication; every collapse recorded; held items drain to NAMED terminals] — the landed dedup search covering only admitted/stop/stop-signal is a SLICE gap) ONE receipt-continuation operation behind the public intake port (keep `recover` or add `continueReceipt(receiptId)`; BOTH a new arrival and recovery of an existing receipt enter this one owner implementation after preservation): consumes an exact existing intake-receipt reference; reads its captured bytes, original arrival clock, canonical logical id, arrival hash, route and current signed Part Four history; never calls raw `receive`, never creates a new capture or intake-receipt merely because recovery ran. Closed behavior for a logical id + matching arrival hash: (1) existing intake-admitted / intake-stop / intake-stop-signal → landed duplicate or stop re-authentication behavior preserved; (2) one ACTIVE intake-held → append the existing intake-collapse for the new arrival receipt pointing at that original hold, return the existing duplicate disposition shape, append NO second hold, never change owner/reason/expiry or consume another active-hold slot; (3) the original hold has an intake-expired terminal → collapse pointing at the owner-derived terminal history, same shape, no reopen, no later deadline; (4) no owner state → continue the landed authentication/classification/stop/hold/admission sequence using the receipt's ORIGINAL arrival clock and bytes. Real provider redeliveries still enter receive(raw, route) first (distinct physical capture + receipt retained; only the logical obligation collapses); recover(receiptId) is not a provider arrival. Same-id different-hash keeps the landed intake-mismatch result. The owner lookup serializes on the canonical logical id or conditionally appends against its current owner predecessor (two concurrent matching arrivals can never create two first holds). Stale/partial/tainted/conflicted/wrong-adapter/wrong-route/unavailable-capture/over-bound reads → existing typed Refused, every safe receipt/capture preserved, no invented terminal. Adds NO standing, retry authority, second dedup key or adapter-owned terminal; if intake-collapse.original cannot name a hold or its terminal under the owner decoder, Four adds the narrow owner-versioned reference variant (never a private adapter record). Existing schemas + IntakeDisposition fields unchanged. Part Four follow-up bundle (with #17/#18) after #10 lands. GUARD: verify against docs/08; unnamed = not granted. [ledger 46]

- (added 08:38Z from astra-design-scheduled-work-c2a7c2e5.md SW-01 via design-scheduled-work-seam-request-intake-occurrence-continuity.md; basis: the granted scheduled intake (#10) + docs/08 dedup contract — the intake tuple (adapter, channel, sender, identityEpoch, eventId) is preserved, and a rotated system-principal epoch would otherwise mint a second Run for the SAME constitutional occurrence) an owner-issued `ScheduledOccurrenceBinding` (fields EXACTLY as the request: owner, namespaceVersion, installation, jobInstance, scheduledInstant, eventId, canonicalTickHash, admission ref, principal, principalEpoch, sourceFrontier) binding the constitutional occurrence (installation, job instance, scheduled instant) to the FIRST admitted fact, plus one bounded public read `IntakePort.readScheduledOccurrence` (signature as the request, all work bounds honored). Rules: the binding is a conditional append keyed on the occurrence (at most one winner; a later admission under a rotated epoch with the same canonicalTickHash RESOLVES to the existing binding and yields NO second Part Five opening); a differing canonicalTickHash for the same occurrence is a conflict, never a silent winner; the landed intake tuple, every message/stop behavior and Five's runIdFor(opening) rule are untouched; Fifteen cannot merge intake facts, pick winners by time, mint standing, or open a Run by another identity. Acceptance = the request's list (rotation replay → one binding, one Run; concurrent first admissions → one winner; hash mismatch → conflict; bounded reads). Part Four follow-up bundle after #10 lands. GUARD as above. [ledger 49]

## Addendum (2026-09-10 06:30Z) — stable event identity vs delivery attempt (GRANTED, additive; ledger row 57)

Request origin: Astra design review of docs/16 at eb48796b, finding CA-03 (Slack redelivery carries changed `retry_attempt` /
`retry_reason`, so an unchanged event has the same logical identity but a different arrival hash; Four's same-id/different-hash
refusal then rejects a legitimate redelivery). Grant: Part Four gains an additive, adapter-declared **stable-event commitment**
alongside the existing full-bytes capture commitment. Each conversation adapter declares, per platform, which provider fields
identify the stable event and which describe a delivery attempt; intake captures BOTH original envelopes byte-for-byte, dedupes
on the authenticated stable-event commitment, and records the delivery-attempt envelope as evidence of the redelivery. A
redelivery whose stable fields match joins the original work (no attack signal); a payload whose stable fields differ under
the same provider event id is refused as today. The existing full-bytes path, its refusal bytes and every existing fixture are
preserved; Ten binds the adapter's declaration through its landed AdapterEvidenceContract. Build after the intake-followup
slices already granted; review with real Slack envelope fixtures for both cases.

## Addendum (2026-09-10 06:30Z) — judged acknowledgment policy arm (GRANTED, additive; ledger row 58)

Request origin: operator directive on PR #49 (decision 2): one acknowledgment option must let the agent use its judgement about
whether and how to respond to an unresolved sender. Grant: the closed acknowledgment policy `always | bound-only | never`
(Four contract, Ten decoder) gains a fourth additive arm `judged`: for a public/group mode declared `judged`, Part Seven
decides per message whether to acknowledge and with which registered ordinary reply, within the mode's declared policy
bounds (what may never be revealed: existing-relationship status; what is always permitted: a neutral reachability reply),
and every decision is a recorded Decision with its evidence. The three existing arms keep their exact behavior and bytes;
a deployment that does not declare `judged` sees no change. Ten's landed decoder gains the arm additively.

## Addendum (2026-09-10 08:08Z) — acknowledgment policy consumer (GRANTED, additive; ledger row 60)

Request origin: Astra CA-01 on docs/16 @24d6912 (Four's README lists acknowledgment delivery policy as unbuilt; its contract test
is skipped; the landed Ten decoder only accepts the policy names). Grant: Part Four gains the public decision/consumer that
enforces the acknowledgment policy for a conversation mode — `always | bound-only | never | judged` (row 58) — at the custody
boundary: given the admitted inbound's verified-principal resolution and the mode's declared policy, it decides whether a
CONVERSATIONAL acknowledgment may be requested (as an ordinary Part Eight reply) and records that Decision; protocol custody
acknowledgment (the platform-level receipt in §3) is unaffected and stays separate. `bound-only` acknowledges only the person
whose authority for that conversation and scope has been verified by a binding (Four's definition: a verified grant selecting
one operator for the conversation and scope); other familiar participants remain requesters. Existing Four behavior, fixtures
and refusal bytes stay byte-identical; the skipped contract test becomes the executable check. Builds with the other
intake-followup slices.
