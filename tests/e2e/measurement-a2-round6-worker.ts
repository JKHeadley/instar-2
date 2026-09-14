import { round6CheckpointCases } from '../measurement/a2-round6-review/checkpoint.js';
import { round6HeldPeerCases, round6NewCases } from '../measurement/a2-round6-review/new-cases.js';

const cases = [...round6NewCases, ...round6CheckpointCases];
process.stdout.write(JSON.stringify({ cases: cases.length,
  passed: cases.filter(candidate => candidate.pass).length,
  failed: cases.filter(candidate => !candidate.pass).map(candidate => candidate.name),
  held: round6HeldPeerCases.length }));
