# Change review — train-177 signed-cache owner integration

Subject base: 9af3305b179c09906e3efdea59fa1dd629a68eeb
Review state: open
Reviewed content: none
Outcome: Integrate only the existing 0c1d832a4816aeb21891e5a89242497d12c76fc1 signed-cache fix into train-177, retaining reaper, register/proof test fixes and model-map evidence.
Affected rules: 26, 34, 36, 37, 42, 49, 55, 60, 69, 70, 74, 101, 102, 105, 107, 111, 112, 113, 116, 122.
Affected floors: secrets — unchanged custody; spend cap — no new calls/retries; stop — existing checks; no duplicate sends — no copy replay; durable intake — existing journal and retained turns unchanged.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Existing-owner deterministic provider preflight repair; no new policy or authority design.
Side effects: Bounded recognized signature/issuance metadata is excluded from effective-policy digest; the pinned CLI owns cryptographic verification. Pre-cache enrollment remains valid only for the existing restrictive schema; cache-bound enrollment retains content and identity bindings. Managed hooks, unknown policy, unsafe paths and permissive settings still refuse. No runtime cache policy widening beyond the exact owning patch.
Undo and recovery: Revert this integration and regenerate derived references/register. Retained failed turns remain available; never resend an uncertain effect. No installed state changes.
Multi-machine posture: Machine-local provider cache inspection under each recorded profile. WSL validates portable controls; Studio owns new native contract, full/combined independent, installed and live answer qualification.
Layer below: Read original subscriptionServerPolicy, inspectSubscriptionProfile, managedHooksDisabled, provider fixture physical dispatch, all owning patch files, reviews/train-175-policy-cache-repair.md at 0c1d832a and its Studio repair report. Existing two files exactly matched owner parents; new files were absent. All five imported files exactly match owner bytes, no conflicts. Read current profile-discriminator.json; no local real-profile access or live replay.
Bug class: live-path
Bug evidence: reproducer=tests/assembly/subscription-policy-signatures.test.ts; live=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/pipeline/desk177-answer-0026/profile-discriminator.json
Hook bypass: none
Convergence: none
Prompt review: No model prompt/output parser or model verdict changes. This is pre-dispatch host-cache parsing. Replay the owner's captured public signed-cache bytes; no model output existed in the failed turns and no new live-answer claim is made.

1.x comparison: Inherit source owner's researched actual JKHeadley/instar main cc11e45f92e2590dd1bbd3c3facb5b849532f0fc: src/ and docs/specs/ plus git -G history for policy-limits, policyLimits and remote-settings.json had no matching cache implementation. Related src/core/SessionManager.ts handleReadyAndInject preserves startup failure and retries stale resume once; docs/specs/cli-login-expired-opens-repair.eli16.md and history 7da5a52ff corroborate real login failure. Read ONEX-LESSONS section 4. Those recovery mechanisms cannot fix this pre-dispatch cache mismatch; reuse exact 2.0 subscriptionServerPolicy owner rather than transplanting unrelated retry code. Owner decisions train-175-cache and train-175-enrollment remain attributed to reviews/train-175-policy-cache-repair.md at 0c1d832a, not claimed as new design.

Decision: T177-0030-OWNER | Import only the five named files from 0c1d832a, all exactly compatible with current parent bytes; retain original history and all unrelated train behavior. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-177-repair-0030-PROGRESS.md
Decision: T177-0030-PROOF | Run 17 signature controls, build/typecheck and at most one changed dispatch case. Retain all bounded failures and remaining Studio checks; no Windows-cause inference or inherited native-proof qualification. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-177-repair-0030-PROGRESS.md
Decision: T177-0030-PINS | Use canonical desk rehash/repin and exact committed-source register replay; no profile, grant, model-map or native certificate mutation. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-177-repair-0030-PROGRESS.md

Validation: build and typecheck pass; 17 signature controls pass. The one selected changed dispatch case fails at line 438 (uncertain, expected complete), after identity and policy equality pass. Retained sibling diagnostic /tmp/train179-cache-diagnostic.log records code 125 and rawError `instar-launch: 3: ulimit: Illegal option -u`; this is inherited host evidence, not newly captured stderr for this head. No retry or Windows-cause inference. Architecture has only R105: native macOS certificate mismatches composition sha256:6efe6f69549488a25f9327c71388df30639ba870aa420366aaf972ad826b67fa. Declaration untouched; guarded renewal belongs to Studio. No new full/native/live PASS.

Publication coverage: This review also covers canonical generated outputs from exact source adecbe9c5bfb5c8da7155c96de2180201262cf08, generation sha256:4a93dab0491b539b955caa30f22a1580f99b5d653f50d4608058075a133c09f3 (298 entries, 121 rules). Desk rehash and chain repin changed zero pins. These generated files record source provenance; no authority declaration changes.

Research corroboration: refreshed actual JKHeadley/instar origin/main 97dbe39e68471c9295072665e83b0801fb32cc60. Search of src/ and docs/specs/ for policy-limits, policyLimits and remote-settings.json returned no matches. Read current SessionManager.ts and cli-login-expired-opens-repair.eli16.md; the inherited owner comparison remains the repair basis. History search is separately recorded in the report and not silently called complete.

## Closing block

simplestRobustRoute: This is the simplest robust route: reuse the whole exact owning repair in the existing cache inspector, without retry/parser machinery or authority mutation. Start guard is assigned clean head and byte compatibility; end guards are targeted captured-shape controls, preserved red, canonical register and review evidence. The bounded builder scope leaves new native/live acceptance to Studio and makes no autonomous completion claim.
80/20: Source-only integration, no whole-train import, broad test repeats or unrelated fixes.
VERDICT: author submission; no independent verdict asserted.
