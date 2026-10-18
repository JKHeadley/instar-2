# Change review — sb-w4-replycheck pipeline repair: harness readiness and a concurrent turn's mount point (plan #542)

Subject base: 49b3beeefca8fa207d0370d289925e4306a8eef1
Review state: open
Reviewed content: none
Outcome: The answer check on a copy of the live preview gave no real answer for 49b3beee (preview-deploy.log 16:54:55, browser stalled). The runner's own status line names the cause: "Harness identity: UNAVAILABLE, so every Claude Code launch is held ... the harness user can read /private/tmp/itw-fec8e62394ff". That entry is a conversation workspace mount point (tests/preview/tool-turn.mjs attachScratch/conversationWorkspace) of another root running on the same machine and account: its tool turn made the plain 0700 itw-<key> directory, the readiness sweep (closeOperatorTmp) listed it as the runner's own entry, then the turn attached its volume there and granted it to the harness (grantVolume) before the probe, so the probe read it and readiness refused. The entry was already gone when diagnosed. The unit's own change (the 60 s reply-check budget) is not involved: no launch ran. Repair at the source: an exposed row among the swept /private/tmp entries counts only while sweptEntryHeld says it is still what the sweep closes (the runner's own entry, not a link, on /private/tmp's device); one that became a mounted volume is the same thing the sweep already skips by design. The denied paths and the login custody are never excused by that check.
Affected rules: 84 (the harness identity still never falls back to the operator's account; a not-ready check still holds every launch), 37 (fixed at source, no quarantine), 116 (one re-check of the sweep's own rule, no retry loop or new machinery), 34 (both sides of the new decision proven), 66, 69, 90 (register replayed, not hand-edited), 74 (this record), 101 (plain commits), 102 (the decision below), 113 (machine-local)
Affected floors: secrets — unchanged: the probe still confirms the kernel refuses the operator home, the root, the runner state, the login custody, every swept entry that is still the runner's own plain entry, and a fresh /private/tmp canary; the only entry excused is one that has become a mounted workspace volume, which the sweep never closes and which grantVolume opens to the harness deliberately; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: a narrowing of one readiness refusal to the sweep's own existing rule in a preview harness file, plus its tests and the regenerated register; what the harness may read is unchanged.
Side effects: a runner launched while another root's tool turn is attaching its workspace volume is now ready instead of holding every Claude Code launch until a later launch re-checks; generated/ carries generation sha256:506ece6da03dbd583503fd0b1422fe51dc2000136e1e29ca128b2728674b0e64.
Undo and recovery: revert 33f8930c and its register replay c169ada9; nothing is migrated and no stored state changes.
Multi-machine posture: machine-local, deliberately — the readiness check reads this machine's /private/tmp for this machine's harness user; nothing crosses machines.
Layer below: tests/preview/tool-turn.mjs attachScratch and prepareToolTurn (mkdir the 0700 mount point, hdiutil attach, chmod, grantVolume), unchanged; tests/preview/harness-user.mjs closeOperatorTmp (skips links, other owners and mount points), unchanged; reviews/sb-w4-replycheck-change-review.md (the merge this repairs).
Bug class: live-path
Bug evidence: reproducer=tests/preview/harness-user.test.ts; live=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/preview-deploy.log
Hook bypass: none
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Decision: sbreplycheck-readiness-mount-race | an exposed swept /private/tmp entry is re-checked against the sweep's own rule after the probe rather than retrying the whole readiness check or ignoring itw- names, because the sweep already defines what it closes (the runner's own non-link entry on /private/tmp's device) and a name pattern or a retry would either excuse a real exposure or still lose the race | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-replycheck-PROGRESS.md
Prompt review: no system prompt, provider policy, model input or verdict parsing changed; the change is a readiness check on file access.
Deferral: generated/register.json:1 | not-a-deferral=generated register output, written by scripts/build-register.mjs and never hand-authored

Subject (9 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, tests/preview/harness-user.mjs, tests/preview/harness-user.test.ts

## Closing block

simplestRobustRoute: the required behavior is that readiness refuses only a real exposure. The sweep already states which entries it closes; re-applying that same rule to an exposed swept row after the probe is one small exported function and one filter, and keeps the denied paths and custody unconditional.
80/20: tests/preview/harness-user.test.ts 43/43 (new: a swept entry that became a mount is not an exposure and the check is asked only for it; one still held is an exposure; denied paths and custody refuse whatever the check says; sweptEntryHeld true for the runner's own plain directory and false on another device, another uid, a link and a missing path). tsc --noEmit exit 0, npm run lint exit 0 with "issues":[], npm run register:check true. The full suite is the gate host's.
VERDICT: author submission; no independent pass is recorded for this record
