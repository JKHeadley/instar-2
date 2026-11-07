# Runtime configuration and template ownership for row 87

This map is evidence for the open carryover, not a release or supersession claim.
The prior scan at `1cb59f787b02c9a19486f1b500007305ee30608a` found 77 literal keys
at 111 reads. This scan pins current 1.x at `b446e92b8721fcd232475b596cc8397635b04863`:
32 `src/` files containing case-insensitive `liveConfig`, parsed with the installed
TypeScript parser; direct `.get`, `.getAll`, `.set` calls whose receiver is the
`liveConfig` identifier, a `.liveConfig` property, or a local `new LiveConfig` binding.
It finds 152 calls, 118 literal reads with 82 distinct literal read keys, and 93 keys
including writes and same-file literal constants. All 77 predecessor keys are present.
The first use and count below retain repeated consumers rather than silently deduplicating
coverage. This is a finite syntactic inventory, not complete semantic enumeration.
The ten computed call sites and named object blocks have the owner review below.
Aliases across functions/modules, reflection and plugin code remain outside this scan. No claim of full parity
follows from a similarly named 2.x feature.

## Owners and dispositions

Carryover row numbers refer to the desk's `carryover-1028.md` register. An existing
foundation named here is evidence of where adaptation belongs, not evidence that its
whole 1.x feature is already delivered. Only the update entry claims new live refresh;
its positive/negative tests exercise real disk changes and actual consumers.

| Owner group | Rows | Classification | Current 2.x code | Disposition |
| --- | --- | --- | --- | --- |
| update | 87 | non-authority | `scripts/update-auto.mjs`; `scripts/update-product.mjs` | Implemented: changed-byte refresh at the updater decision; tests/preview/update-runtime.test.ts. All other settings below are dependencies, not completion claims. |
| credentials | 30, 59, 62, 76, 92, 93 | protected identity / credential / authentication | `src/assembly/production-installation.ts`; `src/assembly/provider-credential-custodian.ts`; `tests/preview/secret-custody.ts` | Keep independent custody and immutable installation admission; never read these as mutable runtime settings. |
| continuation | 03, 17, 20, 80 | mixed run policy / non-authority pacing | `src/assembly/production-session-work.ts`; `tests/preview/journal-agent.mjs` | Existing owned session work is not the 1.x Codex continuation/window-liveness switch. Owner must define equivalent controls before refresh can be claimed. |
| governor | 22, 49, 50 | resource / stop floor plus policy | `scripts/resource-owner.mjs`; `src/scheduled/shedding.ts` | Existing capacity and crash brakes remain enforced. No config setting may raise their ceilings or release a stop; class-policy parity is an owning-row dependency. |
| jobs | 19, 57, 79 | mixed scheduled work / model supervision policy | `src/scheduled/manifest.ts`; `src/scheduled/runner.ts`; `tests/preview/journal-agent.mjs` | 1.x jobs here supplies script-triage settings, not just a cron list. Scheduled requests exist; that triage/control mapping remains with its owner. |
| maintenance | 02, 11, 23, 100 | non-authority maintenance policy with bounded effects | `scripts/host-watch.mjs`; `scripts/resource-owner.mjs` | Watchdog and resource owner exist; machine/browser care and wedge-restart policy are distinct feature dependencies, not superseded by update repair. |
| outbound | 33, 34, 43 | non-authority judgment/context policy; security floors excluded | `tests/preview/guidance.ts`; `tests/preview/journal-agent.mjs` | Current review/guidance are code-owned. 1.x advisory thresholds, time-claim and context switches have no equivalent live settings reader here; owner/replay dependency. |
| reviewsecurity | 33, 43, 45 | mixed review fail direction / test-surface authority | `tests/preview/journal-agent.mjs`; `tests/preview/reply-review-corpus.mjs` | Do not silently switch off a governed review or expose a test endpoint. Owner must separate safe tuning from enforcement before adopting a knob. |
| learning | 32, 43 | non-authority judgment configuration | `tests/preview/memory-learning.ts`; `tests/preview/journal-agent.mjs` | Existing learning path does not establish Jev meaning-grouping configuration parity. Retain owning-row dependency and require recorded-shape replay for any future model-facing adaptation. |
| localverify | 85 | mixed verification, repository scope, process limits and publication | `scripts/ci-local.mjs`; `scripts/check-change-review.mjs` | Repository gate tools are not the 1.x LocalVerify service/peer wiring/merge watcher. Row 85 remains the explicit feature dependency; no settings-only imitation. |
| ownership | 25, 28, 38, 74 | mixed ownership / topology / activation policy | `src/assembly/production-installation.ts`; `src/transport/threadline.ts`; `tests/preview/journal-agent.mjs` | Current ownership admission remains authoritative. Stage writes, peer scopes and stand-down bypasses cannot be placed in runtime-settings; safe tuning awaits the owning row. |
| pool | 29, 30, 54, 55 | mixed account custody / quota and selection policy | `tests/preview/harness-login-pool.mjs`; `scripts/topic-login-pool.mjs` | Current select/refresh consumes quota and separately admitted login manifests. That is not proof of 1.x wall-rescue, expired-swap or device-limit tuning parity. No mutable credentials/caps. |
| intelligence | 43, 55, 57 | mixed model configuration / spend / supervision | `tests/preview/journal-agent.mjs`; `src/assembly/production-installation.ts` | Whole intelligence block feeds Jev job-completion audit in this source. Split by actual nested owner before adoption; no blanket mutable block. |
| messaging | 59, 63, 67, 68, 69 | mixed audience / credentials / display policy | `src/assembly/production-installation.ts`; `tests/preview/journal-agent.mjs` | Whole messaging/messageOrigin blocks contain protected and display data. Existing provenance/transport is not evidence of configurable display parity; owners must split it. |
| threadsecurity | 70, 72, 73, 76, 83 | protected peer identity, trust, crypto, audience or network activation | `src/transport/threadline.ts`; `src/transport/threadline-custody.ts` | Typed transport custody is the actual foundation. 1.x routing/bridge switches do not grant 2.x authority; owning-row compatibility remains open. |
| threadnotice | 71, 72, 88 | non-authority peer receipt/notice policy | `src/transport/threadline.ts`; `src/transport/threadline-custody.ts` | Delivery receipt transport exists. Peer-dark notice and required-ack configuration parity still belongs to its owning rows. |
| dashboard | 89, 90 | mixed remote desktop / file read-write scope | `scripts/operator-dashboard.mjs`; `scripts/operator-dashboard-readonly.mjs` | The current dashboard is not a file editor or locked-screen desktop manager. Path permissions must remain authority; feature and safe refresh depend on rows 89/90. |
| browser | 31, 83 | installation policy / external executable effects | `scripts/mcp-setup.mjs`; `tests/preview/tool-turn.mjs` | MCP/browser tools do not implement the 1.x Linux desktop driver auto-installer. No auto-install authority is inferred. |
| tunnel | 91 | network exposure / consent policy | `scripts/approval-surface.mjs` | An approval surface is not the 1.x tunnel controller; opening a network route needs its own owner/consent. |
| development | 45, 72 | rollout policy | `src/assembly/production-installation.ts` | A mutable developmentAgent flag must not confer standing or graduate features. No setting copied. |
| parallel | 38, 80 | non-authority shared activity policy | `src/assembly/production-session-work.ts`; `tests/preview/journal-agent.mjs` | Current owned work does not prove 1.x parallel action-note settings parity; row 38 owns the remaining mapping. |
| checkin | 19 | non-authority reminder policy within original authority | `tests/preview/dated-memory.ts`; `tests/preview/journal-agent.mjs` | Dated reminders exist; the 1.x tickEnabled/dryRun block has no identical reader here. Row 19 owns safe control mapping. |

## Enumerated direct consumers

| Key | First pinned 1.x call | Calls | Owner group |
| --- | --- | --- | --- |
| `authToken` | `src/commands/server.ts:488` (get) | 4 | credentials |
| `autonomousSessions.codexTaskContinuation` | `src/server/CapabilityIndex.ts:1119` (get) | 2 | continuation |
| `browser.linuxDriver.autoInstall` | `src/commands/server.ts:32415` (get) | 3 | browser |
| `commitments.checkInReminder` | `src/server/routes.ts:35429` (get) | 1 | checkin |
| `dashboard.fileViewer.allowedPaths` | `src/server/fileRoutes.ts:1014` (set) | 1 | dashboard |
| `dashboard.fileViewer.editablePaths` | `src/server/fileRoutes.ts:1018` (set) | 1 | dashboard |
| `dashboard.fileViewer.enabled` | `src/server/fileRoutes.ts:1023` (set) | 1 | dashboard |
| `dashboardPin` | `src/commands/server.ts:502` (get) | 7 | credentials |
| `developmentAgent` | `src/commands/server.ts:21079` (get) | 1 | development |
| `integratedBeing.counterpartyHashSalt` | `src/commands/server.ts:21619` (set) | 1 | credentials |
| `intelligence` | `src/commands/server.ts:8448` (get) | 6 | intelligence |
| `intelligence.jevCodexDeviceLimit` | `src/commands/server.ts:16022` (get) | 1 | pool |
| `intelligence.selfActionGovernor.classes` | `src/commands/server.ts:23483` (get) | 1 | governor |
| `intelligence.selfActionGovernor.emergencyDisable` | `src/commands/server.ts:23478` (get) | 1 | governor |
| `jobs` | `src/server/AgentServer.ts:6101` (get) | 1 | jobs |
| `machineMaintenance` | `src/commands/server.ts:24850` (get) | 2 | maintenance |
| `machineMaintenance.browserCare` | `src/commands/server.ts:24960` (get) | 1 | maintenance |
| `machineMaintenance.enabled` | `src/commands/server.ts:24820` (get) | 1 | maintenance |
| `machineMaintenance.wedgeRestart` | `src/commands/server.ts:24905` (get) | 1 | maintenance |
| `messageOrigin` | `src/messaging/messageOrigin.ts:224` (get) | 1 | messaging |
| `messageOrigin.recording.slackFailClosed` | `src/commands/server.ts:9949` (get) | 1 | messaging |
| `messaging` | `src/commands/server.ts:29937` (get) | 3 | messaging |
| `messaging.outboundAdvisory.enabled` | `src/server/routes.ts:19502` (get) | 1 | outbound |
| `messaging.outboundAdvisory.ignoreEscalationSlugThreshold` | `src/server/routes.ts:5137` (get) | 1 | outbound |
| `messaging.outboundAdvisory.ignoreEscalationThreshold` | `src/server/routes.ts:5134` (get) | 1 | outbound |
| `messaging.outboundAdvisory.timeClaim.enabled` | `src/server/routes.ts:19528` (get) | 1 | outbound |
| `messaging.outboundFloor.jargonAlways` | `src/server/routes.ts:4426` (get) | 1 | outbound |
| `monitoring.codexArmSessionSweeper.dryRun` | `src/commands/server.ts:23625` (get) | 1 | maintenance |
| `monitoring.correctionLearning.meaningGrouping` | `src/commands/server.ts:16894` (get) | 1 | learning |
| `monitoring.greenPrAutoMerge.floor` | `src/commands/server.ts:24265` (get) | 1 | localverify |
| `monitoring.greenPrAutoMerge.repo` | `src/commands/server.ts:24266` (get) | 1 | localverify |
| `monitoring.localVerify.enabled` | `src/commands/server.ts:24263` (get) | 1 | localverify |
| `monitoring.localVerify.failFast` | `src/localVerify/localVerifyWiring.ts:516` (get) | 1 | localverify |
| `monitoring.localVerify.failedFileDiagnosis` | `src/commands/server.ts:24232` (get) | 1 | localverify |
| `monitoring.localVerify.laneShards` | `src/localVerify/localVerifyWiring.ts:518` (get) | 1 | localverify |
| `monitoring.localVerify.mainRedHold` | `src/localVerify/localVerifyWiring.ts:515` (get) | 1 | localverify |
| `monitoring.localVerify.mergeLine` | `src/commands/server.ts:24313` (get) | 1 | localverify |
| `monitoring.localVerify.peer.enabled` | `src/localVerify/localVerifyWiring.ts:500` (get) | 1 | localverify |
| `monitoring.localVerify.peers` | `src/localVerify/localVerifyWiring.ts:501` (get) | 1 | localverify |
| `monitoring.localVerify.postStatuses` | `src/commands/server.ts:24264` (get) | 3 | localverify |
| `monitoring.localVerify.preflightMode` | `src/localVerify/localVerifyWiring.ts:519` (get) | 1 | localverify |
| `monitoring.prHandLease.dryRun` | `src/server/routes.ts:35944` (get) | 1 | localverify |
| `monitoring.standDown` | `src/commands/server.ts:23214` (get) | 1 | ownership |
| `monitoring.standDown.dryRun` | `src/server/routes.ts:36052` (get) | 1 | ownership |
| `monitoring.watchdog` | `src/commands/server.ts:13003` (get) | 1 | maintenance |
| `monitoring.windowRunLiveness.ordinaryRunLifecycle` | `src/server/AgentServer.ts:5185` (get) | 1 | continuation |
| `multiMachine.identityReannounce.sharedBearerToken` | `src/commands/server.ts:25222` (set) | 1 | credentials |
| `multiMachine.reconcile` | `src/commands/server.ts:14370` (get) | 1 | ownership |
| `multiMachine.sessionPool` | `src/commands/server.ts:28851` (get) | 3 | ownership |
| `multiMachine.sessionPool.stage` | `src/commands/server.ts:26048` (get) | 4 | ownership |
| `outboundAdvisory.enabled` | `src/server/routes.ts:19501` (get) | 1 | outbound |
| `outboundAdvisory.ignoreEscalationSlugThreshold` | `src/server/routes.ts:5136` (get) | 1 | outbound |
| `outboundAdvisory.ignoreEscalationThreshold` | `src/server/routes.ts:5133` (get) | 1 | outbound |
| `outboundAdvisory.timeClaim.enabled` | `src/server/routes.ts:19527` (get) | 1 | outbound |
| `parallelWork.actionNotes.enabled` | `src/server/routes.ts:2830` (get) | 1 | parallel |
| `remoteDesktop.lockedScreen` | `src/server/AgentServer.ts:3035` (get) | 2 | dashboard |
| `responseReview.conversationalContext` | `src/commands/server.ts:21075` (get) | 1 | outbound |
| `responseReview.failClosedOnCriticalAbstain` | `src/commands/server.ts:21105` (get) | 1 | reviewsecurity |
| `responseReview.observeOnly` | `src/commands/server.ts:21160` (get) | 1 | reviewsecurity |
| `responseReview.testEndpointDisabled` | `src/commands/server.ts:21165` (get) | 1 | reviewsecurity |
| `sessions.claudeChildAuth.enabled` | `src/commands/server.ts:4405` (get) | 1 | credentials |
| `sessions.claudeKeyHealth.enabled` | `src/commands/server.ts:22162` (get) | 1 | pool |
| `subscriptionPool` | `src/commands/server.ts:22516` (get) | 1 | pool |
| `subscriptionPool.codexDeviceLimit` | `src/commands/server.ts:16006` (get) | 1 | pool |
| `subscriptionPool.loginExpiredSwap.enabled` | `src/commands/server.ts:15974` (get) | 2 | pool |
| `telegramIngress.lifelineSecret.bypass` | `src/server/routes.ts:3651` (get) | 1 | credentials |
| `telegramIngress.lifelineSecret.enforce` | `src/server/routes.ts:3654` (get) | 1 | credentials |
| `threadline` | `src/commands/server.ts:12375` (get) | 1 | threadsecurity |
| `threadline.backupRoutes.enabled` | `src/server/routes.ts:41708` (get) | 1 | threadsecurity |
| `threadline.encryptToPinned.dryRun` | `src/commands/server.ts:20162` (get) | 3 | threadsecurity |
| `threadline.encryptToPinned.enabled` | `src/commands/server.ts:20161` (get) | 3 | threadsecurity |
| `threadline.localRouteSignature.dryRun` | `src/commands/server.ts:19142` (get) | 2 | threadsecurity |
| `threadline.localRouteSignature.enabled` | `src/commands/server.ts:19141` (get) | 2 | threadsecurity |
| `threadline.localRouteTrust.dryRun` | `src/server/routes.ts:3829` (get) | 1 | threadsecurity |
| `threadline.localRouteTrust.enabled` | `src/server/routes.ts:3828` (get) | 1 | threadsecurity |
| `threadline.mcpHttp.enabled` | `src/commands/server.ts:20204` (get) | 2 | threadsecurity |
| `threadline.peerDarkNotice.enabled` | `src/server/routes.ts:20692` (get) | 1 | threadnotice |
| `threadline.peerHomebase` | `src/commands/server.ts:19035` (get) | 1 | threadsecurity |
| `threadline.refuseDowngrade.dryRun` | `src/commands/server.ts:20172` (get) | 2 | threadsecurity |
| `threadline.refuseDowngrade.enabled` | `src/commands/server.ts:20171` (get) | 2 | threadsecurity |
| `threadline.relayForward.enabled` | `src/commands/server.ts:19687` (get) | 4 | threadsecurity |
| `threadline.relayUnknownSenderTrust.dryRun` | `src/commands/server.ts:20152` (get) | 2 | threadsecurity |
| `threadline.relayUnknownSenderTrust.enabled` | `src/commands/server.ts:20151` (get) | 2 | threadsecurity |
| `threadline.requiredAck.enabled` | `src/commands/server.ts:19807` (get) | 1 | threadnotice |
| `threadline.telegramBridge.allowList` | `src/threadline/TelegramBridgeConfig.ts:65` (get) | 2 | threadsecurity |
| `threadline.telegramBridge.autoCreateTopics` | `src/threadline/TelegramBridgeConfig.ts:63` (get) | 2 | threadsecurity |
| `threadline.telegramBridge.denyList` | `src/threadline/TelegramBridgeConfig.ts:66` (get) | 2 | threadsecurity |
| `threadline.telegramBridge.enabled` | `src/threadline/TelegramBridgeConfig.ts:62` (get) | 2 | threadsecurity |
| `threadline.telegramBridge.mirrorExisting` | `src/threadline/TelegramBridgeConfig.ts:64` (get) | 2 | threadsecurity |
| `toneGate` | `src/commands/server.ts:20877` (get) | 1 | outbound |
| `tunnel` | `src/commands/server.ts:13907` (set) | 1 | tunnel |
| `updates.autoApply` | `src/core/AutoUpdater.ts:428` (get) | 2 | update |
| `updates.restartImmediately` | `src/core/AutoUpdater.ts:433` (get) | 1 | update |

## Computed-path owner review

These are the ten computed call sites from the pinned scan above. Each row follows
its caller into the real path producer. Read-side observation is not mutation authority.
No entry is silently classified as superseded by a similarly named 2.x component.

| Call site | Actual path domain and source | Owner, authority and 2.x disposition |
| --- | --- | --- |
| `server.ts:6024` get | `leaseLiveness.ts:72–84` closes `name` to `liveness` and `unconfirmedWriteAlert`, producing `multiMachine.leaseFlapFix.{name}`. Both default true and are reread per use. | Rows 25/28/74, lease admission and observation. `src/transport/authority.ts` owns the typed lease; its fence is not a mutable switch. The 1.x lease-flap wrapper is absent here; importing a switch alone would bypass rather than carry that feature. |
| `server.ts:24656` get | `machineCoherenceAdvert.ts` uses `machineCoherenceManifest.ts:392–460`. Live branches read `intelligence.selfActionGovernor.emergencyDisable`, the two class-mode entries, and `multiMachine.sessionPool` (`stage`). Class mode prefers the actual governor runtime callback. `exactlyOnceIngress` reads its explicit setting from the boot block, then live pool stage; the manifest's live label alone does not mean every field is live. Other manifest entries use boot data. | Row 28 advert, rows 22/49/50 governor, row 74 pool. `production-installation.ts` and `src/transport/` own installed identity/fences; no advert value grants them. The 1.x advert/controller consumer is absent and remains an explicit dependency. |
| `server.ts:30321` set | `guardMod.STAGE_CONFIG_PATH` is `multiMachine.sessionPool.stage`; `StageAdvancer` supplies `STAGE_WRITE_TOKEN`, fresh proof and current build identity. | Row 74 owns rollout admission. Do not turn this token-protected write into a generic runtime setting or infer a stage from settings bytes. |
| `CommitmentTracker.ts:1722` get | `verifyConfigChange` reads the persisted commitment's `configPath` and compares `configExpectedValue` by deep equality. The domain is data-dependent, not a finite set of source literals. | Rows 01/19 own commitment evidence. 2.x `tests/preview/obligations.ts` tracks commitments; it has no equivalent arbitrary config-change verifier. Original authorization and safe field ownership must be retained by that carryover. |
| `CommitmentTracker.ts:1790` set | `attemptAutoCorrection` writes the same persisted path/value, then calls `verifyConfigChange` and records correction history. Missing path/value refuses. | Rows 01/19. A stored expected value is not independent permission to change credentials, caps, grants or installation identity. No generic writer is added here. |
| `AgentServer.ts:8765` set | `MaturationLadderService.ts:595–650` calls the callback for `entry.start.set`, a rung's `advance.set`, guarded restoration of `move.old`, and `maturation.ladder.holds`. It checks standard risk, development-agent status, coherence-critical keys, fresh prior values and post-write equality; reversion checks the exact prior move. | Rule 72 / row 45 rollout owner. `src/register/workflow.ts` owns governed promotion, not this 1.x maturation registry. The callback's domain is registry/data-dependent; a config-only imitation cannot replace its review and audit. |
| `routes.ts:32246` get | Canonical `actionClaim.${leaf}` in `registerUnifiedFutureClaims`: `enabled`, `slack.enabled`, `slack.dryRun`, `perTopicCap`, `expiresHours`. | Rows 01/04/33. Commitment registration also requires conversation binding; the 2.x obligation owner is not a generic settings reader. Activation/binding stay protected; safe cap/expiry tuning depends on the actual carried registration consumer. |
| `routes.ts:32247` get | Same five leaves under legacy `messaging.actionClaim.${leaf}`, only when the canonical result is nullish. A real adapter-array `messaging` has no such object property. | Same owners and dependency. Preserve canonical-over-legacy precedence if the owning feature adopts it; do not replace the adapter array with a settings object. |
| `routes.ts:36177` get | Canonical wrapper in `/action-claim/observe`: the same five leaves. Parallel activity is recorded before the enable/registration decision; conversation bind, shared arbiter, topic cap and expiry still govern registration. | Rows 01/04/33/38. `journal-agent.mjs` and `obligations.ts` are the current foundations; the old HTTP route and its live wrapper are absent. No model-facing policy is changed by this mapping. |
| `routes.ts:36178` get | Legacy nullish fallback for that route, with the same object-versus-array limit. | Same dependency; legacy configuration is never a new grant. |

## Nested block ownership

The source-level block review follows the read into its receiving owner rather than
calling every key in an object mutable. These are owner-domain conclusions, not an
exhaustive enumeration of arbitrary user-defined keys or plugins.

| Read block | Actual receiving owner / consumed region | Disposition |
| --- | --- | --- |
| `intelligence` | `server.ts:8448` Jev job-completion audit; the other callbacks pass the block to Jev signal shadow, correction shadow, circles shadow, machine-load assessment and memory picker. Each chooses its named sub-block and reads secrets separately. | Rows 32/43/55/57. These are separate model-call, retention and rollout owners. Current 2.x journal learning/supervision is not proof that their tunings are equivalent. No whole-block refresh that could change spend or a model decision is added. |
| `jobs` | `AgentServer.ts:6101` passes live jobs to the script-triage handler. | Rows 19/57/79. Scheduled manifests exist, but script-triage configuration is a distinct consumer dependency. |
| `machineMaintenance`, `.wedgeRestart`, `.browserCare` | `server.ts:24850,24928` feeds `normalizeSettings`; `24905` feeds `normalizeWedgeSettings`; `24960` feeds `normalizeBrowserCare`. The services own host drains, OS restart/canary checks and browser lifecycle. | Rows 02/11/23/100. Host watchdog presence is not ownership of these services or their effect permissions. No updater setting can authorize host reboot or browser termination. |
| `monitoring.watchdog` | `server.ts:13003` supplies `stuckCommandSec` and `hardCeilingSec` to `SessionWatchdog`; construction still depends on boot `enabled`. | Rows 02/23. 2.x host-watch and resource-owner have their own enforced ceilings. Replacing them with mutable 1.x timeout values would weaken their owner; tuning needs that owner's adaptation and tests. |
| `multiMachine.reconcile` | `ReplicatedStoreReconciler` consumes the block at `server.ts:14370`. | Rows 25/28. 2.x facts/transport own replicated state; the 1.x reconciler policy is an absent-feature dependency. |
| `multiMachine.sessionPool` | `server.ts:28851,29894,29900` reads enabled/stage for routing; the coherence advert additionally reads stage. | Row 74. Pool activation, routing and stage proofs cannot be granted through runtime-settings. The authoritative 2.x transport and ownership admission remain unchanged. |
| `subscriptionPool` | `server.ts:22516` supplies `WallRescueConfigView` to `UsageWallRescue`; account resolution and swaps use separate recorded account custody. | Rows 29/30/54/55. Existing 2.x login-pool selection does not implement this wall-rescue tuning. Credentials and quota/cap authority remain excluded. |
| `threadline` | `server.ts:12375` selects only `inboundIdLedger`, with the boot sub-block as fallback. | Rows 70/72/76. Durable intake and duplicate suppression are floors; an absent 1.x ledger controller is not replaced by a live off switch in 2.x transport. |
| `messageOrigin`, `messaging` | Origin configuration and adapter-specific origin settings, including `server.ts:29937` selecting the Telegram array entry's `config.messageOrigin` and forwarding-to-holder policy. | Rows 59/63/67–73. Sender identity, provenance and holder routing remain with custody/transport. Do not expose the whole adapter block to runtime mutation. |
| `toneGate`, `responseReview.conversationalContext` | `server.ts:20877` resolves tone policy; `21075` supplies enabled, message/character limits and other context fields to the response-review owner. Development rollout is read separately. | Rows 33/34/43/45. Safe display/context tuning still changes what a model sees and needs recorded-shape replay in that owner's change. It is not implemented by this host-update unit. |
| `intelligence.selfActionGovernor.classes`, `monitoring.standDown` | Class-specific governor modes and stand-down enabled/dry-run decisions. | Rows 22/49/50 and 25/74. Resource and stop floors are not freely mutable; operator policy and runtime demotion must be distinguished. |

The extant non-authority consumers owned by this update feature remain the updater
and template repair switches listed in `update.md`. `update-runtime.test.ts` proves
changed bytes, same-mtime replacement, invalid input retention, and each repair
switch at the actual MCP reader. No additional safe existing equivalent consumer
was found among the ten computed sites. This is not evidence that the absent
features are superseded. The exact residual is cross-module aliases/reflection,
plugins and data-supplied paths, plus leaf-level normalization inside absent feature
owners; the 152-call scan is still a lower bound, not complete semantic enumeration.

## Template owners

| Installed artifact | Actual owner and applicable behavior | Evidence / remaining boundary |
| --- | --- | --- |
| `mcp.json` shipped defaults | `mcp-setup.mjs`, `update-release.mjs`; same-release cadence uses the existing backup/intent/postcondition transaction while idle, autoApply and drift verifier are enabled. | `update-runtime.test.ts` reads repaired bytes through `tool-turn.mjs::readRootMcp`; `update.test.ts` and `mcp-setup.test.ts` cover stale/current/custom/revoked/malformed cases. |
| Packaged runner, CLI, loader, guidance and release migration code | Existing npm release directory and current pointer; new process consumes the new package. | `update.test.ts`, `journal-installation.test.ts`, `update-runner-process.test.ts`; candidate syntax is distinct from health. |
| 1.x telegram/slack/app reply shell scripts and app-media-path | Current 1.x verifier owns these four deployed templates. 2.x Telegram uses its confined transport and journal runner; Slack/app-channel parity belongs to rows 67–73. | `src/assembly/telegram-bot-api-bridge.mjs` is inventoried by `journal-installation.test.ts`; this does not claim all relay features are superseded. No foreign-root repair. |
| `host-watch.launchd.plist.template` | Host supervisor installation/launcher, with installation-specific paths and ownership. | The update command does not own live launchd enrollment; no overwrite from generic SHA history. The real lifecycle test uses an isolated watchdog process. Launcher migration remains an explicit owner dependency. |
| Onboarding/installation bindings, operator records, provider login profiles | `onboarding-state.mjs`, `production-installation.ts`, custody owners. | Authority/identity, not templates or runtime settings. The update path preserves them; no signing or re-enrollment. |
| Browser profile, custom MCP settings and explicit revocation | Operator state, not shipped defaults. | `mcp-setup.test.ts` preserves these; SHA difference never authorizes replacing them. |
| Local media executables/model | `install-local-media.mjs`, row 65. Content hash and size verification belong to that explicit installer. | Not a text-template owner. No unrelated model download/installer implementation here. |

The template inventory has exact coverage of its one current MCP byte shape and three
historical byte shapes. JSON-equivalent reformattings can be classified unknown by SHA
while the semantic migration preserves or repairs recognized defaults. Installation-specific
launchers, arbitrary custom assets and other carryover rows are not silently called covered.

## Compliance and completion limits

Automatic git discovery, npm install and CLI syntax execution now enter the admitted
runner's existing `hostResources` as maintenance, retaining Six allocations, answer reserve,
stop and outcome evidence. An `installedUpdate` observation launches no subprocess.
`update.test.ts` refuses resource-limited installation even with exit code zero and proves
schema incompatibility stops before migrations. Standalone CLI installation launches through
its own attached resource owner (see `update.md`). The existing due-proof runner now records `P9-PREVIEW-update-bound` each minute,
reading fresh durable pressure, actual timer state and resource-owner admission.
The feature still declares unbounded repetition, for the reason in `update.md`. Existing three-failure pressure and stop/expiry remain in force.
