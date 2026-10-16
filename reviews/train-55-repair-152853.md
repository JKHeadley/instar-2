# Change review — merge the live build while preserving activity freshness

Subject base: 1fe8db0f16379226055ecbecc07ba980fdf3aabf
Review state: open
Reviewed content: none
Outcome: Merge live b279011f into train-55 with both bounded progress freshness and truthful running/completed tool status intact.
Affected rules: 26, 37, 49, 70, 74, 87, 101, 102, 111, 112, 113, 116.
Affected floors: secrets — existing outbound checks unchanged; spend cap — no new model calls; stop — existing operation termination retained; no duplicate sends — no send path changed by resolution; durable intake — no intake change by resolution.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Merge of the live preview includes existing notice and delivery work; conflict resolution affects the evidence consumed by typing and progress.
Side effects: Reading current activity consults the admission bytes again so completion stops typing immediately, but only observed new admitted work advances the evidence timestamp. The inherited live notice and reminder changes remain intact. A new unobserved step is silent until the adapter observes it, avoiding borrowing a previous step's timestamp.
Undo and recovery: Revert this merge with its first parent retained; no new durable schema or store is introduced by the resolution. All prior commits remain in ancestry.
Multi-machine posture: Activity evidence remains machine-local and scoped to the operation and worker claim; shared ownership and delivery admission remain unchanged.
Layer below: admissionActivity projects complete allowed pre/post records, excludes child-agent rows and retains outbound length/secret inspection. journal-agent consumes running for typing, while progress uses the advancing timestamp. Neither a fresh poll nor a completed step renews that timestamp.
Bug class: integration
Bug evidence: reproducer=tests/preview/working-activity.test.ts
Hook bypass: none; core.hooksPath unset and common hooks directory contains sample hooks only.
Convergence: none
Decision: train55-merge-activity-freshness | Preserve advancing-step expiry and failed-start baselining, add the live running flag and rollback guards, and reread completion without renewing freshness. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-55-repair-152853-PROGRESS.md
Prompt review: No authored prompt change in this resolution; inherited live journal changes retain their existing reviews. The three matched strings below are unchanged contextual protocol/fixture evidence rather than new keyword gates.
Prompt finding: 4106b49fff07 | quoted-evidence | Existing limitation text is exercised by the topic-awareness fixture; the merge does not introduce a phrase-triggered decision.
Prompt finding: 849db3a6296a | quoted-evidence | Existing empty-memory response is fixture evidence; no new literal-output requirement is added.
Prompt finding: e8708c7fea24 | protocol-literal | Existing sourceLabel attribution instruction is retained unchanged; no new keyword decision is introduced.

simplestRobustRoute: This is the simplest robust route: combine the two existing mechanisms in the one activity reader, retain all source histories, and regenerate derived pins using the delegated desk tools. Start with an operation baseline, require fresh advancing admitted evidence, reread completion, and stop reporting on end, stale evidence, or future timestamps. No new machinery or autonomous-completion claim.
Derived artifacts: Replayed generated/ at merge c100bb3af782835bb24c55e6eb35cdf190902d8c with the existing builder; delegated owner-manifest and inventory repin scripts found no stale pins. Targeted activity/progress/typing tests: 55 passed before adding an explicit unobserved-new-step regression. That regression verifies silence before observation and the new timestamp after observation.
80/20: Resolve the two semantic conflicts and prove their interaction with targeted portable tests; the Studio retains full-suite and live acceptance duties.
VERDICT: author submission; no independent verdict or live acceptance claimed
