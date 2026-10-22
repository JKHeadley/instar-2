/** Thin port of 1.x ChannelDriver/LiveTestRunner. The host owns provisioned demo
 * channels, credentials, bounded process execution and the existing five floors.
 * Import createDriver from the desk driver module; inject the existing host ports.
 * No HTTP endpoint, login pool, launcher or second send path is invented here. */
import { digest } from './runner.mjs';

function requireThat(condition, message) { if (!condition) throw Error(`harness-tax adapter: ${message}`); }

function distinctIdentities(before, after) {
  return typeof before === 'string' && before.trim().length > 0
    && typeof after === 'string' && after.trim().length > 0 && before !== after;
}

export function createDriver(host) {
  return { async execute(request, { signal } = {}) {
    request = { ...request, signal }; // host ports must honour cancellation and the installed stop latch
    // Resolve on every turn, not from labels in the config alone (Rule 26).
    const target = await host.inspect(request.target, request);
    requireThat(target.disposable && target.live === false && target.model === request.model, 'target is not an isolated matching-model instance');
    for (const key of ['root', 'login', 'bot', 'channel'])
      if (request.target[key] !== undefined) requireThat(target[key] === request.target[key], 'target identity changed');
    requireThat(['secrets', 'spendCap', 'stop', 'uniqueSend', 'durableIntake'].every(k => target.floors?.[k] === true), 'floor unavailable');
    requireThat(target.receipt && target.actualMachine && target.epoch, 'missing actual placement evidence');
    // Receipt must cover this particular target, request and selected model.
    const prepared = await host.prepare({ request, target,
      recipe: request.setup === 'bare' ? { scratch: true, emptyHome: true }
        : request.setup === 'instar1' ? { argv: ['instar', 'init', '--dir', target.root, '--framework', 'claude-code'], scratch: true }
          : { copyOfSanitizedRoot: true, ownBot: target.bot, ownLogin: target.login } });
    requireThat(prepared.requestId === request.id && prepared.receipt && prepared.model === request.model, 'preparation not evidenced');
    if (request.setup === 'instar2') requireThat(prepared.copyLineage && prepared.ablated?.join(',') === request.off.join(','), 'copy or ablation evidence missing');
    const boundary = await host.boundary(request.boundary, { request, target });
    const unsupported = boundary.state === 'unsupported';
    if (unsupported) {
      requireThat(boundary.receipt && boundary.actual === false && typeof boundary.reason === 'string' && boundary.reason.trim(),
        'unsupported boundary lacks evidence');
    } else {
      requireThat(boundary.receipt && boundary.actual === true, 'simulated boundary is not live evidence');
      if (request.boundary === 'move-machine') requireThat(distinctIdentities(boundary.beforeMachine, boundary.afterMachine), 'seat never moved');
      if (request.boundary === 'restart') requireThat(distinctIdentities(boundary.beforeEpoch, boundary.afterEpoch), 'process never restarted');
      if (request.boundary === 'compact') requireThat(distinctIdentities(boundary.beforeContext, boundary.afterContext), 'context was not compacted');
    }
    let observation;
    if (unsupported) {
      observation = { state: 'unsupported', model: target.model, boundary: request.boundary,
        reason: boundary.reason, evidence: [boundary.receipt] };
    } else if (request.prompt === null) {
      // Port collectMessages: read the entire window without a prompting message.
      observation = await host.collectMessages({ request, target, deadlineMs: request.deadlineMs });
      requireThat(observation.completeWindow === true, 'absence/due evidence incomplete');
    } else if (request.setup === 'bare') {
      observation = await host.executeBounded({ request, target,
        argv: ['claude', '-p', request.prompt, '--model', request.model, '--output-format', 'json'],
        cwd: target.root, deadlineMs: request.deadlineMs,
        // No automatic history recap: bare keeps only its own scratch files.
        emptyHome: true, inheritCredentials: false });
    } else {
      const sent = await host.sendAsDemoUser({ request, target, idempotencyKey: request.id });
      requireThat(sent.messageId && sent.receipt, 'send is uncertain');
      observation = await host.awaitReply({ request, target, afterMessageId: sent.messageId, deadlineMs: request.deadlineMs });
      requireThat(observation.inReplyTo === sent.messageId, 'reply is not correlated');
    }
    requireThat(observation.model === request.model, 'effective model changed');
    if (!unsupported && request.boundary === 'move-machine') requireThat(observation.responderMachine === boundary.afterMachine, 'reply did not come from destination');
    const meter = await host.meter({ request, target, prepared, boundary, observation });
    return { requestId: request.id, model: observation.model, state: observation.state,
      observation, evidence: [target.receipt, prepared.receipt, boundary.receipt, ...(observation.evidence ?? [])],
      breaches: meter.breaches, costs: meter.costs, totals: meter.totals,
      preparationDigest: digest(prepared) };
  } };
}
