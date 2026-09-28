// @ts-nocheck -- bounded child-process fixture for the real preview launcher.
import { expect, it } from 'vitest';
import { createDecipheriv } from 'node:crypto';
import { brotliDecompressSync } from 'node:zlib';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { successiveWorld, offlineProfile, OFFLINE_STORAGE_KEY } from './successive-fixture.js';

const operatorText = 'Please always answer briefly.';
const reply = 'Understood.';
const fenced = value => `\`\`\`json\n${value}\n\`\`\``;

it.each(['wrapped', 'reply-contradiction', 'summary-contradiction'])(
  'covers answer, full-context reply review, summary and summary review offline (%s)', async mode => {
    const world = successiveWorld(), root = join(world.directory, 'review-canary');
    const activation = join(world.directory, 'activation.json'), profile = join(world.directory, 'profile.json');
    const log = join(world.directory, 'poll.log'), updates = join(world.directory, 'updates.json');
    const calls = join(world.directory, 'calls.jsonl'), jev = join(world.directory, 'jev.jsonl');
    const provider = join(world.directory, 'provider.mjs'), loader = join(world.directory, 'loader.mjs');
    const preload = join(world.directory, 'no-network.cjs');
    writeFileSync(activation, JSON.stringify(world.activation()));
    writeFileSync(profile, JSON.stringify(offlineProfile));
    writeFileSync(updates, JSON.stringify([{ update_id: 1, message: {
      chat: { id: Number(world.configuration.chatId), type: 'private' },
      from: { id: Number(world.configuration.operatorSenderId) }, text: operatorText } }]));
    writeFileSync(preload, `const fs = require('node:fs');
global.fetch = async (url, init) => {
  if (String(url) !== 'https://api.typesafe.ai/v1/systemone') throw Error('offline canary: unexpected fetch');
  const input = JSON.parse(init.body), keys = Object.keys(input.questions);
  fs.appendFileSync(${JSON.stringify(jev)}, JSON.stringify({ keys, state: input.state }) + '\\n');
  const answers = Object.fromEntries(keys.map(key => [key, { type: 'noul',
    noul: key === 'lost_memory' ? 0.05 : 0.5 }]));
  return new Response(JSON.stringify({ model: 'jev-1.13.0', answers }),
    { status: 200, headers: { 'content-type': 'application/json' } });
};
`);
    writeFileSync(provider, `import { appendFileSync } from 'node:fs';
export { SUBSCRIPTION_CONVERSATION_FRAMING, subscriptionConversationPolicy,
  validateSubscriptionActivation } from ${JSON.stringify(pathToFileURL(join(process.cwd(), 'src/assembly/production-provider.ts')).href)};
const mode = ${JSON.stringify(mode)};
export const createClaudeCodeSubscriptionRoute = () => ({ kind: 'Success', value: { invoke: async prepared => {
  const envelope = JSON.parse(prepared), question = envelope.messages[0].content;
  const context = JSON.parse(envelope.messages[1].content), binding = context.bindings;
  const role = question.startsWith('Judge this proposed reply') ? 'reply-review'
    : question.startsWith('Review this rolling summary') ? 'summary-review'
    : question.startsWith('Summarize this preview conversation') ? 'summary' : 'answer';
  appendFileSync(${JSON.stringify(calls)}, JSON.stringify({ role, question, context: context.packet }) + '\\n');
  let value = role === 'answer' ? ${JSON.stringify(reply)}
    : role === 'summary' ? JSON.stringify({ summary: ${JSON.stringify(`${operatorText}\n${reply}`)},
        people: [], commitments: [], memory: [{ mode: 'prefer', source: context.packet.memoryRequest.id,
          quote: ${JSON.stringify(operatorText)} }] })
    : role === 'reply-review' ? 'PASS | The private reply is safe.'
    : JSON.stringify({ verdict: 'pass', reason: 'The preference and reply are covered.' });
  if (role === 'reply-review' && mode === 'reply-contradiction'
    || role === 'summary-review' && mode === 'summary-contradiction')
    value = 'VIOLATION: do not approve this output. ' + value;
  else if (role === 'summary-review') value = (${fenced.toString()})(value);
  const decision = JSON.stringify({ type: 'Decision', schemaVersion: 1, id: 'review-canary-' + role,
    at: binding.at, by: binding.by,
    conclusion: { subject: 'preview-stage2-answer', predicate: 'answer-text', value,
      evidence: binding.evidence },
    reason: { subject: 'question', predicate: 'answered', value: true, evidence: binding.evidence },
    floor: { allowed: binding.floor, chosen: binding.floor.default } });
  return { state: 'complete', bytes: (${fenced.toString()})(decision),
    usage: { inputTokens: 1, outputTokens: 1 } };
} } });
`);
    writeFileSync(loader, `export async function resolve(specifier, context, next) {
  if (context.parentURL?.endsWith('/journal-agent.mjs') && specifier.endsWith('/production-provider.js'))
    return { url: ${JSON.stringify(pathToFileURL(provider).href)}, shortCircuit: true };
  return next(specifier, context);
}\n`);
    const endpoint = spawn(process.execPath,
      [join(process.cwd(), 'tests/preview/journal-poll-endpoint.mjs'), log, updates],
      { stdio: ['ignore', 'pipe', 'pipe'] });
    try {
      const port = await new Promise((done, fail) => {
        endpoint.stdout.once('data', data => done(Number(String(data).trim())));
        endpoint.once('error', fail);
      });
      const trial = world.state().read().trial;
      const env = { ...process.env,
        INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(OFFLINE_STORAGE_KEY).toString('hex'),
        INSTAR_SECRET_PREVIEW_TYPESAFE_KEY: 'offline-test-only',
        INSTAR_SECRET_PREVIEW_TELEGRAM_BOT_TOKEN: '12345678:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        INSTAR_PREVIEW_TEST_TELEGRAM_ENDPOINT: `http://127.0.0.1:${port}` };
      const run = spawnSync(process.execPath, ['--no-warnings', '--require', preload,
        '--loader', './scripts/slice-ts-loader.mjs', '--loader', loader,
        'tests/preview/journal-agent.mjs', 'run', '--root', root,
        '--bot-id', world.configuration.botId, '--chat-id', world.configuration.chatId,
        '--operator-sender-id', world.configuration.operatorSenderId,
        '--grant-reference', trial.id, '--configuration-digest', trial.configurationDigest,
        '--expires-at', String(trial.expiresAt), '--activation-record', activation,
        '--login-profile', profile, '--model', world.model,
        '--bot-username', world.configuration.botUsername, '--max-cycles',
        mode === 'summary-contradiction' ? '1' : '3', '--max-poll-seconds', '1'],
      { cwd: process.cwd(), encoding: 'utf8', timeout: 20000, env });
      expect(run.status, run.stderr).toBe(0);
      const rows = readFileSync(calls, 'utf8').trim().split('\n').map(line => JSON.parse(line));
      const roles = rows.map(row => row.role);
      expect(roles).toEqual(mode === 'summary-contradiction'
        ? ['summary', 'summary-review', 'summary', 'summary-review']
        : ['summary', 'summary-review', 'answer', 'reply-review']);
      if (mode !== 'summary-contradiction')
        expect(rows.find(row => row.role === 'reply-review').context).toMatchObject({
          operatorMessage: operatorText, candidateReply: `PREVIEW — ${reply}`,
          audience: { surface: 'telegram-private-chat' },
          preferences: expect.arrayContaining([expect.objectContaining({ text: operatorText })]) });
      expect(rows.find(row => row.role === 'summary-review').context).toMatchObject({
        packet: expect.objectContaining({ history: expect.arrayContaining([
          expect.objectContaining({ user: operatorText })]) }),
        proposed: expect.objectContaining({ summary: expect.stringContaining(operatorText) }) });
      const jevRows = readFileSync(jev, 'utf8').trim().split('\n').map(line => JSON.parse(line));
      expect(jevRows.map(row => row.keys)).toEqual(expect.arrayContaining([
        ['lost_memory'], ['summary_integrity'] ]));
      const sends = existsSync(`${log}.sends`) ? readFileSync(`${log}.sends`, 'utf8').trim().split('\n').map(JSON.parse) : [];
      const status = spawnSync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
        'tests/preview/journal-agent.mjs', 'status', '--root', root],
      { cwd: process.cwd(), encoding: 'utf8', timeout: 10000, env });
      expect(status.status, status.stderr).toBe(0);
      const view = JSON.parse(status.stdout);
      expect(view.calls).toBe(4);
      const sealed = readFileSync(join(root, 'journal.encrypted'));
      const evidence = [];
      for (let offset = 0; offset < sealed.length;) {
        const length = sealed.readUInt32BE(offset);
        const bytes = sealed.subarray(offset + 4, offset + 4 + length);
        const cipher = createDecipheriv('aes-256-gcm', OFFLINE_STORAGE_KEY, bytes.subarray(0, 12));
        cipher.setAAD(Buffer.from(`preview-journal:${offset}`));
        cipher.setAuthTag(bytes.subarray(12, 28));
        const plain = Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]);
        // A leading 1 marks a brotli-compressed frame (journal-growth); legacy frames are plain JSON.
        evidence.push(JSON.parse((plain[0] === 1 ? brotliDecompressSync(plain.subarray(1)) : plain).toString('utf8')));
        offset += 4 + length;
      }
      const metered = evidence.filter(row => {
        const usage = row.usage ?? row.result?.usage ?? row.faithfulness?.usage;
        return usage?.inputTokens === 1 && usage?.outputTokens === 1;
      });
      // int11 keeps the returned usage on the review-state record and on the successful
      // reply-check result (settlement is idempotent per reservation), so a passing
      // review carries one extra metered row.
      expect(metered).toHaveLength(mode === 'wrapped' ? 5 : 4);
      if (mode !== 'summary-contradiction') {
        expect(evidence.filter(row => row.kind === 'reply-review-state' && row.usage?.inputTokens === 1
          && row.usage?.outputTokens === 1)).toHaveLength(1);
        expect(evidence.filter(row => row.kind === 'reply-check' && row.result.path === 'subscription'
          && row.result.usage)).toHaveLength(mode === 'wrapped' ? 1 : 0);
        expect(evidence.filter(row => row.kind === 'reply-check' && row.result.path === 'subscription')
          .map(row => row.result.verdict)).toEqual([mode === 'wrapped' ? 'pass' : 'unavailable']);
      }
      expect(view.modelJsonShapes.counts).toMatchObject(mode === 'summary-contradiction'
        ? { 'answer/decision/tolerated/fenced': 2, 'summary-review/decision/tolerated/fenced': 2 }
        : { 'answer/decision/tolerated/fenced': 2,
          'reply-review/decision/tolerated/fenced': 1,
          'summary-review/decision/tolerated/fenced': 1 });
      if (mode === 'wrapped') {
        expect(sends.map(send => send.text)).toEqual([`PREVIEW — ${reply}`]);
        expect(view.summaries).toHaveLength(1);
        expect(view.summaryChecks.pass).toBe(1);
        // int11's reply verdict is one exact line, so no JSON wrapper is tolerated or recorded.
        expect(Object.keys(view.modelJsonShapes.counts).filter(key => key.startsWith('reply-review/verdict'))).toEqual([]);
      } else {
        // A contradicted reply review is unavailable, never a pass nor a veto: the reply is sent
        // once with the review recorded (Rules 77, 86, 95).
        expect(sends).toHaveLength(mode === 'reply-contradiction' ? 1 : 0);
        expect(view.modelJsonShapes.counts).toMatchObject({
          [mode === 'reply-contradiction' ? 'reply-review/verdict/malformed/not-json'
            : 'summary-review/verdict/malformed/prose-wrapped']:
            mode === 'summary-contradiction' ? 2 : 1 });
        if (mode === 'summary-contradiction') {
          expect(view.summaries).toHaveLength(0);
          expect(view.summaryChecks.violation).toBe(0);
          expect(view.summaryChecks.unavailable).toBe(2);
        }
      }
    } finally { endpoint.kill('SIGTERM'); }
  }, 30000);
