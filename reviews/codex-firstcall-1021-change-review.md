# Change review — preserve first calls across concurrent evidence appends

Subject base: 588332d9d0839cd504bee2819e297cd6222a2ef9
Review state: open
Reviewed content: none
Outcome: An unrelated operator-log append during a tool-authority read no longer cancels a started answer when a second complete snapshot is stable. Persistent changes and invalid evidence still withdraw authority.
Affected rules: Rules 1, 24, 28, 30, 34, 35, 36, 41, 49, 55, 60, 70, 74, 75, 94, 98, 101, 104, 111, 113, 116.
Affected floors: secrets — existing custody and isolated test login; spend cap — no model retry or additional reservation; stop — explicit stop, withdrawal, revocation and unreadable evidence still refuse; no duplicate sends — no change to dispatch or replay; durable intake — existing journal retains every attempt.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: This small change affects the live authority check that can stop an executing tool turn. Stable replacement, revoked and malformed evidence need negative neighbors as well as real first-call proof.
Side effects: A moving evidence snapshot can cause one additional read of all three owner files. A second moving snapshot returns null, and parse/read errors still refuse. The cache holds parsed evidence only; every check revalidates the sealed grant and time. Reading the sealed authority after the snapshot prevents a reread from masking a concurrent revocation.
Undo and recovery: Revert this commit. No stored format, profile, activation, prompt or model-output change. The former false cancellations would return; their durable uncertain calls must not be replayed automatically. Proof roots and captures remain in the desk lane.
Multi-machine posture: The consistency read is deliberately host-local to the messaging owner's files. Each runner performs its own bounded read and fresh authority resolution. Conversation ownership, replication, leases and send uniqueness are unchanged.
Layer below: Read both constitutional documents; inspected the authenticated-message resolver, sealed grant and revocation checks, cache identities, physical stop callback, call diagnostics, and original encrypted proof journals. Inspected 1.x openai-codex/transport/codexSpawn.ts and SessionManager.ts readiness handling: explicit stdin EOF and bounded settlement already exist in 2.0; interactive readiness and pre-injection resume recovery do not apply to a headless call that already emitted turn.started.
Bug class: integration
Bug evidence: reproducer=tests/preview/operator-records-cache.test.ts; live evidence=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/codex-firstcall-1021-PROGRESS.md
Hook bypass: none; core.hooksPath unset; inspected shared hooks directory contains sample hooks only.
Convergence: none
Decision: codex-firstcall-snapshot | Retry only the inconsistent evidence read once; never retry the already-started uncertain model call. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/codex-firstcall-1021-PROGRESS.md
Decision: codex-firstcall-revocation | Read the sealed authority after the evidence snapshot so a revocation arriving during either read wins. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/codex-firstcall-1021-PROGRESS.md
Prompt review: No model prompt, output parser, judgment threshold or expected-answer phrase changes. The new branch compares filesystem identities. The regression injects an unrelated append, and its negative neighbors change actual evidence or revoke the grant.

Subject (10 paths): tests/preview/README.md, tests/preview/journal-agent.mjs, tests/preview/operator-records-cache.test.ts, generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json

Validation: 38 targeted tests passed, including the real launcher stop/resume and malformed-output neighbors. Three fresh Telegram roots answered their first question on the first model call: updates 367052805, 367052806 and 367052807. Register regenerated in replay mode from source commit 651fa355addb9111102c368d995da027ddf3c577; it grants no runtime authority.
Composition maintenance: train-119 only reorders this closing block to satisfy Rule 116. The advanced record range includes the separately reviewed self-host merge; reviews/selfhost-codex-1021-change-review.md and reviews/train-119-change-review.md describe that unchanged product scope and model-facing recorded replay.
Prompt finding: 0d4664ea9de7 | protocol-literal | Existing standing-trust instruction is quoted in self-description provenance tests; no wording or semantic trigger is changed.
Prompt finding: 14d7eeccc218 | protocol-literal | Existing workspace and public-read authority instruction is quoted by the self-description tests; this change only exposes the adapter-owned system text.
Prompt finding: 9781075d458e | protocol-literal | Existing refusal-reporting instruction is asserted by self-description tests, with no fixture-derived answer gate.
Prompt finding: 45e37ea2e9e9 | protocol-literal | Historical capability instruction is quoted for provenance comparisons; no prompt wording is derived from the fixture.
Prompt finding: b1bb3946362d | protocol-literal | Existing Claude agent identity instruction is asserted by act-first tests; identity wording is unchanged.
Prompt finding: 42faf877ba82 | protocol-literal | Existing Codex agent identity instruction is asserted by act-first tests; identity wording is unchanged.
Prompt finding: 450c79237a95 | protocol-literal | Existing conflicting-memory guidance is asserted by journal-people tests; the instruction and its interpretation are unchanged.
simplestRobustRoute: This is the simplest robust route: one bounded reread through the existing snapshot and authority mechanisms. The named failure is a concurrent unrelated append being treated as missing authority, cancelling a started model call. No startup warmup, model retry, stale-authority grace period, new service or persistent state is added. Start and end guards require a stable snapshot; the two-read ceiling, malformed-evidence refusal, fresh seal, revocation and expiry checks preserve limits. Red/green real-model race injection and three fresh Telegram conversations are recorded in PROGRESS.
80/20: The first-call cancellation is reproduced at the physical boundary, repaired at its source, and covered by neighboring refusals. Independent landing judgment belongs to the desk.
VERDICT: author submission; no independent convergence claimed
