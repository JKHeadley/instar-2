# File-tool swap race between admission and open (secrets floor)

**Status:** CLOSED AT SOURCE for every file the tool runner writes. OPEN for plaintext secrets that the harness's operating-system user can read but this runner did not write (listed below). The closing path for those is the harness as a separate OS user, an operator infrastructure step.

**Owner:** Echo (agent), as owner of the preview trial's tool admission. The open part needs an operator decision.

**The class:** the in-process file tools (Read, Write, Edit, Glob, Grep) are admitted by the PreToolUse hook (`tests/preview/tool-admission.mjs`), which decides on the realpath of the presented path and hands that resolved path to the harness. The check happens at admission, not at open. If a component of that path is replaced by a symlink between the hook's allow and the harness's open, the harness follows it. Only the agent writes into the conversation's volume, so such a swap would have to be made by the agent itself, concurrently with its own file-tool call. Review MF2 of unit w4-toolpaths confirmed the class with synthetic canaries. Sandboxed commands (Bash) are not affected: the kernel decides at open under the settings-derived Seatbelt profile (`tests/preview/tool-paths.test.ts`).

**Why the floor is closed at the source, not at the path:** Claude Code sandboxes only Bash, and macOS refuses a sandbox nested inside one, so the file tools cannot be put under the kernel profile without losing the Bash sandbox. Replacing them with a sandboxed file server would reduce the agent's ability (images, PDFs, notebooks, Edit's read state). So the floor rests on what is on disk: a path the race reaches can yield only ciphertext or a file that holds no secret value.

## Inventory: what the tool runner writes, and where secret values live

| Store | Written at | What it holds |
|---|---|---|
| Journal `ROOT/journal.encrypted` (messages, their raw captures, summaries, memory) | `tests/preview/journal.ts:1637` (`frame`) | AES-256-GCM ciphertext under the storage key |
| Vault `ROOT/vault/*.sealed` (credentials handed over in chat, the original bytes of their messages) | `tests/preview/secret-custody.ts:98` (`seal`), written at `:114` | AES-256-GCM ciphertext under the storage key |
| Credentials registry `ROOT/credentials.json` | `tests/preview/secret-custody.ts:96` | names, kinds, expiry and reminder schedule; no value |
| Turn hook config `ROOT/tool-turns/*/state/config.json` | `tests/preview/tool-turn.mjs:103` | paths, limits, effect policy; no secret |
| Turn MCP launch config `ROOT/tool-turns/*/state/mcp.json` | `tests/preview/tool-turn.mjs:109` | commands and arguments only. **Fixed here:** it used to copy each server's `env` block, credentials included, in plaintext. `readRootMcp` now refuses an `env` block (or any key besides `command` and `args`) and a recognised credential in a command or argument; a server that needs a credential reads it from its own custody |
| Hook admission record `ROOT/tool-turns/*/state/admission.jsonl` | `tests/preview/tool-admission-hook.mjs:24` | tool calls and results of the turn; the agent's context carries a credential only as a SecretRef marker, never its value |
| Telegram identity capture `ROOT/.telegram-sealed/*.capture` | moved into encrypted custody and removed, `scripts/production-boot-io.mjs:109` | the bot's identity response, not its token |
| Harness login | macOS login keychain item `Claude Code-credentials-<hash>`, written by Claude Code itself | keychain ciphertext; the profile's `config/.claude.json` holds account metadata only. The token is the harness's own credential and is necessarily usable by the harness process |
| Harness transcripts `config/projects/*.jsonl` | Claude Code | the prepared packet (credentials as SecretRef markers) and tool input and output |

**The keys:** the storage key, the bot token and the other runner secrets are bound into the runner's environment by the launch script, read from the operator agent's encrypted vault. The harness's environment is built explicitly from a fixed list (`src/assembly/production-provider.ts:493`) and passed unchanged by the resource owner (`scripts/resource-owner.mjs:575`), and its arguments carry policy, settings and paths only. No file the runner writes holds a key. The pinned 2.1.280 harness's shell profile allows process inspection only within its own sandbox (from the artifact's profile text).

**Evidence:**

- `tests/preview/secret-at-rest.test.ts` drives a root through a credential handed over in chat (with and without custody) and a tool turn with MCP servers, then reads every byte under the root: neither credential nor the storage key (hex or base64) appears. The same sweep finds a value placed in plaintext by hand. With `readRootMcp` reverted, the test fails.
- A read-only scan on the Studio (2026-10-03) compared the 55 values in the operator agent's vault (each at least 12 characters; values held in memory, only paths and names printed) against every file in all 267 preview roots and the harness login profile (256,159 files). None holds a value; the only matches were the bot's public username.

## Open: plaintext secrets this runner did not write

The harness runs as the same OS user as the operator's other agents, so a path the race reaches could still yield these. Each was found on the Studio on 2026-10-03 by name and pattern only. No value was read out, and none was changed.

- The Instar 1.x agent configurations `~/.instar/agents/echo/.instar/config.json` (a Telegram bot token, mode 0644) and `~/.instar/agents/groky/.instar/config.json` (two Telegram bot tokens, mode 0644).
- An SSH private key `~/.ssh/id_groky_move` (mode 0600).
- Values left in `/private/tmp` by other sessions: a session scratchpad under `/private/tmp/claude-501/` (the operator agent's API token, a Telegram bot token, a one-time-code seed), `/private/tmp/ds-tail.jsonl` and `/private/tmp/drain_auth.txt` (the operator agent's API token).
- The older stage-1 and stage-2 runner (`tests/preview/agent.mjs`) keeps its captures in plaintext fixture stores (`tests/preview/composition.ts:452`, declared simulated custody) with no intake custody. It runs no tool turn, and the scan found no secret value in its roots, but a credential typed to it would be stored in plaintext in a root beside the tool runner's.

These cannot be closed by the tool runner's code. Two closing paths, both the operator's: (1) the harness runs as a dedicated OS user that owns only its login profile and the turn state, so none of these is readable to it at open (kernel-enforced, no window); or (2) each owner moves its value out of plaintext (the 1.x tokens into the 1.x vault, the SSH key behind a passphrase or the keychain, the temporary files removed, the stage-1/2 roots retired). Option 1 closes the class, including files written later.

**Multi-machine posture:** machine-local. Each machine's tool runner writes the same encrypted stores. The open list is per machine and must be taken on each machine.
