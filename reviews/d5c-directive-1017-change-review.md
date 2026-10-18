# Change review — D5 directive and preference evidence

Subject base: b55334d38982aadd018bcac54cf703aeaff986c2
Review state: open
Reviewed content: none
Outcome: distinguish the recorded reply preference from the dedicated directive projection, and verify both survive a summary and reopen with their original source.
Affected rules: 7, 26, 34, 47, 49, 70, 74, 93, 96, 101, 102, 111, 113, 116
Affected floors: secrets — test-only synthetic journal; spend cap — no provider calls; stop — unchanged; no duplicate sends — simulated send receipts only; durable intake — existing encrypted journal exercised unchanged.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: regression coverage and diagnosis only; no runtime, prompt, parser or acceptance changes.
Side effects: adds two local journal regressions and extends the test status type to include since. No product or live-proof script changes. The full touched test file also exercises an unrelated host-watch launcher timing assertion that fails under WSL (expected no wait, observed one); the new D5 cases both pass.
Undo and recovery: revert this test-only commit; no production state or migration to undo.
Multi-machine posture: unchanged; test reopens the existing local encrypted journal, with no new store, writer, replication or visibility claim.
Layer below: read Rule 93; traced OBLIGATION_DECISION, memoryPreferenceState, answer packet preferences, openDirectives and journal-agent status. The saved proof inspect at update 46040189 carries the exact D5 text as last.preferences[0].text and source telegram:8993213212:update:46040188. status.directives reads only openDirectives, not preferences. Both saved statuses have no summaries, so this particular live run does not prove compaction.
Bug class: unit
Bug evidence: reproducer=tests/preview/journal-obligations.test.ts
Hook bypass: none; core.hooksPath unset, shared hooks directory contains sample hooks only.
Convergence: none
Decision: d5c-recorded-preference | choose brief case (b): existing durable preference holds the instruction; desk should read inspect.last.preferences text/source rather than assume status.directives is exhaustive | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/d5c-directive-1017-PROGRESS.md
Decision: d5c-two-projections | prove both supported declarations retain the D5 wording across a real summary and journal reopen; directive status retains original since, preference retains original source | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/d5c-directive-1017-PROGRESS.md

## Closing block

simplestRobustRoute: this is the simplest robust route: prove the existing recording mechanisms and correct the desk's field assumption. Rule 93 requires durable instructions without timer expiry, not one named JSON field. Avoid duplicating preferences into a second directive store with separate closure semantics. Tests exercise admitted operator input, summary, reopen, and a thirty-day clock advance; existing authority, resource and effect limits stay unchanged. No claim of a new autonomous shipped path.
80/20: inspect the real failed proof artifacts, verify both existing projection paths with targeted tests, and leave independent convergence and live proof to the desk.
VERDICT: author submission; independent desk review pending
