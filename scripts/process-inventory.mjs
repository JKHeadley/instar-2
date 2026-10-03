// Part Ten's physical process-inventory adapter (SEAM-LEDGER rows 40/63): one batched,
// read-only census of every current-user process, decoded by the Ten owner decoder in
// src/assembly/process-inventory.ts. It signals nothing and holds no control authority.
// A refused or failed read is a `failed` census with no rows, never an empty population;
// a census past its bound is `partial` with its omitted count.
import { createHash, randomUUID } from 'node:crypto';

/** Ten's owner decoder and joins, loaded when a census first runs (they are TypeScript, so a module that
 * only imports this adapter and never observes, such as a boot child without the source loader, still loads). */
let tenOwner = null;
// Source first (the source loader or test runner); the built module for an installed, plain-node host.
export const loadTenOwner = () => tenOwner ??= import('../src/assembly/process-inventory.js')
  .catch(() => import('../dist/assembly/process-inventory.js'));

const CENSUS_COLUMNS = 'pid=,ppid=,pgid=,uid=,rss=,time=,stat=,lstart=,command=';
const ADAPTER = 'host-ps-lsof-sandbox-inventory-v2';
/**
 * The sandbox reading (macOS): the kernel's `sandbox_check` for each named pid, asked from outside the sandbox, so no
 * file or helper inside a launch is consulted. argv: the area count, the areas, then the pids. One line per pid:
 * `<pid> in <index>` (sandboxed, may read that area's contents and not its parent's: the per-launch profile's shape),
 * `<pid> none` (not in any of them, or gone), or `<pid> unknown` (the query failed). The libSystem call is variadic:
 * on arm64 a variadic argument travels on the stack, so the five padding words fill the remaining argument registers.
 */
const SANDBOX_READER = `import ctypes, os, platform, sys
lib = ctypes.CDLL('/usr/lib/libSystem.dylib', use_errno=True)
report = ctypes.c_int.in_dll(lib, 'SANDBOX_CHECK_NO_REPORT').value
check = lib.sandbox_check; check.restype = ctypes.c_int
pad = (0,) * 5 if platform.machine() == 'arm64' else ()
check.argtypes = [ctypes.c_int, ctypes.c_char_p, ctypes.c_int] + [ctypes.c_long] * len(pad) + [ctypes.c_char_p]
def ask(pid, path):
    ctypes.set_errno(0)
    result = check(pid, b'file-read-data' if path else None, (1 | report) if path else 0, *pad, path)
    return result, ctypes.get_errno()
count = int(sys.argv[1]); areas = [a.encode() for a in sys.argv[2:2 + count]]
for pid in map(int, sys.argv[2 + count:]):
    boxed, error = ask(pid, None)
    if boxed == -1: print(pid, 'none' if error == 3 else 'unknown'); continue
    if boxed == 0: print(pid, 'none'); continue
    found, failed = None, False
    for index, area in enumerate(areas):
        inside, outside = ask(pid, area)[0], ask(pid, os.path.dirname(area))[0]
        if inside == -1 or outside == -1: failed = True
        elif inside == 0 and outside == 1: found = index; break
    print(pid, 'in %d' % found if found is not None else 'unknown' if failed else 'none')
`;
export const INVENTORY_ADAPTER_DIGEST = `sha256:${createHash('sha256').update(JSON.stringify([ADAPTER, CENSUS_COLUMNS, '-a -d cwd -Fpn', SANDBOX_READER])).digest('hex')}`;

/** ps `time`: [[dd-]hh:]mm:ss[.cc] on both macOS and Linux. */
export function cpuMilliseconds(text) {
  const [days, clock] = text.includes('-') ? text.split('-') : ['0', text];
  const parts = clock.split(':').map(Number);
  if (parts.some(n => !Number.isFinite(n)) || !Number.isFinite(Number(days))) return null;
  const seconds = parts.reverse().reduce((total, part, index) => total + part * 60 ** index, 0);
  return Math.round((Number(days) * 86400 + seconds) * 1000);
}

/** One census row: pid ppid pgid uid rss time stat <lstart: 5 fields> command… */
function parseRow(line, sample) {
  const parts = line.trim().split(/\s+/u);
  if (parts.length < 12) return null;
  const [pid, ppid, pgid, uid, rss, time, stat] = parts;
  const start = parts.slice(7, 12).join(' '), command = parts.slice(12).join(' ').slice(0, 4096);
  if (![pid, ppid, pgid, uid, rss].every(n => Number.isSafeInteger(Number(n)) && Number(n) >= 0)) return null;
  const cpu = cpuMilliseconds(time), zombie = stat.startsWith('Z');
  const reported = !zombie && cpu !== null;
  return { pid: Number(pid), ppid: Number(ppid), pgid: Number(pgid), uid: Number(uid), start, command, zombie,
    cwd: { state: 'unobserved' },
    resource: { state: zombie ? 'process-exited' : reported ? 'reported' : 'unavailable', sourceSample: sample,
      cumulativeCpuMs: reported ? cpu : null, rssBytes: reported ? Number(rss) * 1024 : null, heap: 'unsupported' } };
}

/**
 * @param {{ query: (file: string, args: string[]) => Promise<string | null>, now: () => number, monotonic: () => number,
 *   identity: { machine: string, hardwareProfile: string }, uid: number | null, limit: number, freshForMs: number }} ports
 */
export function createProcessInventory(ports) {
  return Object.freeze({
    /** One complete current-user census, decoded by the Ten owner decoder. */
    async census() {
      const { decodeProcessInventory } = await loadTenOwner();
      const id = `inventory:${randomUUID()}`;
      const base = { type: 'ProcessInventory', schemaVersion: 1, id, machine: ports.identity.machine,
        hardwareProfile: ports.identity.hardwareProfile, adapter: ADAPTER, adapterDigest: INVENTORY_ADAPTER_DIGEST,
        freshForMs: ports.freshForMs, cpuBasis: 'process-cpu-time' };
      const failed = () => decodeProcessInventory({ ...base, sourceTime: ports.now(), monotonicAt: ports.monotonic(),
        status: 'failed', examined: 0, omitted: null, processes: [] });
      if (ports.uid === null) return failed();
      const table = await ports.query('/bin/ps', ['-U', String(ports.uid), '-ww', '-o', CENSUS_COLUMNS]);
      const sourceTime = ports.now(), monotonicAt = ports.monotonic();
      if (table === null) return failed();
      const lines = table.split('\n').filter(line => line.trim());
      const rows = [];
      let unreadable = 0;
      for (const line of lines.slice(0, ports.limit)) { const row = parseRow(line, id); if (row) rows.push(row); else unreadable++; }
      const omitted = Math.max(0, lines.length - ports.limit) + unreadable;
      return decodeProcessInventory({ ...base, sourceTime, monotonicAt, status: omitted ? 'partial' : 'complete',
        examined: rows.length, omitted, processes: rows });
    },
    /** Working directories of the named processes only; an unreadable one is `unavailable`. */
    async workingDirectories(pids) {
      const found = new Map();
      if (!pids.length) return found;
      const text = await ports.query('/usr/sbin/lsof', ['-a', '-d', 'cwd', '-p', pids.join(','), '-Fpn', '-w']);
      let current = null;
      for (const line of (text ?? '').split('\n')) {
        if (line.startsWith('p')) current = Number(line.slice(1));
        else if (line.startsWith('n') && current !== null && line.slice(1).startsWith('/')) found.set(current, { state: 'observed', path: line.slice(1) });
      }
      for (const pid of pids) if (!found.has(pid)) found.set(pid, { state: 'unavailable' });
      return found;
    },
    /** Which of `areas`' sandbox instances holds each named process (Ten's SandboxReading); an unreadable one is `unavailable`. */
    async sandboxes(pids, areas) {
      const found = new Map();
      if (!pids.length) return found;
      const text = areas.length ? await ports.query('/usr/bin/python3', ['-c', SANDBOX_READER, String(areas.length), ...areas, ...pids.map(String)]) : '';
      for (const line of (text ?? '').split('\n')) {
        const [pid, verdict, index] = line.trim().split(' ');
        if (verdict === 'none') found.set(Number(pid), { state: 'observed', area: null });
        else if (verdict === 'in' && areas[Number(index)] !== undefined) found.set(Number(pid), { state: 'observed', area: areas[Number(index)] });
      }
      for (const pid of pids) if (!found.has(pid)) found.set(pid, { state: 'unavailable' });
      return found;
    },
  });
}
