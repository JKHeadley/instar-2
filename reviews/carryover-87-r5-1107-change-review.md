# Change review — Standalone update launches through the real resource owner

Subject base: 683a87c38dcac9964b9db04c54766c2226008329
Review state: open
Reviewed content: none
Outcome: Row 87. The standalone update command launches npm and the syntax check through an attached resource owner instead of an unowned spawnSync. Merges live e8c2a0b1 keeping both sides.
Affected rules: 60/61 (one funnel: admission, ceilings, census and verified tree cleanup; the command is person-run, so it is not a self-action); 55 (existing backoff, pause and stop, observed by the live probe; the register label stays unbounded); 42/95 (a refused or stopped launch stays a failure and keeps the current release; change integrity fails closed); 2 (an unconfirmed cleanup is told to the person because no ledger keeps it); 34/70 (real-process tests, shown failing on the prior code); 7/32/113 (no new store; machine-local); 49/69/74/102 (provenance and review); 101 (ordinary commits); 116 (reuse of setup's composition).
Affected floors: secrets — npm output stays unforwarded and the environment is passed as before; spend cap — no model call; stop — a stop during a launch now ends the whole tree, where before it left npm running; no duplicate sends — no send path; durable intake — untouched.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Changes how one person-run command launches two finite subprocesses, using an existing owner; the update transaction itself is unchanged.
Side effects: The command now runs npm in its own process group under the owner's existing ceilings (18 GiB and 288 processes per launch, the user-wide process limit). No update-specific limit is added. Those ceilings already apply to the admitted updater. bin/instar2.mjs now loads resource-owner.mjs through update.mjs. On a host whose /bin/sh refuses ulimit -u the command now fails with the current release retained, as every admitted launch there already does.
Undo and recovery: Revert this change; the update transaction, its lock and installed releases are unaffected. A stopped run leaves no pointer change and the next run completes.
Multi-machine posture: Machine-local, deliberately: the update transaction, process tree and owner describe this machine. No authority, allocation or state is shared or widened.
Layer below: Read scripts/resource-owner.mjs (attach, admit, run, hold, cleanup), process-census-query.mjs, setup-qualification.mjs boundedRun, update-product.mjs and the register's bounded-repeat checks. The census repair (train 188) bounds census reads and reconciles completed debits; it still counts only owned launches, so it does not cover a standalone launch by itself and the launch needs the owner.
1.x reference: b446e92b8721fcd232475b596cc8397635b04863 src/core/UpdateChecker.ts applyUpdate runs npm install through execAsync with a timeout and no resource funnel, into a pending shadow directory validated before promotion. The staging order is retained; the owner's ceilings are 2.0's Rule 60 and were already applied to the admitted updater. No 1.x code is newly copied.
Bug class: integration
Bug evidence: reproducer=tests/preview/update-standalone.test.ts
Hook bypass: none
Convergence: none
Prompt review: no prompt, model-output parser or accept/escalate/refuse selector changed; recorded-model replay does not apply.
Decision: c87r5-owner | Compose the real owner as setup's one-shot run does, with no ledger and no Six allocation, because the ledger exists to return a Six debit and this command holds none. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-87-r5-1107-PROGRESS.md
Decision: c87r5-stop | Pass stop signals to the owner only while a launch runs, so a stop between launches behaves as before and the detached group is not orphaned. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-87-r5-1107-PROGRESS.md
Decision: c87r5-cleanup | Report an unconfirmed cleanup on stderr without failing the update or refusing on a failed census, adding no refusal 1.x did not have. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-87-r5-1107-PROGRESS.md
Decision: c87r5-bound | Keep the feature's unbounded label: bounded needs a governed construct in core code, which a scripts-side probe cannot supply, and moving the updater into core is not a small change. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-87-r5-1107-PROGRESS.md

Deferral: docs/defects/rule-36-genuine-parser-captures.md:9 | not-a-deferral=Existing text brought in by the live merge; this change adds no commitment.
Deferral: docs/defects/rule-36-genuine-parser-captures.md:10 | not-a-deferral=Existing text brought in by the live merge; this change adds no commitment.
Deferral: docs/evidence/train-192-notice-owner/constitution-attributed-statements-change-review.md:29 | not-a-deferral=Copied historical evidence brought in by the live merge, preserved verbatim.
Deferral: docs/evidence/train-192-notice-owner/constitution-one-constitution-change-review.md:30 | not-a-deferral=Copied historical evidence brought in by the live merge, preserved verbatim.
Deferral: docs/evidence/train-192-notice-owner/constitution-person-decides-change-review.md:29 | not-a-deferral=Copied historical evidence brought in by the live merge, preserved verbatim.

Prompt finding: 0725f0150c56 | protocol-literal | carried unchanged from the merged inputs; as dispositioned in reviews/2176b4cf-merge-live-d121315e-change-review.md at c69f89ec3456: carried unchanged from the merged inputs; as dispositioned in reviews/7a7af8da-merge-live-7ad55e86-change-review.md at 2176b4cf2524: carried unchanged from the merged inputs; as dispositioned in reviews/gap-email-1018s-change-review.md at 7ad55e86ef86: The regression normalizes the existing role/refusal prologue for historical packet and digest comparison; no semantic gate keys on this phrase.
Prompt finding: 27d7720e7977 | protocol-literal | carried unchanged from the merged inputs; as dispositioned in reviews/2176b4cf-merge-live-d121315e-change-review.md at c69f89ec3456: carried unchanged from the merged inputs; as dispositioned in reviews/7a7af8da-merge-live-7ad55e86-change-review.md at 2176b4cf2524: carried unchanged from the merged inputs; as dispositioned in reviews/gap-email-1018s-change-review.md at 7ad55e86ef86: The existing memory-record boundary delimits the intentionally changed prologue in historical byte comparison; it is not a model decision trigger.

Deferral: docs/defects/rule-36-genuine-parser-captures.md:3 | commitment=docs/defects/rule-36-genuine-parser-captures.md
Deferral: docs/defects/rule-36-genuine-parser-captures.md:14 | not-a-deferral=Closure record of the Telegram capture brought in by the train-211 merge; it records completed work.
Deferral: docs/defects/rule-36-genuine-parser-captures.md:16 | not-a-deferral=Closure record of the Slack capture brought in by the train-211 merge; it records completed work.
Deferral: tests/preview/d1c-result-line-withhold.test.ts:108 | not-a-deferral=Test assertion on the literal 'Follow-up on' result line, brought in by the train-211 merge.
Deferral: tests/preview/held-result-delivery.test.ts:86 | not-a-deferral=Test helper counting the literal 'Follow-up on' result line, brought in by the train-211 merge.
Deferral: tests/preview/held-result-delivery.test.ts:101 | not-a-deferral=Test assertion on the literal 'Follow-up on' result line, brought in by the train-211 merge.
Deferral: tests/preview/journal.ts:2761 | not-a-deferral=Prompt text naming earlier follow-ups as evidence, brought in by the train-211 merge; no commitment.
Deferral: tests/preview/journal.ts:2772 | not-a-deferral=Parser for the literal 'Follow-up on' result line, brought in by the train-211 merge.
Deferral: tests/preview/plain-task-stop.test.ts:29 | not-a-deferral=Negative test assertion that a reply does NOT promise to follow up, brought in by the train-211 merge.
Skip: tests/preview/update-standalone.test.ts:186 | scope=Platform-conditional: runs only where /bin/sh is dash; existing test brought in by the train-211 merge.
Skip: tests/preview/update-standalone.test.ts:203 | scope=Platform-conditional: runs only where /bin/sh is dash; existing test brought in by the train-211 merge.

## Closing block

simplestRobustRoute: Reuse the owner composition setup already ships, deleting the spawnSync path. The alternatives were a production Six allocation for one finite command, which needs signing authority the command has no claim to, or a request to the running agent, which fails when no agent runs and updating is how a broken agent is repaired. This is the simplest robust route; the only added code is the stop passthrough, which prevents a stop leaving npm running in its detached group.
80/20: Real-process tests cover success, descendant cleanup, stop, recovery, capacity refusal, admission with room and unconfirmed cleanup. Outright killing the command is left as it was before and in 1.x.
VERDICT: author submission; independent review, Studio gate and live installed proof remain
