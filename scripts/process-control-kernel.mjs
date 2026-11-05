// Part Ten physical process-control boundary. No PID-only kill path exists here.
// Linux pidfd pins the kernel process before action-time identity observation; a
// reused numeric PID can never redirect the signal. Authority is supplied only
// by Eight/Six at the caller, not by this read-only identity lookup.
import { spawnSync } from 'node:child_process';

export const PROCESS_CONTROL_KERNEL_HELPER = String.raw`
import hashlib, json, os, select, signal, sys

def emit(state, detail, **fields):
    print(json.dumps(dict(state=state, detail=detail, **fields)))

def stat(pid):
    with open('/proc/%d/stat' % pid, 'r') as f: raw = f.read()
    # comm may contain whitespace and closing parentheses. Fields after its LAST
    # closing parenthesis begin at field 3; starttime is field 22.
    fields = raw[raw.rfind(')') + 2:].split()
    return int(fields[1]), fields[19]

def identity(pid):
    parent, start = stat(pid)
    _, parent_start = stat(parent)
    executable = os.readlink('/proc/%d/exe' % pid)
    with open('/proc/%d/cmdline' % pid, 'rb') as f: raw = f.read(65537)
    if len(raw) > 65536 or not raw.endswith(b'\0'): raise ValueError('unreadable ordered argv')
    argv_digest = 'sha256:'+hashlib.sha256(raw).hexdigest()
    # Start identities include boot identity: ticks alone repeat after a reboot.
    with open('/proc/sys/kernel/random/boot_id') as f: boot = f.read().strip()
    return dict(pid=pid, parentPid=parent, startIdentity=boot+':'+start,
                parentStartIdentity=boot+':'+parent_start, executable=executable, argvDigest=argv_digest)

def same(actual, expected):
    return all(expected.get(key) == value for key, value in actual.items())

request = json.load(sys.stdin)
mode = request['mode']; target = request.get('target', {}); pid = request.get('pid', target.get('pid'))
fd = None
lineage = []
def pin_lineage(child_pid, root):
    if not isinstance(root, dict) or not isinstance(root.get('pid'), int) or root['pid'] <= 1 or root['pid'] == child_pid:
        raise ValueError('registered worker root required; target must be a descendant')
    with open('/proc/sys/kernel/random/boot_id') as f: boot = f.read().strip()
    seen = {child_pid}; ancestor = stat(child_pid)[0]
    for _ in range(128):
        if ancestor <= 1 or ancestor in seen: raise ValueError('target is outside registered worker ancestry')
        seen.add(ancestor)
        handle = os.pidfd_open(ancestor)
        probe = select.poll(); probe.register(handle, select.POLLIN)
        try:
            parent, start = stat(ancestor)
        except Exception:
            os.close(handle)
            raise
        lineage.append((handle, probe, ancestor, parent, start))
        if probe.poll(0): raise ValueError('worker ancestry exited during observation')
        if ancestor == root['pid']:
            if boot+':'+start != root.get('startIdentity'): raise ValueError('registered worker root incarnation changed')
            return
        ancestor = parent
    raise ValueError('worker ancestry observation bound exhausted')

def lineage_current():
    return all(not probe.poll(0) and stat(pid) == (parent, start)
               for _, probe, pid, parent, start in lineage)
try:
    if not isinstance(pid, int) or isinstance(pid, bool) or pid <= 1: raise ValueError('invalid exact PID')
    if not hasattr(os, 'pidfd_open') or not hasattr(signal, 'pidfd_send_signal'):
        raise ValueError('kernel identity capability unavailable')
    # Open BEFORE any identity read. An exited process remains this exact kernel
    # object even if procfs is subsequently showing a new occupant of its PID.
    fd = os.pidfd_open(pid)
    poll = select.poll(); poll.register(fd, select.POLLIN)
    if poll.poll(0):
        emit('exited' if mode != 'signal' else 'refused', 'pinned process has exited')
    else:
        actual = identity(pid)
        if poll.poll(0):
            emit('exited' if mode != 'signal' else 'refused', 'pinned process exited during identity read')
        elif mode == 'inspect':
            emit('observed', 'kernel-pinned identity observation', identity=actual)
        elif not same(actual, target):
            # Changed incarnation proves old target absent; a changed argv or
            # parent does not. Neither permits a signal.
            gone = actual['startIdentity'] != target.get('startIdentity')
            emit('refused' if mode == 'signal' else 'exited' if gone else 'unknown', 'exact process identity changed')
        elif mode == 'observe':
            pin_lineage(pid, request.get('workerRoot'))
            if not lineage_current() or poll.poll(0): raise ValueError('worker ancestry changed')
            emit('running', 'exact target independently observed running')
        elif mode == 'signal':
            selected = request.get('signal')
            if selected not in ('SIGINT', 'SIGTERM', 'SIGKILL'): raise ValueError('unsupported signal')
            pin_lineage(pid, request.get('workerRoot'))
            # Re-observe the complete target immediately at the action boundary.
            # The pidfd, rather than this precheck, closes the PID-reuse race.
            if poll.poll(0) or not lineage_current() or not same(identity(pid), target):
                emit('refused', 'target changed at action boundary')
            else:
                signal.pidfd_send_signal(fd, getattr(signal, selected))
                emit('signalled', 'signal submitted to pinned kernel identity')
        else:
            raise ValueError('unsupported operation')
except ProcessLookupError:
    # ESRCH from an ANCESTOR lookup does not say the target died. It may have
    # reparented while remaining alive. Only the original target handle decides.
    gone = fd is None or bool(poll.poll(0))
    emit('refused' if mode == 'signal' else 'exited' if gone else 'unknown',
         'exact process is absent' if gone else 'worker ancestry unavailable; target exit unproved')
except (PermissionError, FileNotFoundError, OSError, ValueError, KeyError) as error:
    # A procfs read failure is not proof of death. Only ESRCH from the pinned
    # kernel lookup (above) can supply absence without the full identity.
    emit('refused' if mode == 'signal' else 'unknown', str(error))
finally:
    if fd is not None: os.close(fd)
    for handle, _, _, _, _ in lineage: os.close(handle)
`;

function query(input) {
  if (process.platform !== 'linux') return { state: input.mode === 'signal' ? 'refused' : 'unknown', detail: 'kernel-pinned process control unsupported on this host' };
  const result = spawnSync('/usr/bin/python3', ['-I', '-c', PROCESS_CONTROL_KERNEL_HELPER], {
    input: JSON.stringify(input), encoding: 'utf8', timeout: 2000, maxBuffer: 131072,
  });
  // A timed-out signal may already have happened. Retain UNKNOWN, never retry
  // based on a helper failure. A new observer may establish quiescence later.
  if (result.error || result.status !== 0) return { state: 'unknown', detail: 'kernel helper did not return a complete observation' };
  try {
    const resultBody = JSON.parse(result.stdout);
    if (!resultBody || typeof resultBody.state !== 'string' || typeof resultBody.detail !== 'string') throw Error('invalid response');
    // Parent-owned wait status is about the one-shot actuator, NOT the target.
    // A completed actuator cannot submit another delayed signal. Target exit
    // and signal occurrence still require their own independent observations.
    return input.mode === 'signal' ? { ...resultBody,
      actuatorExit: { pid: result.pid, code: result.status, signal: result.signal } } : resultBody;
  } catch { return { state: 'unknown', detail: 'kernel helper observation unreadable' }; }
}

/** Observation only: never establishes custody, membership, permission or standing. */
export function readExactProcessIdentity(pid) { return query({ mode: 'inspect', pid }); }

/** Bind machine/incarnation at trusted composition; callers cannot select a host. */
export function createKernelProcessControl(binding) {
  const current = target => target?.machine === binding.machine && target?.incarnation === binding.incarnation;
  const workerRoot = binding.workerRoot ? Object.freeze({ ...binding.workerRoot }) : null;
  return Object.freeze({
    workerRoot,
    signal(target, selected) {
      if (!current(target)) return { state: 'refused', detail: 'target machine or owner incarnation differs' };
      return query({ mode: 'signal', target, signal: selected, workerRoot });
    },
    observe(target) {
      if (!current(target)) return { state: 'unknown', detail: 'target machine or owner incarnation differs' };
      return query({ mode: 'observe', target, workerRoot });
    },
  });
}
