import { assessTelegramReplyResponse, renderTelegramDeliveryStatus } from '../../src/conversation/index.js';
import type { TelegramProviderAcceptance } from '../../src/conversation/index.js';
import type { Result } from '../../src/index.js';
import { value } from '../effects/fixture.js';
import { conversationFixture } from './fixture.js';
import { telegramResponseAssessmentFixture } from './round17-fixture.js';

interface Round24Result {
  readonly name: string;
  readonly reuse?: boolean;
  readonly expected: 'Success' | 'Refused';
  readonly actual: Result<unknown>['kind'];
  readonly detail: string;
  readonly appended: number;
  readonly providerCalls: number;
}

const definitionMutations = [
  ['control', {}],
  ['schemaVersion', { schemaVersion: 99 }],
  ['speaker', { speaker: 'unrecorded-speaker' }],
  ['scopeDigest', { scopeDigest: `sha256:${'0'.repeat(64)}` }],
  ['maxBytes', { maxBytes: 1 }],
  ['durability', { durability: 'local-durable', replicas: 0 }],
  ['generation', { generation: 'unrecorded-generation' }],
  ['extra', { unexpected: 'unrecorded-field' }],
  ['adapter', { adapter: 'other-adapter' }],
] as const;

/** Permanent import of rereview22's independent-validation.ts 21-case matrix. */
export function round24IndependentValidationMatrix(): readonly Round24Result[] {
  const rows: Round24Result[] = [];
  for (const reuse of [false, true]) for (const [name, patch] of definitionMutations) {
    const fixture = telegramResponseAssessmentFixture();
    const initial = reuse ? value(assessTelegramReplyResponse({
      effect: fixture.effect, claim: 'provider-accepted', existing: null,
    }, fixture.dependencies)) : null;
    const before = fixture.verification.rows.length;
    const result = assessTelegramReplyResponse({
      effect: fixture.effect, claim: 'provider-accepted', existing: initial?.assessment ?? null,
    }, { ...fixture.dependencies, definition: {
      ...fixture.dependencies.definition, ...patch,
    } as unknown as typeof fixture.dependencies.definition });
    rows.push({
      name: `definition.${name}`, reuse,
      expected: name === 'control' ? 'Success' : 'Refused', actual: result.kind,
      detail: result.kind === 'Refused' ? result.detail : '',
      appended: fixture.verification.rows.length - before,
      providerCalls: fixture.telegram.calls.send.length,
    });
  }

  const fixture = telegramResponseAssessmentFixture();
  const accepted = value(assessTelegramReplyResponse({
    effect: fixture.effect, claim: 'provider-accepted', existing: null,
  }, fixture.dependencies));
  for (const [name, input] of [
    ['control', accepted],
    ['unrecorded-references', {
      ...accepted,
      assessment: { owner: 'part-nine', name: 'VerificationAssessment', id: 'fact:never-recorded' },
      observation: 'observation:never-recorded', evidence: ['evidence:never-recorded'],
    }],
    ['mismatched-route', {
      ...accepted, account: 'other-account', conversation: 'other-conversation',
      operation: 'other-operation', digest: `sha256:${'0'.repeat(64)}`,
    }],
  ] as const) {
    const result = renderTelegramDeliveryStatus(input as TelegramProviderAcceptance, 'word',
      fixture.dependencies.boundary);
    rows.push({
      name: `status.${name}`, expected: name === 'control' ? 'Success' : 'Refused',
      actual: result.kind, detail: result.kind === 'Refused' ? result.detail : '',
      appended: 0, providerCalls: fixture.telegram.calls.send.length,
    });
  }
  return rows;
}

/** Standalone rereview22 unwitnessed-status.ts neighbor: no assessment ran in this boundary. */
export function round24UnwitnessedStatuses(): readonly Result<unknown>[] {
  const fixture = conversationFixture();
  const input = {
    stage: 'provider-accepted', sourceStage: 'response',
    assessment: { owner: 'part-nine', name: 'VerificationAssessment', id: 'fact:never-recorded' },
    operation: 'operation:never-recorded', account: fixture.admitted.account,
    conversation: 'conversation:never-recorded', digest: `sha256:${'0'.repeat(64)}`,
    observation: 'observation:never-recorded', evidence: ['evidence:never-recorded'],
    unsupported: ['human-delivered', 'human-read'],
  } as TelegramProviderAcceptance;
  return (['word', 'emoji'] as const).map(form =>
    renderTelegramDeliveryStatus(input, form, fixture.admissionDependencies.boundary));
}
