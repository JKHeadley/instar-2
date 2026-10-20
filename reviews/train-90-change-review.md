# Change review — train-90 standing reply-format directives

Subject base: 743d2b5e684aef0a75c88b37847c65beb9d04c5a
Review state: open
Reviewed content: none
Outcome: Restore recording of standing reply-style instructions as directives while preserving preferences and excluding one-off requests.
Affected rules: 2, 3, 12, 34, 36, 37, 49, 66, 69, 74, 85, 90, 93, 101, 102, 111, 112, 113, 116
Affected floors: Secrets, spend cap, stop, unique dispatch/no duplicate sends and durable intake remain unchanged. Prompt growth fits the existing context guard.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Carries a reviewed model-facing instruction change and regenerates its source binding.
Side effects: The self-description replay test translates the historical directive parenthesis alongside its existing exact historical translations; captured bytes and current production wording are unchanged. Standing format instructions enter both preference and directive records; one-off instructions remain outside the directive lifecycle. Existing directive timestamps persist. No new parser, authority, store or model call.
Undo and recovery: Revert the wording through review and regenerate source bindings. Preserve recorded directives and original journal evidence; do not replay uncertain effects.
Multi-machine posture: Unchanged; the admitted conversation owner records directives in the existing journal and existing replication carries them. No new machine-local state.
Layer below: Full constitution, reviewed member report and exact diff, recorded fixture provenance, existing directive lifecycle and context budget checks, and cint-L37 regeneration chain inspected.
Bug class: integration
Bug evidence: reproducer=tests/preview/directive-reply-format.test.ts; live=tests/preview/fixtures/directive-reply-format-2026-10-20.json
Hook bypass: none; core.hooksPath unset and common hooks directory contains samples only.
Convergence: none
Prompt finding: 4106b49fff07 | protocol-literal | Existing no-tools capability disclosure is asserted by the topic-awareness test; it is unchanged and does not decide user intent by keyword.
Prompt finding: 849db3a6296a | protocol-literal | Existing empty-memory status wording is tested at its consumer; unchanged by this merge, not an intent classifier.
Prompt finding: e8708c7fea24 | protocol-literal | Existing source-provenance instruction is tested at its consumer; unchanged, not a semantic phrase gate.
Prompt review: Carries only the member's reviewed 14-byte wording change. Recorded outputs from updates 46040376 and 46040368 and real-model positive/one-off replays exercise the worker. This batch does not claim a new live model run or Studio acceptance.
Decision: train-90-merge | Ordinary merge of exact reviewed 345023ec6b197b12fc2b4c852d4f73fa0c3c0f2e, fast-forward without conflicts. Member report: /Users/dabombstudio/.instar/agents/echo/.instar/lanes/d5c-directive-since-1020-PROGRESS.md (read remotely). Its later unreviewed register-only commit is excluded. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-90-PROGRESS.md
Decision: train-90-A | Preserve the member wording, tests and fixture byte-for-byte; no overlapping edits required resolution. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-90-PROGRESS.md
Decision: train-90-B | Create branch directly at exact live base 743d2b5e684aef0a75c88b37847c65beb9d04c5a; preserve ancestry with no main merge or branch movement. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-90-PROGRESS.md
Decision: train-90-C | No genuine product conflict and no omitted reviewed head. Regenerate generated files rather than hand-edit them. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-90-PROGRESS.md
Decision: train-90-D | Apply specified WSL host exclusions and report host-dependent checks; Studio owns live acceptance and native conformance. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-90-PROGRESS.md
Decision: train-90-capture-compat | The direct-consumer run exposed the historical guide equality in selfdesc-limits. Add only the exact old-to-current standing-style translation to its existing test adapter; preserve the recorded packet and both description/refusal verdict neighbors. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-90-PROGRESS.md
Decision: train-90-desk | Use the existing repin/build/rehash/register replay chain with Linux sed syntax, preserving context guard constants and native conformance declarations. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-90-PROGRESS.md

Deferral: generated/register.json:1 | not-a-deferral=Existing declaration text reproduced by the generator; no new deferred repair.
Verification: Targeted changed/direct-importing tests, journal tests, subscription and context checks, pinned READY tests, typecheck, lint, architecture, register and review checks; results in the desk handoff report.
simplestRobustRoute: This is the simplest robust route: one ordinary reviewed merge and the existing desk regeneration chain. No new machinery. Existing authorization, bounded context, stop, custody, durable intake and unique dispatch guards remain. No fresh unattended completion claim.
80/20: Only targeted and explicitly requested checks; no full suite or base comparison worktree.
VERDICT: author submission for desk gate, not independent convergence or live acceptance
