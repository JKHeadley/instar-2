# Change review — Let a tool turn's shell read its TLS library configuration

Subject base: 0576b5a93c2f8838542fee928f0933d3143454cf
Review state: open
Reviewed content: none
Outcome: live ROW16 (2026-11-07, update 367055600) both helpers a tool turn started ended at their turn limit with no answer after "curl failed because the sandbox blocks reading the system's OpenSSL config file". Root cause: src/assembly/production-provider.ts SUBSCRIPTION_TOOL_RUNTIME_READS (line 401 at the base) reopened no part of /private/etc after plan #615, so under the settings' denyRead ['/'] macOS /usr/bin/curl (LibreSSL 3.3.6, OPENSSLDIR "/private/etc/ssl") fails at start with "Auto configuration failed ... fopen('/private/etc/ssl/openssl.cnf')" before it reaches the turn's network checkpoint (reproduced with sandbox-exec under the base profile). The list now carries /private/etc/ssl (openssl.cnf, x509v3.cnf, the public cert.pem, an empty certs/), read-only: allowWrite stays the scratch volume alone and /private/etc/hosts stays refused. tests/preview/tools-policy-class.ts claudeSettingsCheckpoints now accepts a read inside a reviewed runtime location (FULL_TOOLS_RUNTIME_READS lists /private/etc), which reads less than the reviewed class, so the operator's full-tools standing grant still covers the build; link entries stay exact. The helper turn cap (childMaxTurns 4, production-provider.ts:262) is NOT changed: raising it puts the tools policy outside the class ceiling the operator's grant 121996 was recorded against (FULL_TOOLS_CEILINGS.childMaxTurns 4) and each helper's turns are reserved against the call cap before dispatch (the spend floor), so that change is the operator's decision; see Operator questions.
Affected rules: 1, 57, 103, 104, 116
Affected floors: secrets — the reopened directory holds the TLS configuration and public CA bundle only; the login home, admission state, denied roots and /private/etc/hosts stay refused (the existing real-sandbox test still passes); spend cap — no reservation, cap or retry changed; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: lifting the helper turn cap (childMaxTurns 4) needs a new full-tools class ceiling under a fresh verified approval (Rule 104 class, purpose: the operator decides any change that widens the agent's authority), and a finite per-helper reservation for the spend floor; one candidate that adds no new bound is the turn's shared tool-call allowance plus its answer turn (maxToolCalls + 1 = 33).
Suggested tier: significant
Declared tier: significant
Tier rationale: one sandbox read path and the matching class predicate; no prompt, parser or decision change.
Side effects: a helper's or the root's shell can read /private/etc/ssl; curl and other LibreSSL clients start and reach the checkpoint.
Undo and recovery: revert 624dc58ce2dc3c8260ed39efaa160e0a43a63705.
Multi-machine posture: machine-local; a per-turn sandbox setting with no state or store.
Layer below: Claude Code 2.1.280's macOS Seatbelt profile built from sandbox.filesystem (denyRead '/', allowRead subpaths); tests/preview/tool-admission.mjs SHELL_HOST_CONFIG_READS already reopened /private/etc for the confined shell for the same curl reason (gate run 2026-10-07).
Bug class: unit
Bug evidence: reproducer=tests/preview/tool-paths.test.ts
Hook bypass: none
Convergence: none
Decision: hl1107-ssl-only | reopen /private/etc/ssl rather than /private/etc or an OPENSSL_CONF override, because it is the exact directory curl opens and keeps the host record refused | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/helper-limits-1107-PROGRESS.md
Decision: hl1107-cap-held | leave childMaxTurns at 4 and stop with the conflict, because a raise leaves the operator's full-tools class and the spend-floor reservation needs a finite number | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/helper-limits-1107-PROGRESS.md
Prompt finding: 0d4664ea9de7 | protocol-literal | existing system-prompt wording in production-provider.ts pinned by its test, unchanged by this change (only the runtime read list moved)
Prompt finding: 14d7eeccc218 | protocol-literal | existing system-prompt wording in production-provider.ts pinned by its test, unchanged by this change (only the runtime read list moved)
Prompt finding: 38a2c5d186f1 | protocol-literal | existing system-prompt wording in production-provider.ts pinned by its test, unchanged by this change (only the runtime read list moved)
Prompt finding: 9781075d458e | protocol-literal | existing system-prompt wording in production-provider.ts pinned by its test, unchanged by this change (only the runtime read list moved)
Prompt finding: 45e37ea2e9e9 | protocol-literal | existing system-prompt wording in production-provider.ts pinned by its test, unchanged by this change (only the runtime read list moved)
Prompt finding: b1bb3946362d | protocol-literal | existing system-prompt wording in production-provider.ts pinned by its test, unchanged by this change (only the runtime read list moved)
Prompt review: no prompt, parser or accept, escalate or refuse decision changes.

1.x comparison: JKHeadley/instar main 40676770f5d3 (fetched 2026-11-07). src/core/memorySessionPolicy.ts:77 denies reads only for the home, agent home and temp roots, so system paths (/private/etc/ssl included) were readable; 1.x sessions launch Claude Code with no --max-turns or --agents bound (src/core/SessionManager.ts), so its helpers are built-in subagents with no turn cap. The 12 in src/core/types.ts:5425 is the Gemini loop driver, not a helper bound. The read path is carried over; the turn behaviour cannot be without the operator's class decision.

Verification: npm run typecheck exit 0; new test tests/preview/tool-paths.test.ts "lets curl read its TLS configuration" fails at the base list and passes after; tests/preview/tool-paths.test.ts, tests/assembly/production-provider-tools.test.ts, tests/preview/tools-policy-class.test.ts 23/23; tools-default, journal-session-work-launch, installed-harness-logins, native-loop, tool-admission, egress-proxy 117/117; tool-turn 15/15; tool-turn-replay 22/22; check-architecture: only the desk-owned R105 self-host certificate finding.
Residue: helper-cap | high | the turn cap stays at 4 until the operator decides the class ceiling.

## Closing block

simplestRobustRoute: one read path added to the existing list and one predicate that admits a narrower read than the reviewed one; no new mechanism.
80/20: removes the failure both live helpers hit; the cap is left for the operator.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
