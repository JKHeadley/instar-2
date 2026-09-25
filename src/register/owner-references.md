# Owner source-reference consumption (P3 extension)

Each owner owns its declarations, decoders and catalog data. P3 owns the resolver
and source-wiring proof. No intake/rungraph record is added to P1's Inventory or
P3's fact schemas. P2 consumer bindings below do not transfer P2 ownership to P4.

Each admitted owner (no arbitrary owner) supplies one
committed v1 manifest. The legacy `register-source/owner-references.json` accepts
`part-four` or `part-five`. Both can coexist using `register-source/owner-references/part-four.json`
and `register-source/owner-references/part-five.json`, or one legacy and one named
manifest. Named paths must match their owner. Duplicate-owner manifests refuse.

## Part-twelve Slack fixture enrollment

`register-source/owner-references/part-twelve.json` admits only build fixtures
`P12-NF-19` at `tests/conversation/slack-preparation.test.ts` and `P12-NF-28`
at `tests/conversation/slack-reply-hold.test.ts`. Each pin is the P1 canonical
hash of the complete committed UTF-8 source text. The existing committed-file,
hash, stage, owner-path and duplicate/conflict checks apply. Part Twelve admits
no probes, decoders or documents through this manifest.

These fixtures resolve the Slack preparation gates for shape-only replay.
`P12-NF-19` remains partial preparation evidence, and the Slack `P12-NF-28`
test proves refusal while the reply definition is uninstalled. The parser and
reply stay dark; the pins do not establish live channel proof or send authority.

P5 supplies **one committed** `register-source/owner-references.json`, version 1:

```json
{
  "schemaVersion": 1,
  "owner": "part-five",
  "fixtures": [{"id": "P5-NF-54", "stage": "build", "artifact": {"path": "tests/rungraph/governance.test.ts", "hash": "sha256:…"}}],
  "probes": [{"id": "P5-NF-55", "cadence": 1000, "execution": "ci", "artifact": {"path": "tests/rungraph/scope.test.ts", "hash": "sha256:…"}}],
  "decoders": [
    {"id": "decodeRun", "module": {"path": "src/rungraph/index.ts", "hash": "sha256:…"}, "artifact": {"path": "src/rungraph/records.ts", "hash": "sha256:…"}}
  ],
  "documents": [{"id": "rungraph.contract", "artifact": {"path": "docs/09-the-run-graph.md", "hash": "sha256:…"}}]
}
```

Repeat the decoder row for `decodeRunStep`, `decodeRunTransition`, `decodeRunExit`
and `decodeSessionGrounding`, with the same module/source artifact paths and
their hashes. These are the only five decoder IDs admitted for part five.
There is deliberately no local schema version for those records: P5 owns it
(SessionGrounding currently v2; P2's outer fact envelope remains v1).

Every hash is **P1 `canonical(sourceText).hash`**, where sourceText is UTF-8
`git show <source-commit>:<path>` (a canonical JSON string, not raw-file SHA).
Pin the complete source text, including trailing newline. Update pins whenever
P5 changes the corresponding source. No self-referential manifest hash is needed.
The document hash binds source location/content, **not approval authority**.

`build(root, exactCommit, {mode:'replay'})` and the CLI read this manifest through
the same committed-source loader by default. Normal workflows still supply their
explicit catalogs/references; owner defaults are merged after verifying the
workflow's committed bytes. Identical duplicates are permitted; conflicts refuse.
The CLI also compares the current artifact bytes to the pin (including tests and
the governed document). Missing files, wrong owner/path, unknown exports, changed
hashes and invalid/production probe execution labels refuse.

The positive probe cadence is the declared **CI workload sampling bound**. It is
not a claim of deployed scheduling, supervision or production observation.
Actual executions/holds continue to need their existing run/review evidence.

Static wiring resolves the public export to the pinned P5 implementation symbol,
then recognizes direct imports, public-package imports, re-exports, namespaces
and immutable aliases of that symbol. A same-name local function, wrong-source
re-export, mutable alias or computed call does not prove invocation. Record read
and actual decoder invocation must remain in the gate's own function scope.
Reflection/computed calls remain reported residuals, not complete enumeration.
Member calls additionally require an immutable namespace-import receiver or a
chain of const aliases to it. Namespace parameters, object copies, let/var
receivers and function aliases extracted from those receivers cannot establish
owner invocation from their static member type. Unsupported forms fail a gate's
required invocation check; this is not a general data-flow/execution proof.

The complete import/export proof uses only the supplied source map, with fixed
source aliases for the core, register and rungraph public packages. The committed
build supplies `src/**/*.ts` (including `.d.ts`); every intermediary must belong
to that graph. Ambient tsconfig/package metadata, dist files, untracked helpers
and outside-src intermediaries cannot fill a missing link. A direct scanner
caller must likewise supply all dependencies explicitly; it has no filesystem
fallback. Committing a bridge under src makes it part of the proof without
requiring P3 to take ownership of that P5 module.

## Dark unavailable production proof

Use `status: "dark"`, the real worst-case profile
`control / costly / user / chat / bounded by rungraph.bound`, real metrics and
`gate: {test: "P5-NF-54", deadline: <future absolute unix-ms>}`. **Omit liveProof**
to explicitly represent unavailable production proof. The existing optional
shape field already permits absence; neither shape nor conversion anchor changes.
Derived user-facing/significant/critical classifications are unchanged.

Live and soaking user-facing declarations require a nonempty liveProof resolved
as an actual `record` of kind `e2e-run` by the existing verified-reference provider.
Dark status does not make a supplied fake `unavailable:…` record resolvable.
The gate's test must resolve and its deadline must remain unexpired.

## Replay is not runtime authority

Offline replay checks source pairing, real calls, reference targets, rule graph,
deadlines and enumeration boundaries. It reports the P5 contract gates'
missing approval/standing requirements in `authorityPrerequisites` (the build
result and `generated/source.json`). It cannot verify those with an offline empty
extract, and cannot accept a provider or claim an entering-force transition.
All output remains `authority: "shape-only"`.
This is scoped to `rungraph.contract` and `intake.contract`, declared by their
respective adjacent sidecars at the bound governed-document locations. Other unapproved governed records still refuse
in replay; this extension is not a generic approval/standing waiver.

Bootstrap transitions and normal/completion builds still enforce approved history
and actual writer/executor separation. Runtime consumers still use `loadRegister`
with P2 extract, entering-force and freshness checks, then `readRegisterEntry` and
`checkGovernedState`. Pending contract history still refuses there; a source pin
or shape-only replay is not a substitute. P3's normal-workflow E2E supplies explicit
test-only approved contract rows and separated principals; it does not mint real
P5 approvals. Its copied catalogs include the committed producer tests.

## Part-four manifest and exact consumer bindings

Use the same v1 fields, with `owner: "part-four"`. Fixture IDs are P4-NF-01 through
P4-NF-29, `stage: "build"`; the probe ID is P4-NF-29, positive finite cadence and
`execution: "ci"`. Artifacts must be committed `tests/intake/<name>.test.ts`
(lowercase letters/digits/hyphens). The fixture owns the actual assertions; a
catalog pin alone is not evidence they passed. P4 supplies its own declarations.

The sole document row is `intake.contract`, pinned to `docs/08-the-intake.md` and
declared at `src/intake/port.declarations.json`. Decoder rows have the same exact
`id`, `module`, `artifact` fields as five's rows:

| ID | Public module | Implementation artifact | Required companion row |
| --- | --- | --- | --- |
| intakeDedupDefinition | src/intake/index.ts | src/intake/records.ts | — |
| intakeWorkRegistration | src/intake/index.ts | src/intake/records.ts | — |
| intakeStopRegistration | src/intake/index.ts | src/intake/records.ts | — |
| readProjection | src/projections/index.ts | src/projections/fold.ts | intakeDedupDefinition |
| authorAndAppend | src/facts/index.ts | src/facts/store.ts | intakeWorkRegistration |
| createFactStore.append | src/facts/index.ts | src/facts/store.ts | intakeWorkRegistration |
| decode:Provenance | src/index.ts | src/decode/decode.ts | — |
| decode:VerifiedPrincipal | src/index.ts | src/decode/decode.ts | — |

Every module/artifact has its own canonical-text hash. P1 decode rows resolve its
real `decode` export and still require the exact literal schema argument.

Dedup invocation credit requires actual `createFactStore(...).read()` facts passed
through `prepareSnapshot` and `foldProjection` to `readProjection`, using the same
immutable `intakeDedupDefinition` result for fold and read. Local read helpers and
four's fact-preserving Map merge form are recognized; discarded reads, changed
definitions and unknown transforms are not. Both `readProjection` and
`intakeDedupDefinition` may name that complete consumer form.

Admission credit requires actual `authorAndAppend(input, c, createFactStore(c, storage), key)`
or `const store = createFactStore(c, storage); store.append(input)` with an actual
`intakeWorkRegistration` result in `c.ownedBodies`. Immutable local context helpers,
known spreads and conditional branches are supported only when every alternative
retains the registration. Constructing an unused registration does not count.
Helper return expansion requires a unique local function declaration whose binding
has no visible assignment, including destructuring and loop assignment. Replaced
read/context helpers lose credit even though their original bodies remain in the
source. Member, external and dynamic helper calls are outside this supported form.
`intakeStopRegistration` receives credit only when present in that admitted registry;
it does not independently authorize a governed-state stop gate. Stop remains ruled-three.
Fact-store/definition aliases must be const; observed property writes and mutating
array calls invalidate their proof. Dynamic calls and general runtime mutation are
outside this bounded static language. Four still owns and tests durable arrival,
directives, causal dedup, standing, no in-cone stop and historical-standing use.

All consumer proofs use the closed committed source graph, including intake,
facts and projections public aliases. No ambient intermediary or same-name local
function supplies evidence. Source pairing and record read must remain colocated
with the consumer in the gate's function. This is source wiring, not a claim of
control-flow dominance or production authority.

## Pair-aware verified runtime construction

The public register export `readEnforcedRecord(site, record, decoder, verified, context)`
returns a Result. Consume it before performing work; do not ignore a refusal:

```ts
const verified = take(loadRegister(candidate, generation, context, spine, now));
// spine supplies real extract, entering-force and freshness verification.
constructGoverned('blocking sites', 'intake.dedup', verified, context);
take(readEnforcedRecord('intake.dedup', 'intake.contract', 'readProjection', verified, context));
// The actual P2 projection chain remains here in this same gate function.
```

The guard requires a live gate with the exact governed-state record/decoder pair,
a live record with approved history, and a genuine `loadRegister` object. Shape-only
casts, missing entries and mismatched pairs refuse. It grants no standing and does
not replace normal-build writer/executor separation. It accepts no caller-supplied
reads/invokes claims. The scanner credits this read only for its own colocated gate;
the actual decoder/consumer call remains separately required.

`tests/integration/register.test.ts` demonstrates the supported test fixture route:
explicit test-only approved extract row, matching generation, and a SpineReadPort
whose extract/entering-force/freshness checks all run through `loadRegister`. This
is an injected fixture provider, not fabricated production approval. Negative
fixtures leave history pending or use a wrong pair and prove the real P1 decoder
is never called. Existing normal-workflow E2E covers approval and separated standing;
the mixed-owner CLI fixture covers replay with explicit missing prerequisites.
