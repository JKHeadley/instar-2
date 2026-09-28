# Vitest worker→main RPC timeouts under load (Rule 37, runner defect)

**Status:** OPEN. **Owner:** constitutional-build integration desk (Echo). **Opened:** 2026-09-28.

Two runs recorded unhandled runner errors `[vitest-worker]: Timeout calling "onTaskUpdate"`: the full run `cbuild-4-rr1-full-5ecf9519.log` (3) and the preview run `cbuild-4-rr3-preview-run2.log` (2, with 1,055 passed and 0 failed). Vitest counts these as errors, so the run exits 1 whatever the test results. The stack resolves through a sibling worktree's `node_modules/vitest` (`../part-six-run-admission/node_modules/vitest`) via the symlinked `node_modules`. The known local causes are host saturation and a test file doing long synchronous work that starves its fork worker's IPC. Neither is confirmed for these runs.

**Disposition:** not quarantinable per test; runner errors are infrastructure. These runs stay recorded as RED; no gate built on them is reported green. Coverage withheld: none by quarantine. The runs' own results are valid evidence only for the tests they report as passed.

**Repair and closure:** the owner (1) identifies the starving file or the host condition from the worker trace, (2) confirms the resolved vitest package is the worktree's intended version, not a sibling's, and (3) repairs the cause, for example by an async yield in a long synchronous file, lower worker count or a per-worktree install. Closure needs a full run with zero runner errors under the original conditions. If a later run shows the error again, this record reopens.

**Multi-machine posture:** runner and host are machine-local. This record travels with the repository.
