import { runProbeTrafficReplay } from './probe-traffic-replay.ts';

// One table: for each later ordinary question, how much probe content its actual packet
// carries and in which blocks, plus the controls; then the stored memory surfaces.
const result = await runProbeTrafficReplay();
const out = line => process.stdout.write(`${line}\n`);
out(`journal turns=${result.journal.turns} probeTurns=${result.journal.probeTurns} probesAuditable=${result.journal.auditable} `
  + `restarts=${result.restarts} stubSends=${result.sends} replayStable=${result.replayStable}`);
for (const row of result.rows) {
  const blocks = Object.entries(row.blocks).map(([block, hits]) => `${block}:${hits}`).join(',') || '-';
  out(`${row.probeHits ? 'LEAK' : 'CLEAN'} ${row.question.padEnd(9)} ${row.surface.padEnd(26)} probeHits=${row.probeHits} blocks=${blocks}`
    + `${row.control === null ? '' : ` control=${row.control}`}${row.periodTotal === undefined ? '' : ` periodTotal=${row.periodTotal}`}`
    + `${row.inventoryTotal === undefined ? '' : ` inventoryTotal=${row.inventoryTotal}`}${row.openQuestions === undefined ? '' : ` openQuestions=${row.openQuestions}`}`);
}
out(`summaries count=${result.summaries.count} withProbe=${result.summaries.withProbe} latestProbeHits=${result.summaries.probeHits} control=${result.summaries.controlJuniper}`);
out(`people total=${result.people.total} fromProbe=${result.people.fromProbe} control=${result.people.control}`);
out(`preferences active=${result.preferences.active} fromProbe=${result.preferences.fromProbe} control=${result.preferences.control}`);
out(`commitments total=${result.commitments.total} fromProbe=${result.commitments.fromProbe}`);
const controls = result.rows.every(row => row.control !== false) && result.summaries.controlJuniper && result.people.control && result.preferences.control;
const clean = result.rows.every(row => row.probeHits === 0) && result.summaries.withProbe === 0 && result.people.fromProbe === 0
  && result.preferences.fromProbe === 0 && result.commitments.fromProbe === 0;
out(`probe-free=${clean} controls=${controls}`);
process.exitCode = clean && controls && result.replayStable && result.journal.auditable ? 0 : 1;
