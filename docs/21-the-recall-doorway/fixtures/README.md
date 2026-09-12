# Part Twenty-One design contract artifacts

These files accompany the governed design. They are versioned test/replay contracts, not
production exports, permission grants, actual private incidents or model-performance results.
The governing requirements are sections 10–13 of the design and
[R5 §12](../research/05-proposals-and-evaluation.md#12-incident-replay-handoff-and-recommendation).

| Artifact | Purpose |
|---|---|
| `incident-replay-v1.schema.json` | Draft 2020-12 JSON Schema for `P21-INCIDENT-REPLAY-v1`; closed structural fields, bounded arrays and tagged unknowns |
| `incident-replay-v1.example.json` | Invented shape-only example; opaque `synthetic:` references are not live custody handles; no model run or dispatch |
| `legacy-regressions.json` | Permanent F1/F2/F3 observed baselines and distinct future repair oracles; preserves the original measured failures |

The existing [research fixtures](../research/fixtures/README.md) remain unchanged: 20 invented
histories, 200 primary variants, 20 supplementary probes and the observed installed-method run.
No new person or incident is inferred from the design example. The example is not a 201st case.

## Shape is not authority or readiness

Use a Draft 2020-12 validator, including date-time format checking. Every tagged observation is
`known` with its value, or `unknown`, `unavailable`, or `not-applicable` with a nonempty reason.
Empty string/null is not an undocumented substitute. Known empty collections are allowed where
they mean an observed empty inventory. Unknown history never becomes an empty known frontier.
All objects reject undeclared fields. The `artifact` identity fixes schema version one; a schema
change requires a new identity and migration, not reinterpretation of the same record.

Shape-valid does not mean runtime-ready. The owner must additionally perform semantic validation:

1. Resolve each reference through authorized custody and verify the source hash, admitted fact,
   scope, generation and causal frontier. A string with the right syntax is not a grant. References
   must not contain embedded credentials, raw personal text, or publicly usable private tokens.
2. Freeze evidence at the trigger's decision time and source frontier. Do not expose later intake,
   future corrections, expected behavior, diagnosis or repair lesson to the replaying reader. The
   `evaluationOnly` object belongs exclusively to the grader and external experiment logger.
   Its `readerAccess:false` flag is a contract obligation, not proof a consumer obeyed it.
3. Resolve original author, quoted author/forwarder where applicable, conversation, account and
   audience from source evidence. Check provider/internal-use/disclosure policies separately before
   search, hydration, embedding, model context, cache and final prepared output. Resolve any
   authority for the simulated effect from its owner, never from remembered prose.
4. Validate the index's per-lineage position and exact processed spans/holes against original
   source history. A frontier cannot cross a required unprocessed span. A known empty indexCoverage
   means no index coverage was supplied, not a claim that every source was indexed.
5. Resolve candidate, packet, manifest and actual provider-input captures independently; verify
   transformations and selected support paths. A missing actual input permits a partial replay
   or an unavailable diagnostic, not an assertion about what the original reader saw.
6. Resolve every acceptable support path to permitted original evidence available at the replay
   snapshot, including current-trigger support where valid. An expected answer is a grader label,
   never replacement evidence. Unknown originals or forbidden sources select the unavailable
   rubric; they cannot become healthy-evidence opportunities by inference.
7. Reconcile timestamps and charges through comparable owner clocks and resource records. Unknown
   price/usage stays unknown, and cancelled/late work remains counted. A declared model execution
   requires an actual resolvable run and input/output evidence; the boolean alone proves nothing.
8. Keep original episode, inferred explanation and procedural lesson as separate references. Pair
   a private incident with a comparable success and unavailable-source/legitimate-hold control
   before admitting it to the paired experiment. A missing pair is a reported readiness gap.
9. A sanitized-production artifact requires a real original-episode reference and export decision
   from the current owner. Verify both, plus the transformation from private source to sanitized
   replay and its declared semantic losses. The schema checks their presence only. Synthetic
   artifacts have `productionDerived:false` and cannot be promoted as production-derived cases.
10. Replay always stops at a sandboxed prepared effect, with `dispatchAllowed:false`; the real
    effect adapter must be absent or structurally confined. No payment, message, deployment or
    public post is performed to obtain a benchmark answer.

Unsupported or unknown required context produces a partial/unavailable import report with exact
reasons. Unknown optional diagnostics may remain unknown. Invalid authority, a post-frontier
support path, private export without a grant, or reader-visible labels refuses the affected
replay; no synthetic filler closes it. These semantic consumers are
NON-EXECUTABLE-UNTIL-P21-A3 and the owner dependencies in section 14.

## Permanent regression interpretation

`legacy-regressions.json` copies only the measured observation fields from
`research/fixtures/installed-baseline-results.json`. The execution identity, real-method
substitutions and hash-matching reproduction recipe remain in R2 §8 and R5 §7. It contains no
new execution claim. Its repair oracles are normative future behavior, with `repairExecuted:false`.

The F3 baseline's empty hybrid stub did not demonstrate a successful dense result. Its repair
variant deliberately supplies a useful fact only through a declared dense/hybrid adapter. Test
actual strategy invocation and actual submitted body while retaining a valid lexical-only
control. F1 tests exact processed coverage, not whether a model remembered every summarized word.
F2 tests body delivery, not whether an entity name could happen to imply the answer.

## Validation and expected negatives

Structural validation must accept the included example and reject an omitted required field,
undeclared root/nested field, untagged null, `known` without a value, unknown without a reason,
bad decision-time format, `readerAccess:true`, `dispatchAllowed:true`, and synthetic content
marked production-derived. A sanitized-production variant without known export/original
references must fail. Schema-valid forged references, future-label leakage and unsupported
execution claims belong to the separate owner semantic checks and must never be reported as
covered by JSON validation alone. Neither validation layer establishes beyond-human coherence.
