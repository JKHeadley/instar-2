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

// The guard 'deadline' fault case arms an immutable deadline before the guard and its
// sandbox bootstrap exist, so readiness cannot arm it. This compiles the actual case
// with a guard double that is slow to report readiness (the Studio full-suite load
// gap), and proves both sides: alive before the deadline and ended after it.
it('the guard deadline case survives a slow arm and still refuses an early, a missing and a too-soon deadline', () => {
  const source = readFileSync('scripts/fixed-native-worker-enforcer.c', 'utf8');
  const cases = source.slice(source.indexOf('    /* The deadline case arms'), source.indexOf('    /* Both sides of every backstop bound'))
    .replace('ARM_MS = 3000', 'ARM_MS = 900')               // scaled arm bound for a quick test
    .replace('for (int f = 0; f < 5; f++)', 'for (int f = 3; f < 4; f++)');   // the deadline case only
  expect(cases).toContain('DEADLINE_CASE_MS');
  const driver = (body: string) => `
#define _DEFAULT_SOURCE
#include <sys/socket.h>
#include <sys/wait.h>
#include <poll.h>
#include <unistd.h>
#include <signal.h>
#include <stdarg.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#define VERDICT(ok) ((ok) ? "PASS" : "FAIL")
#define BACKSTOP_NONE 0
static char self_path[] = "test", uid_s[] = "1", gid_s[] = "1";
typedef struct { pid_t pid; int link; } guard_t;
static uint64_t now_ms(void) {
  struct timespec t; clock_gettime(CLOCK_MONOTONIC, &t);
  return (uint64_t)t.tv_sec * 1000 + t.tv_nsec / 1000000;
}
static uint64_t mach_continuous_time(void) { return now_ms(); }
static uint64_t ms_to_ticks(uint64_t ms) { return ms; }
static int child_stopped(pid_t pid) { (void)pid; return 0; }
static int guard_backstop(int s, uint64_t n, uint64_t d, int a, uint64_t o, uint64_t l) {
  (void)s; (void)n; (void)d; (void)a; (void)o; (void)l; return BACKSTOP_NONE;
}
static int alive(pid_t pid) { return pid > 0 && kill(pid, 0) == 0; }
static void die(const char *what) { perror(what); exit(9); }
static int report(const char *label, const char *verdict, const char *fmt, ...) {
  printf("%s=%s ", label, verdict);
  va_list ap; va_start(ap, fmt); vprintf(fmt, ap); va_end(ap); printf("\\n"); fflush(stdout);
  return strcmp(verdict, "PASS") != 0;
}
static int read_line(int fd, char *line, size_t cap, uint64_t deadline) {
  (void)deadline;
  for (size_t i = 0; i + 1 < cap; i++) {
    if (read(fd, line+i, 1) != 1) return -1;
    if (line[i] == '\\n') { line[i] = 0; return 0; }
  }
  return -1;
}
/* mode 0: ends the worker at its deadline; 1: 250 ms before it; 2: never. */
static int mode, arm_delay_ms;
static int spawn_guard(guard_t *g, char *const argv[], int channel) {
  (void)channel;
  uint64_t deadline = strtoull(argv[8], NULL, 10);
  int sp[2]; if (socketpair(AF_UNIX, SOCK_STREAM, 0, sp)) return -1;
  g->pid = fork();
  if (g->pid < 0) return -1;
  if (g->pid == 0) {
    close(sp[0]);
    pid_t guard = getpid(), worker = fork();
    if (worker < 0) _exit(2);
    if (worker == 0) { close(sp[1]); while (getppid() == guard) usleep(10000); _exit(0); }
    usleep((useconds_t)arm_delay_ms * 1000);           /* the slow arm under host load */
    dprintf(sp[1], "S %d\\n", worker);
    uint64_t end = mode == 0 ? deadline : mode == 1 ? deadline - 250 : UINT64_MAX;
    for (;;) {
      struct pollfd p = { .fd = sp[1], .events = POLLIN };
      if (poll(&p, 1, 5) > 0) { char b[64]; if (read(sp[1], b, sizeof b) <= 0) break; }
      if (now_ms() >= end) break;
    }
    kill(worker, SIGKILL); waitpid(worker, NULL, 0); _exit(0);
  }
  close(sp[1]); g->link = sp[0]; return 0;
}
static int guard_cases(const char *profile) {
  int failures = 0;
${body}
  return failures;
}
int main(int argc, char **argv) {
  signal(SIGPIPE, SIG_IGN);
  if (argc != 3) return 7;
  mode = atoi(argv[1]); arm_delay_ms = atoi(argv[2]);
  return guard_cases("-");
}
`;
  const dir = mkdtempSync(join(tmpdir(), 'instar-deadline-'));
  const compile = (name: string, body: string) => {
    writeFileSync(join(dir, `${name}.c`), driver(body));
    const cc = spawnSync('cc', ['-std=c11', '-U_FORTIFY_SOURCE', '-O2', '-Wall', '-Wextra', '-Werror', join(dir, `${name}.c`), '-o', join(dir, name)], { encoding: 'utf8' });
    expect(cc.status, cc.stderr).toBe(0);
    return (mode: number, armDelay: number) => spawnSync(join(dir, name), [String(mode), String(armDelay)], { encoding: 'utf8', timeout: 10_000 });
  };
  try {
    const shipped = compile('shipped', cases);
    // A slow arm (well past the old 800 ms) no longer spends the deadline before observation.
    const slow = shipped(0, 1000);
    expect(slow.status, slow.stdout + slow.stderr).toBe(0);
    expect(slow.stdout).toMatch(/^guard-deadline=PASS worker ended=yes after \d+ms \(deadline case: 1700ms from arm, alive before and ended after it\)\n$/);
    // An end before the deadline, and no end at all, still FAIL.
    const early = shipped(1, 0);
    expect(early.stdout).toMatch(/^guard-deadline=FAIL worker ended=yes after \d+ms BEFORE its deadline /);
    expect(early.status).toBe(1);
    const never = shipped(2, 0);
    expect(never.stdout).toMatch(/^guard-deadline=FAIL worker ended=NO /);
    expect(never.status).toBe(1);
    // Control: arming the old 800 ms deadline makes the same slow arm FAIL (the recorded defect).
    const old = compile('old', cases.replace('f == 3 ? DEADLINE_CASE_MS : 20000', 'f == 3 ? 800 : 20000'));
    const recorded = old(0, 1000);
    expect(recorded.stdout).toMatch(/^guard-deadline=FAIL worker ended=yes after 0ms /);
    expect(recorded.status).toBe(1);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}, 60_000);
