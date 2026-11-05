# train-181 — builder report (2026-11-05, M5 Pro builder)

Worktree /Users/adriana/echo-compute/builders/train-181, branch train-181 created at exact
b5806d1e015dc650cdc1dee2e0accab05a849d4b (the live build, origin/fix/browser-mcp-worker-read-1104) and never
moved. docs/00-the-purpose.md and docs/01-the-rules.md were read in full first. Node 24.15.0 via nvm, `npm ci` in
the fresh worktree, INSTAR_TEST_TMP on a real short path. No hook exists (`git config --get core.hooksPath` empty,
no non-sample file in the common hooks directory) and none was bypassed; no `git stash` in any form; nothing under
.instar/ staged. The three Studio evidence snapshots were fetched with the existing token and their sha256 matched
the task footer (ab9eb25d…, 81a04123…, 32acacb9…).

## Composition

- Entry 0: origin/main c20b68d1d9b5744a72c243c4dc8a4b69114179d6 — merged (train-181-merge-main).
- Entry 1: carryover-02-full-parity-r4-1105 996e31fadbd99f6f058b8f62402ca4ecf3bfe054 — **left out** (train-181-C).
- Entry 2: session-volume-parity-1105 6b7bf8155b190cf260a2a618baea9886aeab0b13 — merged (train-181-merge-session-volume).

The record reviews/train-181-change-review.md names every decision: train-181-merge-main,
train-181-merge-session-volume, train-181-A, train-181-B, train-181-C, train-181-D, train-181-desk,
train-181-conformance.

## 1.x FIRST

This train merges reviewed heads and adds no source of its own; each member carries its own 1.x comparison in its
record (session-volume: JKHeadley/instar f3f94826 sized no scratch and grew nothing, the reused fact is the
whole-repository workload class; main's constitution commits: documents). Nothing to pull over for the merge
itself; the comparison is inherited, not re-searched.

## Left out: carryover-02-full-parity-r4-1105 (train-181-C)

Entry 1 was merged first, in order. Its merge had conflicts beyond generated/: src/assembly/harness.ts,
src/assembly/production-session-driver.ts, src/assembly/production-conversation-session.ts, both assembly test
files, the conformance certificate, the conversion pin, the grounding inventory and its constant; each product
hunk was resolved as a union of both sides and the tree typechecked. The member's own tests then exposed that the
head, on its own, is not gate-clean. Built and tested alone at 996e31fa in a separate detached worktree
(/private/tmp/i181-wt-c02, node_modules symlinked, dist built), the four pinned-text files fail 9 of 24 cases,
while the live base (/private/tmp/i181-wt-base) and the session-volume head (/private/tmp/i181-wt-svp) pass 24/24:

- tests/preview/default-context-floor.test.ts "keeps the always-sent prompt parts inside what the measured floor
  allows": summary step 23457 bytes, bound 23419 (floor 29595 − reserve 6136 − 40); the live build measures 23416.
  The 41 extra bytes are exactly "process-control, process-control-kernel, " in the capability note's "Code switched
  off here" line, the member's dark-feature publication, never paid for by a trim elsewhere.
- tests/preview/capnote-telegram.test.ts (1 case): the recorded dark-adapter note no longer matches.
- tests/preview/default-root-conversation.test.ts "keeps the declaration duty in every packet of a default-size
  root under byte pressure" (1 case).
- tests/preview/selfdesc-abilities.test.ts (6 cases): recorded K11 briefings and digest-bound replays.

The brief requires default-context-floor to pass with the guard constant unchanged. The repair (pay the bytes or
re-pin the recorded shapes) is the member's model-facing wording and recording work under observers #106 and
#299, one cause one repair; it is not a train resolution. The first local sequence that included the head
(merges d13de998, 1627f326, de9f98c5, pin c6116d60, replay f933b3fb) was never pushed; it is kept locally as
train-181-abandoned-c02 for the desk and the branch was recreated at the same base with entries 0 and 2. The
member's other test failures on this host are the known Linux-only kernel-pinned process-control cases
(production-conversation-session 3, effects/process-control 3), not part of this decision.

## Desk chain (train-181-desk) on the rebuilt train

- Merges: 29a86fe2 (main; conflicts only generated/ and the conversion pin), c619ec77 (session-volume; conflicts
  only generated/ and the conversion pin). docs/00, docs/01 and docs/01-the-rules.changelog.* byte-identical to
  main; the changelog keeps all twenty versions (Rule 90).
- Repin: the merged anchor's shape equals hash(bootstrap-shape.json) and its five document hashes match the tree;
  it carries Rules 119, 120 and 121. approvedConversion re-derived to
  sha256:5c4f6ec00fff897d806c46112f957e2a9c8fb8b314795942a2fa5ad14d2d0503 (commit ce963fa2). Owner-reference
  pins: 103 checked, 0 refreshed. Grounding inventory: 223 support sources current, constant matches.
- Build: `npm run build` exit 0. Rehash: 0.
- Replay: `build-register.mjs --replay --commit ce963fa2…` → generation
  sha256:11e3db16fe8e59f3dccd07982add170e30fcaed768befbb0e194f9713887aa48 (298 entries, 121 rules, 34 terms,
  113 prerequisites, shape-only), committed as 627c0930. `--check`: true. check-register-wiring: issues [],
  54 declared residuals.

## Always-sent bytes (train-181 at the floor, guard PREVIEW_FIXED_PROMPT_BYTES = 23_459 unchanged)

answerTotal 23166, summaryTotal 23416, reviewTotal 29254, deskCut true — byte-identical to the live build
(answer prepared 20073, summary prepared 20323 bytes on both). default-context-floor 6/6.

## Tests (foreground, `nice -n 10 npx vitest run --maxWorkers 1`, chunks under ten minutes)

All on the final tree (record and report commit excepted, which change no test input). Failures are listed
with their attribution; none is in work this train changed.

- Required set: tests/assembly/production-provider-subscription 105/105; tests/preview/default-context-floor 6/6
  (guard unchanged, bytes above); tests/e2e/register.test.ts 6/6 (291 s) run alone at a load average near 5.
  Two earlier runs of that file, in a batch and alone, timed out four shipped-CLI cases at their fixture execution
  budgets (300 s, 120 s, 60 s, 10 s hook) under a load average above 60 from other builders' vitest runs on this
  shared Mac; the session-volume head alone timed out the same four under the same load (process snapshots in the
  handoff report). The budget class is the one docs/defects/full-suite-load-timeouts.md names.
- Pinned-text set: capnote-telegram 2/2, default-root-conversation 5/5, selfdesc-abilities 11/11, guidance
  25/25 (1 skipped), summary-cascade-stall 5/5, capability-briefing 9/9, capsentence-render 20/20,
  selfdesc-limits 6/6; register tests constitution-pairing 27/27, change-review-git 37/37,
  live-rule-four-admissions 4/4, unit/test-worker-limit 8/8.
- Merged heads' changed tests: production-conversation-session, production-session-driver, conversation-topics,
  codex-conversation-worker, session-protocol-io, facts/incremental-status, integration/process-census-query
  (7 files, 519/519); session-volume 5/5 (native hdiutil cases, no volume left mounted),
  journal-conversation-session 103/103, journal-json 23/23, owner-browser-gate 13/13, resource-census-recovery 4/4.
- Every test importing a changed source (77 files by exact relative import): assembly and rungraph importers
  10 files 156/156; preview importers 38 files: 524 passed, 2 skipped, 5 failed — media-understanding (1),
  telegram-files (3) and trust-setup's Codex consumer case (1), the known host-dependent cases; e2e importers
  3 files passed, 4 skipped (10 cases, 4 passed); integration importers 3 files passed, 6 skipped (69 cases,
  42 passed, 27 skipped, including resource-owner 39/39).
- Journal family tests/preview/journal*.test.ts (112 files): 1,189 passed, 3 skipped, 6 failed — all six are
  journal-agent's "whole-response Decision fence" cases, which fail identically on the live base in its own
  worktree because the fixture activation expires within seven days of today's real clock (the launcher appends
  the activation reminder line); date-dependent, not a train change.
- Member attribution runs in detached worktrees (node_modules symlinked, dist built): live base and
  session-volume head pass the four pinned-text files 24/24; the carryover-02 head fails 9 of 24 (above).

## Checks on the final head

Run after the record-and-report commit, before the push, on the exact pushed head; the outputs and the pushed
sha are in the handoff report beside this file's path. On the replay head 627c0930: `npm run typecheck` exit 0,
`npm run build` exit 0, `node scripts/check-architecture.mjs` one finding (the permitted desk-owned R105 native
certificate mismatch: certified node 24.14.1, running 24.15.0; declaration unchanged), `node
scripts/build-register.mjs --check` check:true, `node scripts/check-register-wiring.mjs` issues [] with 54
declared residuals, and `CHANGE_REVIEW_BASE=b5806d1e… node scripts/check-change-review.mjs check` reporting only
the 3,082 Rule 102/70 locators that exist on the Studio and the Rule 74 coverage this record supplies; no Rule
109 finding, so no frozen member record is reopened.

## Constitutional rules touched

- 2, 42: no member's refusal or retained input is dropped by the combination; the omitted head is named, not
  silently absent. 3, 37, 107: every failure is reported as red with its cause; the member's own reds decided the
  omission. 44, 90: the changelog keeps every version; generated/ is regenerated, never hand-merged. 65, 74, 102,
  109, 111: one record for the train, decisions recorded, member records untouched. 66, 69: the register is replayed
  from the committed source and its wiring checks pass. 101: no hook, no bypass. 113: machine-local, deliberately.
  116: ordinary merges, the existing desk chain, nothing added. 119–121: main's text exactly.
- Floors: secrets, spend cap, stop, no duplicate sends and durable intake are unchanged by the combination.
- The constitution and the task did not conflict; the one judgment (omit a red member) is recorded as
  train-181-C under desk decision C.

## Unrun or host-dependent checks

- `npm run lint` exits 1 only on the desk-owned R105 native certificate finding; check-register-wiring run
  directly passes. The Studio's contract run re-declares the certificate (train-181-conformance).
- The change-review check's Rule 102 and Rule 70 findings for absolute Studio report paths exist only on the
  Studio.
- journal-agent's six Decision-fence cases (date-dependent, identical on the live base); media-understanding,
  telegram-files and trust-setup's Codex case (no transcriber model, no _instarharness user, no codex binary).
- Not run here, owed to the desk: the full suite, the combined candidate gate, the independent Astra review, the
  native certificate re-declaration, the live proof, and the carryover-02 repair and re-review.
- Exit 137: none. No load test, nothing killed, nothing run in the background except this host's own harness
  moving three over-ten-minute foreground calls aside; every result above was read from their logs.

## Push

The pushed sha, `git status --porcelain` and `git show --stat` are in the handoff report at
/Users/adriana/echo-compute/builders/train-181-report.md, written after this file was committed.
