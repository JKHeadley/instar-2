#!/usr/bin/env node
// Small, machine-local preview launcher. Only this file owns process, clock and
// physical ports. The worker owns all durable conversation/effect transitions.
import { createHash, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { createProductionTelegramIO, createSubscriptionProviderIO, productionStorageIO } from '../../scripts/production-boot-io.mjs';
import { snapshotState } from '../../scripts/operator-dashboard.mjs';
import { checkListen, createReadOnlyDashboard, pinCheckAt, serveReadOnly } from '../../scripts/operator-dashboard-readonly.mjs';
import { openProductionStorage } from '../../src/assembly/production-storage.js';
import { DEFAULT_SUBSCRIPTION_DOORWAY, subscriptionDoorway,
  SUBSCRIPTION_PREVIEW_EXPIRY, SUBSCRIPTION_TOOLS_SYSTEM_PROMPT } from '../../src/assembly/production-provider.js';
import { attachEgress, attachSessionVolume, networkToolReads, readRootMcp, reconcileToolTurns, runToolTurn, toolPacketFits, toolStatusLines, toolTurnEligible, TOOL_NOTICE_MAX_BYTES,
  TOOLS_DEFAULT_ACTIVATION } from './tool-turn.mjs';
import { prepareSessionAdmission, sessionAdmissionCommand, SESSION_ADMISSION_KEPT } from './session-admission.mjs';
import { createAdmissionGate, createToolEffectOwner } from './admission-gate.mjs';
import { admitToolCallEffect } from './tool-admission.mjs';
import { grantVolume, HARNESS_SESSION_BRIDGE, harnessGate, harnessHookPath, harnessSessionAdmission, harnessSessionLayout, harnessStatusLine } from './harness-user.mjs';
import { encoded } from '../../src/assembly/boundary.js';
import { decodeEffectPolicy, DEFAULT_EFFECT_POLICY, effectDoorwayStatusLines, refusedEffectNotices, currentEffectPolicy } from './effect-doorway.mjs';
import { redact } from '../../src/recall/redact.js';
import { durablePreviewWrite } from './durable-write.js';
import { prepareJournalEnvelope, withWorkspaceNotice } from './journal-envelope.js';
import { operatorEchoSent, statusAnswer } from './status-command.js';
import { SOURCE_PINS, sourcePacket, deskStatusSource, readDeskStatus, verifyMindRules, ANSWER_INSTRUCTIONS } from './briefing.js';
import { admitPreviewHarness, PREVIEW_JOURNAL_HARNESS, PREVIEW_JOURNAL_STALL_COVERAGE } from './stall-coverage.js';
import { UNRECORDED, briefingDigestOf, codeDigestOf, installedCodeOf, installationRows, installationStatusLines, installedUpdateFrom, updateDelivery,
  updatePacketItem } from './installation.js';
import { bindPreviewBlockingSites, projectionDigest, summaryStoppedAt, loopRevisitMs, LOOP_REVISIT_MIN_MS, LOOP_REVISIT_MAX_MS } from './journal.js';
import { openPreviewJournal as openJournal, createJournalWorker, raiseJournalCaps, renewJournalExpiry, activationMatchesJournal, activePersonMerges, openQuestionCandidates, projectMemoryText, unansweredCue, reportJournalCap, unknownCallCounts, pendingUnknownCalls, replyTimings, reviewUnavailableReleases, claimScopedWithholds, MINIMAL_RESERVE, reserveTurnsUsed, reserveRepliesUsed, openRequests, actionWithdrawn, reminderDue, operatorRequestsReport, retrospectiveCases, openBlockers, openDirectives, declaredObligations, sendOutcomeCounts, sendOutcomeOf, unsentLabel, replyTarget, replyOutcomeOf, partialReplyLabel, reminderOutcome, envelopeWriter, PREVIEW_LIVE_LIMITS, unservableContextReason, PREVIEW_JOURNAL_COMPACT_BYTES, activeMemoryConflicts, TOO_LONG_INPUT_NOTICE, TOO_LONG_REPLY_NOTICE , probeTurn, operatorWriter, isJournalUpdate, retractRefusal, retractRendering, retractCarrier, retractedTurn, liveSummaries, withinOperatorHours, OPERATOR_HOURS, withFormatReminder, concurrentWorkItem, latestOwnedLaunch, ownedProcessOf, meaningIndexStatus, LIMITED_ANSWER_OPERATION, MISSING_INSTALLATION_POLICY } from './journal.js';
import { createPreviewClock } from './clock.js';
import { appendRun, heldNotices, heldRepliesToday, memoryHealthLine, readRuns, restartHandoff, selfState, selfStateBrief, selfStateSource, zoneFormatter } from './self-state.js';
import { guidanceReport } from './guidance.js';
import { memoryLearningLine, memoryLearningReport } from './memory-learning.js';
import { JEV_MODEL, jevQuestions, publicCredentialRegister, secretMaterialIn, replyReviewContext, replyReviewQuestion, replyReviewRules, parseReplyReviewVerdict, replyReviewDiagnostics, parseJevResponse, replyRevisionQuestion, parseReplyRevision, REVIEW_MALFORMED, REVIEW_FORMAT_REMINDER } from './reply-check.js';
import { interpretSummaryReview, SUMMARY_QUESTION } from './summary-check.js';
import { assertLiveJudgment, modelCallRecord, sha256 } from './model-call-boundary.js';
import { readAnswer } from './answer-reading.js';
import { SUMMARY_FAITHFULNESS_QUESTION } from './summary-faithfulness.js';


import { dueState } from './dated-memory.js';
import { observedSubscriptionIO } from './call-diagnostics.mjs';
import { agentState, importStorePass } from './channel-source.mjs';
import { exhaustedPollReason } from './poll-failure-reason.mjs';
import { loopHealth } from './obligations.js';
import { classifyTelegramSend } from './telegram-send-outcome.mjs';
import { authoritySealKey, resolveActivationAuthority, resolveInstallationPolicy, sealAuthorityRecord, singleMachineProfileDigest, SINGLE_MACHINE_PROFILE } from './activation-authority.js';
import { deriveProfile } from '../../src/index.js';
import { PREVIEW_PROOF_PLANS, executeProof, nextDuePlan, probeId, proofPosture, stepCoverage } from './proofs.js';
import { capabilityRows, previewInventory, proofStatusLines, resolveLiveProof } from './capabilities.js';
import { appendProof, readProofs } from './proof-log.js';
import { hostname, homedir } from 'node:os';
import { assessStranded, claimConversation, observeConversationOwner, recordRefusal, refusedLaunches, SUPPORTED_POSTURE } from './conversation-owner.js';
import { agreementLine, agreementStatus, runDueAgreements } from './store-agreements.js';
import { connectConversationAuthority } from './conversation-authority.js';
import { createLeaseHolder } from './two-machine-serving.js';
import { adoptReceivedCopy, connectReplicaPeer, createJournalShipper, createReplicatedDispatch, openReplicaStore, serveReplicaStore,
  sharedHistoryStatus, takeoverEligibility } from './journal-replication.js';
import { createApprovalSurfaceClient } from './approval-surface-client.mjs';
import { dashboardSnapshot } from './operator-dashboard.js';
import { parseExplicitYesInstallation } from './explicit-yes-installation.js';
import { createGitHubReviewClient } from './github-review-client.js';
import { createReviewYesSource } from './review-yes-source.js';
import { explicitYesStatus, operatorActionSurface, validRetractUpdates, OPERATOR_REQUEST_MS, OPERATOR_REQUEST_MAX_MS } from './operator-yes.js';
import { hostResources, HOST_IDENTITY, RESOURCE_CEILINGS } from '../../scripts/resource-owner.mjs';
import { createHostResourceAllocation } from './six-host-resources.js';
import { shouldRunScheduledPriority } from '../../src/scheduled/shedding.js';
import { reconcileProcessIncarnation } from '../../src/measurement/index.js';
import { liveMeasurement, measuredTimings, renderMeasured, resourceCompare, resourcePointClaims } from './measured.js';
import { doorwayFreshness, installDoorways, observeExchange, readDoorwayMap, standingDoorwayCheck, subscriptionExchange, usageReconciliation, writeDoorwayMap } from './doorway-map.js';
import { createSecretCustody, dueCredentialReminders, reminderSchedule } from './secret-custody.js';
import { credentialNotices, doorwayNotices, dueWithDelivery } from './credential-reminders.js';
import { journalCapacity, packetCapacity } from './capacity-outcome.js';
import { createLiveSentinels, createOrdinaryLane, sentinelCycle, sentinelReport } from './live-sentinels.js';
import { SENTINEL_FAMILIES } from './sentinel-record.js';

const clock = createPreviewClock(() => Date.now(), () => performance.now());
const wallNow = clock.now;
const openPreviewJournal = (...args) => {
  const journal = openJournal(...args);
  clock.seed(journal.view.clockFloor);
  return journal;
};

const importSource = (journal, state, source, stopped) => {
  try {
    const result = importStorePass(journal, state, source, wallNow(), stopped);
    if (journal.view.channelSourceErrors.has(source))
      journal.append({ kind: 'channel-source-error', source, error: null, at: wallNow() });
    return result;
  } catch (error) {
    if (!stopped() && !journal.view.stop && wallNow() < journal.view.expires
      && journal.view.channelSourceErrors.get(source) !== 'import refused')
      journal.append({ kind: 'channel-source-error', source, error: 'import refused', at: wallNow() });
    throw error;
  }
};

import { auditJournal } from './journal-audit.mjs';


import { memoryReport } from './memory-export.js';

import { createProductionSessionDriver } from '../../src/assembly/production-session-driver.js';
import { createSessionWorkPort, SESSION_WORK_LIMITS } from '../../src/assembly/production-session-work.js';
// @ts-expect-error physical JS host is intentionally outside the pure core
import { createProductionSessionIO } from '../../scripts/production-session-io.mjs';
import { stepQuestions } from './step-check.js';
import { RETROSPECTIVE_QUESTION, benchmarkReruns, disciplineSource, feedbackDispositions, latestGrades, openFindings, owedCases, passAccounting, pendingGrades, promotedCases, replyContextDigest, rerunDispositions, rerunsDue, retroAnswerBudget, standingGrantCandidates } from './retrospective.js';



/** `--sentinels`: `none`, or a comma list of context, presence and promise; absent means all three. */
const sentinelFamiliesOf = value => {
  if (value === undefined) return new Set(SENTINEL_FAMILIES);
  if (value === 'none') return new Set();
  const named = value.split(',');
  if (!named.length || named.some(name => !SENTINEL_FAMILIES.includes(name)) || new Set(named).size !== named.length)
    throw Error('preview: --sentinels must be none or a comma list of context, presence, promise');
  return new Set(named);
};
const parse = values => {
  const command = values[0] ?? 'run', options = {};
  for (let i = 1; i < values.length; i += 2) {
    if (!values[i]?.startsWith('--') || values[i + 1] === undefined) throw Error('preview: malformed arguments');
    options[values[i].slice(2)] = values[i + 1];
  }
  // A trial-wide grant would push unrequested dated items; each reminder is granted by its own operator request.
  if (options['reminder-grant-reference'] !== undefined)
    throw Error('preview: --reminder-grant-reference is retired; the operator grants each reminder by asking for it');
  return { command, options };
};
// Eleven §§2, 4 (P-02): the operator's independently administered approval page
// (scripts/approval-surface.mjs, run under the operator's OS identity). Installed only when all three are
// given; the runner reads the operator's store and writes only its own request outbox.
const approvalSurfaceOf = options => {
  const given = ['approval-store', 'approval-outbox', 'approval-operator-uid'].filter(name => options[name] !== undefined);
  if (!given.length) return null;
  if (given.length !== 3) throw Error('preview: --approval-store, --approval-outbox and --approval-operator-uid go together');
  return createApprovalSurfaceClient({ store: options['approval-store'], outbox: options['approval-outbox'],
    operatorUid: number(options['approval-operator-uid'], 'approval-operator-uid', 0), now: wallNow });
};
// Rules 79, 81 (plan #502): the operator dashboard served READ-ONLY by this runner, with no approval port. Installed only when
// both are given: where it listens (loopback or this machine's Tailscale address) and the loopback endpoint that checks the
// operator's existing dashboard PIN (an Instar 1.x host's `POST /dashboard/unlock`). Approvals stay where they are answered.
const readOnlyDashboardOf = options => {
  const given = ['dashboard-listen', 'dashboard-pin-check'].filter(name => options[name] !== undefined);
  if (!given.length) return null;
  if (given.length !== 2) throw Error('preview: --dashboard-listen and --dashboard-pin-check go together');
  return { listen: checkListen(options['dashboard-listen']), checkPin: pinCheckAt(options['dashboard-pin-check']) };
};
// Plan #91; Purpose, the approval-account exception: the desk-written explicit-yes installation record. A malformed
// record refuses the launch; afterwards it is read afresh on every use, so a withdrawal the desk records on the
// operator's word stops consumption from the next poll (an unreadable record admits nothing).
const explicitYesInstallationOf = options => {
  const path = options['explicit-yes-installation'];
  if (path === undefined) return null;
  if (!path.startsWith('/')) throw Error('preview: --explicit-yes-installation must be an absolute path');
  parseExplicitYesInstallation(readFileSync(path, 'utf8'));
  return () => { try { return parseExplicitYesInstallation(readFileSync(path, 'utf8')); } catch { return undefined; } };
};
/** The agent's OWN GitHub token for opening request pull requests; never the operator's. Host-bound, never an argument. */
const githubToken = () => {
  const value = process.env.INSTAR_SECRET_PREVIEW_GITHUB_TOKEN;
  if (!value || /\s/u.test(value)) throw Error('preview: GitHub SecretRef unavailable'); return value;
};
/** The GitHub review source (P-05 route), connected only with the installation record and a request repository. */
const reviewSourceOf = (options, installation) => {
  const repository = options['review-repository'];
  if (repository === undefined) return null;
  if (!installation) throw Error('preview: --review-repository needs --explicit-yes-installation');
  return createReviewYesSource({ installation, repository, context, now: wallNow,
    client: createGitHubReviewClient({ token: githubToken(), http: globalThis.fetch.bind(globalThis), signal: ms => AbortSignal.timeout(ms) }) });
};
/** The reviewed activation a renewal may name (`--renewal-activation`), validated exactly as `renew-expiry` validates it;
 * its digest when it is valid now and ends at `expires`, else null. */
const renewalActivationOf = (options, view) => expires => {
  const path = options['renewal-activation'];
  if (path === undefined) return null;
  const bytes = readFileSync(path, 'utf8'), activation = JSON.parse(bytes), now = wallNow();
  const profile = Object.freeze(JSON.parse(readFileSync(required(options, 'login-profile'), 'utf8')));
  const renewalDoorway = subscriptionDoorway(options.doorway ?? DEFAULT_SUBSCRIPTION_DOORWAY);
  renewalDoorway.validateActivation(activation, profile, required(options, 'model'), now, renewalDoorway.conversationFraming);
  requireAuthority(options, activation, path, view(), now);
  if (activation.expiresAt !== expires || !activationMatchesJournal(view(), activation, expires)) return null;
  return `sha256:${createHash('sha256').update(bytes, 'utf8').digest('hex')}`;
};
const required = (options, name) => { if (!options[name]) throw Error(`preview: missing --${name}`); return options[name]; };
/** Desk unit harness-user: `--harness-user NAME` runs every Claude Code launch of the login profile as that macOS user, so
 * the kernel checks each file the harness opens as an identity with no access to the operator account's private files.
 * Decided at launch from live state (harness-user.mjs harnessGate), never from the switch alone. Unavailable, every
 * harness launch is HELD (never run as the runner's own account) and the identity is decided again on a later launch;
 * the runner's journal, messaging and stop keep working, and the status line says why. Absent: null. */
const harnessOf = (options, root, doorway) => {
  const user = options['harness-user'];
  if (user === undefined) return null;
  return harnessGate({ user, profile: JSON.parse(readFileSync(required(options, 'login-profile'), 'utf8')),
    denied: [realpathSync(root), homedir(), process.cwd()], clock: () => performance.now(),
    unavailable: doorway.toolTurn?.harness ? 'the selected doorway is not the Claude Code harness' : null,
    adopt: uid => hostResources.adoptHarnessUid(uid), log: line => process.stderr.write(`preview: ${line}\n`) });
};
/** The `runAs` a launch passes: the ready identity's command fields (throws while the identity is held). */
const runAsOf = harness => { if (!harness) return null; const { user, launcher, login, plan } = harness.current(); return { user, launcher, login, plan }; };
/** Rules 60, 114 (Part fifteen §5): the delegated-session path for long and scheduled work exists
 * only under its own reviewed grant: an activation record for the doorway's session framing, bound
 * to that exact session policy (launch flags, model, limits, task wording), resolved from the same
 * sealed authority and accepting the admitted-session residual. With no grant, work stays on the one-call
 * route exactly as before. Everything else — harness, executable, homes, ceilings — comes from the
 * doorway, the login profile and the policy, never from a separate option. */
const sessionWorkOf = options => options['session-work-activation'] === undefined ? null
  : { activation: options['session-work-activation'], tmux: options['session-work-tmux'] ?? '/opt/homebrew/bin/tmux' };

const number = (value, name, minimum = 1, maximum = Number.MAX_SAFE_INTEGER) => {
  const n = Number(value); if (!Number.isSafeInteger(n) || n < minimum || n > maximum) throw Error(`preview: invalid ${name}`); return n;
};
const expiry = value => {
  const numeric = Number(value), parsed = Number.isSafeInteger(numeric) && numeric > 0 ? numeric : Date.parse(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw Error('preview: invalid expiry'); return parsed;
};
const key = () => {
  const value = process.env.INSTAR_SECRET_PREVIEW_STORAGE_KEY;
  if (!value) throw Error('preview: storage SecretRef unavailable');
  const bytes = Buffer.from(value, /^[a-f0-9]{64}$/iu.test(value) ? 'hex' : 'base64');
  if (bytes.length !== 32) throw Error('preview: storage SecretRef malformed'); return bytes;
};
const token = () => {
  const value = process.env.INSTAR_SECRET_PREVIEW_TELEGRAM_BOT_TOKEN;
  if (!value || !/^[0-9]+:[A-Za-z0-9_-]{20,}$/.test(value)) throw Error('preview: Telegram SecretRef unavailable');
  return value;
};
/** The two machines' shared secret (authority face and journal acknowledgements). Host-bound, never an argument, never logged. */
const authoritySecret = () => {
  const value = process.env.INSTAR_SECRET_PREVIEW_AUTHORITY_SECRET;
  if (!value || value.length < 16) throw Error('preview: authority SecretRef unavailable');
  return value;
};
const typesafeKey = () => {
  const value = process.env.INSTAR_SECRET_PREVIEW_TYPESAFE_KEY;
  if (!value || !value.trim()) throw Error('preview: TypeSafe SecretRef unavailable');
  return value;
};
/** Rule 56: the run's durable doorway map; set by `run`, observed at every real exchange. */
let doorwayMapPath = null;
/** Rule 56's standing process, from the bounded poll cycle: at most once a minute, no model call. */
let doorwayCheckedAt = null;
const checkDoorways = () => {
  if (!doorwayMapPath || doorwayCheckedAt !== null && wallNow() - doorwayCheckedAt < 60000) return;
  doorwayCheckedAt = wallNow();
  try { const map = readDoorwayMap(doorwayMapPath); if (map) writeDoorwayMap(doorwayMapPath, standingDoorwayCheck(map, doorwayCheckedAt)); }
  catch { /* the check is evidence; the next cycle retries */ }
};
const observeDoorway = (doorway, model, observation) => {
  if (!doorwayMapPath || !observation) return;
  try { const map = readDoorwayMap(doorwayMapPath); if (map) writeDoorwayMap(doorwayMapPath, observeExchange(map, doorway, model, observation, wallNow())); }
  catch { /* the map is evidence; a failed write never changes a model outcome */ }
};
/** Content-free discovery at the Jev exchange (called inside the model-call boundary): success and the model id it reports. */
const observeJev = (judgment, value) => observeDoorway('typesafe-jev', JEV_MODEL, value === null
  ? { ok: false, reason: 'exchange failed', evidence: `exchange:${judgment}` }
  : { ok: true, reportedModels: typeof value.model === 'string' ? [value.model.slice(0, 128)] : [], evidence: `exchange:${judgment}` });
const context = { site: 'preview.journal', preserved: 'preview:host', register: {
  generation: { owner: 'part-three', name: 'RegisterGeneration', id: 'preview:register' },
  entries: ['preview.journal', 'preview', 'host'], producers: ['host'], methods: [], actions: {}, subjects: {},
  sites: { 'preview.journal': 'closed', 'types.decode': 'closed' }, keys: {}, allowRedelegation: false,
  conflictStanding: { ordinary: 'delegate', authority: 'operator' } }, captures: {} };
/** Rules 28/82: the messaging owner's records (its state directory: the sender-authenticated message
 * log, the provenance ledger and the topic-operator bindings). Absent, unreadable or malformed →
 * null, which resolves no grant. */
const operatorRecords = directory => {
  if (!directory) return null;
  // Every complete line must parse (a skipped line could hide a second row for the same message);
  // only a trailing fragment still being appended is left out.
  const lines = name => readFileSync(join(directory, name), 'utf8').split('\n').slice(0, -1).filter(Boolean).map(line => JSON.parse(line));
  try { return { messages: lines('telegram-messages.jsonl'), provenance: lines('asp-classifications.jsonl'),
    bindings: JSON.parse(readFileSync(join(directory, 'state', 'topic-operators.json'), 'utf8')) }; } catch { return null; }
};
/** Rules 94/98/103/104: the activation is exercised only under a recorded operator authority that
 * covers this exact act: the original activation, or a bounded renewal inside the standing grant.
 * The record defaults to `activation-authority.json` beside the activation record. Rule 82: it
 * resolves only as the desk's disposition sealed under this trial's storage SecretRef
 * (`seal-authority`); a copy with any field changed resolves nothing. `policy` is the build's own
 * invocation policy the activation names: a grant recorded for a policy class covers it only then. */
const requireAuthority = (options, activation, activationPath, view, now, policy = undefined) => {
  const path = options['authority-record'] ?? join(dirname(resolve(activationPath)), 'activation-authority.json');
  let record = null;
  try { record = JSON.parse(readFileSync(path, 'utf8')); } catch { record = null; }
  const resolution = resolveActivationAuthority(activation, record, view.genesis.operator, view.genesis.expires, now,
    operatorRecords(options['operator-records']), authoritySealKey(key()), policy);
  if (resolution.kind !== 'resolved') throw Error(`preview: ${resolution.reason}`);
  return resolution;
};
/** Part Thirteen §9: writes the tools activation a root's launch derived under the operator's recorded grant, whole (write
 * then rename), owner-only. It is the live withdrawal handle; the sealed authority it resolves from records the grant. */
const writeToolsDefaultActivation = (path, bytes) => {
  writeFileSync(`${path}.tmp`, bytes, { mode: 0o600 });
  renameSync(`${path}.tmp`, path);
};
/** P-08 (Purpose; Eleven §5): this trial's single-machine acceptance, resolved from the same sealed
 * authority record as the activation. Its absence never refuses a launch; it only leaves the minimal
 * path's peer question unsettled, so limited answers stay inhibited and the outage names it. */
const installationPolicyOf = (options, activation, activationPath, view, now) => {
  const path = options['authority-record'] ?? join(dirname(resolve(activationPath)), 'activation-authority.json');
  let record = null;
  try { record = JSON.parse(readFileSync(path, 'utf8')); } catch { record = null; }
  try { return resolveInstallationPolicy(activation.trial, record, view.genesis.operator, now,
    operatorRecords(options['operator-records']), authoritySealKey(key())); }
  catch { return { kind: 'refused', reason: 'the authority record could not be resolved' }; }
};
/** The installed register generation, read from the checkout now. Ten's rule for the `register`
 * dependency (src/assembly/production.ts): the generation the live process holds equals the current one. */
const registerGeneration = () => {
  try { const generation = JSON.parse(readFileSync(resolve(process.cwd(), 'generated/source.json'), 'utf8')).generation;
    return typeof generation === 'string' && generation ? generation : null; } catch { return null; }
};
/** What clears each missing minimal dependency, for the operator's pull surface (Rules 15, 82). */
const MINIMAL_REPAIR = Object.freeze({
  [MISSING_INSTALLATION_POLICY]: 'the operator accepts the single-machine profile once (P-08); the desk records that message in the sealed authority record and restarts the runner (README: single-machine acceptance)',
  register: 'restart the runner: the installed register generation is unreadable or changed since this launch',
  lease: 'this runner does not hold the conversation; the owning runner answers, or the next launch claims it',
  fence: 'this runner lost the conversation fence; the next launch reclaims it',
  route: 'the Telegram route is failing; it recovers when a poll succeeds' });
const minimalRepair = missing => missing.map(item => MINIMAL_REPAIR[item] ?? `restore ${item}`).join('; ');
/** The launch's recorded minimal-path posture: the latest launch row that carries one. */
const minimalPathOf = runsText => {
  let found = null;
  for (const line of runsText.split('\n')) {
    if (!line.includes('"minimalPath"')) continue;
    try { const row = JSON.parse(line); if (row?.v === 1 && row.minimalPath && typeof row.minimalPath === 'object') found = { launch: row.launch, ...row.minimalPath }; }
    catch { /* a fragment still being appended */ }
  }
  return found;
};
const take = result => { if (result.kind !== 'Success') throw Error(`preview: adapter refused ${result.detail ?? ''}`); return result.value; };
const secretRef = name => ({ type: 'SecretRef', schemaVersion: 1, vault: 'preview', name });
const delay = ms => new Promise(done => setTimeout(done, ms));
/** Rules 34/62/76 classify capabilities through the committed register shape: one definition, read, never restated. */
const shapeTerms = () => ({ owner: 'part-three',
  derivedFrom: JSON.parse(readFileSync(resolve(process.cwd(), 'register-source/bootstrap-shape.json'), 'utf8')).derivedFrom });
const classifier = () => { const terms = shapeTerms(); return profile => take(deriveProfile(profile, terms, 'preview:host')); };
/** The runner's register inputs, read from the same committed file the register's source collector reads. */
const declarationsOf = name => JSON.parse(readFileSync(resolve(process.cwd(), `tests/preview/${name}.json`), 'utf8'));
const inventory = () => previewInventory(declarationsOf('capabilities.declarations'), declarationsOf('preview.pending-declarations'));
/** A capability's version is the digest of its own source files, so a live proof survives unrelated edits. */
const capabilityVersions = () => {
  const files = new Map(), digest = path => {
    if (!files.has(path)) { let value; try { value = createHash('sha256').update(readFileSync(resolve(process.cwd(), path))).digest('hex'); }
      catch { value = `missing:${path}`; } files.set(path, value); }
    return files.get(path);
  };
  return Object.fromEntries(inventory().capabilities.map(item => [item.declaration.id,
    `sha256:${createHash('sha256').update(item.sources.map(digest).join('\n')).digest('hex')}`]));
};
const VERSION_PREFIX = 'version:';
const proofsPathOf = root => join(root, 'proofs.jsonl');
/** The running launch: its startup proof carries the generation and capability versions it launched with. */
const runningLaunch = proofs => {
  const startup = proofs.filter(row => row.plan === 'startup').at(-1);
  if (!startup) return null;
  const versions = Object.fromEntries(Object.entries(startup.observed).filter(([name, value]) => name.startsWith(VERSION_PREFIX) && typeof value === 'string')
    .map(([name, value]) => [name.slice(VERSION_PREFIX.length), value]));
  return { generation: startup.generation, versions, stepCheck: startup.observed.stepCheck === true, agentState: startup.observed.agentState === true };
};
/** Posture and step coverage for one reading; every input is a durable record or the replayed journal. With no
 * startup record the versions come from disk and every plan reads unknown: nothing from another launch counts. */
const proofReport = (view, log, launch, now) => {
  const versions = launch && Object.keys(launch.versions).length ? launch.versions : capabilityVersions();
  const supervisors = { replyReview: true, summaryReview: true, stepCheck: launch?.stepCheck ?? false };
  const generation = launch?.generation ?? versions['preview.proofs'];
  return { generation, versions, supervisors, proofs: proofPosture(PREVIEW_PROOF_PLANS, log.proofs, generation, { supervisors }, now, log.refused ?? []),
    enabled: { default: true, 'option:step-check': supervisors.stepCheck, 'option:agent-state-dir': launch?.agentState ?? false },
    stepCoverage: stepCoverage(view, supervisors) };
};
/** Capability truth over a reading (Rules 34, 39, 62, 72, 73, 76); `status` is what the metrics must reach. */
const capabilityReport = (joined, reading, log, status, now) => capabilityRows(joined, { classify: classifier(),
  versions: reading.versions, enabled: reading.enabled, status, liveProofs: log.liveProofs, proofs: reading.proofs, now });
/** The exact sources every live turn carries; shared by run and the read-only inspect probe.
 * The self-state is recomputed at each turn from the journal and the run log; the desk's
 * report (optional) covers only other work. */
const turnSources = (root, options, view, runs, current = () => undefined, handoff = () => null,
  toolsOn = () => options['tools-activation'] !== undefined) => {
  // The standing mind-held instructions ride every prepared envelope; a changed rule book refuses launch.
  verifyMindRules(path => readFileSync(resolve(process.cwd(), path), 'utf8'));
  // Both briefings are built once; each turn carries the one that matches whether its tools are on now (default on,
  // withdrawn when the record is removed or its grant no longer resolves).
  const packets = new Map([true, false].map(tools => [tools, sourcePacket(path => readFileSync(resolve(process.cwd(), path), 'utf8'), SOURCE_PINS,
    { providerAttempts: view.limits.maxCalls, expiresAt: view.expires, tools }).sources]));
  const deskStatusPath = resolve(options['desk-status'] ?? join(root, 'desk-status.md'));
  return turn => {
    const now = wallNow(), log = runs();
    const sources = packets.get(Boolean(toolsOn()));
    const desk = deskStatusSource(readDeskStatus(deskStatusPath), now, deskStatusPath);
    const note = handoff();
    return [...sources, disciplineSource(view), selfStateSource(selfStateBrief(view, log, now, timeZoneOf(options), current())), desk, ...(note ? [note] : [])];
  };
};
/** The installed runner, read from this checkout: repository paths only, never outside it. */
const repoRead = path => { try { return readFileSync(resolve(process.cwd(), path), 'utf8'); } catch { return null; } };
const repoFile = path => { try { return lstatSync(resolve(process.cwd(), path)).isFile(); } catch { return false; } };
/** Rule 59: the harness's silent-stop table is admitted, with every captured case resolved, before a launch. */
/** The desk's sealed authority record: written to a new file, never replacing one (Rules 7, 32: declared store). */
const writeSealedAuthority = (path, sealed) => writeFileSync(path, `${JSON.stringify(sealed, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
const admitHarness = () => admitPreviewHarness(repoRead);
/** Rules 26, 44: the exact code this process executes (import closure, loader, spawned children) and the checkout revision. */
const installedCode = () => {
  let revision = null;
  try { revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: process.cwd(), encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 }).trim() || null; } catch { revision = null; }
  return installedCodeOf(path => { try { return readFileSync(resolve(process.cwd(), path)); } catch { return null; } }, repoFile, revision);
};
/** Rules 9, 96, 114: the other runner roots beside this one (the same parent directory) are this machine's other
 * owned preview runners. Each is read from its own run log only; a bounded number of roots and bytes. */
const OWNED_ROOT_LIMIT = 256, OWNED_RUN_LOG_BYTES = 1024 * 1024;
/** The conversation a runner polls, recorded on its launch row so a sibling can see a shared conversation. */
const conversationOf = genesis => `telegram/bot-${genesis.bot}/chat-${genesis.chat}`;
/** Whether a possible root another runner's flattened command line could name exists now; only a path proven
 * missing (ENOENT, ENOTDIR, or a name too long to exist) is ruled out, so an unreadable one keeps it unknown. */
const PATH_MISSING = new Set(['ENOENT', 'ENOTDIR', 'ENAMETOOLONG']);
const pathExists = path => { try { lstatSync(path); return true; } catch (error) { return !PATH_MISSING.has(error?.code); } };
/** A launch with no exit row is running only while its recorded pid is still that root's runner. */
const ownedProcess = (pid, root) => {
  if (!Number.isSafeInteger(pid) || pid <= 0) return 'unknown';
  try {
    // The exact --root argument decides (ownedProcessOf); another spelling of the root is unknown, never guessed.
    return ownedProcessOf(execFileSync('ps', ['-ww', '-p', String(pid), '-o', 'command='], { encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'], timeout: 2000 }), root, pathExists);
  } catch (error) { return error?.status === 1 ? ownedProcessOf(null, root, pathExists) : 'unknown'; }
};
const ownedActivity = root => {
  const parent = dirname(root);
  let names = [];
  try { names = readdirSync(parent).sort(); } catch { return { others: [], scanned: 0, truncated: false, unreadable: 1 }; }
  const others = []; let scanned = 0, unreadable = 0;
  for (const name of names.slice(0, OWNED_ROOT_LIMIT)) {
    const sibling = join(parent, name), path = join(sibling, 'runs.jsonl');
    if (sibling === root) continue;
    let stat; try { stat = lstatSync(path); } catch { continue; }
    if (!stat.isFile() || stat.size > OWNED_RUN_LOG_BYTES) { unreadable++; continue; }
    let text; try { text = readFileSync(path, 'utf8'); } catch { unreadable++; continue; }
    scanned++;
    const launch = latestOwnedLaunch(name, text);
    if (launch) others.push({ ...launch, process: launch.exit === undefined ? ownedProcess(launch.pid, sibling) : 'absent' });
  }
  return { others, scanned, truncated: names.length > OWNED_ROOT_LIMIT, unreadable };
};
/** What the agent is told about itself, independent of the trial's changing limits. */
const briefingDigest = (tools = false) => briefingDigestOf([...sourcePacket(path => readFileSync(resolve(process.cwd(), path), 'utf8'),
  SOURCE_PINS, { providerAttempts: 0, expiresAt: 0, tools }).sources.map(source => source.text), ANSWER_INSTRUCTIONS]);
/** The operator's IANA time zone for "today"; UTC unless given. An unknown zone refuses. */
/** Plan #389: the desk's current retraction proposal on this root, or none. A malformed file proposes nothing. */
const readRetractProposal = path => {
  try {
    if (!existsSync(path)) return undefined;
    const saved = JSON.parse(readFileSync(path, 'utf8'));
    return saved?.version === 1 && validRetractUpdates(saved.updates) && typeof saved.reason === 'string' && Number.isSafeInteger(saved.proposedAt)
      ? { updates: saved.updates, reason: saved.reason, proposedAt: saved.proposedAt } : undefined;
  } catch { return undefined; }
};
const timeZoneOf = options => { const zone = options['time-zone'] ?? 'America/Los_Angeles'; zoneFormatter(zone); return zone; };
/** Recall metadata and labels, never static sources or history text. */
const recallView = packet => ({ historyMode: packet.historyMode, summaryThrough: packet.summary?.through ?? null, summarySourceKind: packet.summary?.sourceKind ?? null,
  historySetAside: packet.historySetAside ? { count: packet.historySetAside.count, through: packet.historySetAside.through } : null,
  replyTo: packet.replyTo ?? null,
  people: packet.people ?? [], personAttributes: packet.personAttributes ?? [], personMergeCandidates: packet.personMergeCandidates ?? [], personMerges: packet.personMerges ?? [], commitments: packet.commitments ?? [], openQuestions: packet.openQuestions ?? [], channelMemory: packet.channelMemory ?? [], memory: packet.memory ?? [],
  lastNamedPerson: packet.lastNamedPerson ?? null,
  dated: packet.dated ?? [], datedScope: packet.datedScope ?? null, moreDated: packet.moreDated ?? 0,
  datedPending: packet.datedPending ?? [], moreDatedPending: packet.moreDatedPending ?? 0,
  preferences: packet.preferences ?? [],
  openConflicts: packet.openConflicts ?? [],
  inventory: packet.inventory ?? null,
  memorySearch: packet.memorySearch ?? { items: [], forgotten: 0 },
  // Rule 11: the one lookup's offer ("offered") or, on its second packet, what was searched and how many were found.
  memoryLookup: packet.memoryLookup ?? null,
  meaningIndexCoverage: packet.meaningIndexCoverage ?? null,
  continuity: packet.continuity ?? null,

  contradictions: packet.contradictions ?? [],
  ...(packet.concurrentWork ? { concurrentWork: packet.concurrentWork } : {}),
  restartHandoff: packet.sources?.find(source => source.id === 'restart-handoff')?.text ?? null,
  // The generated capability briefing this turn received, with its register provenance (Rules 78, 84).
  capabilityNote: (note => note ? { text: note.text, provenance: note.provenance } : null)(packet.sources?.find(source => source.id === 'capability-note')),
  recalled: packet.recalled?.length ?? 0, recalledIds: (packet.recalled ?? []).map(item => item.id ?? null), recalledSourceKinds: (packet.recalled ?? []).map(item => item.sourceKind), history: packet.history?.length ?? 0, historySourceKinds: (packet.history ?? []).map(item => item.sourceKind),
  replyProvenance: packet.replyProvenance ? { update: packet.replyProvenance.update,
    recorded: packet.replyProvenance.recorded !== null,
    history: packet.replyProvenance.recorded?.history?.length ?? 0,
    recalled: packet.replyProvenance.recorded?.recalled?.length ?? 0,
    channelSourceIds: (packet.replyProvenance.recorded?.channelMemory ?? []).map(item => item.sourceId) } : null,
  sourceLabels: Object.fromEntries(['summary', 'memorySummary', 'history', 'recalled', 'people', 'commitments',
    'channelMemory', 'memory', 'memoryCandidates'].map(part => [part, (Array.isArray(packet[part]) ? packet[part]
      : packet[part] ? [packet[part]] : []).map(item => item.sourceLabel ?? null)])),
  corrections: (packet.corrections ?? []).map(item => ({ update: item.update, date: item.date, rules: item.findings.map(f => f.rule),
    problems: item.findings.map(f => f.possibleProblem) })) });
const withheldView = view => {
  const preferenceKeys = new Set();
  for (const change of view.memory) {
    if (change.mode === 'prefer') preferenceKeys.add(JSON.stringify([change.source, change.quote]));
    else if (change.mode === 'correct' && preferenceKeys.has(JSON.stringify([change.source, change.quote])))
      preferenceKeys.add(JSON.stringify([change.trigger, change.replacement]));
  }
  return view.memory.filter(change => change.mode !== 'prefer').map(change => ({
    ...(change.source.startsWith('channel:')
      ? { channelSource: view.channelItems.get(change.source.slice('channel:'.length))?.source,
        channelSourceId: redact(view.channelItems.get(change.source.slice('channel:'.length))?.id ?? '').text }
      : { sourceUpdate: view.turns.get(change.source)?.update }),
    operatorUpdate: view.turns.get(change.trigger)?.update,
    ...(change.mode === 'correct' ? { quote: redact(change.quote).text } : {}),
    ...(change.in === 'reply' ? { in: 'reply' } : {}),
    reason: preferenceKeys.has(JSON.stringify([change.source, change.quote]))
      ? change.mode === 'forget' ? 'verified operator removed this reply preference' : 'verified operator changed this reply preference'
      : change.mode === 'forget' ? 'verified operator requested forgetting'
        : change.historical ? 'newer verified operator statement updated this fact'
        : change.in === 'reply' ? 'verified operator corrected this answer' : 'verified operator corrected this fact' }));
};

// Content-free counts of how model JSON arrived: malformed shapes (why a result was
// refused) and tolerated wrappers. Diagnostics only: never model text, never an outcome input.
const readShapes = path => {
  try { const saved = JSON.parse(readFileSync(path, 'utf8')); return saved.version === 1 ? saved : null; }
  catch { return null; }
};
const recordShape = (path, role, layer, outcome, shape) => {
  try {
    const saved = readShapes(path) ?? { version: 1, counts: {}, last: null };
    const key = `${role}/${layer}/${outcome}/${shape}`;
    saved.counts[key] = (saved.counts[key] ?? 0) + 1;
    if (outcome === 'malformed') saved.last = { role, layer, shape, at: wallNow() };
    durablePreviewWrite(path, saved);
  } catch { /* a diagnostics write never changes a model outcome */ }
};
const roleOf = id => id.endsWith(':reply-review') || id.endsWith(':revision-review') ? 'reply-review' : /^summary:.*:review$/u.test(id) ? 'summary-review'
  : /^retrospective:\d+(?::duties)?$/u.test(id) ? 'retrospective' : 'answer';
/** Rule 95, the fail direction of this consumer: may text around one complete Decision object be
 * discarded? The answer side says yes — the answer, a reply revision and the summary writer, which
 * `roleOf` folds into `answer`. Their output is reviewed again (the reply review, the faithfulness
 * cascade) before any of it can reach the operator, so dropping a wrapper skips no gate, while
 * refusing it costs the operator the answer the model did produce (Rules 15 and 77: the live 2026-10-01
 * k6 turn was answered "I couldn't produce an answer" twice for this reason alone). Every other role
 * here IS a gate — a reply or summary review verdict, or the internal retrospective — and keeps the
 * narrow reading, because prose beside a verdict may be a written rejection that must not be dropped
 * and no later review would catch it. Nothing branches on what the text means, only on which consumer asked.
 */
const wrappedPolicyOf = role => role === 'answer' ? 'accept' : 'refuse';
/** The registered live judgment a subscription call serves (model-call-boundary.ts). A revised
 * reply's held-class review is a reply review; the revision is the agent's own response to the
 * objections, with its own floor. A retrospective pass is its own judgment, and so is its duty follow-up
 * (`retrospective:N:duties`); its benchmark reruns (`retrospective:N:rerun:I`) replay an answer. */
const judgmentOf = id => id.endsWith(':reply-review') || id.endsWith(':revision-review') ? 'reply-review'
  : id.endsWith(':reply-revision') ? 'reply-revision' : /^summary:.*:review$/u.test(id) ? 'summary-review'
  : /^summary:/u.test(id) ? 'summary' : /^retrospective:\d+(?::duties)?$/u.test(id) ? 'retrospective' : 'answer';

const contextOf = prompt => JSON.parse(JSON.parse(prompt).messages.find(m => m.role === 'context').content).packet;
/** Rules 3, 17 and 47: which standing instructions the prepared prompt carried, by digest and rule number. */
const instructionsOf = prompt => {
  const message = JSON.parse(prompt).messages.find(m => m.role === 'instructions');
  return message ? { sha256: `sha256:${createHash('sha256').update(message.content, 'utf8').digest('hex')}`,
    rules: [...message.content.matchAll(/^Rule (\d+) — /gmu)].map(match => Number(match[1])) } : null;
};
/** Rule 29: the verified writer the session envelope carried, or null for a legacy prompt. */
const writerOf = prompt => JSON.parse(JSON.parse(prompt).messages.find(m => m.role === 'context').content).bindings?.writer ?? null;
const lastReplyReview = view => {
  const turn = view.order.filter(item => item.reviewState !== undefined).at(-1);
  return turn ? { update: turn.update, state: turn.reviewState, diagnostics: turn.reviewDiagnostics ?? null } : null;
};
const packetStatus = view => {
  const last = view.order.filter(turn => turn.reserved).at(-1);
  if (!last) return null;
  return { update: last.update, bytes: last.prompt === undefined ? null : Buffer.byteLength(last.prompt),
    limit: last.packetLimit ?? view.limits.maxBytes,
    dropped: last.packetDropped ?? 'unavailable in earlier reservation',
    capacity: packetCapacity(last.packetDropped, last.packetLimit ?? view.limits.maxBytes) };
};
/** The resource owner's persisted snapshot, with its live quantities rendered as measured claims (Rule 13). */
const resourceStatus = (path, view) => {
  // Durable waste/repair facts come from the journal's call-outcome rows (they survive restart and
  // compaction); the owner's file is the bounded live view.
  const counts = view.callOutcomeCounts, durable = Object.fromEntries(['capacity', 'memory', 'processes', 'cpu', 'aggregate', 'timeout',
    'leaked-descendants', 'cleanup-unresolved'].map(key => [key, counts.get(key) ?? 0]));
  const last = view.callOutcomes.findLast(row => row.outcome.resources)?.outcome.resources;
  const enforcement = last?.enforcement ?? null;
  // Per-launch evidence of the calls this view still holds (correlated by call id, never a lifetime peak).
  const launches = view.callOutcomes.map(({ id, role, outcome, at }) => ({ id, role, at, localLimit: outcome.localLimit,
    admission: outcome.resources?.admission ?? null, cleanup: outcome.resources?.cleanup ?? null,
    peakMemoryBytes: outcome.resources?.peakMemoryBytes ?? null,
    uidProcesses: outcome.resources?.uidProcesses ?? null,
    membership: outcome.resources?.membership ?? null, allocation: outcome.resources?.allocation ?? null }));
  let state;
  try { state = JSON.parse(readFileSync(path, 'utf8')); } catch { return { state: 'unobserved', durable, enforcement, launches }; }
  if (state?.version !== 1) return { state: 'unobserved', durable, enforcement, launches };
  const claims = (state.active ?? []).flatMap(launch => [
    renderMeasured(liveMeasurement('owned-process-memory', `launch:${launch.id}`, launch.memoryBytes, state.at)),
    renderMeasured(liveMeasurement('owned-process-count', `launch:${launch.id}`, launch.processes, state.at))]);
  const points = state.sample?.points ? resourcePointClaims(state.sample.points, state.identity?.cores ?? 1) : [];
  return { ...state, claims, points, durable, launches, enforcement: enforcement ?? state.lastLaunch?.enforcement ?? null,
    uidProcesses: last?.uidProcesses ?? state.lastLaunch?.uidProcesses ?? null };
};

/** The retrospective review's proof of running, its accounting, grades and open work (content-free except its own findings). */
const retrospectiveView = (view, now) => { const digest = replyContextDigest(view);
  const grades = [...latestGrades(view).values()];
  return { passes: view.retroPasses.map(pass => ({ pass: pass.pass, at: pass.at,
    state: pass.state ?? 'in-flight-or-unknown', reason: pass.reason ?? null, eligible: pass.eligible,
    supplied: pass.cases.length, deferredByBound: Math.max(0, pass.eligible - pass.cases.length),
    namedDeferrals: pass.omitted.length,
    estimatedAnswerBytes: pass.estimatedAnswerBytes ?? null, outputTokens: pass.outputTokens ?? null,
    inspected: pass.result ? pass.result.inspected.length : null, omittedByReview: pass.result ? pass.result.omitted.length : null,
    accounting: passAccounting(pass), efficiency: pass.result?.efficiency.summary ?? null,
    duties: pass.result?.duties.map(item => ({ duty: item.duty, disposition: item.disposition, note: item.note })) ?? [],
    gravityWellsObserved: pass.result?.gravityWells.filter(item => item.observed).map(item => item.well) ?? [],
    findings: pass.result?.findings.map(item => ({ id: item.id, duty: item.duty, refs: item.refs, summary: item.summary, recurs: item.recurs ?? [],
      rootCause: item.rootCause ?? null, structuralRemedy: item.structuralRemedy ?? null,
      disposition: 'owner' in item.disposition ? `owned by ${item.disposition.owner}` : 'declined with reason' })) ?? [],
    reruns: (pass.reruns ?? []).map(run => ({ index: run.index, case: run.case, state: run.state ?? 'in-flight-or-unknown' })),
    dutyFollowUp: pass.dutyFollowUp ? { duties: pass.dutyFollowUp.duties, state: pass.dutyFollowUp.state ?? 'in-flight-or-unknown',
      reason: pass.dutyFollowUp.reason ?? null } : null })),
  grades: grades.map(({ grade, pass }) => ({ case: grade.case, pass, conclusion: grade.conclusion.assessment, reason: grade.reason.assessment,
    outcome: grade.outcome.assessment, outcomeReason: grade.outcome.reason, rederivation: grade.rederivation ?? null, reassessment: grade.reassessment === true })),
  pendingGrades: pendingGrades(view).length,
  openFindings: openFindings(view).map(item => ({ id: item.id, duty: item.duty, next: 'next' in item.disposition ? item.disposition.next : null })),
  feedbackDispositions: feedbackDispositions(view).map(item => ({ case: item.case, disposition: item.disposition, finding: item.finding ?? null,
    evidence: item.evidence ?? [], reason: item.reason ?? null })),
  standingGrantCandidates: standingGrantCandidates(view).map(item => ({ case: item.case, presentable: item.presentable,
    recurrences: item.recurrences, scope: item.scope })),
  promotedCases: promotedCases(view).map(item => ({ case: item.provenance.case, expected: item.expected, pass: item.provenance.pass,
    contextDigest: item.provenance.contextDigest, pending: item.pending })),
  benchmarkReruns: benchmarkReruns(view), rerunsDue: rerunsDue(view, digest).length, rerunDispositions: rerunDispositions(view, digest),
  owed: (() => { const owed = owedCases(view, retrospectiveCases(view), now);
    return { cases: owed.length, byCategory: Object.fromEntries(['message', 'decision', 'verdict', 'repair', 'authorization', 'open', 'rerun']
      .map(category => [category, owed.filter(row => row.item.category === category).length])),
      oldestSince: owed.reduce((min, row) => Math.min(min, row.since), Number.MAX_SAFE_INTEGER) === Number.MAX_SAFE_INTEGER ? null
        : owed.reduce((min, row) => Math.min(min, row.since), Number.MAX_SAFE_INTEGER) }; })(),
  contextDigest: digest, answerBudget: retroAnswerBudget(view.retroPasses),
  // The DOORWAY/MODEL routing label (docs/01 lesson 5: a routing choice no benchmark backs is labelled
  // unmeasured). One route, no benchmark behind it, so it stays 'unmeasured' — this field is NOT about the
  // answer budget, and overloading it would make a reader checking that arm read a measured routing choice
  // where there is none.
  routeSelection: 'unmeasured',
  // The answer BUDGET's route, under its own name: 'measured' once a completed pass recorded both its estimate
  // and what its answer really cost, 'start' while this root has measured nothing and asks at the small start.
  answerBudgetRoute: view.retroPasses.some(pass => pass.state === 'complete'
    && typeof pass.estimatedAnswerBytes === 'number' && typeof pass.outputTokens === 'number')
    ? 'measured' : 'start' }; };
const stepCheckView = view => ({ total: view.stepChecks.size,
  unchecked: [...view.stepChecks.values()].filter(item => !item.reserved).length,
  verdicts: [...view.stepChecks].map(([step, item]) => ({ step,
    reserved: item.reserved === true, result: item.result ?? null })) });


async function main() {
  const { command, options } = parse(process.argv.slice(2));
  if (options['step-check'] !== undefined && !['true', 'false'].includes(options['step-check'])) throw Error('preview: --step-check must be true or false');
  const stepCheckEnabled = options['step-check'] === 'true';
  if (options.retrospective !== undefined && !['true', 'false'].includes(options.retrospective)) throw Error('preview: --retrospective must be true or false');
  // On by default: one bounded pass at most hourly, inside the model-attempt cap with a reply reserve.
  const retrospectiveEnabled = options.retrospective !== 'false';
  // Part 18 (plan #402): the live sentinels, all on by default; `--sentinels none` (or a subset) is the off-switch.
  const sentinelFamilies = sentinelFamiliesOf(options.sentinels);
  if (!['run', 'status', 'stop', 'raise-caps', 'renew-expiry', 'inspect', 'import-store', 'audit', 'export-memory', 'seal-authority', 'record-live-proof', 'check-agreements', 'propose-retract'].includes(command)) throw Error('preview: unknown command');
  if (command === 'seal-authority') {
    // The desk's recording step: seals the authority record it decided, under the trial's storage
    // SecretRef, into a new file (never replacing one). Nothing else is read or written.
    const sealed = sealAuthorityRecord(JSON.parse(readFileSync(required(options, 'authority-record'), 'utf8')), authoritySealKey(key()));
    writeSealedAuthority(resolve(required(options, 'out')), sealed);
    return;
  }
  // Rules 30, 59: an unregistered doorway or an incomplete silent-stop table refuses the launch.
  // Plan #502: a half-given or public read-only dashboard refuses the launch before anything else starts.
  if (command === 'run') { admitHarness(); subscriptionDoorway(options.doorway ?? DEFAULT_SUBSCRIPTION_DOORWAY); readOnlyDashboardOf(options); }
  // Rule 30: every activation check, policy bound and route construction below goes through the
  // selected doorway, so a root configured for another registered doorway runs on that doorway's
  // CLI, model shape and parser instead of the first one that happened to be written here.
  const doorway = subscriptionDoorway(options.doorway ?? DEFAULT_SUBSCRIPTION_DOORWAY);

  const root = resolve(required(options, 'root'));
  if (command === 'run') mkdirSync(root, { recursive: true, mode: 0o700 });
  if (realpathSync(root) !== root || lstatSync(root).isSymbolicLink()) throw Error('preview: substituted root');
  const stopPath = join(root, 'preview-stop.json');
  const retractPath = join(root, 'preview-retract-proposal.json');
  const journalPath = join(root, 'journal.encrypted');
  const importPath = join(root, 'preview-import.json');
  const runsPath = join(root, 'runs.jsonl');
  const proofsPath = proofsPathOf(root);
  const shapesPath = join(root, 'model-json-shapes.json');
  const agreementsPath = join(root, 'agreements.jsonl');
  // Rule 63: conversation ownership is claimed in a HOST-scope directory so a second root for the same
  // conversation is fenced too. Tests point it at a per-file temporary directory.
  const ownersDirectory = () => {
    const directory = resolve(options['conversation-owners'] ?? process.env.INSTAR_CONVERSATION_OWNERS
      ?? join(homedir(), '.instar', 'conversation-owners'));
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    return realpathSync(directory);
  };
  const ownerMachine = options['owner-machine'] ?? hostname();
  // Rule 33: the one input every declared store agreement is checked against (the loop's cadence and the offline check).
  const agreementInput = (view, now) => ({ view, runs: readRuns(runsPath), root, now,
    ownership: observeConversationOwner({ directory: ownersDirectory(), bot: view.genesis.bot, chat: view.genesis.chat, machine: ownerMachine,
      probePid: pid => process.kill(pid, 0), now }),
    replay: () => { const replayed = openPreviewJournal(journalPath, key(), undefined, undefined, true);
      try { return projectionDigest(replayed.view); } finally { replayed.close(); } } });
  // Rule 113: the declared multi-machine posture. Only single-machine has a conversation authority today.
  const posture = options['machine-posture'] ?? process.env.INSTAR_MACHINE_POSTURE ?? 'single-machine';
  if (posture !== 'single-machine' && posture !== 'multi-machine') throw Error('preview: machine-posture must be single-machine or multi-machine');
  // A multi-machine posture is served only with a shared conversation authority; without one it stays inhibited.
  const authorityUrl = options['conversation-authority'] ?? null;
  if (authorityUrl !== null && posture !== 'multi-machine') throw Error('preview: --conversation-authority needs --machine-posture multi-machine');
  const multi = posture === 'multi-machine' && authorityUrl !== null;
  if (options['journal-lineage'] !== undefined && (options['journal-lineage'] !== 'seed' || !multi))
    throw Error('preview: --journal-lineage is only seed, and only with a shared conversation authority');
  const topology = multi ? { posture, supported: true,
    authority: 'shared conversation authority (one voter); the journal is replicated to the other machine and every send waits for its acknowledgement' }
    : { posture, supported: posture === SUPPORTED_POSTURE, authority: 'host-local conversation lease (this machine only)',
    ...(posture === SUPPORTED_POSTURE ? {} : { reason: 'no shared conversation authority exists for a multi-machine posture; this runner does not serve it' }) };
  const resourcesPath = join(root, 'resources.json');
  const launchesPath = join(root, 'owned-launches.json');
  const doorwaysPath = join(root, 'doorway-map.json');
  timeZoneOf(options);
  const importMarker = existsSync(importPath) ? JSON.parse(readFileSync(importPath, 'utf8')) : null;
  if (importMarker && (importMarker.version !== 1 || typeof importMarker.source !== 'string'))
    throw Error('preview: import marker malformed');
  if (command === 'stop') {
    if (!existsSync(journalPath)) throw Error('preview: journal absent');
    if (!existsSync(stopPath)) durablePreviewWrite(stopPath, { latchedAt: wallNow(), reason: 'operator' });
    return;
  }
  if (command === 'propose-retract') {
    // Plan #389, Rule 35: the desk proposes the exact test-origin turns; nothing is applied here and nothing is sent from
    // here. It leaves one proposal on the root for the running runner, which renders it and opens the operator's approval
    // exactly as a raise is opened, during operator hours only. Only the operator's yes applies it (never chat text).
    // A refusal names its fixed reason on stdout (never a secret or message text), so the desk sees why nothing was proposed.
    const refuse = reason => { process.stdout.write(`${JSON.stringify({ refused: reason })}\n`); process.exitCode = 1; };
    const now = wallNow(), zone = timeZoneOf(options);
    if (!withinOperatorHours(now, zone))
      return refuse(`propose-retract runs only during operator hours (${OPERATOR_HOURS.start}:00 to ${OPERATOR_HOURS.end}:00 ${zone})`);
    if (existsSync(stopPath)) return refuse('stop latched');
    const lines = readFileSync(required(options, 'updates-file'), 'utf8').split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'));
    if (lines.some(line => !/^\d+(?:\.\d+)?$/u.test(line))) return refuse('--updates-file holds one Telegram update id per line');
    const updates = lines.map(Number).sort((left, right) => left - right);
    if (!validRetractUpdates(updates)) return refuse('the update list must be 1 to 1000 distinct ids');
    const reason = options.reason ?? 'desk and test traffic sent through your account (residue audit, plan #387)';
    const peek = openPreviewJournal(journalPath, key(), undefined, undefined, true);
    try {
      const refusal = retractRefusal(peek.view, updates);
      if (refusal !== null) return refuse(refusal);
      const proposal = { updates, reason, proposedAt: now };
      const rendering = retractRendering(peek.view, { action: 'retract-turns', updates });
      durablePreviewWrite(retractPath, { version: 1, ...proposal });
      process.stdout.write(`${JSON.stringify({ proposed: updates.length, first: rendering.first, last: rendering.last, reason,
        carrier: retractCarrier(proposal), sendBy: new Date(now + OPERATOR_REQUEST_MS).toISOString(),
        next: 'the running runner renders this exact request and opens the operator approval; nothing changes without their yes' })}\n`);
    } finally { peek.close(); }
    return;
  }
  if (command === 'audit') {
    const journal = openPreviewJournal(journalPath, key(), undefined, undefined, true, undefined, true);
    try {
      const report = auditJournal(journal.view);
      process.stdout.write(`${JSON.stringify(report)}\n`);
      if (report.findings.length) process.exitCode = 1;
    } finally { journal.close(); }
    return;
  }
  if (command === 'check-agreements') {
    // Offline and forced: runs every declared comparison now on this root (a copy), with a read-only journal and no
    // Telegram call, then reports whether the last exit's frontier still equals the journal so the exit check is measurable.
    const journal = openPreviewJournal(journalPath, key(), undefined, undefined, true);
    try {
      const input = agreementInput(journal.view, wallNow()), frontier = projectionDigest(journal.view);
      const exited = [...input.runs.launches].reverse().find(run => run.exit !== undefined && run.unfinished !== undefined && !run.nonowner);
      const records = runDueAgreements(agreementsPath, input, true);
      process.stdout.write(`${JSON.stringify({ frontier, exitFrontier: exited?.frontier ?? null,
        frontierMatches: exited?.frontier === frontier, records })}\n`);
    } finally { journal.close(); }
    return;
  }
  if (command === 'export-memory') {
    const journal = openPreviewJournal(journalPath, key(), undefined, undefined, true);
    try { process.stdout.write(memoryReport(journal.view)); }
    finally { journal.close(); }

    return;
  }
  if (command === 'status') {
    const statusNow = wallNow(), statusZone = timeZoneOf(options);
    let view;
    try { view = openPreviewJournal(journalPath, key(), undefined, undefined, true); }
    catch (error) {
      if (!importMarker) throw error;
      process.stdout.write(`${JSON.stringify({ cursor: null, importComplete: false })}\n`);
      return;
    }
    try {
      const now = wallNow(), log = readRuns(runsPath);
      const lastSent = view.view.order.filter(turn => turn.sentAt !== undefined).at(-1);
      const g = view.view.genesis;
      const ownership = observeConversationOwner({ directory: ownersDirectory(), bot: g.bot, chat: g.chat, machine: ownerMachine,
        probePid: pid => process.kill(pid, 0), now });
      // Stranded (signal only): every current ownership record is assessed, with or without waiting input.
      const waiting = view.view.order.filter(turn => turn.accepted && turn.intent === undefined && turn.sent === undefined).length;
      const refusals = log.launches.filter(run => run.refused), lastRefusal = refusals.at(-1);
      const report = { cursor: view.view.cursor, turns: view.view.order.length,
      ownership: { ...ownership, holder: ownership.holder && { machine: ownership.holder.machine, since: ownership.holder.since,
        thisRoot: ownership.holder.root === root }, topology },
      stranded: assessStranded(ownership, waiting),
      // Startup refusals are counted host-wide for this conversation (every root sees the same number);
      // retirements of an existing worker that lost the fence, and inhibited launches, are this root's own.
      duplicateLaunchesRefused: refusedLaunches(ownersDirectory(), g.bot, g.chat),
      workersRetired: log.launches.filter(run => run.retired).length,
      inhibitedLaunches: log.launches.filter(run => run.inhibited).length,
      startupRefusals: { count: refusals.length, last: lastRefusal ? { at: lastRefusal.at, reason: lastRefusal.refused } : null },
      storeAgreements: agreementStatus(agreementsPath, now),
      // Two machines (Rules 2, 32): this root's place in the shared history; absent on a root that never had one.
      ...(sharedView => sharedView ? { sharedHistory: sharedView } : {})(sharedHistoryStatus(root, journalPath)),
      channelItems: view.view.channelItems.size,
      channelSources: Object.fromEntries(['telegram', 'slack'].map(source => [source, {
        ...(view.view.channelSources.get(source) ?? { offset: 0, scanned: 0, imported: 0, skipped: 0 }),
        error: view.view.channelSourceErrors.get(source) ?? null }])),
      calls: view.view.calls, replies: view.view.replies, limits: view.view.limits,
      tokens: view.view.tokenTotals,
      tokenTotal: Object.values(view.view.tokenTotals).reduce((total, kind) => ({
        calls: total.calls + kind.calls, inputTokens: total.inputTokens + kind.inputTokens,
        outputTokens: total.outputTokens + kind.outputTokens, unknownCalls: total.unknownCalls + kind.unknownCalls }),
      { calls: 0, inputTokens: 0, outputTokens: 0, unknownCalls: 0 }),
      capAuthority: view.view.capAuthority,
      expires: view.view.expires, expiryAuthority: view.view.expiryAuthority,
      stop: existsSync(stopPath) ? JSON.parse(readFileSync(stopPath, 'utf8')) : view.view.stop,
      sourceStop: view.view.sourceStop,
      importComplete: importMarker
        ? view.view.genesis.importSource === importMarker.source && view.view.imported
        : view.view.genesis.importSource === undefined || view.view.imported,
      summaryThrough: liveSummaries(view.view).at(-1)?.through ?? null,
      lastSummaryFaithfulness: view.view.lastSummaryFailure?.faithfulness
        && view.view.lastSummaryFailure.at >= (liveSummaries(view.view).at(-1)?.at ?? -1)
        ? { through: view.view.lastSummaryFailure.through, ...view.view.lastSummaryFailure.faithfulness,
          reason: view.view.lastSummaryFailure.reason }
        : liveSummaries(view.view).at(-1)?.faithfulness
          ? { through: liveSummaries(view.view).at(-1).through, ...liveSummaries(view.view).at(-1).faithfulness }
          : null,
      // The recorded reason of a summary failure newer than the last accepted summary (a fixed phrase, never content),
      // so a room that is not compacting says why: e.g. "summary output over the cap".
      lastSummaryFailure: view.view.lastSummaryFailure
        && view.view.lastSummaryFailure.at >= (liveSummaries(view.view).at(-1)?.at ?? -1)
        ? { through: view.view.lastSummaryFailure.through,
          reason: view.view.lastSummaryFailure.reason ?? view.view.lastSummaryFailure.failureClass ?? 'failed' }
        : null,
      // Rule 2: a frontier the over-cap brake stopped (no summary tried from this base at or past it) is said, not silent.
      summaryStoppedAt: summaryStoppedAt(view.view),
      packet: packetStatus(view.view),
      installation: (() => {
        const rows = installationRows(existsSync(runsPath) ? readFileSync(runsPath, 'utf8') : ''), last = rows.filter(row => row.codeDigest !== UNRECORDED).at(-1);
        if (!last) return null;
        let installed = null; try { installed = installedCode(); } catch { installed = null; }
        const update = installedUpdateFrom(rows, last, last.launch + 1);
        return { lastLaunch: { revision: last.revision, codeDigest: last.codeDigest, files: last.files, launch: last.launch },
          installed, stale: installed === null ? null : installed.codeDigest !== last.codeDigest,
          harness: last.harness, doorway: last.doorway, stallClasses: last.stallClasses, briefingDigest: last.briefingDigest,
          update, updateDelivered: update ? updateDelivery(update, view.view.order) : null };
      })(),
      journalCapacity: journalCapacity(view.compacted, PREVIEW_JOURNAL_COMPACT_BYTES),
      resources: resourceStatus(resourcesPath, view.view),
      doorways: (() => { const map = readDoorwayMap(doorwaysPath);
        return map ? { map, ...doorwayFreshness(map, statusNow), standing: map.check ?? null } : { map: null, fresh: false, models: [], prices: [], standing: null }; })(),
      credentials: (() => {
        // Rule 100 + purpose Rule 2: custody dispositions are durable on the intake rows, and every
        // referenced vault object (original capture, stored secret, vaulted registry row) is
        // checked live on this read path, so a lost or failed custody is visible, never silent.
        const turns = view.view.order.filter(turn => turn.custody);
        const custody = { stored: turns.filter(t => t.custody.state === 'stored').length,
          failed: turns.filter(t => t.custody.state === 'failed').map(t => t.update), missing: null };
        try { const vault = createSecretCustody(root, key(), wallNow), records = vault.records();
          custody.missing = vault.missing([...turns.flatMap(t => t.custody.state === 'stored' ? [t.custody.capture, ...t.custody.secrets] : []),
            ...records.filter(r => r.custody === 'preview-vault').map(r => r.name)]);
          return { records, due: dueWithDelivery(dueCredentialReminders(records, statusNow), view.view.order), custody,
            intact: custody.failed.length === 0 && custody.missing.length === 0,
            referencedIn: view.view.order.filter(turn => turn.text.includes('[credential stored before use: SecretRef ')).map(turn => turn.update) };
        } catch { return { records: null, due: null, custody, intact: false, error: 'registry unreadable' }; } })(),
      reconciliation: usageReconciliation(view.view),

      memoryHealth: memoryHealthLine(view.view),

      withheld: withheldView(view.view),
      heldRepliesToday: heldRepliesToday(view.view, statusNow, statusZone),
      conflicts: activeMemoryConflicts(view.view).map(item => ({ askedByUpdate: view.view.turns.get(item.askedBy)?.update,
        asked: item.asked, answeredByUpdate: item.answeredBy ? view.view.turns.get(item.answeredBy)?.update : null,
        first: { source: item.first.source, quote: redact(item.first.quote).text },
        second: { source: item.second.source, quote: redact(item.second.quote).text }, winner: item.winner ?? null })),
      undos: view.view.undos.map(item => ({ operatorUpdate: view.view.turns.get(item.trigger)?.update,
        change: item.change, kind: view.view.changeHistory[item.change]?.kind })),
      holds: heldNotices(view.view, existsSync(stopPath) || view.view.stop !== null || wallNow() >= view.view.expires),
      tooLong: view.view.order.filter(t => t.noticeClass === 'too-long-input' || t.intent === TOO_LONG_REPLY_NOTICE)
        // Rule 42: delivery reads the one durable send-outcome lookup; a definite refusal stays refused, with its reason.
        .map(t => { const holding = t.noticeClass === 'too-long-input' && t.intent !== TOO_LONG_INPUT_NOTICE ? 'holding reply ' : '';
          const settled = t.intent ? sendOutcomeOf(view.view, replyTarget(t), t.sent) : null;
          return { update: t.update, kind: t.noticeClass === 'too-long-input' ? 'input' : 'reply',
            delivery: !settled ? 'pending' : `${holding}${settled.kind === 'accepted' ? 'Telegram API accepted'
              : settled.kind === 'refused' ? 'refused' : 'UNKNOWN'}`,
            ...(settled?.kind === 'refused' ? { refusal: settled.reason } : {}) }; }),
      heldNotices: view.view.order.filter(t => t.heldNoticeIntent !== undefined).map(t => ({ update: t.update,
        ...(() => { const settled = sendOutcomeOf(view.view, `held-notice:${t.id}`, t.heldNoticeSent);
          return { state: settled.kind === 'accepted' ? 'api-accepted' : settled.kind === 'refused' ? 'refused' : 'UNKNOWN',
            ...(settled.kind === 'refused' ? { refusal: settled.reason } : {}) }; })() })),
      // Rule 15: the minimal responder's own finite reserve and every limited answer it gave.
      minimalReserve: { limits: MINIMAL_RESERVE, turnsUsedThisHour: reserveTurnsUsed(view.view, statusNow),
        repliesUsedThisHour: reserveRepliesUsed(view.view, statusNow),
        reserveTurns: view.view.order.filter(t => t.reserve).length,
        limitedAnswers: view.view.order.filter(t => t.limited?.lead === t.id).map(t => ({ update: t.update, reason: t.limited.reason,
          covers: view.view.order.filter(item => item.limited?.lead === t.id).map(item => item.update),
          ...(() => { const settled = sendOutcomeOf(view.view, `limited:${t.id}`, t.limitedSent);
            return { state: settled.kind === 'accepted' ? 'api-accepted' : settled.kind === 'refused' ? 'refused' : 'UNKNOWN',
              ...(settled.kind === 'refused' ? { refusal: settled.reason } : {}) }; })() })),
        // An owned outage: the message is preserved and the named required dependency was missing.
        outages: view.view.order.filter(t => t.minimalOutage && t.limited === undefined).map(t => ({ update: t.update,
          missing: t.minimalOutage.missing, since: t.minimalOutage.at, repair: minimalRepair(t.minimalOutage.missing) })),
        // The installed shape the last launch recorded: whether the single-machine profile (P-08) is accepted,
        // and whether the register generation it launched with is still the installed one.
        installation: (() => {
          let recorded = null;
          try { recorded = minimalPathOf(existsSync(runsPath) ? readFileSync(runsPath, 'utf8') : ''); } catch { recorded = null; }
          return recorded === null ? null : { ...recorded, registerInstalledNow: registerGeneration(),
            registerCurrent: recorded.register !== null && recorded.register === registerGeneration() };
        })() },
      // Plan #91: where an explicit yes can come from on this root (chat, or the operator's GitHub review), whether an
      // operator acceptance of shared account access is current, the two operator actions' live surface, and the recent
      // requests, each approval admitted under an acceptance carrying the shared-access disclosure.
      ...(() => {
        let explicitYes;
        try {
          const install = explicitYesInstallationOf(options)?.();
          explicitYes = explicitYesStatus(install, { chat: g.chat, operator: g.operator, trial: g.grant },
            { connected: options['review-repository'] !== undefined && Boolean(process.env.INSTAR_SECRET_PREVIEW_GITHUB_TOKEN) });
          if (options['explicit-yes-installation'] !== undefined && install === undefined) explicitYes = { ...explicitYes, reason: 'the installation record is unreadable' };
        } catch (error) { explicitYes = { connected: false, error: error instanceof Error ? error.message : 'invalid' }; }
        // Rule 79: renewal is a phone action only while the installed renewal record validates now exactly as `run`
        // validates it (same function), for a trial end later than this journal's. Any refusal keeps the host wording.
        let renewalInstalled = false;
        try {
          renewalInstalled = SUBSCRIPTION_PREVIEW_EXPIRY > view.view.expires
            && renewalActivationOf(options, () => view.view)(SUBSCRIPTION_PREVIEW_EXPIRY) !== null;
        } catch { renewalInstalled = false; }
        return { explicitYes, operatorActionSurface: operatorActionSurface(explicitYes, renewalInstalled),
          operatorRequests: operatorRequestsReport(view.view, now) };
      })(),
      // The independent approval page: whether it is installed and can approve now (a passkey is enrolled).
      approvalSurface: (() => { try { return approvalSurfaceOf(options)?.status() ?? { installed: false }; }
        catch (error) { return { installed: false, reason: error instanceof Error ? error.message : 'invalid' }; } })(),
      // Operator requests: a stop press decides the brake; a raise completes only on the verified surface.
      approvals: view.view.order.filter(t => t.approval).map(t => ({ update: t.update, action: t.approval.action,
        decision: t.approval.decision ?? 'pending', applied: t.approval.applied === true,
        verified: t.approval.verified?.challenge ?? null, challenge: t.approval.challenge?.id ?? null })),
      // The supervisor's incident, when one is open: evidence and why no notice was sent.
      incident: (() => { try { const e = JSON.parse(readFileSync(join(root, 'host-watch.json'), 'utf8'));
        return e.open ? { id: e.id, phase: e.phase, failedAttempts: e.failedAttempts, since: e.openedAt,
          inhibitedBy: e.inhibitedBy ?? [] } : null; } catch { return null; } })(),
      unknownCalls: unknownCallCounts(view.view).total,
      unknownCallBreakdown: unknownCallCounts(view.view),
      // Still UNKNOWN (and counted above); an authorized raise wrote these off as fully spent (docs/09).
      unknownWrittenOff: view.view.writtenOff?.length ?? 0,
      capReports: [...view.view.capReports],

      modelFailureClasses: Object.fromEntries(view.view.failureClasses),
      modelJsonShapes: readShapes(shapesPath),
      modelResultStates: Object.fromEntries(view.view.providerStates),
      callOutcomeCounts: Object.fromEntries(view.view.callOutcomeCounts),
      lastCallOutcomes: view.view.callOutcomes.map(({ id, role, outcome, at }) => ({ id, role, ...outcome, at })),
      unknownSends: sendOutcomeCounts(view.view).unknown,
      sendOutcomes: sendOutcomeCounts(view.view),
      modelCalls: view.view.modelCalls,
      // Rules 28/29/35: who wrote each admitted turn, by verified origin.
      intakeWriters: { verifiedOperator: view.view.order.filter(t => t.writer?.kind === 'person').length,
        scheduler: view.view.order.filter(t => t.writer?.kind === 'system').length,
        legacyExactBinding: view.view.order.filter(t => t.accepted && !t.writer).length,
        testOrigin: view.view.order.filter(t => t.writer?.adapter?.endsWith(':offline-test-endpoint')).length,
        refused: view.view.order.filter(t => !t.accepted).length },
      replyGrounding: { recorded: view.view.order.filter(t => t.intent && t.grounding).length,
        unavailableLegacy: view.view.order.filter(t => t.intent && !t.grounding).length },
      answerProvenance: { unlabeledRecallReplies: view.view.order.filter(t => t.unlabeledRecall
        && t.answer !== undefined && t.intent === `PREVIEW — ${t.answer}`).length },

      summaries: view.view.summaries.map((s, index) => ({ through: s.through, people: s.people ? s.people.length : null,
        commitments: s.commitments ? s.commitments.length : null, closed: s.closed?.length ?? 0,
        memory: s.memory ? s.memory.length : null, ...(view.view.retiredSummaries?.includes(index) ? { retired: true } : {}) })),
      commitments: { total: view.view.commitments.length, open: view.view.commitments.filter((note, id) => !view.view.closed.has(id)
        && !retractedTurn(view.view, note.source)).length },
      // Plan #389, Rule 35: how many turns an approved retraction says were never the operator's, and the summaries it retired.
      ...(view.view.retracted ? { retracted: { turns: view.view.retracted.length, retiredSummaries: view.view.retiredSummaries?.length ?? 0 } } : {}),
      mentionedDates: view.view.mentionedDates.size,
      // The one general capability: what the operator asked for at a later time, answered once when due. An older
      // journal's fixed-text reminder batches count as earlier sends of it.
      requestedActions: (() => {
        const dueTurns = view.view.order.filter(t => t.requestedAction && !t.requestedAction.legacy);
        const kinds = [...dueTurns.filter(t => t.intent !== undefined).map(t => replyOutcomeOf(view.view, t))
            .map(whole => whole.started ? whole.outcome.kind : 'sending'),
          ...[...view.view.reminders.entries()].map(([key, item]) => reminderOutcome(view.view, key, item).kind)];
        return { requested: view.view.dated.filter(item => item.remind).length, cancelled: view.view.reminderCancels.length,
          accepted: kinds.filter(kind => kind === 'accepted').length, refused: kinds.filter(kind => kind === 'refused').length,
          unknown: kinds.filter(kind => kind === 'unknown').length,
          open: openRequests(view.view).map(item => ({ sourceUpdate: view.view.turns.get(item.source)?.update,
            quote: redact(item.quote).text, due: `${reminderDue(item)} ${item.zone}` })),
          dueTurns: dueTurns.map(t => ({ update: t.update, requests: t.requestedAction.items.length + (t.requestedAction.overflow?.length ?? 0),
            state: t.intent !== undefined ? (whole => whole.outcome.kind === 'accepted' ? 'accepted' : partialReplyLabel(whole))(replyOutcomeOf(view.view, t))
              : actionWithdrawn(view.view, t) ? 'withdrawn, not sent'
              : t.held ? `held (${t.held})` : t.reserved && t.answer === undefined && t.modelState === undefined ? 'model UNKNOWN' : 'pending' })) };
      })(),
      dated: view.view.dated.filter(item => !view.view.memory.some(change => change.mode !== 'prefer' && change.in !== 'reply' && change.source === item.source
        && (item.quote.includes(change.quote) || change.quote.includes(item.quote)))).map(item => ({ sourceUpdate: view.view.turns.get(item.source)?.update,

        quote: redact(item.quote).text, when: redact(item.when).text, zone: item.zone, day: item.day ?? null,
        time: item.time ?? null, repeat: item.repeat ?? null, ambiguity: item.ambiguity ?? null, state: dueState(item, wallNow()) })),
      datedPending: view.view.order.filter(item => item.datedPending && !probeTurn(view.view, item) && !view.view.memory.some(change => change.mode !== 'prefer' && change.in !== 'reply' && change.source === item.id))
        .map(item => ({ update: item.update, message: redact(item.text).text.slice(0, 500) })),
      summaryPending: view.view.summaryReservations.size,

      summaryChecks: view.view.summaryCheckCounts,
      lastSummaryCheck: view.view.lastSummaryCheck && { verdict: view.view.lastSummaryCheck.verdict,
        path: view.view.lastSummaryCheck.path, latencyMs: view.view.lastSummaryCheck.latencyMs,
        usage: view.view.lastSummaryCheck.usage ?? null },

      openQuestions: openQuestionCandidates(view.view).map(item => ({ update: view.view.turns.get(item.source)?.update,
        question: projectMemoryText(view.view, redact(item.quote).text), reason: item.reason })),
      pendingQuestionReviews: view.view.order.filter(t => t.accepted && t.intent && !view.view.questionsReviewed.has(t.id)
        && unansweredCue(t.intent)).length,
      coherence: { checked: view.view.order.filter(t => t.checked).length,
        unchecked: view.view.order.filter(t => t.intent !== undefined && !t.checked).length,
        failed: view.view.order.filter(t => t.checkFailed).length,
        pendingCorrections: view.view.corrections.length,
        findings: view.view.order.filter(t => t.checked?.length).map(t => ({ update: t.update, rules: t.checked.map(f => f.rule) })) },
      jevChecks: view.view.jevChecks, replyChecks: view.view.replyCheckCounts, replyCheckPaths: view.view.replyCheckPaths, operatorEchoSent: operatorEchoSent(view.view), reviewUnavailableReleases: reviewUnavailableReleases(view.view), claimScopedWithholds: claimScopedWithholds(view.view), guidance: guidanceReport(view.view),
        memoryLearning: memoryLearningReport(view.view, turn => operatorWriter(view.view, turn, true)),
      // Absolute times only: the ages are derivable and would make two reads of one journal differ.
      obligations: (({ oldestUnfinishedAgeMs: _age, progressAgeMs: _progress, ...health }) => health)(loopHealth(view.view, wallNow())),
      directives: openDirectives(view.view).map(({ id, note }) => ({ id, update: view.view.turns.get(note.source)?.update,
        quote: redact(note.quote).text, since: note.at })),
      blockers: openBlockers(view.view).map(({ id, note }) => ({ id, update: view.view.turns.get(note.source)?.update, kind: note.kind,
        claim: redact(note.claim).text, constraint: note.constraint, avenues: note.avenues.length, outsideAction: redact(note.outsideAction).text,
        recheckAt: note.recheckAt, recheckDue: wallNow() >= note.recheckAt, rechecks: note.rechecks.length })),
      replyTimings: measuredTimings(replyTimings(view.view), statusNow),
      lastReplyCheck: view.view.lastReplyCheck,
      lastReplyReview: lastReplyReview(view.view),
      lastReplyTiming: lastSent ? { update: lastSent.update,
        intakeToApiAcceptedMs: Math.max(0, lastSent.sentAt - lastSent.at),
        checkMs: Math.round((lastSent.replyChecks ?? []).reduce((total, result) => total + result.latencyMs, 0)) } : null,
      ...(view.view.stepCheckStarted ? { stepChecks: stepCheckView(view.view) } : {}),
      retrospective: retrospectiveView(view.view, wallNow()),
      // Part 18: what each live sentinel last decided, read back from the journal (the families this command names).
      liveSentinels: sentinelReport(view.view, sentinelFamilies),
      people: [...new Set([...view.view.people.filter(note => !retractedTurn(view.view, note.source) && !view.view.memory.some(change =>
        change.in !== 'reply' && note.source === change.source && note.quote.includes(change.quote))).map(note => note.name),
        ...[...view.view.channelItems.values()].map(item => item.from.split('<')[0].trim().split('@')[0].replace(/[._-]+/gu, ' ')).filter(Boolean)])],
      personMerges: activePersonMerges(view.view).map(link => ({ left: view.view.people[link.left]?.name,
        leftSource: view.view.people[link.left]?.source, right: view.view.people[link.right]?.name,
        rightSource: view.view.people[link.right]?.source, triggerUpdate: view.view.turns.get(link.trigger)?.update })),

      launches: log.launches.slice(-3), ...(log.readFailed ? { runLog: 'unreadable' } : {}),
      self: selfState(view.view, readRuns(runsPath), wallNow(), timeZoneOf(options), undefined,
        existsSync(stopPath) || view.view.stop !== null) };
      // Rules 9/39/43/73: proof posture and capability truth from the durable proof log and the replayed journal.
      const proofLog = readProofs(proofsPathOf(root));
      try {
        report.proofLog = { available: proofLog.available, attempts: proofLog.proofs.length, liveProofs: proofLog.liveProofs.length, unreadable: proofLog.unreadable };
        const launch = runningLaunch(proofLog.proofs), reading = proofReport(view.view, proofLog, launch, now), joined = inventory();
        report.proofGeneration = launch ? launch.generation : null;
        report.proofs = reading.proofs;
        report.stepCoverage = reading.stepCoverage;
        const rows = report.capabilities = capabilityReport(joined, reading, proofLog, report, now);
        const posture = plan => reading.proofs.find(row => probeId(row.plan) === plan)?.posture ?? 'unavailable';
        report.duties = joined.duties.map(item => ({ id: item.id, status: item.status, watcher: item.requiredFacts.watcher,
          posture: posture(probeId(item.requiredFacts.proof.replace(/^proofs\.jsonl#/u, ''))) }));
        report.sentinels = joined.sentinels.map(item => ({ id: item.id, status: item.status, freshness: posture(item.requiredFacts.freshnessProbe) }));
        report.protection = { declared: rows.length, inventoryGaps: joined.gaps, pendingRegistration: joined.pending,
          ...Object.fromEntries(['confirmed', 'unconfirmed', 'unproven', 'gap', 'dark', 'off-in-this-launch'].map(state =>
            [state, rows.filter(row => row.protection === state).map(row => row.id)])) };
      } catch { report.proofs = 'unavailable: the register inputs or proof log could not be read'; }
      process.stdout.write(`${JSON.stringify(report)}\n`);
    }
    finally { view.close(); }
    return;
  }
  if (command === 'record-live-proof') {
    // Rule 62: a live-surface proof is the capability's own observed outcome, bound to the launch that executed
    // it — never an assertion. An unrelated turn, a capability that launch had off, or a missing startup
    // record all refuse; a capability whose outcome is semantic also needs the desk's recorded observation.
    const capability = inventory().capabilities.find(item => item.declaration.id === required(options, 'capability'));
    if (!capability) throw Error('preview: unknown capability');
    // The journal's own update domain: a requested summary's synthetic update is a real operation identity.
    const update = Number(required(options, 'update'));
    if (!isJournalUpdate(update)) throw Error('preview: invalid update');
    const view = openPreviewJournal(journalPath, key(), undefined, undefined, true);
    try {
      const result = resolveLiveProof({ capability, view: view.view, update, deskObservation: options['desk-observation'] ?? null,
        stopLatch: existsSync(stopPath) ? JSON.parse(readFileSync(stopPath, 'utf8')) : null,
        launches: readRuns(runsPath).launches, startups: readProofs(proofsPath).proofs, now: wallNow() });
      // The refusal names only the capability, the update and the missing outcome, never message text.
      if (!result.ok) { process.stderr.write(`preview: live proof refused: ${result.reason}\n`); process.exitCode = 1; return; }
      appendProof(proofsPath, result.record);
      process.stdout.write(`${JSON.stringify(result.record)}\n`);
    } finally { view.close(); }
    return;
  }
  if (command === 'inspect') {
    // Read-only: the last persisted model prompt's recall view and, with --text, what a next
    // message would get now. No append, no model call, no send.
    const view = openPreviewJournal(journalPath, key(), undefined, undefined, true);
    try {
      const last = view.view.order.filter(t => t.prompt !== undefined).at(-1);
      const reply = options.update === undefined ? view.view.order.filter(t => t.intent).at(-1)
        : view.view.order.find(t => t.update === number(options.update, 'update', 0));
      let next;
      if (options.text !== undefined) {
        const refuse = () => { throw Error('preview: inspect never calls or sends'); };
        const probe = createJournalWorker(view, { now: wallNow, stopped: () => true, timeZone: timeZoneOf(options), sources: turnSources(root, options, view.view, () => readRuns(runsPath)),
          prepareModel: input => prepareJournalEnvelope(input, required(options, 'model'), view.view.genesis.grant, wallNow(), view.view.limits.maxBytes),
          model: refuse, send: refuse, checkOutbound: refuse }).probe(options.text);
        next = 'reason' in probe ? { held: probe.reason } : recallView(JSON.parse(probe.context));
      }
      process.stdout.write(`${redact(JSON.stringify({ operatorRequests: operatorRequestsReport(view.view, wallNow()),
        last: last ? { update: last.update, answered: last.answer !== undefined,
        instructions: instructionsOf(last.prompt), writer: writerOf(last.prompt), ...recallView(contextOf(last.prompt)) } : null,
        reply: reply?.intent ? { update: reply.update, text: reply.intent, telegramMessageId: reply.sent ?? null,
          // Rule 42: the WHOLE reply's outcome; a split reply is api-accepted only when every message carrying it was.
          ...(() => { const whole = replyOutcomeOf(view.view, reply), settled = whole.outcome;
            return { outcome: settled.kind === 'accepted' ? 'api-accepted' : !whole.started ? 'sending' : settled.kind === 'refused' ? 'send-refused' : 'send-unknown',
              ...(settled.kind === 'refused' ? { refusal: settled.reason } : {}),
              ...(whole.of > 1 ? { parts: { of: whole.of, ...(settled.kind === 'accepted' ? {} : { stoppedAt: whole.part }) } } : {}) }; })(),
          grounding: reply.grounding ?? null,
          answerReason: reply.answerReason ?? null,
          retrospectiveGrade: (() => { const row = latestGrades(view.view).get(`answer:${reply.id}`);
            return row ? { pass: row.pass, conclusion: row.grade.conclusion, reason: row.grade.reason, outcome: row.grade.outcome,
              rederivation: row.grade.rederivation ?? null } : null; })(),
          ...(reply.continuity ? { continuity: reply.continuity } : {}) } : null,
        // Rules 11 and 110: the latest summary frontier and which operator updates the meaning index covers.
        // Both write sides count: terms a summary recorded, and terms the index-only pass recorded beside it.
        // Reading the summaries alone under-reported the index by exactly the backlog it had just repaired.
        summaryFrontier: liveSummaries(view.view).at(-1)?.through ?? null,
        meaningIndexed: [...new Set([...view.view.summaries.flatMap(item => item.concepts ?? []), ...view.view.indexConcepts]
          .map(item => view.view.turns.get(item.source)?.update))].filter(update => update !== undefined)
          .sort((left, right) => left - right).slice(-100),
        // Part 21 §6: the pending indexing work, measured rather than inferred. An answer's packet carries only
        // the coverage counts; this is where "which messages are still unreachable by meaning, and is anything
        // still owed an attempt" is answerable (live 2026-10-01: 93 of 100 with no surface naming the seven).
        meaningIndexPending: (status => ({ count: status.pendingUpdates.length, owed: status.owed,
          oldestUpdate: status.pendingUpdates[0] ?? null, updates: status.pendingUpdates.slice(0, 100) }))(
          meaningIndexStatus(view.view, liveSummaries(view.view).at(-1)?.through ?? -1)),
        agentPromises: view.view.commitments.flatMap((note, id) => note.agentPromise ? [{ id, quote: note.quote,
          action: note.agentPromise.action, closed: view.view.closed.has(id) }] : []).slice(-10),
        ...(next ? { next } : {}), withheld: withheldView(view.view),
        undos: view.view.undos.map(item => ({ operatorUpdate: view.view.turns.get(item.trigger)?.update,
          change: item.change, kind: view.view.changeHistory[item.change]?.kind })),
        jevChecks: view.view.jevChecks, replyChecks: view.view.replyCheckCounts, replyCheckPaths: view.view.replyCheckPaths, operatorEchoSent: operatorEchoSent(view.view), reviewUnavailableReleases: reviewUnavailableReleases(view.view), claimScopedWithholds: claimScopedWithholds(view.view), guidance: guidanceReport(view.view),
        memoryLearning: memoryLearningReport(view.view, turn => operatorWriter(view.view, turn, true)),
        lastReplyCheck: view.view.lastReplyCheck, lastReplyReview: lastReplyReview(view.view),
        ...(view.view.stepCheckStarted ? { stepChecks: stepCheckView(view.view) } : {}) })).text}\n`);

    } finally { view.close(); }
    return;
  }
  if (importMarker) {
    const check = openPreviewJournal(journalPath, key(), undefined, undefined, true);
    try {
      if (check.view.genesis.importSource !== importMarker.source || !check.view.imported)
        throw Error('preview: migration incomplete');
    } finally { check.close(); }
  }
  // Rule 35: a test composition never takes the writer lease of a production root (or the reverse).
  if (command === 'run' && existsSync(journalPath)) {
    const composed = process.env.INSTAR_PREVIEW_TEST_TELEGRAM_ENDPOINT ? 'test' : 'production';
    const peek = openPreviewJournal(journalPath, key(), undefined, undefined, true);
    try { if ((peek.view.genesis.origin ?? 'production') !== composed) throw Error('preview: composition origin differs from journal'); }
    finally { peek.close(); }
  }
  const machine = options.machine ?? 'preview-local-machine';
  const storage = take(openProductionStorage({ root: join(root, '.writer'), machine,
    key: key(), policy: 'preview-journal', store: 'preview-journal', context, io: productionStorageIO }));
  if (command === 'import-store') {
    let storeJournal;
    try {
      const state = agentState(required(options, 'agent-state-dir'));
      storeJournal = openPreviewJournal(journalPath, key());
      const results = ['telegram', 'slack'].map(source => importSource(storeJournal, state, source, () => existsSync(stopPath)));
      process.stdout.write(`${JSON.stringify({ results, channelItems: storeJournal.view.channelItems.size })}\n`);
    } finally { storeJournal?.close(); storage.close(); }
    return;
  }
  if (command === 'renew-expiry') {
    // Extends a live trial to a new reviewed activation's expiry under the exclusive writer lease.
    let renewJournal;
    try {
      if (existsSync(stopPath)) throw Error('preview: stop latched');
      renewJournal = openPreviewJournal(journalPath, key());
      const now = wallNow();
      if (now >= renewJournal.view.expires) throw Error('preview: expired');
      const bytes = readFileSync(required(options, 'activation-record'), 'utf8');
      const activation = JSON.parse(bytes);
      const profile = Object.freeze(JSON.parse(readFileSync(required(options, 'login-profile'), 'utf8')));
      doorway.validateActivation(activation, profile, required(options, 'model'), now, doorway.conversationFraming);
      const granted = requireAuthority(options, activation, required(options, 'activation-record'), renewJournal.view, now);
      if (!activationMatchesJournal(renewJournal.view, activation, expiry(required(options, 'expires-at'))))
        throw Error('preview: activation differs from journal');
      renewJournalExpiry(renewJournal, { expires: activation.expiresAt, at: now,
        authority: `${required(options, 'authority')} [grant ${granted.grant}; waiver ${granted.waiver}; record ${granted.digest}]`,
        activation: `sha256:${createHash('sha256').update(bytes, 'utf8').digest('hex')}` });
    } finally { renewJournal?.close(); storage.close(); }
    return;
  }
  if (command === 'raise-caps') {
    let capJournal;
    try {
      if (existsSync(stopPath)) throw Error('preview: stop latched');
      capJournal = openPreviewJournal(journalPath, key());
      if (wallNow() >= capJournal.view.expires) throw Error('preview: expired');
      // docs/09: an explicit, operator-authorized conservative write-off of every pending UNKNOWN call, each
      // counted as its full reserved call. It names the exact calls; it never raises a cap by itself.
      if (options['write-off-unknown'] !== undefined && options['write-off-unknown'] !== 'true')
        throw Error('preview: --write-off-unknown must be true');
      const writeOff = options['write-off-unknown'] === 'true' ? pendingUnknownCalls(capJournal.view) : [];
      if (options['write-off-unknown'] === 'true' && !writeOff.length) throw Error('preview: no pending UNKNOWN call to write off');
      const raisedBytes = number(options['max-context-bytes'] ?? String(capJournal.view.limits.maxBytes), 'max-context-bytes');
      // A re-declared limit below the measured floor leaves a root that cannot serve its own next turn.
      // Raising the other caps on such a root does not make it answer, so this doorway refuses and names
      // the flag and value that would: the operator can raise bytes in this same command.
      const raiseRefusal = unservableContextReason(raisedBytes);
      if (raiseRefusal) throw Error(`preview: ${raiseRefusal}`);
      raiseJournalCaps(capJournal, { ...(writeOff.length ? { writeOff } : {}), maxCalls: number(options['max-calls'] ?? String(capJournal.view.limits.maxCalls), 'max-calls'),
        maxReplies: number(options['max-replies'] ?? String(capJournal.view.limits.maxReplies), 'max-replies'),
        maxTurns: number(options['max-turns'] ?? String(capJournal.view.limits.maxTurns), 'max-turns'),
        maxBytes: raisedBytes,
        authority: required(options, 'authority'), at: wallNow() });
    } finally { capJournal?.close(); storage.close(); }
    return;
  }
  let journal, worker, signalled = false, signalName = null, launchedAt = null, endReason = null, runs = null, pressureUnknown = false, startupFailure = null;
  let handoff = null, reservedAtLaunch = new Set(), ownerClaim = null, installation = null, installUpdate = null;
  // Rule 15 / Eleven §5: the installed shape's evidence, set once the activation is validated at launch.
  let installationPolicy = { kind: 'refused', reason: 'the activation is not validated yet' }, registerAtLaunch = null;
  // Rules 9/43: the durable proof log and the executor's in-memory copy of it for this launch.
  let proofRecords = [], proofLaunch = null, proofBackoffUntil = 0, proofPorts = null, proofStoreFailed = false;
  // Rule 63: the conversation fence. Losing it stops new work; an effect never dispatches without it.
  // Rule 33: declared store agreements run through build 9's proof executor (the store-agreements plan): every
  // comparison at launch, then each on its own cadence; each completed check stays durable in agreements.jsonl.
  let agreementsForced = false;
  const storeAgreements = () => {
    const force = !agreementsForced; agreementsForced = true;
    runDueAgreements(agreementsPath, agreementInput(journal.view, wallNow()), force);
    return agreementStatus(agreementsPath, wallNow()).map(row => ({ id: row.id, at: row.lastCheckedAt, agree: row.agree }));
  };
  let retiredReason = null;
  // Rules 31, 63: on two machines the conversation is also fenced by the shared authority's lease (null on one machine).
  let shared = null;
  const ownerHeld = () => {
    if (ownerClaim?.owner && ownerClaim.verify() && (shared === null || shared.lease.fence() !== null)) return true;
    if (ownerClaim?.owner) { endReason ??= 'conversation ownership lost'; retiredReason ??= 'conversation ownership lost'; workerStop.value = true; }
    return false;
  };
  // Service observation (design 18): whether this owner can serve right now, with the typed reason when not.
  // Rule 15 gap (a): the host supervisor's progress beat. Written each loop cycle (with the service beat) so a
  // runner that is alive but not progressing (stopped, wedged) is seen and relaunched. Liveness evidence only.
  let hostBeatSeq = 0;
  const hostBeat = () => {
    try {
      const temporary = join(root, `.runner-beat-${process.pid}.pending`);
      writeFileSync(temporary, JSON.stringify({ v: 1, pid: process.pid, seq: ++hostBeatSeq }), { mode: 0o600 });
      renameSync(temporary, join(root, 'runner-beat.json'));
    } catch { /* a lost beat only makes the supervisor's judgement more conservative */ }
  };
  const serviceBeat = (servable, reason) => { hostBeat(); try { if (ownerClaim?.owner) ownerClaim.observe(wallNow(), servable, reason); } catch { /* evidence only */ } };
  // Rule 55: poll-failure pressure is episode state; every attempt that changes it is durable in the run log
  // before the loop continues, so neither a relaunch nor a crash resets it.
  let failedPolls = 0, conflictedPolls = 0;
  let identityVerified = false, routeHealthy = true, active = null, toolsActive = () => false, toolsRecord = null, toolsResolution = null, toolsOff = null,
    sessionWork = null, gate = null;
  /** Each delegated session step's shell network checkpoint, by claim: closed with the step's claim and at shutdown. */
  const stepEgress = new Map();
  // Part Twelve: the effect doorway's operator policy, re-read at every tool turn so a withdrawn or broken file grants
  // nothing (nothing outward by default); launch refuses a policy that does not decode.
  let effectPolicyOf = () => DEFAULT_EFFECT_POLICY;
  /** The admission config every route's effect doorway decides with: the accepted closed operation set, the effect
   * policy as it reads now, and the register's irreversible term. */
  const admissionConfig = () => ({ operations: SINGLE_MACHINE_PROFILE.operations, effectPolicy: effectPolicyOf(),
    irreversibleTerm: shapeTerms().derivedFrom.irreversible });
  const workerStop = { value: false };
  const signal = name => { signalled = true; signalName ??= name; workerStop.value = true; };
  process.once('SIGINT', signal); process.once('SIGTERM', signal); process.once('SIGHUP', signal);
  // Rules 31, 63, 113 and the purpose's replicated(1) default: the two-machine conversation. This runner first
  // stands by (it receives the owner's journal bytes and neither polls nor sends). It serves only once the one
  // shared authority grants it the lease AND it holds the newest history; then every send waits until the other
  // machine acknowledged the journal through that send's intent. Returns null when this launch ended without serving.
  const PEER_FRESH_MS = 20_000;
  const enterShared = async genesis => {
    const secret = authoritySecret(), conversation = conversationOf(genesis);
    const listen = required(options, 'replica-listen'), colon = listen.lastIndexOf(':');
    if (colon <= 0) throw Error('preview: --replica-listen is host:port');
    const peer = connectReplicaPeer({ url: required(options, 'replica-peer'), token: secret, conversation, timeoutMs: 5000 });
    const authority = connectConversationAuthority({ url: authorityUrl, token: secret, conversation, timeoutMs: 5000 });
    const lease = createLeaseHolder({ authority, machine: ownerMachine,
      incarnation: `${ownerMachine}:${process.pid}:${randomBytes(8).toString('hex')}`, monotonic: () => performance.now() });
    const store = openReplicaStore({ directory: join(root, 'replica'), conversation, machine: ownerMachine, secret });
    const server = await serveReplicaStore({ store, token: secret, host: listen.slice(0, colon), port: number(listen.slice(colon + 1), 'replica-listen', 0, 65535) });
    const closeServer = () => new Promise(done => { server.close(() => done()); server.closeAllConnections?.(); });
    // The lease is renewed on its own timer from the moment it is granted, so a slow startup does not let it lapse.
    const renewTimer = setInterval(() => { lease.renew().catch(() => {}); }, 1000);
    renewTimer.unref?.();
    const limit = number(options['max-cycles'] ?? '1000', 'max-cycles', 1, 1_000_000), standbyAt = wallNow();
    let said = null, waited = false, role = { role: 'standby', reason: 'starting' }, fence = null, takeover = null, view = null, fatal = false;
    const say = line => { if (line !== said) { said = line; process.stderr.write(`preview: ${line}\n`); } };
    for (let tick = 0; tick < limit && !signalled && !existsSync(stopPath); tick++) {
      hostBeat();
      const able = takeoverEligibility({ root, store });
      let may = able.eligible;
      if (!may && able.seedable && options['journal-lineage'] === 'seed') {
        // Seeding is for the first lease ever: only while the authority has never issued one.
        const read = await authority.request({ op: 'read' });
        may = read.ok && read.view?.epoch === 0;
      }
      role = may ? await lease.hold() : { role: 'standby', reason: able.reason };
      let pause = Math.min(2000, Math.max(200, role.retryMs ?? 2000));
      if (role.role === 'owner') {
        fence = lease.fence();
        // The owner accepts no more of the other machine's bytes: what it holds now is what it takes over from.
        store.seal();
        takeover = !fence ? { ok: false, reason: 'the lease lapsed before takeover' } : adoptReceivedCopy({ root, journalPath, store,
          epoch: fence.epoch, seed: options['journal-lineage'] === 'seed', verify: path => {
            // The full replay is the check: a copy that does not replay, or belongs to another conversation, is refused.
            const copy = openJournal(path, key(), undefined, undefined, true);
            try { const g = copy.view.genesis;
              if (g.bot !== genesis.bot || g.chat !== genesis.chat || g.operator !== genesis.operator) throw Error('another conversation'); }
            finally { copy.close(); }
          } });
        if (!takeover.ok) {
          // History that cannot be established needs a person: this launch ends now instead of taking the lease again and again.
          await lease.release();
          role = { role: 'inhibited', reason: takeover.reason }; fence = null; fatal = true;
          break;
        }
        // The history is in place; the settled cursor is read while the lease lasts. Without it this launch ends and the next continues.
        while (!view && lease.fence() && !signalled && !existsSync(stopPath)) {
          const read = await authority.request({ op: 'read' });
          if (read.ok && read.view) view = read.view; else await delay(500);
        }
        if (!view) { await lease.release(); role = { role: 'inhibited', reason: 'the settled cursor could not be read' }; fence = null; }
        break;
      }
      if (!waited) { waited = true; appendRun(runsPath, { v: 1, launch: standbyAt, pid: process.pid }); }
      say(role.role === 'standby' ? `standby: ${role.reason}; not polling, not sending`
        : `inhibited: ${role.reason}; nothing is polled or sent`);
      for (const until = clock.elapsed() + pause; !signalled && !existsSync(stopPath) && clock.elapsed() < until;)
        await delay(Math.min(100, Math.max(1, until - clock.elapsed())));
    }
    // From here this machine is the owner or is leaving: either way it accepts no more of the other machine's bytes.
    store.seal(); await closeServer();
    if (!fence || !view) {
      clearInterval(renewTimer);
      const paused = signalName !== null || existsSync(stopPath);
      if (!waited) appendRun(runsPath, { v: 1, launch: standbyAt, pid: process.pid });
      // A standby that reached its cycle limit is still wanted (it holds the copy and is the failover): the host
      // supervisor relaunches it (`queued`). A stop, a signal pause or unestablishable history is not relaunched.
      appendRun(runsPath, { v: 1, launch: standbyAt, exit: wallNow(), reason: signalName ? `paused by signal ${signalName}`
        : existsSync(stopPath) ? 'operator stop latched' : fatal ? `inhibited: ${role.reason}` : `standby: ${role.reason}`,
        revival: paused || fatal ? 'inhibited' : 'queued',
        ...(fatal ? { inhibited: role.reason } : { nonowner: { machine: null, since: null } }) });
      if (fatal && !signalled) {
        process.stderr.write(`preview: inhibited: ${role.reason}; nothing was polled or sent\n`);
        process.exitCode = 4;
      }
      return null;
    }
    if (waited) appendRun(runsPath, { v: 1, launch: standbyAt, exit: wallNow(),
      reason: `standby ended: this runner acquired the conversation (epoch ${fence.epoch}; history ${takeover.how})`, revival: 'queued',
      nonowner: { machine: null, since: null } });
    say(`owner: epoch ${fence.epoch}; history ${takeover.how}${takeover.setAside ? ` (this machine's older journal set aside as ${takeover.setAside})` : ''}`);
    const replicationPath = join(root, 'replication.json');
    let shipper = null, dispatch = null, sharedJournal = null, settle = null, peerCurrent = null;
    const report = () => {
      const status = shipper.status(PEER_FRESH_MS);
      if (status.current === peerCurrent) return status.current;
      peerCurrent = status.current;
      // Rule 15 (say plainly why it waits): the wait is never a fallback to local durability, and it is visible on the pull surfaces.
      say(status.current ? 'the other machine acknowledged the journal; replies are sent'
        : `replies wait for the other machine to acknowledge the journal (${status.reason}); nothing is sent on local durability`);
      try { durablePreviewWrite(replicationPath, { v: 1, at: wallNow(), epoch: fence.epoch, peerCurrent, reason: status.reason,
        acknowledgedBytes: status.acknowledgedBytes, journalBytes: status.journalBytes, settledCursor: dispatch.cursor, waitingSends: dispatch.waiting }); }
      catch { /* evidence only; the gate itself never depends on this file */ }
      return status.current;
    };
    return { lease, epoch: fence.epoch, takeover,
      get cursor() { return dispatch ? dispatch.cursor : view.cursor; },
      start(journal) {
        sharedJournal = journal;
        shipper = createJournalShipper({ path: journalPath, size: () => journal.size, peer, conversation, machine: ownerMachine, secret,
          epoch: () => lease.fence()?.epoch ?? null, monotonic: () => performance.now() });
        dispatch = createReplicatedDispatch({ authority, lease, shipper, cursor: view.cursor, sleep: delay, elapsed: () => performance.now(), waiting: report });
      },
      /** One bounded step per cycle: unrecorded outcomes, the journal's new bytes, then the settled cursor. */
      async sync() {
        await dispatch.flush();
        await shipper.pump();
        if (settle) await dispatch.settle(settle.token, settle.cursor);
        report();
      },
      noteIntake() { if (sharedJournal.view.cursor > dispatch.cursor) settle = { token: shipper.token(), cursor: sharedJournal.view.cursor }; },
      peerCurrent: () => report(),
      line: () => { const status = shipper.status(PEER_FRESH_MS);
        return `Two machines: this runner holds the conversation (lease epoch ${fence.epoch}); every reply waits until the other machine has acknowledged its record. ${status.current
          ? 'The other machine holds the whole journal.' : `Waiting for it now (${status.reason}).`}`; },
      // The minimal path is awaited by the poll loop: its wait is bounded so reading and stop stay reachable (Rule 15).
      admit: (target, refusal) => dispatch.admit(target, refusal, target.startsWith('limited:') ? 10_000 : undefined),
      replicated: refusal => dispatch.replicated(refusal),
      outcome: (target, kind) => dispatch.outcome(target, kind),
      /** A clean end: the last journal bytes go to the other machine, then the lease is handed back so it can take over at once. */
      async stop() {
        clearInterval(renewTimer);
        try { if (shipper && lease.fence()) await shipper.drain(); } catch { /* the successor continues from the acknowledged copy */ }
        try { await lease.release(); } catch { /* the term ends it */ }
      } };
  };
  try {
    const maxCalls = number(options['max-calls'] ?? '16', 'max-calls');
    const maxReplies = number(options['max-replies'] ?? '16', 'max-replies');
    const maxTurns = number(options['max-turns'] ?? '20', 'max-turns');
    // The default is the approved live bound itself, not a second number beside it: the measured fixed
    // parts already take most of it, so a lower default cannot serve a fresh root's first turn.
    const maxBytes = number(options['max-context-bytes'] ?? String(PREVIEW_LIVE_LIMITS.contextBytes), 'max-context-bytes');
    if (!existsSync(journalPath) && (maxCalls > PREVIEW_LIVE_LIMITS.calls || maxReplies > PREVIEW_LIVE_LIMITS.replies
      || maxTurns > PREVIEW_LIVE_LIMITS.turns || maxBytes > PREVIEW_LIVE_LIMITS.contextBytes))
      throw Error('preview: live allowance outside approved bound');
    // Rule 15's declared bound has to be one the build can serve. A root created below the measured floor
    // answers at most its first turn and then holds every reply for size, with no summary or set-aside able
    // to recover it, so genesis refuses the limit here rather than discovering it mid-conversation.
    const genesisRefusal = !existsSync(journalPath) ? unservableContextReason(maxBytes) : null;
    if (genesisRefusal) throw Error(`preview: ${genesisRefusal}`);
    // Rules 8, 92: a root may carry its own open-loop resurfacing cadence, settled at genesis and fixed for its
    // life (no command moves it). Omitted keeps the 24-hour default, so every existing root is untouched. The
    // bounds are the journal's own; a non-integer or out-of-range value refuses the launch here, before any write.
    const revisitMinutes = options['loop-revisit-minutes'] === undefined ? undefined
      : number(options['loop-revisit-minutes'], 'loop-revisit-minutes',
        LOOP_REVISIT_MIN_MS / 60_000, LOOP_REVISIT_MAX_MS / 60_000);
    // Rule 35: the trusted composition origin. Only the fixed offline test token on a loopback
    // endpoint is a test composition; it may write only a test-origin store, and a production
    // store refuses it (and any test-origin identity) at the journal's write boundary.
    const offlineEndpoint = process.env.INSTAR_PREVIEW_TEST_TELEGRAM_ENDPOINT;
    if (offlineEndpoint && (token() !== '12345678:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
      || !/^http:\/\/127\.0\.0\.1:[0-9]+$/u.test(offlineEndpoint))) throw Error('preview: offline endpoint refused');
    const origin = offlineEndpoint ? 'test' : 'production';
    const initial = command !== 'run' ? undefined : {
      kind: 'genesis', bot: required(options, 'bot-id'), chat: required(options, 'chat-id'), ...(origin === 'test' ? { origin } : {}),
      operator: required(options, 'operator-sender-id'), grant: required(options, 'grant-reference'),
      configurationDigest: required(options, 'configuration-digest'), expires: expiry(required(options, 'expires-at')),
      maxCalls, maxReplies, maxTurns, maxBytes, cursor: 0,
      ...(revisitMinutes === undefined ? {} : { loopRevisitMs: revisitMinutes * 60_000 }) };
    if (multi) {
      shared = await enterShared(initial);
      if (shared === null) return;
    }
    journal = openPreviewJournal(journalPath, key(), initial, undefined, false, undefined, false, origin);
    shared?.start(journal);
    const g = journal.view.genesis;
    // Rules 60 and 61: this process's one resource owner, with the constitutional
    // measurement, priority-brake and incarnation owners as its decision ports.
    // A desk-controlled low-ceiling case may lower (never raise) the aggregate memory ceiling.
    const aggregateMemoryMib = options['resource-aggregate-memory-mib'] === undefined ? undefined
      : number(options['resource-aggregate-memory-mib'], 'resource-aggregate-memory-mib', 64, 4096);
    // Rule 60 / SEAM-LEDGER row 36: every launch's resources are a Six allocation set, committed across
    // its domains and attached to its ordinary reservation before anything is spawned.
    const allocationCeilings = aggregateMemoryMib === undefined ? RESOURCE_CEILINGS : { ...RESOURCE_CEILINGS,
      aggregate: { ...RESOURCE_CEILINGS.aggregate, memoryBytes: aggregateMemoryMib * 1024 * 1024 } };
    const allocation = createHostResourceAllocation({ root, machine: HOST_IDENTITY.machine, ceilings: allocationCeilings,
      incarnation: `launcher:${process.pid}:${createHash('sha256').update(`${process.pid}:${wallNow()}:${performance.now()}`).digest('hex').slice(0, 16)}`,
      now: wallNow, monotonic: () => performance.now() });
    const harness = harnessOf(options, root, doorway);
    await hostResources.attach({ ledgerPath: launchesPath, statePath: resourcesPath, now: wallNow, allocation,
      ...(harness?.uid != null ? { harnessUid: harness.uid } : {}),
      ...(aggregateMemoryMib === undefined ? {} : { aggregateMemoryBytes: aggregateMemoryMib * 1024 * 1024 }),
      compare: resourceCompare, priorityGate: shouldRunScheduledPriority,
      reconcile: (row, current) => current === null ? 'missing' : take(reconcileProcessIncarnation(
        { processIncarnation: `${row.pid}:${row.start}`, pid: row.pid, startEvidence: row.start, tags: ['provider-launch'] },
        { processIncarnation: `${row.pid}:${current}`, pid: row.pid, startEvidence: current, tags: ['provider-launch'] },
        context)) });
    // Rule 100: credentials handed over in chat are stored before anything consumes them.
    const custody = createSecretCustody(root, key(), wallNow);
    // Plan #442 (Rules 4, 86, 100): the secret values this runner holds (host custody and the preview vault), for the
    // exact floor on every reply and send. Read in memory at each use; never recorded, logged or given to a model.
    const heldSecretValues = () => {
      const values = Object.entries(process.env).flatMap(([name, value]) => name.startsWith('INSTAR_SECRET_') && value ? [value] : []);
      for (const record of custody.records()) if (record.custody === 'preview-vault')
        try { values.push(custody.resolve(secretRef(record.name))); } catch { /* status reports the missing object */ }
      return values;
    };
    // Plans #446, #451: the register's public entries (names, labels, custody, expiry, renewal standing and step), given
    // to the full-context review as quoted recorded facts. An unreadable register gives none; the review then holds as before.
    const credentialRegister = () => { try { return publicCredentialRegister(custody.records(), heldSecretValues(), wallNow()); } catch { return []; } };
    for (const [name, supplied, original, current] of [
      ['max-calls', maxCalls, g.maxCalls, journal.view.limits.maxCalls],
      ['max-replies', maxReplies, g.maxReplies, journal.view.limits.maxReplies],
      ['max-turns', maxTurns, g.maxTurns, journal.view.limits.maxTurns],
      ['max-context-bytes', maxBytes, g.maxBytes, journal.view.limits.maxBytes]])
      if (options[name] && supplied !== original && supplied !== current)
        throw Error(`preview: ${name} differs from journal`);
    // The cadence belongs to the root, not to the launch: a later launch may repeat the root's own value and
    // nothing else. This is what makes it unchangeable after genesis — there is no other writer for it.
    if (revisitMinutes !== undefined && revisitMinutes * 60_000 !== loopRevisitMs(journal.view))
      throw Error('preview: loop-revisit-minutes differs from journal');
    if (g.importSource !== undefined && !journal.view.imported) throw Error('preview: migration incomplete');
    if (String(number(g.bot, 'bot-id')) !== g.bot || String(number(g.chat, 'chat-id')) !== g.chat
      || g.chat !== g.operator) throw Error('preview: private operator binding differs');
    for (const [name, value] of [['bot-id', g.bot], ['chat-id', g.chat], ['operator-sender-id', g.operator],
      ['grant-reference', g.grant], ['configuration-digest', g.configurationDigest]])
      if (options[name] && options[name] !== value) throw Error(`preview: ${name} differs from journal`);
    if (!topology.supported) {
      // Rule 113 / 63: an unsupported topology is visibly inhibited; the platform keeps the input, nothing is sent.
      const at = wallNow();
      appendRun(runsPath, { v: 1, launch: at, pid: process.pid });
      appendRun(runsPath, { v: 1, launch: at, exit: wallNow(), reason: `inhibited: ${topology.reason}`, revival: 'inhibited',
        inhibited: `unsupported topology: ${posture}` });
      process.stderr.write('preview: the declared multi-machine posture has no shared conversation authority; nothing was polled or sent\n');
      process.exitCode = 4;
      return;
    }
    ownerClaim = claimConversation({ directory: ownersDirectory(), bot: g.bot, chat: g.chat, machine: ownerMachine, root,
      key: key(), context, io: productionStorageIO, now: wallNow() });
    if (!ownerClaim.owner) {
      const at = wallNow(), holder = ownerClaim.holder;
      appendRun(runsPath, { v: 1, launch: at, pid: process.pid });
      if (ownerClaim.disposition === 'inhibited') {
        // The authority could not be read or written: not evidence that anyone serves. Inhibited, work preserved.
        appendRun(runsPath, { v: 1, launch: at, exit: wallNow(), reason: `inhibited: ${ownerClaim.reason}`, revival: 'inhibited',
          inhibited: ownerClaim.reason });
        process.stderr.write('preview: conversation ownership could not be established; nothing was polled or sent\n');
        process.exitCode = 4;
        return;
      }
      // Startup duplicate refusal: a non-owner neither polls (the platform keeps the input for the owner) nor sends.
      try { recordRefusal({ directory: ownersDirectory(), bot: g.bot, chat: g.chat, machine: ownerMachine, root, at, reason: ownerClaim.reason }); }
      catch { /* the root's own run log still records the refusal */ }
      appendRun(runsPath, { v: 1, launch: at, exit: wallNow(), reason: `not the conversation owner: ${ownerClaim.reason}`,
        revival: 'none', nonowner: { machine: holder?.machine ?? null, since: holder?.since ?? null } });
      process.stderr.write(`preview: this conversation is held by another runner (${ownerClaim.reason}); this launch retired without polling or sending\n`);
      process.exitCode = 3;
      return;
    }
    serviceBeat(true, 'claimed');
    // Part Thirteen §9 (docs/17-harness-adapters): the tool route's room is the larger of the packet limit and its policy's prompt bound.
    const toolPromptLimit = () => Math.max(journal.view.limits.maxBytes,
      doorway.policyFor(required(options, 'model'), doorway.toolsFraming ?? doorway.conversationFraming).maxPromptBytes);
    const modelEnvelope = input => {
      const bytes = prepareJournalEnvelope(input, required(options, 'model'), g.grant, wallNow(), journal.view.limits.maxBytes);
      // A tool turn's longer system prompt must fit that room too; an overflow here makes the packet ladder yield, as
      // for the text-only prompt, instead of leaving the turn to fall back to a text-only answer.
      if (toolsActive() && toolTurnEligible(input.id)
        && Buffer.byteLength(bytes) + Buffer.byteLength(doorway.toolTurn?.system ?? SUBSCRIPTION_TOOLS_SYSTEM_PROMPT) + TOOL_NOTICE_MAX_BYTES > toolPromptLimit())
        throw Error('preview: complete prompt overflow');
      return bytes;
    };
    const recordedUsage = usage => ({ inputTokens: usage.inputTokens, outputTokens: usage.outputTokens,
      charge: null, ...(usage.inputComplete ? { inputComplete: true } : {}) });
    // model-call-boundary:start
    // Rules 41, 57 and 75: the ONLY two places this launcher reaches a model. Each call's exact
    // input, output, actual route, outcome, latency and usage (or its written exception) is
    // durably journaled before any caller reads the result; an unregistered judgment refuses.
    const recordModelCall = entry => journal.append(modelCallRecord({ ...entry, at: wallNow() }));
    // replicated(1): a provider call is an irreversible act too. On two machines its reservation row (already in the
    // journal) is acknowledged by the other machine before the call launches; until then the call waits. It ends
    // only in the states that already end a call: a stop, the expiry, or a lost conversation.
    const peerHolds = async () => await shared.replicated(() => workerStop.value || existsSync(stopPath)
      || wallNow() >= journal.view.expires || journal.view.stop || !ownerHeld() ? 'stopped' : null) === null;
    const callSubscription = async (judgment, prepared, id, invocation, toolTurn) => {
      assertLiveJudgment(judgment, 'preview-subscription');
      if (shared !== null && !await peerHolds()) throw Error('preview: activation stopped');
      const route = modelRoute(id, toolTurn), start = performance.now();
      const inputRef = judgment === 'answer' && journal.view.turns.get(id)?.prompt === prepared
        ? `${journal.view.turns.get(id)?.promptKind ?? 'reserve'}:${id}` : undefined;
      // Rule 58: the journal occurrence is the operation id itself (turn, operation or summary).
      const base = { id, judgment, route: 'preview-subscription', model: required(options, 'model'), input: prepared, occurrence: id,
        ...(inputRef === undefined ? {} : { inputRef }) };
      let result;
      try { result = await route.invoke(prepared, invocation); }
      catch (error) {
        recordModelCall({ ...base, output: null, outcome: 'failed', latencyMs: performance.now() - start, usage: null });
        throw error;
      }
      recordModelCall({ ...base, output: typeof result.bytes === 'string' ? result.bytes : null,
        outcome: ['complete', 'rejected', 'uncertain'].includes(result.state) ? result.state : 'failed',
        latencyMs: performance.now() - start, usage: result.usage ? { inputTokens: result.usage.inputTokens ?? null,
          outputTokens: result.usage.outputTokens ?? null, charge: null } : null });
      return result;
    };
    const callJev = async (judgment, state, questions, timeoutMs = 2000, occurrence) => {
      assertLiveJudgment(judgment, 'typesafe-jev');
      if (shared !== null && !await peerHolds()) throw Error('preview: Jev unavailable');
      const start = performance.now(), body = JSON.stringify({ state, model: JEV_MODEL, questions });
      // The id is content-derived and repeats for identical requests; the occurrence names the turn it served.
      const base = { id: `${judgment}:${sha256(body).slice(0, 16)}`, judgment, route: 'typesafe-jev', model: JEV_MODEL, input: body,
        ...(typeof occurrence === 'string' && occurrence ? { occurrence } : {}) };
      let response, text;
      try {
        response = await fetch('https://api.typesafe.ai/v1/systemone', {
          method: 'POST', signal: AbortSignal.timeout(Math.min(2000, timeoutMs)),
          headers: { Authorization: `Bearer ${typesafeKey()}`, 'Content-Type': 'application/json' }, body });
        text = await response.text();
      } catch (error) {
        recordModelCall({ ...base, output: null, outcome: 'failed', latencyMs: performance.now() - start, usage: null });
        observeJev(judgment, null);
        throw error;
      }
      let value = null;
      try { if (response.ok) value = parseJevResponse(text); } catch { value = null; }
      const usage = value?.usage && (typeof value.usage.input_tokens === 'number' || typeof value.usage.output_tokens === 'number')
        ? { inputTokens: typeof value.usage.input_tokens === 'number' ? value.usage.input_tokens : null,
          outputTokens: typeof value.usage.output_tokens === 'number' ? value.usage.output_tokens : null, charge: null } : null;
      const latencyMs = Math.round(performance.now() - start);
      recordModelCall({ ...base, output: text, outcome: !response.ok ? 'rejected' : value === null ? 'failed' : 'complete', latencyMs, usage });
      // Rule 56: the doorway map observes the exchange; a failed map write never changes the outcome.
      observeJev(judgment, response.ok ? value : null);
      if (!response.ok || value === null) throw Error('preview: Jev unavailable');
      return { value, latencyMs };
    };
    // model-call-boundary:end
    /** A refused review verdict's defect, kept only until that review's one format re-ask reads it (content-free protocol text). */
    const reviewDefects = new Map();
    const invokeSubscription = async (prepared, id, reviewTurnId, deadlineAt, toolTurn) => {
      const policy = doorway.policyFor(required(options, 'model'),
        toolTurn ? doorway.toolsFraming ?? doorway.conversationFraming : doorway.conversationFraming);
      const deadline = Math.min(journal.view.expires, deadlineAt ?? wallNow() + policy.timeout + 60000);
      if (deadline - wallNow() <= 100) throw Error('preview: reply check budget exceeded');
      const result = await callSubscription(judgmentOf(id), prepared, id, { operation: id, deadline,
        timeout: policy.timeout, maxOutputBytes: policy.maxOutputBytes, maxTokens: policy.maxTokens,
        maxCharge: 0, automaticRetries: 0 }, toolTurn);
      if (reviewTurnId) journal.append({ kind: 'reply-review-state', id: reviewTurnId, state: result.state,
        diagnostics: replyReviewDiagnostics(result.usage),
        ...(result.usage ? { usage: recordedUsage(result.usage) } : {}), at: wallNow() });

      if (result.state === 'uncertain') return { state: 'uncertain', usage: result.usage };
      if (result.state === 'rejected') return { state: 'rejected', failureClass: 'rejected', usage: result.usage };
      if (result.state !== 'complete') throw Error('preview: model outcome unknown');
      if (!result.bytes) return { state: 'complete', failureClass: 'empty', usage: result.usage };
      const role = roleOf(id);
      // Plan #491 (answer-reading.ts): the model returns one flat object and the runner builds the Decision from its own
      // values; a wrapped object passes exactly the checks an unwrapped one does, and only the wrapper is dropped.
      // Rule 57: a returned floor may only echo the envelope's own; it never defines or widens it.
      const reading = readAnswer(result.bytes, { wrapped: wrappedPolicyOf(role), evidence: [id] });
      if (!reading.ok) {
        recordShape(shapesPath, role, 'decision', 'malformed', reading.shape);
        // The defect is content-free protocol text; the format re-ask names it so the model can correct exactly that.
        return { state: 'complete', failureClass: 'malformed', defect: reading.defect, usage: result.usage };
      }
      if (reading.shape !== 'bare') recordShape(shapesPath, role, 'decision', 'tolerated', reading.shape);
      const value = reading.value;
      if (!value.trim()) return { state: 'complete', failureClass: 'empty', usage: result.usage };
      // Rule 108: the stated reason is recorded beside the conclusion (build 8).
      const reason = reading.reason;
      return { state: 'complete', value, ...(reason.trim() ? { reason } : {}), usage: result.usage };
    };
    // Part Thirteen §9 (docs/17-harness-adapters): an eligible answer or work step runs as one scoped-tool turn (tool-turn.mjs runToolTurn).
    const invokeTools = async (prepared, id) => (await runToolTurn({ journal, root, id, prepared,
      promptLimit: toolPromptLimit(), mcp: readRootMcp(root),
      authority: `${toolsRecord.reference} ${toolsRecord.invocationPolicyDigest}`,
      // MF5: the conversation's workspace persists across turns, and its kept harness session (in the login profile's
      // projects directory) is a cache bound to this authority, harness and model and to the journal's current facts.
      conversation: conversationOf(journal.view.genesis),
      // The kept session is Claude Code's (its projects directory); a checkpointed harness keeps none.
      session: doorway.toolTurn?.harness ? null : { store: join(profile.configDirectory, 'projects'), harness: `${profile.version} ${required(options, 'model')}` },
      stopped: () => workerStop.value || existsSync(stopPath) || journal.view.stop !== null || !toolsActive(),
      deniedRoots: [realpathSync(root), profile.home, profile.configDirectory, profile.workingDirectory],
      ...admissionConfig(), now: wallNow, redactText: text => redact(text).text, gate, owner: ownerMachine, harness: harness ? harness.current() : null,
      ...(doorway.toolTurn ? { system: doorway.toolTurn.system, admission: doorway.toolTurn } : {}),
      fallback: async () => ({ result: await invokeSubscription(prepared, id) }),
      // Rules 33, 84: the workspace notice (files that may still disagree with memory, or a lost workspace) rides the packet.
      invoke: (toolTurn, notice) => invokeSubscription(withWorkspaceNotice(prepared, notice), id, undefined, undefined, toolTurn) })).result;
    const proofLines = () => {
      if (!proofLaunch) return [];
      const unavailable = proofStoreFailed ? ['Proofs: the durable proof log cannot be written right now; nothing new counts as proven until it can.'] : [];
      try {
        const log = { proofs: proofRecords, liveProofs: readProofs(proofsPath).liveProofs };
        const reading = proofReport(journal.view, log, proofLaunch, wallNow());
        return [...unavailable, ...proofStatusLines(reading.proofs, capabilityReport(inventory(), reading, log, {}, wallNow()))];
      } catch { return [...unavailable, 'Proofs: unavailable (the register inputs or proof log could not be read).']; }
    };
    const ownerLines = () => {
      const refused = refusedLaunches(ownersDirectory(), g.bot, g.chat);
      return [`Serving: this runner on ${ownerMachine} owns this conversation (claimed ${Math.max(0, Math.round((wallNow() - ownerClaim.holder.since) / 60000))} min ago); ${refused} duplicate launch(es) refused on this machine.`,
        agreementLine(agreementsPath, wallNow()), ...(shared ? [shared.line()] : [])];
    };
    // Rule 15, pull surface: whether a message past an ordinary cap would get its limited answer, and what clears it if not.
    const minimalLines = () => {
      let missing = ['minimal-path-owner'];
      try { missing = worker.minimalMissing(); } catch { /* reported as unavailable below */ }
      return [missing.length ? `Past a cap: limited answers are not available (missing: ${missing.join(', ')}). Messages are kept. To clear: ${minimalRepair(missing)}.`
        : 'Past a cap: each kept message gets one limited answer from the reserve.'];
    };
    // The chat "status" answer's host lines; the operator dashboard reads the very same ones (statusAnswer).
    const statusPullLines = () => [...installation ? installationStatusLines(installation, launchedAt, (() => { try { return installedCode(); } catch { return null; } })(),
      installUpdate, installUpdate && updateDelivery(installUpdate, journal.view.order), timeZoneOf(options)) : [],
      ...toolStatusLines(journal.view, toolsActive(), toolsOff ?? (toolsRecord
        ? 'withdrawn since launch: the activation record changed or its grant no longer resolves' : null), Boolean(doorway.toolTurn?.harness)),
      ...(toolsActive() || journal.view.effectDoorway ? effectDoorwayStatusLines(journal.view.effectDoorway) : []),
      ...(harness ? [harnessStatusLine(harness.state)] : [])];
    const statusExtraLines = () => [...proofLines(), ...ownerLines(), ...minimalLines()];
    const approvalSurface = approvalSurfaceOf(options), readOnly = readOnlyDashboardOf(options);
    // Rules 79, 81: the operator dashboard's snapshot, built at most every 15 seconds (and once at the end) while a page
    // shows it: published into this runner's own outbox for the operator's approval page, and kept for the read-only page
    // this runner serves. A failed build is never fatal: each page shows how old its copy is.
    let dashboardAt = -Infinity, dashboardText = null;
    const publishDashboard = (force = false) => {
      const now = wallNow(), zone = timeZoneOf(options);
      if (!approvalSurface && !readOnly || !force && now - dashboardAt < 15_000) return;
      dashboardAt = now;
      try {
        const snapshot = dashboardSnapshot(journal.view, { now, zone, bot: options['bot-username'] ?? null,
          stopped: existsSync(stopPath), statusText: statusAnswer(journal.view, now, zone,
            // The memory-learning line the chat answer adds after the host's extra lines (journal.ts), so both read the same.
            [...statusExtraLines(), memoryLearningLine(journal.view, turn => operatorWriter(journal.view, turn, true))], statusPullLines()) });
        dashboardText = JSON.stringify(snapshot);
        approvalSurface?.publish(snapshot);
      } catch { /* the page reads its copy's age */ }
    };
    const readOnlyServer = readOnly && serveReadOnly(createReadOnlyDashboard({ checkPin: readOnly.checkPin,
      state: () => dashboardText === null ? { kind: 'missing' } : snapshotState(dashboardText, wallNow()) }),
    `${readOnly.listen.host}:${String(readOnly.listen.port)}`);
    if (readOnlyServer) {
      // Never keeps the runner alive, and a failed listen (a taken port) is reported, never fatal to serving the chat.
      readOnlyServer.unref();
      readOnlyServer.on('error', error => process.stderr.write(`preview: read-only dashboard not served: ${error instanceof Error ? error.message : 'listen failed'}\n`));
      readOnlyServer.on('listening', () => { const where = readOnlyServer.address();
        process.stderr.write(`preview: read-only operator dashboard at http://${where.address}:${String(where.port)}/dashboard\n`); });
    }
    const yesInstallation = explicitYesInstallationOf(options), reviewSource = reviewSourceOf(options, yesInstallation);
    // Plan #373: how long an operator request stays answerable (default 18 hours), never past the trial's current end.
    const requestHours = options['operator-request-hours'] === undefined ? undefined
      : number(options['operator-request-hours'], 'operator-request-hours', 1, OPERATOR_REQUEST_MAX_MS / 3_600_000);
    const explicitYes = yesInstallation ? { context, installation: yesInstallation, ...(reviewSource ? { review: reviewSource } : {}),
      ...(requestHours === undefined ? {} : { requestWindowMs: requestHours * 3_600_000 }),
      renewalActivation: renewalActivationOf(options, () => journal.view), retractProposal: () => readRetractProposal(retractPath) } : null;
    // Rule 4 / P3-NF-19: every blocking site this runner enforces is bound to its committed declaration before the
    // worker exists; a declaration that no longer matches its checkpoint refuses the launch.
    bindPreviewBlockingSites({ journal: declarationsOf('journal.declarations'), replyCheck: declarationsOf('reply-check.declarations'),
      redact: JSON.parse(readFileSync(resolve(process.cwd(), 'src/recall/redact.declarations.json'), 'utf8')),
      resourceOwner: JSON.parse(readFileSync(resolve(process.cwd(), 'scripts/resource-owner.declarations.json'), 'utf8')) });
    worker = createJournalWorker(journal, { ...(approvalSurface ? { approvalSurface } : {}), ...(explicitYes ? { explicitYes } : {}), now: wallNow, elapsed: clock.elapsed, origin, stopped: () => workerStop.value || existsSync(stopPath) || !ownerHeld(), timeZone: timeZoneOf(options),
      presenceNotes: sentinelFamilies.has('presence'),
      sources: turnSources(root, options, journal.view, () => runs, () => launchedAt ?? undefined,
        () => journal.view.order.some(turn => turn.reserved && !reservedAtLaunch.has(turn.id)) ? null : handoff, () => toolsActive()),
      prepareModel: modelEnvelope,
      // Part Thirteen §9: the packet names the tools exactly when the model call will run on the tool route. The packet
      // is built before the answer's `reserve` or the work's `obligation-start` counts its base call, so that call is added here.
      toolRoute: id => toolsActive() && toolTurnEligible(id) && toolPacketFits(journal.view),
      // Only scheduled obligation work is delegated; an operator answer is never handed to a session.
      // The session route is taken only while its grant holds and the call allowance can hold the
      // step's whole reserved liability on top of the obligation's own start.
      ...(sessionWorkOf(options) === null ? {} : {
        sessionRoute: id => sessionWork !== null && id.startsWith('obligation:') && sessionWork.port.available()
          && journal.view.calls + 1 + SESSION_WORK_LIMITS.maxCallsPerStep <= journal.view.limits.maxCalls,
        sessionWork: async ({ question, context: packet, id }) => {
          const outcome = await sessionWork.port.run({ operation: id.replaceAll(':', '-'), question, context: packet,
            authority: sessionWork.authority });
          if (outcome.state === 'complete') return { state: 'complete', text: outcome.text, usage: { inputTokens: null, outputTokens: null, charge: null } };
          if (outcome.state === 'failed') return { state: 'complete', failureClass: 'malformed' };
          return { state: 'uncertain' };
        } }),
      // Rule 44: an installed update rides operator packets until a sent answer's recorded prompt carried it.
      installedUpdate: () => installUpdate && !updateDelivery(installUpdate, journal.view.order) ? updatePacketItem(installUpdate) : null,
      // Rules 8, 56, 100: due credential reminder stages and a failing doorway check ride the next answer as one line.
      // An unreadable registry or map offers nothing here; status reports it (credentials.error, doorways.fresh).
      replyNotices: turn => {
        const now = wallNow(), notices = [];
        // Part Twelve: this answer's own refused effects ride first, so a refusal is reported even if the answer omits it.
        if (turn !== undefined) notices.push(...refusedEffectNotices(journal.view.effectDoorway?.recent ?? [], turn));
        try { notices.push(...credentialNotices(dueCredentialReminders(createSecretCustody(root, key(), wallNow).records(), now), now)); } catch { /* status shows it */ }
        try { notices.push(...doorwayNotices(readDoorwayMap(doorwaysPath), now)); } catch { /* status shows it */ }
        return notices;
      },
      // Rules 9, 96, 114: this runner's current work and the other owned runners beside it, read at each operator turn.
      concurrentWork: () => launchedAt === null ? null : concurrentWorkItem({ now: wallNow(),
        current: { owner: root.split('/').at(-1), launch: launchedAt, conversation: conversationOf(journal.view.genesis) }, ...ownedActivity(root) }),
      statusLines: statusPullLines,
      checkOutbound: text => { if (redact(text).count || secretMaterialIn(text, heldSecretValues())) throw Error('preview: outbound secret refused'); },
      heldSecrets: heldSecretValues,
      secrets: custody,
      model: async ({ id, prepared }) => {
        if (typeof prepared !== 'string') throw Error('preview: prepared model input absent');
        const result = toolsActive() && toolTurnEligible(id) ? await invokeTools(prepared, id) : await invokeSubscription(prepared, id);
        if (result.state !== 'complete' || result.failureClass) return { ...result,
          ...(result.usage ? { usage: recordedUsage(result.usage) } : {}) };
        return { state: 'complete', text: result.value, ...(result.reason ? { reason: result.reason } : {}),
          usage: recordedUsage(result.usage) };
      },
      summaryCheck: async evidence => (await callJev('jev-summary-faithfulness', evidence, SUMMARY_FAITHFULNESS_QUESTION)).value,
      replyCheck: {
        elapsedMs: () => performance.now(),
        jev: (text, questions = jevQuestions, timeoutMs, occurrence) => callJev(questions === SUMMARY_QUESTION ? 'jev-summary-integrity' : 'jev-reply-check',
          text, questions, timeoutMs, occurrence),
        escalate: async (text, id, originalPrompt, reviewRules, deadlineAt, operation, formatRetry) => {

          const start = performance.now();
          if (typeof originalPrompt !== 'string') throw Error('preview: full reply-review context absent');
          const selectedRules = replyReviewRules(reviewRules ?? []);
          const question = replyReviewQuestion(reviewRules ?? []);

          const reviewContext = replyReviewContext(originalPrompt, text, reviewRules, declaredObligations(journal.view, id, wallNow()),
            credentialRegister());
          const operationId = operation === 'revision' ? `${id}:revision-review` : `${id}:reply-review`;
          // Plan #491: the one format re-ask names the exact defect the reader found in this review's refused verdict.
          const defect = reviewDefects.get(operationId);
          const context = formatRetry ? withFormatReminder(reviewContext, defect ? `${REVIEW_FORMAT_REMINDER} The defect: ${defect}.`
            : REVIEW_FORMAT_REMINDER) : reviewContext;
          reviewDefects.delete(operationId);
          // Rule 29: the review input is written by the runner, a verified system principal.
          const writer = envelopeWriter(journal.systemWriter('reply-review', `${operationId}\n${context}`, wallNow()));
          const prepared = modelEnvelope({ question, context, id: operationId, ...(writer ? { writer } : {}) });
          // A revised candidate's held-class review is its own operation; the worker journals its result row.
          // The revised text's review shares the loop's one deadline (ruling 2 budget).
          const result = operation === 'revision' ? await invokeSubscription(prepared, operationId, undefined, deadlineAt)
            : await invokeSubscription(prepared, operationId, id, deadlineAt);
          // A Decision-shape miss is a format miss like a malformed verdict line: the worker may re-ask it once.
          if (result.state === 'complete' && result.failureClass === 'malformed') {
            if (result.defect) reviewDefects.set(operationId, result.defect);
            throw Error(REVIEW_MALFORMED);
          }
          if (result.state !== 'complete' || result.failureClass) throw Error('preview: reply review unavailable');
          // The reply verdict is one exact line per selected rule (rule_id: PASS | reason); the whole-line
          // pattern admits no surrounding text, so a written rejection can never be discarded around it.
          let parsed;
          // Each selected rule gets its own line, conclusion and reason; a missing or added rule, or the legacy
          // combined line (one shared reason for every rule), is a format miss.
          try { parsed = parseReplyReviewVerdict(result.value, Object.keys(selectedRules)); }
          catch (error) { recordShape(shapesPath, 'reply-review', 'verdict', 'malformed', 'not-json'); throw error; }
          if (parsed.ruleIds.some(rule => !Object.hasOwn(selectedRules, rule))) {
            recordShape(shapesPath, 'reply-review', 'verdict', 'malformed', 'not-json');
            throw Error(REVIEW_MALFORMED);
          }
          return { verdict: parsed.verdict, ruleIds: parsed.ruleIds, confidence: null,
            latencyMs: Math.round(performance.now() - start), reason: parsed.reason,
            ...(parsed.findings ? { findings: parsed.findings } : {}), usage: recordedUsage(result.usage) };
        },
        // The mind's one response to the objections on its draft: same envelope and grounding packet as review,
        // one disposition per objection, inside the loop's shared deadline.
        revise: async ({ text, id, originalPrompt, ruleIds, reason, objections = ruleIds, findings, deadlineAt }) => {
          const context = replyReviewContext(originalPrompt, text, ruleIds, undefined, credentialRegister());
          // Rule 29: the revision input (the objected draft in its review context) is written by the runner.
          const writer = envelopeWriter(journal.systemWriter('reply-review', `${id}:reply-revision\n${context}`, wallNow()));
          const prepared = modelEnvelope({ question: replyRevisionQuestion(objections, reason, findings), context, id: `${id}:reply-revision`,
            ...(writer ? { writer } : {}) });
          const result = await invokeSubscription(prepared, `${id}:reply-revision`, undefined, deadlineAt);
          const usage = result.usage ? { usage: recordedUsage(result.usage) } : {};
          if (result.state === 'uncertain') return { state: 'uncertain', ...usage };
          if (result.state !== 'complete' || result.failureClass) return { state: 'rejected', ...usage };
          const answered = parseReplyRevision(result.value, objections);
          return { state: 'complete', text: answered.text, dispositions: answered.dispositions,
            ...(answered.blocker === undefined ? {} : { blocker: answered.blocker }), ...usage };
        },
        summaryReview: async (state, through) => {
          const start = performance.now();
          // Also the faithfulness cascade's stronger tier (observer #102): it decides what Jev left unsure.
          const question = 'Review this rolling summary against its full supplied conversation packet. Check every commitment, person, correction and dated item, and reject invented facts. It also violates if it loses or contradicts a still-active fact, preference or person detail, or keeps a claim the operator corrected or asked to forget. Active memory records and open commitments are carried separately, so their absence from the prose alone is not loss, and greetings or repeated wording need not be kept. Return only JSON {"verdict":"pass"|"violation","reason":string}. Pass only when coverage is faithful; uncertainty is a violation. Give a brief evidence-based reason.';
          const id = `summary:${through}:review`;
          let prepared;
          try {
            const writer = envelopeWriter(journal.systemWriter('summary-review', `${id}\n${state}`, wallNow()));
            prepared = modelEnvelope({ question, context: state, id, ...(writer ? { writer } : {}) });
          }
          catch { return { verdict: 'unavailable', retryable: true, latencyMs: Math.round(performance.now() - start) }; }
          const result = await invokeSubscription(prepared, id);
          return interpretSummaryReview(result, Math.round(performance.now() - start),
            shape => recordShape(shapesPath, 'summary-review', 'verdict', 'malformed', shape));
        }
      },
      ...(stepCheckEnabled ? { stepCheck: { jev: (text, questions) => callJev('jev-step-check', text, questions ?? stepQuestions) } } : {}),
      ...(retrospectiveEnabled ? { retrospect: async (state, id, question = RETROSPECTIVE_QUESTION) => {
        const result = await invokeSubscription(modelEnvelope({ question, context: state, id }), id);
        return { ...result, ...(result.usage ? { usage: recordedUsage(result.usage) } : {}) };
      } } : {}),
      // Status pull lines: proof posture (Rule 43), then conversation ownership and store checks (Rules 63, 33).
      statusExtra: statusExtraLines,
      // Part Eleven's minimal-path owner decides (src/operator/live.ts); the host reports only what it
      // actually observes (Rule 26), never the activation record standing in for it.
      //   register: the register generation this launch read is still the installed one (Ten's rule).
      //   lease, fence: this runner's exclusive conversation claim (Rule 63), re-verified against its
      //     durable owner record now; the send seam consumes the same fence again before dispatch.
      //   replication-peer: never observed here. This is the single-machine shape, so Eleven omits the
      //     peer only under the operator's accepted P-08 policy (`shape`), resolved at launch from the
      //     sealed authority record; without it the peer stays required and the outage names the policy.
      minimal: { context, dependencies: () => ({ 'local-facts': !journal.readOnly && !journal.view.stop,
        register: registerAtLaunch !== null && registerGeneration() === registerAtLaunch,
        'identity-keys': identityVerified, clock: Number.isSafeInteger(wallNow()),
        lease: ownerClaim?.owner === true, fence: ownerClaim?.owner === true && ownerClaim.verify(),
        'replication-peer': false, 'conversation-binding': Boolean(journal.view.genesis.chat && journal.view.genesis.operator),
        route: identityVerified && routeHealthy, 'delivery-evidence': identityVerified }),
      shape: () => ({ kind: 'single-machine', installation: journal.view.genesis.grant, profile: SINGLE_MACHINE_PROFILE.id,
        lossModel: singleMachineProfileDigest(), operation: LIMITED_ANSWER_OPERATION,
        policy: installationPolicy.kind !== 'resolved' ? null : { policy: 'P-08', installation: installationPolicy.trial,
          profile: installationPolicy.profile, operations: SINGLE_MACHINE_PROFILE.operations, causalPrefix: SINGLE_MACHINE_PROFILE.causalPrefix,
          lossModel: installationPolicy.profileDigest, acceptance: installationPolicy.acceptance } }) },
      // The operator's phone: a pressed Approve/Decline button is cleared with a short toast.
      acknowledge: (callbackId, text) => {
        physical.invoke({ token: secretRef('telegram-bot-token'), method: 'answerCallbackQuery',
          body: { callback_query_id: callbackId, text }, timeoutMs: 10000 }, token());
      },
      // Rules 42 and 89: the physical send consumes the journal's signed intent and returns a
      // closed accepted / refused / unknown outcome; nothing dispatched is ever a refusal.
      send: async ({ text, expectedText, chat, thread, replyMarkup, target, provenance }) => {
        if (!journal.verifyOutbound(provenance, { target, chat, ...(thread === undefined ? {} : { thread }), body: text }))
          return { kind: 'refused', reason: 'outbound provenance unsigned' };
        if (workerStop.value || existsSync(stopPath) || wallNow() >= journal.view.expires || journal.view.stop)
          return { kind: 'refused', reason: 'stopped before dispatch' };
        // Rule 63: the fence is consumed immediately before dispatch. Without it nothing is sent: a definite
        // refusal (Rule 42), never repeated.
        if (!ownerHeld()) return { kind: 'refused', reason: 'conversation ownership lost before dispatch' };
        if (shared) {
          // replicated(1): the journal through this send's signed intent is on the other machine, and the one
          // dispatch-claim for this target is taken, immediately before the physical send. Until then it waits.
          const refused = await shared.admit(target, () => workerStop.value || existsSync(stopPath) || wallNow() >= journal.view.expires || journal.view.stop
            ? 'stopped before dispatch' : !ownerHeld() ? 'conversation ownership lost before dispatch' : null);
          if (refused !== null) return refused;
        }
        let outcome = { kind: 'unknown', reason: 'send port failed' };
        try {
          const reply = physical.invoke({ token: secretRef('telegram-bot-token'), method: 'sendMessage',
            body: { chat_id: chat, text, parse_mode: 'HTML', ...(thread === undefined ? {} : { message_thread_id: thread }),
              ...(replyMarkup === undefined ? {} : { reply_markup: replyMarkup }) },
            timeoutMs: 30000 }, token());
          outcome = classifyTelegramSend(reply, { chat, expectedText, ...(thread === undefined ? {} : { thread }) });
          return outcome;
        } finally { if (shared) await shared.outcome(target, outcome.kind); }
      } });
    if (existsSync(stopPath)) throw Error('preview: stop latched');
    const activationPath = required(options, 'activation-record');
    const activationBytes = readFileSync(activationPath, 'utf8');
    const activation = JSON.parse(activationBytes), profile = Object.freeze(JSON.parse(readFileSync(required(options, 'login-profile'), 'utf8')));
    active = () => { try { return readFileSync(activationPath, 'utf8') === activationBytes; } catch { return false; } };
    doorway.validateActivation(activation, profile, required(options, 'model'), wallNow(), doorway.conversationFraming, journal.view.expires);
    requireAuthority(options, activation, activationPath, journal.view, wallNow());
    if (!activationMatchesJournal(journal.view, activation)) throw Error('preview: activation differs from journal');
    // Part Thirteen §9 (docs/17-harness-adapters): tools are on by default. The tool route runs under its own activation
    // record, bound to the tools policy digest and resolved from the same sealed authority (the operator's recorded grant).
    // `--tools-activation PATH` names a record the desk wrote; without it the runner derives one from this conversation
    // activation (every field the same, the tools policy digest in place of the conversation one) and keeps it only when
    // the sealed authority resolves it, writing it to the root as the live withdrawal handle. `--tools off` refuses tools.
    // Changing or removing the file withdraws them: no new tool turn starts, and a live one ends. Revoking the grant
    // withdraws them durably. Plan #449: the build's own tools policy is presented to the resolver, so the operator's standing
    // full-tools grant recorded for a policy class (tools-policy-class.ts) covers every build whose policy keeps the class's
    // checkpoints. With no covering grant the runner REFUSES to start and names why; it never starts silently text only
    // (only an explicit `--tools off` runs text only).
    const toolsMode = options.tools ?? 'default';
    if (toolsMode !== 'default' && toolsMode !== 'off') throw Error('preview: --tools must be default or off');
    if (options['tools-activation'] !== undefined && toolsMode === 'off') throw Error('preview: --tools off contradicts --tools-activation');
    const adoptTools = (toolsActivationPath, toolsBytes) => {
      // A doorway that serves no scoped-tool framing has no tool route: refused rather than validated against another
      // doorway's reviewed policy (w4-sessiondriver); each doorway checks its own tools activation.
      if (doorway.toolsFraming === null) throw Error(`preview: doorway ${doorway.id} serves no scoped-tool answer framing`);
      const toolsActivation = JSON.parse(toolsBytes);
      doorway.validateActivation(toolsActivation, profile, required(options, 'model'), wallNow(), doorway.toolsFraming, journal.view.expires);
      toolsResolution = requireAuthority(options, toolsActivation, toolsActivationPath, journal.view, wallNow(),
        doorway.policyFor(required(options, 'model'), doorway.toolsFraming));
      if (!activationMatchesJournal(journal.view, toolsActivation)) throw Error('preview: tool activation differs from journal');
      return toolsActivation;
    };
    // A revoked, changed, expired or unreadable grant withdraws tools live: every check resolves the sealed authority again
    // at the current time (a grant's liveness depends on the clock, not only on the record's bytes), and a refusal ends
    // tools (no new tool turn, and a live one stops) until a later launch resolves them.
    const stillGranted = (toolsActivationPath, toolsBytes) => () => {
      try { adoptTools(toolsActivationPath, toolsBytes); return true; } catch { return false; }
    };
    if (options['tools-activation'] !== undefined) {
      const toolsActivationPath = options['tools-activation'];
      const toolsBytes = readFileSync(toolsActivationPath, 'utf8');
      toolsRecord = adoptTools(toolsActivationPath, toolsBytes);
      const granted = stillGranted(toolsActivationPath, toolsBytes);
      toolsActive = () => { try { return readFileSync(toolsActivationPath, 'utf8') === toolsBytes && granted(); } catch { return false; } };
    } else if (toolsMode === 'off') toolsOff = 'refused at launch with --tools off';
    else {
      const toolsActivationPath = join(root, TOOLS_DEFAULT_ACTIVATION);
      const toolsBytes = `${JSON.stringify({ ...activation, invocationPolicyDigest: doorway.toolsFraming === null ? 'none'
        : encoded(doorway.policyFor(required(options, 'model'), doorway.toolsFraming)).hash }, null, 2)}\n`;
      try {
        // The authority is resolved against the record's would-be path, so the sealed record beside the activation governs it.
        toolsRecord = adoptTools(activationPath, toolsBytes);
        let current = null;
        try { current = readFileSync(toolsActivationPath, 'utf8'); } catch { current = null; }
        if (current !== toolsBytes) writeToolsDefaultActivation(toolsActivationPath, toolsBytes);
        const granted = stillGranted(activationPath, toolsBytes);
        toolsActive = () => { try { return readFileSync(toolsActivationPath, 'utf8') === toolsBytes && granted(); } catch { return false; } };
      } catch (error) {
        // Never a silent text-only start: the operator granted the full tool set, so a launch nothing covers is refused, loudly.
        // The reason is the resolver's fixed text with digests and class names (no secret), so it goes to stderr whole, as the
        // tools-off line it replaces did; the launch log records it too ('refused before launch').
        const refusal = `preview: refused to start: no recorded operator grant covers this build's tools policy (${JSON.parse(toolsBytes).invocationPolicyDigest}): `
          + `${String(error?.message ?? error).replace(/^preview: /u, '')}. Record the standing full-tools grant for this policy (or its class), `
          + 'or pass --tools off to run text only';
        process.stderr.write(`${refusal}\n`);
        throw Error(refusal);
      }
    }
    // The resolved tools authority, recorded at launch: the grant, and the class and policy digest it was verified for.
    if (toolsRecord && toolsResolution) process.stderr.write(`preview: tools on: grant ${toolsResolution.grant}`
      + (toolsResolution.policyClass ? ` (class ${toolsResolution.policyClass.name})` : ' (exact policy)')
      + ` covers tools policy ${toolsRecord.invocationPolicyDigest}\n`);
    const effectPolicyPath = options['effect-policy'];
    if (effectPolicyPath !== undefined) {
      decodeEffectPolicy(JSON.parse(readFileSync(effectPolicyPath, 'utf8')));
      // A configured policy that cannot be reread is unavailable, never the empty default: the hook refuses every proposal
      // that could reach the doorway until it reads again (its restrictions must not lapse while it is being rewritten).
      effectPolicyOf = () => currentEffectPolicy(() => readFileSync(effectPolicyPath, 'utf8'));
    }
    // Rule 114: a tool turn a crash interrupted has its hook record journaled now, before any new turn (and its retention
    // pass) can run; until it is, retention keeps that directory. No tool turn of this runner is live yet.
    try { reconcileToolTurns({ journal, root, redactText: text => redact(text).text, now: wallNow }); }
    catch (error) { process.stderr.write(`preview: interrupted tool turns not yet journaled (kept): ${String(error?.message ?? error)}\n`); }
    // Part fifteen §5 (docs/19-scheduled-work): long and scheduled work runs as a full delegated
    // session only under its own reviewed grant, re-checked before every step together with the
    // login home's live subscription sign-in. Changing or removing the grant file withdraws it: no
    // new step starts, and an open step's child is stopped. Each step is admitted and held by this
    // process's one resource owner and reserves its call liability in the journal before it exists.
    const sessionSetup = sessionWorkOf(options);
    // The host's one admission checkpoint for every harness it delegates to (admission-gate.mjs): each model call of a
    // delegated session or a Codex tool turn takes its claim's reserved allowance here before dispatch, each delegation
    // becomes a durable child edge first, and each consequential tool passes the effect owner, which decides it by the
    // effect doorway's four tests under the installation's current effect policy (read at each decision, so a policy
    // withdrawn or unreadable mid-step refuses), exactly as an unchecked tool turn's hook does.
    if (sessionSetup !== null || doorway.toolTurn?.harness) {
      const gateStopped = () => workerStop.value || existsSync(stopPath) || !ownerHeld() || journal.view.stop !== null
        || wallNow() >= journal.view.expires || !active();
      const appendWork = record => journal.append({ kind: 'session-work', record, at: wallNow() });
      gate = await createAdmissionGate({ append: appendWork, stopped: gateStopped, now: wallNow,
        effects: createToolEffectOwner({ decide: (tool, input) => admitToolCallEffect(tool, input, admissionConfig(), wallNow()),
          append: appendWork, stopped: gateStopped, now: wallNow, prepared: identity => (journal.view.toolEffects ?? []).includes(identity) }) });
    }
    if (sessionSetup !== null) {
      const sessionBytes = readFileSync(sessionSetup.activation, 'utf8'), sessionActivation = JSON.parse(sessionBytes);
      doorway.session.validateActivation(sessionActivation, profile, required(options, 'model'), wallNow(), journal.view.expires);
      requireAuthority(options, sessionActivation, sessionSetup.activation, journal.view, wallNow());
      if (!activationMatchesJournal(journal.view, sessionActivation)) throw Error('preview: session work activation differs from journal');
      const sessionActive = () => { try { return readFileSync(sessionSetup.activation, 'utf8') === sessionBytes; } catch { return false; } };
      // Rule 60: the session's working scope is a persistent fixed-size volume (tool-turn.mjs attachSessionVolume), mounted
      // before the first step, so every file a step writes, however many, is bounded together. Run as the harness user
      // (--harness-user), the same volume mounts where that user can reach it (harness-user.mjs harnessSessionLayout),
      // both identities granted on it, and each step's admission state lives in the harness area, as a tool turn's does.
      const layout = harness ? harnessSessionLayout(root) : null;
      const scope = layout ? layout.mount : join(realpathSync(root), 'session-work');
      mkdirSync(scope, { recursive: true, mode: 0o700 });
      chmodSync(scope, 0o700);
      const project = realpathSync(scope), framework = doorway.session.framework;
      const mountVolume = identity => {
        if (attachSessionVolume(root, layout ? { at: layout.mount } : {}) !== project) throw Error('preview: the session volume is not the working scope');
        if (identity) grantVolume(project, identity.user, identity.runner);
      };
      const physical = createProductionSessionIO({ stateDirectory: join(root, 'session-work-state'), tmuxPath: sessionSetup.tmux,
        home: profile.home, configHome: profile.configDirectory, cwd: project });
      const stoppedNow = () => workerStop.value || existsSync(stopPath) || !ownerHeld() || journal.view.stop !== null
        || wallNow() >= journal.view.expires || !active() || !sessionActive();
      // The step's preflights run as the identity its session will (harness-user: held, never the runner's, while unready).
      const admissionIO = () => createSubscriptionProviderIO({ repository: process.cwd(), stopped: stoppedNow, work: 'maintenance',
        runAs: runAsOf(harness) });
      // Every tool call of the child (its subagents' too) passes the admission hook before dispatch: its slots are
      // the step's reserved call liability, MCP and other consequential tools go to the effect doorway, and every
      // shell command runs confined. The state lives beside the working scope, never inside it.
      const admissionBase = layout ? layout.admission : join(root, 'session-work-state', 'admission');
      const closeStepEgress = async claim => { const proxy = stepEgress.get(claim); stepEgress.delete(claim); if (proxy) await proxy.close(); };
      sessionWork = { authority: `session work grant ${sessionActivation.reference}: one scheduled work step for the verified operator, `
        + 'with the full tool set behind the admission hook, its result returned by file', port: take(createSessionWorkPort({
        createDriver: resolveIntake => createProductionSessionDriver({ operatorOwnUse: true, confinement: 'admitted',
          toolAdmission: { command: sessionAdmissionCommand({ base: admissionBase, ...(layout ? { script: harnessHookPath() } : {}) }),
            timeoutSeconds: Math.ceil(SESSION_WORK_LIMITS.deadlineMs / 1000) }, modelGate: claim => gate.base(claim),
          framework, executable: profile.executable, cwd: project, home: profile.home, configHome: profile.configDirectory,
          model: required(options, 'model'), context, io: physical, now: wallNow, stopped: stoppedNow, resolveIntake,
          maxSessions: SESSION_WORK_LIMITS.maxSessions, turnDeadlineMs: SESSION_WORK_LIMITS.deadlineMs,
          readyTimeoutMs: 30000, protectedSessions: [],
          // As the harness user: the pane runs the harness through the bridge, which hands it the custody login.
          ...(layout ? { launchVia: [process.execPath, HARNESS_SESSION_BRIDGE, options['harness-user'],
            realpathSync(required(options, 'login-profile')), '--'] } : {}) }),
        io: { readResult: (path, maxBytes) => physical.readResult(path, maxBytes), clearResult: path => physical.clearResult(path),
          modelCalls: since => physical.modelCalls(framework, project, profile.configDirectory, since), wait: delay,
          prepareAdmission: async (claim, edge) => {
            const identity = harness ? harness.current() : null;
            mountVolume(identity);
            await closeStepEgress(claim);
            if (identity) harnessSessionAdmission(root, identity.user);
            const state = prepareSessionAdmission({ base: admissionBase, claim, workspace: project, maxCalls: SESSION_WORK_LIMITS.maxCallsPerStep,
              gate: gate.base(claim), ...admissionConfig(), ...(identity ? { harness: { user: identity.user, runner: identity.runner } } : {}) });
            // The step's shell network checkpoint (egress-proxy.mjs): the confined shell's one network path, deciding every
            // request by the same effect doorway, under its request and byte bounds; stopped when the step's claim closes.
            // As the harness user its private state stays the runner's alone, outside the harness-readable step state.
            const tmp = join(project, '.tmp');
            let privateDirectory;
            if (identity) {
              const egressBase = join(root, 'session-work-state', 'egress');
              privateDirectory = join(egressBase, claim);
              rmSync(privateDirectory, { recursive: true, force: true });
              mkdirSync(privateDirectory, { recursive: true, mode: 0o700 });
              // Kept like the admission directories: the newest SESSION_ADMISSION_KEPT steps.
              readdirSync(egressBase).filter(name => name !== claim).map(name => ({ name, at: lstatSync(join(egressBase, name)).mtimeMs }))
                .sort((a, b) => b.at - a.at).slice(SESSION_ADMISSION_KEPT - 1)
                .forEach(({ name }) => rmSync(join(egressBase, name), { recursive: true, force: true }));
            }
            stepEgress.set(claim, (await attachEgress({ stateDirectory: state, ...(privateDirectory ? { privateDirectory } : {}), scratch: tmp,
              home: join(tmp, 'home') }, undefined, networkToolReads())).proxy);
            gate.open(claim, { framework, allowance: SESSION_WORK_LIMITS.maxCallsPerStep, edge }); },
          admissionState: claim => gate.state(claim),
          closeAdmission: claim => { gate.close(claim); closeStepEgress(claim).catch(() => {}); } },
        resources: { admit: async () => {
          doorway.session.validateActivation(sessionActivation, profile, required(options, 'model'), wallNow(), journal.view.expires);
          await doorway.session.admit({ profile, io: admissionIO(), deadline: wallNow() + 15000, now: wallNow });
          const held = await hostResources.hold('maintenance', { timeout: 30000, stopped: stoppedNow });
          return held === null ? null : { attach: child => held.attach({ pid: Number(child.split(':')[1]), cwd: project }),
            release: async () => (await held.release()).verified };
        } },
        context, now: wallNow, stopped: stoppedNow,
        append: record => journal.append({ kind: 'session-work', record, at: wallNow() }),
        parent: `launch:${conversationOf(g)}`, owner: ownerMachine, placement: `machine:${ownerMachine}`,
        transport: 'tmux session on this machine', workingScope: project, resultDirectory: project,
        artifact: `doorway:${doorway.id}`, incarnation: String(launchedAt ?? wallNow()),
        deadlineMs: SESSION_WORK_LIMITS.deadlineMs, pollMs: SESSION_WORK_LIMITS.pollMs,
        maxResultBytes: SESSION_WORK_LIMITS.maxResultBytes, maxSteps: SESSION_WORK_LIMITS.maxStepsPerLaunch,
        maxCalls: SESSION_WORK_LIMITS.maxCallsPerStep })) };
    }
    installationPolicy = installationPolicyOf(options, activation, activationPath, journal.view, wallNow());
    registerAtLaunch = registerGeneration();
    if (installationPolicy.kind !== 'resolved') process.stderr.write(`preview: limited answers past a cap are inhibited: ${installationPolicy.reason}\n`);
    // Rule 56: the installed routes' exact model ids, merged into the durable map.
    doorwayMapPath = doorwaysPath;
    writeDoorwayMap(doorwaysPath, standingDoorwayCheck(installDoorways(readDoorwayMap(doorwaysPath), [
      { id: 'preview-subscription', billing: 'subscription', model: options.model, priceReason: 'the subscription route reports no billed charge' },
      { id: 'typesafe-jev', billing: 'metered', model: JEV_MODEL, priceReason: 'the Jev route reports no price' }], wallNow()), wallNow()));
    // Rule 100: installed credentials' identity and known fixed expiry. Values stay in their custody.
    const recordedAt = wallNow();
    for (const record of [
      { name: 'telegram-bot-token', kind: 'telegram-bot-token', custody: 'host-environment', identity: `Telegram bot ${g.bot}`,
        expiresAt: null, expirySource: 'none', smallestHumanAction: 'rotate the bot token with BotFather and rebind the host secret' },
      { name: 'typesafe-key', kind: 'api-key', custody: 'host-environment', identity: 'TypeSafe Jev route',
        expiresAt: null, expirySource: 'unknown', smallestHumanAction: 'replace the TypeSafe key in host custody' },
      { name: profile.reference, kind: 'subscription-login', custody: 'cli-custody', identity: profile.expectedAccount,
        expiresAt: null, expirySource: 'unknown', smallestHumanAction: 'sign the subscription login back in' },
      { name: 'preview-activation', kind: 'activation', custody: 'activation-record', identity: activation.reference,
        expiresAt: journal.view.expires, expirySource: 'activation-record', smallestHumanAction: 'approve a renewed activation record' }])
      custody.register({ name: record.name, kind: record.kind, custody: record.custody, identity: record.identity, recordedAt,
        expiresAt: record.expiresAt, expirySource: record.expirySource, reminders: reminderSchedule(record.expiresAt),
        renewal: { standing: 'none', smallestHumanAction: record.smallestHumanAction } });
    const captures = new Map();
    const physical = createProductionTelegramIO(join(root, '.writer'), { preserve(ref, bytes) {
      if (captures.has(ref) && captures.get(ref) !== bytes) return false; captures.set(ref, bytes); return true;
    }, read: ref => captures.get(ref) ?? null }, offlineEndpoint);
    if (signalled || existsSync(stopPath)) return;
    const identity = physical.invoke({ token: secretRef('telegram-bot-token'), method: 'getMe', body: {}, timeoutMs: 30000,
      identityBinding: { id: number(g.bot, 'bot-id'), username: required(options, 'bot-username').replace(/^@/, '') } }, token());
    if (identity.kind !== 'identity' || identity.identity.id !== Number(g.bot)) throw Error('preview: bot identity refused');
    identityVerified = true;
    worker.startStepChecks();
    // Rules 9/26/43: the startup proof records what this launch actually observed — the authenticated bot
    // identity and the replayed journal — with the generation and capability versions it launched with.
    const launchVersions = capabilityVersions(), generation = launchVersions['preview.proofs'];
    proofRecords = readProofs(proofsPath).proofs;
    const supervisors = { replyReview: true, summaryReview: true, stepCheck: stepCheckEnabled };
    proofPorts = { now: wallNow, liveView: () => journal.view, boundBot: Number(g.bot), supervisors, storeAgreements,
      durableView: () => { const copy = openJournal(journalPath, key(), undefined, undefined, true); try { return copy.view; } finally { copy.close(); } },
      botIdentity: () => {
        try {
          const answer = physical.invoke({ token: secretRef('telegram-bot-token'), method: 'getMe', body: {}, timeoutMs: 10000,
            identityBinding: { id: number(g.bot, 'bot-id'), username: required(options, 'bot-username').replace(/^@/, '') } }, token());
          return answer.kind === 'identity' ? { id: answer.identity.id } : null;
        } catch { return null; }
      } };
    const startup = executeProof(PREVIEW_PROOF_PLANS.find(plan => plan.id === 'startup'),
      { ...proofPorts, botIdentity: () => ({ id: identity.identity.id }), launch: { stepCheck: stepCheckEnabled, agentState: Boolean(options['agent-state-dir']),
        ...Object.fromEntries(Object.entries(launchVersions).map(([id, version]) => [`${VERSION_PREFIX}${id}`, version])) } }, generation, clock.elapsed);
    // Rules 14/95: the proof log is evidence, not a gate on conversation. An unwritable log is reported and retried
    // with backoff; the undurable record never counts as proof, and intake and replies continue.
    const recordProof = record => {
      try { appendProof(proofsPath, record); proofRecords.push(record); proofStoreFailed = false; }
      catch { proofStoreFailed = true; proofBackoffUntil = clock.elapsed() + 60000; process.stderr.write('preview: proof log unavailable; retrying with backoff\n'); }
    };
    recordProof(startup);
    hostBeat();
    proofLaunch = runningLaunch([startup]);
    /** One due plan per cycle, bounded by its own probe; a failed durable write backs off instead of retrying every cycle. */
    const runDueProof = () => {
      if (workerStop.value || existsSync(stopPath) || journal.view.stop || wallNow() >= journal.view.expires || clock.elapsed() < proofBackoffUntil) return;
      const plan = nextDuePlan(PREVIEW_PROOF_PLANS, proofRecords, generation, proofPorts, wallNow());
      if (plan) recordProof(executeProof(plan, proofPorts, generation, clock.elapsed));
    };
    const cycles = number(options['max-cycles'] ?? '1000', 'max-cycles', 1, 1_000_000);
    // The run log is durable before the first poll; the self-state reads it from memory each turn.
    launchedAt = wallNow();
    installation = { ...installedCode(), briefingDigest: briefingDigest(toolsActive()), harness: PREVIEW_JOURNAL_HARNESS,
      stallClasses: PREVIEW_JOURNAL_STALL_COVERAGE.rows.length, doorway: options.doorway ?? DEFAULT_SUBSCRIPTION_DOORWAY };
    // An unreadable run log is refused by the Rule 55 check below, after this launch's row is appended.
    let priorRuns = null;
    try { priorRuns = existsSync(runsPath) ? readFileSync(runsPath, 'utf8') : ''; } catch { /* readRuns reports readFailed */ }
    if (priorRuns !== null) installUpdate = installedUpdateFrom(installationRows(priorRuns), installation, launchedAt);
    appendRun(runsPath, { v: 1, launch: launchedAt, pid: process.pid, install: installation, work: { conversation: conversationOf(g) },
      // Plan #449: the tools authority this launch resolved (grant, class, policy digest), or why tools are off (only --tools off).
      tools: toolsRecord && toolsResolution ? { state: 'on', grant: toolsResolution.grant, policyClass: toolsResolution.policyClass?.name ?? null,
        policyDigest: toolsRecord.invocationPolicyDigest } : { state: 'off', reason: toolsOff ?? 'no tool route' },
      minimalPath: { shape: 'single-machine', register: registerAtLaunch, policy: installationPolicy.kind === 'resolved'
        ? { state: 'accepted', id: installationPolicy.id, acceptance: installationPolicy.acceptance, acceptedAt: installationPolicy.acceptedAt,
          profile: installationPolicy.profile, standing: 'account-authenticated operator message under the desk\'s seal; not device-signed' }
        : { state: 'not-accepted', reason: installationPolicy.reason } } });
    runs = readRuns(runsPath);
    // Rule 55: unrecoverable poll pressure fails the launcher closed; unavailable history never becomes a fresh episode.
    if (runs.readFailed) { endReason = 'run log unreadable'; pressureUnknown = true; throw Error('preview: run log unreadable'); }
    handoff = restartHandoff(journal.view, runs, launchedAt);
    reservedAtLaunch = new Set(journal.view.order.filter(turn => turn.reserved).map(turn => turn.id));
    // The run log and ownership exist now: the launch's store comparisons execute as a recorded proof.
    recordProof(executeProof(PREVIEW_PROOF_PLANS.find(plan => plan.id === 'store-agreements'), proofPorts, generation, clock.elapsed));
    ({ failed: failedPolls, conflicted: conflictedPolls } = runs.pollPressure);
    const pollFailure = async conflict => {
      failedPolls++; routeHealthy = false;
      conflictedPolls = conflict ? conflictedPolls + 1 : 0;
      try { appendRun(runsPath, { v: 1, launch: launchedAt, poll: conflict ? 'conflicted' : 'failed', at: wallNow() }); }
      catch { endReason = 'run log unavailable'; process.exitCode = 1; return false; }
      const reason = exhaustedPollReason(failedPolls, conflictedPolls);
      if (reason) {
        endReason = reason;
        process.exitCode = 1;
        return false;
      }
      const until = clock.elapsed() + Math.min(conflict ? 2000 : 30000, 250 * 2 ** Math.min(failedPolls - 1, 7));
      serviceBeat(false, conflict ? 'Telegram reports another poller' : 'polling Telegram is failing');
      while (!workerStop.value && !existsSync(stopPath) && clock.elapsed() < until)
        await delay(Math.min(100, until - clock.elapsed()));
      return true;
    };
    // An exhausted carried episode is an open breaker: one delayed trial poll per launch, never an immediate retry storm.
    if (exhaustedPollReason(failedPolls, conflictedPolls)) {
      serviceBeat(false, 'poll breaker open after sustained failures');
      const until = clock.elapsed() + Math.min(conflictedPolls >= 5 ? 2000 : 30000, 250 * 2 ** Math.min(failedPolls, 7));
      while (!workerStop.value && !existsSync(stopPath) && clock.elapsed() < until)
        await delay(Math.min(100, until - clock.elapsed()));
    }
        let summaryJob = null, stepJob = null, retroJob = null;
    const checkStepsLater = () => {
      if (!stepCheckEnabled || stepJob) return;
      stepJob = worker.checkSteps().catch(() => {}).finally(() => { stepJob = null; });
    };
    // After the summary pass: at most one bounded retrospective pass (the worker decides whether one is due).
    const retrospectLater = () => {
      if (!retrospectiveEnabled || retroJob) return;
      retroJob = worker.retrospect().catch(() => {}).finally(() => { retroJob = null; });
    };

    const sourceState = options['agent-state-dir'] ? agentState(options['agent-state-dir']) : null;
    const summarizeLater = () => {
      // After the reply: the deterministic coherence check records its findings for the next
      // packet. It makes no call and cannot hold the reply already attempted;
      // its synchronous journal write can slightly delay the next poll.
      try { worker.checkCoherence(); } catch { /* the unchecked reply is retried after the next drain */ }
      checkStepsLater();
      if (summaryJob) return;
      summaryJob = worker.summarizeIfNeeded().catch(() => {}).then(checkStepsLater).then(retrospectLater).finally(() => { summaryJob = null; });
    };
    // A reached cap is a local report, never the end of reachability: past it the minimal
    // reserve keeps reading and answering the operator (Rule 15).
    const reportCap = () => reportJournalCap(journal, wallNow(), line => process.stderr.write(line));
    // Rule 15: ordinary work (model calls, reviews, requested summaries) runs beside the poll loop and
    // is never awaited by it, so a blocked model call cannot stop reading, stop or approvals. A failed
    // ordinary pass no longer ends the process: the minimal path keeps reading and answering (reason
    // `worker`) while the ordinary pass is retried with backoff; eight consecutive failures open the
    // breaker and end the run for the host supervisor (Rules 15, 55; Eleven §5's ordinary-worker cut).
    // Two machines: ordinary work (model calls, replies, reminders) starts only while the other machine holds the
    // whole journal, so nothing is spent or prepared on local durability while the peer is away. Input is still read.
    const lane = createOrdinaryLane({ elapsed: clock.elapsed, peerCurrent: () => shared === null || shared.peerCurrent(), after: summarizeLater });
    const ordinary = run => { lane.submit(run); };
    // A message past every bound waits at Telegram; later presses behind it are re-read after this pause.
    const waitHeld = async () => {
      const until = clock.elapsed() + 3000;
      while (!signalled && !workerStop.value && !existsSync(stopPath) && clock.elapsed() < until)
        await delay(Math.min(250, until - clock.elapsed()));
    };
    // A renewal applied this launch (a chat yes at intake, a review approval in the minimal step) moves the journal's end
    // past this record, and no model call accepts it after that. The cycle ends before any further model step, so the
    // waiting turns (the yes included) are answered by the next launch on the renewed record, not refused under this one.
    const renewedAway = () => {
      if (activationMatchesJournal(journal.view, activation)) return false;
      endReason = 'activation renewed: restart on the renewed record'; return true;
    };
    // Part 18 (plan #402): the live sentinels run on this loop's own cycle and request only the runner's own bounded
    // steps. A requested step is queued and run inside the cycle's admitted ordinary job (sentinelCycle), never
    // resubmitted to the busy lane, where it would be silently declined.
    const sentinelSteps = [];
    const sentinels = createLiveSentinels(journal, { now: wallNow, startedAt: launchedAt, families: sentinelFamilies,
      stopped: () => signalled || workerStop.value || existsSync(stopPath) || !ownerHeld(),
      reground: () => sentinelSteps.push(() => worker.drain()),
      recoverContext: () => sentinelSteps.push(() => worker.summarizeIfNeeded(true)),
      selfHeal: () => sentinelSteps.push(() => worker.drain()),
      // A due reminder is never sent from this pre-poll job: the post-poll job below already sends every requested
      // reminder, and only after a successful empty poll, so a waiting withdrawal is read and settled first (Rule 93).
      actOnPromise: id => { if (!id.startsWith('request:')) sentinelSteps.push(() => worker.workObligations()); } });
    const sentinelTick = () => { if (sentinelFamilies.size && !journal.readOnly) sentinels.tick(); };
    for (let i = 0; i < cycles && !signalled; i++) {
      if (i > 0) await new Promise(done => setImmediate(done));
      if (signalled || workerStop.value || existsSync(stopPath) || journal.view.stop || !ownerHeld()) break;
      // Attempting another poll is not restoration: while a poll-failure episode is open the owner stays
      // non-servable with its typed reason; only a successful poll (below) restores service.
      const unrestored = failedPolls > 0 || conflictedPolls > 0;
      serviceBeat(!journal.view.stop && wallNow() < journal.view.expires && !unrestored, journal.view.stop ? 'stop latched'
        : unrestored ? (conflictedPolls ? 'Telegram reports another poller' : 'polling Telegram is failing') : 'serving');
      if (shared) {
        await shared.sync();
        // The same checks as the top of the cycle: a stop or a lost lease during the exchange ends it here, cleanly.
        if (signalled || workerStop.value || existsSync(stopPath) || journal.view.stop || !ownerHeld()) break;
        if (!shared.peerCurrent()) serviceBeat(false, 'waiting for the other machine to acknowledge the journal');
      }
      if (sourceState) for (const source of ['telegram', 'slack']) {
        try {
          importSource(journal, sourceState, source, () => workerStop.value || existsSync(stopPath));
        } catch {
          if (workerStop.value || existsSync(stopPath)) break;
        }
      }
      if (lane.error()) throw lane.error();
      worker.gate(); await worker.minimal();
      // A stop given on the independent surface latches here, before any poll or ordinary pass.
      if (journal.view.stop) break;
      if (renewedAway()) break;
      // Rules 8, 22, 92, 99: the scheduled consumer of due obligation work, one bounded step per tick,
      // runs after the ordinary drain inside the same background job, so it never blocks the minimal path.
      // The sentinels tick only when that job is admitted, and their requested steps run inside it after the drain.
      // A holding note the presence sentinel marks due goes out at the minimal path's next step after the poll.
      sentinelCycle(lane, { tick: sentinelTick, requested: sentinelSteps, drain: () => worker.drain(),
        after: async () => {
          try { await worker.workObligations(); } catch { /* a stop or expiry ends the step; its start stays durable */ }
        } });
      worker.gate();
      reportCap();
      runDueProof();
      checkDoorways();
      publishDashboard();
      if (existsSync(stopPath) || wallNow() >= journal.view.expires) break;
      let pollLimit;
      try { pollLimit = worker.pollLimit(); } catch { break; }
      if (signalled || workerStop.value || existsSync(stopPath)) break;
      let result;
      // The long poll is awaited asynchronously: a synchronous wait froze every concurrent launch's
      // timers and exit events for up to its whole long-poll timeout (live 2026-09-29).
      const poll = physical.poll ? (input, credential) => physical.poll(input, credential) : (input, credential) => physical.invoke(input, credential);
      try { result = await poll({ token: secretRef('telegram-bot-token'), method: 'getUpdates',
        // Two machines: Telegram is asked from the SHARED settled cursor, so it keeps every update the other machine lacks.
        body: { offset: shared ? shared.cursor : journal.view.cursor, limit: pollLimit,
          timeout: number(options['max-poll-seconds'] ?? '5', 'max-poll-seconds', 1, 5),
          allowed_updates: ['message', 'edited_message', 'callback_query'] },
        timeoutMs: 12000 }, token()); }
      catch { if (!await pollFailure(false)) break; continue; }
      await new Promise(done => setImmediate(done));
      if (signalled || workerStop.value || existsSync(stopPath)) break;
      if (result.kind !== 'response' || result.status !== 200) {
        if (!await pollFailure(result.kind === 'response' && result.status === 409)) break;
        continue;
      }
      let updates;
      try { updates = JSON.parse(result.bytes); } catch { if (!await pollFailure(false)) break; continue; }
      if (updates.ok !== true || !Array.isArray(updates.result)) { if (!await pollFailure(false)) break; continue; }
      // A successful poll is the restoration evidence that closes the episode, recorded before it is relied on.
      if (failedPolls || conflictedPolls) appendRun(runsPath, { v: 1, launch: launchedAt, poll: 'restored', at: wallNow() });
      if (failedPolls || conflictedPolls) serviceBeat(!journal.view.stop && wallNow() < journal.view.expires, 'poll restored');
      failedPolls = 0; conflictedPolls = 0; routeHealthy = true;
      // Updates this journal already recorded come back until the shared cursor passes them; only the new ones are taken.
      const batch = shared ? updates.result.filter(update => !(update?.update_id < journal.view.cursor)) : updates.result;
      worker.intake(batch);
      // An approved phone stop latches in the journal; the loop ends without another effect.
      if (journal.view.stop) break;
      if (shared) {
        shared.noteIntake(); await shared.sync();
        if (signalled || workerStop.value || existsSync(stopPath) || journal.view.stop || !ownerHeld()) break;
      }
      // A chat yes applies a renewal at intake: end before any further step (see renewedAway).
      if (renewedAway()) break;
      // A full held page was preserved and passed: read the rest of the backlog now, so an exact /stop
      // behind it latches before any further processing (Rule 4; bounded by the waiting store).
      if (worker.readAhead() && batch.length >= pollLimit) continue;
      await worker.minimal();
      if (journal.view.stop) break;
      if (renewedAway()) break;
      // Reminders go out only after a successful poll returned nothing new and no ordinary drain is
      // running: every operator message already waiting (a cancellation included) has been read and
      // settled first. A failed poll, a backlog or a cap leaves them pending.
      ordinary(() => batch.length === 0 ? worker.sendRequested() : worker.drain());
      reportCap();
      // Rule 55: while the other machine is away the unsettled updates return at once; re-read after the same pause.
      if (worker.intakeHeld() || shared && batch.length === 0 && updates.result.length > 0) await waitHeld();

    }
    // The bounded shutdown awaits (provider timeouts) are progress, not a hang.
    const tailBeat = setInterval(hostBeat, 5000);
    try {
      await lane.settle();
      if (lane.error() && !signalled) throw lane.error();
      await summaryJob;
      await stepJob;
      await retroJob;
      if (stepCheckEnabled) await worker.checkSteps();
    } finally { clearInterval(tailBeat); }
    reportCap();
    publishDashboard(true);
    readOnlyServer?.close();
    endReason ??= 'cycle limit reached';
    function modelRoute(operation, toolTurn) {
      if (!active() || workerStop.value || existsSync(stopPath)) throw Error('preview: activation stopped');
      if (toolTurn && !toolsActive()) throw Error('preview: tool activation withdrawn');
      // Rule 30: the doorway was selected by its registered id above; its parser, terminal contract,
      // framings and invocation policy stay in the adapter that owns them.
      const framing = toolTurn ? doorway.toolsFraming ?? doorway.conversationFraming : doorway.conversationFraming;
      const policy = doorway.policyFor(options.model, framing);
      const contract = { reference: activation.reference, version: activation.profileDigest,
        ...doorway.contract, successfulFinalReplyReasons: [...doorway.contract.successfulFinalReplyReasons],
        endpoint: profile.loginProfileIdentity,
        account: profile.expectedAccount, credentialReference: profile.reference, controller: 'preview-journal',
        sourceEvidence: [activation.reference], terminalEvidence: activation.reference,
        strength: 'attestation', maxMetadataBytes: policy.maxMetadataBytes,
        maxRawTerminalBytes: policy.maxRawTerminalBytes, maxCaptureBytes: policy.maxCaptureBytes };
      const work = operation.startsWith('summary:') ? 'maintenance' : operation.endsWith(':reply-review') ? 'review' : 'answer';
      // A tool turn also ends on the journal's latched /stop and on tool-activation withdrawal: the resource
      // owner polls this every 25 ms and SIGKILLs the launch's own process group by its exact pid.
      const launchIO = createSubscriptionProviderIO({ repository: process.cwd(), runAs: runAsOf(harness),
        stopped: () => workerStop.value || existsSync(stopPath) || !active()
          || (toolTurn !== undefined && (journal.view.stop !== null || !toolsActive())), work });
      const physicalIO = { ...launchIO, execute: async input => {
        const result = await launchIO.execute(input);
        // Only the model command is the exchange: it alone carries the prepared prompt on stdin; the
        // version and auth preflights send none and print no result frame.
        if (typeof input.stdin === 'string' && input.stdin.length > 0)
          observeDoorway('preview-subscription', options.model, subscriptionExchange(result, operation));
        return result;
      } };
      const io = observedSubscriptionIO(physicalIO, policy, operation, row => journal.append(row),
        { elapsed: () => performance.now(), at: wallNow });
      return take(doorway.create({ context, credential: secretRef(profile.reference), profile,
        resolveProfile: () => profile, provider: doorway.provider, model: options.model, route: 'preview-subscription',
        disclosure: 'Subscription preview; charge UNKNOWN', activation: toolTurn ? toolsRecord : activation,
        framing, ...(toolTurn ? { toolTurn } : {}),
        journalEnd: () => journal.view.expires, io,
        now: wallNow, active: () => !workerStop.value && !existsSync(stopPath) && active() && !journal.view.stop,
        adapterEvidenceContract: contract,
        ...(journal.view.limits.maxBytes > doorway.policyFor(options.model, doorway.conversationFraming).maxPromptBytes
          ? { raisedPromptBytes: journal.view.limits.maxBytes, promptAuthority: journal.view.capAuthority } : {}) }));
    }
  } catch (error) { if (!signalled) { startupFailure = error; throw error; } }
  finally {
    try {
      // Rules 2, 42: a launch refused before it launched is still a launch with a recorded end. The
      // scrubbed reason is written while this process holds the root's writer lease (a composition or
      // lease refusal never reaches here, so it writes nothing); stderr and the fixed `reason` stay terse.
      if (launchedAt === null && startupFailure !== null) try {
        const at = wallNow(), detail = redact(String(startupFailure?.message ?? startupFailure)).text.split('\n')[0].slice(0, 240);
        appendRun(runsPath, { v: 1, launch: at, pid: process.pid });
        appendRun(runsPath, { v: 1, launch: at, exit: wallNow(), reason: 'refused before launch', refused: detail || 'unknown' });
      } catch { /* the refusal still exits non-zero; only its record is lost */ }
      if (journal && !journal.view.stop && !journal.readOnly && wallNow() >= journal.view.expires)
        journal.append({ kind: 'stop', reason: 'trial expired', at: wallNow() });
      if (launchedAt !== null) {
        const reason = signalName ? `paused by signal ${signalName}` : journal?.view.stop === 'trial expired' ? 'trial expired'
          : existsSync(stopPath) || journal?.view.stop ? 'operator stop latched' : endReason ?? 'error (details suppressed)';
        // Rule 68: eligible accepted work left behind is queued for the next launch unless a stop, expiry,
        // allowance or signal pause inhibits it; either way it stays visible, never counted as done.
        // Scheduled obligation work not yet due also needs a live runner when its time comes.
        let end = {};
        try {
          const health = journal ? loopHealth(journal.view, wallNow()) : null;
          const inhibited = pressureUnknown || signalName !== null || existsSync(stopPath) || journal?.view.stop || wallNow() >= (journal?.view.expires ?? 0)
            || journal && (journal.view.calls >= journal.view.limits.maxCalls || journal.view.replies >= journal.view.limits.maxReplies);
          // Every still-owned item counts: a result waiting for the next message and a dependency awaiting the
          // operator need a live runner as much as due or scheduled work does.
          const remaining = health ? health.ownedWork : 0;
          // Two machines: an owner that ends (its cycle limit, a lost lease) is wanted back as the standby and the peer copy.
          if (health) end = { unfinished: health.unfinished, revival: remaining === 0 && !multi ? 'none' : inhibited ? 'inhibited' : 'queued',
            ...(health.nextWorkAt === null ? {} : { nextWorkAt: health.nextWorkAt }),
            // Rule 33: the exact journal frontier this claim describes.
            frontier: projectionDigest(journal.view) };
        } catch { /* an exit without a disposition is revived by the host watcher as a crash */ }
        if (retiredReason) end = { ...end, retired: retiredReason };
        try { appendRun(runsPath, { v: 1, launch: launchedAt, exit: wallNow(), reason, ...end }); } catch { /* the next launch reports an unrecorded end */ }
      }
    } finally {
      // A delegated session never outlives the launch that owns it.
      try { sessionWork?.port.stop(); } catch { /* the driver's next boot sweep and stop authority find it */ }
      if (gate) { gate.closeAll(); await gate.stop(); }
      for (const proxy of stepEgress.values()) await proxy.close();
      stepEgress.clear();
      if (shared) await shared.stop();
      journal?.close(); storage.close(); if (ownerClaim?.owner) ownerClaim.release(); process.removeListener('SIGINT', signal); process.removeListener('SIGTERM', signal); process.removeListener('SIGHUP', signal);
    }
  }
}

try { await main(); } catch { process.stderr.write('preview refused to start or continue; details suppressed\n'); process.exitCode = 1; }
