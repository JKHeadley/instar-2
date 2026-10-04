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
`tests/preview/effect-doorway.test.ts`, `tests/preview/tool-turn.test.ts`, `tests/preview/tool-turn-replay.test.ts`,
`tests/preview/egress-proxy.test.ts`, `tests/preview/tools-default.test.ts`, `tests/preview/tool-persist.test.ts`,
`tests/integration/resource-owner.test.ts` and the gated live runs
`tests/integration/tool-turn-live.test.ts`, `tests/integration/tool-turn-full-live.test.ts` and
`tests/integration/tool-turn-persist-live.test.ts`.
The preview may run an answer or a scheduled work step as one Claude Code invocation, through the
existing provider path, with the pinned harness's whole built-in tool set, plus the MCP servers the
root's own configuration names. No tool is left out to hold a safeguard: each tool's scope, finite
resource bounds and durable cause are enforced per call before dispatch. A mandatory PreToolUse
admission hook decides every call, and fails closed on any error. It admits ordinary work: file operations physically contained in the
conversation's private workspace, workspace search, sandboxed commands (never judged by the words they
contain), a web read (WebFetch issues only a GET) of a host whose every resolved address is public,
a web search, an MCP tool the root's configuration lists as a read, the harness's own bookkeeping, a
worktree inside the workspace, and a subagent of the one registered type, started by the turn or by
another subagent, within the turn's one reserved subagent budget. It sends every effect that could be
consequential to the effect doorway, which admits or refuses it by the purpose's four
consequential-effect tests under Part Twelve's live-path tool rule: an MCP tool not listed as a read (acting in a third-party account), an unsandboxed command,
a monitor command (not shown to run inside the sandbox), a send outside the conversation, a scheduled
or remote trigger, a design sync to a third-party account. A web read or listed MCP read whose effect or target the
operator's effect policy registers or marks policy-sensitive goes to the doorway as well. It refuses for budget a tool that may start
agents whose number or model turns the turn cannot reserve before dispatch (a workflow script, a
skill that may fork). A web read of a loopback, private, link-local or local-name target is refused,
because it reaches this machine and its network rather than the world. A tool the adapter has not
classified is refused. The harness sandbox is where a command's reach is enforced: reads
are refused from the filesystem root down except the conversation's volume and the system files
commands need to run; writes reach only that volume; no unix socket and no signal to another process.
A command reaches the network only through the turn's egress checkpoint, a proxy the runner starts on
a loopback port for the turn and stops with it, so the shell keeps its network reads while the
floor is held at the checkpoint. The checkpoint intercepts HTTPS with the
turn's own trust root, whose key lies in the admission state and whose certificate only the turn's
shell trusts, so it sees each request's method and path. It resolves each host itself, admits a read
(a GET or HEAD, or a git fetch) only when every resolved address is public, and connects to the
address it checked. It sends every other request (any other method, a git push from its discovery
request on, a package publish) to the effect doorway's four tests as a network write on its host, and
a read of a host the operator's effect policy names to the doorway as a web read of it is sent. A loopback, private,
link-local or shared-address host is refused before any connection, the proxy adds no credential,
upstream certificates are verified, and every decision is appended to the admission state before the
request goes anywhere and journaled with the turn's trace. The bytes through it, its connections, its
requests and each connection's idle time are bounded, and a command that bypasses the proxy reaches
nothing. The shell's home directory is new each turn. The workspace and every temporary file
of the shell and the harness live on that fixed-size volume, so a conversation's whole storage is
finite and cannot consume the journal's disk. The per-step tool-call count, shared by the turn and its subagents,
is allocated atomically, so overlapping calls cannot exceed it. The launch has a clean environment;
the harness's own messaging socket and token are removed from every command; an MCP server's launch
configuration, with any credential it carries, lies in the turn's admission state, which no tool can
read; and a workflow, scheduling, remote-trigger, monitor or messaging call is decided by the hook as
above. Neither
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
A doorway whose harness has no model-call limit of its own (the Codex tool turn) runs the same hook
through the host's admission checkpoint instead (Part fifteen §5 in docs/19-scheduled-work): every
model call of the turn and its subagents takes the turn's one reserved allowance there, so no separate
subagent budget is reserved; a delegation is first recorded as a durable child edge; every command runs
under the turn's own confined sandbox profile, with no network and so no egress checkpoint; and a
consequential tool passes the checkpoint's effect owner, which admits only an operation the installed
profile registers exactly. That owner consults no effect-policy grant, so on this route an operator
grant does not admit a consequential tool, and each refuses by default. The web-read host rule above
holds on this route too. A turn without the checkpoint never sends a call to it.

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
session grounded from the journal, and the workspace's files are unaffected. A new session removes
every earlier session file of the conversation's own projects directory, so a session whose record was
lost is never stranded outside these bounds. The workspace is a consumer of the journal's facts too:
before any tool of a turn runs, every clause the journal has forgotten or corrected since the volume
last completed a pass over its memory is removed from the workspace's prose notes (plain-text and
Markdown files, where a removal leaves a valid file), and a file without one is left untouched. Any
other file holding one (unreadable, unwritable, or structured, such as JSON, code or an archive whose
structure a removal would break) is kept intact and named in a note in the workspace, and that note is
delivered in the turn's own input, so the agent rewrites the file with its own tools; the pass is
bounded, a large workspace is covered over several turns, and a file held by an earlier part of a walk
stays named until a whole walk completes. The forget counts as reconciled only when a whole walk leaves
no file holding the clause; until then every turn repeats the check and the operator's status shows it
unfinished.
A workspace the journal shows earlier turns in that comes back empty and unmarked is a lost volume, not
a first allocation: the turn never resumes a session against it, records the loss (the operator's
status shows it) and leaves a note in the replacement saying the earlier files are gone. Workspace, session
record and transcript (in the login profile's projects directory) are machine-local; on another
machine a conversation starts a new workspace and session from the journal, and nothing resumes
across machines. The pinned harness counts the reported cost of a resumed session cumulatively, so
its budget backstop can end a long session's turn early; the upstream call reservation remains the
binding bound. The preview's session driver runs Claude Code only: the Codex cell is unsupported
until its thread continuation is shown to meet this rule under its own conformance.

**Rule — the native harness runs the same tool turn with Instar's own loop.** Rules 2, 30, 41, 55, 58,
60, 75, 113 and 115, and the purpose's rules on nothing outward by default, consequential effects and
irreversible acts; **checks:** `tests/preview/native-loop.test.ts`, `tests/preview/native-loop-replay.test.ts`,
`tests/preview/native-harness-contract.test.ts` and the gated live run `tests/integration/native-loop-live.test.ts`.
Instar may run a tool turn without any vendor agent harness. Each step is one text-only model call through
a registered doorway under the native framing, whose policy differs from every other framing only in its
system prompt, so its digest is its own and only an activation record and grant naming it admit it. The
model proposes tool calls as its answer, and Instar runs the loop: it admits each proposed call through the
same admission hook, call slots and record as a harness tool turn, and runs the admitted calls inside the
same per-turn scratch volume and workspace. Every admitted call except a web fetch runs as a separate worker
process under a sandbox built from the same read list as the harness sandbox, reaching no network but the
turn's own egress checkpoint (so its shell's network requests are decided there exactly as a harness shell's
are), with no unix socket and no signal outside the sandbox, so the kernel checks each file open when it happens: a path the hook
admitted that later becomes a link out of the volume is refused, and a blocking open blocks only the worker.
Each worker is launched through the host resource owner, which holds its CPU time and handles, the user ID's
process headroom, and the tree's memory and process count against their ceilings, and ends it on its deadline
or the stop. Its membership covers the identity no descendant can leave: besides recorded incarnation, group,
ancestry and the scratch volume, the owner asks the kernel, from outside the workload, which processes are in
the worker's sandbox instance, so a descendant that takes a new session, loses its parent and changes directory
out of the volume is still counted against the ceilings and ended by the stop and the cleanup. Nothing inside
the sandbox takes part in settlement or cleanup, and no file the workload can write is read on that path. Each
call carries the owner's containment evidence (its cleanup verdict and the membership it was proven under) into
the native result, which lists every launch whose end was not proven. A web fetch the hook admitted runs in the loop's process, ends on its deadline or
the stop, and reads at most its byte limit before cancelling the body. A tool the hook admits but the loop has
no executor for is answered with an error result and runs nothing. Every call, its
decision and its result return to the next step as quoted data. The loop is the tool turn's own invocation, so
the whole-liability reservation, the step bound equal to that reservation, the journaled trace and the
consistency check are unchanged, and each step is a recorded model call. The loop ends on the model's answer,
the step bound, a failed step or the stop; the stop ends every process of a running call's sandbox, and a call
admitted while the stop was latched is recorded as stopped and never run. A
proposal the hook cannot decide is refused. The loop is a client of the public ports and holds no authority
of its own. The preview launcher offers a native turn only under an activation and grant naming the native
policy's digest.

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

**Rule — the registered Codex model doorway answers only a tool-free completed turn, on a
subscription.** Rules 26, 30, 41, 56, 75 and 115; **checks: P13-NF-08/16/45** and
`tests/assembly/production-codex-provider.test.ts`. The doorway is selected by its registered id
(`codex-cli-subscription`); its parser, its invocation policy, its model shape and its activation
check live in the adapter module that owns the harness, and the registry carries exactly one entry
per id. An answer turn is admitted only when all of the following hold on the exact recorded
output: the terminal event is `turn.completed`; the stream carries one non-empty agent message
within the declared output bound; the turn's reported output tokens are within the policy ceiling;
every completed item is an agent message or reasoning; and no line of the stream was unreadable.
Because the harness always has a shell, a tool-free answer cannot be a launch flag: a completed
turn that ran a command, applied a patch or called a tool is refused rather than answered from a
run its answer does not account for. A `turn.failed` event is the provider's own reason and is
recorded as a refusal with that reason; a stream with no terminal event, an unreadable line, or a
contradiction between the stream and the process exit is retained as uncertain and never retried
here. The invocation passes no API key and sets none, and the environment it passes is closed to
everything except the path, the home and the login home.

**Rule — which sign-in a Codex login home holds is observed, not inferred from an exit code.**
Rules 26, 56, 75 and 103; **checks: P13-NF-16/23** and the same adapter case. `codex login status`
exits zero for a subscription sign-in AND for an API-key sign-in, and states which only on standard
error, which the host's bounded transport does not capture. The route therefore reads the exit code
only as evidence that some sign-in exists, and takes the KIND from a narrow host observation of the
login home that returns the sign-in class and never any token, key or account value. Anything but
the subscription class — an API key, no login, or an observation this host cannot make — refuses
the route, at construction and again at every call. WHICH account is signed in is not observable
from this harness at all: the account on the activation record is the operator's assertion, the
route's source strength is an attestation, and no surface may present it as an observed account.
The configuration digest the profile inspection returns is a change detector over the host's
reviewed policy state, not an observation of this harness's own managed policy, which stays
unobserved and is declared as an accepted residual.

**Rule — a session harness's startup menu is the operator's, and is removed at setup rather than
answered.** Rules 59, 103 and 115; **checks: P13-NF-16** and
`tests/e2e/session-work-live.test.ts`. A Codex session launched in a directory its login home does
not already trust shows a directory-trust menu before its prompt. The session driver classifies a
startup menu and refuses the launch rather than choosing for the operator, so this is an enumerated
silent-stop class with a setup remedy, not a runtime decision: the host declares its own scratch
work scope trusted in the session's login home when it creates it. No adapter may answer a startup
menu on the operator's behalf.

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
