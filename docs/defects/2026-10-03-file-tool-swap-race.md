# File-tool swap race between admission and open (secrets floor residual)

**Status:** OPEN. A named residual of the secrets floor, accepted by desk decision (plan row #447, under the operator's standing grant, message 121996) until the closing path below is provisioned.

**Owner:** Echo (agent), as owner of the preview trial's tool admission. The closing step is an operator infrastructure step.

**Residual:** the in-process file tools (Read, Write, Edit, Glob, Grep) are admitted by the PreToolUse hook (`tests/preview/tool-admission.mjs`), which decides on the realpath of the presented path and hands that resolved path to the harness. The check happens at admission, not at open. If a directory or file on that resolved path is replaced by a symlink after the hook allows the call and before the harness opens the path, the harness follows the link. Review MF2 of unit w4-toolpaths reproduced it with the real executable hook and filesystem opens (`lanes/astra-unit-w4-toolpaths-repro.mjs`, synthetic canaries):

- admit `Read(ws/dir/credentials.json)` on an ordinary workspace file, then rename `ws/dir` aside and create `ws/dir -> ROOT`. Opening the returned path reads the canary at `ROOT/credentials.json`;
- replacing the final file with a symlink to the canary after admission does likewise.

**Precondition:** the agent itself must make the swap, concurrently: a sandboxed command it runs in parallel (or a background command it started) renames a workspace directory and creates the link inside the window between the hook's allow and the harness's open of the same file-tool call. Nothing outside the agent writes into the conversation's volume. The swap command itself cannot read the secret: Bash runs under the kernel sandbox, which decides at open.

**What holds:**

- **Sandboxed commands (Bash):** the kernel decides at open under the settings-derived Seatbelt profile, so no symlink, alias, `..` or swapped spelling reaches past the boundary (tests: `tests/preview/tool-paths.test.ts`, including a directory swapped for a link to the root between two commands).
- **File tools:** every spelling the agent presents is decided on its realpath at admission, including `..` after an absent directory (MF1, refused as unresolvable, matching the OS) and dangling links. Only the race above remains.

**Options considered:**

1. **A sandboxed file server** (an MCP server launched under `sandbox-exec` with the Bash profile, not nested) carrying the file I/O. Not taken: the built-in Read, Write and Edit would either be replaced, losing fidelity (images, PDFs, notebooks, Edit's read state) and reducing the agent's ability, which the purpose forbids when a checkpoint can enforce the safeguard instead; or kept beside it, in which case the race stays on them.
2. **The harness as a separate OS user** that owns only its login profile and the turn state, so secret material is unreadable by uid at open, enforced by the kernel with no window. Not taken now: it needs a provisioned account with administrator rights, which the agent never creates itself (P-01). This is the closing path.
3. **Accept the race as a named residual** with the documents corrected. Taken: the head is strictly better than live L43, which has both the MF1 spelling and the Bash spellings open, and the race needs the agent to attack its own admission concurrently.

Also rejected: running the whole harness under `sandbox-exec`. macOS refuses a sandbox nested in a sandbox (`sandbox_apply: Operation not permitted`, verified on the Studio), so Claude Code's own Bash sandbox would fail to start; dropping it would hand Bash the harness's network and login-profile access. No macOS mount option refuses symlinks on the scratch volume, and a filesystem without symlinks (exFAT) removes links, permissions and exec bits from the workspace.

**Closure:** the operator provisions a dedicated OS user for the harness, owning only the login profile and the turn state, with roots and runner material unreadable to it. The preview then launches the harness as that user, a test shows the reviewer's swap schedule failing at open with the file tools, and this record is closed with the document text in Part 17 §9 and `tests/preview/README.md` restated accordingly.

**Multi-machine posture:** machine-local; each machine's tool executor carries the same residual until its own harness user is provisioned.
