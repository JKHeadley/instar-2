# Part Three — re-slice of the normal-mode shape-change slice into A1 and A2

Granted as SEAM-LEDGER row 124 (Echo, 2026-09-14 03:21Z; reversible by Justin). The round-10 independent re-review of
`9931a7092901326f32f14108b5407d1604e7aa93` found the provider path clean and one retained-enrollment defect. This branch is
therefore reviewed as A1 only. Existing workflow/enrollment implementation remains present as retained work, but no positive result
from that surface is A1 acceptance evidence.

## A1 — provider path and seam proof (this review slice)

- The concrete Part Two-backed normal provider: exact store snapshots, public Part Two version decoding/walking, complete extract
  verification, currentness and staleness, witnessed entering-force generations, replay aliases, corrections/retractions,
  reference identity and currency, and revalidation at every consequential use.
- The public provider seam and protected-generator seam needed to supply that provider in normal mode. The `--replay` and
  `--bootstrap` paths remain byte-identical to `main`.
- Additivity: every test/helper that existed on `main`, including `tests/integration/register.test.ts`,
  `tests/register/owner-references.test.ts`, and `tests/register/workflow.test.ts`, remains byte-identical. Those original tests keep
  executing as compatibility controls, but their workflow/enrollment positives are excluded from A1 contract-map credit.

## A2 — held for a later workflow/enrollment slice

- Normal workflow decoding and composition, workflow-authored run/review/catalog/landed-part decisions, shape-change-document
  orchestration, repository repin/restart behavior driven by that workflow, and owner-reference enrollment.
- In particular, `resolveOwnerReferenceEnrollments()` must validate the retained historical shape transition against the exact
  witnessed parent generation, exact candidate shape, exact introduced entries, and actual part introduction before admitting the
  manifest tuple. Signature validity alone is insufficient.
- Every new A2 regression is held under the exact label
  `NON-EXECUTABLE-UNTIL-slice-A2-workflow-enrollment`. A passed workflow/enrollment acceptance arm is an A1 contract-map failure.

The retained A2 obligation is rereview11 F4's five-case table (the same defect first identified as rereview10 F1), preserving
these exact independently executable case ids:

- `valid` — a witnessed historical introduction of part 14 remains accepted.
- `unwitnessed-parent` — a parent generation with no entering-force record refuses (P3-NF-21).
- `wrong-candidate-shape` — a document whose candidate-shape hash differs from the actual candidate refuses (P3-NF-09).
- `wrong-shape-difference` — a document claiming `/parts/9999 = 99` instead of the actual part-14 introduction refuses
  (P3-NF-09).
- `normal-build-invalid-retained-enrollment` — the shipped normal build refuses a signed retained document that claims another
  addition of 14 at `/parts/12` although the witnessed parent already contains part 14 and the candidate shape is unchanged.

## Exact P3-NF disposition (30 governed rows)

`MIXED` means the existing core/provider arm is A1-executable and the workflow/enrollment arm is held under the row-124 label. It
does not permit a workflow/enrollment pass to count toward A1.

| Check | A1 disposition | A2 workflow/enrollment disposition |
|---|---|---|
| P3-NF-01 | EXECUTABLE | NON-EXECUTABLE-UNTIL-slice-A2-workflow-enrollment (normal workflow repin/restart arm) |
| P3-NF-02 | EXECUTABLE | NON-EXECUTABLE-UNTIL-slice-A2-workflow-enrollment (workflow boundary arm) |
| P3-NF-03 | EXECUTABLE | NON-EXECUTABLE-UNTIL-slice-A2-workflow-enrollment (workflow decoder arm) |
| P3-NF-04 | EXECUTABLE | — |
| P3-NF-05 | EXECUTABLE | — |
| P3-NF-06 | EXECUTABLE | — |
| P3-NF-07 | EXECUTABLE | NON-EXECUTABLE-UNTIL-slice-A2-workflow-enrollment (workflow replay arm) |
| P3-NF-08 | EXECUTABLE | — |
| P3-NF-09 | EXECUTABLE | NON-EXECUTABLE-UNTIL-slice-A2-workflow-enrollment (shape document and enrollment arms, including F1) |
| P3-NF-10 | EXECUTABLE | — |
| P3-NF-11 | EXECUTABLE | — |
| P3-NF-12 | EXECUTABLE | — |
| P3-NF-13 | EXECUTABLE | NON-EXECUTABLE-UNTIL-slice-A2-workflow-enrollment (workflow graph arm) |
| P3-NF-14 | EXECUTABLE | — |
| P3-NF-15 | EXECUTABLE | NON-EXECUTABLE-UNTIL-slice-A2-workflow-enrollment (workflow loop arm) |
| P3-NF-16 | EXECUTABLE | — |
| P3-NF-17 | EXECUTABLE | — |
| P3-NF-18 | EXECUTABLE | — |
| P3-NF-19 | EXECUTABLE | NON-EXECUTABLE-UNTIL-slice-A2-workflow-enrollment (workflow resolution arm) |
| P3-NF-20 | EXECUTABLE | — |
| P3-NF-21 | EXECUTABLE | NON-EXECUTABLE-UNTIL-slice-A2-workflow-enrollment (retained-enrollment parent witness arm) |
| P3-NF-22 | EXECUTABLE | NON-EXECUTABLE-UNTIL-slice-A2-workflow-enrollment (normal workflow completion arm) |
| P3-NF-23 | EXECUTABLE | NON-EXECUTABLE-UNTIL-slice-A2-workflow-enrollment (workflow/extract use arm) |
| P3-NF-24 | EXECUTABLE | NON-EXECUTABLE-UNTIL-slice-A2-workflow-enrollment (workflow landed-parts arm) |
| P3-NF-25 | EXECUTABLE | — |
| P3-NF-26 | EXECUTABLE | NON-EXECUTABLE-UNTIL-slice-A2-workflow-enrollment (workflow graph arm) |
| P3-NF-27 | EXECUTABLE | NON-EXECUTABLE-UNTIL-slice-A2-workflow-enrollment (workflow separation arm) |
| P3-NF-28 | EXECUTABLE | NON-EXECUTABLE-UNTIL-slice-A2-workflow-enrollment (workflow evidence arm) |
| P3-NF-29 | EXECUTABLE | NON-EXECUTABLE-UNTIL-slice-A2-workflow-enrollment (workflow graph arm) |
| P3-NF-30 | EXECUTABLE | — |
