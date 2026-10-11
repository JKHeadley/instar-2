**Status: draft, awaiting approval. Governed.**

# Part thirteen — the session harness adapters

**Value — purpose.** A Claude Code or Codex process should be a replaceable worker for durable
work, not the place where work becomes true. This part specifies the adapter packages that let
those real harnesses launch, receive admitted input, continue after a cut, expose honest evidence,
and stop without escaping the same authority, effect, verification, and recovery doors used by
every other worker. It also fixes the shape that Gemini, Grok, and later runtimes must satisfy.
No automatic check decides whether the supported modes are useful enough or whether their
confinement cost is acceptable; the operator retains those judgments.

**Rule — reading convention and evidence discipline.** Rules 26, 49, 69, 91, 96, 110 and 115;
**checks: P13-NF-01/02** and `node scripts/check-governed-docs.mjs docs`. Every paragraph, list,
and table belongs to its enclosing Rule or Value block. This part defines no new core type. A
contract check is a required future execution, not evidence that an implementation exists or ran.
Consumers re-resolve claims against current signed history. A holder is live only after fresh
running proof. Measured means recorded execution on named hardware and workload, never a target,
estimate, configured value, or successful-only sample. An **exact adapter tuple** is the complete
`(harness adapter package and artifact digest, registered model doorway and route, platform,
capability mode)` subject; no member may borrow another member's check result. A **runtime pin** is
an exact owner-resolved runtime selection bound to its source generation and validity horizon, not
a configuration hint or caller string. **Quiescence** is current owner-accepted evidence that the
original accepted attempt and every queued destination action can no longer execute; quiet output,
an absent worker, or a stopped local process is insufficient. **Model Context Protocol (MCP)** is
named here only as one possible runtime tool transport and never as an authority source.

**Rule — every supported harness carries the agent.** The [purpose](00-the-purpose.md#the-purpose) governs the delivered identity and capability contract:

**Rule — every agent has these by default, and can tell you about itself.** Identity, self-knowledge, reflection and the means to evolve are part of every Instar agent, not an option chosen at setup. An Instar agent can tell the person it works with what it is, what Instar is, why it is different, and what it can do, in everyday words, without naming the harness or model it runs on. **Check:** a fresh installation, asked these questions in plain conversation, answers them accurately and in the person's language. The answers are compared with its actual abilities at that moment.

**Rule — a limit names the rule that requires it.** An Instar agent ships able to do everything its role calls for. Any limit on what it can do names the statement in this document or the rule that requires it. A limit with no such source is a defect, and it is removed. **Check:** every refusal path and every switched-off capability in a part design cites its source. The review desk refuses convergence on a limit that cites none.

P13-NF-14/16/17/18/23 must include these identity and capability facts at start, resume and compaction. P13-NF-43/44/45/47/48 include a real conversation in the person's language: the agent accurately explains itself and its available abilities, uses an available tool to resolve an unknown with a source, and acts inside its recorded role without another prompt except for the purpose's sign-off list. Missing identity, a guessed capability, an unattempted lookup or an unsupported refusal fails that evidence. Technical conformance alone does not establish acceptance under purpose constraint 6.

---

## Sections

This document is split into one file per section so each renders on GitHub and can take line comments. The files below, read in order, are the complete document.

1. [Ownership and boundaries](17-harness-adapters/01-ownership-and-boundaries.md)
2. [One adapter family and one conformance shape](17-harness-adapters/02-one-adapter-family-and-one-conformance-shape.md)
3. [Capability, account, quota, and launch pins](17-harness-adapters/03-capability-account-quota-and-launch-pins.md)
4. [Launching a worker for durable work](17-harness-adapters/04-launching-a-worker-for-durable-work.md)
5. [Delivering live inbound and observing a turn](17-harness-adapters/05-delivering-live-inbound-and-observing-a-turn.md)
6. [Resume, continuation, and compaction](17-harness-adapters/06-resume-continuation-and-compaction.md)
7. [Honest liveness, progress, and completion](17-harness-adapters/07-honest-liveness-progress-and-completion.md)
8. [Interruption, kill, and recovery](17-harness-adapters/08-interruption-kill-and-recovery.md)
9. [Claude Code, Codex, and future runtime mappings](17-harness-adapters/09-claude-code-codex-and-future-runtime-mappings.md)
10. [What Instar 1.x does today and what carries forward](17-harness-adapters/10-what-instar-1-x-does-today-and-what-carries-forward.md)
11. [Non-functional checks and activation](17-harness-adapters/11-non-functional-checks-and-activation.md)
12. [Negative contract fixtures](17-harness-adapters/12-negative-contract-fixtures.md)
13. [Inherited duties and disposition](17-harness-adapters/13-inherited-duties-and-disposition.md)
14. [Operator decisions and honest limits](17-harness-adapters/14-operator-decisions-and-honest-limits.md)
