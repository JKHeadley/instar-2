import { round5Cases } from '../measurement/a2-round5-review-cases.js';

process.stdout.write(JSON.stringify({ cases: round5Cases.length,
  passed: round5Cases.filter(candidate => candidate.pass).length,
  failed: round5Cases.filter(candidate => !candidate.pass).map(candidate => candidate.name) }));
