# Seam response — Part Eight follow-up bundle (GRANTED, additive; builds on seam-response-effects-payloads.md)

Decision: GRANTED as ONE additive owner-owned change to Part Eight (src/effects), to be built on top of the
typed-payload seam (branch seam-effects-payloads) once that lands. Basis: the approved Part Eight design
(docs/12-the-effect-doorway.md) specifies typed operations beyond messages, settlement from Nine-owned assessment,
retry after decisive closure, and owner-validated closure prerequisites; the landed code is a dark slice.
GUARD (applies to every item): the builder MUST verify that the owner's approved design names the record or
behavior before implementing it; anything the approved design does not name is NOT granted by this file and must
come back as a precise design question. The review desk verifies the same. No new core type; Part One's closed
result vocabulary is never extended (a freeze uses `reason: policy` + detail; exhaustion uses `budget-exhausted`).

Consolidated requests (ledger rows) — each implemented exactly as its request file states:
- #15 design-measurement-ledgers-seam-request-spend-control-effects.md — `SpendCapSet`, `SpendFreeze`, `SpendUnfreeze`
  operation payloads + OperationDefinition schemas; freeze has an independently admitted minimal/control path;
  unfreeze and cap changes require verified operator Authorization; control Success never converts the denied paid
  operation's own Refused.
- #21 design-sentinel-holders-seam-request-worker-input.md (Part Eight half) — `worker-input` payload class with exactly
  `neutral-continuation`, `recovery-injection`, `submit-authentic-pending-input`; digest bindings and retry/concurrency
  restrictions exactly as listed; an accepted keystroke/stdin write is occurrence evidence only. (Part Ten driver half is
  in seam-response-assembly-followup.md.)
- #22 design-conversation-adapters-seam-request-effect-assessment-consumption.md — a Nine-owned public consumption
  operation for effect settlement (Part Nine additive: src/verification) consumed by Part Eight's settlement; Nine stays
  the sole interpreter of its predicates; Eight appends EffectSettlement from the owner view without re-grading Evidence.
  This item touches src/verification (Part Nine) additively — the ONLY cross-directory change in this bundle; the builder
  keeps every existing Part Nine test green.
- #23 design-conversation-adapters-seam-request-model-provider-effect.md (Part Eight half) — a versioned provider-call
  payload admitted alongside OutboundMessage, bound to Seven's preparation reference; dispatch/observation/settlement
  through the same admission/claim rules. (Seven's preparation/receipt operations are in seam-response-judgment.md.)
- #26 design-harness-adapters-seam-request-retry.md (Part Eight half) — an owner-issued retry-eligibility arm that is true
  ONLY when the accepted Nine assessment establishes did-not-happen + quiescence + settled charge for the original
  operation; retains full lineage. (Six's conditional retry admission is in seam-response-loop-followup.md.)
- #29 design-harness-adapters-seam-request-part-eight-harness-operations.md — harness-operation payload arm: loading-only
  launch, live-input delivery, graceful close, protocol cancel, exact descendant signal, hard termination, compaction
  control, account/runtime-configuration change; a first launch confers only loading/observation until Five commits
  grounding + step; process absence/timeout/exit code never becomes business success or retry permission.
- #8 design-conversation-adapters-seam-request-rungraph-continuity.md (Part Eight half) — the first post-compaction reply
  requires the exact Part Five ContinuityAccounting reference in the request closure, re-read through Five's public
  consumer, operation identity + digest equal to the immutable request; ordinary start/recovery/resume replies unchanged.
- #16 design-conversation-adapters-seam-request-legacy-import.md (Part Eight share) and #19
  design-measurement-ledgers-seam-request-maximum-disposition.md (Part Eight share): authority-INERT legacy send evidence
  records and the settlement-side conservative maximum disposition — records only; they grant nothing and never execute.
- (added 02:30Z from astra-design-conversation-adapters-e63e3122.md F08) a `delete-message` conversation-operation variant:
  the settled target-message observation reference + the deletion scope the platform supports; same digest binding,
  Refused-before-dispatch on unsupported platform capability, and a Part Nine-witnessed non-existence result (a delete is
  never displayed as done from the adapter's receipt alone). It extends the conversation-operation closed list of
  seam-response-effects-payloads.md by exactly this variant.

Invariants: every payload binds subject, target identity, source vector/generation, principal, OperationDefinition,
stable effect id, run/step, lease/fence, reservation and one-use claim into the digest; nothing self-attests standing or
authority; every failure class in each request returns the existing typed Refused before mutation; uncertainty is
retained with maximum exposure visible. Acceptance evidence: the union of the acceptance sections of the request files,
as REAL three-tier tests wired into Part Eight's (and, for #22, Part Nine's) contract map; every pre-existing fixture of
both parts decodes and behaves identically.

- (added 07:10Z from astra-design-harness-adapters-96bd8aa0.md HA-01; EXTENDS #21 worker-input with a FOURTH typed action; basis docs/12's typed session-input class already granted as #21, and the 1.x PermissionPromptAutoResolver behavior this design migrates) `worker-input` gains `approval-prompt-response`: an Eight-owned typed effect that answers ONE exact, already-authorized blocked framework call. Bindings (all re-resolved from signed history at admission): the existing authorized call (the Part Four verified act / intake authorization that admitted that exact operation), the prompt OBSERVATION (Ten's signed HarnessObservation of the prompt: worker, incarnation, prompt text digest, menu digest), the current worker/incarnation, the SELECTED allow-once action (one enumerated menu member, never a blanket/"always allow" approval), the immutable payload digest, and a ONE-USE claim. Refuses on: a changed prompt (text/menu digest mismatch), a wider approval than the authorized call, a prompt for a different worker/incarnation, an unauthorized or superseded call, any uncertainty about which call is blocked, and reuse of the claim. It grants no standing and no authority beyond clearing that one prompt; a second prompt needs a second exact authorization. Executes ONLY through the Ten-owned confined harness driver (see the matching assembly-followup line); ordinary-reply behavior byte-for-byte preserved. Part Eight follow-up bundle (with #8-Eight/#15/#21/#22/#23/#26-Eight/#29). GUARD: builder verifies against docs/12 + docs/08 (verified act) + docs/14 (observation); unnamed = not granted.

- (added 08:25Z, Eight CONSUMER half of design-scheduled-work-seam-request-bounded-authority.md, SW-01; producer = the 08:25Z Part Six addendum in seam-response-loop-followup.md, ledger 44) Part Eight additively replaces its whole-domain `TransportAuthority.inspect` lookups for domain head, operation and request/attempt questions with `readCurrentAuthority`, consuming the Six-owned `CurrentAuthorityView` without copying its type or grading it; settlement ordering, claim rules and every existing Eight fixture byte-for-byte compatible; lands AFTER the Six producer slice. GUARD as above.

- (added 09:10Z from astra-design-conversation-adapters-39f01c67.md CA-02; EXTENDS the #3 conversation payload variants in seam-response-effects-payloads.md; basis docs/12 [Eight owns typed outbound payload kinds and their delivery evidence] + the 1.x Slack ephemeral notice this design migrates) an additive AUDIENCE contract on the ephemeral conversation variant: the payload names EXACTLY one intended recipient (a channel member identity resolved from signed Part Four history, never a display name), the adapter reports the variant unsupported unless it can deliver to that single member without exposure to the channel, delivery evidence records the audience actually reached (single-member | unsupported | uncertain — never assumed), and an ephemeral notice can never be widened to the channel by retry, fallback or rendering. Ordinary-reply behavior byte-for-byte preserved. Part Eight follow-up bundle. GUARD: verify against docs/12; unnamed = not granted. [ledger 53]

- (added 09:23Z from astra-design-scheduled-work-02ff12ad.md SW-01; EXTENDS the bounded-history program [ledger 37/44/47/48]: row 44 made Eight a CONSUMER of Six's current view, but Eight's own `snapshot()` still folds its domain through the complete `readForProjection()` and refuses above 4,096 entries) an owner-issued DISPOSABLE Part Eight effect-domain projection: an `EffectStateCheckpoint` (owner, generation, pinnedFrontier, foldedThrough, sourceVerification: Part Two VerifiedHistoryCheckpoint [47], priorPageDigest, stateRoot, indexed counts/bytes, complete:true) + one bounded maintenance operation `advanceEffectState` (reads only through Part Two's paged read [37]; folds requests/preparations/claims/settlements/retry eligibility; publishes only when complete:true AND an equal-frontier rebuild matches stateRoot) — and Eight's `snapshot()`, preparation, claim, settlement and retry-eligibility paths reconstruct from the latest published checkpoint + a bounded suffix instead of complete reads. Preserves every landed Eight record, canonical bytes, refusals, settlement ordering and claim rules; a checkpoint is never authority; a caller never supplies current state. Acceptance: identical decisions/bytes/refusals below the slice limit; above it, cold restart + bounded rebuild + one real prepare→claim→invoke→settle with kill-cuts. Bounded-history program, after 47 lands; Part Eight bundle. GUARD: verify against docs/12 + docs/06; unnamed = not granted. [ledger 54]
