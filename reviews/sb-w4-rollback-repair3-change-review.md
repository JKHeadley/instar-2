# Change review — sb-w4-rollback repair 3: the 08:28 answer-check refusal is a startup getMe transport failure, not this build; a live-build root is proved to open on this build

Subject base: 799e95d627239d58137573f5db7a0b73973c1b82
Review state: open
Reviewed content: none
Outcome: The answer check on a copy of the live preview (2026-10-05 08:28, plan row #578) ended "preview refused to start or continue; details suppressed". The runner's own refusal record in the kept copy (`lanes/preview-trial-root/canary-copy-20261005-082805/runs.jsonl` line 1486) names it: `refused before launch`, `preview: bot identity refused`, thrown at `tests/preview/journal-agent.mjs:2116` when the startup `getMe` returns anything but `kind: 'identity'`. That line is reached only after this build has already opened the copied journal (`journal.view` is read at lines 2087 and 2105), so the history-carrying rollback this build adds to `tests/preview/journal.ts` had accepted the live root. Nothing on the getMe path differs from the live build cint-L50 57e12273: `git diff 57e12273 HEAD` touches no byte of `tests/preview/journal-agent.mjs`, `scripts/production-boot-io.mjs`, `scripts/limit-exec.sh` or `src/assembly/telegram-bot-api-bridge.mjs`, and the only runtime source change on this branch besides `journal.ts` and `tool-turn.mjs` is the cleanup-census retry in `scripts/resource-owner.mjs`, which runs after a provider launch, never on the transport child. The child failed before Telegram answered: the bridge seals every getMe answer into `<root>/.writer/.telegram-sealed` before judging it, and the copy's folder is empty with its 08:17 copy-time mtime, so no answer reached the seal (the failure was a fetch failure, a launch refusal, or a child exit). The same refusal is recorded on the live root under earlier builds — line 602 of the same runs.jsonl (2026-10-03, followed 63 s later by a successful launch on the same root) and in the backups taken before cint-L33, L34, L35, L36, L37, L38b, L39, L47, L49 and L50 — so it is a recurring transient of the host's network or launch path. No code is changed. One test is added: cint-L50 57e12273, checked out by `git archive`, writes a root, and this build opens it with the conversation intact.
Affected rules: 26, 36, 42, 70, 74, 101, 116
Affected floors: secrets — unchanged (the test uses a fixed offline key; no credential is read or sent, and the live copy was read only as plaintext refusal records, never decrypted); spend cap — unchanged (no model call); stop — unchanged; no duplicate sends — unchanged (no send path touched); durable intake — unchanged (no record kind, field or write order changed).
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: a test-only change that records why an answer check failed and proves the switch the desk suspected; it changes no executed byte of the runner.
Side effects: none at runtime. The test checks out one more historical commit into a temporary directory and removes it.
Undo and recovery: revert this commit and this record; nothing is persisted or migrated.
Multi-machine posture: machine-local test; the fixture uses no host secret or path, so it runs the same on every machine with the commit present.
Layer below: reviews/sb-w4-rollback-change-review.md (the rollback window this test exercises against the live build) and reviews/sb-w4-rollback-repair2-change-review.md.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: sb-w4-rollback-r3-not-this-build | the refusal is attributed to the startup getMe transport and not to this build, because the runner passed the journal open before refusing, no byte on the getMe path differs from the live build, the sealed-capture folder proves Telegram never answered, and the identical refusal recurs on the live root under ten earlier builds; a source change to this branch was rejected because there is no defect in it to fix, and the remedy for the answer check is to re-run it | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-rollback-PROGRESS.md
Decision: sb-w4-rollback-r3-live-root-test | a test in `tests/preview/journal-rollback-real-switch.test.ts` has the live build 57e12273 write a root and this build open it, expecting status 0 and the same conversation; the other side (an older build refusing a newer root) is the existing case in the same file, so both directions of the open decision are proved on real checkouts, not stubs | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-rollback-PROGRESS.md
Decision: sb-w4-rollback-r3-retry-deferred | a bounded startup getMe retry and naming the transport stage in the refusal record were considered and left to a separate unit: both change the runner's start-up path outside this unit's subject, and the stage name is what would have made this diagnosis direct. They are recommended to the desk, not shipped here | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-rollback-PROGRESS.md
Prompt review: not model-facing. The change is one test of journal open compatibility; it touches no prompt, parser of model output or accept/escalate/refuse decision.

Subject (2 paths): tests/preview/journal-rollback-real-switch.test.ts, reviews/sb-w4-rollback-repair3-change-review.md

## Closing block

simplestRobustRoute: required outcome — know whether this build refuses a root last launched by the live build, and fix it if so. Simplest robust route: read the runner's own refusal record, compare the code paths, and prove the switch with the existing two-checkout fixture. Added machinery: none.
80/20: `npx vitest run tests/preview/journal-rollback-real-switch.test.ts` 2 passed (foreground, targeted). `node scripts/check-architecture.mjs` exit 0. `git diff --check` clean.
VERDICT: author submission; the independent verdict is recorded as a pass
