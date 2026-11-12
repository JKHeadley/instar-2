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
Prompt review: Preserve the member's generated privateViewTitle contract. Required recorded bytes are in retrospective-duty-followup-train-1-2026-10-08.json: summary 715672480, uncertain 715672483, Jev undecided 715672482, Jev unsure 969389570, reply review 969389923, delivered 715672479 and empty 715672550. The member's accepted replay is recorded in its report. This train reports its actual replay result separately, never treating an import failure as a replay pass.
Deferral: generated/register.json:1 | not-a-deferral=Generated historical register text, not a new commitment or omitted integration work.

## 1.x comparison

Confirmed actual JKHeadley/instar main db3ed6d3052cfcc24888b6c8bc86086abcfc2987 with git ls-remote; searched src/, docs/specs/ and PrivateViewer history (948d48d0a, ab26b7ca3). Read src/publishing/PrivateViewer.ts create/get/title/Markdown/timestamp behavior, src/server/routes.ts:28718-28818 bounds and missing refusal, src/server/middleware.ts:904-917 sandbox. Matching specs are dashboard-conversations-browser-device.md §4.12, DOORWAY-MODEL-KNOWLEDGE-REGISTRY-SPEC.md §2.7 and MULTI-MACHINE-SEAMLESSNESS-SPEC.md WS4.4. Preserve the member's adapted create/get/provenance and marked GFM rendering. Signed bearer URLs and unavailable 1.x PIN form do not fit owner-only access; 2.0 PIN/session and durable journal/send replace them, with private-view HTTP/restart tests as evidence. Read Studio ONEX-LESSONS.md §3: retain send intent, never infer non-send from an ambiguous timeout, refuse empty-visible delivery.

No new product lines in this integration. Member size remains 190 changed product lines (191 counting runtime-consumed README text), under its expressly authorized 300-line complete-slice ceiling. That size covers creation, provenance, admission, rendering, delivery, dependency and declarations; the train adds only review and generated replay.

Desk C is unused: no conflicts or left-out heads. Desk D is unused: missing marked affects changed code on Studio, not a remote host exemption. Always-sent allowance is the reviewed 23,619 bytes, default turn headroom 3,013 against unchanged 3,000 guard; member measured summary envelope 23,575. No guard or timeout changes by this train.

simplestRobustRoute: One ordinary exact-head merge and the established desk chain. Reuse the reviewed implementation unchanged; add no runtime mechanism. Start is the specified live base, end is integrated committed bytes and truthful verification, limits are the five existing floors and the shared-dependency prohibition. Live phone proof and independent landing approval are not claimed here.
80/20: Target changed files and direct consumers plus mandated context/register/provider checks; no full repository suite. Preserve failures as evidence and identify their cause.
VERDICT: author integration submission; independent desk owns acceptance

Desk replay: source 013556713bd311551e9c198336a091b076a5593e produced generation sha256:efc1e6a7bc4ca4894bc28c7e3677bdf4bead3334bf5eea927ce52e0e7e6a3367 (309 entries, 123 rules, shape-only replay). Inventory and owner-reference rehash changed no pins; architecture passed with no R105 finding.
