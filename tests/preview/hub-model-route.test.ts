import { it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHubModelRoute } from './hub-model-route.js';
import { hubIntentRequest } from './hub-model-contract.js';
import { openPreviewJournal } from './journal.js';
import { subscriptionConversationPolicy } from '../../src/assembly/production-provider.js';

it('retains a single charged invocation across loss, refuses current stop and bad bounds, and cannot dispatch after replication consumes its lifetime', async () => {
  const root = mkdtempSync(join(tmpdir(), 'hub-route-')), key = new Uint8Array(32).fill(4);
  const path = join(root, 'journal');
  let journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321',
    grant: 'isolated', configurationDigest: 'sha256:offline', expires: 100000, maxCalls: 3, maxReplies: 8,
    maxTurns: 8, maxBytes: 32768, cursor: 0 });
  let at = 1000, owner = true, delay = 0, fail = true, calls = 0;
  const policy = subscriptionConversationPolicy('claude-sonnet-4-6');
  const route = () => createHubModelRoute({ view: () => journal.view, now: () => at, admitted: () => owner,
    append: row => journal.append(row), model: 'claude-sonnet-4-6', policy,
    replicated: async () => { at += delay; return true; }, recordedCall: async (_judgment, _bytes, bounds) => {
      calls++; expect(bounds).toMatchObject({ timeout: 4000, maxTokens: 200, maxCharge: 0, automaticRetries: 0 });
      if (fail) throw Error('lost provider result');
      return { state: 'complete', bytes: '{"intent":"none","confidence":0}', providerOperation: null, retryBlocked: false,
        usage: { inputTokens: 50, outputTokens: 12, inputComplete: true, charge: null, source: 'isolated test' } };
    } });
  const request = hubIntentRequest('open this', [], []).request;
  try {
    for (const changed of [{ maxTokens: 4096 }, { timeoutMs: 4001 }, { promptId: 'forged' }])
      expect(await route()('bad', { ...request, ...changed })).toBeNull();
    owner = false; expect(await route()('stopped', request)).toBeNull(); owner = true;
    expect(calls).toBe(0); expect(journal.view.calls).toBe(0);
    expect(await route()('lost', request)).toBeNull(); expect(calls).toBe(1);
    journal.close(); journal = openPreviewJournal(path, key);
    expect(await route()('lost', request)).toBeNull(); expect(calls).toBe(1);
    expect(journal.view.tokenTotals.replyCheck.unknownCalls).toBe(1);
    delay = 4000; expect(await route()('late', request)).toBeNull(); expect(calls).toBe(1);
    delay = 0; fail = false;
    expect(await route()('positive', request)).toContain('"none"');
    expect(calls).toBe(2); expect(journal.view.calls).toBe(3);
    await expect(route()('over-cap', request)).rejects.toThrow(/allowance/);
    expect(calls).toBe(2);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});
