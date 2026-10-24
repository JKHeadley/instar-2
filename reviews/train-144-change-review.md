# Change review — train-144 reviewed outage integration

Subject base: 45782c77d32d1b470bb762b0c7b1a6a4d7407c72
Review state: open
Reviewed content: none
Outcome: Integrate exact reviewed outage notice head 30756aca5e4d7c473e114f008ad275946b534648 onto live 45782c77d32d1b470bb762b0c7b1a6a4d7407c72, preserving live quota selection and one durable admitted outage notice.
Affected rules: 1, 15, 26, 34, 36, 37, 42, 49, 52, 60, 61, 63, 74, 77, 87, 88, 89, 90, 95, 101, 102, 111, 113, 116
Affected floors: secrets retain existing custody and content-free notice; spend cap retains reply budget and no added model call; stop retains halted and projection guards; no duplicate sends retains admitted durable intent and UNKNOWN fence; durable intake retains queued turns.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Integrates durable outbound notice admission and live capacity observation.
Side effects: One infrastructure notice per outage; live telemetry and compatibility quota observations share the existing selection reader. Soft pressure alone never creates an outage. An unknown hold releases only at the existing selection recovery threshold.
Undo and recovery: Keep accepted live build until desk gate; existing rollback applies. Older readers refuse the new outage discriminator rather than repeat uncertain sends. No live runner or state is changed here.
Multi-machine posture: Existing conversation writer lease, journal custody and send ownership remain authoritative. Quota observations are machine-local under that existing owner; no new replicated state or takeover authority.
Layer below: Read constitution and member snapshots; inspected live pool observedUsage, configured cutoff, recovery threshold, journal admission and durable intent. Reuse existing desk generation chain.
Bug class: integration
Bug evidence: reproducer=tests/preview/harness-login-pool.test.ts
Hook bypass: none
Convergence: none
Decision: train-144-merge | Merge exact 30756aca5e4d7c473e114f008ad275946b534648; evidence /Users/dabombstudio/.instar/agents/echo/.instar/lanes/limit-notice-1020-PROGRESS.md read from verified snapshot. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-144-PROGRESS.md
Decision: train-144-A | Keep both quota test sets and preserve live source behavior; use observedUsage and the same unknown-hold recovery threshold in the new read-only outage observation. Retain the live historical replay review and its valid original ancestor base. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-144-PROGRESS.md
Decision: train-144-B | Create new branch directly at exact live 45782c77d32d1b470bb762b0c7b1a6a4d7407c72; no main merge or branch move. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-144-PROGRESS.md
Decision: train-144-C | No irreconcilable product conflict and no member omitted. Regenerate generated files, never hand-merge. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-144-PROGRESS.md
Decision: train-144-D | Disclose unchanged host-dependent checks and inaccessible Studio report evidence under the explicit WSL exception; no declaration weakened. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-144-PROGRESS.md
Decision: train-144-desk | Use downloaded repin/build/rehash/register replay chain; adapt temporary sed command to Linux, preserve guard constants. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-144-PROGRESS.md
Prompt review: No new prompt or model parser. Fixed infrastructure text and existing prompt literals are tested at their consumers; recorded summary, Jev, reply-review and empty-reply shapes replay through group-carry.
Prompt finding: 4106b49fff07 | protocol-literal | Fixed output or existing provenance instruction tested at its consumer, not a semantic keyword classifier — fixture-phrase tests/preview/journal.ts <- tests/preview/topic-awareness.test.ts: "you attempted nothing outside this reply, so never call an avenue tried; a missi"
Prompt finding: 849db3a6296a | protocol-literal | Fixed output or existing provenance instruction tested at its consumer, not a semantic keyword classifier — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: 85544c20941f | protocol-literal | Fixed output or existing provenance instruction tested at its consumer, not a semantic keyword classifier — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-conversation-session.test.ts: "your messages are kept and i'll answer them then; you don't need to resend them."
Prompt finding: e8708c7fea24 | protocol-literal | Fixed output or existing provenance instruction tested at its consumer, not a semantic keyword classifier — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel; disclose unknown sources."
Deferral: generated/register.json:1 | not-a-deferral=generated quotation of governing rules, not a deferred commitment

Subject (15 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references/preview.json, tests/preview/group-carry-requests.test.ts, tests/preview/group-carry.test.ts, tests/preview/harness-login-pool.mjs, tests/preview/harness-login-pool.test.ts, tests/preview/journal-agent.mjs, tests/preview/journal-conversation-session.test.ts, tests/preview/journal.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: ordinary exact-head merge, existing telemetry reader and recovery threshold, existing notice admission, regenerated publication and targeted consumers. No extra queue, timer or classifier. Named safety floors stay enforced. No fresh unattended deployment is claimed.
80/20: Resolve actual overlap, prove both sides, and hand the combined candidate to the Studio gate; no full suite here.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
