# Change review — train-222 repair: the MCP production-install proofs install from a stable package copy

Subject base: 1231775f2cbe110348c1a0e9bc66c90e598d43ea
Review state: open
Reviewed content: none
Outcome: the two tests/preview/mcp-setup.test.ts production-install proofs no longer fail when sibling tests write into the checkout during the full suite (m5pro gate of train-222 at 1231775f: 'Release installation failed; current release retained' twice). They now install the real package from one copy taken before npm runs.
Affected rules: 37, 44, 74, 101, 113, 116
Affected floors: secrets — unchanged; the updater still forwards no npm output; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: test-only change; no product source, script or package file changes.
Side effects: each run of the file copies the package tree once (about 63 MB, skipping .git, .instar, node_modules and the top-level names in .gitignore) to a temp dir and removes it after the file. The installed package no longer carries the checkout's .instar desk files in this proof; nothing at runtime reads them. scripts/update.mjs and the public github: install path are unchanged.
Undo and recovery: revert the commit; the tests pack the live checkout again.
Multi-machine posture: machine-local test fixture; no state shared across machines.
Layer below: scripts/update.mjs install() (unchanged: npm install --install-links of the source, output withheld); npm's file: packing streams each file and fails with EOF when a file grows mid-read (reproduced alone in a scratch package); the writers are tests/assembly/production-grounding-process-evidence.mjs (appends .instar/lanes/round4c-artifacts/process-exits.jsonl) and tests/assembly/production-boot-conversation.shared.ts (writes .instar/lanes/boot-conversation-artifacts/shard-*.json), which write there by design for scripts/check-assembly-contracts.mjs. Reproduction: the original test file, run beside a process appending to .instar/lanes/race-proof/grow.jsonl, fails both tests with the gate's message; the changed file passes both under the same appender, and 23/23 alone.
Bug class: integration
Bug evidence: reproducer=tests/preview/mcp-setup.test.ts
Hook bypass: none
Convergence: none
Decision: mcp-install-stable-source | install from one filtered copy of the package instead of the live checkout, because the evidence writers must keep writing into the checkout and npm cannot pack a file that is growing | reported=/Users/adriana/echo-compute/builders/train-222-repair-182608-report.md
Prompt review: not model-facing: test fixture for the npm install path only.

1.x comparison: JKHeadley/instar main 598569878, tests/integration/development-artifact-update.test.ts builds its package in a temp fixture by copying from the checkout, then runs npm pack on that copy instead of packing the live checkout. This repair reuses that pattern. The same symptom class appears in a 1.x verify run on this machine (local-verify-conflict-breaker-64f7325-package-race.log: npm packing a checkout while a test wrote dist/native/...).

Subject (1 paths): tests/preview/mcp-setup.test.ts

## Closing block

simplestRobustRoute: copy the package once and install that copy; a test-only change of about 15 lines. The alternatives were worse: moving the evidence writers out of the checkout breaks their checkers; adding a package "files" list or .npmignore changes the shipped package for a test race; retrying the install hides the race.
80/20: fixes the race for these two proofs. Whether the public release should ship tracked .instar/lanes files is a separate packaging question, left unchanged.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
