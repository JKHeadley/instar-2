// Portable orchestration check: execute the actual C feasibility driver with a
// pipe-backed guard double. Native ptrace/exit attribution remains a macOS check.
import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

it('waits for payload readiness while heartbeating, and never injects a kill without readiness', () => {
  const source = readFileSync('scripts/fixed-native-worker-enforcer.c', 'utf8');
  const driver = source.slice(source.indexOf('enum { FAULT_NONE'), source.indexOf('static int run_guarded(run_t'));
  const controls = source.slice(source.indexOf('    run_t n[6]'), source.indexOf('    n[3] = (run_t)'))
    .replaceAll('run_guarded_fault(', 'control_fault(').replaceAll('run_guarded(', 'control_run(');
  const dir = mkdtempSync(join(tmpdir(), 'instar-ready-'));
  try {
    writeFileSync(join(dir, 'driver.c'), `
#define _DEFAULT_SOURCE
#include <sys/socket.h>
#include <sys/wait.h>
#include <poll.h>
#include <unistd.h>
#include <signal.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#define HEARTBEAT_MS 20
static char self_path[] = "test", uid_s[] = "1", gid_s[] = "1";
typedef struct { int reason; int status; int detail; pid_t worker; uint64_t wall_ms; int started; } run_t;
typedef struct { pid_t pid; int link; } guard_t;
static uint64_t now_ms(void) {
  struct timespec t; clock_gettime(CLOCK_MONOTONIC, &t);
  return (uint64_t)t.tv_sec * 1000 + t.tv_nsec / 1000000;
}
static uint64_t mach_continuous_time(void) { return now_ms(); }
static uint64_t ms_to_ticks(uint64_t ms) { return ms; }
static int read_line(int fd, char *line, size_t cap, uint64_t deadline) {
  (void)deadline;
  for (size_t i = 0; i + 1 < cap; i++) {
    if (read(fd, line+i, 1) != 1) return -1;
    if (line[i] == '\\n') { line[i] = 0; return 0; }
  }
  return -1;
}
static int mode;
static int spawn_guard(guard_t *g, char *const argv[], int channel) {
  (void)argv;
  int sp[2]; if (socketpair(AF_UNIX, SOCK_STREAM, 0, sp)) return -1;
  g->pid = fork();
  if (g->pid < 0) return -1;
  if (g->pid == 0) {
    close(sp[0]);
    int release[2]; if (pipe(release)) _exit(2);
    pid_t worker = fork();
    if (worker < 0) _exit(2);
    if (worker == 0) {
      close(sp[1]); close(release[1]);
      usleep(350000); /* exceeds the old guessed 100ms, without CPU load */
      char go; if (read(release[0], &go, 1) != 1) _exit(4);
      close(release[0]);
      if (mode == 0) { if (write(channel, "R", 1) != 1) _exit(4); }
      else if (mode == 2) { if (write(channel, "X", 1) != 1) _exit(4); }
      if (mode != 1) close(channel);
      for (;;) pause();
    }
    close(channel); close(release[0]);
    dprintf(sp[1], "S %d\\n", worker);
    uint64_t start = now_ms();
    int status = 0, beats = 0, released = 0;
    for (;;) {
      struct pollfd p = { .fd = sp[1], .events = POLLIN };
      if (poll(&p, 1, 5) > 0) { char b[64]; ssize_t count = read(sp[1], b, sizeof b); if (count > 0) beats += (int)count; }
      if (beats >= 5 && !released) { if (write(release[1], "G", 1) != 1) _exit(4); close(release[1]); released = 1; }
      if (waitpid(worker, &status, WNOHANG) == worker) {
        int reason = mode == 0 && now_ms() - start >= 350 && beats >= 5 ? 0 : 35;
        dprintf(sp[1], "T %d %d 0\\n", reason, status); _exit(0);
      }
      if (now_ms() - start > (mode == 0 ? 3000 : 650)) {
        kill(worker, SIGKILL); waitpid(worker, &status, 0);
        dprintf(sp[1], "T 30 %d 0\\n", status); _exit(0);
      }
    }
  }
  close(sp[1]); g->link = sp[0]; return 0;
}
${driver}
#define END_WORKER 0
#define END_DEADLINE 30
#define END_LAPSE 31
static int controls_run;
static int control_fault(run_t *out, const char *cpu, const char *mem, const char *profile,
                         uint64_t life, char *const payload[], int fault) {
  (void)cpu; (void)mem; (void)profile; (void)life; (void)payload;
  controls_run++;
  out->reason = fault == FAULT_SILENT ? END_LAPSE : END_DEADLINE;
  return fault == FAULT_KILL ? -1 : 0; /* first control fails; next two must still run */
}
static int control_run(run_t *out, const char *cpu, const char *mem, const char *profile,
                       uint64_t life, char *const payload[]) {
  return control_fault(out, cpu, mem, profile, life, payload, FAULT_NONE);
}
static int check_controls(void) {
  const char *profile = "-";
${controls}
  return controls_run == 3 && !okn && n[1].reason == 30 && n[2].reason == 31 ? 0 : 3;
}
int main(void) {
  signal(SIGPIPE, SIG_IGN);
  char *payload[] = { "probe", NULL };
  for (mode = 0; mode < 4; mode++) {
    run_t r;
    if (run_guarded_fault(&r, "-", "-", "-", 1000, payload, FAULT_KILL)) return 1;
    printf("mode=%d reason=%d signal=%d\\n", mode, r.reason, WIFSIGNALED(r.status) ? WTERMSIG(r.status) : 0);
    if (r.reason != (mode == 0 ? 0 : 30)) return 2;
  }
  return check_controls();
}
`);
    const build = spawnSync('cc', ['-std=c11', '-U_FORTIFY_SOURCE', '-O2', '-Wall', '-Wextra', '-Werror', join(dir, 'driver.c'), '-o', join(dir, 'driver')], { encoding: 'utf8' });
    expect(build.status, build.stderr).toBe(0);
    const run = spawnSync(join(dir, 'driver'), [], { encoding: 'utf8', timeout: 5000 });
    expect(run.status, run.stdout + run.stderr).toBe(0);
    expect(run.stdout).toBe('mode=0 reason=0 signal=9\nmode=1 reason=30 signal=9\nmode=2 reason=30 signal=9\nmode=3 reason=30 signal=9\n');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
