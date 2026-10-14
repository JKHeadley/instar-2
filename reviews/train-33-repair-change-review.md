# Change review — restore harness isolation after macOS reboot

Subject base: e12531edee5f8bd2d4c9ab0ead6b48f0bfc27fe0
Review state: open
Reviewed content: none
Outcome: Restore the existing harness temporary-file ACL automatically after macOS recreates /private/tmp, so the unchanged readiness checkpoint can admit model launches.
Affected rules: Purpose ability/checkpoint direction; Rules 1, 4, 15, 24, 25, 26, 34, 36, 37, 46, 49, 70, 74, 77, 101, 102, 111, 112, 113, 116.
Affected floors: secrets — exact inherited deny restored under root-owned boot provisioning and fresh-canary readiness retained; spend cap — reservation unchanged; stop — launch and dispatch guards unchanged; no duplicate sends — no journal replay or messaging action; durable intake — retained copy stays read-only and accepted input is preserved.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Machine-local administrator provisioning restores an existing security prerequisite; no model-facing code, protocol, permissions or capability set changes.
Side effects: New root-owned launch daemon runs /bin/chmod once at boot. New temporary entries inherit the same existing harness denial; older runner-owned entries still require the existing readiness sweep. The job runs no agent-writable code and has no keepalive or polling. Reinstallation coalesces the same ACL; a different existing job or symlink refuses without replacement.
Undo and recovery: Administrator bootout of system/ai.instar.harness-tmp-acl and removal of its plist removes boot persistence, retaining the currently installed ACL. Revert this commit to withdraw the installer and documentation. No live runner restart or retained-journal mutation occurred. Do not replay previously dispatched work.
Multi-machine posture: Deliberately machine-local; each macOS harness host provisions its own root-owned job. Existing conversation ownership, replicated intake and effect deduplication are unchanged.
Layer below: Read both constitutional documents, retained journal status for update 715675937, launch log, host reboot time and directory birth/ACL, existing tmp-acl.sh, harnessReadiness and actual kernel probe. Confirmed the earlier train-32 disk-arbitration fault was distinct. Verified root ownership/mode, launchd last exit 0, the real installed profile's readiness, two recreated-directory replays of the exact emitted command and an unchanged usable harness temporary area.
Bug class: live-path
Bug evidence: reproducer=tests/preview/harness-tmp-boot.test.ts live=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-33-repair-PROGRESS.md
Hook bypass: none
Convergence: none
Prompt review: No prompt, parser, reply selection or model judgment change. The failure precedes all model execution. Real evidence is kernel access and host readiness; no fresh delivered-answer acceptance is claimed.
Decision: train-33-repair-boot-acl | Persist the existing inherited deny with a root-owned RunAtLoad job using only /bin/chmod and fixed arguments; a one-time chmod loses protection on directory recreation. Keep the runtime checkpoint intact. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-33-repair-PROGRESS.md

Subject: docs/harness-tmp-isolation.md, scripts/install-harness-tmp-acl.sh, tests/preview/harness-tmp-boot.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: the existing OS boot facility reapplies the existing ACL, with no new runtime service, retry machinery or reduced capability. Administrator/root identity guards installation; exact job bytes guard replacement; actual kernel readiness remains the launch guard. The boot job completed unattended with exit 0 and full installed-profile readiness passed. A fresh Telegram answer remains the pipeline's acceptance test, not a claimed result here.
80/20: Five focused installer tests plus real before/after kernel access, repeated installation and recreated-directory replay; TypeScript and the cheap architecture/register/review gates. No full suite or host reboot was run by this repair.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
