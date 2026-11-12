# Change review — train-239

Subject base: d1823a36e8b0a3c155dbc723dd6aebc0666e9934
Review state: open
Reviewed content: none
Outcome: Integrate the exact reviewed private-report slice on the live train base, preserving owner-bound dashboard access, durable report creation and send uniqueness.
Affected rules: 7, 28, 32, 33, 34, 36, 37, 43, 47, 49, 57, 60, 62, 63, 65, 69, 74, 78, 79, 80, 81, 84, 90, 101, 102, 106, 111, 112, 113, 116, 120, 122, 123
Affected floors: secrets — existing title/body and outbound checks; spend cap and stop — existing worker gates; no duplicate sends — existing durable intent and accepted/unknown send claims; durable intake — existing journal, no second store.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Reviewed private-content surface and model output contract integrated without product edits.
Side effects: Optional privateViewTitle creates a seven-day report from the final reviewed reply; an existing private dashboard session admits its owner. Adds marked 17.0.5, currently absent from the Studio shared dependency folder. Tests that import the renderer cannot run successfully until the desk provisions that dependency; no validation or live acceptance is claimed from missing-dependency failures.
Undo and recovery: Revert the integrated feature and regenerate the register together; existing journal fields, send fences and original reply remain. No live runner or installed root is changed by this integration.
Multi-machine posture: Owning conversation's existing durable journal and lease fencing remain authoritative. URLs identify the issuing dashboard; no cross-host URL rewriting. Dashboard sessions are machine-local and reset on restart; reports and send claims persist.
Team posture: Preserve the reviewed team-of-one exception: only the verified operator's private conversation creates reports, only that operator's existing PIN session views them. Members, guests and URL holders acquire no sharing grant. No new authority or sharing default.
Layer below: Exact member source/reviews, actual 1.x source and history, dashboard PIN session and HTTP path, journal projection and send claims, runner imports, shared dependency resolution, context guards and generated register.
Bug class: integration
Bug evidence: reproducer=tests/preview/private-view.test.ts
Hook bypass: none
Convergence: none
Decision: train-239-M1 | Ordinary merge of exactly 1a25d85f23e465211b12115bf0b4bdee8f190b25 fast-forwarded without conflicts; member evidence /Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-90-private-view-1112-p2-PROGRESS.md. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-239-PROGRESS.md
Decision: train-239-A | Preserve all reviewed member and live-base behavior byte-for-byte; generated output is replayed, never hand-merged. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-239-PROGRESS.md
Decision: train-239-B | Prepared separate train-239 worktree already starts at exact live base d1823a36e8b0a3c155dbc723dd6aebc0666e9934. No branch move, main merge or newer member tip. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-239-PROGRESS.md
Decision: train-239-desk | Use the existing repin, build, owner-rehash and register replay chain. Copy the original research report to its requested canonical Studio destination; p2 report already present. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-239-PROGRESS.md
Decision: train-239-deps | Retain the reviewed marked dependency and report actual missing-package failures; do not alter shared node_modules, guards or timeouts to obtain green checks. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-239-PROGRESS.md
Decision: train-239-review-repair | Extend the original research record through its authorized implementation with an explicit historical boundary; name the exact no duplicate sends floor, carry inspected protocol/quoted-evidence dispositions and restore the three-line closing block. No product, prompt or test edits. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-239-PROGRESS.md
Prompt review: Preserve the member's generated privateViewTitle contract. Required recorded bytes are in retrospective-duty-followup-train-1-2026-10-08.json: summary 715672480, uncertain 715672483, Jev undecided 715672482, Jev unsure 969389570, reply review 969389923, delivered 715672479 and empty 715672550. The member's accepted replay is recorded in its report. This train reports its actual replay result separately, never treating an import failure as a replay pass.
Prompt finding: 105c1569b6bb | quoted-evidence | Existing production wording tested verbatim; not a new semantic classifier — fixture-phrase tests/preview/journal.ts <- tests/preview/closing-notice-boundary.test.ts: "once stopped, this installation refuses renewal."
Prompt finding: 4106b49fff07 | quoted-evidence | Existing production wording tested verbatim; not a new semantic classifier — fixture-phrase tests/preview/journal.ts <- tests/preview/topic-awareness.test.ts: "you attempted nothing outside this reply, so never call an avenue tried; a missi"
Prompt finding: 7ef11b68103f | quoted-evidence | Existing production wording tested verbatim; not a new semantic classifier — fixture-phrase tests/preview/journal.ts <- tests/preview/closing-notice-boundary.test.ts: "after that it cannot read or answer messages here. its activation must be renewe"
Prompt finding: 849db3a6296a | quoted-evidence | Existing production wording tested verbatim; not a new semantic classifier — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: 85544c20941f | quoted-evidence | Existing production wording tested verbatim; not a new semantic classifier — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-conversation-session.test.ts: "your messages are kept and i'll answer them then; you don't need to resend them."
Prompt finding: 9f0106c66027 | quoted-evidence | Existing production wording tested verbatim; not a new semantic classifier — fixture-phrase tests/preview/journal.ts <- tests/preview/plain-task-stop.test.ts: "the reason is unknown. your request and this incomplete attempt are saved. this "
Prompt finding: bac6ce7485d9 | quoted-evidence | Existing production wording tested verbatim; not a new semantic classifier — fixture-phrase tests/preview/journal.ts <- tests/preview/plain-task-stop.test.ts: "work on your request stopped before a finished answer was available."
Prompt finding: e8708c7fea24 | quoted-evidence | Existing production wording tested verbatim; not a new semantic classifier — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel; disclose unknown sources."
Prompt finding: 4b98dc2a1b9f | quoted-evidence | Existing toolsBriefing label is asserted in selfdesc-abilities.test.ts and adapted in its recorded-note helper; unchanged descriptive capability text, not a classifier copied from a test.
Prompt finding: 95e349aaf4ac | quoted-evidence | Existing toolsBriefing standing-grant description is checked verbatim by selfdesc-abilities.test.ts; unchanged authority guidance, not a new fixed-phrase judgment.
Deferral: generated/register.json:1 | not-a-deferral=Generated historical register text, not a new commitment or omitted integration work.

## 1.x comparison

Confirmed actual JKHeadley/instar main db3ed6d3052cfcc24888b6c8bc86086abcfc2987 with git ls-remote; searched src/, docs/specs/ and PrivateViewer history (948d48d0a, ab26b7ca3). Read src/publishing/PrivateViewer.ts create/get/title/Markdown/timestamp behavior, src/server/routes.ts:28718-28818 bounds and missing refusal, src/server/middleware.ts:904-917 sandbox. Matching specs are dashboard-conversations-browser-device.md §4.12, DOORWAY-MODEL-KNOWLEDGE-REGISTRY-SPEC.md §2.7 and MULTI-MACHINE-SEAMLESSNESS-SPEC.md WS4.4. Preserve the member's adapted create/get/provenance and marked GFM rendering. Signed bearer URLs and unavailable 1.x PIN form do not fit owner-only access; 2.0 PIN/session and durable journal/send replace them, with private-view HTTP/restart tests as evidence. Read Studio ONEX-LESSONS.md §3: retain send intent, never infer non-send from an ambiguous timeout, refuse empty-visible delivery.

No new product lines in this integration. Member size remains 190 changed product lines (191 counting runtime-consumed README text), under its expressly authorized 300-line complete-slice ceiling. That size covers creation, provenance, admission, rendering, delivery, dependency and declarations; the train adds only review and generated replay.

Desk C is unused: no conflicts or left-out heads. Desk D is unused: missing marked affects changed code on Studio, not a remote host exemption. Always-sent allowance is the reviewed 23,619 bytes, default turn headroom 3,013 against unchanged 3,000 guard; member measured summary envelope 23,575. No guard or timeout changes by this train.

Desk replay: final review-repair source 8acfa8aa7f737173559fd26efdef543abb03dcf3 produced generation sha256:7d52e4546160de46db415d3532814b7ced5b3a722fbb2554ee5bba8e17a01291 (309 entries, 123 rules, shape-only replay). Inventory and owner-reference rehash changed no pins; architecture passed with no R105 finding.

simplestRobustRoute: One ordinary exact-head merge and the established desk chain. Reuse the reviewed implementation unchanged; add no runtime mechanism. Start is the specified live base, end is integrated committed bytes and truthful verification, limits are the five existing floors and the shared-dependency prohibition. Live phone proof and independent landing approval are not claimed here.
80/20: Target changed files and direct consumers plus mandated context/register/provider checks; no full repository suite. Preserve failures as evidence and identify their cause.
VERDICT: author integration submission; independent desk owns acceptance
