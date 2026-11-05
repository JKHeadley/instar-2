import { createHubModelRoute } from './hub-model-route.js';
import { subscriptionConversationPolicy } from '../../src/assembly/production-provider.js';
/** Exact private Studio capture replay. No provider/network calls. Raw authored
 * corpus and outputs stay in the private evidence directory; only hashes ship.
 * Run INSTAR_HUB_CAPTURE_ROOT=<capture directory> vitest ... on either host.
 * Absent evidence skips visibly and cannot certify the model-facing path.
 */
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openPreviewJournal } from './journal.js';
import { CollaborationSurfacer, type HubEffect } from './collaboration-hub.js';
import { hubIntentRequest, briefRequest, conversationBrief, type ConversationTurn, type BriefMessageRow } from './hub-model-contract.js';
const captureRoot = process.env.INSTAR_HUB_CAPTURE_ROOT;
const hashes: Record<string, string> = {
  "repaired/ambiguous-consumer.json": "567b397b67802d6940b474e66f663108fef93591d0bc35e7436050ffad85813e",
  "repaired/ambiguous-input.json": "b3d05d53ddfcd97b1a7453ee877efb9d73d83d25e7598b26dde39392b02e1142",
  "repaired/ambiguous-raw.json": "8fe7fcc8b0163462a5cd7372fb0044fc833a2da1cf31571888126ecfeb54c882",
  "repaired/brief-consumer.json": "e0e4e5ee80c0bfbfde3e650d138c0c6392eadad9f4d5ea90d5424d5dd370d0d6",
  "repaired/brief-input.json": "2ca92d3479df551fca884700fcd0c3eef7da8bc26121b2d2b8333478a5872131",
  "repaired/brief-raw.json": "5386bbcef3aee9f4a6a4a5ab9fa46ee6a0270d54156e5f1c3454546dd082052e",
  "repaired/brief-vocabulary-consumer.json": "3609819bb4a4260b27f1ec209d1871d7d9a2a39a28a1c6d166621a103b40cbb3",
  "repaired/brief-vocabulary-input.json": "8289215ba7fb15176e75449d6eaef9d0d5ac590b9c05637a09a7c67029450b17",
  "repaired/brief-vocabulary-raw.json": "c0f9f25fe0f7326706406c85b79eae7f220e2a82bb9370cade0ac4a3f91fecb5",
  "repaired/discussion-consumer.json": "60c6d4707f730aa9cb81d9ef2320cb6f76296fc93209bca494471c0919523a10",
  "repaired/discussion-input.json": "3ff8f70a15d40d1e2687ad26445b474cbccba152880f3f792f4a9623db77a46e",
  "repaired/discussion-raw.json": "c19ac7149acc79bc5fad3a1a4d63722b228d15f22990ee569870697f621c5a9b",
  "repaired/open-consumer.json": "d8abf4fdce9d648c35ee5bd18808a3db6bbee2173c821aef23a04b652822d829",
  "repaired/open-input.json": "d60e35fe95fb37fd02f9108aaa4be5e25a5fd225c238c27c823dfac3b68b1f65",
  "repaired/open-raw.json": "96d6ce5c1b3086cbf42dac4fa8e6c9d54dc911f55ca3b79275ca34b25fc4f167",
  "repaired/tie-consumer.json": "7afc13d5999e0fd104a72b9eecb5b4e1209805bc5a77e47aa3ef3e7a11a1adf5",
  "repaired/tie-input.json": "b57b33a3fe6eb20ce0f041e3246b049adfcc57887acd5ef4c9d36e21ec930fd1",
  "repaired/tie-raw.json": "047c2b9a025eb6d076fc90589accaf13d6361e9f4457e49625c1b0dcb656d68c"
};
function read<T>(file: string): T {
  const bytes = readFileSync(join(captureRoot!, file));
  expect(createHash('sha256').update(bytes).digest('hex'), file).toBe(hashes[file]);
  return JSON.parse(bytes.toString()) as T;
}
interface Consumer { case: { text?: string; conversationContext?: ConversationTurn[]; messages?: BriefMessageRow[] };
  result: { isCommand?: boolean; intent?: string; targetTopicId?: number; topicName?: string; summary?: string; nameSource?: string; summarySource?: string } }
const topics = [{ topicId: 101, topicName: 'roadmap' }, { topicId: 202, topicName: 'GrowthBook rollout' }, { topicId: 303, topicName: 'infra' }];
describe.skipIf(!captureRoot)('Studio 2026-11-05 isolated actual-provider bytes (no live-user update IDs)', () => {
  for (const id of ['open', 'tie', 'discussion', 'ambiguous', 'brief', 'brief-vocabulary']) it(`replays ${id} through the binding consumer`, async () => {
    const recorded = read<Consumer>(`repaired/${id}-consumer.json`);
    const raw = read<{ raw: string }>(`repaired/${id}-raw.json`).raw;
    const request = read<{ prompt: string }>(`repaired/${id}-input.json`);
    const briefCase = id.startsWith('brief');
    const brief = briefCase ? recorded : read<Consumer>('repaired/brief-consumer.json');
    const briefRaw = briefCase ? raw : read<{ raw: string }>('repaired/brief-raw.json').raw;
    const openRaw = read<{ raw: string }>('repaired/open-raw.json').raw;
    const rows = brief.case.messages!;
    if (briefCase) {
      expect(briefRequest(rows).prompt).toBe(request.prompt);
      expect(conversationBrief({ threadId: 'captured', conversation: { remoteAgent: 'Fixture peer' }, messages: rows, raw }))
        .toMatchObject({ topicName: recorded.result.topicName, summary: recorded.result.summary,
          nameSource: recorded.result.nameSource, summarySource: recorded.result.summarySource });
    } else expect(hubIntentRequest(recorded.case.text!, recorded.case.conversationContext ?? [], topics).request.prompt).toBe(request.prompt);
    const root = mkdtempSync(join(tmpdir(), 'hub-recorded-'));
    const journal = openPreviewJournal(join(root, 'journal'), new Uint8Array(32).fill(9), {
      kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321', grant: 'recorded-hub',
      configurationDigest: 'sha256:offline', expires: 9_999_999_999_999, maxCalls: 16, maxReplies: 16, maxTurns: 20, maxBytes: 32768, cursor: 0 });
    const effects: HubEffect[] = [];
    const hub = new CollaborationSurfacer({ state: () => journal.view.collaboration, append: row => journal.append(row), now: () => 1000,
      admitted: () => true, replicated: async () => true, operator: receipt => receipt === 'fixture-verified', topics: () => topics,
      effect: async (_key, effect) => { effects.push(effect); return { kind: 'accepted', id: effect.kind === 'topic' ? 500 + effects.length : effects.length }; } });
    try {
      await hub.surface({ threadId: 'captured', senderName: 'Fixture peer', text: 'Captured authored corpus', warrants: true, hasParentTopic: false });
      const invocations: { maxTokens: number; timeout: number; deadline: number }[] = [];
      const route = createHubModelRoute({ view: () => journal.view, now: () => 1000, admitted: () => true,
        replicated: async () => true, append: row => journal.append(row), model: 'claude-sonnet-4-6',
        policy: subscriptionConversationPolicy('claude-sonnet-4-6'), recordedCall: async (judgment, bytes, bounds) => {
          invocations.push(bounds);
          const envelope = JSON.parse(bytes);
          const expected = judgment === 'hub-intent' ? hubIntentRequest(briefCase ? 'open this' : recorded.case.text!,
            briefCase ? [] : recorded.case.conversationContext ?? [], topics).request.prompt : briefRequest(rows).prompt;
          expect(envelope.messages[0].content).toBe(expected);
          expect(envelope.settings.maxTokens).toBe(bounds.maxTokens);
          expect(envelope.messages.some((message: { role: string }) => message.role === 'instructions')).toBe(false);
          return { state: 'complete', bytes: judgment === 'hub-intent' ? (briefCase ? openRaw : raw) : briefRaw,
            providerOperation: null, retryBlocked: false,
            usage: { inputTokens: null, outputTokens: null, charge: null, source: 'recorded corpus replay; usage not inferred' } };
        } });
      const result = await hub.command({ id, operatorReceipt: 'fixture-verified', text: briefCase ? 'open this' : recorded.case.text!, context: briefCase ? [] : recorded.case.conversationContext ?? [] }, route, () => rows);
      expect(invocations[0]).toMatchObject({ maxTokens: 200, timeout: 4000, deadline: 5000 });
      if (briefCase || id === 'open') expect(invocations[1]).toMatchObject({ maxTokens: 320, timeout: 15000, deadline: 16000 });
      expect(journal.view.calls).toBe(invocations.length);
      expect(journal.view.collaboration?.modelCalls?.every(call => call.settled)).toBe(true);
      expect(result.handled).toBe(briefCase || recorded.result.isCommand);
      if (id === 'tie') expect(hub.list().threads[0]?.parent).toBe(recorded.result.targetTopicId);
      else if (briefCase || id === 'open') expect(effects.at(-1)).toMatchObject({ kind: 'message', text: brief.result.summary });
      else { expect(hub.list().threads[0]?.parent).toBeNull(); expect(effects).toHaveLength(2); }
    } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
  });
});
