import { closureCases } from '../measurement/a2-round4-review/closure.js';
import { edgeCases } from '../measurement/a2-round4-review/edge-cases.js';
import { verifyCases } from '../measurement/a2-round4-review/verify.js';

const cases = [...verifyCases, ...edgeCases, ...closureCases];
process.stdout.write(JSON.stringify({ cases: cases.length,
  passed: cases.filter(candidate => candidate.pass).length,
  failed: cases.filter(candidate => !candidate.pass).map(candidate => candidate.name) }));
