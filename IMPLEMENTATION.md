# Part one implementation

Parent: docs/05-the-types.md; rules 1, 4, 13, 14, 26, 28, 29, 31, 33, 40, 42, 57,
69, 82, 90, 93, 94, 95, 96, 98, 100, 103, 104, 108, 109, 110, 113.

This package implements the constitutional values and their decoding boundary. Its public
entry is src/index.ts. Runtime code uses only the standard library's deterministic crypto
operations. Register generations, captures, authentication evidence, and clock measurements
are explicit inputs. Every schema is shared across machines.

## Decision journal

- The current build brief authorizes code despite the older README's documents-only status.
  The checked-out branch is impl-types and its remote is JKHeadley/instar-next. The local
  coherence warning is an absent topic binding; these independently checked paths match the brief.
- No scaffold existed. Added strict TypeScript, Vitest, a lockfile, and a CI contract job.
  Node's type declarations are a development dependency needed for standard-library crypto.
- All current schemas start at version 1; no historical serialized version is invented.
- Private class brands and a package export boundary close ordinary TypeScript construction,
  including object spread. Runtime
  authority contexts additionally require objects issued by this package. Deliberate unsafe
  casts are outside the compiler guarantee and are checked where authority enters decoding.
- Register and conversation-binding ownership stays with parts three and four. Consumer input
  ports describe the facts this package needs; they do not implement those parts' records.
- The design's evidence paragraph says refusal reason `stale`, but Result's closed list excludes
  it. Use `stale-base` with a specific evidence-expired detail, preserving the closed list.
- Clock measurements bottom out at safe integer Unix milliseconds; `at` equals the sampled
  clock value. Other measurements use finite JavaScript numbers. Exact money arithmetic and
  fact fold-key encoding belong to part two, and are not implied by Measurement.
  `decodeMeasurement(expectedSubject, input, context)` checks that subject at runtime and
  preserves it in the return type. A decoded `clock` feeds time APIs without casts. Generic
  inventory reads remain unrefined; `compareMeasurements` rejects their broad string subject
  or union/open-pattern subject at compile time until the caller uses the checked producer with one
  known subject. An ordinary union-typed parser is allowed to decode, but its output cannot
  prove two operands have the same subject. Runtime mismatch refusal still protects JS calls.
- Scope inclusion uses explicit registered member sets; it never infers containment from a
  path spelling or expands an artifact glob into wider authority. Providers resolve their
  governed sets before supplying them. The organization scope contains all other scopes.
- Ed25519 envelopes and host HMAC-SHA256 deliveries are verified inside this package. The
  HMAC key exists only in decoder input context; serialized Provenance never retains it.
  Authentication method names, trusted keys and approved records come from the supplied
  register generation. This does not implement host fetches or a session-token issuer.
- Local continuation capability was checked and was disabled, so no continuation ledger was
  started. Work is bounded by the build brief's completion conditions.

## Public API and downstream seams

Build with `npm ci && npm run build`, then import from `@instar/constitutional-types`.
Only the root is exported; internal constructors and the shared boundary runner are private.
`src/types/values.ts` owns the 18 inventory types, and `src/types/ports.ts` publishes the
structural inputs below. Neither input ports nor historical wrappers add an inventory schema.

1. `VerifiedIntent` is exactly an alias of `Intent`. There is no nineteenth constitutional
   schema, and it inherits Intent's construction and principal guarantees.
2. `DecodeContext`, `RegisterReadPort`, `RegisteredKeyInput`, `AuthenticationEvidenceInput`,
   `ProvenanceInput`, `CaptureInput`, `ContentHashInput`, and `ClockInput` are public input
   contracts. `register.generation` is a `RegisterGenerationReference` owned by part three;
   `entries`, `producers`, `methods`, `actions`, `subjects`, `sites`, and `keys` supply its resolved
   data. `captures` maps reference or content hash to exact UTF-8 text. The adapter must keep
   raw input before decoding and supply its `preserved` reference. The fallback reference
   `input://caller` identifies caller-retained input when the context itself is malformed;
   it is not a claim of durable storage. Authority-bearing records need a separately decoded
   `provenance`; nested principals must match `principals` already decoded in that context.
   Time/authority functions receive a `Clock` and supplied grants/revocations explicitly.
   Part two selects the causal cone and clock proof; this package never substitutes wall time.
3. `rehydrateResult(input, context, readPayload)` validates the recorded Result and its nested
   payload. The outer Result reports whether the read succeeded; an inner recorded refusal
   stays a refusal. `rehydrateOutcome` checks the occurrence variant and evidence references.
   `rehydrateConflict(input, context, {left, right})` decodes both sides, derives their conflict
   again, and compares every serialized field. Jurisdiction comes from intrinsic scope
   (including Authorization.action.scope and organization-scoped principal identity) or
   separate `recordSubjects[canonicalRecordHash]` supplied by the admission context. Records
   without intrinsic scope, including Intent, require that separate mapping. The exact
   derived union must match the subject; the serialized subject never supplies its own
   authority. An altered difference list, origin or rebound subject refuses; side records
   must independently validate and agree with that admission context. `decode('Conflict',
   ...)` deliberately directs callers to derivation.
4. `readHistorical(type, input, pin, HistoricalDecodeContext)` validates every inventory
   body's invariants inside a private historical session. It first verifies the captured P2
   envelope's canonical preimage (all fields except contentHash/signature), then the Ed25519
   signature over the UTF-8 contentHash string. It requires a registered `fact-envelope` key
   whose owner matches the envelope machine, root id matching `pin.origin.id`, and exact
   selected record at `pin.path`. No second signature or invented byte-signed frame is needed.
   Part two supplies the admitted key position, causal cone, register generation and explicit
   clock proof; this package does not implement chain/key-position/causal-cone admission.
   Reconstruct dependencies with earlier genuine `HistoricalRead` wrappers in `context.history`.
   For example, read a grant, then pass it in history when reading its authorization/revocation.
   Nested provenance and principals validate against their pinned records without needing any
   surviving live instances. Authority-bearing Conflict sides use that same historical path.
   Optional historical conversation bindings use a pinned source wrapper and decoded scope.
   `HistoricalRead<T>` exposes an immutable unbranded `view`, `captureStatus`, and detailed
   `unavailableCaptures` (tombstoned/expired/missing). The original class/time are preserved;
   available bytes must still hash correctly. Missing Evidence remains a historical record,
   not a usable claim: `readHistoricalEvidence` requires available dependencies and freshness.
   Dependencies propagate their unavailable taint. Neither the wrapper nor its view can
   supply live authority, even through a cast; historical validation never live-issues them.
   Historical bodies retain their OWN temporal invariants: a grant must be live at an
   Authorization's `at`, a Directive/delegated grant's `issuedAt`, and a Revocation's `at`.
   These checks compose with (never substitute) liveness at `context.now`, the originating
   fact's P2-selected causal clock. All revocations supplied in that selected cone are
   causally effective regardless of their testimony timestamps. The containing/appending
   fact's principal/scope/action admission remains a separate P2 check; replaying an earlier
   body's original validation must use that body's originating context, not receiver state.
   `historicalGrantLiveness(grantRead, revocationReads, causalClock, preserved)` is the public
   historical-only standing consumer. It returns `Result<GrantLiveness>` with the existing
   live/revoked/expired/not-yet-live labels, not a constitutional value or authority token.
   Only genuine origin-verified wrappers and an explicitly decoded Clock are accepted.
   P2 supplies only the relevant causal cone, never the receiver's wider history. Revocations
   in that cone apply by ancestry even when their `at` is later than the causal clock.
   Unavailable dependencies refuse with evidence-unavailable detail (integrity), rather than
   producing untainted standing from missing captures. This is a conservative consumption
   choice; it does not discard the already reconstructed historical record.
5. `defineDecoder` registers a later part's `DecoderDefinition` as an immutable
   `VersionedDecoder`, outside the closed inventory. Names belonging to part one are refused.
   Every version needs its validator, and every prior version needs a consecutive pure
   migration. The framework validates before and after migration, checks type/version at every
   step, and refuses unknown versions, bad migration output, or thrown callback errors.
   `deriveThrough` validates an internally derived input through the same decoder. Core and
   extension decoding share `runBoundary`, which is not a public construction door.
   The boundary pins a validated registered site/direction before examining input, retaining
   it for explicit and thrown failures alike. Only invalid metadata uses types.decode/closed.

`src/decode/canonical.ts` supplies sorted UTF-16 JSON keys, UTF-8 encoding and SHA-256;
schema-1 byte/hash fixtures pin all 18 types. `src/decode/schema.ts` is the inventory metadata.
`src/decode/decode.ts` holds core invariant checks and scope/liveness functions.
`src/decode/intake.ts` supplies the authority-free unresolved fallback.
`src/types/operations.ts` supplies freshness, comparisons, derived strengths, approval validity,
outcome consumption/retry permission, and the sole conflict-resolution function. Profile
adjectives evaluate `ProfileTermsReadPort.derivedFrom` supplied by part three; this package
does not maintain a competing term registry. `src/types/internal.ts` holds the private issuer
and centralized Result/Capacity consumers. `src/index.ts` is the public import surface.

The architecture checker analyzes resolved TypeScript types to reject direct Result, Outcome,
Evidence-claim, Capacity discriminator and Conflict-side access outside their owning functions,
including parameter/variable/nested/rest/alias bindings, assignments, loops and methods, plus
ambient I/O/time in the core. `consumeCapacity` handles applied bounds as success data.
As the design states, a lint is not a proof about arbitrary caller behavior or
malicious unsafe casts. Part nine still compares recorded results to later reports.

`npm run test:all` runs type checks, builds the public entry, executes unit/decoder, integration,
and package-process lifecycle tests, runs architecture checks, and prints the check map from
the actual Vitest report. The inventory is compared against the approved design as well.
This pure package has no HTTP server; its lifecycle proof starts a fresh Node process and
imports the built package, rather than claiming a nonexistent server route is live.

## Desk repair round (base 3f688bf)

R1–R6 are repaired in the implementation and their counterexample tests, not only the named
map. NF-19 obtains values from actual checked producers. Each of NF-14/15/46/66/69 executes
ten independently compiling bypass forms and actual permitted handlers. NF-75 changes only
the Conflict subject and attempts wrong-jurisdiction resolution. Historical lifecycle tests
save and reconstruct grants, authorization, revocation, authority Conflict and unavailable
Evidence in a fresh Node process through the public built package.

NF-68 now runs a fixture-owned versioned transport migration into real decoded Intents,
then calls public compare: migration-only is equal; immutable differences from machine-a and
machine-b yield the same Conflict as current-version input. This exercises the extension
seam without inventing a constitutional schema-2. Intent origins now use receivedAt's sampler
machine, correcting the former unspecified-origin fallback. The Conflict golden hash changed
only for those corrected fixture origin values; the other 17 hashes and schema layouts did not.
Independent desk review still owns the convergence verdict.

## Desk repair round two (base f578166)

N1 is repaired by separating body-time and causal checks in one shared grant predicate;
the live evaluator's timestamp semantics are unchanged. NF-39 varies Authorization body
times 99/100/104/105/106 against a grant valid in [100,105), holding the causal clock at 100,
and repeats the matrix in a fresh public-package process. Independently invalid causal
clocks and an in-cone revocation timestamped in the future still refuse. NF-06 audits the
same boundaries for delegated grants, Directives and Revocations.

R4.1's ordinary union parser now compiles on its own, but only the comparison gets a compiler
diagnostic. Singleton producer, same-subject, and decoded-Clock positives remain cast-free.
Union right operands and explicit union generic parameters are tested as well.

The historical-only liveness consumer closes the P1 API absence recorded by lane two.
Unit tests check all status boundaries, forged wrappers, unrelated/out-of-cone revocations,
and unavailable grant/revocation dependencies. Integration tests consume a historical
grant → approval → revocation chain and verify no live issuance; a fresh Node process
reconstructs and evaluates the same public wrappers. P2 still owns cone selection,
appender admission and integration of this consumer; no lane-two files were changed.

## Desk repair round three (base 9e81772)

R4.2 fixes only the Measurement comparison's static subject guard. A candidate subject must
require a concrete property in its mapped Record (open string/template/intrinsic/branded
patterns admit an empty record and fail this test), and it must not be a union of keys.
This replaces the unsupported assumption that every non-string, non-union subtype is a
singleton. No registry-name whitelist or ASCII-only character parser is introduced.

NF-19 compiles public-package producers for the desk pattern, prefix/suffix, number/bigint,
case-intrinsic, intersected/branded, mixed pattern/literal, finite-template, broad-string and
union subject types, then requires diagnostics only on their comparisons. Concrete literal,
Unicode literal, concrete-template, enum-member and Clock positives still compile. The exact
desk parser is also type-erased and executed in a fresh process with valid measurements to
retain the existing runtime mismatch refusal for JS callers. No runtime behavior, historical
code, authority contract, inventory entry or schema/hash fixture changed in this round.

## Historical comparison follow-up (from merged main)

`compareHistoricalReads(type, leftRead, rightRead, mode, subject, context)` is the public
historical-only comparison consumer. `mode` is identity/version/value, following the same
P1 comparison rules as live `compare`; the private historical implementation remains private.
Both inputs must be genuine `HistoricalRead` wrappers of the requested type. Copied wrappers,
bare views, live values and live/historical mixtures refuse. The context is
`HistoricalComparisonContext`: a register, preservation reference, and independently admitted
`recordSubjects[canonicalRecordHash]` Scope inputs. The subject is decoded through P1 Scope.
Intrinsic record scopes still govern the domain. Scopeless same-id disagreements need both
independent bindings, supplied here or already pinned during the original reads; an existing
binding cannot be rebound. Comparison uses call-local historical copies, so it cannot install
or replace subject metadata on either input read.

The result is `Result<boolean | HistoricalConflict>`. Equality uses the existing boolean
meaning. A conflict is a frozen, nominal, owner-produced wrapper with owner `part-one`, mode
`historical`, kind `derived-conflict`, two source FactEnvelope references, and an unbranded
`view` of the derived Conflict. It is NOT a live Conflict and NOT a newly origin-signed read.
It may be retained in P2's ConflictClass product, but neither wrapper, view nor side can enter
live comparison, standing, or resolution. Object-spread reconstruction fails type checking.
Serialized copies are not new capabilities: regenerate the product from verified reads.
Unavailable dependencies refuse before equality or Conflict so no untainted result hides
missing captures. P2 retains ownership of origin/key/chain verification, admission context
and its outer ConflictClass; no P2 implementation is recreated here.

Tests cover real two-machine disagreements, equality modes, pinned and newly supplied scopes,
rebinding/missing-scope failures, mixed Intent/principal/grant/authorization inputs, typed
nonconstruction, unavailable inputs, and a fresh public-package process. A historical authority
Conflict is retained by a downstream-style consumer and then refused by live resolution and
standing. Main's existing generated register source pin is refreshed by its offline replay
generator after the source commit; this does not perform a governed-state landing.

## Side effects and undo

This adds an isolated library, tests, development tooling, and a CI job. It opens no runtime
files, connections, sessions, or timers. Integration work must supply the declared context
ports. Reverting the implementation commits restores the documents-only tree. The independent
review session owns review and convergence; passing these tests is a builder's verification.
