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

**Rule — the preview runs ordinary scoped tools through the reused harness under its demonstrated
boundary.** Rules 1, 4, 41, 60, 68, 75, 84, 89, 100, 113, 114 and 116, and the purpose's rules on
safeguards, nothing outward by default, consequential effects and irreversible acts; **checks:**
`tests/assembly/production-provider-tools.test.ts`, `tests/preview/tool-admission.test.ts`,
`tests/preview/effect-doorway.test.ts`, `tests/preview/tool-turn.test.ts`, `tests/preview/tool-turn-replay.test.ts` and the gated live run
`tests/integration/tool-turn-live.test.ts`. The preview may run an answer or a scheduled work step as
one Claude Code invocation that has exactly Read, Write, Edit, Glob, Grep and Bash, through the
existing provider path. Each tool's scope, finite resource bounds and durable cause are enforced
before dispatch. A mandatory deny-by-default PreToolUse admission hook admits only file operations
physically contained in the turn's new private workspace and sandboxed commands; it never judges a
command by the words it contains, and admits ordinary in-workspace work without a doorway call. It sends
every tool that could make a consequential effect (an MCP or web tool, an unsandboxed command) to the
effect doorway, which admits or refuses it by the purpose's four consequential-effect tests under Part
Twelve's live-path tool rule. The harness sandbox is where a command's reach is enforced: reads are refused from the
filesystem root down except the turn's scratch volume and the system files commands need to run;
writes reach only that volume; there is no network, no unix socket and no signal to another process.
The workspace and every temporary file of the shell and the harness live on that fixed-size volume, so a
turn's whole storage is finite and cannot consume the journal's disk. The per-step tool-call count is
allocated atomically, so overlapping calls cannot exceed it. The launch has a clean environment; the
harness's own messaging socket and token are removed from every command; and no subagent, workflow,
web, MCP, scheduling or messaging tool exists. Neither `--bare` nor `--safe-mode` is used, because
both skip settings hooks, and managed policy that could disable hooks refuses the turn. Arbitrary-code
execution is admitted only inside this demonstrated boundary of hook, sandbox and clean environment
together, which prevents access to secrets, safeguards and unadmitted effects. The boundary rests on
recorded runs of the pinned artifact in which each part was shown necessary; it is not this part's
governed confinement and is never reported as governed or protected. A separate operating-system
identity is one other implementation of such a boundary, not its definition. A tool turn's whole
liability, its model-turn bound, is reserved against the operator's call cap before dispatch and
retained; its tool-call count, turn bound, timeout and the resource owner's process, memory and CPU
ceilings are finite; the harness budget flag is only a backstop, one turn's margin below its ceiling,
because the harness checks it after a turn. Tool results and current journal context ground the turn,
every tool call and result is journaled, and the final answer returns through the existing reply
review and send paths. Ordinary standing-covered work requires no repeated human approval. Review and
summary calls keep their text-only policy. A preview label grants no exception to these floors.

**Rule — a tool grant names its scope and is withdrawn by the same record.** Rules 4, 60 and 82, and
the purpose's rules on nothing outward by default and irreversible acts; **checks:**
`tests/preview/tool-turn.test.ts` (stop by process group) and the gated live stop case. The grant is a
reviewed activation record bound to the tool policy's digest and resolved from the trial's sealed
authority. It names the capabilities (the tool list), the scope (one fresh workspace per turn), the
custodian and the recovery obligation. It does not replace exact operation admission or change the
installed durability profile. Withdrawal, by changing or removing the record, prevents further tool
dispatch; it, the operator's stop and expiry end a live turn within the declared cancellation bound:
the stop is observed within 25 milliseconds, the launch's own process group is killed by its exact
process id, and quiescence is verified within two seconds. Credential-bearing accounts and
consequential effects remain behind admitted adapters. No harness session persists; each workspace
is machine-local scratch, never shared or resumed, and the journal is the sole durable copy of
accepted work.

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
