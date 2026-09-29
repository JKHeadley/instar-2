# Seam response — Part Eight typed effect payloads (GRANTED, additive, consolidated)

Decision: GRANTED. This consolidates two requests against the SAME owner seam — the conversation
adapters' `design-conversation-adapters-seam-request-effect-doorway.md` and the sentinel holders'
`design-sentinel-holders-seam-request-effect-doorway.md` — into ONE owner-owned additive change to
Part Eight (src/effects). Basis: the approved Part Eight design (docs/12-the-effect-doorway.md,
section 9 and the operation-definition table) already requires messages with attachment digests and
purposes, and typed file/process/provider operations; the landed src/effects is a deliberately
narrow dark slice of that approved design (src/effects/README.md says so). Filling it in is
implementation of approved scope, not a design change. No new core type: every payload variant is
a Part Eight owned record decoded by a Part Eight owned closed decoder.

## What Part Eight gains (all additive)

1. A closed, versioned, discriminated effect payload (public name is Part Eight's to choose; the
   requests call it `EffectPayload`). `EffectRequest` gains a reference to the payload's immutable
   identity/digest. The existing `ordinary-reply` `OutboundMessage` variant is PRESERVED
   byte-for-byte in schema, decoder behavior, request key and digest — every existing Part Eight
   test stays green and every existing record decodes to the same value.
2. Conversation operation variants (from the conversation request, kept exactly): `post-text`,
   `post-media`, `edit-message`, `react`, `create-topic`, `acknowledge` (reaction / read-receipt /
   typing / text), `fetch-inbound-media` (returns a content-addressed capture reference + hash,
   never a process-local path), `derive-transcript` (the provider attempt stays with Part Seven's
   doorway; the returned transcript is captured and linked to the originating intake).
3. Recovery operation classes (from the sentinel request, kept exactly): `process-control`
   (start / interrupt / terminate / close / compact of an exact machine + process incarnation +
   parent/start identity + action-time executable/ordered-argument identity), `scheduler-control`
   (pause/resume exact job id + generation, finite scope, explicit undo + review time),
   `account-route-change` (exact run/provider route from one registered account identity to
   another, with source generation + rollback route), `configuration-change` (one exact canonical
   target, expected prior digest, bounded proposed bytes/digest, undo reference),
   `filesystem-mutation` (create/replace/move/remove exact canonical targets with expected
   ancestry/prior digests, bounded bytes, undo semantics, protected-target policy reference),
   `git-mutation` (one enumerated repository/worktree operation against exact repo/worktree/ref/base/
   target set with expected heads + rollback constraints), `infrastructure-notice` (action-needed or
   result-bearing notice distinct from an agent reply; infrastructure provenance + causal-episode
   reference; can never impersonate the agent or the operator).
4. An ordered-expansion AGGREGATE record for one admitted semantic message: parent semantic-message +
   run references; ordered child effect-request references + immutable child digests; demanded
   evidence stage per child; ordering relation and whether later children are inhibited after an
   earlier refusal/uncertainty; per-child settlements and aggregate state (pending / partial /
   satisfied / refused / uncertain); open evidence/charge/recovery obligations; accountable
   reconciliation owner. Satisfied ONLY when every required child has a current Part Nine assessment
   at its demanded stage AND Part Eight has settled it; partial/uncertain children keep the aggregate
   partial/uncertain and forbid replay of already-applied children.
5. Per variant: a matching versioned `OperationDefinition` input schema + canonicalization; the exact
   independent observation capability required for occurrence, non-occurrence, quiescence and charge;
   the existing `OperationObservation` / `VerificationRequest` / `VerificationAssessment` /
   `EffectSettlement` / maximum-exposure / reconciliation rules apply unchanged. Provider or driver
   receipts are evidence, never settlement. A lost receipt reconstructs the original effect identity
   and permits observation only until decisive non-occurrence evidence exists.

## Invariants the builder must hold

- Every variant binds current subject, target identity, source vector/generation, responsible
  principal, `OperationDefinition`, stable logical effect id, run/step, lease/fence, admission
  reservation and one-use claim into the request digest. A payload cannot self-attest standing,
  ownership, validity or authority; authority/notification/provenance/continuity/decision facts stay
  referenced through `EffectRequest.closure` and source-result lineage.
- Retry identity: a retry retains the semantic identity AND digest (docs/12 §"retry"); a changed
  rendering is a NEW request, never a mutation of an immutable one.
- Failure direction: unknown variant, missing field, unsupported adapter/driver capability,
  over-limit expansion, target ambiguity, stale/conflicting authority, missing admission/claim,
  digest mismatch or protected-target refusal → the existing typed `Refused` result BEFORE any
  provider call or mutation, preserving proposal + source result. Adapter refusal survives
  unchanged into settlement. Timeout / lost response / partial application / missing assessment /
  unknown charge → retain child + aggregate as uncertain/partial with maximum exposure visible,
  observation only; never continue to later children when order could be violated. A notification
  or decorative acknowledgment failure can never erase or terminalize the inbound work it refers to.
- Adapters: the landed Part Ten native harness/operation adapter keeps invoking `ordinary-reply`
  exactly as today. For every NEW variant the existing adapters MUST report the capability as
  unsupported (typed `Refused` before dispatch) — Part Ten's confined drivers for the new classes are
  a SEPARATE Part Ten seam (design-sentinel-holders-seam-request-assembly.md, pending) and are NOT
  part of this grant. This grant changes src/effects only.

## Acceptance evidence (the review desk verifies)

Closed-decoder fixtures for every variant (accept well-formed; refuse each undeclared field, wrong
kind, missing reference, digest mismatch); exact digest stability; the ordinary-reply byte-for-byte
preservation fixture (old records decode identically, old request keys unchanged); target-
substitution and symlink/ancestor fixtures for the target-bearing classes at the DECODER level;
ordered partial-application crash cuts with no child replay after partial success; lost-receipt and
hostile-cut recovery; charge/quiescence separation; the existing three-closure retry bar per child;
plus the existing three-tier Part Eight checks. Consumers' checks that depend on this seam (P12-NF
conversation operations; P14-NF-42/45/46/51-53) stay non-executable until this evidence lands.
