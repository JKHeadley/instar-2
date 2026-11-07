# 1.x raw baseline — carryover row 14 (safe input delivery)

Verbatim copies from `JKHeadley/instar` at commit `4f88880a45f0a119aae3cfd2ccaf9ace26d405b9`
(v1.3.1504), committed unchanged as the baseline for the row 14 port in
`lanes/carryover-1028.md`. Nothing here is compiled, imported or run: this directory is outside
`tsconfig.json`'s `include` and outside the `tests/**/*.test.ts` vitest glob. The 2.0 behavior
lives in `src/assembly/pending-input.ts` and `src/assembly/production-session-driver.ts`.

| 1.x path | lines | sha256 |
|---|---|---|
| `src/core/StuckInputSentinel.ts` | 959 | `3334cfbf605bcc14c1daf4b64e6acf7b0dd0541794b3a1b89d7aec1ee266bc50` |
| `src/messaging/MessageDelivery.ts` | 122 | `d996155f8db5ffb89e8e1c1efb5f0e91bc7849a479198cfd7c47de5130d3a7fd` |
| `tests/unit/StuckInputSentinel.test.ts` | 452 | `e6313e1117891616400dba44515b2db5b35c35ea7c69c472607d7d3de0a03b03` |
| `tests/unit/StuckInputSentinel-escalation.test.ts` | 141 | `99580d4f2200b8c5482b610ab90f92ae84cf273ce6f09c30c03cebb77cdf1073` |
| `tests/unit/StuckInputSentinel-ghost-text.test.ts` | 302 | `f90d8028f0e7afb99c6d796af1f0095883a3df7dc22a359e132435028eca6607` |
| `tests/unit/message-delivery.test.ts` | 204 | `8b043f5498f4c6b2664ffb6b1419814889f4829a984766ef3d17a8a5b1af6e8c` |

The copied tests reference 1.x modules (`SessionManager`, `SessionRecoveryChannel`,
`RecoveryActuationAuthority`, `MessageFormatter`) that do not exist in 2.0; they document the
tuned behavior being carried and are ported, not executed, in `tests/assembly/pending-input.test.ts`
and `tests/assembly/production-session-pending-input.test.ts`.

# 1.x raw baseline — carryover row 16 (HelperWatchdog / SubagentTracker)

Verbatim copies from `JKHeadley/instar` at commit `f3f94826ae7c0ae6203c2651698c02b95b89ccfa`
(the desk-verified 1.x checkout on 2026-11-05), committed unchanged as the baseline for the row 16
port in `lanes/carryover-1028.md` (user outcome: a helper's failure returns to its parent instead
of losing the requested result). Nothing here is compiled, imported or run: this directory is
outside `tsconfig.json`'s `include` and outside the `tests/**/*.test.ts` vitest glob. The 2.0
behavior lives in `src/assembly/production-session-work.ts` (the carried failure classifier and the
nested failed close), `tests/preview/admission-gate.mjs` and `tests/preview/tool-admission-hook.mjs`
(the harness-reported helper failure closes its durable edge), `tests/preview/live-sentinels.ts`
(a helper open past its recorded deadline is stale, the 1.x stale-cap rule) and
`tests/preview/journal.ts` (a second close for the same helper is refused).

| 1.x path | lines | sha256 |
|---|---|---|
| `src/monitoring/HelperWatchdog.ts` | 212 | `96aa3c95e15f585ecd8505e0cc285e04ae052e2a002d0da4e581b82b22943e9e` |
| `src/monitoring/SubagentTracker.ts` | 270 | `4cd1e44a553ad95b60980fdd1c90134a6bd91191287aea8379303318fafb6cd4` |
| `tests/unit/HelperWatchdog.test.ts` | 258 | `9d91d2bbd1fed1855c29a8efe974011fea177339ad0589855ddc1c7e5abaa01d` |
| `tests/unit/HelperWatchdog.wireup.test.ts` | 90 | `cfce88fe297584b3bf5fb08e673f20a0ce3fa59f0814379bf3f9e5cd851cdcf6` |
| `tests/unit/subagent-tracker.test.ts` | 300 | `4431a458c9153999e4942e96da2724c4f9f14d145f17201ff33909e14be30beb` |
| `src/commands/server.ts` (excerpt only, see below) | 30842 | `39497ebb1e49045420c9eaae42a4d2b48396ef260be03f064e357f70a2cdb935` |

`src/commands/server.ts.helper-watchdog-excerpt.md` quotes, with 1.x line numbers, the only lines
of the 30,842-line server composition that wire this feature: tracker construction, the
silence-sentinel corroboration, the HelperWatchdog alert injection into the parent session, the
subagent-aware zombie cleanup with its 60-minute stale cap, the SwapWorkGate subagent leg and the
SessionReaper gate K. The rest of that file is unrelated and is not copied.

The copied tests reference 1.x modules (`SafeFsExecutor`, Node timers, a JSONL state directory)
that do not exist in 2.0; they document the tuned behavior being carried. The classifier vectors
of `HelperWatchdog.test.ts` are replayed in `tests/assembly/production-session-work.test.ts`.
