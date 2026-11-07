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
