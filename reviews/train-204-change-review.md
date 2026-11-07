# Change review — train-204 reply-review cause integration

Subject base: aa57099431437e93881ea6ec7cdd060294ccfc80
Review state: open
Reviewed content: none
Outcome: Integrate the exact reviewed reply-review-cause-1107 head 3ff20a8936008743f00767b6da262913cc9177cc onto the live build so every unavailable reply check records its closed-set reason, and replay the register.
Affected rules: 2, 9, 37, 38, 39, 41, 66, 69, 73, 74, 90, 101, 102, 111, 113, 116
Affected floors: secrets (closed-set cause and causeDetail only, the member's repaired allowlist carried byte for byte), spend cap, stop, no duplicate sends and durable intake remain unchanged; no model call, prompt, parser or send decision added.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: The paths are the reply-check and journal core, so the suggested tier stands and is carried from the member records; the train adds no edit of its own beyond the ordinary merge, whose source auto-merged with the base's journal.ts edits, and the regenerated generated/ files.
Side effects: Reply-check, revision-review and crash-recovery rows gain optional cause and causeDetail fields, shown in inspect and counted in status. Old rows read unrecorded. The base's stopped-task notice and continuity edits in journal.ts are kept alongside. Generated publication identifies the merged commit.
Undo and recovery: Revert the merge and replay the register from the reverted source; the new fields are optional and old readers ignore them, so no runtime state migration.
Multi-machine posture: Unchanged journal ownership and replication; no new state, writer or row kind. Verification ran on the Mama PC (WSL); the Studio owns native, e2e and live acceptance.
Layer below: Read the constitution in full, the member report with its repair (Astra M1 closed detail set) and the cint-L37 desk-chain report. Per file, the merged tree differs from the member head by exactly the base's own diff since the merge base e8c2a0b156ae412bcdcb4e020dd2cd6ef4d9098d (journal.ts 143 lines, preview.json 22 lines, all other member files 0), so both sides are preserved. 1.x comparison inherited from the member: JKHeadley/instar main 015fa6cb16add5552cba7e86b7c02a2c083e2579 src/core/MessagingToneGate.ts and docs/specs/tone-gate-graceful-degradation.md.
Prompt review: no prompt, parser or accept, escalate or refuse decision changes in the merge or the member; no code branches on cause. Recorded shapes replayed on the merged tree: jev-admission-2026-10-12 (update 969390426) and jev-unavailable-2026-10-11 through jev-retry.test.ts and reply-review-cause.test.ts, and the group-audience-live-2026-10-10 fixture's unavailable revision review through group-audience.test.ts; all pass.
Prompt finding: 0abb3dc96311 | protocol-literal | carried unchanged from the merged inputs; as dispositioned in reviews/reply-review-cause-1107-repair-change-review.md: existing prompt wording, unchanged by this diff
Prompt finding: 4106b49fff07 | protocol-literal | carried unchanged from the merged inputs; as dispositioned in reviews/reply-review-cause-1107-change-review.md: existing prompt wording, unchanged by this diff
Prompt finding: 5b486d8bd247 | protocol-literal | carried unchanged from the merged inputs; as dispositioned in reviews/reply-review-cause-1107-repair-change-review.md: existing prompt wording, unchanged by this diff
Prompt finding: 5fa1a20c4031 | protocol-literal | carried unchanged from the merged inputs; as dispositioned in reviews/reply-review-cause-1107-repair-change-review.md: existing prompt wording, unchanged by this diff
Prompt finding: 7c45ffbe90ad | protocol-literal | carried unchanged from the merged inputs; as dispositioned in reviews/reply-review-cause-1107-repair-change-review.md: existing prompt wording, unchanged by this diff
Prompt finding: 849db3a6296a | protocol-literal | carried unchanged from the merged inputs; as dispositioned in reviews/reply-review-cause-1107-change-review.md: existing prompt wording, unchanged by this diff
Prompt finding: 85544c20941f | protocol-literal | carried unchanged from the merged inputs; as dispositioned in reviews/reply-review-cause-1107-change-review.md: existing prompt wording, unchanged by this diff
Prompt finding: 9f0106c66027 | quoted-evidence | carried unchanged from the merged inputs; as dispositioned in reviews/train-195-repair-002913-change-review.md: literal bytes of the parent notice, quoted in the test as historical evidence; nothing is asked of a model — fixture-phrase tests/preview/journal.ts <- tests/preview/plain-task-stop.test.ts: "the reason is unknown. your request and this incomplete attempt are saved. this "
Prompt finding: aef7d91bef51 | protocol-literal | carried unchanged from the merged inputs; as dispositioned in reviews/reply-review-cause-1107-repair-change-review.md: existing prompt wording, unchanged by this diff
Prompt finding: b288d6ef1604 | protocol-literal | carried unchanged from the merged inputs; as dispositioned in reviews/reply-review-cause-1107-repair-change-review.md: existing prompt wording, unchanged by this diff
Prompt finding: bac6ce7485d9 | quoted-evidence | carried unchanged from the merged inputs; as dispositioned in reviews/train-195-repair-002913-change-review.md: literal bytes of the parent notice, quoted in the test as historical evidence; nothing is asked of a model — fixture-phrase tests/preview/journal.ts <- tests/preview/plain-task-stop.test.ts: "work on your request stopped before a finished answer was available."
Prompt finding: e769ca9dd959 | protocol-literal | carried unchanged from the merged inputs; as dispositioned in reviews/reply-review-cause-1107-repair-change-review.md: existing prompt wording, unchanged by this diff
Prompt finding: e8708c7fea24 | protocol-literal | carried unchanged from the merged inputs; as dispositioned in reviews/reply-review-cause-1107-change-review.md: existing prompt wording, unchanged by this diff
Prompt finding: f6d7f3274c85 | protocol-literal | carried unchanged from the merged inputs; as dispositioned in reviews/reply-review-cause-1107-repair-change-review.md: existing prompt wording, unchanged by this diff
Prompt finding: feadb66b8ad1 | protocol-literal | carried unchanged from the merged inputs; as dispositioned in reviews/reply-review-cause-1107-repair-change-review.md: existing prompt wording, unchanged by this diff
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath unset, common hooks directory holds no non-sample file.
Convergence: none
Decision: train-204-merge | Ordinary merge of exact reviewed 3ff20a8936008743f00767b6da262913cc9177cc (report /Users/dabombstudio/.instar/agents/echo/.instar/lanes/reply-review-cause-1107-PROGRESS.md, read through the Studio snapshot); source auto-merged, generated/ taken from the base and regenerated. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-204-PROGRESS.md
Decision: train-204-A | Keep both sides in tests/preview/journal.ts and register-source/owner-references/preview.json; verified per file against the member head and the base diff, no product edit. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-204-PROGRESS.md
Decision: train-204-B | Branch created directly at exact live aa57099431437e93881ea6ec7cdd060294ccfc80, which already contains origin/main; no main merge and no later branch move. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-204-PROGRESS.md
Decision: train-204-C | No genuine product conflict; the sole member is included and no head is left out. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-204-PROGRESS.md
Decision: train-204-D | Report the WSL host-dependent failures in unchanged scripts/production-boot-io.mjs paths (production-provider-subscription, three journal.test.ts process and launch cases) and the e2e register timeout; Studio decides. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-204-PROGRESS.md
Decision: train-204-desk | Downloaded desk chain: repin 0 (Linux sed), tsc build 0, rehash 0 pins, build-register --replay at eeaf8e8548890c8d019987216ebfaf8fd7f1125b committed as the register commit; check true. No generated hand edit or guard change. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-204-PROGRESS.md

## Closing block

simplestRobustRoute: An ordinary merge of the reviewed head and the existing generation chain is the simplest robust route. No added machinery. Start at the exact live base, preserve all five safety floors, test both sides of the shared file and leave deployment to the desk. No autonomous product-completion claim.
80/20: Targeted foreground files for the member, the base's overlapping journal edits, the required floors and the READY-gate list; no full suite and no base comparison worktree.
VERDICT: author submission; independent desk review pending
