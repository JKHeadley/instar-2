import { describe, expect, it } from 'vitest';
import { codexConversationRequests as requests, createCodexTurnReader } from '../../src/harness-adapters/codex-conversation.js';
import captured from './fixtures/codex-app-server-0.156.1.json' with { type: 'json' };

const options = { cwd: '/tmp/worker', model: 'gpt-5.6-sol', approvalPolicy: 'never' as const,
  sandbox: 'read-only' as const, config: { model_provider: 'checkpoint',
    'hooks.PreToolUse': [{ matcher: '*', hooks: [{ type: 'command', command: '/owned/admit pre' }] }],
    'mcp_servers.account': { command: '/owned/credential-reference-launcher', args: ['account-ref'] } } };
const item = (text: string, phase: string | null = 'final_answer', id = 'answer') => ({ method: 'item/completed',
  params: { threadId: 'thread', turnId: 'turn', item: { type: 'agentMessage', id, text, phase } } });
const done = (status = 'completed') => ({ method: 'turn/completed',
  params: { threadId: 'thread', turn: { id: 'turn', status, items: [] } } });

describe('Codex continuing conversation protocol', () => {
  it('maps handshake, persistent start/resume and exact interruption with prepared hooks/accounts', () => {
    expect(requests.initialize().method).toBe('initialize');
    expect(requests.initialized()).toEqual({ method: 'initialized', params: {} });
    expect(requests.start(options)).toEqual({ method: 'thread/start', params: { ...options, ephemeral: false } });
    expect(requests.resume('thread', options)).toEqual({ method: 'thread/resume', params: { ...options, threadId: 'thread', excludeTurns: true } });
    expect(requests.interrupt('thread', 'turn')).toEqual({ method: 'turn/interrupt', params: { threadId: 'thread', turnId: 'turn' } });
  });
  it('a fake harness accepts successive messages in one thread without reinitialization', () => {
    const received: string[] = [];
    const fake = (request: ReturnType<typeof requests.deliver>, turnId: string) => {
      expect(request.method).toBe('turn/start'); expect(request.params.threadId).toBe('thread');
      received.push(JSON.stringify(request.params.input));
      const reader = createCodexTurnReader('thread', turnId);
      reader.consume({ ...item('reply'), params: { ...item('reply').params, turnId } });
      return reader.consume({ method: 'turn/completed', params: { threadId: 'thread', turn: { id: turnId, status: 'completed' } } });
    };
    expect(fake(requests.deliver('thread', 'first'), 'turn1').reply).toBe('reply');
    expect(fake(requests.deliver('thread', 'second\nmessage'), 'turn2').reply).toBe('reply');
    expect(received).toHaveLength(2); expect(received[1]).toContain('second\\nmessage');
  });
  it('rejects invalid request identities, scopes and bounds without dispatching', () => {
    expect(() => requests.resume('', options)).toThrow();
    expect(() => requests.start({ ...options, cwd: '/tmp/../escape' })).toThrow();
    expect(() => requests.deliver('thread', ' ')).toThrow();
    expect(() => requests.deliver('thread', '🙂'.repeat(32001))).toThrow();
    expect(requests.deliver('thread', '🙂'.repeat(32000)).method).toBe('turn/start');
    expect(() => requests.interrupt('thread', '../wrong')).toThrow();
    expect(() => createCodexTurnReader('thread', 'turn', 0)).toThrow();
  });
  it('replays real binary captures: completed and failed turns, including duplicated output before failure', () => {
    let completed = 0, failed = 0;
    for (const run of captured.runs) {
      const terminals = run.events.filter(event => event.method === 'turn/completed');
      for (const terminal of terminals) {
        const params = terminal.params as { threadId: string; turn: { id: string } };
        const reader = createCodexTurnReader(params.threadId, params.turn.id);
        for (const event of run.events) reader.consume(event);
        const result = reader.snapshot();
        expect(result.status).toBe(run.outcome);
        if (run.outcome === 'completed') {
          completed++; expect(result.reply).toBe('LOCAL_PROTOCOL_OK');
          expect(result.cumulativeUsage?.inputTokens).toBeGreaterThanOrEqual(10);
          expect(result.cumulativeUsage?.outputTokens).toBeGreaterThanOrEqual(3);
        } else { failed++; expect(result.reply).toBeNull(); }
      }
    }
    expect(completed).toBe(2); expect(failed).toBe(2);
  });
  it('requires terminal evidence and ignores other threads/turns, deltas and server requests', () => {
    const reader = createCodexTurnReader('thread', 'turn');
    reader.consume(item('final'));
    expect(reader.snapshot()).toMatchObject({ status: 'open', reply: null });
    reader.consume({ ...done(), params: { ...done().params, threadId: 'other' } });
    reader.consume({ ...done(), params: { threadId: 'thread', turn: { id: 'other', status: 'completed' } } });
    reader.consume({ ...done(), id: 2 });
    reader.consume({ method: 'item/agentMessage/delta', params: { threadId: 'thread', turnId: 'turn', delta: 'extra' } });
    expect(reader.snapshot().status).toBe('open');
    expect(reader.consume(done())).toMatchObject({ status: 'completed', reply: 'final' });
    expect(reader.lost().status).toBe('completed');
  });
  it.each(['failed', 'interrupted'])('keeps %s distinct from success despite a reply item', status => {
    const reader = createCodexTurnReader('thread', 'turn'); reader.consume(item('do not send'));
    expect(reader.consume(done(status))).toMatchObject({ status, reply: null });
  });
  it('does not send commentary or an empty bubble; supports legacy unphased final messages', () => {
    for (const [text, phase, expected] of [['working', 'commentary', null], ['', 'final_answer', null], ['old', null, 'old']] as const) {
      const reader = createCodexTurnReader('thread', 'turn'); reader.consume(item(text, phase));
      expect(reader.consume(done()).reply).toBe(expected);
    }
    const reader = createCodexTurnReader('thread', 'turn'); reader.consume(item('progress', null, 'old'));
    reader.consume(item('answer')); expect(reader.consume(done()).reply).toBe('answer');
  });
  it('deduplicates identical completed items and detects contradictory evidence', () => {
    const reader = createCodexTurnReader('thread', 'turn'); reader.consume(item('answer')); reader.consume(item('answer'));
    expect(reader.consume(done()).reply).toBe('answer');
    expect(reader.consume(done('failed')).status).toBe('unverifiable');
    const conflict = createCodexTurnReader('thread', 'turn'); conflict.consume(item('one')); conflict.consume(item('two'));
    expect(conflict.consume(done())).toMatchObject({ status: 'unverifiable', reply: null });
  });
  it('enforces bytes and item-count limits, preserving failure across terminal frames', () => {
    const reader = createCodexTurnReader('thread', 'turn', 4); reader.consume(item('🙂'));
    expect(reader.consume(done()).reply).toBe('🙂');
    const large = createCodexTurnReader('thread', 'turn', 3); large.consume(item('🙂'));
    expect(large.consume(done()).status).toBe('unverifiable');
    const many = createCodexTurnReader('thread', 'turn');
    for (let i = 0; i < 257; i++) many.consume(item('', null, `item${i}`));
    expect(many.snapshot().status).toBe('unverifiable');
  });
  it('reads terminal item snapshots and rejects malformed terminal, message and usage evidence', () => {
    const reader = createCodexTurnReader('thread', 'turn');
    expect(reader.consume({ method: 'turn/completed', params: { threadId: 'thread', turn: {
      id: 'turn', status: 'completed', items: [item('snapshot').params.item] } } }).reply).toBe('snapshot');
    expect(createCodexTurnReader('thread', 'turn').consume(done('unknown')).status).toBe('unverifiable');
    expect(createCodexTurnReader('thread', 'turn').consume(item('x', 'unknown')).status).toBe('unverifiable');
    expect(createCodexTurnReader('thread', 'turn').consume({ method: 'thread/tokenUsage/updated', params: {
      threadId: 'thread', turnId: 'turn', tokenUsage: { total: { inputTokens: -1, outputTokens: 0, cachedInputTokens: 0 } } } }).status).toBe('unverifiable');
  });
  it('transport loss preserves uncertainty and missing metering stays unknown', () => {
    const reader = createCodexTurnReader('thread', 'turn'); reader.consume(item('not proof'));
    expect(reader.lost()).toMatchObject({ status: 'unverifiable', reply: null, cumulativeUsage: null });
    expect(reader.consume(done()).status).toBe('unverifiable');
    expect(createCodexTurnReader('thread', 'turn').consume(done())).toMatchObject({ status: 'completed', reply: null, cumulativeUsage: null });
  });
});
