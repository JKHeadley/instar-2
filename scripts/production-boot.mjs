import { readFileSync, realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { bootProductionApplication } from '../dist/assembly/production-application.js';
import { consumeResult } from '../dist/index.js';

/** The installation module supplies confined OS ports and registered policy;
 * it does not supply constructed conversation owner ports. The Ten factory
 * constructs those after decoding the immutable installation record. */
export async function runProductionCommand(args, output = process.stderr) {
  if (args.length !== 2) {
    output.write('usage: instar-production <installation-record.json> <installation-host.mjs>\n');
    return 2;
  }
  let record, host;
  try {
    record = JSON.parse(readFileSync(realpathSync(args[0]), 'utf8'));
    const module = await import(pathToFileURL(realpathSync(args[1])).href);
    if (typeof module.createProductionHost !== 'function') throw Error('host unavailable');
    host = await module.createProductionHost();
  } catch {
    // Module and resolver failures may contain credential-bearing diagnostics.
    output.write('production boot refused: installation record or confined host unavailable\n');
    return 1;
  }
  // U4-C/U4-F: the installed distribution has neither real binding. A supplied
  // host cannot switch these holds off by advertising fixture-shaped handles.
  // The recorded lifecycle supplies the two explicitly granted fixture bindings
  // to the same core entry; this installed command supplies no substitutes.
  const { runAdmission: _heldAdmission, ...installedHost } = host;
  const result = bootProductionApplication(record, { ...installedHost,
    dependencies: () => ({ ...host.dependencies(), 'replication-peer': false }) });
  return consumeResult(result, {
    Success: application => {
      application.close();
      output.write('production boot refused: unexpected admission while U4 activation holds remain\n');
      return 1;
    },
    Refused: refusal => { output.write(`production boot refused: ${refusal.detail}\n`); return 1; },
  });
}
