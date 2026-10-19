// Recorded lifecycle replay process; never calls Codex or a model.
import { createInterface } from 'node:readline';
import { readFileSync } from 'node:fs';
const run = JSON.parse(readFileSync(new URL('./codex-app-server-0.156.1.json', import.meta.url), 'utf8')).runs[0];
const turns = run.events.filter(event => event.method === 'turn/completed').map(event => event.params);
let turn = 0;
const write = frame => process.stdout.write(`${JSON.stringify(frame)}\n`);
createInterface({ input: process.stdin }).on('line', line => {
  const frame = JSON.parse(line); if (frame.id === undefined) return;
  if (frame.method === 'hang') return;
  if (frame.method === 'malformed') { process.stdout.write('not json\n'); return; }
  if (frame.method === 'thread/start' || frame.method === 'thread/resume') {
    write({ id: frame.id, result: { thread: { id: turns[0].threadId } } }); return;
  }
  if (frame.method === 'turn/start') {
    const current = turns[turn++ % turns.length];
    // Deliberately notify before replying to the RPC.
    for (const event of run.events) write(event);
    write({ id: frame.id, result: { turn: { id: current.turn.id } } }); return;
  }
  if (frame.method === 'server-request') {
    write({ id: 'approval', method: 'item/commandExecution/requestApproval', params: {} });
  }
  if (frame.id === 'approval') return;
  write({ id: frame.id, result: { echoed: frame.params } });
});
