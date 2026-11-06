# Carryover 02 r4 report — whole-parity continuation through the existing owners (third pass: admission continuity)

Source: fix/carryover-02-full-parity-r3-1105 at exact 98da80e1bcb0222aa6afaa4f70e770fce0ea38e0 (r3 head, preserved; base of this branch). Pushed head: b0d56324ac4399d0e17d4efa64070460d2f22e08 on origin/fix/carryover-02-full-parity-r4-1105 (HEAD and origin agree). Source publication: 1721cf3c3023a0c0d8108c876b9697c35b02c67d, generation sha256:9e695216858b6482299dd99cd4b4e73eea934df743da1337ed119b3b500eb3e0, authority shape-only. Earlier pushed heads of this branch (f52485578, 4c03a1e59, 273f42b37, 0a2a92fbe, c549b0c93, faa4660ef) are ancestors; the same author and branch continued, nothing rewritten. Raw 1.x baseline b947c171 and the r3 branch are untouched. PROGRESS record beside this file: /Users/adriana/echo-compute/builders/carryover-02-full-parity-r4-1105-PROGRESS.md. The desk disposition (row02-r4-desk-assessment-1105.md) and the desk source decision (row02-admission-continuity-source-decision-1105.md) were read in full from the worktree root and consumed; both stay untracked and were never staged. No launch, queue, live/provider/model/Telegram/serving/account call, new grant, signer, service, socket protocol, parallel journal writer, PID fallback, source-ceiling change or broad sweep.

## 1.x FIRST

Current JKHeadley/instar main cc11e45f92e2590dd1bbd3c3facb5b849532f0fc (v1.3.1676); all nine monitoring files blob-identical to the preserved b947c171 baseline and to the r3 pin d7788fa3 (blob ids in PROGRESS); each file exported and read in full. Reused tuned values and the mismatches deliberately not copied are in PROGRESS and in the review record's `1.x comparison` line. No ONEX-LESSONS.md exists in either tree. 1.x had no admission checkpoint; its restart continuity (ResumeQueue/StaleSessionBackstop) reattached by session name alone, which 2.0 refuses: the adopted worker here is bound by edge, request digest, registered claim, verified identity and durable liability.

## Admission continuity, implemented under the desk's source decision

Owners changed, no new store, service, protocol, grant, account, ceiling or provider:

- `tests/preview/journal.ts`: `projectSessionWork` accepts a `SessionWorkCall` intent row on a reserved (one-shot) edge, enforcing `ordinal === prior + 1` and `ordinal <= edge.budget.calls` and charging nothing twice (the edge reserved the liability); the per-call conversation charge is unchanged. `sessionWorkRecords()` returns every session-work row.
- `tests/preview/admission-gate.mjs`: `restore({ port, secret })` binds the original loopback endpoint as a second listener; a busy or foreign port throws, the fresh secret cannot be "restored", one secret cannot be restored on two ports. `open(claim, { restored })` starts at the durably spent calls with the edge's effects prepared without an observation and its open delegations restored as they are. A claim is reachable only under the secret it was opened with: an unadopted claim under the old secret is refused as closed and never forwarded, the adopted claim under this host's fresh secret is not found. `stop()` closes restored listeners and releases their ports.
- `tests/preview/session-admission.mjs`: `readSessionAdmissionGate(base, claim)` is the one trusted read of the adopted claim's recorded checkpoint address: this user's regular, single-link, 0600 file at the exact claim path, opened O_NOFOLLOW, bounded size, `gate` naming this exact claim on 127.0.0.1; it returns port, secret and call bound only and logs nothing. The file is authority for nothing; caller-selected config, port or secret are impossible by signature.
- `src/assembly/production-session-work.ts`: `restoredLiability(edge)` reads the durable rows: the spent count is the contiguous high-water intent ordinal (a gap, duplicate or disorder refuses), the worker's own transcript may not exceed it (surprising, refuses) and may fall short (an intent recorded and never answered keeps its liability, nothing refunded), an unreadable meter or an exhausted reservation refuses; effects prepared without an observation and delegations without a close are carried as they are. Adoption takes the owner's lease FIRST, then `io.restoreAdmission`; a refused lease, a refused or throwing restore, or a stop raised meanwhile releases the lease and leaves the step uncertain with no launch, delivery, stop or replay. An adopted claim is never prepared afresh and its edge never re-appended; pre-restart delegations settle once through the existing close path.
- `tests/preview/journal-agent.mjs`: every one-shot model call records its intent row through the gate's existing `reserveCall` hook before it is forwarded (the journal enforces contiguity and the reservation); `restoreAdmission` composes the trusted reader, `gate.restore` and the restored `open` for one-shot claims only. The old step's shell network checkpoint and connectors are not re-attached: that traffic fails closed as before (documented in the README).

Physical two-host-incarnation proof (tests/assembly/production-session-work.test.ts, cont2.log/final6-owners.log): a REAL worker process holds the endpoint baked at spawn and spends 5 of 24 through host A's shipped gate (five durable intents, five forwards to a local fake upstream); host A retires lawfully (its listener closes, the port is released, the worker lives on and its next call fails); host B's fresh gate restores the ORIGINAL endpoint from the claim's own recorded config through the trusted reader under the owner's lease; the worker's NEXT 19 calls are forwarded and the 20th is refused by the gate itself ("reserved model-call allowance (24) is used"), ordinals run 1..24, the gate state shows calls 24 and refused, no edge is re-appended, nothing is replenished, the lease is released. Negatives, each refusing before any forward: old owner still alive (bind busy, lease released, worker untouched and still served by the old owner), foreign busy port, another claim under the restored secret, the adopted claim under the fresh secret, config substitution (other claim, world-readable, symbolic link, non-loopback), unknown meter, transcript exceeding intents, exhausted reservation, ordinal gap, duplicate ordinal, absent or substituted worker, passed deadline, stop, no restore port, restore refused, restore throws, stop during restore; an intent recorded and never answered keeps its liability (18 remaining, the 19th refused); a restored uncertain effect fences supervision and a restored delegation settles once; the journal intent projection is tested on its own. Local fake ports only; the tmux identity is the fixture driver's, the model calls are real HTTP through the shipped gate.

## Owner / composition map and seven-module matrix (unchanged from the second pass except StaleSessionBackstop)

| 1.x behavior | 2.0 owner and construct | State |
|---|---|---|
| Sentinel nudge, 30 s verify, one per episode | conversation owner `StallEpisode.nudge` → adapter `control({action:'nudge'})` → driver `nudge()` | done |
| Sentinel corroboration 30 m / 90 m | existing `observeStall` | unchanged |
| Sentinel population walk, funnel metrics | `stallStatus()`, topics aggregation, one-shot `status()`, runner status lines | done |
| SessionMonitor history, 10 m / 15 m / 30 m, once-per-message notice | `settledAt`, `responsivenessNotice`, `stallStatus().responsiveness/notices` | done, pull-only |
| Nurse typed-but-unsubmitted | driver `classifyTypedUnsubmitted` → sample → owner and one-shot nudge | done |
| Nurse cooldown, verification, 50 rows, 3 restarts / 10 min | `cooldownMs`, `triageHistory`, `triagePressure.restarts` | done |
| Orchestrator six classifications/actions, validateAction | `interpretStallDecision`, owner predicates | done |
| Orchestrator reinject | driver `redeliver()` on the existing `redeliveries` bound | done |
| Orchestrator follow-up, cancellation, 5 auto actions / h | `followUpAt` on the owner poll, `autoActions` | done |
| Backstop restoration | one-shot adoption on the ORIGINAL endpoint with the ORIGINAL liability (above) | done |
| Backstop 600 000 vs 1 800 000 ms | registered-work watcher selected; bounds unchanged | done |
| DegradedTmuxGuard raise lifecycle | session IO observer `notices()`; runner lines | done |
| Watchdog installed actuation, non-Linux | Eight/Six/Ten/Nine via `createProcessControlAdapter`; runner `intervention` absent (refused) | separate desk/root dependency |

| Module | Carried (evidence) | Separate dependency |
|---|---|---|
| ActiveWorkSilenceSentinel | nudge-first, verification, history, metrics | installed acceptance |
| SessionMonitor | responsiveness states, notices, runner lines | live user-channel acceptance |
| SessionWatchdog | protections, payload digest, Nine assessment, delays | installed accepted-target binding, three-step actuation, non-Linux handle |
| StaleSessionBackstop | adoption with original endpoint and liability, watcher selection, delegations, effects | correct-host live proof |
| DegradedTmuxGuard | deduplicated episode notices | none portable |
| StallTriageNurse | fast path, cooldown, history, restart brake | installed verification of a signalled child |
| TriageOrchestrator | typed actions, reinjection, follow-ups, pressure, one-shot notice | auto-interrupt actuation |

Preserved from r3: custody, full-payload digest, late evidence reconciliation, actuator-versus-target distinction, escalation delay, async activity/login projection, UNKNOWN fences, deadlines and caps, protected exclusions, no duplicate effects, frozen-review reconciliation with independent review still required, native certificate unchanged. Inherited red repaired in the second pass: the runner's missing `observeSessionDriver` import (journal-session-work-launch 8/8 again).

Connected source paths: src/assembly/{contracts,production-session-driver,conversation-harness-adapter,conversation-topics,production-conversation-session,production-session-work}.ts, src/assembly/README.md, src/harness-adapters/codex-conversation-worker.ts, scripts/production-session-io.mjs, tests/preview/{stall-review.ts,journal-agent.mjs,journal.ts,session-admission.mjs,admission-gate.mjs}; pins register-source/owner-references/part-ten.json, tests/assembly/production-grounding-inventory.json, scripts/check-assembly-contracts.mjs; generated/* (replay); reviews/carryover-02-full-parity-r4-1105-change-review.md; tests under tests/assembly and tests/preview. 33 files, 1764 insertions, 137 deletions since 98da80e1b.

## Tests and checks (foreground, nice 10, one worker; digests in PROGRESS)

Baselines at 98da80e1b: conversation 229/232, one-shot 54/55, driver 149/149, parser 7/7, topics 87/87 (every failure the Linux-only kernel-pinned process-control fixture). Red-to-green: conv1 11 failed → conv2 3; conv3 9 → conv5 3; work1 → work2 → mix1; cp1 → mix1; r4b-focus 5 (three the inherited runner-import red) → r4b-focus2 1; cont1 4 (two refusal-status assertions of mine, one gate-routing assertion) → cont2 1; cont3 4 (Linux-only). Final head: ten changed consumer suites 678/682 (final6-owners.log 493cabd5…), pin/register/admission suites 77/80 (final6-pins.log b3bbb357…), one-shot alone 80/81 after the whitespace-only edit (final7-work.log 1b465c47…); every remaining failure reports "kernel-pinned process control unsupported on this host" and stays red, not relabelled. Typecheck 0, build 0, wiring 0 issues (54 declared residuals), register:check 0 (297 entries/118 rules, source 1721cf3c…), `git diff --check origin/main...HEAD` 0 with working diffs clean (a trailing space the check caught was removed in faa4660ef). Lint exit 1 with exactly one finding: the permitted native macOS R105 certificate mismatch (certified node 24.14.1, running 24.15.0); certificate unchanged, Studio-owned. Change-review check on b0d56324a (final8-review.log 35c11049…): 3071 findings, all 3009 Rule 102 absent desk report paths (the r4 record's are its Studio PROGRESS path, which does not exist on this host) and 62 Rule 70 historical evidence paths; no Rule 71/74/109/116 finding and no undispositioned prompt finding remains. Recorded real shapes replay through the typed parser and the owners' frozen recovery as before; replied=false stays absence. The r3 direct-batch reds (50 subscription-provider, 1 own-process-stop timeout) belong to the desk's measured limit-exec repair; not rerun, not touched.

Unrun or host-dependent checks: seven Linux pidfd process-control cases across four files, tests/e2e and tests/integration, the full suite, native certificate renewal, independent review (this record and the two reopened browser subjects), combined qualification, installed and live/user acceptance.

`git status --porcelain` at b0d56324a (only the desk's two untracked files, never staged):

```text
?? row02-admission-continuity-source-decision-1105.md
?? row02-r4-desk-assessment-1105.md
```

`git show --stat b0d56324ac4399d0e17d4efa64070460d2f22e08`:

```text
commit b0d56324ac4399d0e17d4efa64070460d2f22e08
Author: Adriana <adriana@mac.lan>
Date:   Thu Nov 5 10:37:39 2026 -0800

    Disposition the remaining journal prompt findings the change touches

 reviews/carryover-02-full-parity-r4-1105-change-review.md | 2 ++
 1 file changed, 2 insertions(+)
```

Commits since 98da80e1b: ebd10621f, cb89c6326, dc8ea0574, c0f83e0cd, f52485578, e5eeaa150, 4c03a1e59, df12f7d9c, 273f42b37, 0a2a92fbe, 1721cf3c3, c549b0c93, faa4660ef, b0d56324a. No hook exists (`core.hooksPath` unset, no non-sample hook) and none was bypassed.

## Separate desk and root dependencies (not source permission, not blockers of this source)

1. Installed Eight/Six/Ten/Nine process actuation: the runner composes no `stallRecovery.intervention` / `workRecovery.intervention`; exact fields, constructor and owner are in PROGRESS; nothing fabricated.
2. Non-Linux exact owned-child actuation: `scripts/process-control-kernel.mjs` refuses on macOS; no PID fallback.
3. Correct-host (Linux) runs of the seven process-control cases, native certificate renewal, independent re-review, combined full qualification, installed and live/user acceptance. Whole row 02 stays OPEN until those gates; this READY is the pushed ordinary source, including the admission-continuity source the desk's decision required, not a release.

READY b0d56324ac4399d0e17d4efa64070460d2f22e08

## Pipeline repair — inherited decision reconciliation

The prior source review at b0d56324ac4399d0e17d4efa64070460d2f22e08 already records the following engineering decisions and points to this report. Its summarized report omitted the exact identifiers. Reconciled here verbatim from reviews/carryover-02-full-parity-r4-1105-change-review.md, without claiming a new decision or altering the earlier review:

Decision: carry02-r4-nudge-first | The neutral nudge (1.x ActiveWorkSilenceSentinel) precedes any spent judgment: one per episode in the owner, one per turn in the driver, intent durable before the keystroke, thirty-second verification; a changed frame is the recovery. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-02-full-parity-r4-1105-PROGRESS.md

Decision: carry02-r4-responsiveness | 1.x SessionMonitor's ten-minute unresponsive state is a trigger only for an idle or indeterminate frame unchanged for the nurse cooldown; active frames keep the ninety-minute backstop; the notice is one per unanswered message on the pull surface. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-02-full-parity-r4-1105-PROGRESS.md

Decision: carry02-r4-typed-judgment | The review asks for the 1.x TriageOrchestrator vocabulary; the owner validates each action with deterministic predicates (confidence floor, confirmed frozen frame, replay fences, composed process effect, untouched accepted delivery) and downgrades everything else to a notice and bounded follow-up. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-02-full-parity-r4-1105-PROGRESS.md

Decision: carry02-r4-pressure | 1.x restart-loop (3 in 10 min) and auto-action (5 per hour) brakes live in bounded custody and gate supervised and lost-worker replacement, nudges and redeliveries. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-02-full-parity-r4-1105-PROGRESS.md

Decision: carry02-r4-restoration | After a host restart mid-step the one-shot owner adopts the live original worker only through the driver's identity-verified lookup with the exact intake digest, under the original edge, deadline, allowance and destination; anything else stays uncertain without replay. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-02-full-parity-r4-1105-PROGRESS.md

Decision: carry02-r4-typed-unsubmitted | The 1.x nurse fast path is a structural driver signal; its glyph exclusion applies from the input line down (the whole-capture scan could never fire after any earlier answer) and the active-frame and menu classifiers guard it. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-02-full-parity-r4-1105-PROGRESS.md

Decision: carry02-r4-degraded-notices | DegradedTmuxGuard's raise lifecycle becomes deduplicated pull notices per episode with the thirty-minute re-raise; nothing ever touches the shared server. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-02-full-parity-r4-1105-PROGRESS.md

Decision: carry02-r4-registered-watcher | The one-shot stale signal comes from the existing longer-lived registered-work watcher (live-sentinels `sentinels.work`: 60 s indeterminate silence, 90 min active, idle prompt is a wait) through `registeredWorkStale`; neither the 600 000 ms step lifetime nor the driver's 1 800 000 ms job window changes, and protected/unknown driver observations still hold. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-02-full-parity-r4-1105-PROGRESS.md

Decision: carry02-r4-restored-delegations | A restored step settles every delegation it opened before the host restart as uncertain from the journal and is never complete over one, so no child edge is silently lost. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-02-full-parity-r4-1105-PROGRESS.md

Decision: carry02-r4-runner-import | The installed runner used `observeSessionDriver` without importing it since r3's asynchronous projection commit, so every session-work launch refused with a ReferenceError ("adapter refused observeSessionDriver is not defined"); the import is restored and the launch suite is green again. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-02-full-parity-r4-1105-PROGRESS.md

Decision: carry02-r4-admission-continuity | Under the desk's source decision of 2026-11-05, an adopted claim reopens on its ORIGINAL endpoint with its ORIGINAL liability: durable one-shot call-intent ordinals through the gate's existing reserveCall hook (the journal enforces contiguity and the reservation, charging nothing twice), the contiguous high-water ordinal as the spent count with the transcript never exceeding it, the claim's own recorded endpoint read through the trusted reader and rebound as a second gate listener only after the owner's lease (busy or foreign ports refuse; a bind is never owner proof), the restored secret serving only the adopted claim, and effects prepared without an observation and open delegations restored as they are. No new store, service, protocol, grant or allowance. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-02-full-parity-r4-1105-PROGRESS.md

Decision: carry02-r4-pins | Owner-reference and grounding support-source pins are refreshed by the same hash rules the existing pin tools use, and the register is regenerated shape-only from the committed source; no certificate, authority or declaration changes. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-02-full-parity-r4-1105-PROGRESS.md

## Pipeline repair — files outside the named must-fix source paths

Every changed repository file beyond production-session-work.ts and harness.declarations.json, plus the repair desk artifacts, is listed below. Dependencies were installed from the existing lockfile and dist/ built locally; neither is staged. The desk repin tools changed no owner manifest or inventory file.

- tests/assembly/production-session-work.test.ts — reviewer regressions, identity/replay neighbors and recorded-shape replay during adoption
- reviews/carryover-02-full-parity-r4-1105-repair-change-review.md — required change review, 1.x comparison, constitutional floors and conformance evidence
- generated/capabilities.json — mechanical register publication from committed repaired source
- generated/capabilities.md — mechanical register publication from committed repaired source
- generated/coverage.md — mechanical register publication from committed repaired source
- generated/glossary.md — mechanical register publication from committed repaired source
- generated/register.json — mechanical register publication including renewed native declaration
- generated/rules.md — mechanical register publication from committed repaired source
- generated/source.json — mechanical binding of the new source commit and publication inputs
- /Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-02-full-parity-r4-1105-PROGRESS.md — required pipeline repair report plus inherited decision-ID reconciliation
- /Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-02-full-parity-r4-1105-repair-PROGRESS.md — required repair progress, evidence and final readiness report
- /Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-02-r4-repair-architecture-before.log — retained repair command output, draft or exact checker PID for auditable verification
- /Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-02-r4-repair-green.log — retained repair command output, draft or exact checker PID for auditable verification
- /Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-02-r4-repair-lint-before.log — retained repair command output, draft or exact checker PID for auditable verification
- /Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-02-r4-repair-lint-final.log — retained repair command output, draft or exact checker PID for auditable verification
- /Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-02-r4-repair-native-after.log — retained repair command output, draft or exact checker PID for auditable verification
- /Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-02-r4-repair-native-before.log — retained repair command output, draft or exact checker PID for auditable verification
- /Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-02-r4-repair-neighbors.log — retained repair command output, draft or exact checker PID for auditable verification
- /Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-02-r4-repair-owner-portable.log — retained repair command output, draft or exact checker PID for auditable verification
- /Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-02-r4-repair-owner.log — retained repair command output, draft or exact checker PID for auditable verification
- /Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-02-r4-repair-publication-draft.md — retained repair command output, draft or exact checker PID for auditable verification
- /Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-02-r4-repair-red.log — retained repair command output, draft or exact checker PID for auditable verification
- /Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-02-r4-repair-register-before.log — retained repair command output, draft or exact checker PID for auditable verification
- /Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-02-r4-repair-register-final.log — retained repair command output, draft or exact checker PID for auditable verification
- /Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-02-r4-repair-register-generate.log — retained repair command output, draft or exact checker PID for auditable verification
- /Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-02-r4-repair-review-before.log — retained repair command output, draft or exact checker PID for auditable verification
- /Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-02-r4-repair-review-draft.md — retained repair command output, draft or exact checker PID for auditable verification
- /Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-02-r4-repair-review-final.log — retained repair command output, draft or exact checker PID for auditable verification
- /Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-02-r4-repair-review-final.pid — retained repair command output, draft or exact checker PID for auditable verification
- /Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-02-r4-repair-typecheck.log — retained repair command output, draft or exact checker PID for auditable verification

## Pipeline repair — final verification and publication

Pushed branch fix/carryover-02-full-parity-r4-1105 to origin; independently read remote branch SHA 67c05f35de44f44b05f4314beeb8aab1079a192c, equal to local HEAD. Both repair commits are pushed: c71c9fb33e9e22cc5cb6a55f6456ed826e9449d7 (source/tests/contract declaration/review), then 67c05f35de44f44b05f4314beeb8aab1079a192c (generated publication and review update). Every changed repository file is in those commits; nothing under .instar/ was staged or committed.

All required cheap checks ran AFTER the final commit and BEFORE push on this exact SHA: npm run lint exit 0 (architecture passed, wiring issues [], 54 declared static-proof residuals unchanged); npm run register:check exit 0 (source c71c9fb33e9e22cc5cb6a55f6456ed826e9449d7, generation sha256:03566f2caeaa6ebf9c0a2495456d45621efb47a11455b514ab1d1055e726a687); node scripts/check-change-review.mjs check exit 0. Its actual final output:

```text
change-review: 4291 commits since adoption, 1265 records, 1175 current; 36 prompt findings among the files current changes touch or in the tree (dispositioned where a change touches them)
change-review check OK
```

Typecheck and build exit 0. Targeted portable owner verification 98/98; all 18 new adoption cases pass, including eight recorded summary/Jev/review/reply shapes through the shipped parser after adoption. Native contract 10/10 on its declared Darwin runtime; final architecture validates the renewed exact composition. The pushed source/tests are identical to the tested source/tests; the second commit changes only generated publication and review prose. No full suite or fabricated full-run report. Explicit repair scope governs the test selection; the Studio pipeline owns combined/full qualification.

Unrun or host-dependent checks: the full changed owner file's one unchanged Linux pidfd physical-actuation test fails on Darwin with 'kernel-pinned process control unsupported on this host'; its red log is retained, and the passing portable selection excludes exactly that named case without altering it. Installed process actuation, non-Linux exact-child actuation and live/user acceptance remain the review's named dependencies. Carryover row 02 stays OPEN; READY here is the pushed source repair for re-review, not release or live acceptance.

1.x comparison retained: JKHeadley/instar cc11e45f92e2590dd1bbd3c3facb5b849532f0fc / baseline b947c171f834f5e0e22d5087e090b2a9031189f9; current inspected main f94fb584bf7cfdfe0bcb5ff4526e88af512d145d has identical seven named monitoring files. Existing StallTriageNurse typed-input nudge, TriageOrchestrator validated replay and StaleSessionBackstop restoration lifecycles remain adapted through the existing 2.0 owners. Exact source/spec/history references and mismatch rationale are in the first brief and committed repair review.

After push, git diff --check origin/main...HEAD and git diff --check both exit 0.

git status --porcelain (verbatim empty output):

```text
```

git show --stat 67c05f35de44f44b05f4314beeb8aab1079a192c:

```text
commit 67c05f35de44f44b05f4314beeb8aab1079a192c
Author: Echo <echo@sagemindai.io>
Date:   Thu Nov 5 11:15:14 2026 -0800

    Publish repaired adoption composition and review evidence

 generated/capabilities.json                                      | 4 ++--
 generated/capabilities.md                                        | 6 +++---
 generated/coverage.md                                            | 4 ++--
 generated/glossary.md                                            | 4 ++--
 generated/register.json                                          | 2 +-
 generated/rules.md                                               | 4 ++--
 generated/source.json                                            | 4 ++--
 reviews/carryover-02-full-parity-r4-1105-repair-change-review.md | 2 ++
 8 files changed, 16 insertions(+), 14 deletions(-)
```

Pushed source commit evidence (git show --stat c71c9fb33e9e22cc5cb6a55f6456ed826e9449d7):

```text
commit c71c9fb33e9e22cc5cb6a55f6456ed826e9449d7
Author: Echo <echo@sagemindai.io>
Date:   Thu Nov 5 11:13:59 2026 -0800

    Preserve worker incarnation and durable replay fence on adoption

 ...-02-full-parity-r4-1105-repair-change-review.md |  33 +++++++
 src/assembly/harness.declarations.json             |   2 +-
 src/assembly/production-session-work.ts            |  29 +++---
 tests/assembly/production-session-work.test.ts     | 103 +++++++++++++++++++++
 4 files changed, 154 insertions(+), 13 deletions(-)
```

READY 67c05f35de44f44b05f4314beeb8aab1079a192c

## Pipeline repair — bounded briefing verification

The unchanged consumer test first reproduced the desk's 136-character process-control failure (8 passes/1 failure), then exposed the next row's 132-character process-control-kernel failure (8 passes/1 failure). Both README source sentences are now 125 characters, preserving all original status, authority and scope qualifications. No test or limit was changed. Replayed publication from 7914158931f51e138b031939fcc4001f7d128e65; final generation sha256:23e5994c626b4cf5d507ba7cb7216ef470022c34a792a88b5ba61dafaebefe3a.

Final targeted test: nice -n 10 npx vitest run --maxWorkers 1 tests/preview/capability-briefing.test.ts exits 0, 9/9 pass. Earlier red outputs remain in briefing-red.log and briefing-kernel-red.log; final pass is briefing-green.log, all under this absolute lanes directory. Typecheck/build exit 0. The desk rehash/repin tools changed zero pins. Final committed-head lint exits 0 (architecture passed, wiring issues [], 54 existing declared residuals); register:check exits 0. Both diff --check commands pass; working tree is clean. No full-suite run or fabricated saved report.

Model-facing boundary: direct invocation of the shipped capabilityBriefing with old and regenerated inventories yields byte-identical rendered text, sha256:60c3cee9a818c4575444a803d94e315c38eb4ddff0d50651d2d5a2e9af1ea95e. All 90 launcher-feature rows retain identical status/availability; all descriptions now satisfy 130. This follow-on changes metadata for dark features and no actual model question, parser or acceptance path. The preceding repair's real-shape replay evidence remains retained. Native declaration unchanged and architecture validates its existing byte-bound evidence. Installed actuation and live acceptance remain open.

Files touched beyond the reported assertion file, one per line:
- generated/capabilities.json — mechanical register regeneration from corrected source
- generated/capabilities.md — mechanical register regeneration from corrected source
- generated/coverage.md — mechanical register regeneration from corrected source
- generated/glossary.md — mechanical register regeneration from corrected source
- generated/register.json — mechanical register regeneration from corrected source
- generated/rules.md — mechanical register regeneration from corrected source
- generated/source.json — mechanical register regeneration from corrected source
- reviews/carryover-02-r4-briefing-length-change-review.md — required change review and verification record
- src/assembly/README.md — source sentence shortened while retaining scope and qualifications
- src/effects/README.md — source sentence shortened while retaining scope and qualifications
- /Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-02-r4-briefing-generate-final.log — retained focused verification output, review draft or exact checker PID
- /Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-02-r4-briefing-generate.log — retained focused verification output, review draft or exact checker PID
- /Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-02-r4-briefing-green.log — retained focused verification output, review draft or exact checker PID
- /Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-02-r4-briefing-kernel-red.log — retained focused verification output, review draft or exact checker PID
- /Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-02-r4-briefing-lint.log — retained focused verification output, review draft or exact checker PID
- /Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-02-r4-briefing-note.log — retained focused verification output, review draft or exact checker PID
- /Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-02-r4-briefing-publication-draft.md — retained focused verification output, review draft or exact checker PID
- /Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-02-r4-briefing-publication-final-draft.md — retained focused verification output, review draft or exact checker PID
- /Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-02-r4-briefing-red.log — retained focused verification output, review draft or exact checker PID
- /Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-02-r4-briefing-register.log — retained focused verification output, review draft or exact checker PID
- /Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-02-r4-briefing-review-draft.md — retained focused verification output, review draft or exact checker PID
- /Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-02-r4-briefing-review.log — retained focused verification output, review draft or exact checker PID
- /Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-02-r4-briefing-review.pid — retained focused verification output, review draft or exact checker PID
- /Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-02-full-parity-r4-1105-PROGRESS.md — required repair report and readiness evidence
- /Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-02-full-parity-r4-1105-repair-PROGRESS.md — required repair report and readiness evidence

## Pipeline repair — briefing publication complete

Pushed 996e31fadbd99f6f058b8f62402ca4ecf3bfe054 to origin/fix/carryover-02-full-parity-r4-1105; independent ls-remote equals HEAD. Source commits 1f7ba8f866b89c786dc656dee2d65fdc03e432af and 7914158931f51e138b031939fcc4001f7d128e65 and publication commit 996e31fadbd99f6f058b8f62402ca4ecf3bfe054 are all pushed. No .instar/ path staged or committed.

After the final commit, before push: npm run lint exit 0; npm run register:check exit 0; node scripts/check-change-review.mjs check exit 0. Final review output:

```text
change-review: 4294 commits since adoption, 1266 records, 1176 current; 36 prompt findings among the files current changes touch or in the tree (dispositioned where a change touches them)
change-review check OK
```

Targeted capability-briefing test 9/9 passes; tsc/build pass; direct generated inventory check passes all 90 launcher-feature rows and proves identical rendered model-facing note. Both offending descriptions now 125 characters with qualifications preserved. All tests and checks ran in the foreground. No full suite. Both git diff --check origin/main...HEAD and unstaged git diff --check pass after push. The existing row 02 installed actuation/live acceptance dependencies remain open; this READY reports only the pushed repair.

1.x FIRST comparison remains the exact accepted cc11e45f92e2590dd1bbd3c3facb5b849532f0fc monitoring reuse, rechecked at f94fb584bf7cfdfe0bcb5ff4526e88af512d145d; the additional scaffold/spec/history search and 2.0 briefing-specific mismatch are recorded in the first brief and committed review. No lifecycle or authority changes.

git status --porcelain (verbatim empty output):

```text
```

git show --stat 996e31fadbd99f6f058b8f62402ca4ecf3bfe054:

```text
commit 996e31fadbd99f6f058b8f62402ca4ecf3bfe054
Author: Echo <echo@sagemindai.io>
Date:   Thu Nov 5 11:33:48 2026 -0800

    Publish bounded process-control capability descriptions

 generated/capabilities.json                        | 24 +++++++++++-----------
 generated/capabilities.md                          |  4 ++--
 generated/coverage.md                              |  4 ++--
 generated/glossary.md                              |  4 ++--
 generated/register.json                            |  2 +-
 generated/rules.md                                 |  4 ++--
 generated/source.json                              |  4 ++--
 ...arryover-02-r4-briefing-length-change-review.md |  9 +++++---
 8 files changed, 29 insertions(+), 26 deletions(-)
```

Pushed source commits (git log --stat --reverse 67c05f35d..791415893):

```text
commit 1f7ba8f866b89c786dc656dee2d65fdc03e432af
Author: Echo <echo@sagemindai.io>
Date:   Thu Nov 5 11:31:18 2026 -0800

    Keep process-control capability text within the briefing bound

 ...arryover-02-r4-briefing-length-change-review.md | 28 ++++++++++++++++++++++
 src/effects/README.md                              |  2 +-
 2 files changed, 29 insertions(+), 1 deletion(-)

commit 7914158931f51e138b031939fcc4001f7d128e65
Author: Echo <echo@sagemindai.io>
Date:   Thu Nov 5 11:32:45 2026 -0800

    Bound the companion kernel capability description

 reviews/carryover-02-r4-briefing-length-change-review.md | 12 ++++++------
 src/assembly/README.md                                   |  2 +-
 2 files changed, 7 insertions(+), 7 deletions(-)
```

READY 996e31fadbd99f6f058b8f62402ca4ecf3bfe054
