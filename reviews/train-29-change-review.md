# Change review — train-29 conversation admission and acknowledgement deadline

Subject base: ac3bd4d8874495f8b66b571837a1380995113d7a
Review state: open
Reviewed content: none
Outcome: Combine the exact live base with approved main design text, reserved repair topic admission and a receipt-aware acknowledgement deadline.
Affected rules: Purpose 2/3/6; Rules 1, 4, 13, 26, 28, 29, 34, 36, 37, 42, 46, 49, 52, 55, 57, 63, 68, 70, 74, 75, 77, 87, 90, 91, 95, 101, 102, 111, 112, 113, 116.
Affected floors: Secrets and stop retain their existing gates. Spend uses the existing bounded repair and notice reservations. Durable intake and no duplicate sends remain enforced by authoritative parent send receipts; repair execution identities never become separate send identities.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Composition of reviewed conversation execution, durable repair admission and acknowledgement scheduling, retaining the live base.
Side effects: Reserved format repairs inherit the parent's topic only after durable admission. Slow answers may use one notice allowance three seconds earlier. Seven-second acknowledgement intents remain replayable alongside older eight/ten-second intents. No new model gate, authority, retry loop or store. Main design text is unchanged; changelog histories preserve both branches. Source pins and generated publications are refreshed by existing desk tools.
Undo and recovery: Revert the combined candidate before deployment, without rewriting its history. After use retain the seven-second replay floor and durable repair identity readers; never erase journals or retry UNKNOWN sends. No live deployment is performed here.
Multi-machine posture: Existing conversation ownership and durable journal/send fences remain authoritative. The host owns reusable sessions; other machines gain no new dispatch rights. Build and offline checks are local to WSL; Studio performs host-bound acceptance.
Layer below: Inspect the production topic lookup against accepted/reserved/answerRetried journal fields and the canonical format-retry marker; inspect separate execution digests and the parent send receipt. Inspect timer admission, replay floor and final-dispatch suppression, retaining eligibility during pending review. The merge preserves exact reviewed source bytes and base ancestry.
Bug class: integration
Bug evidence: reproducer=tests/preview/journal-conversation-session.test.ts; live=tests/preview/fixtures/repair-admission-rewalk-2026-10-14.json
Hook bypass: none; core.hooksPath unset and common hooks directory contains only sample hooks.
Convergence: none
Prompt review: No new model wording or parser in this composition. Replay the members' recorded repair packets and summary/uncertain/Jev/reply-review/delivered/empty candidate shapes through the production topic coordinator, plus the recorded acknowledgement timelines. Simulated successful repair outputs and injected timing are not described as fresh live judgments.
Prompt finding: e8708c7fea24 | protocol-literal | Existing source attribution instruction is unchanged; fixture checks delivery of evidence labels, not intent classification.
Prompt finding: 849db3a6296a | protocol-literal | Existing empty-memory renderer is unchanged; literal names the exact inventory state, not a new classifier.
Decision: train-29-main | Ordinary merge of ea8808d878b9a1d673e9fba1755a72261074fd1c; reviews/amend-single-machine-1013.md and reviews/install-platform-neutral-1013.md. Preserve main text and both changelog histories, rendering Markdown from merged JSON. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-29-PROGRESS.md
Decision: train-29-admission | Ordinary merge of d53ed65386a3c4d2be9069ce2b0b0752f0b1c944; /Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1h-repair-admission-1014-PROGRESS.md and reviews/step1h-repair-admission-1014-change-review.md. Retain reserved child admission and its inherited conversation-session work. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-29-PROGRESS.md
Decision: train-29-deadline | Ordinary merge of f4b799e305593c6e15acd759a01a5d1d5afb9de5; /Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1i-ack-deadline-1014-PROGRESS.md and reviews/step1i-ack-deadline-1014-change-review.md. Preserve the seven-second timer and replay floor plus final-dispatch suppression. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-29-PROGRESS.md
Decision: train-29-desk-A | Both reviewed behaviors merge without source conflict. Changelog collisions retain live history unchanged and append distinct main entries with fresh sequential revision numbers. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-29-PROGRESS.md
Decision: train-29-desk-B | Create the new branch directly at ac3bd4d8874495f8b66b571837a1380995113d7a; preserve that ancestry and use only the exact reviewed heads despite newer branch tips. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-29-PROGRESS.md
Decision: train-29-desk-C | No genuine product conflict and no head omitted. All three merges complete ordinarily; generated publications are regenerated, never hand-merged. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-29-PROGRESS.md
Decision: train-29-desk-D | Run changed/direct-import and explicitly required tests in bounded foreground chunks; classify unavailable Studio evidence and macOS-bound checks without changing declarations to hide them. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-29-PROGRESS.md
Decision: train-29-repin | Run the existing repin/build/owner-rehash/register-replay chain from cint-L37; refresh the changed contracts inventory pin and its digest, preserving the floor constant and authority declarations. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-29-PROGRESS.md

Decision: train-29-review-base | Make the imported incomplete platform guide a train-scoped composition review at the exact live base, preserving the original guide from da99cd521f8eb7a11c0fee24961df13d47d19f9e as quoted history. Its original creation parent is 7ef8f158d4129a4cf90cf3c546701f32e348fdd3, but using that as the current review scope incorrectly included unrelated historical runtime changes. No governing design or convergence claim changes. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-29-PROGRESS.md

simplestRobustRoute: This is the simplest robust route: ordinary merges of the reviewed heads plus existing generation tools and direct consumer checks. No new orchestration or policy mechanism. Start guards remain verified durable intake and exact reserved repair admission; end guards remain durable completion and unique parent sends; timer and repair caps bound resource use. Offline replay is evidence of composition, not unattended live acceptance; that remains the desk's gate.
80/20: Changed tests, direct imports, journal suites and named register/briefing checks only, with foreground chunks under ten minutes; no full suite or load generation.
VERDICT: author submission for desk review; no independent convergence or live acceptance claimed
