import { round8Cases } from '../measurement/a2-round8-review-cases.js';

process.stdout.write(JSON.stringify({ cases: round8Cases.length,
  passed: round8Cases.filter(candidate => candidate.pass).length,
  failed: round8Cases.filter(candidate => !candidate.pass).map(candidate => candidate.name) }));
