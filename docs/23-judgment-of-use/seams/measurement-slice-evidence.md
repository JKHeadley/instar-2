# Measurement prerequisite evidence

Verbatim SEAM-LEDGER rows from Echo’s lane directory:

| Row | Request | Owner | Grant and scope | Note |
|---|---|---|---|---|
| 78 | (re-slice of Part 16 slice A; no new request) | Sixteen (src/measurement) | GRANTED 20:12Z 2026-09-11 → part-sixteen-slice-a1-scope.md (A1 = owned records + registration/contract identity + resource/process/census validation + token quantities; A2 = burn/recovery/attribution/peer/historical reads, removed from the branch; A2 checks non-executable-until-slice-A2) |
| 101 | (re-slice of Part 16 slice A2 after rereview4; no new request) | Sixteen (src/measurement) | GRANTED 02:00Z 2026-09-14 → part-sixteen-slice-a2a-scope.md (A2a = single-store reads/resolution/aggregation/burn/history/source binding; A2b = cross-machine peer merge, built later as its own slice; peer-merge arms NON-EXECUTABLE-UNTIL-slice-A2b-peer-merge) | reversible by Justin |

The row-101 artifact is absent from the lane directory but resolved in the clean
measurement-owner worktree at
`/Users/dabombstudio/.instar/agents/echo/.worktrees/part-sixteen-a2/docs/20-measurement-ledgers/part-sixteen-slice-a2a-scope.md`,
commit `8625616e0566a0b8d0029e82aaf62110cd174f64`.
The [verbatim owner scope](part-sixteen-slice-a2a-scope.md) supplies its full
conditions; the ledger still supplies the grant. Both A2a and A2b acceptance
remain prerequisites for row 119, and neither is claimed implemented here.
