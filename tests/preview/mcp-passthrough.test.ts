// @ts-nocheck -- executes the shipped JavaScript composition with disposable roots.
import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readRootMcp } from './tool-turn.mjs';
import { prepareSessionAdmission, sessionAdmissionCommand } from './session-admission.mjs';
import { prepareSessionConnectors, admitSessionConnector } from './session-connectors.mjs';
import { admitToolCall, admitToolCallEffect } from './tool-admission.mjs';
import { subscriptionConversationPolicy, subscriptionInvocationPolicy } from '../../src/assembly/production-provider.js';
import { sessionConnectorArgs } from '../../src/assembly/production-session-driver.js';

const recorded = JSON.parse(readFileSync(new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json', import.meta.url), 'utf8')).otherShapes;
const roots = [], ports = [];
afterEach(async () => {
  for (const port of ports.splice(0)) await port.close();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
const source = readFileSync(new URL('./journal-agent.mjs', import.meta.url), 'utf8');
const factory = source.split('      const configurationFor = ')[1].split('\n      const defaultBinding = ')[0]
  .replaceAll('import.meta.url', JSON.stringify(new URL('./journal-agent.mjs', import.meta.url).href));

it.each([false, true])('shipped session admission forwards listed connectors and read scope (conversation=%s)', async conversationSession => {
  for (const configured of [true, false]) {
    const root = mkdtempSync(join(tmpdir(), 'mcp-passthrough-')); roots.push(root);
    const project = join(root, 'workspace'); mkdirSync(project);
    const servers = { harmless: { command: '/usr/bin/true' } };
    if (configured) writeFileSync(join(root, 'mcp.json'), JSON.stringify({ mcpServers: servers, reads: ['mcp__harmless__read'] }));
    const sessionConnectors = new Map(), stepEgress = new Map();
    const gate = { base: claim => `http://127.0.0.1:4100/${'a'.repeat(32)}/${claim}`, open: () => {} };
    const env = { join, fileURLToPath, root, project, conversationSession, sessionConnectors, stepEgress, gate,
      sessionMcpDigest: undefined, sessionAdapter: {}, sha256: () => 'a'.repeat(64), conversationOf: () => 'operator', g: {},
      journal: { view: { expires: 100000 }, sessionWorkRecords: () => [] },
      sessionWork: { port: { reserveCall: () => {} } }, sessionAdmissionCommand, admissionBase: join(root, 'admission'), layout: null,
      sessionLimits: { deadlineMs: 10000, maxSessions: 2 }, framework: 'claude-code', required: () => 'model', options: {},
      context: {}, wallNow: () => 1000, hostStopped: () => false, ownerMachine: 'local', launchedAt: 1000, delay: async () => {},
      doorway: { id: 'doorway' }, mountVolume: () => {}, closeStepEgress: async () => {},
      readRootMcp, prepareSessionAdmission, admissionConfig: () => ({ operations: [] }),
      attachEgress: async () => ({ proxy: {} }), networkToolReads: () => [], heldVerdict: () => () => 'clear', heldSecrets: {},
      prepareSessionConnectors: async config => { const port = await prepareSessionConnectors(config); ports.push(port); return port; },
    };
    const make = Function(...Object.keys(env), `return ${factory}`)(...Object.values(env));
    const binding = { entry: () => ({ profile: { executable: '/cli', home: '/home', configDirectory: '/config' } }),
      physical: () => ({ inboxDirectory: '/inbox' }), harness: () => null, stopped: () => false };
    const config = make('7', binding);
    await config.io.prepareAdmission('step', { budget: { calls: 4 } });
    const admission = JSON.parse(readFileSync(join(root, 'admission/step/config.json'), 'utf8'));
    expect(admission.mcpReads).toEqual(configured ? ['mcp__harmless__read'] : []);
    const decision = source.split('effects: createToolEffectOwner({ decide: ')[1].split(',\n          append: appendWork')[0];
    const decisionEnv = { conversationSession, sessionConnectors, admissionConfig: env.admissionConfig,
      readRootMcp, root, accountActions: false, wallNow: env.wallNow, admitSessionConnector, admitToolCallEffect };
    const decide = Function(...Object.keys(decisionEnv), `return ${decision}`)(...Object.values(decisionEnv));
    for (const row of recorded) {
      const call = { tool_name: 'mcp__harmless__read', tool_input: { text: row.raw } };
      const fs = { exists: () => true, realpath: path => path };
      expect(admitToolCall(call, admission, 1, fs), row.id).toMatchObject({ decision: 'gate', kind: 'effect' });
      expect(decide(call.tool_name, call.tool_input, { child: 'step' }), row.id).toMatchObject({ admitted: configured });
      for (const tool_name of ['mcp__harmless__write', 'mcp__unlisted__read']) {
        expect(decide(tool_name, call.tool_input, { child: 'step' }), row.id).toMatchObject({ admitted: false });
        expect(admitToolCall({ ...call, tool_name }, admission, 1, fs), row.id).toMatchObject({ decision: 'gate', kind: 'effect' });
      }
    }
    const launch = config.sessionConfiguration().connectors('step');
    const args = sessionConnectorArgs('claude-code', launch);
    if (configured) {
      expect(launch.servers).toEqual(['harmless']);
      expect(JSON.parse(readFileSync(launch.config, 'utf8'))).toEqual({ mcpServers: servers });
      expect(args).toEqual(['--strict-mcp-config', '--mcp-config', launch.config]);
      expect(sessionConnectorArgs('codex-cli', launch).join(' ')).toContain('mcp_servers.harmless=');
    } else expect(args).toEqual(['--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}']);
  }
});

it('no-tool model policies keep the exact empty MCP list', () => {
  for (const policy of [subscriptionInvocationPolicy('model'), subscriptionConversationPolicy('model')]) {
    expect(policy.args[policy.args.indexOf('--mcp-config') + 1]).toBe('{"mcpServers":{}}');
    expect(policy.args[policy.args.indexOf('--tools') + 1]).toBe('');
    expect(policy.args).toContain('--strict-mcp-config');
  }
});
