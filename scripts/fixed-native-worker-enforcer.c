/*
 * Fixed M4-L native enforcer (M2). One C artifact, system libraries only.
 *
 * Roles:
 *   client               unprivileged: one canonical frame stdin -> fixed socket -> reply stdout
 *   channel <identity>   unprivileged: the owner's end of one launched worker's channel
 *                        (stdin -> worker, worker -> stdout, any byte on fd 3 = owner progress)
 *   supervise            installed service: installed configuration, peer-checked control
 *                        socket, the owner decision service, one accounted worker slot
 *   guard ...            internal: parent AND ptrace tracer of exactly one worker; enforces
 *                        the immutable deadline, supervisor heartbeat, CPU and memory limits
 *   bootstrap ...        internal: trace-me, new session, limits, privilege drop, gate, exec
 *   journal-sync <path>  durable journal primitive: F_FULLFSYNC of one owner-only
 *                        regular journal file and then its directory; refuses otherwise
 *   feasibility <case>   the package's native feasibility cases; prints PASS/FAIL/UNVERIFIED
 *   probe <payload>      deterministic attack payloads run INSIDE the confined chain
 *
 * Termination identity (why no PID lookup is ever used): the guard is the worker's
 * parent. A child that its parent has not reaped keeps its PID, so the guard's kill
 * of its own unreaped child cannot reach another process, and the PID is the same
 * process through every exec. The guard is also the worker's tracer, so (a) every
 * signal the kernel sends the worker, even one it ignores, stops it and is seen by
 * the guard first, and (b) when the guard dies for any reason the kernel kills the
 * traced worker. A Mach task right is not used: it does not survive exec.
 *
 * Build (recorded): /usr/bin/clang -std=c11 -O2 -Wall -Wextra -Werror \
 *   -o instar-worker-enforcer scripts/fixed-native-worker-enforcer.c
 * Test builds may add -DINSTAR_CONTROL_SOCKET='"<temp path>"',
 * -DINSTAR_CONTROL_PEER_UID=<uid>, -DINSTAR_INSTALL_CONF='"<temp path>"' and
 * -DINSTAR_TEST_UNPRIVILEGED=1 (configuration owned by the test account; memory
 * limit 0 = not enforced). The release build has none of these and no runtime
 * selector for any of them.
 */
#define _DARWIN_C_SOURCE
#include <arpa/inet.h>
#include <errno.h>
#include <fcntl.h>
#include <grp.h>
#include <libproc.h>
#include <mach/mach_time.h>
#include <mach-o/dyld.h>
#include <netinet/in.h>
#include <poll.h>
#include <pthread.h>
#include <signal.h>
#include <spawn.h>
#include <stdarg.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/mman.h>
#include <sys/proc.h>
#include <sys/ptrace.h>
#include <sys/resource.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <sys/sysctl.h>
#include <sys/time.h>
#include <sys/un.h>
#include <sys/wait.h>
#include <time.h>
#include <unistd.h>

#ifndef INSTAR_CONTROL_SOCKET
#define INSTAR_CONTROL_SOCKET "/private/var/run/instar2-worker/control.sock"
#endif
#ifndef INSTAR_CONTROL_PEER_UID
#define INSTAR_CONTROL_PEER_UID 0   /* the administrator-owned supervisor */
#endif
#ifndef INSTAR_INSTALL_CONF
#define INSTAR_INSTALL_CONF "/Library/Instar2/m4-launch/installation.conf"
#endif
#ifndef INSTAR_SERVICE_CONF
#define INSTAR_SERVICE_CONF "/Library/Instar2/m4-launch/service.json"
#endif
#ifndef INSTAR_TEST_UNPRIVILEGED
#define INSTAR_TEST_UNPRIVILEGED 0
#endif
#define MAX_FRAME 65536u
#define CLIENT_TIMEOUT_MS 1000
#define LAPSE_MS 250                 /* mirrors WORKER_CHANNEL_LIMITS.lapseMs */
#define HEARTBEAT_MS 50
#define RELAY_BUDGET (2u * 1048576u) /* 2 x WORKER_CHANNEL_LIMITS.bytes, both directions */
#define SERVICE_TIMEOUT_MS 5000
#define MAX_TOKEN 512

/* Guard terminal reasons (the guard's exit code and its `T` report). */
enum { END_WORKER = 0, END_DEADLINE = 30, END_LAPSE = 31, END_SUPERVISOR = 32, END_CPU = 33,
       END_MEMORY = 34, END_REFUSED = 35, END_GUARD_LOST = 99 /* supervisor-side: no report */ };

extern char **environ;
extern int memorystatus_control(uint32_t command, int32_t pid, uint32_t flags, void *buffer, size_t size);
static char self_path[4096];

static void die(const char *what) {
  fprintf(stderr, "instar-worker-enforcer: %s: %s\n", what, errno ? strerror(errno) : "refused");
  exit(2);
}

static uint64_t now_ms(void) {
  struct timespec ts;
  clock_gettime(CLOCK_MONOTONIC_RAW, &ts);
  return (uint64_t)ts.tv_sec * 1000u + (uint64_t)ts.tv_nsec / 1000000u;
}

/* The continuous clock (includes sleep), raw ticks and their timebase. */
static mach_timebase_info_data_t timebase(void) {
  static mach_timebase_info_data_t tb;
  if (tb.denom == 0) mach_timebase_info(&tb);
  return tb;
}
static uint64_t ms_to_ticks(uint64_t ms) {
  mach_timebase_info_data_t tb = timebase();
  return ms * 1000000u * tb.denom / tb.numer;
}

static int read_exact(int fd, void *buf, size_t n, uint64_t deadline) {
  size_t got = 0;
  while (got < n) {
    int64_t left = (int64_t)(deadline - now_ms());
    if (left <= 0) { errno = ETIMEDOUT; return -1; }
    struct pollfd p = { .fd = fd, .events = POLLIN };
    int r = poll(&p, 1, (int)left);
    if (r < 0) { if (errno == EINTR) continue; return -1; }
    if (r == 0) { errno = ETIMEDOUT; return -1; }
    ssize_t k = read(fd, (char *)buf + got, n - got);
    if (k < 0) { if (errno == EINTR || errno == EAGAIN) continue; return -1; }
    if (k == 0) { errno = EPIPE; return -1; }
    got += (size_t)k;
  }
  return 0;
}

static int write_exact(int fd, const void *buf, size_t n) {
  size_t put = 0;
  while (put < n) {
    ssize_t k = write(fd, (const char *)buf + put, n - put);
    if (k < 0) { if (errno == EINTR) continue; return -1; }
    put += (size_t)k;
  }
  return 0;
}

/* Bounded write to a peer that may stop draining: refuse after the deadline. */
static int write_bounded(int fd, const void *buf, size_t n, uint64_t deadline) {
  size_t put = 0;
  while (put < n) {
    int64_t left = (int64_t)(deadline - now_ms());
    if (left <= 0) { errno = ETIMEDOUT; return -1; }
    struct pollfd p = { .fd = fd, .events = POLLOUT };
    int r = poll(&p, 1, (int)left);
    if (r < 0) { if (errno == EINTR) continue; return -1; }
    if (r == 0) { errno = ETIMEDOUT; return -1; }
    ssize_t k = write(fd, (const char *)buf + put, n - put);
    if (k < 0) { if (errno == EINTR || errno == EAGAIN) continue; return -1; }
    put += (size_t)k;
  }
  return 0;
}

/* Read one bounded length-prefixed frame (length validated before allocation). */
static unsigned char *read_frame(int fd, uint32_t *len, uint64_t deadline) {
  unsigned char hdr[4];
  if (read_exact(fd, hdr, 4, deadline) != 0) return NULL;
  uint32_t n = ((uint32_t)hdr[0] << 24) | ((uint32_t)hdr[1] << 16) | ((uint32_t)hdr[2] << 8) | hdr[3];
  if (n == 0 || n > MAX_FRAME) { errno = EMSGSIZE; return NULL; }
  unsigned char *buf = malloc(n + 4);
  if (!buf) return NULL;
  memcpy(buf, hdr, 4);
  if (read_exact(fd, buf + 4, n, deadline) != 0) { free(buf); return NULL; }
  *len = n;
  return buf;
}

/* Kernel-attested identity of a connected local socket's peer. */
static int peer_identity(int fd, uid_t *uid, pid_t *pid) {
  gid_t gid;
  if (getpeereid(fd, uid, &gid) != 0) return -1;
  socklen_t len = sizeof *pid;
  return getsockopt(fd, SOL_LOCAL, LOCAL_PEERPID, pid, &len);
}

/* A token that crosses a process boundary: bounded, no whitespace or separators
 * a line protocol could misread. */
static int token_ok(const char *s) {
  size_t n = strlen(s);
  if (n == 0 || n > MAX_TOKEN) return 0;
  for (size_t i = 0; i < n; i++) {
    char c = s[i];
    if (!((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9')
          || c == ':' || c == '.' || c == '_' || c == '/' || c == '@' || c == '+' || c == '-' || c == '=')) return 0;
  }
  return 1;
}

/* Connect to the fixed control socket and refuse any peer that is not the
 * supervisor account before a single request byte leaves. */
static int connect_supervisor(const char *role) {
  char what[64];
  int s = socket(AF_UNIX, SOCK_STREAM, 0);
  if (s < 0) { snprintf(what, sizeof what, "%s socket", role); die(what); }
  struct sockaddr_un a = { .sun_family = AF_UNIX };
  if (strlen(INSTAR_CONTROL_SOCKET) >= sizeof a.sun_path) { errno = 0; die("socket path"); }
  strcpy(a.sun_path, INSTAR_CONTROL_SOCKET);
  if (connect(s, (struct sockaddr *)&a, sizeof a) != 0) { snprintf(what, sizeof what, "%s connect", role); die(what); }
  uid_t peer_uid; pid_t peer_pid;
  if (peer_identity(s, &peer_uid, &peer_pid) != 0) { snprintf(what, sizeof what, "%s peer identity", role); die(what); }
  if (peer_uid != (uid_t)INSTAR_CONTROL_PEER_UID || peer_pid <= 0) {
    errno = 0; snprintf(what, sizeof what, "%s peer is not the supervisor", role); die(what);
  }
  return s;
}

/* ---- client: the only role S8 invokes. No privilege, no selector, no shell. ---- */
static int role_client(void) {
  uint64_t deadline = now_ms() + CLIENT_TIMEOUT_MS;
  uint32_t n;
  unsigned char *req = read_frame(STDIN_FILENO, &n, deadline);
  if (!req) die("client request frame");
  unsigned char extra;
  if (read(STDIN_FILENO, &extra, 1) != 0) { errno = 0; die("client request has trailing bytes"); }
  int s = connect_supervisor("client");
  if (write_exact(s, req, n + 4) != 0) die("client send");
  shutdown(s, SHUT_WR);
  uint32_t m;
  unsigned char *rep = read_frame(s, &m, deadline);
  if (!rep) die("client reply frame");
  if (read_exact(s, &extra, 1, deadline) == 0) { errno = 0; die("client reply has trailing bytes"); }
  if (write_exact(STDOUT_FILENO, rep, m + 4) != 0) die("client output");
  return 0;
}

/* ---- channel: the owner's end of one launched worker's channel. It attaches
 * once to the named launch (no reconnect exists), then multiplexes: stdin bytes
 * go to the worker as 'D' records, any byte on fd 3 is one 'P' (owner progress,
 * the guard heartbeat source once attached), and worker bytes come back raw on
 * stdout. End of stdin detaches, and the supervisor then stops the heartbeat. ---- */
static int role_channel(const char *identity) {
  if (!token_ok(identity)) { errno = 0; die("channel identity"); }
  int s = connect_supervisor("channel");
  char line[MAX_TOKEN + 3];
  int n = snprintf(line, sizeof line, "A%s\n", identity);
  if (write_exact(s, line, (size_t)n) != 0) die("channel attach");
  int progress = fcntl(3, F_GETFD) != -1 ? 3 : -1;
  unsigned char buf[65536];
  for (;;) {
    struct pollfd p[3] = { { .fd = STDIN_FILENO, .events = POLLIN }, { .fd = s, .events = POLLIN },
                           { .fd = progress, .events = POLLIN } };
    if (poll(p, progress >= 0 ? 3 : 2, -1) < 0) { if (errno == EINTR) continue; die("channel poll"); }
    if (p[1].revents) {
      ssize_t k = read(s, buf, sizeof buf);
      if (k <= 0) return 0;                                   /* supervisor closed the channel */
      if (write_exact(STDOUT_FILENO, buf, (size_t)k) != 0) return 0;
    }
    if (progress >= 0 && p[2].revents) {
      ssize_t k = read(progress, buf, sizeof buf);
      if (k <= 0) progress = -1;
      else if (write_exact(s, "P", 1) != 0) return 0;
    }
    if (p[0].revents) {
      ssize_t k = read(STDIN_FILENO, buf + 5, sizeof buf - 5);
      if (k <= 0) return 0;                                   /* owner detached */
      buf[0] = 'D';
      buf[1] = (unsigned char)(k >> 24); buf[2] = (unsigned char)(k >> 16);
      buf[3] = (unsigned char)(k >> 8); buf[4] = (unsigned char)k;
      if (write_exact(s, buf, (size_t)k + 5) != 0) return 0;
    }
  }
}

/* ---- limits ---- */
typedef struct { rlim_t cpu, nofile; } limits_t;

static int install_limits(const limits_t *l) {
  struct { int res; rlim_t v; } set[] = {
    { RLIMIT_CPU, l->cpu }, { RLIMIT_NOFILE, l->nofile }, { RLIMIT_FSIZE, 0 }, { RLIMIT_CORE, 0 },
    { RLIMIT_NPROC, 1 },   /* the worker account runs exactly one process: fork refuses in the kernel */
  };
  for (size_t i = 0; i < sizeof set / sizeof set[0]; i++) {
    if (set[i].v == RLIM_INFINITY) continue;
    struct rlimit r = { set[i].v, set[i].v };
    if (setrlimit(set[i].res, &r) != 0) return -1;
    struct rlimit back;
    if (getrlimit(set[i].res, &back) != 0 || back.rlim_cur != set[i].v || back.rlim_max != set[i].v) {
      errno = EINVAL; return -1;
    }
  }
  return 0;
}

static rlim_t parse_limit(const char *s) {
  if (strcmp(s, "-") == 0) return RLIM_INFINITY;
  char *end; errno = 0;
  unsigned long long v = strtoull(s, &end, 10);
  if (errno || *end || s[0] == '\0' || s[0] == '-') { errno = EINVAL; die("limit value"); }
  return (rlim_t)v;
}

/* Memory: a fatal phys-footprint limit on the process (Jetsam). Kept by the process
 * across exec and enforced by the kernel at the crossing. Root only: unprivileged,
 * the posix_spawn attribute is silently ignored and memorystatus_control returns
 * EPERM (measured). The readback makes a wrong command or silently ignored limit
 * refuse instead of running unbounded. */
typedef struct { int32_t active; uint32_t active_attr; int32_t inactive; uint32_t inactive_attr; } memlimit_t;
#define MEMSTATUS_SET_TASK_LIMIT 6          /* active = inactive, both fatal */
#define MEMSTATUS_GET_MEMLIMIT_PROPERTIES 8
#define MEMSTATUS_ATTR_FATAL 0x1
static int apply_memory(pid_t pid, rlim_t mib) {
  if (mib == 0 || mib > 1048576) { errno = EINVAL; return -1; }
  if (memorystatus_control(MEMSTATUS_SET_TASK_LIMIT, pid, (uint32_t)mib, NULL, 0) != 0) return -1;
  memlimit_t back;
  memset(&back, 0, sizeof back);
  if (memorystatus_control(MEMSTATUS_GET_MEMLIMIT_PROPERTIES, pid, 0, &back, sizeof back) != 0) return -1;
  if (back.active != (int32_t)mib || back.inactive != (int32_t)mib
      || !(back.active_attr & MEMSTATUS_ATTR_FATAL) || !(back.inactive_attr & MEMSTATUS_ATTR_FATAL)) {
    errno = EINVAL; return -1;
  }
  return 0;
}

/*
 * bootstrap <cpu> <nofile> <uid> <gid> <profile|-> <program> [args...]
 * fd 3 channel, fd 4 gate (read), fd 5 ready (write). Trusted code only runs
 * before the gate: become the parent's traced child, lead a new session (so the
 * worker can neither join nor leave a process group), install and read back
 * limits, drop privilege, report ready, wait on the gate, exec.
 */
static int role_bootstrap(int argc, char **argv) {
  if (argc < 8) { errno = 0; die("bootstrap arguments"); }
  limits_t l = { parse_limit(argv[2]), parse_limit(argv[3]) };
  uid_t uid = (uid_t)parse_limit(argv[4]);
  gid_t gid = (gid_t)parse_limit(argv[5]);
  const char *profile = argv[6];
  if (ptrace(PT_TRACE_ME, 0, 0, 0) != 0) die("bootstrap trace");
  if (setsid() < 0) die("bootstrap session");
  if (install_limits(&l) != 0) die("bootstrap limits");
  int null = open("/dev/null", O_RDWR);
  if (null < 0) die("bootstrap /dev/null");
  for (int fd = 0; fd <= 2; fd++) if (dup2(null, fd) < 0) die("bootstrap stdio");
  if (null > 5) close(null);
  if (getuid() == 0) {
    if (setgroups(1, &gid) != 0 || setgid(gid) != 0 || setuid(uid) != 0) die("bootstrap privilege drop");
    if (setuid(0) == 0 || getuid() != uid || geteuid() != uid || getgid() != gid) { errno = 0; die("privilege regained"); }
  } else if (uid != getuid() || gid != getgid()) { errno = EPERM; die("bootstrap identity (unprivileged)"); }
  if (chdir("/") != 0) die("bootstrap working directory");   /* never the supervisor's root-only directory */
  if (write(5, "R", 1) != 1) _exit(110);
  close(5);
  char go = 0;
  if (read(4, &go, 1) != 1 || go != 'G') _exit(111); /* gate closed: never run worker */
  close(4);
  char *empty[] = { NULL };
  if (strcmp(profile, "-") == 0) execve(argv[7], &argv[7], empty);
  else {
    char *sargv[256];
    int k = 0;
    sargv[k++] = "/usr/bin/sandbox-exec"; sargv[k++] = "-f"; sargv[k++] = (char *)profile;
    for (int i = 7; i < argc && k < 255; i++) sargv[k++] = argv[i];
    sargv[k] = NULL;
    execve("/usr/bin/sandbox-exec", sargv, empty);
  }
  _exit(112);
}

/* Kernel facts about a child: its parent, trace flag, credentials and start time. */
static int child_facts(pid_t pid, struct kinfo_proc *kp) {
  size_t len = sizeof *kp;
  int mib[4] = { CTL_KERN, KERN_PROC, KERN_PROC_PID, pid };
  return sysctl(mib, 4, kp, &len, NULL, 0) == 0 && len == sizeof *kp ? 0 : -1;
}

/* The kernel's never-reused 64-bit process id (proc_uniqidentifierinfo, flavor 17).
 * The layout is cross-checked: the child's recorded parent id must be ours. */
struct uniqinfo { uint8_t uuid[16]; uint64_t uniqueid, puniqueid; int32_t idversion; uint32_t r2; uint64_t r3, r4; };
static int unique_id(pid_t pid, uint64_t *id, uint64_t *parent) {
  struct uniqinfo u;
  if (proc_pidinfo(pid, 17, 0, &u, sizeof u) != (int)sizeof u || u.uniqueid == 0) return -1;
  *id = u.uniqueid; if (parent) *parent = u.puniqueid;
  return 0;
}

static void guard_report(const char *fmt, ...) __attribute__((format(printf, 1, 2)));
static void guard_report(const char *fmt, ...) {
  char line[256];
  va_list ap; va_start(ap, fmt);
  int n = vsnprintf(line, sizeof line, fmt, ap);
  va_end(ap);
  if (n > 0) (void)write_exact(3, line, (size_t)n);
}

/*
 * guard <cpu> <mem_mib|-> <nofile> <uid> <gid> <profile|-> <deadline_ticks> <program> [args...]
 * fd 3: link to the supervisor (any byte = heartbeat). fd 4: the worker's channel
 * end (optional). Spawns the worker as its own traced, unreaped child, verifies it
 * before the gate opens, reports `S <pid> <uid> <uniqueid> <start_us>`, then enforces
 * until the worker ends and reports `T <reason> <wait status>`. It never restarts
 * anything and cannot move the deadline, which is continuous-clock ticks in argv.
 */
static int role_guard(int argc, char **argv) {
  if (argc < 10) { errno = 0; die("guard arguments"); }
  rlim_t mem = parse_limit(argv[3]);
  uid_t uid = (uid_t)parse_limit(argv[5]);
  gid_t gid = (gid_t)parse_limit(argv[6]);
  uint64_t deadline = (uint64_t)parse_limit(argv[8]);
  signal(SIGPIPE, SIG_IGN);
  if (fcntl(4, F_GETFD) == -1) {
    int null = open("/dev/null", O_RDWR);
    if (null < 0 || dup2(null, 4) < 0) die("guard channel");
    if (null != 4) close(null);
  }
  if (mem != RLIM_INFINITY && geteuid() != 0) {         /* never run with a limit we cannot install */
    guard_report("T %d 0\n", END_REFUSED);
    errno = EPERM; die("memory limit requires the administrator-owned guard");
  }
  int gate[2], ready[2];
  if (pipe(gate) != 0 || pipe(ready) != 0) die("guard pipes");
  char *wargv[256];
  int k = 0;
  wargv[k++] = self_path; wargv[k++] = "bootstrap"; wargv[k++] = argv[2]; wargv[k++] = argv[4];
  wargv[k++] = argv[5]; wargv[k++] = argv[6]; wargv[k++] = argv[7];
  for (int i = 9; i < argc && k < 255; i++) wargv[k++] = argv[i];
  wargv[k] = NULL;
  posix_spawn_file_actions_t fa;
  posix_spawn_file_actions_init(&fa);
  posix_spawn_file_actions_adddup2(&fa, 4, 3);
  posix_spawn_file_actions_adddup2(&fa, gate[0], 4);
  posix_spawn_file_actions_adddup2(&fa, ready[1], 5);
  posix_spawnattr_t at;
  posix_spawnattr_init(&at);
  posix_spawnattr_setflags(&at, POSIX_SPAWN_CLOEXEC_DEFAULT);   /* only fds 3-5 cross */
  char *empty[] = { NULL };
  pid_t w;
  int rc = posix_spawn(&w, self_path, &fa, &at, wargv, empty);
  posix_spawn_file_actions_destroy(&fa);
  posix_spawnattr_destroy(&at);
  close(gate[0]); close(ready[1]); close(4);
  if (rc != 0) { guard_report("T %d 0\n", END_REFUSED); errno = rc; die("guard spawn"); }
  int st = 0;
  /* Everything below kills only `w`: our own child, never reaped before it ends. */
  /* A SIGKILL sent to a trace-stopped process stays pending until the tracer
   * resumes it, so the kill is also delivered as the resume signal. If the
   * bounded wait still fails, this guard exits and the kernel kills its tracee. */
  #define END(code) do { \
    kill(w, SIGKILL); \
    uint64_t stop = now_ms() + 2000; \
    for (;;) { \
      (void)ptrace(PT_CONTINUE, w, (caddr_t)1, SIGKILL); \
      pid_t y = waitpid(w, &st, WNOHANG); \
      if ((y == w && !WIFSTOPPED(st)) || now_ms() >= stop) break; \
      usleep(1000); \
    } \
    guard_report("T %d %d\n", (code), st); return (code); } while (0)
  char r = 0;
  if (read_exact(ready[0], &r, 1, now_ms() + 2000) != 0 || r != 'R') END(END_REFUSED);
  close(ready[0]);
  struct kinfo_proc kp;
  uint64_t wid = 0, wparent = 0, self_id = 0;
  if (child_facts(w, &kp) != 0 || !(kp.kp_proc.p_flag & P_TRACED) || kp.kp_eproc.e_ppid != getpid()
      || kp.kp_eproc.e_pcred.p_ruid != uid || kp.kp_eproc.e_ucred.cr_uid != uid
      || kp.kp_eproc.e_pcred.p_rgid != gid
      || unique_id(w, &wid, &wparent) != 0 || unique_id(getpid(), &self_id, NULL) != 0 || wparent != self_id)
    END(END_REFUSED);
  if (mem != RLIM_INFINITY && apply_memory(w, mem) != 0) END(END_MEMORY);
  uint64_t start_us = (uint64_t)kp.kp_proc.p_starttime.tv_sec * 1000000u + (uint64_t)kp.kp_proc.p_starttime.tv_usec;
  guard_report("S %d %u %llu %llu\n", w, (unsigned)uid, (unsigned long long)wid, (unsigned long long)start_us);
  if (write(gate[1], "G", 1) != 1) END(END_REFUSED);
  close(gate[1]);
  uint64_t last = now_ms();
  for (;;) {
    if (mach_continuous_time() >= deadline) END(END_DEADLINE);
    if (now_ms() - last > LAPSE_MS) END(END_LAPSE);
    struct pollfd p = { .fd = 3, .events = POLLIN };
    int n = poll(&p, 1, 5);
    if (n > 0) {
      char b[64];
      ssize_t got = read(3, b, sizeof b);
      if (got <= 0) END(END_SUPERVISOR);                     /* supervisor death */
      last = now_ms();
    }
    pid_t x = waitpid(w, &st, WNOHANG);
    if (x == w && WIFSTOPPED(st)) {
      int sig = WSTOPSIG(st);
      if (sig == SIGXCPU) END(END_CPU);                      /* the kernel's CPU-time limit */
      if (sig == SIGTRAP) {                                  /* exec: re-apply before any new instruction */
        if (mem != RLIM_INFINITY && apply_memory(w, mem) != 0) END(END_MEMORY);
        sig = 0;
      }
      ptrace(PT_CONTINUE, w, (caddr_t)1, sig);
    } else if (x == w) {
      guard_report("T %d %d\n", END_WORKER, st);
      return END_WORKER;
    }
  }
  #undef END
}

/* A guard with its own link and the worker's channel, spawned by a supervisor. */
typedef struct { pid_t pid; int link; } guard_t;

static int spawn_guard(guard_t *g, char *const argv[], int channel) {
  int sp[2];
  if (socketpair(AF_UNIX, SOCK_STREAM, 0, sp) != 0) return -1;
  posix_spawn_file_actions_t fa;
  posix_spawn_file_actions_init(&fa);
  posix_spawn_file_actions_addopen(&fa, 0, "/dev/null", O_RDONLY, 0);
  posix_spawn_file_actions_addopen(&fa, 1, "/dev/null", O_WRONLY, 0);
  posix_spawn_file_actions_addopen(&fa, 2, "/dev/null", O_WRONLY, 0);
  posix_spawn_file_actions_adddup2(&fa, sp[1], 3);
  if (channel >= 0) posix_spawn_file_actions_adddup2(&fa, channel, 4);
  posix_spawnattr_t at;
  posix_spawnattr_init(&at);
  posix_spawnattr_setflags(&at, POSIX_SPAWN_CLOEXEC_DEFAULT);
  char *empty[] = { NULL };
  int rc = posix_spawn(&g->pid, self_path, &fa, &at, argv, empty);
  posix_spawn_file_actions_destroy(&fa);
  posix_spawnattr_destroy(&at);
  close(sp[1]);
  if (rc != 0) { close(sp[0]); errno = rc; return -1; }
  g->link = sp[0];
  return 0;
}

/* Read one '\n'-terminated line (bounded) byte by byte from an fd. */
static int read_line(int fd, char *out, size_t max, uint64_t deadline) {
  size_t n = 0;
  while (n + 1 < max) {
    char c;
    if (read_exact(fd, &c, 1, deadline) != 0) return -1;
    if (c == '\n') { out[n] = '\0'; return 0; }
    out[n++] = c;
  }
  errno = EMSGSIZE; return -1;
}

/* ---- probe payloads (run inside the confined chain) ---- */
static void ignore_xcpu(int s) { (void)s; }
static void *spin(void *arg) { volatile uint64_t x = 0; (void)arg; for (;;) x++; return NULL; }

static int role_probe(int argc, char **argv) {
  if (argc < 3) return 64;
  const char *p = argv[2];
  if (!strcmp(p, "alloc")) {                 /* malloc+touch: must be ended by the memory limit */
    size_t mib = argc > 3 ? (size_t)strtoull(argv[3], NULL, 10) : 1024;
    size_t n = mib << 20;
    char *m = malloc(n);
    if (m) { for (size_t i = 0; i < n; i += 4096) m[i] = 1; return 10; }
    return 3;                                 /* allocation refused */
  }
  if (!strcmp(p, "raise")) {                 /* raise any hard limit: must fail */
    struct rlimit r, up;
    if (getrlimit(RLIMIT_CPU, &r) != 0 || r.rlim_max == RLIM_INFINITY) return 4;
    up.rlim_cur = up.rlim_max = r.rlim_max + 10;
    if (setrlimit(RLIMIT_CPU, &up) == 0) return 11;
    if (getrlimit(RLIMIT_NOFILE, &r) != 0) return 4;
    up.rlim_cur = up.rlim_max = r.rlim_max + 10;
    if (setrlimit(RLIMIT_NOFILE, &up) == 0) return 12;
    return 3;
  }
  if (!strcmp(p, "spin")) {                  /* ignore SIGXCPU, burn CPU in 3 threads */
    signal(SIGXCPU, ignore_xcpu);
    pthread_t t;
    pthread_create(&t, NULL, spin, NULL);
    pthread_create(&t, NULL, spin, NULL);
    spin(NULL);
    return 10;
  }
  if (!strcmp(p, "write")) {                 /* any filesystem mutation: must fail */
    if (argc < 4) return 64;
    char path[4096];
    snprintf(path, sizeof path, "%s/probe-%d", argv[3], getpid());
    int fd = open(path, O_CREAT | O_WRONLY | O_EXCL, 0600);
    if (fd >= 0) { close(fd); unlink(path); return 10; }
    if (mkdir(path, 0700) == 0) { rmdir(path); return 11; }
    snprintf(path, sizeof path, "/private/tmp/instar-probe-%d", getpid());
    fd = open(path, O_CREAT | O_WRONLY | O_EXCL, 0600);
    if (fd >= 0) { close(fd); unlink(path); return 12; }
    return 3;
  }
  if (!strcmp(p, "read")) {                  /* a permitted read must still work */
    if (argc < 4) return 64;
    int fd = open(argv[3], O_RDONLY);
    if (fd < 0) return 4;
    char b[16]; ssize_t k = read(fd, b, sizeof b); close(fd);
    return k >= 0 ? 0 : 5;
  }
  if (!strcmp(p, "children")) {              /* fork / spawn / self-exec: must fail */
    pid_t f = fork();
    if (f == 0) _exit(0);
    if (f > 0) { waitpid(f, NULL, 0); return 10; }
    pid_t s; char *a[] = { "/usr/bin/true", NULL }, *e[] = { NULL };
    if (posix_spawn(&s, "/usr/bin/true", NULL, NULL, a, e) == 0) { waitpid(s, NULL, 0); return 11; }
    return 3;
  }
  if (!strcmp(p, "escape")) {                /* leave the session/process group or the tracer: must fail */
    if (setsid() >= 0) return 10;
    if (setpgid(0, 0) == 0 && getpgrp() != getpid()) return 11;
    return 3;
  }
  if (!strcmp(p, "network")) {               /* new sockets: must fail */
    int s4 = socket(AF_INET, SOCK_STREAM, 0);
    if (s4 >= 0) {
      struct sockaddr_in a = { .sin_family = AF_INET, .sin_port = htons(9), .sin_addr.s_addr = htonl(0x7f000001) };
      int r = connect(s4, (struct sockaddr *)&a, sizeof a);
      int e = errno; close(s4);
      if (r == 0 || e == ECONNREFUSED) return 10;
    }
    int su = socket(AF_UNIX, SOCK_STREAM, 0);
    if (su >= 0) {
      struct sockaddr_un a = { .sun_family = AF_UNIX };
      strcpy(a.sun_path, "/private/var/run/mDNSResponder");
      int r = connect(su, (struct sockaddr *)&a, sizeof a);
      close(su);
      if (r == 0) return 11;
    }
    return 3;
  }
  if (!strcmp(p, "sleep")) { usleep((useconds_t)(argc > 3 ? atoi(argv[3]) : 30000) * 1000u); return 0; }
  return 64;
}

/* ---- feasibility cases ---- */
static int report(const char *name, const char *status, const char *fmt, ...) __attribute__((format(printf, 3, 4)));
static int report(const char *name, const char *status, const char *fmt, ...) {
  va_list ap; va_start(ap, fmt);
  printf("feasibility.%s=%s ", name, status);
  vprintf(fmt, ap); printf("\n"); fflush(stdout);
  va_end(ap);
  return strcmp(status, "PASS") ? 1 : 0;
}
#define VERDICT(ok) ((ok) ? "PASS" : "FAIL")

static char uid_s[16], gid_s[16];

typedef struct { int reason; int status; pid_t worker; uint64_t wall_ms; int started; } run_t;

static int exit_code(int st) { return WIFEXITED(st) ? WEXITSTATUS(st) : -WTERMSIG(st); }

/* Run one worker under a real guard, acting as its supervisor with a steady
 * heartbeat; returns the guard's terminal report. `hold_ms` > 0 stops the
 * heartbeat after that long (a supervisor that stopped answering). */
static int run_guarded(run_t *out, const char *cpu, const char *mem, const char *profile,
                       uint64_t lifetime_ms, char *const payload[]) {
  char deadline[32];
  snprintf(deadline, sizeof deadline, "%llu", (unsigned long long)(mach_continuous_time() + ms_to_ticks(lifetime_ms)));
  char *argv[64];
  int k = 0;
  argv[k++] = self_path; argv[k++] = "guard"; argv[k++] = (char *)cpu; argv[k++] = (char *)mem;
  argv[k++] = "32"; argv[k++] = uid_s; argv[k++] = gid_s; argv[k++] = (char *)profile; argv[k++] = deadline;
  for (int i = 0; payload[i] && k < 63; i++) argv[k++] = payload[i];
  argv[k] = NULL;
  guard_t g;
  memset(out, 0, sizeof *out);
  out->reason = -1;
  uint64_t t0 = now_ms();
  if (spawn_guard(&g, argv, -1) != 0) return -1;
  char line[256];
  for (;;) {
    (void)write(g.link, "H", 1);
    struct pollfd p = { .fd = g.link, .events = POLLIN };
    if (poll(&p, 1, HEARTBEAT_MS) > 0) {
      if (read_line(g.link, line, sizeof line, now_ms() + 1000) != 0) break;
      if (line[0] == 'S') { out->started = 1; sscanf(line + 2, "%d", &out->worker); }
      if (line[0] == 'T') { sscanf(line + 2, "%d %d", &out->reason, &out->status); break; }
    }
    if (now_ms() - t0 > lifetime_ms + 10000) break;
  }
  int gs; waitpid(g.pid, &gs, 0);
  close(g.link);
  out->wall_ms = now_ms() - t0;
  return out->reason >= 0 ? 0 : -1;
}

static int probe_case(const char *name, const char *profile, char *const payload[], int expect, const char *what) {
  run_t r;
  if (run_guarded(&r, "5", "-", profile, 5000, payload) != 0) return report(name, "FAIL", "%s: guard did not report", what);
  int ok = r.reason == END_WORKER && exit_code(r.status) == expect;
  return report(name, VERDICT(ok), "%s outcome=%d guard=%d", what, exit_code(r.status), r.reason);
}

/* Alive and not a zombie (a zombie keeps its PID until reaped). Test observation only. */
static int alive(pid_t pid) {
  struct kinfo_proc kp;
  if (pid <= 0 || child_facts(pid, &kp) != 0) return 0;
  return kp.kp_proc.p_stat != SZOMB;
}

/* feasibility <case> <profile> <scratch> [runtime] [uid gid]: an administrator run
 * names the installed worker account so the cases drop to it exactly as a launch does. */
static int feasibility(const char *which, const char *profile, const char *scratch, const char *runtime,
                       const char *uid, const char *gid) {
  signal(SIGPIPE, SIG_IGN);
  if (uid && gid) {
    snprintf(uid_s, sizeof uid_s, "%u", (unsigned)parse_limit(uid));
    snprintf(gid_s, sizeof gid_s, "%u", (unsigned)parse_limit(gid));
  } else {
    snprintf(uid_s, sizeof uid_s, "%u", getuid());
    snprintf(gid_s, sizeof gid_s, "%u", getgid());
  }
  int failures = 0;
  int all = !strcmp(which, "all");
  run_t r;
  if (all || !strcmp(which, "memory")) {
    /* A fatal 256 MiB footprint limit must end a worker that touches 1 GiB after
     * the whole exec chain. Root only: unprivileged, the guard refuses to start. */
    char *p[] = { self_path, "probe", "alloc", "1024", NULL };
    int got = run_guarded(&r, "-", "256", profile, 10000, p);
    if (geteuid() != 0)
      failures += report("memory", "UNVERIFIED",
        "requires-root: the fatal footprint limit is installed only by the administrator-owned guard "
        "(unprivileged: attribute ignored, memorystatus_control EPERM); guard=%d started=%d (35=refused before release)",
        got == 0 ? r.reason : -1, r.started);
    else
      failures += report("memory", VERDICT(got == 0 && r.started && WIFSIGNALED(r.status) && WTERMSIG(r.status) == SIGKILL),
        "fatal 256MiB limit, 1GiB touched: guard=%d signal=%d wall_ms=%llu",
        r.reason, WIFSIGNALED(r.status) ? WTERMSIG(r.status) : 0, (unsigned long long)r.wall_ms);
    char *q[] = { self_path, "probe", "raise", NULL };
    if (run_guarded(&r, "5", "-", profile, 5000, q) == 0)
      failures += report("limit-raise", VERDICT(r.reason == END_WORKER && exit_code(r.status) == 3),
        "raise hard CPU/NOFILE from inside outcome=%d (3=refused)", exit_code(r.status));
    else failures += report("limit-raise", "FAIL", "did not complete");
  }
  if (all || !strcmp(which, "cpu")) {
    char *p[] = { self_path, "probe", "spin", NULL };
    int got = run_guarded(&r, "1", "-", profile, 8000, p);
    failures += report("cpu", VERDICT(got == 0 && r.reason == END_CPU && WIFSIGNALED(r.status) && WTERMSIG(r.status) == SIGKILL),
      "RLIMIT_CPU=1s, SIGXCPU ignored, 3 threads: guard=%d (33=kernel CPU limit) signal=%d wall_ms=%llu",
      r.reason, WIFSIGNALED(r.status) ? WTERMSIG(r.status) : 0, (unsigned long long)r.wall_ms);
  }
  if (all || !strcmp(which, "task")) {
    /* Identity-safe termination through the shipped exec chain: the deadline ends
     * the original worker after bootstrap -> [sandbox-exec ->] target. */
    const char *targets[] = { self_path, runtime };
    for (int i = 0; i < 2; i++) {
      if (!targets[i] || !*targets[i]) continue;
      const char *name = i ? "task-runtime" : "task";
      char *p0[] = { (char *)targets[i], "probe", "sleep", NULL };
      char *p1[] = { (char *)targets[i], "-e", "setTimeout(()=>{},30000)", NULL };
      int got = run_guarded(&r, "-", "-", profile, 800, i ? p1 : p0);
      failures += report(name, VERDICT(got == 0 && r.started && r.reason == END_DEADLINE
                                       && WIFSIGNALED(r.status) && WTERMSIG(r.status) == SIGKILL && !alive(r.worker)),
        "after bootstrap->%s%s: parent+tracer kill at the 800ms deadline guard=%d signal=%d wall_ms=%llu",
        strcmp(profile, "-") ? "sandbox-exec->" : "", targets[i], r.reason,
        WIFSIGNALED(r.status) ? WTERMSIG(r.status) : 0, (unsigned long long)r.wall_ms);
    }
    char *p2[] = { self_path, "probe", "escape", NULL };
    failures += probe_case("escape", profile, p2, 3, "setsid/setpgid from inside (3=refused: the worker leads its own session)");
  }
  if (all || !strcmp(which, "guard")) {
    /* A supervisor simulation owns the guard; faults are injected from here. The
     * worker must end promptly in each case. Nothing here or in the guard signals
     * the worker by looking up a PID. */
    const char *faults[] = { "supervisor-kill", "supervisor-stop", "guard-kill", "deadline" };
    for (int f = 0; f < 4; f++) {
      int info[2]; if (pipe(info) != 0) die("pipe");
      pid_t sup = fork();
      if (sup == 0) {
        close(info[0]);
        char deadline[32];
        snprintf(deadline, sizeof deadline, "%llu",
                 (unsigned long long)(mach_continuous_time() + ms_to_ticks(f == 3 ? 800 : 20000)));
        char *argv[] = { self_path, "guard", "-", "-", "32", uid_s, gid_s, (char *)profile, deadline,
                         self_path, "probe", "sleep", NULL };
        guard_t g;
        if (spawn_guard(&g, argv, -1) != 0) _exit(20);
        char line[256];
        (void)write(g.link, "H", 1);
        if (read_line(g.link, line, sizeof line, now_ms() + 3000) != 0 || line[0] != 'S') _exit(21);
        char msg[64]; int n = snprintf(msg, sizeof msg, "%d %d\n", atoi(line + 2), g.pid);
        (void)write(info[1], msg, (size_t)n);
        for (;;) { if (write(g.link, "H", 1) != 1) _exit(0); usleep(HEARTBEAT_MS * 1000); }
      }
      close(info[1]);
      char buf[64] = { 0 };
      struct pollfd pf = { .fd = info[0], .events = POLLIN };
      ssize_t k = poll(&pf, 1, 4000) > 0 ? read(info[0], buf, sizeof buf - 1) : 0;
      close(info[0]);
      pid_t worker = -1, guardp = -1;
      if (k <= 0 || sscanf(buf, "%d %d", &worker, &guardp) != 2) {
        kill(sup, SIGKILL); waitpid(sup, NULL, 0);
        failures += report("guard", "FAIL", "%s: arm sequence did not complete", faults[f]); continue;
      }
      usleep(200000);
      int before = alive(worker);
      uint64_t t0 = now_ms();
      if (f == 0) kill(sup, SIGKILL);
      if (f == 1) kill(sup, SIGSTOP);
      if (f == 2) kill(guardp, SIGKILL);
      uint64_t limit = f == 3 ? 2000 : 1500, gone_at = 0;
      while (now_ms() - t0 < limit) { if (!alive(worker)) { gone_at = now_ms() - t0; break; } usleep(5000); }
      int gone = !alive(worker);
      if (f == 1) kill(sup, SIGCONT);
      kill(sup, SIGKILL); waitpid(sup, NULL, 0);
      char label[64]; snprintf(label, sizeof label, "guard-%s", faults[f]);
      failures += report(label, VERDICT(before && gone), "worker ended=%s after %llums (deadline case: 800ms from arm)",
                         gone ? "yes" : "NO", (unsigned long long)gone_at);
    }
  }
  if (all || !strcmp(which, "nowrite")) {
    char *p1[] = { self_path, "probe", "write", (char *)scratch, NULL };
    failures += probe_case("nowrite", profile, p1, 3, "create/mkdir in scratch and /private/tmp (3=all denied)");
    char *p2[] = { self_path, "probe", "read", self_path, NULL };
    failures += probe_case("permitted-read", profile, p2, 0, "read the pinned artifact (0=read ok)");
    char *p3[] = { self_path, "probe", "network", NULL };
    failures += probe_case("network", profile, p3, 3, "loopback TCP + UNIX connect (3=denied)");
  }
  if (all || !strcmp(which, "children")) {
    char *p4[] = { self_path, "probe", "children", NULL };
    failures += probe_case("children", profile, p4, 3, "fork + posix_spawn (3=denied)");
  }
  if (all || !strcmp(which, "gate")) {
    /* A guard whose supervisor never heartbeats: the worker is ended within the
     * lapse, and a guard refused before release never opens the gate. */
    char deadline[32];
    snprintf(deadline, sizeof deadline, "%llu", (unsigned long long)(mach_continuous_time() + ms_to_ticks(20000)));
    char *argv[] = { self_path, "guard", "-", "-", "32", uid_s, gid_s, "-", deadline, "/bin/sleep", "30", NULL };
    guard_t g; char line[256]; int code = -1, st = 0;
    if (spawn_guard(&g, argv, -1) != 0) failures += report("gate", "FAIL", "spawn failed");
    else {
      uint64_t t0 = now_ms();
      while (read_line(g.link, line, sizeof line, now_ms() + 3000) == 0) if (line[0] == 'T') { sscanf(line + 2, "%d", &code); break; }
      waitpid(g.pid, &st, 0); close(g.link);
      failures += report("gate", VERDICT(code == END_LAPSE && now_ms() - t0 < 1500),
        "no heartbeat after release: guard=%d (31=lapse) wall_ms=%llu", code, (unsigned long long)(now_ms() - t0));
    }
    char *bad[] = { self_path, "guard", "-", "-", "32", "0", "0", "-", deadline, "/usr/bin/true", NULL };
    code = -1;
    if (getuid() != 0 && spawn_guard(&g, bad, -1) == 0) {
      while (read_line(g.link, line, sizeof line, now_ms() + 3000) == 0) if (line[0] == 'T') { sscanf(line + 2, "%d", &code); break; }
      waitpid(g.pid, &st, 0); close(g.link);
      failures += report("gate-refused", VERDICT(code == END_REFUSED),
        "identity mismatch refuses before release: guard=%d (35=refused)", code);
    }
  }
  printf("feasibility.clock=continuous_ticks:%llu\n", (unsigned long long)mach_continuous_time());
  return failures ? 1 : 0;
}

/* ---- durable journal primitive (M2) ----
 * F_FULLFSYNC asks the drive to flush its cache: plain fsync on macOS does not
 * make an append survive power loss. The journal must be a regular file owned
 * by this account with no group/other write bit, reached without a symlink; its
 * directory is flushed too so a newly created journal's entry is durable. Any
 * deviation refuses (exit 2): the caller treats that as an untrusted journal and
 * never releases. */
static int full_sync(const char *path, int directory) {
  int fd = open(path, O_RDONLY | O_NOFOLLOW | O_CLOEXEC | (directory ? O_DIRECTORY : 0));
  if (fd < 0) return -1;
  struct stat s;
  int ok = fstat(fd, &s) == 0 && (directory ? S_ISDIR(s.st_mode) : S_ISREG(s.st_mode))
           && s.st_uid == geteuid() && (s.st_mode & (S_IWGRP | S_IWOTH)) == 0;
  if (!ok) { close(fd); errno = errno ? errno : EPERM; return -1; }
  int r = fcntl(fd, F_FULLFSYNC);
  int e = errno;
  close(fd);
  errno = e;
  return r == -1 ? -1 : 0;
}

static int role_journal_sync(const char *path) {
  size_t n = strlen(path);
  if (path[0] != '/' || n < 2 || n >= 4096 || path[n - 1] == '/') { errno = 0; die("journal path"); }
  char parent[4096];
  memcpy(parent, path, n + 1);
  char *slash = strrchr(parent, '/');
  if (slash == parent) slash[1] = '\0'; else *slash = '\0';
  errno = 0;
  if (full_sync(path, 0) != 0) die("journal full sync");
  if (full_sync(parent, 1) != 0) die("journal directory full sync");
  return 0;
}

/* ---- supervise: the installed service ----
 *
 * installation.conf (administrator-owned, not group/other-writable, no symlink):
 * exactly these keys, each once. Every per-slot bound comes from here, never
 * from a request or the owner service:
 *   agent_uid  worker_uid  worker_gid  release_dir
 *   cpu_seconds  memory_mib  nofile  max_lifetime_ms
 * The release supplies runtime/node, worker.sb and scripts/fixed-native-worker-monitor.mjs.
 */
typedef struct {
  long agent_uid, worker_uid, worker_gid, cpu, mem, nofile, max_life_ms;
  char release[1024], runtime[1100], profile[1100], service[1100];
} conf_t;
static conf_t conf;

static uid_t conf_owner(void) { return INSTAR_TEST_UNPRIVILEGED ? getuid() : 0; }

static int owned_not_writable(const struct stat *s) {
  return s->st_uid == conf_owner() && (s->st_mode & (S_IWGRP | S_IWOTH)) == 0;
}

static int load_conf(void) {
  int fd = open(INSTAR_INSTALL_CONF, O_RDONLY | O_NOFOLLOW | O_CLOEXEC);
  if (fd < 0) return -1;
  struct stat s;
  char text[4097];
  ssize_t n = -1;
  if (fstat(fd, &s) == 0 && S_ISREG(s.st_mode) && owned_not_writable(&s) && s.st_size < 4096)
    n = read(fd, text, sizeof text - 1);
  close(fd);
  if (n <= 0) { errno = EPERM; return -2; }
  text[n] = '\0';
  const char *keys[] = { "agent_uid", "worker_uid", "worker_gid", "cpu_seconds", "memory_mib", "nofile",
                         "max_lifetime_ms", "release_dir" };
  long *nums[] = { &conf.agent_uid, &conf.worker_uid, &conf.worker_gid, &conf.cpu, &conf.mem, &conf.nofile,
                   &conf.max_life_ms };
  const long lo[] = { 1, 1, 1, 1, INSTAR_TEST_UNPRIVILEGED ? 0 : 16, 8, 1000 };
  const long hi[] = { 2147483647L, 2147483647L, 2147483647L, 86400, 1048576, 4096, 86400000 };
  int seen[8] = { 0 };
  for (char *save = NULL, *line = strtok_r(text, "\n", &save); line; line = strtok_r(NULL, "\n", &save)) {
    char *eq = strchr(line, '=');
    if (!eq) return -2;
    *eq = '\0';
    int k = -1;
    for (int i = 0; i < 8; i++) if (!strcmp(line, keys[i])) k = i;
    if (k < 0 || seen[k]++) return -2;
    const char *v = eq + 1;
    if (k == 7) {
      if (v[0] != '/' || strlen(v) >= sizeof conf.release || strstr(v, "/../") || strstr(v, "//")
          || strstr(v, "/./") || !token_ok(v)) return -2;
      strcpy(conf.release, v);
    } else {
      char *end; errno = 0;
      long x = strtol(v, &end, 10);
      if (errno || *end || v[0] == '\0' || x < lo[k] || x > hi[k]) return -2;
      *nums[k] = x;
    }
  }
  for (int i = 0; i < 8; i++) if (!seen[i]) return -2;
  if (!INSTAR_TEST_UNPRIVILEGED && (conf.worker_uid < 450 || conf.worker_uid > 499)) return -2;
  snprintf(conf.runtime, sizeof conf.runtime, "%s/runtime/node", conf.release);
  snprintf(conf.profile, sizeof conf.profile, "%s/worker.sb", conf.release);
  snprintf(conf.service, sizeof conf.service, "%s/scripts/fixed-native-worker-monitor.mjs", conf.release);
  /* The release is administrator-owned and holds this very binary. */
  struct stat d;
  size_t rl = strlen(conf.release);
  if (lstat(conf.release, &d) != 0 || !S_ISDIR(d.st_mode) || !owned_not_writable(&d)
      || strncmp(self_path, conf.release, rl) != 0 || strcmp(self_path + rl, "/bin/instar-worker-enforcer") != 0)
    return -2;
  const char *files[] = { conf.runtime, conf.profile, conf.service };
  for (int i = 0; i < 3; i++) if (stat(files[i], &d) != 0 || !S_ISREG(d.st_mode)) return -2;
  return 0;
}

/* The one accounted worker slot. The main thread fills it at start and attach;
 * the slot thread owns the heartbeat, the channel relay and the terminal report. */
static struct {
  pthread_mutex_t lock;
  int active, link, chan, attach, attached_ever, terminal, wstatus;
  pid_t guard, worker;
  uint64_t last_progress, last_beat, relayed;
  char identity[MAX_TOKEN + 1];
} slot = { .lock = PTHREAD_MUTEX_INITIALIZER, .link = -1, .chan = -1, .attach = -1, .terminal = -1 };

static void slot_close_locked(void) {
  if (slot.attach >= 0) close(slot.attach);
  if (slot.chan >= 0) close(slot.chan);
  if (slot.link >= 0) close(slot.link);
  slot.attach = slot.chan = slot.link = -1;
}

static void *slot_thread(void *arg) {
  (void)arg;
  unsigned char buf[65536 + 5];
  for (;;) {
    pthread_mutex_lock(&slot.lock);
    if (!slot.active) { pthread_mutex_unlock(&slot.lock); usleep(10000); continue; }
    /* Heartbeat: the supervisor is alive, and once an owner has attached, the
     * owner's last successful authority check is within the lapse. */
    uint64_t now = now_ms();
    int owner_ok = !slot.attached_ever || (slot.attach >= 0 && now - slot.last_progress <= LAPSE_MS);
    if (owner_ok && now - slot.last_beat >= HEARTBEAT_MS) { (void)write(slot.link, "H", 1); slot.last_beat = now; }
    struct pollfd p[3] = { { .fd = slot.link, .events = POLLIN },
                           { .fd = slot.attach >= 0 ? slot.chan : -1, .events = POLLIN },
                           { .fd = slot.attach, .events = POLLIN } };
    pthread_mutex_unlock(&slot.lock);
    if (poll(p, 3, 10) <= 0) continue;
    pthread_mutex_lock(&slot.lock);
    if (p[0].revents) {                                       /* guard report or guard death */
      char line[256];
      if (read_line(slot.link, line, sizeof line, now_ms() + 1000) == 0 && line[0] == 'T')
        sscanf(line + 2, "%d %d", &slot.terminal, &slot.wstatus);
      else if (slot.terminal < 0) slot.terminal = END_GUARD_LOST;
      int gs;
      waitpid(slot.guard, &gs, 0);                            /* the guard is our child: reap it */
      slot_close_locked();
      slot.active = 0;
    } else if (p[1].revents && slot.attach >= 0) {            /* worker -> owner */
      ssize_t k = read(slot.chan, buf, 65536);
      if (k <= 0 || (slot.relayed += (uint64_t)k) > RELAY_BUDGET
          || write_bounded(slot.attach, buf, (size_t)k, now_ms() + LAPSE_MS) != 0) {
        close(slot.attach); slot.attach = -1;                  /* detached: the heartbeat stops */
      }
    } else if (p[2].revents && slot.attach >= 0) {            /* owner -> worker, or progress */
      unsigned char t;
      uint32_t len = 0;
      int ok = read_exact(slot.attach, &t, 1, now_ms() + LAPSE_MS) == 0;
      if (ok && t == 'P') slot.last_progress = now_ms();
      else if (ok && t == 'D' && read_exact(slot.attach, buf, 4, now_ms() + LAPSE_MS) == 0
               && (len = ((uint32_t)buf[0] << 24) | ((uint32_t)buf[1] << 16) | ((uint32_t)buf[2] << 8) | buf[3]) > 0
               && len <= 65536 && (slot.relayed += len) <= RELAY_BUDGET
               && read_exact(slot.attach, buf, len, now_ms() + LAPSE_MS) == 0
               && write_bounded(slot.chan, buf, len, now_ms() + LAPSE_MS) == 0) { /* relayed */ }
      else { close(slot.attach); slot.attach = -1; }
    }
    pthread_mutex_unlock(&slot.lock);
  }
  return NULL;
}

/* Start one worker in the slot. Limits come only from the installed config. */
static void do_start(int service, char *identity, char *handle, char *delivery, const char *lifetime) {
  char out[256];
  char *end; errno = 0;
  long life = strtol(lifetime, &end, 10);
  if (!token_ok(identity) || !token_ok(handle) || !token_ok(delivery) || errno || *end || life < 1
      || life > conf.max_life_ms) { write_exact(service, "REFUSED invalid\n", 16); return; }
  pthread_mutex_lock(&slot.lock);
  if (slot.active) { pthread_mutex_unlock(&slot.lock); write_exact(service, "REFUSED slot-busy\n", 18); return; }
  pthread_mutex_unlock(&slot.lock);
  int ch[2];
  if (socketpair(AF_UNIX, SOCK_STREAM, 0, ch) != 0) { write_exact(service, "REFUSED guard-failed\n", 21); return; }
  char cpu[24], mem[24], nofile[24], uid[24], gid[24], deadline[32];
  uint64_t deadline_ticks = mach_continuous_time() + ms_to_ticks((uint64_t)life);
  snprintf(cpu, sizeof cpu, "%ld", conf.cpu);
  if (conf.mem > 0) snprintf(mem, sizeof mem, "%ld", conf.mem); else strcpy(mem, "-");
  snprintf(nofile, sizeof nofile, "%ld", conf.nofile);
  snprintf(uid, sizeof uid, "%ld", conf.worker_uid);
  snprintf(gid, sizeof gid, "%ld", conf.worker_gid);
  snprintf(deadline, sizeof deadline, "%llu", (unsigned long long)deadline_ticks);
  char *argv[] = { self_path, "guard", cpu, mem, nofile, uid, gid, conf.profile, deadline,
                   conf.runtime, conf.service, "loading-worker", handle, delivery, NULL };
  guard_t g;
  if (spawn_guard(&g, argv, ch[1]) != 0) { close(ch[0]); close(ch[1]); write_exact(service, "REFUSED guard-failed\n", 21); return; }
  close(ch[1]);
  fcntl(ch[0], F_SETFL, fcntl(ch[0], F_GETFL) | O_NONBLOCK);
  char line[256];
  pid_t pid = 0; unsigned wuid = 0; unsigned long long wid = 0, start_us = 0;
  (void)write(g.link, "H", 1);
  if (read_line(g.link, line, sizeof line, now_ms() + 3000) != 0 || line[0] != 'S'
      || sscanf(line + 2, "%d %u %llu %llu", &pid, &wuid, &wid, &start_us) != 4) {
    close(g.link); close(ch[0]);                             /* guard ends the worker on link EOF */
    int gs; waitpid(g.pid, &gs, 0);
    write_exact(service, "REFUSED guard-failed\n", 21); return;
  }
  pthread_mutex_lock(&slot.lock);
  slot.active = 1; slot.guard = g.pid; slot.worker = pid; slot.link = g.link; slot.chan = ch[0];
  slot.attach = -1; slot.attached_ever = 0; slot.terminal = -1; slot.wstatus = 0; slot.relayed = 0;
  slot.last_beat = now_ms(); slot.last_progress = 0;
  strcpy(slot.identity, identity);
  pthread_mutex_unlock(&slot.lock);
  mach_timebase_info_data_t tb = timebase();
  int n = snprintf(out, sizeof out, "STARTED %d %u %llu %llu %llu %u %u\n", pid, wuid, wid, start_us,
                   (unsigned long long)deadline_ticks, tb.numer, tb.denom);
  write_exact(service, out, (size_t)n);
}

static void do_observe(int service, const char *identity) {
  char out[128];
  int n;
  pthread_mutex_lock(&slot.lock);
  if (!token_ok(identity) || strcmp(identity, slot.identity) != 0) n = snprintf(out, sizeof out, "STATE unknown -1 0\n");
  else if (slot.active) n = snprintf(out, sizeof out, "STATE running -1 0\n");
  else n = snprintf(out, sizeof out, "STATE ended %d %d\n", slot.terminal, slot.wstatus);
  pthread_mutex_unlock(&slot.lock);
  write_exact(service, out, (size_t)n);
}

static int hexval(char c) { return c >= '0' && c <= '9' ? c - '0' : c >= 'a' && c <= 'f' ? c - 'a' + 10 : -1; }

/* One client request: relay to the owner service and serve its start/observe
 * calls until it answers. Any service failure ends the supervisor (fail closed:
 * launchd restarts it and every guard ends its worker on link EOF). */
static void handle_request(int client, int service, const unsigned char *req, uint32_t n) {
  static char line[2 * (MAX_FRAME + 4) + 64];
  static unsigned char reply[MAX_FRAME + 4];
  memcpy(line, "REQ ", 4);
  for (uint32_t i = 0; i < n + 4; i++) snprintf(line + 4 + 2 * i, 3, "%02x", req[i]);
  line[4 + 2 * (n + 4)] = '\n';
  if (write_exact(service, line, 5 + 2 * (n + 4)) != 0) die("service request");
  for (;;) {
    if (read_line(service, line, sizeof line, now_ms() + SERVICE_TIMEOUT_MS) != 0) die("service answer");
    char *save = NULL, *verb = strtok_r(line, " ", &save);
    if (!verb) die("service answer");
    if (!strcmp(verb, "START")) {
      char *id = strtok_r(NULL, " ", &save), *h = strtok_r(NULL, " ", &save), *d = strtok_r(NULL, " ", &save),
           *life = strtok_r(NULL, " ", &save);
      if (!id || !h || !d || !life || strtok_r(NULL, " ", &save)) die("service start");
      do_start(service, id, h, d, life);
    } else if (!strcmp(verb, "OBSERVE")) {
      char *id = strtok_r(NULL, " ", &save);
      if (!id || strtok_r(NULL, " ", &save)) die("service observe");
      do_observe(service, id);
    } else if (!strcmp(verb, "REPLY")) {
      char *hex = strtok_r(NULL, " ", &save);
      size_t len = hex ? strlen(hex) : 0;
      if (!hex || len % 2 || len < 10 || len / 2 > sizeof reply) die("service reply");
      for (size_t i = 0; i < len / 2; i++) {
        int a = hexval(hex[2 * i]), b = hexval(hex[2 * i + 1]);
        if (a < 0 || b < 0) die("service reply");
        reply[i] = (unsigned char)(a * 16 + b);
      }
      uint32_t m = ((uint32_t)reply[0] << 24) | ((uint32_t)reply[1] << 16) | ((uint32_t)reply[2] << 8) | reply[3];
      if (m == 0 || m > MAX_FRAME || m + 4 != len / 2) die("service reply frame");
      (void)write_bounded(client, reply, m + 4, now_ms() + CLIENT_TIMEOUT_MS);
      return;
    } else die("service verb");
  }
}

static int role_supervise(void) {
  errno = 0;
  int loaded = load_conf();
  if (loaded == -1) {
    fprintf(stderr, "instar-worker-enforcer: supervise: installed owner bindings unavailable; refusing\n");
    return 78; /* EX_CONFIG: launchd throttles restarts */
  }
  if (loaded != 0) {
    fprintf(stderr, "instar-worker-enforcer: supervise: installed configuration invalid; refusing\n");
    return 78;
  }
  signal(SIGPIPE, SIG_IGN);
  /* The owner decision service: the release runtime running the release's M1
   * module, fd 3 its only link. Its failure ends the supervisor. */
  char boot[128] = { 0 };
  size_t bl = sizeof boot - 1;
  if (sysctlbyname("kern.bootsessionuuid", boot, &bl, NULL, 0) != 0 || !token_ok(boot)) die("boot session");
  int sp[2];
  if (socketpair(AF_UNIX, SOCK_STREAM, 0, sp) != 0) die("service link");
  posix_spawn_file_actions_t fa;
  posix_spawn_file_actions_init(&fa);
  posix_spawn_file_actions_addopen(&fa, 0, "/dev/null", O_RDONLY, 0);
  posix_spawn_file_actions_addopen(&fa, 1, "/dev/null", O_WRONLY, 0);
  posix_spawn_file_actions_addopen(&fa, 2, "/dev/null", O_WRONLY, 0);
  posix_spawn_file_actions_adddup2(&fa, sp[1], 3);
  posix_spawnattr_t at;
  posix_spawnattr_init(&at);
  posix_spawnattr_setflags(&at, POSIX_SPAWN_CLOEXEC_DEFAULT);
  char *sargv[] = { conf.runtime, conf.service, "service", INSTAR_SERVICE_CONF, boot, self_path, NULL };
  char *empty[] = { NULL };
  pid_t service_pid;
  int rc = posix_spawn(&service_pid, conf.runtime, &fa, &at, sargv, empty);
  posix_spawn_file_actions_destroy(&fa);
  posix_spawnattr_destroy(&at);
  close(sp[1]);
  if (rc != 0) { errno = rc; die("service spawn"); }
  int service = sp[0];
  char ready[64];
  if (read_line(service, ready, sizeof ready, now_ms() + 15000) != 0 || strcmp(ready, "READY") != 0) {
    kill(service_pid, SIGKILL); waitpid(service_pid, NULL, 0);
    fprintf(stderr, "instar-worker-enforcer: supervise: owner service refused its installed bindings; refusing\n");
    return 78;
  }
  /* The control socket: its directory is administrator-owned; the socket accepts
   * any connection and speaks only to the configured agent account. */
  char dir[sizeof ((struct sockaddr_un *)0)->sun_path];
  strcpy(dir, INSTAR_CONTROL_SOCKET);
  *strrchr(dir, '/') = '\0';
  struct stat ds;
  if (mkdir(dir, 0755) != 0 && errno != EEXIST) die("socket directory");
  if (lstat(dir, &ds) != 0 || !S_ISDIR(ds.st_mode) || !owned_not_writable(&ds)) { errno = EPERM; die("socket directory owner"); }
  unlink(INSTAR_CONTROL_SOCKET);
  int ls = socket(AF_UNIX, SOCK_STREAM, 0);
  struct sockaddr_un a = { .sun_family = AF_UNIX };
  strcpy(a.sun_path, INSTAR_CONTROL_SOCKET);
  if (ls < 0 || bind(ls, (struct sockaddr *)&a, sizeof a) != 0 || chmod(INSTAR_CONTROL_SOCKET, 0666) != 0
      || listen(ls, 8) != 0) die("control socket");
  pthread_t t;
  if (pthread_create(&t, NULL, slot_thread, NULL) != 0) die("slot thread");
  for (;;) {
    struct pollfd p[2] = { { .fd = ls, .events = POLLIN }, { .fd = service, .events = POLLIN } };
    if (poll(p, 2, 1000) < 0) { if (errno == EINTR) continue; die("poll"); }
    if (p[1].revents) { errno = 0; die("owner service ended"); }
    if (!p[0].revents) continue;
    int c = accept(ls, NULL, NULL);
    if (c < 0) continue;
    uid_t peer; pid_t peer_pid;
    unsigned char first;
    if (peer_identity(c, &peer, &peer_pid) != 0 || peer != (uid_t)conf.agent_uid
        || read_exact(c, &first, 1, now_ms() + CLIENT_TIMEOUT_MS) != 0) { close(c); continue; }
    if (first == 'A') {                                       /* channel attach, once per launch */
      char id[MAX_TOKEN + 2];
      if (read_line(c, id, sizeof id, now_ms() + CLIENT_TIMEOUT_MS) != 0) { close(c); continue; }
      pthread_mutex_lock(&slot.lock);
      if (slot.active && !slot.attached_ever && token_ok(id) && !strcmp(id, slot.identity)) {
        fcntl(c, F_SETFL, fcntl(c, F_GETFL) | O_NONBLOCK);
        slot.attach = c; slot.attached_ever = 1; slot.last_progress = now_ms(); c = -1;
      }
      pthread_mutex_unlock(&slot.lock);
      if (c >= 0) close(c);
      continue;
    }
    unsigned char *req = malloc(MAX_FRAME + 4);
    uint32_t n = 0;
    if (req) {
      req[0] = first;
      int ok = read_exact(c, req + 1, 3, now_ms() + CLIENT_TIMEOUT_MS) == 0;
      if (ok) n = ((uint32_t)req[0] << 24) | ((uint32_t)req[1] << 16) | ((uint32_t)req[2] << 8) | req[3];
      if (ok && n > 0 && n <= MAX_FRAME && read_exact(c, req + 4, n, now_ms() + CLIENT_TIMEOUT_MS) == 0)
        handle_request(c, service, req, n);
      free(req);
    }
    close(c);
  }
}

int main(int argc, char **argv) {
  if (argc < 2) { errno = 0; die("role required"); }
  const char *role = argv[1];
  /* Probes run inside the confined chain and need no self path. */
  if (!strcmp(role, "probe")) return role_probe(argc, argv);
  char raw[4096];
  uint32_t size = sizeof raw;
  if (_NSGetExecutablePath(raw, &size) != 0 || !realpath(raw, self_path)) die("self path");
  if (!strcmp(role, "client") && argc == 2) return role_client();
  if (!strcmp(role, "channel") && argc == 3) return role_channel(argv[2]);
  if (!strcmp(role, "bootstrap")) return role_bootstrap(argc, argv);
  if (!strcmp(role, "guard")) return role_guard(argc, argv);
  if (!strcmp(role, "supervise") && argc == 2) return role_supervise();
  if (!strcmp(role, "journal-sync") && argc == 3) return role_journal_sync(argv[2]);
  if (!strcmp(role, "feasibility") && (argc == 5 || argc == 6 || argc == 8))
    return feasibility(argv[2], argv[3], argv[4], argc > 5 ? argv[5] : "", argc == 8 ? argv[6] : NULL,
                       argc == 8 ? argv[7] : NULL);
  errno = 0; die("unknown role");
}
