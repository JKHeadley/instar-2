// Operator/installer surface, not a model tool. No provider or messaging path is opened.
import { existsSync, lstatSync, mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { configureTrust, setupTrustPolicy, setupMcp } from '../tests/preview/trust-setup.mjs';
import { decodeEffectPolicy } from '../tests/preview/effect-doorway.mjs';
import { assertAgentPaths } from './agent-paths.mjs';
import { publishSetupRecord, readSetupRecord, syncDirectory } from './onboarding-state.mjs';
import { DEFAULT_MCP } from './mcp-setup.mjs';

export const SETUP_DEFAULTS = Object.freeze({ identity: true, selfKnowledge: true, reflection: true, growth: true });
export const SETUP_QUESTIONS = Object.freeze([
  'What role should your agent have?',
  'How much trust should it start with? Describe what it may do within that role.',
  'What is its monthly spending limit in US dollars? (0 is allowed)',
  'Which matters are sensitive? Separate them with semicolons, or enter none.',
]);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const bounded = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
export function validateSetupAnswer(index, value) {
  if (!bounded(value, index === 0 ? 2048 : 1024)) throw Error('Please give a nonempty answer within the displayed field limit.');
  if (index === 2 && (!/^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,2})?$/u.test(value.trim())
    || !Number.isSafeInteger(Math.round(Number(value) * 100)) || Number(value) > 1000000000))
    throw Error('The monthly limit must be a dollar amount from 0 to 1000000000, with at most two decimal places.');
  if (index === 3 && value.trim().toLowerCase() !== 'none') {
    const matters = value.split(';').map(part => part.trim());
    if (matters.length > 64 || matters.some(part => !bounded(part, 256)) || new Set(matters).size !== matters.length)
      throw Error('Name distinct sensitive matters of up to 256 characters each, separated by semicolons.');
  }
  return value.trim();
}
export function onboardingRequest(identity, answers) {
  if (!identity || !/^agent:[a-f0-9-]{36}$/u.test(identity.agentId) || !bounded(identity.custodian, 256)
    || !Array.isArray(answers) || answers.length !== 4) throw Error('incomplete onboarding record');
  const values = answers.map((answer, index) => validateSetupAnswer(index, answer));
  const source = `terminal-setup:${identity.agentId}`;
  return { source, custodian: identity.custodian, recovery: 'The installation owner can revise or revoke standing trust.',
    // No connected account or paid operation is being granted by this first slice.
    resourceLevelUsd: 0, effects: [], mcp: DEFAULT_MCP,
    role: { description: values[0], trust: values[1], accounts: [], channels: [] },
    policySensitive: values[3].toLowerCase() === 'none' ? [] : values[3].split(';').map(part => part.trim()),
    onboarding: { agentId: identity.agentId, source, custodian: identity.custodian,
      monthlySpendingLimitUsd: Number(values[2]), defaults: SETUP_DEFAULTS } };
}
function verifyInstalled(root, request) {
  const policy = readSetupRecord(join(root, 'effect-policy.json'));
  const mcp = readSetupRecord(join(root, 'mcp.json'));
  if (!policy || !mcp || !same(decodeEffectPolicy(policy), setupTrustPolicy(request))
    || !same(mcp.operatorGrant, { source: request.source, custodian: request.custodian, recovery: request.recovery }))
    throw Error('Recorded setup differs from the installed choices. Keep the current policy; use the owner’s revise/revoke flow.');
  setupMcp(mcp);
}
/** Four fixed form fields: no inferred scope and no model text treated as authority.
 * Each accepted answer is durable before the next prompt. Re-entry reads those answers.
 * Completion is checked against the real policy/MCP consumers, never just a marker. */
export async function runOnboarding(rootInput, io, custodian) {
  if (!bounded(custodian, 256)) throw Error('the installation owner identity is required');
  const root = resolve(rootInput), state = join(root, '.onboarding');
  assertAgentPaths({ root, state });
  mkdirSync(root, { recursive: true, mode: 0o700 });
  if (!lstatSync(root).isDirectory()) throw Error('setup root must be a real directory');
  const identityPath = join(state, 'identity.json');
  if (!existsSync(identityPath) && (existsSync(join(root, 'effect-policy.json')) || existsSync(join(root, 'mcp.json'))))
    throw Error('This root already has standing choices. Use its existing setup or the owner’s revise flow.');
  mkdirSync(state, { recursive: true, mode: 0o700 });
  if (!lstatSync(state).isDirectory()) throw Error('setup state must be a real directory');
  syncDirectory(dirname(root)); syncDirectory(root);
  const identity = readSetupRecord(identityPath) ?? publishSetupRecord(identityPath, { agentId: `agent:${randomUUID()}`, custodian });
  if (identity.custodian !== custodian) throw Error('Resume setup as its original installation owner.');
  const completed = readSetupRecord(join(state, 'completed.json'));
  const answers = [];
  io.write('Instar role setup. Identity, self-knowledge, reflection and growth are on by default.\n'
    + 'Use this terminal as the installation owner. Do not enter passwords or credentials.\n');
  for (let index = 0; index < SETUP_QUESTIONS.length; index += 1) {
    const path = join(state, `${index}.json`);
    let record = readSetupRecord(path);
    if (record === null) {
      if (completed !== null) throw Error('A completed setup is missing a recorded answer; no grants were recreated.');
      io.write(`${SETUP_QUESTIONS[index]} [max ${index === 0 ? 2048 : 1024} characters]\n> `);
      const raw = await io.read();
      if (raw === null) { io.write('\nSetup paused. Run the same command to resume your saved answers.\n'); return 2; }
      // Preserve rejected input locally as evidence, without creating authority from it.
      let answer;
      try { answer = validateSetupAnswer(index, raw); }
      catch (error) {
        publishSetupRecord(join(state, `rejected-${randomUUID()}.json`), { index, raw: raw.slice(0, 8192) });
        throw error;
      }
      record = publishSetupRecord(path, { agentId: identity.agentId, answer });
      if (record.answer !== answer) throw Error('Another setup recorded a different answer. Resume its saved conversation.');
      io.write(`Saved answer ${index + 1}/4.\n`);
    }
    if (record.agentId !== identity.agentId) throw Error('setup answer belongs to another agent');
    answers.push(validateSetupAnswer(index, record.answer));
  }
  const request = onboardingRequest(identity, answers);
  if (completed !== null) {
    if (completed.agentId !== identity.agentId) throw Error('setup completion belongs to another agent');
    verifyInstalled(root, request);
    io.write('Already set up. Your recorded role and choices are unchanged.\n'
      + 'Next: npx github:JKHeadley/instar-2 prepare-login (use the same installation directory).\n');
    return 0;
  }
  configureTrust(root, 'setup', request);
  verifyInstalled(root, request);
  publishSetupRecord(join(state, 'completed.json'), { agentId: identity.agentId });
  io.write('Role setup complete. Your role, starting trust, monthly limit and sensitive matters are recorded.\n'
    + 'Next: npx github:JKHeadley/instar-2 prepare-login (use the same installation directory).\n'
    + 'Subscription sign-in, channels and activation are separate installation steps; no paid use is enabled here.\n');
  return 0;
}
