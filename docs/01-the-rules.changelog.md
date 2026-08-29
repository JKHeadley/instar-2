# Changelog — `01-the-rules.md`

_Generated from `01-the-rules.changelog.json` by `scripts/render-changelog.mjs` — do not edit by hand._
The document itself reads as a first version; every change to it is recorded here, newest first,
each linked to the git change that made it (rule 91).

## Revision 9 · 2026-08-26 · approved — operator review on PR #4; net-new rules implied by the operator's rulings and by the re-sweep of the widened Telegram record (PR #8): 22 rules added, 92-113

- **Rules 92-98 added, each restating a decision-sheet ruling as an operating rule: check-in cadence (92, ruling 17), directive persistence (93, ruling 27), waiver-before-the-act (94, ruling 11), fail direction per consumer (95, ruling 5), full-history session grounding (96, ruling 23), exit-test-not-clock (97, ruling 16), silence-is-never-consent (98, ruling 10).** — The rulings are law but lived only in the decision sheet; the rule book is where sessions read their duties. _(docs/harvests/standards-and-registries-harvest.decisions.md; PR #4 merge 616bc3b)_
- **Rules 99-113 added from the re-sweep's Part 2: operator-stated rules the original harvest never carried, each citing the message id of its first statement (recheck-dated walls 99; secret-stored-before-spent 100; hooks-never-skipped-silently 101; decisions-are-cheap 102; boundaries-from-governance 103; standing-grant ratchet 104; channel parity 105; working links 106; per-gate evidence bar 107; separately-falsifiable verdicts 108; frozen-under-review 109; compaction disclosure 110; layer-below review 111; green-history preservation 112; multi-machine posture declaration 113).** — The 2026-08-26 full export widened the record to March 8; these rules were stated in the newly-visible span. _(docs/harvests/standards-and-registries-resweep.md (Part 2); resweep-reader-notes/ for the verbatim citations)_
- **Group counts updated (21 checkable / 9 free / 71 needs building / 12 mind, total 113) and the source note now names where rules 92-113 came from.** — Consequence of the additions. _(this revision)_

Approved in: PR #9, merge `9f5cbaa0a`.

## Revision 8 · 2026-08-28 · approved — operator review on PR #8; operator's review of PR #8: the 80/20 judgment is fractal, and its per-category test is severity — a category whose new findings trend less severe, or fall below the severity threshold, has converged even while their count grows

- **Rule 65: 'recursively … each stream' becomes 'fractally … each category', and the judgment gains its concrete test — a category converges when its new findings run progressively less severe or fall below the review's severity threshold, even though new material keeps appearing. The check column now requires the accepted residue to name the severity basis on which it was accepted.** — Reviewers can keep finding new security flaws indefinitely; from outside that never looks like convergence. The operator's test makes the stopping judgment concrete and auditable: the trend of severity, not the count of findings. _(PR #8 review comment 3878619074)_

Approved in: PR #8, merge `2b44142ff`.

## Revision 7 · 2026-08-26 · approved — operator review on PR #7; operator's review of PR #7: the 80/20 convergence judgment must apply recursively, or a review whose finding stream never dries (e.g. vulnerabilities) can never converge

- **Rule 65: the 80/20 judgment applies recursively, at every level of the review — to the audit as a whole and to each stream of findings within it; a reviewer may accept a residue (recorded, not fixed) so the review can converge, and the convergence record must name any accepted residue.** — A live spec review ran twenty-plus iterations without converging because reviewers kept finding new vulnerabilities; applied recursively, 80/20 lets the reviewer judge that some residual findings are acceptable, which is what allows convergence at all. _(PR #7 review comment 3868871083)_

Approved in: PR #7, merge `2f531ba26`.

## Revision 6 · 2026-08-26 · approved — operator review on PR #4; the operator's rulings on the 33 tensions (decision sheet, merged in PR #4) applied to the five existing rules they directly amend

- **Rule 65 rewritten: convergence is the 80/20 judgment of an independent reviewer, never the author; a round count is a floor and a confusion detector, never the stopping rule.** — Ruling 1. _(docs/harvests/standards-and-registries-harvest.decisions.md (ruling 1); PR #4 merge 616bc3b)_
- **Rule 4 rewritten: the no-model decision set is the ruled list — a live secret leaving, spend past a cap, the emergency stop — driven by the formal criticality assessment; everything else informs and advises, and a block preserves its input.** — Rulings 19 and 2. _(docs/harvests/standards-and-registries-harvest.decisions.md (rulings 19, 2); PR #4 merge 616bc3b)_
- **Rule 86 gains the two ruled exceptions (secrets and money) and the block-preserves-its-input clause.** — Ruling 2. _(docs/harvests/standards-and-registries-harvest.decisions.md (ruling 2); PR #4 merge 616bc3b)_
- **Rule 37 scoped to main and merge, with the flake policy: a flipping test is quarantined with a defect filed, and interrupted work proceeds.** — Rulings 6 and 33. _(docs/harvests/standards-and-registries-harvest.decisions.md (rulings 6, 33); PR #4 merge 616bc3b)_
- **Rule 82 gains merge authority: the agent merges anything honestly green; the operator is asked only for the constitution and the protected list; an approval wait never outlives its proof.** — Ruling 3. _(docs/harvests/standards-and-registries-harvest.decisions.md (ruling 3); PR #4 merge 616bc3b)_

Approved in: PR #7, merge `2f531ba26`.

## Revision 5 · 2026-08-25 · approved — operator approved rule 91 on PR #3 and asked for it to be folded into the rule book

- **Rule 91 (A Document Reads as Its First Version) added to the 'checkable now' group, and rule 90 (History Is a Lookup, defined in the glossary) added to the 'needs building' group; counts become 20 / 9 / 51 / 11 of 91.** — Both rules were approved but lived outside the rule book — 90 in the glossary, 91 as a proposal — so the book was not the full list. _(PR #5)_
- **Rule 91 applied to this document: the 'what changed in revision 2' paragraph, the 'revision 2.2' status, and two 'the first draft said' remarks moved out of the body into this changelog.** — The rule book cannot carry the history rule 91 forbids. _(PR #5)_
- **The rule 91 text moved from docs/proposals/ to docs/rules/91-a-document-reads-as-its-first-version.md, status approved, with the review-time asides and the resolved open question removed.** — It is a rule now, not a proposal; the full text needs a governed home the book can point at. _(PR #5)_

Approved in: PR #5, merge `5bf996f`.

## Revision 4 · 2026-08-23 · approved — operator review on PR #1; operator's review on PR #1

- **Finding 5: real cases become the benchmark, and the benchmark picks the door (proposed standard).** — Operator review comment on PR #1. _(`09abbbf`, PR #1)_

Approved in: PR #1, merge `c4cd6df`.

## Revision 3 · 2026-08-23 · approved — operator review on PR #1; operator's review on PR #1

- **Review is retrospective by default; live review only for irreversible moments.** — Operator review comment on PR #1. _(`e225278`, PR #1)_

Approved in: PR #1, merge `c4cd6df`.

## Revision 2 · 2026-08-23 · approved — operator review on PR #1; operator's first review on PR #1

- **Every rule gains a plain 'what it means' column.** — The first draft listed only names, which is exactly the ambiguity the rules are meant to design out. _(`e0a368d`, PR #1)_
- **The fourth group renamed from 'a value' to 'held by the mind'; its claim becomes 'the mind holds it, and a script proves the mind was looking' rather than 'nothing to check'.** — 'A value' wrongly implied nothing could be done with those rules. _(`e0a368d`, PR #1)_
- **Finding 4 (load-bearing definitions), a section of concrete 'make it a type' examples, and an open decision on how much a model-call record keeps.** — Surfaced by the first review. _(`e0a368d`, PR #1)_

Approved in: PR #1, merge `c4cd6df`.

## Revision 1 · 2026-08-23 · approved — first draft: all 89 Instar 1.x rules sorted by how each is held

- **First version.** — Step one of Instar 2.0's docs-first foundation. _(`0f52212`, `49de06b`, PR #1)_

Approved in: PR #1, merge `c4cd6df`.
