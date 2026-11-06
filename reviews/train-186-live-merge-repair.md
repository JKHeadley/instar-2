# Change review — preserve complementary train-186 and live repairs

Subject base: 983f194eeaae4706806322907de7943dc2e670a4
Review state: open
Reviewed content: none
Outcome: Merge live add5d7587 into train-186 without losing its smaller register-test batches, live's explicit child and cumulative wiring budgets, or either branch's defect and review history.
Affected rules: 37, 49, 55, 60, 70, 74, 90, 101, 102, 107, 111, 112, 113, 116
Affected floors: secrets — offline fixtures and existing custody unchanged; spend cap — no new calls; stop — explicit 60s child limits retained; no duplicate sends — no production effect or replay added; durable intake — all existing retained-input and register comparisons remain.
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: The broad diff imports existing live work; the authored repair resolves test orchestration and evidence conflicts without changing runtime behavior or model-facing decisions.
Side effects: Live dashboard, provider and test changes enter through their original ancestry and review records. Register tests retain train-186's independently initialized bootstrap/completion/ingestion and holder/deadline/rung groups. Live's four bridge groups retain 60s child limits and a 120s cumulative case budget. Both defect narratives survive. Generated metadata is replayed rather than manually pinned.
Undo and recovery: Revert the merge as a merge, preserving both parent histories and red evidence, then regenerate metadata through existing tools. Do not reset shared history or replay uncertain effects.
Multi-machine posture: Test fixtures are deliberately local to each runner; no shared runtime state, ownership or replication changes are authored. The Studio performs its own full-run qualification and resolves Studio-local evidence paths.
Layer below: Compared both parents' complete register test and the existing runChild helper. The grouping repair and the two-child cumulative budget solve different failures and compose without deleting assertions. Compared both historical review bases and defect narratives; retained provenance rather than making historical runs current claims.
Bug class: integration
Bug evidence: reproducer=tests/e2e/register.test.ts; other=docs/defects/vitest-worker-rpc-timeouts.md
Hook bypass: none
Convergence: none
Prompt review: No authored prompt, output parser, judgment acceptance or model-facing behavior change. Automatically merged live work keeps its existing review records and ancestry; no new live-model proof is claimed here.
Decision: t186merge-tests | Retain train-186's smaller independent batches and live's complete 7b78ea242/094e204 adaptation: 120s cumulative bridge budget with explicit 60s children. This preserves every assertion and both repairs. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-186-repair-065957-PROGRESS.md
Decision: t186merge-history | Preserve both defect narratives and historical review provenance, retain live's original review bases, and label all inherited validation historical. Regenerate derived metadata using the delegated tools. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-186-repair-065957-PROGRESS.md

1.x comparison: actual Instar origin/main 149377310f9b586641a05eddf196df4543dc031a (the JKHeadley/instar repository now uses instar-ai/instar) was searched in src/ and docs/specs/ for worker RPC timeouts and merge conflicts. Inspected src/core/WorktreeManager.ts async execFile, docs/specs/test-runner-concurrency-bound.md concurrency and fairness design, history 5143e436f/618560b3e/269da957b/c91b8780e, and ONEX-LESSONS section 6. Bounded asynchronous child work fits; its worktree and host semaphore do not implement register lifecycle fixtures. Reuse the complete fitting 2.0 owner corrections and existing tests/e2e/async-child.ts, not unrelated 1.x machinery.

Deferral: generated/register.json:1 | not-a-deferral=Generated rule text preserves existing obligations; this merge postpones no implementation.

Register replay: after the merge ae6790d97ae1fd0fb06c14ca7175224e8ce117ac, both delegated owner/support scripts reported zero changed pins. The existing replay rebuilt seven generated outputs (301 entries, 122 rules, 34 terms); this record covers the generated publication as well as the merge. The retained live conformance certificate requires Studio re-certification of merged composition bytes; it is not re-declared here.

## Closing block

simplestRobustRoute: This is the simplest robust route: merge the existing complementary corrections, preserving assertions and histories, and regenerate derived metadata. No new runner, guard or product mechanism is needed. Existing child bounds, fixture cleanup and admission checks remain; no autonomous shipped-path completion is claimed.
80/20: Run typecheck, the directly resolved register test, and required cheap checks; full qualification remains the Studio pipeline's responsibility under the assigned host scope.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
