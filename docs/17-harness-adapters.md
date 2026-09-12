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
