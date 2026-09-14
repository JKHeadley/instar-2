import { round7Cases } from '../measurement/a2-round7-review-cases.js';

process.stdout.write(JSON.stringify({ cases: round7Cases.length,
  passed: round7Cases.filter(candidate => candidate.pass).length,
  failed: round7Cases.filter(candidate => !candidate.pass).map(candidate => candidate.name) }));
