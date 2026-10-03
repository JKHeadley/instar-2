## 9. Claude Code, Codex, and future runtime mappings

**Rule — the mapping is concrete without granting brand exceptions.** Rules 30, 49, 59 and 115;
**checks: P13-NF-07/08/43/44/45**. The rows below are required adapter responsibilities, not claims
that a current vendor build exposes each witness. Activation records the exact supported and
unsupported cells for the tested artifact. A runtime update re-runs affected cells.

| Concern | Claude Code adapter | Codex adapter | Gemini, Grok, or later adapter |
|---|---|---|---|
| Launch | Translate the admitted launch specification into an exact Claude Code process, environment, work scope, and confinement mode; bind actual process start and Claude conversation evidence | Translate the same specification into an exact Codex process, named harness configuration, sandbox, work scope, and confinement mode; bind actual process start and Codex thread evidence | Supply the same exact translation and binding without adding a core framework literal |
| Model/runtime configuration/reasoning | Resolve the Seven route and Ten runtime-configuration references into the exact supported launch or admitted runtime-control fields; observe actual acceptance independently of configured state | Resolve those same owner-issued references into exact Codex model, named harness configuration, and reasoning controls; observe actual acceptance | Declare every pin supported or unsupported for the exact complete tuple; never approximate a tier silently. The route positive is non-executable until `seam-response-judgment.md` lands; the runtime mapping positive is non-executable until `seam-response-assembly-followup.md` lands |
| Live inbound | PTY or protocol delivery may carry bytes, but a correlated harness-origin input event and model-context witness establish acceptance and consumption | The same rule applies even when a busy composer visually retains text or Enter timing varies | Define exact transport, queue semantics, event identity, and context witness before governed activation |
| Liveness | Fresh exact-incarnation process or runtime-protocol proof | Fresh exact-incarnation process or runtime-protocol proof | Same predicate and freshness contract |
| Progress and completion | Correlated lifecycle, model, tool, and output events; no prompt/footer or final phrase authority | Correlated lifecycle, model, tool, and output events; no composer/spinner or final phrase authority | Same semantic events; unsupported if only screen scraping exists |
| Continuation | Runtime conversation continuation is supplemental; a replacement process gets a new incarnation while an in-process compaction keeps the current incarnation; both require the applicable fresh grounding and context witness | Runtime thread continuation is supplemental under the same process-lifetime distinction | Opaque handles remain evidence only; fresh grounded replacement is the safe supported fallback when continuation is absent |
| Account and quota | Prove the account at use through the approved custodian/provider source; record real readable quota windows and unknown gaps | Prove the account at use and record provider-origin quota windows with their reported lengths rather than positional assumptions | Declare observable windows, freshness, and permanent absence; no usage surface means unknown |
| Stop and recovery | Execute only admitted exact-target process/protocol operations and report quiescence limits | Execute only admitted exact-target process/protocol operations and report quiescence limits | Same registered operation and Part Six loop contract |

**Rule — Claude Code activation requires real boundary evidence.** Rules 34, 41, 47, 59 and 75;
**checks: P13-NF-16/23/35/43**. The conformance run must show actual submitted context,
correlated lifecycle and output events, model/account evidence, hidden provider and tool mediation,
and every stall row under the exact Claude Code artifact and each compatible registered model
doorway. The real provider-boundary arm is non-executable until `seam-response-judgment.md` and
`seam-response-effects-followup.md` land. The grounding-consumption arm is non-executable until
the dated 06:33Z addendum in `seam-response-rungraph-followup.md`, recorded as GRANTED in
`SEAM-LEDGER.md` row 38, lands. A hook firing proves only the event and fields it authenticates.
Missing strong context-consumption evidence may leave only a confined advisory mode. If provider
submission, built-in tools, or any other effect path cannot be confined to the public doors, the
tested mode is unsupported; advisory supplies no Claude-specific waiver.

**Rule — the preview runs the full tool set through the reused harness under its demonstrated
boundary: ordinary work runs, and every consequential effect goes to the effect doorway.** Rules 1, 4,
41, 60, 68, 75, 84, 89, 100, 113, 114 and 116, and the purpose's rules on safeguards, nothing outward by
default, consequential effects and irreversible acts; **checks:**
`tests/assembly/production-provider-tools.test.ts`, `tests/preview/tool-admission.test.ts`,
`tests/preview/tool-turn.test.ts`, `tests/preview/tool-turn-replay.test.ts`,
`tests/preview/tools-default.test.ts`, `tests/preview/tool-persist.test.ts`,
`tests/integration/resource-owner.test.ts` and the gated live runs
`tests/integration/tool-turn-live.test.ts`, `tests/integration/tool-turn-full-live.test.ts` and
`tests/integration/tool-turn-persist-live.test.ts`.
The preview may run an answer or a scheduled work step as one Claude Code invocation, through the
existing provider path, with Read, Write, Edit, Glob, Grep, Bash, WebFetch, WebSearch and Agent, plus
the MCP servers the root's own configuration names. Each tool's scope, finite resource bounds and
durable cause are enforced before dispatch. A mandatory PreToolUse admission hook decides every call,
and fails closed on any error. It admits ordinary work: file operations physically contained in the
conversation's private workspace, workspace search, sandboxed commands (never judged by the words they
contain), a web read (WebFetch issues only a GET) of a host whose every resolved address is public,
a web search, an MCP tool the root's configuration lists as a read, and a subagent of the one
registered type within the turn's reserved budget. It sends every consequential effect to the effect
doorway's admission, which refuses a tool effect the installed profile does not register: an MCP tool
not listed as a read (acting in a third-party account), an unsandboxed command, a send outside the
conversation, a scheduled or remote trigger. A web read of a loopback, private, link-local or
local-name target is refused, because it reaches this machine and its network rather than the world.
Anything unregistered is refused. The harness sandbox is where a command's reach is enforced: reads
are refused from the filesystem root down except the conversation's volume and the system files
commands need to run; writes reach only that volume; there is no network, so no command can write to
the network, no unix socket and no signal to another process. The workspace and every temporary file
of the shell and the harness live on that fixed-size volume, so a conversation's whole storage is
finite and cannot consume the journal's disk. The per-step tool-call count, shared by the turn and its subagents,
is allocated atomically, so overlapping calls cannot exceed it. The launch has a clean environment;
the harness's own messaging socket and token are removed from every command; an MCP server's launch
configuration, with any credential it carries, lies in the turn's admission state, which no tool can
read; and no workflow, agent-team, scheduling, remote-trigger or messaging tool exists. Neither
`--bare` nor `--safe-mode` is used, because both skip settings hooks, and managed policy that could
disable hooks refuses the turn. Arbitrary-code execution is admitted only inside this demonstrated
boundary of hook, sandbox and clean environment together, which prevents access to secrets,
safeguards and unadmitted effects. The boundary rests on recorded runs of the pinned artifact in
which each part was shown necessary; it is not this part's governed confinement and is never reported
as governed or protected. A separate operating-system identity is one other implementation of such a
boundary, not its definition. A tool turn's whole liability, its model-turn bound and each reserved
subagent's turn bound, is reserved against the operator's call cap before dispatch and retained; a
subagent budget is taken only from allowance beyond the turn and one further plain tool turn, so it
never costs the next answer its tools. Its tool-call count, turn bounds, timeout and the resource
owner's process, memory and CPU ceilings are finite; the harness budget flag is only a backstop, one
turn's margin below its ceiling, because the harness checks it after a turn. Tool results and current
journal context ground the turn, every tool call, result and subagent edge is journaled, and the final
answer returns through the existing reply review and send paths. Ordinary standing-covered work
requires no repeated human approval. Review and summary calls keep their text-only policy. A preview
label grants no exception to these floors.

**Rule — tools are on by default under the operator's recorded grant, which names their scope and is
withdrawn by the same record.** Rules 4, 60, 82 and 104, and the purpose's rules on nothing outward by
default and irreversible acts; **checks:** `tests/preview/tools-default.test.ts`,
`tests/preview/tool-turn.test.ts` (stop by process group), `tests/integration/resource-owner.test.ts`
and the gated live stop cases. The grant is the operator's recorded yes for the tool policy, held in
the trial's sealed authority. Under it, a root's launch derives the tools activation record from its
conversation activation, changing only the policy digest, and keeps it in the root; no further desk
step is needed, and with no resolving grant every answer is text only and status says why. A record
the desk writes may be named instead. The record names the capabilities (the tool list and the root's
MCP servers), the scope (one private workspace per conversation), the custodian and the recovery obligation. It
does not replace exact operation admission or change the installed durability profile. Tools are
refusable at launch, and withdrawn by changing or removing the record or by a change of the sealed
authority under which the grant no longer resolves; withdrawal prevents further tool dispatch, and it,
the operator's stop and expiry end a live turn and its subagents within the declared cancellation
bound: the stop is observed within 25 milliseconds, the launch's own process group is killed by its
exact process id, every cleanup census reclaims each member it finds, and quiescence is verified
within two seconds. Credential-bearing accounts and consequential effects remain behind admitted
adapters. Harness continuation is optional, subordinate to the journal, and never the sole durable
copy of accepted work (the next rule).

**Rule — a conversation keeps its workspace and, subordinate to the journal, its harness session.**
Rules 2, 7, 32, 33, 47, 58, 60, 68, 96, 110 and 113, and the full-tool ruling's MF5; **checks:**
`tests/preview/tool-persist.test.ts`, `tests/assembly/production-provider-tools.test.ts`,
`tests/preview/tool-turn.test.ts` and the gated live run
`tests/integration/tool-turn-persist-live.test.ts`. Each conversation's workspace is one fixed-size
volume (128 MB) kept under its root for the root's life and mounted, at the same place, only during
that conversation's turns, so a file the agent writes on one turn is there on the next. A root keeps
at most four such workspaces; a further conversation's turns each run in a fresh one-turn volume
without a kept session, and the journal records that overflow. A kept workspace is never deleted to
make room, and a write past its size is refused. A tool turn also runs in the conversation's kept
Claude Code session: the runner names it per turn (a new session id, or the recorded one to resume;
neither is part of the activation-bound policy) and the turn's trace records which, and why. The
session is a cache, never a record. Every turn's input is still the whole current journal packet,
and its system prompt says the current context outranks earlier turns of the session. It is resumed
only while the tools authority, the harness, the model and a digest of every journal fact it may hold
(memory corrections, forgets and undos, dated items, people, commitments and their closures,
directives, blockers, grants and authorities, the stop) equal those it was started with; any
difference starts a new session, the old transcript removed first, so a corrected or forgotten fact,
a withdrawn grant or a stop never survives in it. It is also replaced at six turns or 512 KiB of
transcript, on a compaction (the harness's own automatic compaction and its own memory are off), when
its transcript or record is missing or unreadable, and after a turn that never settled; it ends, its
transcript removed at once, when a turn is stopped, withdrawn or fails, or runs a tool without its
admission record. A loss is detected before dispatch and survived: the next turn starts a new
session grounded from the journal, and the workspace's files are unaffected. Workspace, session
record and transcript (in the login profile's projects directory) are machine-local; on another
machine a conversation starts a new workspace and session from the journal, and nothing resumes
across machines. The pinned harness counts the reported cost of a resumed session cumulatively, so
its budget backstop can end a long session's turn early; the upstream call reservation remains the
binding bound. The preview's session driver runs Claude Code only: the Codex cell is unsupported
until its thread continuation is shown to meet this rule under its own conformance.

**Rule — Codex activation has the identical bar.** Rules 34, 41, 47, 59 and 75; **checks:
P13-NF-16/23/35/44**. The conformance run must show actual submitted context, correlated lifecycle
and output events, model/runtime-configuration/reasoning and account evidence, sandbox and hidden path
confinement, and every stall row under the exact Codex artifact and each compatible registered
model doorway. The real provider-boundary arm is non-executable until
`seam-response-judgment.md` and `seam-response-effects-followup.md` land. The grounding-consumption
arm is non-executable until the dated 06:33Z addendum in `seam-response-rungraph-followup.md`,
recorded as GRANTED in `SEAM-LEDGER.md` row 38, lands. A rollout file, composer state,
or terminal render is accepted only for the precise observation its authenticated structure and
subject binding prove. Missing strong consumption or completion evidence keeps those capabilities
unsupported.

**Rule — a future adapter arrives through declarations and evidence.** Rules 30, 44, 49 and 115;
**checks: P13-NF-08/45**. The builder adds a registered package, exact assembly binding,
`AdapterEvidenceContract`, tuple-specific conformance record, stall matrix, and the shared suite's
captured/live evidence. No core switch statement, copied run state, new standing vocabulary,
unregistered provenance string, or generic “command-line-interface-compatible” assertion is permitted. An adapter may
support fewer modes than Claude Code or Codex and remain honest; it may not report parity for a
case it cannot witness.

**Rule — landed history coverage limits every harness equally.** Rules 47, 49, 68 and 110;
**checks: P13-NF-25/43/44/45/49/50**. On this HEAD, Five accepts only one conversation lineage and
full captured messages no longer than its configured threshold. Claude Code, Codex, and future
adapter mappings therefore cannot activate a continuation or live mode whose honest grounding
requires ordering across machine lineages or summaries above that threshold. Those arms remain
unsupported and non-executable until the dated 09:10Z addendum in
`seam-response-rungraph-followup.md`, recorded as GRANTED in `SEAM-LEDGER.md` row 52, lands.
Passing all other **LIVE-PREREQUISITES** does not
waive this gate.

---
