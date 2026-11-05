// Part Ten's physical process-inventory adapter (SEAM-LEDGER rows 40/63): one batched,
// read-only census of every current-user process, decoded by the Ten owner decoder in
// src/assembly/process-inventory.ts. It signals nothing and holds no control authority.
// A refused or failed read is a `failed` census with no rows, never an empty population;
// a census past its bound is `partial` with its omitted count.
import { createHash, randomUUID } from 'node:crypto';
import { lstatSync, opendirSync, realpathSync } from 'node:fs';
import { join } from 'node:path';

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
// Darwin's public proc_bsdinfo ABI: no names/argv are returned to the caller.
// Microsecond start identity avoids ps lstart's one-second PID-reuse ambiguity.
export const PROCESS_INCARNATION_READER = `import ctypes, json, sys
lib = ctypes.CDLL('/usr/lib/libproc.dylib', use_errno=True)
class Info(ctypes.Structure):
    _fields_ = [('head', ctypes.c_uint32 * 12), ('names', ctypes.c_char * 48),
                ('tail', ctypes.c_uint32 * 6), ('seconds', ctypes.c_uint64), ('micros', ctypes.c_uint64)]
ask = lib.proc_pidinfo
ask.argtypes = [ctypes.c_int, ctypes.c_int, ctypes.c_uint64, ctypes.c_void_p, ctypes.c_int]
ask.restype = ctypes.c_int
for pid in map(int, sys.argv[1:]):
    b = Info()
    if ctypes.sizeof(b) == 136 and ask(pid, 3, 0, ctypes.byref(b), ctypes.sizeof(b)) == ctypes.sizeof(b) and b.head[3] == pid:
        print(json.dumps([pid, int(b.head[5]), str(b.seconds) + ':' + str(b.micros)]))
    else: print(json.dumps([pid, None, None]))
`;
const REFERENCE_FIELDS = '-FpfDti'; // Deliberately excludes n (private names), command and socket addresses.
export const INVENTORY_ADAPTER_DIGEST = `sha256:${createHash('sha256').update(JSON.stringify([ADAPTER, CENSUS_COLUMNS, '-a -d cwd -Fpn', SANDBOX_READER, PROCESS_INCARNATION_READER, REFERENCE_FIELDS])).digest('hex')}`;

/** Only known checkout objects; never follow a symlink into private/unrelated trees.
 * Inode aliases can match even when lsof's display name differs. Unlinked objects
 * no longer reachable from this tree are NOT proved absent by this enumeration. */
function checkoutObjects(path) {
  const objects = new Set(), pending = [path];
  let examined = 0;
  try {
    if (!path.startsWith('/') || path === '/' || realpathSync(path) !== path) return null;
    while (pending.length) {
      if (++examined > 4096) return null;
      const current = pending.pop(), stat = lstatSync(current, { bigint: true });
      if (stat.isSymbolicLink()) return null;
      objects.add(`${stat.dev}:${stat.ino}`);
      if (!stat.isDirectory()) continue;
      const directory = opendirSync(current);
      try {
        for (let entry; (entry = directory.readSync()) !== null;) {
          if (examined + pending.length >= 4096) return null;
          pending.push(join(current, entry.name));
        }
      } finally { directory.closeSync(); }
    }
    return objects;
  } catch { return null; }
}

function incarnations(text, rows) {
  try {
    const lines = text.trim().split('\n').map(line => JSON.parse(line));
    if (lines.length !== rows.length) return null;
    const found = new Map();
    for (const [pid, uid, start] of lines) {
      if (found.has(pid) || !rows.some(row => row.pid === pid && row.uid === uid)
        || typeof start !== 'string' || !/^\d+:\d{1,6}$/u.test(start)) return null;
      found.set(pid, start);
    }
    return found;
  } catch { return null; }
}

/** lsof is positive evidence only. Error records may have no device/inode, and
 * even a clean exit does not certify all mappings or an atomic reference scan. */
function referenceMatches(text, pid, objects) {
  if (typeof text !== 'string' || !text.endsWith('\n') || text.length > 1024 * 1024) return null;
  const matches = new Set();
  let selected = false, record = null, records = 0, malformed = false;
  const finish = () => {
    if (!record) return;
    if (++records > 16384) { malformed = true; return; }
    if (!/^(?:0x)?[0-9a-f]+$/iu.test(record.D ?? '') || !/^\d+$/u.test(record.i ?? '')) return;
    const identity = `${BigInt(`0x${record.D.replace(/^0x/iu, '')}`)}:${BigInt(record.i)}`;
    if (objects.has(identity)) matches.add(/^\d/u.test(record.f) ? 'fd' : record.f === 'txt' ? 'mapping' : 'vnode');
  };
  for (const line of text.slice(0, -1).split('\n')) {
    const key = line[0], value = line.slice(1);
    if (key === 'p') { if (selected || value !== String(pid)) return null; selected = true; }
    else if (key === 'f' && selected) { finish(); record = { f: value }; }
    else if (['D', 'i', 't'].includes(key) && record && record[key] === undefined) record[key] = value;
    else return null;
  }
  finish();
  return selected && records > 0 && !malformed ? [...matches].sort() : null;
}

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
    /** One complete census of the current user (and the harness user, when set), decoded by the Ten owner decoder. */
    async census() {
      const { decodeProcessInventory } = await loadTenOwner();
      const id = `inventory:${randomUUID()}`;
      const base = { type: 'ProcessInventory', schemaVersion: 1, id, machine: ports.identity.machine,
        hardwareProfile: ports.identity.hardwareProfile, adapter: ADAPTER, adapterDigest: INVENTORY_ADAPTER_DIGEST,
        freshForMs: ports.freshForMs, cpuBasis: 'process-cpu-time' };
      const failed = () => decodeProcessInventory({ ...base, sourceTime: ports.now(), monotonicAt: ports.monotonic(),
        status: 'failed', examined: 0, omitted: null, processes: [] });
      // The current user, and the harness's own user when the runner launches the harness as it (`uids`).
      const uids = typeof ports.uids === 'function' ? ports.uids() : [ports.uid];
      if (!uids.length || uids.some(uid => !Number.isSafeInteger(uid))) return failed();
      const table = await ports.query('/bin/ps', ['-U', uids.map(String).join(','), '-ww', '-o', CENSUS_COLUMNS]);
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
    /** Bounded current-reference observations, not a non-ownership certificate.
     * Stable incarnations bracket the reads, but FD transfer can hide a holder
     * between per-process reads. No-match MUST stay unknown at the owner join.
     * Rules 26/42/60/95: no contents, private names, signals or new authority. */
    async checkoutReferences(snapshot, checkout, guard = () => {}) {
      const rows = snapshot.processes.filter(row => !row.zombie);
      const unknown = reason => ({ processSample: snapshot.id, coverage: 'non-atomic', reason,
        processes: new Map(rows.map(row => [row.pid, { state: 'unknown', incarnation: null, kinds: [] }])) });
      const began = ports.monotonic();
      const timely = () => {
        guard();
        const elapsed = ports.monotonic() - began;
        return ports.now() >= snapshot.sourceTime && ports.now() - snapshot.sourceTime <= snapshot.freshForMs
          && elapsed >= 0 && elapsed <= Math.min(30000, snapshot.freshForMs);
      };
      if (process.platform !== 'darwin' || snapshot.status !== 'complete' || snapshot.omitted !== 0
        || snapshot.examined !== snapshot.processes.length || snapshot.machine !== ports.identity.machine
        || rows.length === 0 || rows.length > 64 || !timely()) return unknown('census-unavailable');
      const objects = checkoutObjects(checkout);
      if (!objects) return unknown('checkout-objects-unavailable');
      const args = ['-c', PROCESS_INCARNATION_READER, ...rows.map(row => String(row.pid))];
      const before = incarnations(await ports.query('/usr/bin/python3', args), rows);
      if (!before || !timely()) return unknown('incarnation-unavailable');
      const observed = new Map();
      for (const row of rows) {
        if (!timely()) return unknown('scan-expired');
        const text = await ports.query('/usr/sbin/lsof', ['-n', '-P', '+w', '-a', '-p', String(row.pid), REFERENCE_FIELDS]);
        observed.set(row.pid, referenceMatches(text, row.pid, objects));
      }
      const after = incarnations(await ports.query('/usr/bin/python3', args), rows);
      const population = await this.census();
      const samePopulation = population.status === 'complete' && population.omitted === 0
        && population.processes.length === snapshot.processes.length
        && snapshot.processes.every(row => population.processes.some(p => p.pid === row.pid && p.start === row.start
          && p.uid === row.uid && p.ppid === row.ppid && p.pgid === row.pgid && p.zombie === row.zombie));
      const currentObjects = checkoutObjects(checkout);
      if (!after || !samePopulation || rows.some(row => before.get(row.pid) !== after.get(row.pid))
        || !currentObjects || currentObjects.size !== objects.size || [...objects].some(id => !currentObjects.has(id))
        || !timely()) return unknown('scan-changed');
      return { processSample: snapshot.id, coverage: 'non-atomic', reason: 'sequential-reference-observations',
        processes: new Map(rows.map(row => {
          const kinds = observed.get(row.pid);
          return [row.pid, { state: kinds === null ? 'unknown' : kinds.length ? 'reference' : 'no-match',
            incarnation: before.get(row.pid), kinds: kinds ?? [] }];
        })) };
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
