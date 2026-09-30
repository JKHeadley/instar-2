# P15 lane evidence (committed)

`scripts/check-p15-contract-map.mjs` checks every held P15 disposition against the owner grants recorded by
the design lane: the seam ledger, the `seam-response-*.md` addenda and the `design-19-*` requests. Those
documents live in the design lane's agent home (`<agent-home>/.instar/lanes/`), which exists on one machine
only, so the check used to fail on every other machine (`docs/defects/absent-lane-documents-off-mac.md`).
They are committed here so the check reads the same evidence, pinned to the commit, wherever it runs.

- The `seam-response-*.md` and `design-19-*.md` files are byte-for-byte copies.
- `SEAM-LEDGER.md` holds only the ledger's numbered table rows (`| N | ...`), the only part the check
  reads. The ledger's operational journal is not copied.

Refresh when a grant the check names changes (run from the repository root, with `L` set to the design
lane directory):

```sh
for f in tests/scheduled/lane-evidence/seam-response-*.md tests/scheduled/lane-evidence/design-19-*.md; do cp "$L/$(basename "$f")" "$f"; done
grep -E '^\| [0-9]+ \|' "$L/SEAM-LEDGER.md" > tests/scheduled/lane-evidence/SEAM-LEDGER.md
```
