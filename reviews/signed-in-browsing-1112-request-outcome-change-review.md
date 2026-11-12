# Change review — preserve uncertain browser request outcomes

Subject base: bd85f446e378dac0e27e4e718eada46d8aaedd1f
Review state: open
Reviewed content: none
Outcome: a prepared HTTP request whose response is lost remains prepared without an observed effect record. The UI operation awaits its known network completions and returns a refusal for an unavailable result. Full MCP capability restoration remains unfinished.
Affected rules: 1, 4, 34, 42, 49, 57, 60, 63, 70, 74, 95, 101, 102, 111, 113, 116, 123
Affected floors: secrets — existing custody and output checks remain; spend cap — no model calls; stop — existing deadline and resource-owner teardown bound pending completion; no duplicate sends — durable preparations are retained on failure; durable intake — no intake change, complete cause still precedes dispatch.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: distinguishes unknown authenticated effects from observed completion.
Side effects: failed network completion rejects the internal effect adapter rather than returning an unavailable result that the existing effect owner would record as observed. Per-operation completion promises are ephemeral in the already bounded host child. Generated register publication uses the existing replay generator; no declaration or native certificate is edited.
Undo and recovery: revert this source change and replay the register. Preserve durable prepared identities on an unknown outcome; never clear them to enable a retry.
Multi-machine posture: machine-local browser and ephemeral completion handles; the existing conversation owner and durable journal remain authoritative. No new replicated state or effect owner.
Team posture: observations remain private to the requesting verified conversation; no sharing or authority changes.
Layer below: admission-gate observeOwner records an effect as observed when its adapter returns normally, even if that return says unavailable. Rejection takes its existing unavailable path without writing observed. Chromium Network.loadingFinished/loadingFailed supplies the actual request completion; the current operation waits on known request completions within its existing deadline.
Bug class: integration
Bug evidence: reproducer=tests/preview/browser-profile.test.ts
Hook bypass: none
Convergence: none
Decision: signed-browser-repair-uncertain | Reject unavailable internal network completions and await known requests so the journal cannot call a lost response observed; retain its durable preparation. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/signed-in-browsing-1112-repair-build-report.md
Prompt review: no model prompt or output grammar changes. The existing seven recorded summary/Jev/review/delivered/empty shapes replay in browser-profile.test.ts; provenance and update ids remain in the main repair review and report.
1.x comparison: inherits and rechecks the source comparison at JKHeadley/instar main db3ed6d3052cfcc24888b6c8bc86086abcfc2987, paths src/core/PlaywrightProfileRegistry.ts, src/core/SigninProfileGuard.ts and docs/specs/playwright-profile-registry.md. Reuse named selection and revalidation; use 2.0's existing effect journal for unknown outcomes rather than inventing another ledger. The full MCP comparison remains an unresolved capability requirement.

Register publication: generated views replay committed source 684088f173becd79cee7896d96fd335e664e83df, generation sha256:7536922dd2fb050574596b65d73a1785c571098ec14a64a888b052b6dda2143c.
Deferral: generated/register.json:1 | not-a-deferral=mechanical serialization of existing facts; no newly deferred behavior

simplestRobustRoute: use the existing effect adapter's rejection path and Chromium completion events. The normal-return path otherwise writes a false observed record when a response is lost. Pending promises add no persistent owner and remain bounded by the existing host-child deadline and teardown.
80/20: a real local server drops the POST connection; the test observes a refusal, finds its durable network preparation and proves there is no observed record for that identity. The accepted-write, duplicate refusal, repeated-key and recorded-shape neighbors also pass. Full MCP restoration and live account acceptance remain open.
VERDICT: partial repair author submission; no independent convergence or READY claim
