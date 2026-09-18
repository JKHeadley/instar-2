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
  // Missing bindings default closed in the core. This executable supplies no
  // fixture handles; its installed host owns real dependency observations.
  const result = bootProductionApplication(record, host);
  return await consumeResult(result, {
    Success: async application => {
      try {
        if (typeof host.run !== 'function') {
          output.write('production boot refused: missing binding conversation-driver\n');
          return 1;
        }
        await host.run(application);
        return 0;
      } finally { application.close(); }
    },
    Refused: refusal => { output.write(`production boot refused: ${refusal.detail}\n`); return 1; },
  });
}
