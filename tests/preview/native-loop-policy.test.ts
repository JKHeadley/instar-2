// Portable policy/parser proofs; real confinement remains in native-loop.test.ts.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NATIVE_TOOL_LIMITS, NATIVE_TOOL_NAMES, SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT, SUBSCRIPTION_NATIVE_FRAMING,
  SUBSCRIPTION_NATIVE_SYSTEM_PROMPT, SUBSCRIPTION_TOOL_LIMITS, subscriptionConversationPolicy, subscriptionNativePolicy,
  subscriptionPolicyFor } from '../../src/assembly/production-provider.js';
import { encoded } from './canonical.js';
import { conclusionText, parseModelJson } from './model-json.js';
// @ts-expect-error Runner policy is JavaScript.
import { NATIVE_STEPS_ROLE, nativeShellProfile, parseNativeStep, nativeStepEnvelope } from './native-loop-policy.mjs';

describe('the native framing', () => {
  it('is its own policy: text-only single-turn calls, a distinct digest, and a system prompt naming the native tools', () => {
    const native = subscriptionNativePolicy('claude-sonnet-5'), conversation = subscriptionConversationPolicy('claude-sonnet-5');
    expect(native.framing).toBe(SUBSCRIPTION_NATIVE_FRAMING);
    expect(encoded(native).hash).not.toBe(encoded(conversation).hash);
    // Same text-only shape: no harness tools, one turn, safe mode, no MCP servers.
    for (const flag of ['--safe-mode', '--max-turns', '--strict-mcp-config']) expect(native.args).toContain(flag);
    expect(native.args[native.args.indexOf('--tools') + 1]).toBe('');
    expect(native.args[native.args.indexOf('--max-turns') + 1]).toBe('1');
    expect(native.args[native.args.indexOf('--system-prompt') + 1]).toBe(SUBSCRIPTION_NATIVE_SYSTEM_PROMPT);
    expect(SUBSCRIPTION_NATIVE_SYSTEM_PROMPT).not.toBe(SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT);
    expect(SUBSCRIPTION_NATIVE_SYSTEM_PROMPT).not.toContain('You have no tools');
    for (const tool of NATIVE_TOOL_NAMES) expect(SUBSCRIPTION_NATIVE_SYSTEM_PROMPT).toContain(`${tool} {`);
    expect(SUBSCRIPTION_NATIVE_SYSTEM_PROMPT).toContain(`role:${NATIVE_STEPS_ROLE}`);
    expect(subscriptionPolicyFor('claude-sonnet-5', SUBSCRIPTION_NATIVE_FRAMING).system).toBe(SUBSCRIPTION_NATIVE_SYSTEM_PROMPT);
    // The step cap is exactly the liability a tool turn reserves.
    expect(NATIVE_TOOL_LIMITS.maxSteps).toBe(SUBSCRIPTION_TOOL_LIMITS.maxTurns);
    expect(Buffer.byteLength(SUBSCRIPTION_NATIVE_SYSTEM_PROMPT) + 16384).toBeLessThan(native.maxPromptBytes);
  });
});

describe('the step parser', () => {
  it('reads a tool request only from an object with calls and no reply; everything else concluded is the answer', () => {
    expect(parseNativeStep('{"calls":[{"tool":"Write","input":{"file_path":"a","content":"b"}}]}'))
      .toEqual({ kind: 'calls', calls: [{ tool: 'Write', input: { file_path: 'a', content: 'b' } }] });
    expect(parseNativeStep('```json\n{"calls":[{"tool":"Bash","input":{"command":"ls"}}]}\n```').kind).toBe('calls');
    expect(parseNativeStep('The count is 11.')).toEqual({ kind: 'answer' });
    expect(parseNativeStep('{"reply":"Done","calls":[{"tool":"Bash","input":{}}]}')).toEqual({ kind: 'answer' });
    expect(parseNativeStep('{"reply":"Done","directives":[]}')).toEqual({ kind: 'answer' });
    expect(parseNativeStep('{"calls":[]}').kind).toBe('malformed');
    expect(parseNativeStep('{"calls":[{"tool":"Bash","input":"ls"}]}').kind).toBe('malformed');
    expect(parseNativeStep(JSON.stringify({ calls: Array.from({ length: NATIVE_TOOL_LIMITS.maxCallsPerStep + 1 }, () => ({ tool: 'Glob', input: {} })) })).kind)
      .toBe('malformed');
    expect(parseNativeStep(JSON.stringify({ calls: Array.from({ length: NATIVE_TOOL_LIMITS.maxCallsPerStep }, () => ({ tool: 'Glob', input: {} })) })).kind)
      .toBe('calls');
    expect(parseNativeStep('')).toEqual({ kind: 'empty' });
    expect(parseNativeStep('   ')).toEqual({ kind: 'empty' });
  });

  it('replays recorded real model outputs: answers stay answers, and nothing recorded reads as a tool request', () => {
    // live-declarations-2026-09-28: raw claude-sonnet-5 Decision bytes (string and object answers); tool-turn live-2026-10-03:
    // real tool-turn answers; proofroom cascade 2026-09-30: real delivered answers and real uncertain summary outcomes.
    const declarations = JSON.parse(readFileSync(join(__dirname, 'fixtures/live-declarations-2026-09-28.json'), 'utf8'));
    const raws: string[] = [...declarations.current.answers, ...declarations.fixed.answers];
    const concluded = raws.map(raw => { const parsed = parseModelJson(raw, { wrapped: 'accept' });
      return parsed.ok ? conclusionText((parsed.value as { conclusion: { value: unknown } }).conclusion.value as never) : null; });
    expect(concluded.length).toBeGreaterThanOrEqual(8);
    expect(concluded.some(text => typeof text === 'string' && text.startsWith('{"reply"'))).toBe(true);
    for (const text of concluded) expect(parseNativeStep(text).kind).toBe('answer');
    for (const name of ['task', 'scope', 'r6-fixed', 'call-cap']) {
      const record = JSON.parse(readFileSync(join(__dirname, `fixtures/tool-turn/live-2026-10-03/${name}.json`), 'utf8'));
      expect(parseNativeStep(record.answer).kind).toBe('answer');
    }
    const cascade = JSON.parse(readFileSync(join(__dirname, 'fixtures/proofroom-summary-cascade-stall-2026-09-30.json'), 'utf8'));
    const delivered = cascade.rows.filter((row: { kind: string }) => row.kind === 'answer').map((row: { text: string }) => row.text);
    expect(delivered.length).toBeGreaterThan(10);
    for (const text of delivered) expect(parseNativeStep(text).kind).toBe('answer');
    const uncertain = cascade.rows.filter((row: { state?: string }) => row.state === 'uncertain');
    expect(uncertain.length).toBeGreaterThan(5);
  });

});

  it('builds the sandbox from the harness sandbox inputs and refuses an unsafe or overlapping scratch path', () => {
    const profile = nativeShellProfile('/private/tmp/itt-abc', '/usr/local/bin/node');
    expect(profile).toContain('(deny default)');
    expect(profile).toContain('(literal "/usr/local/bin/node")');
    expect(profile).toContain('(deny network*)');
    expect(profile).not.toContain('network-outbound');
    // With the turn's checkpoint, the one place a command may reach is its loopback port, and its tools' locations are read.
    const reach = nativeShellProfile('/private/tmp/itt-abc', '/usr/local/bin/node', { port: 40123, reads: ['/Library/Developer/CommandLineTools'] });
    expect(reach).toContain('(deny network*)');
    expect(reach).toContain('(allow network-outbound (remote ip "localhost:40123"))');
    expect(reach).toContain('(subpath "/Library/Developer/CommandLineTools")');
    for (const bad of [{ port: 0, reads: [] }, { port: 40123, reads: ['/private/tmp/itt-abc/x'] }, { port: 40123, reads: ['rel'] }])
      expect(() => nativeShellProfile('/private/tmp/itt-abc', '/usr/local/bin/node', bad)).toThrow(/egress checkpoint/u);
    expect(profile).toContain('(allow file-write* (subpath "/private/tmp/itt-abc")');
    expect(profile).toContain('(subpath "/usr/bin")');
    // Both sides of the host configuration (the gate run of 2026-10-07: a confined shell with no readable /private/etc
    // reached its own checkpoint in neither profile). It is machinery again, by both spellings, and the host's own record
    // is refused after it — last rule wins in SBPL, and the kernel decides on the resolved path, so `/etc/hosts`, a
    // concatenated or globbed spelling of it and a `..` escape are one refused target.
    for (const text of [profile, reach] as string[]) {
      expect(text).toMatch(/\(allow file-read\* file-map-executable .*\(subpath "\/private\/etc"\).*\(subpath "\/etc"\)/u);
      expect(text).toContain('(deny file-read-data (subpath "/private/etc/hosts"))');
      const lines = text.split('\n');
      expect(lines.findIndex(line => line.startsWith('(deny file-read-data (subpath "/private/etc/hosts")')))
        .toBeGreaterThan(lines.findIndex(line => line.startsWith('(allow file-read* file-map-executable')));
    }
    expect(() => nativeShellProfile('/private/etc/x', '/usr/local/bin/node')).toThrow(/overlaps/u);
    expect(() => nativeShellProfile('/private/tmp/a b', '/usr/local/bin/node')).toThrow(/absolute and plain/u);
    expect(() => nativeShellProfile('/usr/share/x', '/usr/local/bin/node')).toThrow(/overlaps/u);
    expect(() => nativeShellProfile('/private/tmp/itt-abc', '/private/tmp/itt-abc/node')).toThrow(/outside the scratch/u);
    expect(() => nativeShellProfile('/private/tmp/itt-abc', 'node')).toThrow(/node path/u);
  });

// The moved envelope function keeps its exact byte-boundary behavior on both hosts.
it('fits the native envelope at its byte limit and refuses one byte below the minimal envelope', () => {
  const prepared = JSON.stringify({ messages: [{ role: 'user', content: 'read the note' }] });
  const text = nativeStepEnvelope(prepared, [], 1, 65536);
  expect(nativeStepEnvelope(prepared, [], 1, Buffer.byteLength(text))).toBe(text);
  expect(nativeStepEnvelope(prepared, [], 1, Buffer.byteLength(text) - 1)).toBeNull();
  expect(JSON.parse(text).messages.at(-1).role).toBe(NATIVE_STEPS_ROLE);
});
