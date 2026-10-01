# Split-merge report fixtures

Real captured vitest JSON reports, used by `tests/platform/gate-split-merge.test.ts`. Hand-written
reports would not carry the shape the merge actually meets, so every one of these is bytes a real
run wrote. Absolute file paths are the capturing checkout's and are deliberately kept: the merge is
a pure function over strings, and each fixture's half provenance names the root its own report used.

| File | Captured from |
|---|---|
| `split-merge-unsplit.json` | `npx vitest run tests/platform/macos-only.test.ts tests/platform/gate-split.test.ts --maxWorkers 1 --reporter=json` on the Mama PC (WSL2, Linux), branch `w3-splitmerge` at `72fb5a82`. |
| `split-merge-half-a.json` | the same, naming `tests/platform/macos-only.test.ts` alone. |
| `split-merge-half-b.json` | the same, naming `tests/platform/gate-split.test.ts` alone. |
| `split-merge-mac-only-macos.json` | a real Mac `INSTAR_TEST_PLATFORM_SPLIT=only-macos` gate half: `.instar/lanes/par-qual/splitval-L12-59c66a48-only-macos/test-results.json`, the run whose `gate.log` recorded `missing actual test for NF-01`. |

`split-merge-half-a.json` and `split-merge-half-b.json` are a two-file split rehearsal: each is one
real vitest process over one real file, and the test labels them `only-macos` and `exclude-macos` in
their half provenance. The merge never reads the macOS-only list — a label is provenance it records,
not a claim it verifies — so the labels cost the fixture nothing. The genuine cross-machine shape
(a Darwin checkout root, seven files, 90 tests) is covered by `split-merge-mac-only-macos.json`.

The four reports end without a trailing newline because that is what vitest wrote; they are
unmodified output. `reportDigest` hashes the parsed object, so surrounding whitespace is not
load-bearing — but leaving the bytes alone is.
