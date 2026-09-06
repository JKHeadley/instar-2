# P5 source-reference consumption (P3 extension)

P5 owns its declarations, decoders and catalog data. P3 owns the resolver and
source-wiring proof. No P5 record is added to P1's Inventory or P3's fact schemas.

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
their hashes. These are the only five decoder IDs admitted by this extension.
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
This is scoped to `rungraph.contract`, declared by P5's adjacent sidecar at the
bound governed-document location. Other unapproved governed records still refuse
in replay; this extension is not a generic approval/standing waiver.

Bootstrap transitions and normal/completion builds still enforce approved history
and actual writer/executor separation. Runtime consumers still use `loadRegister`
with P2 extract, entering-force and freshness checks, then `readRegisterEntry` and
`checkGovernedState`. Pending contract history still refuses there; a source pin
or shape-only replay is not a substitute. P3's normal-workflow E2E supplies explicit
test-only approved contract rows and separated principals; it does not mint real
P5 approvals. Its copied catalogs include the committed producer tests.
