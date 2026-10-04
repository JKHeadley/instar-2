# Change review — w4-toolpaths: file and shell tools decided on the resolved file, the file-tool swap race named

Subject base: 383c10943305c47a850b43fcad9b125c864791c5
Review state: open
Reviewed content: none
Outcome: Plan rows #442, #445 and #447. Live L43 group T scenario t2 showed the boundary deciding on the path string: Read and the sandbox refused /etc/hosts while /private/etc/hosts was read. The admission hook (tool-admission.mjs) now decides every file read, search, write and edit on the realpath of the presented path against one shared set (the workspace, the shell's temporary directory, and SUBSCRIPTION_TOOL_RUNTIME_READS for reads), and hands the harness that resolved path; the sandbox profile reopens the /etc and /var root links themselves (SUBSCRIPTION_TOOL_RUNTIME_READ_LINKS) so /etc/hosts reads as /private/etc/hosts does and nothing else behind them opens. Review MF1 (`..` after an absent component skipping resolution of the remaining link) is fixed at the source: such a path does not resolve and is refused, matching the OS. Review MF2 (a path the agent itself swaps for a link between admission and the harness's open of an in-process file tool) is recorded as a named residual in docs/defects/2026-10-03-file-tool-swap-race.md by desk decision #447, and Part 17 §9, its changelog and tests/preview/README.md now say exactly what holds: Bash is decided by the kernel at open, the file tools by realpath at admission. The register is replayed at the source commit.
Affected rules: 1 (both checkpoints enforce one set in code), 57 (free choice of tools and spellings inside a fixed set, refusal for anything outside or unresolvable), 116 (one shared list, two link entries, the resolved path passed through; no new gate), 37 (the residual is a tracked defect with an owner and closing path), 4 (Part 17 §9, changelog and README match the code), 36 and 70 (the recorded live t2 shape is replayed as a fixture), 101 (no hook bypass); purpose revision 12 (an ordinary system file is no longer refused for its spelling; no tool removed)
Affected floors: secrets — strengthened for every spelling a sandboxed command or a presented file-tool path can use (MF1 closed); the file-tool swap race between admission and open remains a named residual (docs/defects/2026-10-03-file-tool-swap-race.md); spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none (desk decision #447 under the operator's standing grant, message 121996)
Suggested tier: critical
Declared tier: critical
Tier rationale: it changes admission decisions and the sandbox read profile on the secrets floor.
Side effects: a file-tool call is handed its resolved path, so tool results name the canonical path; a refusal of an alias or link spelling names "resolves to".
Undo and recovery: revert the commits; no durable state is added.
Multi-machine posture: machine-local; path resolution and the sandbox profile are per tool executor, with no replication or peer dependency.
Layer below: the Claude Code 2.1.280 sandbox (Seatbelt, unchanged apart from the two link reads) and the harness's in-process file tools (unchanged; the residual lives there).
Bug class: live-path
Bug evidence: reproducer=tests/preview/tool-paths.test.ts; live=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/pipeline/live-proof/results/T-proofroom-20261003-175716/tools-t2.json
Hook bypass: none (plain commits; core.hooksPath is unset)
Convergence: none
Decision: w4-toolpaths-mf2 | accept the in-process file-tool swap race as a named residual rather than nesting the harness in a sandbox (macOS refuses nested sandboxes, which would drop the Bash sandbox) or replacing the built-in file tools (ability reduced); the closing path is the harness as a separate OS user, an operator infrastructure step | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-toolpaths-PROGRESS.md
Prompt review: the model-facing text changed is the hook's refusal reasons for file paths (now naming the resolved target, "resolves to") and the README/§9 description; the recorded live t2 shape (proof-L43-t2.json, update 715673353) is replayed through the real hook in tool-paths.test.ts.
Prompt finding: 450c79237a95 | protocol-literal | existing fixture phrase in production-provider.ts, unchanged by this change (as dispositioned in the carried w3-longchat record)
Deferral: generated/register.json:1 | not-a-deferral=generated register replay at the repair commit

Subject (21 paths): docs/17-harness-adapters.changelog.json, docs/17-harness-adapters.changelog.md, docs/17-harness-adapters/09-claude-code-codex-and-future-runtime-mappings.md, docs/defects/2026-10-03-file-tool-swap-race.md, generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, src/assembly/harness.declarations.json, src/assembly/production-provider.ts, tests/assembly/production-provider-tools.test.ts, tests/preview/README.md, tests/preview/fixtures/tool-turn/live-2026-10-03/proof-L43-t2.json, tests/preview/tool-admission-hook.mjs, tests/preview/tool-admission.mjs, tests/preview/tool-paths.test.ts, tests/preview/tool-turn.mjs, tests/preview/tool-turn.test.ts

## Closing block

simplestRobustRoute: one shared read/write set compared on resolved paths at the existing hook, two link reads in the existing sandbox profile, and the in-process race named with its OS-user closing path instead of new machinery that would reduce ability.
80/20: 0 must-fix open in code (MF1 fixed; MF2 a tracked residual by desk decision #447); targeted tests (tool-paths, tool-admission, tool-turn, production-provider-tools); the pipeline reruns the full suite.
VERDICT: author submission; the independent verdict is recorded as a pass
