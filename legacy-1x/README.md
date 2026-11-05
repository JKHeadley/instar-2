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
