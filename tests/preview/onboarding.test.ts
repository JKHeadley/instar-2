import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
// @ts-expect-error Shipped operator installer JavaScript.
import { onboardingRequest, runOnboarding, SETUP_DEFAULTS, validateSetupAnswer } from '../../scripts/onboarding.mjs';
// @ts-expect-error Existing runtime policy consumer.
import { decodeEffectPolicy, admitEffect } from './effect-doorway.mjs';
// @ts-expect-error Existing installer writer.
import { configureTrust } from './trust-setup.mjs';
// @ts-expect-error Atomic installer publication.
import { publishSetupRecord } from '../../scripts/onboarding-state.mjs';

const roots: string[] = [];
const root = () => { const path = mkdtempSync(join(tmpdir(), 'onboard1-')); roots.push(path); return path; };
afterEach(() => roots.splice(0).forEach(path => rmSync(path, { recursive: true, force: true })));
const answers = ['Help with private drafts', 'Work independently within this role', '12.29', 'health; family'];
const identity = { agentId: 'agent:12345678-1234-1234-1234-123456789abc', custodian: 'local-installer:uid:1000' };
const load = (path: string, name = 'effect-policy.json') => JSON.parse(readFileSync(join(path, name), 'utf8'));
const cli = (path: string, input = '') => spawnSync(process.execPath, ['bin/instar2.mjs', 'setup', path],
  { input, encoding: 'utf8', timeout: 30000 });
const transcript = (values: string[]) => `${values.join('\n')}\n`;

it('records four explicit choices through the real standing-policy consumer, with defaults on', () => {
  const req = onboardingRequest(identity, answers), path = root();
  configureTrust(path, 'setup', req);
  const policy = decodeEffectPolicy(load(path));
  expect(policy.role).toEqual({ description: answers[0], trust: answers[1], accounts: [], channels: [] });
  expect(policy.onboarding).toEqual({ ...identity, source: `terminal-setup:${identity.agentId}`,
    monthlySpendingLimitUsd: 12.29, defaults: SETUP_DEFAULTS });
  expect(policy.policySensitive).toEqual(['health', 'family']);
  expect(policy.resourceLevelUsd).toBe(0); // Monthly choice is never misused as a per-effect grant.
  expect(policy.grants).toEqual([]); // No accounts or external effect scopes have been connected yet.
  expect(admitEffect({ effect: 'tool:mcp', target: 'mcp__mail__send' }, policy).admitted).toBe(false);
  expect(load(path, 'mcp.json').operatorGrant.source).toBe(req.source);
});
it('accepts zero and cents; rejects absent, malformed, negative, nonfinite or fractional-cent limits', () => {
  for (const amount of ['0', '0.29', '12.34', '1000000000']) expect(validateSetupAnswer(2, amount)).toBe(amount);
  for (const amount of ['', '-1', 'NaN', 'Infinity', '1e2', '1.001', '1000000001'])
    expect(() => validateSetupAnswer(2, amount)).toThrow();
  for (const index of [0, 1, 3]) expect(() => validateSetupAnswer(index, ' ')).toThrow();
  expect(() => validateSetupAnswer(3, 'health;health')).toThrow();
  expect(() => validateSetupAnswer(3, ';health')).toThrow();
  expect(onboardingRequest(identity, [...answers.slice(0, 3), 'none']).policySensitive).toEqual([]);
  expect(() => onboardingRequest(identity, answers.slice(0, 2))).toThrow();
  const req = onboardingRequest(identity, answers), path = root(); configureTrust(path, 'setup', req);
  const policy = load(path);
  for (const monthlySpendingLimitUsd of [-1, Infinity, 0.001])
    expect(() => decodeEffectPolicy({ ...policy, onboarding: { ...policy.onboarding, monthlySpendingLimitUsd } })).toThrow();
  expect(() => decodeEffectPolicy({ ...policy, onboarding: { ...policy.onboarding, defaults: { ...SETUP_DEFAULTS, identity: false } } })).toThrow();
  expect(() => decodeEffectPolicy({ ...policy, onboarding: { ...policy.onboarding, extra: true } })).toThrow();
});
it('a scripted command installs one grant-policy set; a second full run is a byte-for-byte no-op', () => {
  const path = root(), first = cli(path, transcript(answers));
  expect(first.status, first.stderr).toBe(0);
  expect(first.stdout).toContain('Role setup complete');
  const names = ['effect-policy.json', 'mcp.json', '.onboarding/identity.json', '.onboarding/completed.json'];
  const before = names.map(name => ({ bytes: readFileSync(join(path, name), 'utf8'), mtime: statSync(join(path, name)).mtimeMs }));
  const again = cli(path, transcript(['Different role', 'different trust', '200', 'none']));
  expect(again.status, again.stderr).toBe(0); expect(again.stdout).toContain('Already set up');
  expect(again.stdout).not.toContain('What role');
  expect(names.map(name => ({ bytes: readFileSync(join(path, name), 'utf8'), mtime: statSync(join(path, name)).mtimeMs }))).toEqual(before);
  expect(readdirSync(join(path, '.onboarding')).sort()).toEqual(['0.json', '1.json', '2.json', '3.json', 'completed.json', 'identity.json']);
  expect(readdirSync(path).sort()).toEqual(['.onboarding', 'effect-policy.json', 'mcp.json']);
  expect(statSync(join(path, 'effect-policy.json')).mode & 0o777).toBe(0o600);
}, 60000);
it('kills the exact command PID after two saved answers, then resumes without another agent or grant set', async () => {
  const path = root();
  const child = spawn(process.execPath, ['bin/instar2.mjs', 'setup', path], { stdio: ['pipe', 'pipe', 'pipe'] });
  let output = '', errors = '', killed = false;
  child.stderr.on('data', chunk => { errors += String(chunk); });
  child.stdout.on('data', chunk => {
    output += String(chunk);
    if (!killed && output.includes('Saved answer 2/4.')) { killed = true; child.kill('SIGKILL'); }
  });
  child.stdin.write(transcript(answers.slice(0, 2)));
  const signal = await new Promise<NodeJS.Signals | null>((resolve, reject) => {
    child.on('error', reject); child.on('close', (_code, endedBy) => resolve(endedBy));
  });
  expect(killed, errors).toBe(true); expect(signal).toBe('SIGKILL');
  const id = load(path, '.onboarding/identity.json');
  expect(readdirSync(path)).not.toContain('effect-policy.json');
  const resumed = cli(path, transcript(answers.slice(2)));
  expect(resumed.status, resumed.stderr).toBe(0);
  expect(resumed.stdout).not.toContain('What role'); expect(resumed.stdout).not.toContain('How much trust');
  expect(load(path, '.onboarding/identity.json')).toEqual(id);
  expect(load(path).onboarding.agentId).toBe(id.agentId);
  expect(cli(path).stdout).toContain('Already set up');
}, 60000);
it('EOF pauses durably; an invalid next answer is retained and corrected without repeating valid answers', async () => {
  const path = root(), writes: string[] = [], input = [...answers.slice(0, 2)];
  const run = (values: string[], who = identity.custodian) => runOnboarding(path, { write: (s: string) => writes.push(s),
    read: async () => values.shift() ?? null }, who);
  expect(await run(input)).toBe(2);
  await expect(run(['-1'])).rejects.toThrow('monthly limit');
  const rejected = readdirSync(join(path, '.onboarding')).find(name => name.startsWith('rejected-'))!;
  expect(load(path, `.onboarding/${rejected}`).raw).toBe('-1');
  await expect(run(answers.slice(2), 'another-installer')).rejects.toThrow('original installation owner');
  expect(await run(answers.slice(2))).toBe(0);
  expect(writes.filter(line => line.includes('What role'))).toHaveLength(1);
});
it('recovers interruption between the existing policy and MCP writes, and before the completion receipt', async () => {
  const path = root(), input = [...answers];
  await runOnboarding(path, { write: () => {}, read: async () => input.shift() ?? null }, identity.custodian);
  const before = readFileSync(join(path, 'effect-policy.json'), 'utf8');
  unlinkSync(join(path, '.onboarding/completed.json')); unlinkSync(join(path, 'mcp.json'));
  expect(await runOnboarding(path, { write: () => {}, read: async () => { throw Error('must not prompt'); } }, identity.custodian)).toBe(0);
  expect(readFileSync(join(path, 'effect-policy.json'), 'utf8')).toBe(before);
  expect(load(path, 'mcp.json').operatorGrant.source).toBe(load(path).onboarding.source);
});
it('never resurrects revoked choices or treats a damaged completion marker as success', async () => {
  const path = root(), input = [...answers], io = { write: () => {}, read: async () => input.shift() ?? null };
  await runOnboarding(path, io, identity.custodian);
  const originalOnboarding = load(path).onboarding;
  configureTrust(path, 'revoke');
  expect(load(path).onboarding).toEqual(originalOnboarding);
  const revoked = readFileSync(join(path, 'effect-policy.json'), 'utf8');
  await expect(runOnboarding(path, io, identity.custodian)).rejects.toThrow('differs');
  expect(readFileSync(join(path, 'effect-policy.json'), 'utf8')).toBe(revoked);
  unlinkSync(join(path, '.onboarding/1.json'));
  await expect(runOnboarding(path, io, identity.custodian)).rejects.toThrow('missing a recorded answer');
});
it('refuses another existing setup, malformed checkpoints and conflicting publication without overwriting them', async () => {
  const path = root(), policy = join(path, 'effect-policy.json');
  writeFileSync(policy, '{}');
  await expect(runOnboarding(path, { write: () => {}, read: async () => null }, identity.custodian)).rejects.toThrow('already has standing choices');
  expect(readFileSync(policy, 'utf8')).toBe('{}');
  const checkpoint = join(path, 'checkpoint.json');
  expect(publishSetupRecord(checkpoint, { answer: 'first' })).toEqual({ answer: 'first' });
  expect(publishSetupRecord(checkpoint, { answer: 'second' })).toEqual({ answer: 'first' });
  expect(readdirSync(path).some(name => name.endsWith('.pending'))).toBe(false);
});
