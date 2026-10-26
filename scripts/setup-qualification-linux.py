"""One disposable cgroup child; no setup authority, retries, or live state."""
import json
import os
from pathlib import Path
import resource
import subprocess
import sys
import tempfile
import time

request = json.load(sys.stdin)
profile = request['profile']
started = time.monotonic()
relative = Path('/proc/self/cgroup').read_text().strip().split('::', 1)[1]
cgroup = Path('/sys/fs/cgroup' + relative)
controls = {name: (cgroup / name).read_text().strip() for name in
            ['memory.max', 'memory.swap.max', 'cpu.max', 'pids.max']}
quota, period = map(int, controls['cpu.max'].split())
assert controls['memory.max'] == str(profile['memoryBytes'])
assert controls['memory.swap.max'] == '0'
assert controls['pids.max'] == str(profile['processCount'])
assert quota == 2 * period

def stopped():
    try:
        return json.loads(Path(request['stopFile']).read_text()).get('stopped') is not False or (request.get('stopRequestFile') is not None and Path(request['stopRequestFile']).exists())
    except (OSError, ValueError):
        return True

reason = None
code = None
pid = None
output = ''
errors = ''
with tempfile.TemporaryFile(dir=request['root']) as out, tempfile.TemporaryFile(dir=request['root']) as err, tempfile.TemporaryFile(dir=request['root']) as inp:
    inp.write(request['stdin'].encode()); inp.seek(0)
    if stopped():
        reason = 'stopped'
    else:
        try:
            child = subprocess.Popen([request['executable'], *request['args']], stdin=inp, stdout=out, stderr=err,
                                     cwd=request['root'], env={'PATH': '/usr/bin:/bin', 'OMP_NUM_THREADS': '2'})
            pid = child.pid
            with open(Path(request['root']) / f'linux-child-{pid}.json', 'x') as record:
                json.dump({'pid': pid, 'cgroup': relative, 'controls': controls}, record)
                record.flush(); os.fsync(record.fileno())
            while child.poll() is None:
                if stopped():
                    reason = 'stopped'
                elif (time.monotonic() - started) * 1000 >= profile['deadlineMs']:
                    reason = 'timeout'
                elif os.fstat(out.fileno()).st_size > 65536 or os.fstat(err.fileno()).st_size > 65536:
                    reason = 'output limit'
                if reason:
                    # Popen owns this exact unreaped PID. Never signal a group or pattern.
                    child.kill()
                    break
                time.sleep(0.05)
            code = child.wait()
        except OSError as error:
            reason = 'model unavailable: ' + str(error)
        out.seek(0); err.seek(0)
        output = out.read(65536).decode(errors='replace')
        errors = err.read(65536).decode(errors='replace')
peers = (cgroup / 'cgroup.procs').read_text().split()
cleanup = 'verified' if peers == [str(os.getpid())] else 'unresolved'
result = {'stdout': output, 'rawError': errors, 'code': code, 'limited': bool(reason) or code != 0,
          'cancellationReason': reason, 'localLimit': reason, 'pid': pid,
          'cgroup': {'path': relative, 'controls': controls,
                     'memoryPeakBytes': int((cgroup / 'memory.peak').read_text()),
                     'memoryEvents': (cgroup / 'memory.events').read_text(),
                     'cpuStat': (cgroup / 'cpu.stat').read_text()},
          'resources': {'peakMemoryBytes': resource.getrusage(resource.RUSAGE_CHILDREN).ru_maxrss * 1024,
                        'cleanup': cleanup, 'enforcement': 'systemd cgroup v2; independent wall deadline'}}
print(json.dumps(result))
