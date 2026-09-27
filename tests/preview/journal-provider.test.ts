// @ts-nocheck -- the subscription IO is replaced only in this offline contract test.
import { expect, it } from 'vitest';
import { createClaudeCodeSubscriptionRoute, SUBSCRIPTION_CONVERSATION_FRAMING,
  subscriptionConversationPolicy } from '../../src/assembly/production-provider.js';
import { offlineProfile, successiveWorld } from './successive-fixture.js';
import { encoded } from './stage2-provider.js';

it('invokes the existing subscription route with one bounded prepared journal envelope and UNKNOWN charge', async () => {
  const world = successiveWorld(), model = world.model, policy = subscriptionConversationPolicy(model);
  const activation = world.activation(), now = 1790000002000;
  const context = { site: 'preview.journal', preserved: 'preview:test', register: {
    generation: { owner: 'part-three', name: 'RegisterGeneration', id: 'preview:register' },
    entries: ['preview.journal', 'preview', 'host'], producers: ['host'], methods: [], actions: {}, subjects: {},
    sites: { 'preview.journal': 'closed', 'types.decode': 'closed' }, keys: {}, allowRedelegation: false,
    conflictStanding: { ordinary: 'delegate', authority: 'operator' } }, captures: {} };
  const contract = { reference: activation.reference, version: activation.profileDigest,
    parserReference: 'claude-code-json-result', parserVersion: '1', endpoint: offlineProfile.loginProfileIdentity,
    account: offlineProfile.expectedAccount, credentialReference: offlineProfile.reference,
    controller: 'preview-journal', sourceEvidence: [activation.reference], terminalEvidence: activation.reference,
    terminalReasonField: 'subtype', successfulFinalReplyReasons: ['success'], strength: 'attestation',
    maxMetadataBytes: policy.maxMetadataBytes, maxRawTerminalBytes: policy.maxRawTerminalBytes,
    maxCaptureBytes: policy.maxCaptureBytes };
  let modelCalls = 0, outcome = 'success';
  const io = { realpath: path => path,
    executableBytes: () => Buffer.from('offline executable bytes'),
    inspectSubscriptionProfile: profile => ({ loginProfileIdentity: profile.loginProfileIdentity,
      managedConfigurationDigest: profile.managedConfigurationDigest }),
    execute: async command => {
      let stdout;
      if (command.args[0] === '--version') stdout = '2.1.280 (Claude Code)';
      else if (command.args[0] === 'auth') stdout = JSON.stringify({ loggedIn: true, authMethod: 'claude.ai',
        apiProvider: 'firstParty', analyticsDisabled: true, projectsDirectory: `${offlineProfile.configDirectory}/projects`,
        configDirectory: offlineProfile.configDirectory, email: offlineProfile.expectedAccount,
        orgId: offlineProfile.organization, orgName: 'Offline', subscriptionType: 'max' });
      else { modelCalls++;
        expect(command.args).toEqual(policy.args);
        expect(command.env.CLAUDE_CODE_MAX_OUTPUT_TOKENS).toBe('2048');
        expect(command.env.MAX_THINKING_TOKENS).toBe('0');
        expect(command.timeout).toBe(120000);
        expect(command.stdin).toContain('early memory');
        const decision = { type: 'Decision', schemaVersion: 1, id: 'offline-journal-answer',
          conclusion: { subject: 'preview-stage2-answer', value: 'remembered' } };
        if (outcome === 'throw') throw Error('invocation failed after dispatch');
        stdout = outcome === 'failure' || outcome === 'usage-limit' ? JSON.stringify({ type: 'result', subtype: 'success', is_error: true,
          result: outcome === 'usage-limit' ? "You've reached your usage limit; resets in 3 hours" : 'provider refusal text', session_id: 'journal-offline-failed-call',
          usage: { input_tokens: 8, output_tokens: 0 } })
          : outcome === 'empty' ? JSON.stringify({ type: 'result', subtype: 'success', is_error: false,
            result: '', session_id: 'journal-offline-empty-call', usage: { input_tokens: 8, output_tokens: 0 } })
          : outcome.startsWith('bare') ? '' : JSON.stringify({ type: 'result', subtype: outcome === 'subtype-error' ? 'error_max_turns' : 'success', is_error: false,
            result: outcome === 'oversized-answer' ? 'x'.repeat(policy.maxOutputBytes + 1) : JSON.stringify(decision), session_id: 'journal-offline-call-1',
            usage: { input_tokens: 8, output_tokens: outcome === 'over-cap' ? 2049 : 3 } });
        if (outcome === 'invalid-frame') stdout = JSON.stringify({ type: 'result', subtype: 'success', is_error: false,
          result: JSON.stringify(decision), usage: { input_tokens: 8, output_tokens: 3 } });
      }
      if (outcome === 'timeout' && command.args.includes('--print'))
        return { code: null, limited: true, localLimit: 'timeout', stdout: '', stdoutBytes: new Uint8Array() };
      return { code: command.args.includes('--print') && (outcome === 'failure' || outcome === 'usage-limit' || outcome === 'bare1') ? 1 : 0,
        limited: false, stdout, stdoutBytes: new Uint8Array(Buffer.from(stdout)) };
    } };
  const route = createClaudeCodeSubscriptionRoute({ context, credential: { type: 'SecretRef', schemaVersion: 1,
    vault: 'preview', name: offlineProfile.reference }, profile: offlineProfile, resolveProfile: () => offlineProfile,
    provider: 'anthropic', model, route: 'preview-subscription', disclosure: 'Subscription preview; charge UNKNOWN',
    activation, framing: SUBSCRIPTION_CONVERSATION_FRAMING, io, now: () => now, active: () => true,
    adapterEvidenceContract: contract });
  expect(route.kind === 'Success' ? 'Success' : route.detail).toBe('Success');
  if (route.kind !== 'Success') return;
  const bytes = encoded({ provider: 'anthropic', model, route: 'preview-subscription',
    messages: [{role:'user',content:'What was first?'},{role:'context',content:'early memory'}],
    attachments: [], tools: [], settings: {automaticRetries:0,maxTokens:policy.maxTokens},
    outputSchema: {type:'Decision'},floor:{actions:['work']},evidence:['turn:1'],point:'judgment',generation:'trial' }).bytes;
  const result = await route.value.invoke(bytes, {operation:'turn:1',deadline:now+180000,
    timeout:policy.timeout,maxOutputBytes:policy.maxOutputBytes,maxTokens:policy.maxTokens,
    maxCharge:0,automaticRetries:0});
  expect(result.state).toBe('complete');
  expect(result.usage).toMatchObject({inputTokens:8,outputTokens:3,charge:null});
  expect(modelCalls).toBe(1);
  outcome = 'failure';
  expect(await route.value.invoke(bytes, {operation:'turn:2',deadline:now+180000,
    timeout:policy.timeout,maxOutputBytes:policy.maxOutputBytes,maxTokens:policy.maxTokens,
    maxCharge:0,automaticRetries:0})).toMatchObject({state:'rejected',bytes:null,
      providerOperation:'journal-offline-failed-call',usage:{inputTokens:8,outputTokens:0,charge:null}});
  outcome = 'usage-limit';
  expect(await route.value.invoke(bytes, {operation:'turn:usage-limit',deadline:now+180000,
    timeout:policy.timeout,maxOutputBytes:policy.maxOutputBytes,maxTokens:policy.maxTokens,
    maxCharge:0,automaticRetries:0})).toMatchObject({state:'rejected',bytes:null});
  outcome = 'subtype-error';
  expect(await route.value.invoke(bytes, {operation:'turn:subtype-error',deadline:now+180000,
    timeout:policy.timeout,maxOutputBytes:policy.maxOutputBytes,maxTokens:policy.maxTokens,
    maxCharge:0,automaticRetries:0})).toMatchObject({state:'rejected',bytes:null});
  outcome = 'empty';
  expect(await route.value.invoke(bytes, {operation:'turn:empty',deadline:now+180000,
    timeout:policy.timeout,maxOutputBytes:policy.maxOutputBytes,maxTokens:policy.maxTokens,
    maxCharge:0,automaticRetries:0})).toMatchObject({state:'complete',bytes:''});
  outcome = 'over-cap';
  expect(await route.value.invoke(bytes, {operation:'turn:over-cap',deadline:now+180000,
    timeout:policy.timeout,maxOutputBytes:policy.maxOutputBytes,maxTokens:policy.maxTokens,
    maxCharge:0,automaticRetries:0})).toMatchObject({state:'rejected',bytes:null,
      usage:{outputTokens:2049}});
  outcome = 'oversized-answer';
  expect(await route.value.invoke(bytes, {operation:'turn:oversized-answer',deadline:now+180000,
    timeout:policy.timeout,maxOutputBytes:policy.maxOutputBytes,maxTokens:policy.maxTokens,
    maxCharge:0,automaticRetries:0})).toMatchObject({state:'rejected',bytes:null});
  outcome = 'timeout';
  expect(await route.value.invoke(bytes, {operation:'turn:timeout',deadline:now+180000,
    timeout:policy.timeout,maxOutputBytes:policy.maxOutputBytes,maxTokens:policy.maxTokens,
    maxCharge:0,automaticRetries:0})).toMatchObject({state:'uncertain',bytes:null});
  for (const [next, operation] of [['bare0','turn:3'],['bare1','turn:4'],['throw','turn:5'],['invalid-frame','turn:6']]) {
    outcome = next;
    expect((await route.value.invoke(bytes, {operation,deadline:now+180000,
      timeout:policy.timeout,maxOutputBytes:policy.maxOutputBytes,maxTokens:policy.maxTokens,
      maxCharge:0,automaticRetries:0})).state).toBe('uncertain');
  }
  expect(modelCalls).toBe(12);
});
