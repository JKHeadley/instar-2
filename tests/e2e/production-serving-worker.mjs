import { readFileSync, writeFileSync, openSync, closeSync, fsyncSync } from 'node:fs';
import { join } from 'node:path';
import { createConversationStepper } from '../../dist/assembly/production-conversation-driver.js';

// Process-level offline owner-ledger stand-in. The fixture has no authority to
// boot an installed production host; it exercises restart at the step boundary.
const [root, mode] = process.argv.slice(2);
const factsPath = join(root, 'facts.json'), callsPath = join(root, 'calls.json');
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const durable = (path, value) => {
  writeFileSync(path, JSON.stringify(value));
  const fd = openSync(path, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); }
};
const append = row => durable(factsPath, [...read(factsPath), row]);
const call = name => durable(callsPath, [...read(callsPath), name]);
const record = (id, kind, value, extra = {}) => ({ id, kind, body: { ...extra, record: value } });
const operations = {
  facts: () => read(factsPath), pollOnce: () => {}, capture: () => 'inbound', apiAccepted: () => true,
  admission: { owner: 'part-six', admitTurn: () => 'already-admitted', current: () => mode !== 'budget' },
  generation: 'g', lease: 'l', expiresAt: 100, maxContextTurns: 3, maxContextBytes: 100,
  replyLimit: 3, errorLimit: 3, totalErrorLimit: 5, now: () => 1, stopped: () => mode === 'stop',
  ground: () => { throw Error('unexpected ground'); },
  acceptAndPrepareReply: () => { throw Error('unexpected acceptance'); },
  dispatchProvider: (_turn, guard) => {
    guard();
    append(record('provider-claim', 'transport-AdmissionReservation',
      { run: 'run:1', state: 'dispatch-claimed' }));
    call('provider');
    if (mode === 'provider-kill') process.kill(process.pid, 'SIGKILL');
  },
  dispatchReply: (_turn, guard) => {
    guard();
    append(record('reply-claim', 'transport-AdmissionReservation',
      { run: 'reply:1', state: 'dispatch-claimed' }));
    call('sendMessage');
    if (mode === 'reply-kill') process.kill(process.pid, 'SIGKILL');
    if (mode === 'lost-ack') {
      append(record('reply-observation', 'effect-OperationObservation',
        { request: 'reply-request', stage: 'response' }));
      process.kill(process.pid, 'SIGKILL');
    }
  },
};
const result = await createConversationStepper(operations).step();
process.stdout.write(`${result}\n`);
