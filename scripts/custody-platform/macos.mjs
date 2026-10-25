// Existing macOS custody lifecycle is supplied by its host. Nothing changes its
// launchd, ACL or harness setup. Its independent broker still must pass conformance;
// harness readiness by itself is NOT broker isolation evidence.
import { custodyPlatform } from './interface.mjs';
import { harnessReadiness } from '../../tests/preview/harness-user.mjs';
export function macosCustodyPlatform({ implementation, harnessConfiguration }) {
  const lifecycle = custodyPlatform(implementation);
  return custodyPlatform({
    install: material => lifecycle.install(material),
    verify: () => lifecycle.verify(),
    async start() {
      if (process.platform !== 'darwin') throw Error('custody: macOS conformance must run on macOS');
      const readiness = harnessReadiness(harnessConfiguration);
      if (!readiness.ready) throw Error('custody: existing macOS harness is not ready');
      await lifecycle.verify();
      return lifecycle.start();
    },
    request: request => lifecycle.request(request),
    status: () => lifecycle.status(),
    stop: () => lifecycle.stop(),
  });
}
