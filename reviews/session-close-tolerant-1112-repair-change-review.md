# Change review — session-close-tolerant-1112 repair

Subject base: 35acede2ff6d3c06d73b5c908ac08b5bd348c296
Review state: open
Reviewed content: none
Outcome: Startup exceptions cannot reveal held secrets through stderr or run-log causes before all secret sources are established and readable; scrubbed detail remains available afterward.
Affected rules: purpose least revelation; 4, 39, 42, 70, 74, 101, 102, 111, 113, 116, 123
Affected floors: secrets — capture environment values immediately and withhold exception detail until every held-secret source can be read; spend cap — existing admission unchanged; stop — existing checkpoints unchanged; no duplicate sends — no dispatch changes; durable intake — existing session and journal behavior retained.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Repairs a demonstrated secret exposure at the real launcher diagnostic boundary.
Side effects: Early failures and failures with unreadable secret sources carry a fixed safe cause, in both stderr and the existing run log. Readable sources permit the existing scrubbed class and first line. Initial environment values stay held for the process lifetime. No tools, sessions, network access, MCP, persistence or model abilities change.
Undo and recovery: Revert this repair's source, test and mechanical publication together; doing so restores the demonstrated startup disclosure. Preserve existing journals and custody. No data migration is needed.
Multi-machine posture: Existing machine-local stderr and runs.jsonl remain under the runner's existing owner and writer lease. No additional cross-machine state or authority.
Team posture: Existing host/operator diagnostic audiences and access controls remain unchanged. No member or guest receives new content, no sharing is widened, and sensitive exception detail is suppressed at its existing output boundary.
Layer below: createHeldSecrets retains known values and reports each unreadable source; custodyHeldSources covers vault/MCP and the existing harness-login readers cover configured profiles. redactedRunCause scrubs the entire error before first-line truncation. The actual child launcher and its JSON parser reproduce the incident without product substitution.
Bug class: integration
Bug evidence: reproducer=tests/preview/journal-agent.test.ts
Hook bypass: none
Convergence: none
Prompt review: No model prompt, output parser, semantic acceptance or delivered reply changes. Recorded model-output replay is inapplicable.
Decision: session-close-tolerant-1112-repair-A | Reuse the existing held-secret reader and one diagnostic scrubber; keep a fixed safe cause before source establishment or on any source-read failure, and detailed scrubbed causes afterward. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/session-close-tolerant-1112-repair-PROGRESS.md

1.x comparison (inherited from the accepted unit review): actual JKHeadley/instar main 72dfe3a52b8cfe7a2ebed131b7acfc332f4c02f0; researched src/, docs/specs/ and history. Sources: src/core/ReplicatedJournalCompactor.ts, src/core/StateManager.ts, src/commands/server.ts cleanup catches, docs/specs/unified-session-lifecycle-robustness.md; history ab26b7ca3 and SessionManager 05b50438e/c825f2075; ONEX-LESSONS.md section 2. Reuses compaction parity and observable nonfatal cleanup design through 2.0 owners. JSONL/HLC and tmux are not a fit for typed liability custody. This narrow diagnostic repair preserves the accepted lifecycle change.

Validation: Foreground nice -n 10, one worker, tests/preview/journal-agent.test.ts, plus TypeScript and required cheap gates. The real-launcher regression first reproduced the synthetic opaque environment-secret leak and unsafe unreadable-source diagnostic. Its ordinary readable configuration-error neighbor passed unchanged. Final results and exact publication custody are recorded at /Users/dabombstudio/.instar/agents/echo/.instar/lanes/session-close-tolerant-1112-repair-build-report.md. The specific repair instruction reserves the full suite and broader pinned suites for the desk pipeline.

simplestRobustRoute: Reuse createHeldSecrets, concealSecretMaterial and the existing single diagnostic scrubber; hold environment values from startup and emit a fixed safe cause until the complete held set is readable. This is the simplest robust route. Start guard is source establishment, end guard is scrubbed diagnostic emission, and existing limits and abilities remain intact. No new service, registry, approval gate or autonomous-completion claim.
80/20: One demonstrated disclosure, one small source repair, real-launcher negative cases and the existing positive neighbor; targeted tests and cheap gates before publication, independent review at the desk.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
