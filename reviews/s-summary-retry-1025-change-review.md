# Change review — Revise a rejected summary within its existing attempt budget

Subject base: 206bc77026aae10e4acb3ae6b177f2d0882295c8
Review state: open
Reviewed content: none
Outcome: A completed full-context loss rejection gets one revision carrying its reason before the automatic ten-minute cooldown. Only a passing review commits.
Affected rules: 7, 11, 32, 34, 35, 36, 37, 42, 49, 55, 60, 70, 74, 75, 95, 96, 101, 113, 116
Affected floors: Secrets retain redaction and memory projection; spend uses existing reservations, per-span attempts and pass ceiling; stop is checked before dispatch and commit; no send path changes; durable intake and original history stay in the journal.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Default-on correction to memory compaction after rejected full-context review.
Side effects: One remaining writer/review attempt may be spent sooner. The pass ends after a second failure; original cooldown, per-span cap and overall allowance remain. A bounded feedback field increases the retry packet and uses the existing size/preparation fallback. UNKNOWN and unsure outcomes do not trigger this revision. Index-only recovery yields to a revision already in the same pass and continues on later idle passes.
Undo and recovery: Revert the code change; existing journal events remain readable. No schema, migration, deletion, or send replay.
Multi-machine posture: No new durable state. Revision feedback is ephemeral to one owner-held pass and span; durable failures, caps and reservations replay as before. A restart may lose an optimization, never the original history or a failed verdict.
Layer below: Read the complete constitution and the 1.x CompactionSentinel bounded retry/failure path. Inspected runSummary, automatic-pass cooldown, summary reservations, per-span counters, faithfulness cascade, memory projection and snapshot timestamps. Frontier IDs do not establish when attempts ran: the supplied final snapshot predates expiry of the last rejection's cooldown.
Bug class: user-facing
Bug evidence: reproducer=tests/preview/summary-retry.test.ts; live=tests/preview/fixtures/summary-retry-timing-2026-10-25.json
Evidence boundary: Offline replay of real writer, Jev and reviewer bytes at update 6236276; the revised writer/pass response is an explicitly synthetic neighbor correcting the recorded false delivery claim. Snapshot 6236480 supplies timing and verdict, not the reviewer rationale. No live provider or proof-room sends; desk owns live group S acceptance.
Hook bypass: none
Convergence: none
Decision: bounded-summary-revision | Reuse the existing pass for one remaining attempt with the full-context review reason; a second loss stays failed and visible. Do not introduce a new retry scheduler or change the pass cooldown. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/s-summary-retry-1025-PROGRESS.md
Decision: recorded-retry-timing | Correct the permanent-latch hypothesis using recorded auth-phase timestamps; distinguish a low frontier from an early attempt. The latest snapshots omit the named loss, so replay the earlier recorded full review without inventing the missing reason. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/s-summary-retry-1025-PROGRESS.md
Prompt review: The writer is told to revise from bounded projected reviewer feedback. That field is evidence, not authority; all original acceptance checks remain. Tests replay the recorded loss and its neighboring correction. No literal fact or reviewer phrase becomes a production rule.
Prompt finding: 4106b49fff07 | protocol-literal | Existing unchanged protocol/status text asserted by tests; no new keyword intent decision — fixture-phrase tests/preview/journal.ts <- tests/preview/topic-awareness.test.ts: "you attempted nothing outside this reply, so never call an avenue tried; a missi"
Prompt finding: 849db3a6296a | protocol-literal | Existing unchanged protocol/status text asserted by tests; no new keyword intent decision — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: 85544c20941f | protocol-literal | Existing unchanged protocol/status text asserted by tests; no new keyword intent decision — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-conversation-session.test.ts: "your messages are kept and i'll answer them then; you don't need to resend them."
Prompt finding: e8708c7fea24 | protocol-literal | Existing unchanged protocol/status text asserted by tests; no new keyword intent decision — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel; disclose unknown sources."
Validation: Failing-first replay showed only one writer call. Final targeted tests and architecture/type/register checks are reported in PROGRESS. No independent review or live acceptance is asserted here.

## Closing block

simplestRobustRoute: This is the simplest robust route: use the existing bounded pass and the remaining per-span attempt, adding the completed review's reason to the retry packet. It prevents a known correctable loss from consuming a ten-minute pause before any revision. No new engine, stored queue or weakened review. Start guards remain idle/forced admission, stop, scope, reservation and allowance; the end guard is a passing summary review; the limits are two attempts per span and the existing pass ceiling. This submission proves offline behavior, not an unattended shipped live result.
80/20: Focus on the recorded loss, bounded revision and existing safety neighbors. The desk owns independent landing and live acceptance.
VERDICT: author submission; no independent verdict asserted
