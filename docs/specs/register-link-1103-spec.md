# Live constitution/register link — measurement at train-227

Measured 2026-11-09 07:37 PST against exact live source
`0bde1fda553a2609382d221684b152aa71cdb634`. Measurement only; no product change.
The earlier spec exists only at the Studio desk's absolute
`.instar/lanes/register-link-1103-spec.md`; this repository snapshot preserves its definitions.

## Counts and definitions

| Measure | 2026-11-03, fc000d65 | 2026-11-09, 0bde1fda |
|---|---:|---:|
| Rules with structural links / current rules | 8 / 118 | **8 / 122** |
| Distinct rules held-reviewed | 0 | **0** |
| Held-unreviewed edges | 0 | **0** |
| Declared / partial / deferred edges | 3 / 24 / 3 | **3 / 28 / 0** |
| Rules with no holder edge (gap) | 110 | **114** |
| Feature declarations / marked live | 17 / 5 | **19 / 6** |
| Carryover rows with recorded historical live proof | 1 / 100 | **1 / 100**, still pinned to fc000d65 |
| Carryover rows established by inspected proof on the measured SHA | 1 / 100 | **0 / 100 established**; current-head parity unmeasured |

A structural link means a live rule's `graph.rules[].enforcedBy` names a live
holder declaration, whose `holds[].evidence` resolves through the owner-reference
catalog to a can-fail fixture/probe. It does not mean whole-rule enforcement.
Each of the eight rules has at least one pinned fixture path below; no deferred
edge is counted as a test link. Coverage classes count edges, except gap, which
counts rules. `held-reviewed` additionally requires wired evidence and a matching
semantic review subject in `src/rulegraph/graph.ts`; count distinct rule numbers,
not edges. This replay has neither reviewed nor unreviewed held edges.

The 100 grouped carryover outcomes are the existing desk inventory
`/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-1028.md`, not the
19 feature declarations. Its only PROVEN row is 63: request 729, update 969390668,
same-topic reply 733 on fc000d65. That result is historical, not re-proven here.
No complete row proof bound to 0bde1fda was established in the inspected inventory
or `rowproof-1109-PROGRESS.md` at measurement time; that separate proof run was
still preparing for room custody. Zero established is an evidence gap, not zero
working capabilities. This measurement sends no messages and promotes no row.

## Reproduction and authority limit

Built TypeScript with `nice -n 10 npm run build`, then ran both commands successfully:

```sh
node scripts/build-register.mjs --replay --commit 0bde1fda553a2609382d221684b152aa71cdb634 --out /Users/dabombstudio/.instar/agents/echo/.instar/lanes/register-measure-1109-replay
node scripts/build-register.mjs --replay --commit 0bde1fda553a2609382d221684b152aa71cdb634 --check --out /Users/dabombstudio/.instar/agents/echo/.instar/lanes/register-measure-1109-replay
```

Generation: `sha256:f994242aa7fd631bf6b531d48c065d445070479473bee56ab1627eb1adb360fc`.
307 entries, 122 rules, 34 terms, 48 term warnings, 114 prerequisites.
Read the class table and JSON rule list in that output's `coverage.md`, and resolve
its holder IDs against `register.json` and committed owner-reference catalogs.
`genesis:empty-extract` and `authority: shape-only` remain explicit. Replay does
not establish entering-force authority or user acceptance. Checked-in `generated/`
remains the publication from af3c666a; it is not substituted for this exact-source run.

## The eight linked rules

These are representative complete reference chains, not whole-rule proof claims.
The `.declarations.json` files carry the holds; the owner catalogs pin test bytes.

| Rule | Declaration path → holder | Evidence ID → can-fail test |
|---|---|---|
| 4 | `src/intake/port.declarations.json` → `intake.stop` | `P4-NF-14-PARTIAL` → `tests/intake/governance.test.ts` |
| 9 | `tests/preview/capabilities.declarations.json` → `preview.sentinel.summary-review` | `PREVIEW-RULE-PROBES` → `tests/preview/proofs.test.ts` |
| 14 | `src/intake/port.declarations.json` → `intake.admission` | `P4-NF-13` → `tests/intake/governance.test.ts` |
| 36 | `tests/preview/model-json.declarations.json` → `preview.model-json.parseModelJson` | `PREVIEW-MODEL-JSON-ON-CAPTURE` → `tests/preview/model-json.test.ts` |
| 43 | `tests/preview/capabilities.declarations.json` → `preview.reply.delivered` | `PREVIEW-RULE-PROBES` → `tests/preview/proofs.test.ts` |
| 60 | `scripts/resource-owner.declarations.json` → `resource-owner.admit` | `PREVIEW-RESOURCE-CENSUS-RECOVERY` → `tests/preview/resource-census-recovery.test.ts` |
| 61 | `scripts/resource-owner.declarations.json` → `resource-owner.admit` | `PREVIEW-RESOURCE-ADMISSION` → `tests/preview/resource-admission-evidence.test.ts` |
| 66 | `src/rungraph/rungraph.declarations.json` → `rungraph.stop` | `P5-NF-54-PARTIAL` → `tests/rungraph/governance.test.ts` |

## This week's switches and test scope

All eight rule numbers below have **no formal holder edge** in this exact replay.
Existing tests are useful evidence without increasing the formal linked-rule count.

| Rule / change | Can-fail test and its limit |
|---|---|
| 72 — train-221 deadline scope | Yes: `tests/rulegraph/graph.test.ts` passes unrelated changes with attention and refuses touched overdue declarations; unknown scope fails closed. |
| 93 — train-224 pref-verbatim | Yes: `tests/preview/preference-verbatim.test.ts` replays D5 update 46041015, preserves the full sentence, and distinguishes clause retirement from an unrelated fact correction across reopen. |
| 37 — rerun records | Repository evidence gate: yes, `tests/register/change-review.test.ts` rejects dirty/interrupted/moved runs and keeps red evidence visible after green. The separate desk `pipeline/driver.py` appends flips to `flakes.jsonl`; no dedicated can-fail test for that append was found in the searched pipeline test files. A rerun record alone does not complete quarantine/defect handling. |
| 46 — train-227 status reason | Yes, scoped to visibility: `tests/preview/journal-obligations.test.ts:703` asserts held-plus-shed and held-with-capacity outcomes; it does not prove eventual drain. |
| 64 — train-227 status reason | Yes, same test exposes due work and both inhibition causes with measured capacity. |
| 68 — train-227 status reason | Yes, same test also preserves uncertain starts across reopen without duplicate execution; this status change is not a complete autonomous revival proof. |
| 92 — train-227 status reason | Yes for the status projection through the same test; no new check-in cadence test is established by this change. |
| 102 — change-review | Yes: `tests/register/change-review.test.ts:121` accepts a decision with its named report and refuses absent reports, wrong IDs and malformed/repeated decisions. |

## 1.x comparison and simplest route

Searched JKHeadley/instar `origin/main` src/, docs/specs/ and history at
`6cbe44c819cd97aec1d9c7f470b04148fbca708d`: `src/core/StandardsRegistryParser.ts`,
`scripts/standards-coverage.mjs`, `docs/specs/CARTOGRAPHER-CONFORMANCE-AUDIT.md`;
history includes 84b2220f3a, a10176d728 and ac000547bf. Reuse their named-guard and
resolvable-reference discipline through the existing 2.0 builder. Their existence
grading cannot supply reviewed Hold/Part Two authority. ONEX-LESSONS areas 1 and 5
warn against unknown production SHAs and missing evaluation presented as proof.
The simplest robust route is this dated replay and scoped evidence report; no
scanner, runtime gate, authority provider or second carryover inventory is added.
