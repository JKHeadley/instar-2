# Change review — getme-restart-1108 repair: whole-ms try timeout and renewed native conformance

Subject base: 99076ad272f3e4af1158796c1292d491e4863093
Review state: open
Reviewed content: none
Outcome: repairs both must-fix findings of the unit review. (1) tests/preview/bot-identity.mjs floored each try's timeout to whole milliseconds. The live clock is performance.now(), so the remaining budget for the third try could be fractional (two 30000.25 ms timeouts plus the 2 s and 5 s pauses left 22999.5). spawnSync in scripts/production-boot-io.mjs then threw ERR_OUT_OF_RANGE on timeoutMs+2000, and the bridge refused the non-integer timeoutMs before fetch, so a recovered Telegram was never asked the third time. The third try now asks with 22999 ms and verifies. (2) The native Darwin self-host conformance certificate in src/assembly/harness.declarations.json is renewed to the measured composition sha256:7d1d132edb5fe8b7ef2a26b3c53a40469fb783f769fe1cdff18fedd154d858b0. This was done only after the named native contract passed on this composition, and the whole native contract then passed 10/10, including certificate correspondence. Register publication was replayed from the committed source.
Affected rules: 55, 77, 26, 105, 115, 113, 37, 74, 90, 101, 116
Affected floors: secrets — unchanged; the token still reaches each try's child on stdin only and the floor only changes a number; spend cap — unchanged, getMe is free, at most three per launch, no model call; stop — unchanged, still checked after every pause; no duplicate sends — getMe is a read, no send path changes; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: a Math.floor on one computed argument, one regression test, a certificate renewed from a passing contract run, and mechanical register replay. No store, prompt, send path or authority changes. src/assembly is in the subject only for the declaration value.
Side effects: the third getMe try may get up to 1 ms less time than before. No other runtime behavior changes. The certificate now matches the composition that the native contract was run on.
Undo and recovery: revert the repair commits. Reverting the floor brings back the fractional-timeout failure. Reverting the certificate brings back the R105 finding.
Multi-machine posture: machine-local. The certificate is Darwin- and runtime-exact (node-24.14.1), with no new cross-machine authority.
Layer below: scripts/production-boot-io.mjs invoke (spawnSync timeout timeoutMs+2000, integer only) and src/assembly/telegram-bot-api-bridge.mjs request validation (integer timeoutMs). Both stay unchanged, and the caller now honors their integer contract. tests/preview/self-host-harness.mjs selfHostCompositionEvidence and tests/preview/native-harness-contract.test.ts produce and check the certificate.
Bug class: unit
Bug evidence: reproducer=tests/preview/bot-identity.test.ts
Hook bypass: none
Convergence: none
Decision: getme-floor-at-caller | floor at the retry caller rather than in production-boot-io or the bridge. Both of those correctly require an integer, and flooring keeps the try inside the remaining budget, where rounding up could overrun it | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/getme-restart-1108-PROGRESS.md
Decision: getme-renew-from-contract | renew only the conformance value, after the named native contract passed on the final composition, and confirm with the full 10/10 contract. The supported claim, runtime, entries and evidence reference are unchanged | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/getme-restart-1108-PROGRESS.md
Deferral: generated/register.json:1 | not-a-deferral=generated register output replayed from committed source, not prose authored by this change
Prompt review: no prompt, model call, model-output parser or model decision changes.

1.x comparison: inherited from the unit record (reviews/getme-restart-1108-change-review.md): JKHeadley/instar src/messaging/TelegramAdapter.ts ensureLifelineTopic bounded transient startup retry, reused in shape. 1.x has no native harness conformance certificate (a 2.0 Rule 105/115 construct), so the renewal has no 1.x counterpart.

Verification: tests/preview/bot-identity.test.ts 11/11 passed (Darwin, single worker). The new fractional-clock case fails with the floor removed and passes with it. The reviewer's reproducer (lanes/astra-unit-getme-restart-1108-fractional-repro.mjs) now returns verified with asked [30000,30000,22999] and child exits [0,0,0]. Native contract: the named case passed 1/1 before renewal (lanes/getme-restart-1108-native-contract-before.json), and the whole of tests/preview/native-harness-contract.test.ts passed 10/10 after it (lanes/getme-restart-1108-native-contract-after.json). node scripts/check-architecture.mjs exit 0. tsc --noEmit exit 0. npm run register:check passes after the replay. Desk repin scripts refreshed 0 pins.

## Closing block

simplestRobustRoute: a one-call Math.floor at the only caller that computes the fractional value, plus renewing the existing certificate from the existing contract. No new gate, retry framework or capability restriction.
80/20: both must-fix findings are repaired with discriminating evidence. No remainder.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
