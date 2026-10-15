# Change review — recover failed protocol launches and retain uncertain process identity

Subject base: 3eae75c4ade1b48a69f25c39ce339185f4f96555
Review state: open
Reviewed content: none
Outcome: Recover the common host after failed protocol initialization/start/resume, and refuse false closure or capacity release when process identity inspection is unavailable.
Affected rules: Rules 1, 4, 5, 26, 30, 32, 34, 36, 37, 42, 49, 59, 60, 63, 68, 70, 74, 95, 101, 102, 105, 111, 113, 115, 116; D17 section 2.
Affected floors: secrets — existing account custody unchanged; spend cap — existing model checkpoint and cumulative host reservation retained; stop — failed inspection cannot become confirmed closure; no duplicate sends — no retry/replay added; durable intake — common host retains queue and dispatch intent.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Exact process retirement and host lease recovery require positive and negative lifecycle evidence; targeted real process tests and recorded replay cover the changed boundaries.
Side effects: Unavailable process inspection now rejects launch capacity checks and reconstructed stop confirmation while retaining evidence. The asynchronous failure timer retains inspection uncertainty instead of raising an uncaught exception. No capabilities or supported declarations are removed. Native self-host conformance remains byte-stale for the desk to renew under charter item 7.
Undo and recovery: Revert the repair commit if necessary; keep process rows and uncertain inputs. Restore inspection and use the existing exact claim/incarnation close checkpoint; do not replay uncertain input.
Multi-machine posture: Physical process handles, start stamps and captures remain deliberately machine-local; the common conversation host still fences ownership and retains replicated durable intake. No cross-machine authority changes.
Layer below: Read common host retire/replace, admission close and resource lease release in production-conversation-session.ts; inspected physical transport lifecycle and correlated recorded reply path. The tests invoke the real host with the repaired adapter and real local pipes with reconstructed transport.
Bug class: integration
Bug evidence: reproducer=tests/harness-adapters/codex-conversation-worker.test.ts; reproducer=tests/harness-adapters/session-protocol-io.test.ts
Hook bypass: none; core.hooksPath unset and shared hook directory checked, samples only.
Convergence: none
Decision: codex-harness-1014-repair-cleanup | Clear connection/reader after confirmed failed-launch close so the host can retire its claim and lease. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/codex-harness-1014-repair-PROGRESS.md
Decision: codex-harness-1014-repair-observation | Retain failed/empty process inspection as uncertainty unless signal zero positively proves absence; observed different stamps are reused identities. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/codex-harness-1014-repair-PROGRESS.md
Decision: codex-harness-1014-repair-certificate | Apply the charter item 7 native certificate exception; preserve declarations for actual desk conformance renewal. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/codex-harness-1014-repair-PROGRESS.md

Subject (5 paths): scripts/session-protocol-io.mjs, src/harness-adapters/codex-conversation-worker.md, src/harness-adapters/codex-conversation-worker.ts, tests/harness-adapters/codex-conversation-worker.test.ts, tests/harness-adapters/session-protocol-io.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: clear failed-launch local handles only after confirmed close and preserve unavailable process identity as uncertainty at the existing observation boundary. No retry queue, replay, new authority or capability reduction. Start identity, resource capacity and exact-close guards stay in their existing owners. Targeted host/real-process tests are repair evidence, not unattended production conformance.
80/20: 21 tests in the two touched files and tsc pass using lockfile dependencies; run cheap final gates. Full suites and actual native certificate renewal belong to the Studio desk; no independent convergence claim.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
