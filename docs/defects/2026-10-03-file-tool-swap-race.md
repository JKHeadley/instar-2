# File-tool race between admission and open (secrets floor)

**Status:** OPEN. Pre-existing on the live line: live L44 has this race and more (the path spellings this unit repairs). Not introduced by unit w4-toolpaths, and not closed by it. It can be closed only by running the harness as its own operating-system user, an operator infrastructure step that needs the administrator password, which the agent never uses (P-01). No code in the tool runner can close it.

**Owner:** Echo (agent), as owner of the preview trial's tool admission. The closing step is the operator's.

**The class:** the in-process file tools (Read, Write, Edit, Glob, Grep) are admitted by the PreToolUse hook (`tests/preview/tool-admission.mjs`), which decides on the realpath of the presented path and hands that resolved path to the harness. The decision happens at admission, not at open. If the filesystem on that resolved path changes between the hook's allow and the harness's open, the harness opens whatever is there then, which can lie outside the workspace. Review MF2 of unit w4-toolpaths and its round-2 review confirmed the class for both Read and Write with synthetic canaries. Only the agent writes into the conversation's volume, so such a change would have to be made by the agent itself, concurrently with its own file-tool call.

**What the race can reach:** anything the harness's operating-system user can read or write. For reads, that includes plaintext secrets other owners keep under the same user (listed below). For writes, it includes the integrity of protected state: the journal, the admission state and policy, and durable intake. Encryption at rest protects confidentiality of the runner's own stores, not their integrity against a write.

**What holds:**

- **Sandboxed commands (Bash):** the kernel decides at open under the settings-derived Seatbelt profile, so no symlink, alias, `..` or changed spelling reaches past the boundary (`tests/preview/tool-paths.test.ts`).
- **File tools, before open:** every spelling the agent presents is decided on its realpath at admission, including `..` after an absent directory and dangling links. This is an early refusal, not a boundary at open.
- **This runner's own writers** (hygiene, not a closure of the race): the journal and the custody vault are AES-256-GCM ciphertext under the storage key, which lives only in the runner's environment. An MCP server's credential is given in the root's `mcp.json` as `{"secretRef": "<name>"}`; the runner opens it from custody at the turn and hands it once, over a private socket, to that server's launcher (`tests/preview/mcp-launch.mjs`), so the launch configuration holds no value. A credential written literally there is refused. The turn's admission record is scrubbed when the turn ends (each served value replaced by its SecretRef marker, recognised credentials redacted); while the turn runs it can hold a credential a tool result carried. `tests/preview/secret-at-rest.test.ts` checks that no file under a driven root holds a credential or the storage key after the turn.

**Why not a code fix:** Claude Code sandboxes only Bash, and macOS refuses a sandbox nested inside one (`sandbox_apply: Operation not permitted`), so the file tools cannot be put under the kernel profile without losing the Bash sandbox. Replacing the built-in file tools with a sandboxed file server would reduce the agent's ability (images, PDFs, notebooks, Edit's read state), which the purpose forbids when a checkpoint can enforce the safeguard instead. No macOS mount option refuses symlinks on the scratch volume.

## Plaintext secrets readable by the harness's OS user that this runner did not write

Found on the Studio on 2026-10-03 by name and pattern only. No value was read out, and none was changed.

- The Instar 1.x agent configurations under `~/.instar/agents/*/.instar/config.json` (Telegram bot tokens).
- An SSH private key under `~/.ssh/`.
- Files left in `/private/tmp` by other sessions holding the operator agent's API token and other credentials.
- The older stage-1 and stage-2 runner (`tests/preview/agent.mjs`) keeps its captures in plaintext fixture stores (`tests/preview/composition.ts`, declared simulated custody); a credential typed to it would be stored in plaintext.

## Closure

The operator provisions a dedicated OS user for the harness, owning only its login profile and the turn state, with the roots, the runner's material and other owners' files unreadable and unwritable to it (effective permissions checked, not just an account created). The preview then launches the harness as that user; a test shows a protected read and a protected write refused at open by the file tools, with an ordinary workspace file still readable and writable; and this record is closed, with Part 17 §9 and `tests/preview/README.md` restated. Separately, each owner of a listed plaintext secret can move it out of plaintext; that narrows what the race reaches but does not close it.

**Multi-machine posture:** machine-local; each machine's tool runner carries the same open race until its own harness user is provisioned.
