# Part Twenty-One design contract artifacts

This README is an explanatory guide only. All required validation, refusal and replay behavior
is in [section 10 of the governed design](../10-the-pilot-human-comparison-and-incident-replay.md).
[Section 11](../11-what-instar-1-x-does-today-and-what-carries-forward.md) defines the permanent
regression requirements, and sections 12–14 specify checks and implementation dependencies.
This README adds no contract requirement and is not a governed dependency.

| Artifact | Purpose |
|---|---|
| `incident-replay-v1.schema.json` | Draft 2020-12 JSON Schema for the replay format; structural validation is distinct from resolving real evidence and permission. |
| `incident-replay-v1.example.json` | Invented shape-only example; its opaque synthetic references are not live custody handles. No model run or dispatch occurred. |
| `legacy-regressions.json` | F1/F2/F3 observed baselines alongside unexecuted future repair expectations. |

The [research fixtures](../research/fixtures/README.md) describe 20 invented histories, 200 primary
variants, 20 supplementary probes and an installed-method observation. The shape-only example
is not an additional primary case or a real private incident.

The historical execution identity, substituted collaborators and hash-matching reproduction
recipe are described in research R2 §8 and R5 §7. The old F3 empty hybrid stub did not demonstrate
a successful meaning-based result. The section-11 repair case checks actual strategy invocation
and submitted body. F1 concerns processed coverage; F2 concerns body delivery. None establishes
that a model used the evidence or that memory coherence exceeds human performance.
