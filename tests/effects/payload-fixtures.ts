import { decodeEffectPayload, effectPayloadIdentity } from '../../src/effects/index.js';
import type { EffectHost, TypedEffectPayload } from '../../src/effects/index.js';
import { captureHash, digest } from '../fixtures.js';
import { value } from './fixture.js';

export const payloadKinds = ['post-text', 'post-media', 'edit-message', 'react', 'create-topic', 'acknowledge',
  'fetch-inbound-media', 'derive-transcript', 'process-control', 'scheduler-control', 'account-route-change',
  'configuration-change', 'filesystem-mutation', 'git-mutation', 'infrastructure-notice'] as const;

export function payloadInput(kind: typeof payloadKinds[number], host: EffectHost): Record<string, unknown> {
  const common = { type: 'EffectPayload', schemaVersion: 1, kind, semanticMessage: 'semantic:typed:1', run: 'run:1',
    step: `step:${kind}`, sourceResult: 'five-owned pending and source result STAND-IN', logicalEffect: `logical:${kind}:1` };
  const conversation = { speaker: host.principal.id, account: 'bot:fixture', conversation: 'chat:fixture', purpose: 'required-action' };
  const sha = captureHash('prior');
  let fields: Record<string, unknown>;
  switch (kind) {
    case 'post-text': fields = { ...conversation, text: 'typed text' }; break;
    case 'post-media': fields = { ...conversation, caption: 'caption', attachments: [{ capture: { reference: 'capture:media', hash: captureHash('media') }, mediaType: 'image/png', bytes: 5, filename: 'image.png' }] }; break;
    case 'edit-message': fields = { ...conversation, targetMessage: 'message:7', text: 'corrected' }; break;
    case 'react': fields = { ...conversation, targetMessage: 'message:7', reaction: 'ok' }; break;
    case 'create-topic': fields = { ...conversation, parentConversation: 'chat:fixture', title: 'Topic', attributes: [{ key: 'color', value: 'blue' }] }; break;
    case 'acknowledge': fields = { ...conversation, inboundFact: 'intake:1', acknowledgment: 'reaction', value: 'ok', decorative: true }; break;
    case 'fetch-inbound-media': fields = { ...conversation, inboundReceipt: 'intake:1', platformFile: 'provider-file:1', maximumBytes: 8192, mediaTypes: ['image/png'] }; break;
    case 'derive-transcript': fields = { ...conversation, sourceCapture: { reference: 'capture:audio', hash: captureHash('audio') }, providerOperation: 'provider:transcribe', model: 'model:1', maximumOutputBytes: 8192, destinationStep: 'step:transcript', originatingIntake: 'intake:1' }; break;
    case 'process-control': fields = { action: 'terminate', machine: 'machine-a', processId: 'process:1', processIncarnation: 'process:1:incarnation:2', parentIdentity: 'parent:1', startIdentity: 'start:1', executable: '/usr/bin/node', arguments: ['worker.mjs'] }; break;
    case 'scheduler-control': fields = { action: 'pause', jobId: 'job:1', jobGeneration: 'job-generation:2', finiteScope: 'one-run', undoOperation: 'resume:job:1', reviewAt: 200 }; break;
    case 'account-route-change': fields = { routeRun: 'run:1', provider: 'telegram', fromAccount: 'bot:old', toAccount: 'bot:new', sourceGeneration: 'route-generation:2', rollbackRoute: 'route:old' }; break;
    case 'configuration-change': fields = { canonicalTarget: '/project/.instar/config.json', expectedPriorDigest: sha, proposedBytes: '{"enabled":true}', proposedDigest: digest('{"enabled":true}'), undoReference: 'capture:config-prior' }; break;
    case 'filesystem-mutation': fields = { action: 'replace', fileTargets: [{ canonicalPath: '/project/state.json', resolvedPath: '/project/state.json', ancestryDigest: sha, priorDigest: sha }], proposedBytes: '{}', proposedDigest: digest('{}'), undoSemantics: 'restore capture:prior', protectedTargetPolicy: 'policy:protected-targets:1' }; break;
    case 'git-mutation': fields = { action: 'commit', repository: '/project/repo', worktree: '/project/repo', ref: 'refs/heads/main', base: 'sha:base', targets: ['src/file.ts'], expectedHeads: [{ ref: 'refs/heads/main', digest: sha }], rollbackConstraints: ['only-if-head-unchanged'] }; break;
    case 'infrastructure-notice': fields = { notice: 'action-needed', infrastructureProvenance: 'monitor:watchdog:1', causalEpisode: 'episode:1', text: 'Process requires attention.' }; break;
  }
  const draft: Record<string, unknown> = { ...common, ...fields };
  return { ...draft, ...effectPayloadIdentity(draft as unknown as Parameters<typeof effectPayloadIdentity>[0]) };
}

export function payload(kind: typeof payloadKinds[number], host: EffectHost): TypedEffectPayload {
  return value(decodeEffectPayload(payloadInput(kind, host), host));
}
