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
   again, and compares every serialized field. A changed side, difference list, origin, or
   subject is refused. `decode('Conflict', ...)` deliberately directs callers to derivation.
4. `readHistorical('Provenance' | 'VerifiedPrincipal', input, pin, context)` verifies exact
   origin bytes with a registered Ed25519 `fact-envelope` key and selects the record at
   `pin.path`. The signed frame's root `id` must equal `pin.origin.id`. Part two supplies that
   origin and the key position after its own chain verification; this package does not
   pretend a valid signature verifies the chain. `HistoricalRead<T>` exposes an immutable,
   unbranded `view` and `captureStatus`. It preserves original verified/attested class and
   verification time. Neither it nor its view type-checks as a live principal/provenance;
   live decoders also reject them after an unsafe cast. Missing old captures stay visibly
   unavailable. A historical read never establishes current standing.
5. `defineDecoder` registers a later part's `DecoderDefinition` as an immutable
   `VersionedDecoder`, outside the closed inventory. Names belonging to part one are refused.
   Every version needs its validator, and every prior version needs a consecutive pure
   migration. The framework validates before and after migration, checks type/version at every
   step, and refuses unknown versions, bad migration output, or thrown callback errors.
   `deriveThrough` validates an internally derived input through the same decoder. Core and
   extension decoding share `runBoundary`, which is not a public construction door.

`src/decode/canonical.ts` supplies sorted UTF-16 JSON keys, UTF-8 encoding and SHA-256;
schema-1 byte/hash fixtures pin all 18 types. `src/decode/schema.ts` is the inventory metadata.
`src/decode/decode.ts` holds core invariant checks and scope/liveness functions.
`src/decode/intake.ts` supplies the authority-free unresolved fallback.
`src/types/operations.ts` supplies freshness, comparisons, derived strengths, approval validity,
outcome consumption/retry permission, and the sole conflict-resolution function. Profile
adjectives evaluate `ProfileTermsReadPort.derivedFrom` supplied by part three; this package
does not maintain a competing term registry. `src/types/internal.ts` holds the private issuer
and centralized Result consumer. `src/index.ts` is the public import surface.

The architecture checker analyzes resolved TypeScript types to reject direct Result, Outcome,
Evidence-claim and Conflict-side access outside their owning functions, plus ambient I/O/time
in the core. As the design states, a lint is not a proof about arbitrary caller behavior or
malicious unsafe casts. Part nine still compares recorded results to later reports.

`npm run test:all` runs type checks, builds the public entry, executes unit/decoder, integration,
and package-process lifecycle tests, runs architecture checks, and prints the check map from
the actual Vitest report. The inventory is compared against the approved design as well.
This pure package has no HTTP server; its lifecycle proof starts a fresh Node process and
imports the built package, rather than claiming a nonexistent server route is live.

## Side effects and undo

This adds an isolated library, tests, development tooling, and a CI job. It opens no runtime
files, connections, sessions, or timers. Integration work must supply the declared context
ports. Reverting the implementation commits restores the documents-only tree. The independent
review session owns review and convergence; passing these tests is a builder's verification.
