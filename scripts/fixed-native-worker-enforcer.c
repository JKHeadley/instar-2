/*
 * Fixed M4-L native enforcer (M2). One C artifact, system libraries only.
 *
 * Roles:
 *   client               unprivileged: one canonical frame stdin -> fixed socket -> reply stdout
 *   bootstrap ...        internal: hand task capability to parent, install limits,
 *                        drop privilege, wait on the gate, exec the sandboxed runtime
 *   supervise            installed service entry (refuses until owner bindings exist)
 *   journal-sync <path>  durable journal primitive: F_FULLFSYNC of one owner-only
 *                        regular journal file and then its directory; refuses otherwise
 *   feasibility <case>   the package's small native feasibility cases (memory, cpu,
 *                        task, guard, nowrite, children); prints PASS/FAIL per case
 *   probe <payload>      deterministic attack payloads run INSIDE the confined chain
 *
 * Build (recorded): /usr/bin/clang -std=c11 -O2 -Wall -Wextra -Werror \
 *   -o instar-worker-enforcer scripts/fixed-native-worker-enforcer.c
 * Test builds may add -DINSTAR_CONTROL_SOCKET='"<temp path>"'; the release
 * build uses the fixed path below and has no runtime socket selector.
 */
#define _DARWIN_C_SOURCE
#include <arpa/inet.h>
#include <errno.h>
#include <fcntl.h>
#include <grp.h>
#include <mach/mach.h>
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
#define MAX_FRAME 65536u
#define CLIENT_TIMEOUT_MS 1000
#define GATE_FD 4
#define CHANNEL_FD 3

extern char **environ;
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

/* Continuous clock (includes sleep) converted to nanoseconds. */
static uint64_t continuous_ns(void) {
  static mach_timebase_info_data_t tb;
  if (tb.denom == 0) mach_timebase_info(&tb);
  return mach_continuous_time() * tb.numer / tb.denom;
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
    if (k < 0) { if (errno == EINTR) continue; return -1; }
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

/* ---- client: the only role S8 invokes. No privilege, no selector, no shell. ---- */
static int role_client(void) {
  uint64_t deadline = now_ms() + CLIENT_TIMEOUT_MS;
  uint32_t n;
  unsigned char *req = read_frame(STDIN_FILENO, &n, deadline);
  if (!req) die("client request frame");
  unsigned char extra;
  if (read(STDIN_FILENO, &extra, 1) != 0) { errno = 0; die("client request has trailing bytes"); }
  int s = socket(AF_UNIX, SOCK_STREAM, 0);
  if (s < 0) die("client socket");
  struct sockaddr_un a = { .sun_family = AF_UNIX };
  if (strlen(INSTAR_CONTROL_SOCKET) >= sizeof a.sun_path) { errno = 0; die("socket path"); }
  strcpy(a.sun_path, INSTAR_CONTROL_SOCKET);
  if (connect(s, (struct sockaddr *)&a, sizeof a) != 0) die("client connect");
  /* Peer identity before any request byte leaves: a socket bound by anything
   * other than the fixed supervisor account is refused, never spoken to. */
  uid_t peer_uid; pid_t peer_pid;
  if (peer_identity(s, &peer_uid, &peer_pid) != 0) die("client peer identity");
  if (peer_uid != (uid_t)INSTAR_CONTROL_PEER_UID || peer_pid <= 0) { errno = 0; die("client peer is not the supervisor"); }
  if (write_exact(s, req, n + 4) != 0) die("client send");
  shutdown(s, SHUT_WR);
  uint32_t m;
  unsigned char *rep = read_frame(s, &m, deadline);
  if (!rep) die("client reply frame");
  if (read_exact(s, &extra, 1, deadline) == 0) { errno = 0; die("client reply has trailing bytes"); }
  if (write_exact(STDOUT_FILENO, rep, m + 4) != 0) die("client output");
  return 0;
}

/* ---- task capability handoff: child sends its own task port to its parent,
 * which pre-installed a receive right as the child's bootstrap special port. ---- */
typedef struct {
  mach_msg_header_t header;
  mach_msg_body_t body;
  mach_msg_port_descriptor_t task;   /* sender's own task control port */
  mach_msg_port_descriptor_t inbox;  /* optional send right to the sender's inbox */
} handoff_msg_t;
typedef struct { handoff_msg_t msg; mach_msg_trailer_t trailer; } handoff_rcv_t;
/* Supervisor -> guard: the worker's capability and its immutable deadline. */
typedef struct {
  mach_msg_header_t header;
  mach_msg_body_t body;
  mach_msg_port_descriptor_t worker;
  uint64_t deadline_ns;
  int32_t worker_pid;
} arm_msg_t;
typedef struct { arm_msg_t msg; mach_msg_trailer_t trailer; } arm_rcv_t;

static int send_task_to_parent(mach_port_t inbox) {
  mach_port_t parent = MACH_PORT_NULL;
  if (task_get_special_port(mach_task_self(), TASK_BOOTSTRAP_PORT, &parent) != KERN_SUCCESS) return -1;
  handoff_msg_t m;
  memset(&m, 0, sizeof m);
  m.header.msgh_bits = MACH_MSGH_BITS_SET(MACH_MSG_TYPE_COPY_SEND, 0, 0, MACH_MSGH_BITS_COMPLEX);
  m.header.msgh_size = sizeof m;
  m.header.msgh_remote_port = parent;
  m.header.msgh_id = 0x1157;
  m.body.msgh_descriptor_count = 2;
  m.task.name = mach_task_self();
  m.task.disposition = MACH_MSG_TYPE_COPY_SEND;
  m.task.type = MACH_MSG_PORT_DESCRIPTOR;
  m.inbox.name = inbox;
  m.inbox.disposition = MACH_MSG_TYPE_MAKE_SEND;
  m.inbox.type = MACH_MSG_PORT_DESCRIPTOR;
  kern_return_t kr = mach_msg(&m.header, MACH_SEND_MSG | MACH_SEND_TIMEOUT, sizeof m, 0,
                              MACH_PORT_NULL, 1000, MACH_PORT_NULL);
  /* No bootstrap port afterwards: no Mach service lookups from this task. */
  task_set_special_port(mach_task_self(), TASK_BOOTSTRAP_PORT, MACH_PORT_NULL);
  mach_port_deallocate(mach_task_self(), parent);
  return kr == KERN_SUCCESS ? 0 : -1;
}

static mach_port_t receive_task(mach_port_t recv, int timeout_ms, mach_port_t *inbox) {
  handoff_rcv_t r;
  memset(&r, 0, sizeof r);
  kern_return_t kr = mach_msg(&r.msg.header, MACH_RCV_MSG | MACH_RCV_TIMEOUT, 0, sizeof r, recv,
                              (mach_msg_timeout_t)timeout_ms, MACH_PORT_NULL);
  if (kr != KERN_SUCCESS || r.msg.header.msgh_id != 0x1157 || r.msg.body.msgh_descriptor_count != 2)
    return MACH_PORT_NULL;
  if (inbox) *inbox = r.msg.inbox.name;
  else if (r.msg.inbox.name != MACH_PORT_NULL) mach_port_deallocate(mach_task_self(), r.msg.inbox.name);
  return r.msg.task.name;
}

static int send_arm(mach_port_t guard_inbox, mach_port_t worker, pid_t pid, uint64_t deadline_ns) {
  arm_msg_t m;
  memset(&m, 0, sizeof m);
  m.header.msgh_bits = MACH_MSGH_BITS_SET(MACH_MSG_TYPE_COPY_SEND, 0, 0, MACH_MSGH_BITS_COMPLEX);
  m.header.msgh_size = sizeof m;
  m.header.msgh_remote_port = guard_inbox;
  m.header.msgh_id = 0x1158;
  m.body.msgh_descriptor_count = 1;
  m.worker.name = worker;
  m.worker.disposition = MACH_MSG_TYPE_COPY_SEND;
  m.worker.type = MACH_MSG_PORT_DESCRIPTOR;
  m.deadline_ns = deadline_ns;
  m.worker_pid = pid;
  return mach_msg(&m.header, MACH_SEND_MSG | MACH_SEND_TIMEOUT, sizeof m, 0, MACH_PORT_NULL, 1000,
                  MACH_PORT_NULL) == KERN_SUCCESS ? 0 : -1;
}

/* ---- limits ---- */
typedef struct { rlim_t as, cpu, nofile, nproc; } limits_t;

static int install_limits(const limits_t *l) {
  struct { int res; rlim_t v; } set[] = {
    { RLIMIT_AS, l->as }, { RLIMIT_CPU, l->cpu }, { RLIMIT_NOFILE, l->nofile },
    { RLIMIT_FSIZE, 0 }, { RLIMIT_CORE, 0 }, { RLIMIT_NPROC, l->nproc },
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
  if (errno || *end || s[0] == '\0') { errno = EINVAL; die("limit value"); }
  return (rlim_t)v;
}

/*
 * bootstrap <as> <cpu> <nofile> <nproc> <uid> <gid> <profile|-> <program> [args...]
 * Trusted code only runs before the gate: capability handoff, limits, descriptor
 * and environment scrub, privilege drop. Nothing worker-controlled runs until
 * the parent writes the release byte on GATE_FD after arming.
 */
static int role_bootstrap(int argc, char **argv) {
  if (argc < 10) { errno = 0; die("bootstrap arguments"); }
  limits_t l = { parse_limit(argv[2]), parse_limit(argv[3]), parse_limit(argv[4]), parse_limit(argv[5]) };
  uid_t uid = (uid_t)parse_limit(argv[6]);
  gid_t gid = (gid_t)parse_limit(argv[7]);
  const char *profile = argv[8];
  if (send_task_to_parent(MACH_PORT_NULL) != 0) die("bootstrap capability handoff");
  if (install_limits(&l) != 0) die("bootstrap limits");
  /* Keep only 0-2 (/dev/null), the channel and the gate. */
  int null = open("/dev/null", O_RDWR);
  if (null < 0) die("bootstrap /dev/null");
  for (int fd = 0; fd <= 2; fd++) if (dup2(null, fd) < 0) die("bootstrap stdio");
  for (int fd = 5; fd < 4096; fd++) if (fd != null) close(fd);
  if (null > 4) close(null);
  if (getuid() == 0) {
    if (setgroups(1, &gid) != 0 || setgid(gid) != 0 || setuid(uid) != 0) die("bootstrap privilege drop");
    if (setuid(0) == 0 || getuid() != uid || geteuid() != uid || getgid() != gid) { errno = 0; die("privilege regained"); }
  } else if (uid != getuid() || gid != getgid()) { errno = EPERM; die("bootstrap identity (unprivileged)"); }
  char go = 0;
  if (read(GATE_FD, &go, 1) != 1 || go != 'G') _exit(111); /* gate closed: never run worker */
  close(GATE_FD);
  char *empty[] = { NULL };
  if (strcmp(profile, "-") == 0) execve(argv[9], &argv[9], empty);
  else {
    char *sargv[256];
    int k = 0;
    sargv[k++] = "/usr/bin/sandbox-exec"; sargv[k++] = "-f"; sargv[k++] = (char *)profile;
    for (int i = 9; i < argc && k < 255; i++) sargv[k++] = argv[i];
    sargv[k] = NULL;
    execve("/usr/bin/sandbox-exec", sargv, empty);
  }
  _exit(112);
}

/* ---- spawning a gated bootstrap child and holding its task capability ---- */
typedef struct { pid_t pid; mach_port_t task; int gate; } child_t;

static int spawn_bootstrap(child_t *c, char *const argv[]) {
  mach_port_t recv;
  if (mach_port_allocate(mach_task_self(), MACH_PORT_RIGHT_RECEIVE, &recv) != KERN_SUCCESS) return -1;
  mach_port_insert_right(mach_task_self(), recv, recv, MACH_MSG_TYPE_MAKE_SEND);
  int gate[2];
  if (pipe(gate) != 0) return -1;
  posix_spawn_file_actions_t fa;
  posix_spawn_file_actions_init(&fa);
  /* Close the write end first: it may already occupy GATE_FD's number. */
  posix_spawn_file_actions_addclose(&fa, gate[1]);
  posix_spawn_file_actions_adddup2(&fa, gate[0], GATE_FD);
  posix_spawnattr_t at;
  posix_spawnattr_init(&at);
  posix_spawnattr_setspecialport_np(&at, recv, TASK_BOOTSTRAP_PORT);
  char *empty[] = { NULL };
  int rc = posix_spawn(&c->pid, self_path, &fa, &at, argv, empty);
  posix_spawn_file_actions_destroy(&fa);
  posix_spawnattr_destroy(&at);
  close(gate[0]);
  mach_port_deallocate(mach_task_self(), recv); /* drop our send right */
  if (rc != 0) { close(gate[1]); errno = rc; return -1; }
  c->gate = gate[1];
  c->task = receive_task(recv, 2000, NULL);
  mach_port_mod_refs(mach_task_self(), recv, MACH_PORT_RIGHT_RECEIVE, -1);
  return c->task == MACH_PORT_NULL ? -1 : 0;
}

static void release_gate(child_t *c) { (void)write(c->gate, "G", 1); close(c->gate); c->gate = -1; }

/* Wait up to ms for exit; returns status or -1 on timeout. */
static int wait_for(pid_t pid, int ms, int *status) {
  uint64_t end = now_ms() + (uint64_t)ms;
  for (;;) {
    pid_t r = waitpid(pid, status, WNOHANG);
    if (r == pid) return 0;
    if (now_ms() >= end) return -1;
    usleep(5000);
  }
}

/* Identity-safe termination through the original task capability. */
static int terminate_task(mach_port_t task) { return task_terminate(task) == KERN_SUCCESS ? 0 : -1; }

static int task_pid_matches(mach_port_t task, pid_t pid) {
  int p = -1;
  return pid_for_task(task, &p) == KERN_SUCCESS && p == pid;
}

/* Alive and not a zombie (a zombie keeps its PID until reaped). */
static int alive(pid_t pid) {
  struct kinfo_proc kp; size_t len = sizeof kp;
  int mib[4] = { CTL_KERN, KERN_PROC, KERN_PROC_PID, pid };
  if (sysctl(mib, 4, &kp, &len, NULL, 0) != 0 || len == 0) return 0;
  return kp.kp_proc.p_stat != SZOMB;
}

#define LAPSE_MS 250
/*
 * guard (internal): fd 3 is a private socketpair to the supervisor. The guard
 * hands its task + inbox to the supervisor, receives the worker capability and
 * immutable continuous-clock deadline, acknowledges, then terminates the
 * original worker on supervisor death, a heartbeat lapse > LAPSE_MS, or the
 * deadline. It never restarts anything and cannot move the deadline.
 */
static int role_guard(void) {
  mach_port_t inbox;
  if (mach_port_allocate(mach_task_self(), MACH_PORT_RIGHT_RECEIVE, &inbox) != KERN_SUCCESS) die("guard inbox");
  if (send_task_to_parent(inbox) != 0) die("guard handoff");
  arm_rcv_t r;
  memset(&r, 0, sizeof r);
  if (mach_msg(&r.msg.header, MACH_RCV_MSG | MACH_RCV_TIMEOUT, 0, sizeof r, inbox, 2000, MACH_PORT_NULL)
        != KERN_SUCCESS || r.msg.header.msgh_id != 0x1158 || r.msg.body.msgh_descriptor_count != 1)
    die("guard arm");
  mach_port_t worker = r.msg.worker.name;
  pid_t pid = r.msg.worker_pid;
  uint64_t deadline = r.msg.deadline_ns;
  if (!task_pid_matches(worker, pid)) { errno = 0; die("guard worker identity"); }
  if (write_exact(CHANNEL_FD, "A", 1) != 0) die("guard ack");
  uint64_t last = continuous_ns();
  for (;;) {
    uint64_t now = continuous_ns();
    if (now >= deadline) { terminate_task(worker); return 30; }                 /* deadline */
    if (now - last > (uint64_t)LAPSE_MS * 1000000u) { terminate_task(worker); return 31; } /* lapse */
    if (!task_pid_matches(worker, pid)) return 0;                              /* worker already gone */
    uint64_t wait_ms = (deadline - now) / 1000000u + 1;
    if (wait_ms > 20) wait_ms = 20;
    struct pollfd p = { .fd = CHANNEL_FD, .events = POLLIN };
    int k = poll(&p, 1, (int)wait_ms);
    if (k > 0) {
      char b[64];
      ssize_t n = read(CHANNEL_FD, b, sizeof b);
      if (n <= 0) { terminate_task(worker); return 32; }                        /* supervisor death */
      last = continuous_ns();
    }
  }
}

typedef struct { pid_t pid; mach_port_t task; mach_port_t inbox; int link; } guard_t;

static int spawn_guard(guard_t *g) {
  mach_port_t recv;
  if (mach_port_allocate(mach_task_self(), MACH_PORT_RIGHT_RECEIVE, &recv) != KERN_SUCCESS) return -1;
  mach_port_insert_right(mach_task_self(), recv, recv, MACH_MSG_TYPE_MAKE_SEND);
  int sp[2];
  if (socketpair(AF_UNIX, SOCK_STREAM, 0, sp) != 0) return -1;
  posix_spawn_file_actions_t fa;
  posix_spawn_file_actions_init(&fa);
  posix_spawn_file_actions_addclose(&fa, sp[0]);
  posix_spawn_file_actions_adddup2(&fa, sp[1], CHANNEL_FD);
  posix_spawnattr_t at;
  posix_spawnattr_init(&at);
  posix_spawnattr_setspecialport_np(&at, recv, TASK_BOOTSTRAP_PORT);
  char *argv[] = { self_path, "guard", NULL }, *empty[] = { NULL };
  int rc = posix_spawn(&g->pid, self_path, &fa, &at, argv, empty);
  posix_spawn_file_actions_destroy(&fa);
  posix_spawnattr_destroy(&at);
  close(sp[1]);
  mach_port_deallocate(mach_task_self(), recv);
  if (rc != 0) { close(sp[0]); errno = rc; return -1; }
  g->link = sp[0];
  g->task = receive_task(recv, 2000, &g->inbox);
  mach_port_mod_refs(mach_task_self(), recv, MACH_PORT_RIGHT_RECEIVE, -1);
  return g->task == MACH_PORT_NULL ? -1 : 0;
}

/*
 * Arm order (inspectable): guard spawned and handed off -> worker bootstrap
 * spawned (blocked at gate) and handed off -> worker capability + deadline
 * sent to guard -> guard ack received -> ONLY THEN gate released.
 */
static int arm_and_release(guard_t *g, child_t *w, uint64_t deadline_ns) {
  if (send_arm(g->inbox, w->task, w->pid, deadline_ns) != 0) return -1;
  char a = 0;
  uint64_t end = now_ms() + 1000;
  if (read_exact(g->link, &a, 1, end) != 0 || a != 'A') return -1;
  release_gate(w);
  return 0;
}

/* Test cleanup of a probe WE spawned and have not reaped: the kernel never
 * reuses an unreaped child's PID, so this parent-held kill is identity-safe.
 * (Not available to a non-parent role; see the guard/task cases.) */
static void end_child(child_t *c, int *st) {
  if (terminate_task(c->task) == 0 && wait_for(c->pid, 500, st) == 0) return;
  kill(c->pid, SIGKILL);
  waitpid(c->pid, st, 0);
}

/* ---- probe payloads (run inside the confined chain) ---- */
static void ignore_xcpu(int s) { (void)s; }
static void *spin(void *arg) { volatile uint64_t x = 0; (void)arg; for (;;) x++; return NULL; }

static int role_probe(int argc, char **argv) {
  if (argc < 3) return 64;
  const char *p = argv[2];
  if (!strcmp(p, "alloc")) {                 /* malloc+touch then mmap: must be refused */
    size_t mib = argc > 3 ? (size_t)strtoull(argv[3], NULL, 10) : 1024;
    size_t n = mib << 20;
    char *m = malloc(n);
    if (m) { for (size_t i = 0; i < n; i += 4096) m[i] = 1; return 10; }
    void *q = mmap(NULL, n, PROT_READ | PROT_WRITE, MAP_ANON | MAP_PRIVATE, -1, 0);
    if (q != MAP_FAILED) return 11;
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
static int report(const char *name, int pass, const char *fmt, ...) __attribute__((format(printf, 3, 4)));
static int report(const char *name, int pass, const char *fmt, ...) {
  va_list ap; va_start(ap, fmt);
  printf("feasibility.%s=%s ", name, pass ? "PASS" : "FAIL");
  vprintf(fmt, ap); printf("\n"); fflush(stdout);
  va_end(ap);
  return pass ? 0 : 1;
}

static char uid_s[16], gid_s[16];

/* Spawn: bootstrap limits... program args, release gate, return child. */
static int run_confined(child_t *c, const char *as, const char *cpu, const char *profile,
                        char *const payload[]) {
  char *argv[64];
  int k = 0;
  argv[k++] = self_path; argv[k++] = "bootstrap"; argv[k++] = (char *)as; argv[k++] = (char *)cpu;
  argv[k++] = "32"; argv[k++] = "1"; argv[k++] = uid_s; argv[k++] = gid_s; argv[k++] = (char *)profile;
  for (int i = 0; payload[i] && k < 63; i++) argv[k++] = payload[i];
  argv[k] = NULL;
  if (spawn_bootstrap(c, argv) != 0) return -1;
  release_gate(c);
  return 0;
}

static int exit_code(int st) { return WIFEXITED(st) ? WEXITSTATUS(st) : -WTERMSIG(st); }

static int probe_case(const char *name, const char *profile, char *const payload[], int expect, const char *what) {
  child_t c; int st = 0;
  if (run_confined(&c, "-", "5", profile, payload) != 0) return report(name, 0, "spawn failed: %s", strerror(errno));
  if (wait_for(c.pid, 5000, &st) != 0) { end_child(&c, &st); return report(name, 0, "%s: did not complete", what); }
  return report(name, exit_code(st) == expect, "%s outcome=%d", what, exit_code(st));
}

static int feasibility(const char *which, const char *profile, const char *scratch, const char *runtime) {
  signal(SIGPIPE, SIG_IGN); /* a refused bootstrap closes the gate pipe early */
  snprintf(uid_s, sizeof uid_s, "%u", getuid());
  snprintf(gid_s, sizeof gid_s, "%u", getgid());
  int failures = 0, st;
  int all = !strcmp(which, "all");
  if (all || !strcmp(which, "memory")) {
    /* (a) The hard address-space bound must be installable at the proposed
     * ceiling (8 GiB) and must refuse an over-limit allocation after exec. */
    child_t c; char *p[] = { self_path, "probe", "alloc", "2048", NULL };
    if (run_confined(&c, "1073741824", "-", profile, p) != 0) failures += report("memory", 0, "spawn failed: %s", strerror(errno));
    else {
      if (wait_for(c.pid, 10000, &st) != 0) end_child(&c, &st);
      /* Measure the smallest RLIMIT_AS this kernel accepts for a fresh process. */
      unsigned long long lo = 1ull << 30, hi = 1ull << 42, minimum = 0;
      pid_t m = fork();
      if (m == 0) {
        struct rlimit none = { RLIM_INFINITY, RLIM_INFINITY }, t;
        if (getrlimit(RLIMIT_AS, &t) != 0) _exit(0);
        while (hi - lo > (1ull << 28)) {
          unsigned long long mid = lo + (hi - lo) / 2; struct rlimit r = { mid, RLIM_INFINITY };
          if (setrlimit(RLIMIT_AS, &r) == 0) { hi = mid; setrlimit(RLIMIT_AS, &none); } else lo = mid;
        }
        _exit((int)(hi >> 32 > 250 ? 250 : hi >> 32)); /* units of 4 GiB */
      }
      int ms_; waitpid(m, &ms_, 0); minimum = WIFEXITED(ms_) ? (unsigned long long)WEXITSTATUS(ms_) * 4 : 0;
      failures += report("memory", exit_code(st) == 3,
        "RLIMIT_AS soft=hard 1GiB via bootstrap: outcome=%d (3=over-limit alloc refused, 2=limit not installable); smallest RLIMIT_AS accepted ~%lluGiB",
        exit_code(st), minimum);
    }
    child_t r; char *q[] = { self_path, "probe", "raise", NULL };
    if (run_confined(&r, "-", "5", profile, q) == 0 && wait_for(r.pid, 5000, &st) == 0)
      failures += report("limit-raise", exit_code(st) == 3, "raise hard CPU from inside outcome=%d (3=refused)", exit_code(st));
    else failures += report("limit-raise", 0, "did not complete");
  }
  if (all || !strcmp(which, "cpu")) {
    child_t c; char *p[] = { self_path, "probe", "spin", NULL };
    uint64_t t0 = now_ms();
    if (run_confined(&c, "-", "1", profile, p) != 0) failures += report("cpu", 0, "spawn failed");
    else {
      int done = wait_for(c.pid, 8000, &st) == 0;
      uint64_t el = now_ms() - t0;
      if (!done) end_child(&c, &st);
      failures += report("cpu", done && WIFSIGNALED(st) && WTERMSIG(st) == SIGKILL,
        "RLIMIT_CPU=1s, SIGXCPU ignored, 3 threads: kernel-terminated=%s signal=%d wall_ms=%llu",
        done ? "yes" : "no (guard-terminated)", WIFSIGNALED(st) ? WTERMSIG(st) : 0, (unsigned long long)el);
    }
  }
  if (all || !strcmp(which, "task")) {
    const char *targets[] = { self_path, runtime };
    for (int i = 0; i < 2; i++) {
      if (!targets[i] || !*targets[i]) continue;
      const char *name = i ? "task-runtime" : "task";
      child_t c;
      char *argv[16]; int k = 0;
      argv[k++] = self_path; argv[k++] = "bootstrap"; argv[k++] = "-"; argv[k++] = "-"; argv[k++] = "32";
      argv[k++] = "1"; argv[k++] = uid_s; argv[k++] = gid_s; argv[k++] = (char *)profile;
      argv[k++] = (char *)targets[i];
      if (i == 0) { argv[k++] = "probe"; argv[k++] = "sleep"; } else { argv[k++] = "-e"; argv[k++] = "setTimeout(()=>{},30000)"; }
      argv[k] = NULL;
      if (spawn_bootstrap(&c, argv) != 0) { failures += report(name, 0, "capability handoff failed: %s", strerror(errno)); continue; }
      int pre = task_pid_matches(c.task, c.pid);
      release_gate(&c);
      usleep(400000); /* past sandbox-exec and the runtime exec */
      int running = alive(c.pid);
      int post = task_pid_matches(c.task, c.pid);
      int killed = post && terminate_task(c.task) == 0 && wait_for(c.pid, 2000, &st) == 0;
      if (!killed) { kill(c.pid, SIGKILL); waitpid(c.pid, &st, 0); } /* cleanup of our own probe after FAIL */
      failures += report(name, pre && running && post && killed,
        "task right acquired pre-gate: binding pre-exec=%s; after bootstrap->%s%s (running=%s): binding=%s terminate=%s",
        pre ? "valid" : "lost", strcmp(profile, "-") ? "sandbox-exec->" : "", targets[i], running ? "yes" : "no", post ? "valid" : "lost", killed ? "ok" : "failed");
      if (killed) failures += report(i ? "task-runtime-stale" : "task-stale", terminate_task(c.task) != 0, "terminate after reap refused");
    }
  }
  if (all || !strcmp(which, "guard")) {
    /* Supervisor simulation S owns guard G and worker W; faults are injected
     * from here. W must end promptly in each case; a PID-lookup kill is never
     * used by S or G (only task_terminate on the original capability). */
    const char *faults[] = { "supervisor-kill", "supervisor-stop", "guard-kill", "deadline" };
    for (int f = 0; f < 4; f++) {
      int info[2]; if (pipe(info) != 0) die("pipe");
      pid_t sup = fork();
      if (sup == 0) {
        close(info[0]);
        guard_t g; child_t w;
        char *p[] = { self_path, "probe", "sleep", NULL };
        char *argv[16]; int k = 0;
        argv[k++] = self_path; argv[k++] = "bootstrap"; argv[k++] = "-"; argv[k++] = "-"; argv[k++] = "32";
        argv[k++] = "1"; argv[k++] = uid_s; argv[k++] = gid_s; argv[k++] = (char *)profile;
        argv[k++] = p[0]; argv[k++] = p[1]; argv[k++] = p[2]; argv[k] = NULL;
        uint64_t deadline = continuous_ns() + (f == 3 ? 800u : 20000u) * 1000000ull;
        if (spawn_guard(&g) != 0 || spawn_bootstrap(&w, argv) != 0 || arm_and_release(&g, &w, deadline) != 0) _exit(20);
        char msg[64]; int n = snprintf(msg, sizeof msg, "%d %d\n", w.pid, g.pid);
        (void)write(info[1], msg, (size_t)n);
        for (;;) {                                   /* heartbeat + own enforcement */
          if (write(g.link, "H", 1) != 1 || !alive(g.pid)) { terminate_task(w.task); waitpid(w.pid, NULL, 0); _exit(0); }
          if (continuous_ns() >= deadline) { terminate_task(w.task); waitpid(w.pid, NULL, 0); _exit(0); }
          int st; if (waitpid(w.pid, &st, WNOHANG) == w.pid) _exit(0);
          waitpid(g.pid, &st, WNOHANG);
          usleep(100000);
        }
      }
      close(info[1]);
      char buf[64] = { 0 };
      struct pollfd pf = { .fd = info[0], .events = POLLIN };
      ssize_t k = poll(&pf, 1, 4000) > 0 ? read(info[0], buf, sizeof buf - 1) : 0;
      close(info[0]);
      pid_t worker = -1, guardp = -1;
      if (k <= 0 || sscanf(buf, "%d %d", &worker, &guardp) != 2) {
        kill(sup, SIGKILL); waitpid(sup, NULL, 0);
        failures += report("guard", 0, "%s: arm sequence did not complete", faults[f]); continue;
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
      if (!gone && worker > 0) kill(worker, SIGKILL); /* cleanup of our own probe after a FAIL only */
      if (guardp > 0) kill(guardp, SIGKILL);
      char label[64]; snprintf(label, sizeof label, "guard-%s", faults[f]);
      failures += report(label, before && gone, "worker ended=%s after %llums (deadline case: 800ms from arm)",
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
    /* Gate closed without release: worker code never runs. */
    child_t c; char *argv[] = { self_path, "bootstrap", "-", "-", "32", "1", uid_s, gid_s, "-", "/usr/bin/true", NULL };
    if (spawn_bootstrap(&c, argv) != 0) failures += report("gate", 0, "spawn failed");
    else { close(c.gate); waitpid(c.pid, &st, 0);
      failures += report("gate", exit_code(st) == 111, "closed gate outcome=%d (111=never released)", exit_code(st)); }
  }
  printf("feasibility.clock=continuous_ns:%llu\n", (unsigned long long)continuous_ns());
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

static int role_supervise(void) {
  /* The installed service stays refusing until the reviewed release manifest,
   * installed owner bindings and journal are present (see README). */
  errno = 0;
  fprintf(stderr, "instar-worker-enforcer: supervise: installed owner bindings unavailable; refusing\n");
  return 78; /* EX_CONFIG: launchd throttles restarts */
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
  if (!strcmp(role, "bootstrap")) return role_bootstrap(argc, argv);
  if (!strcmp(role, "guard") && argc == 2) return role_guard();
  if (!strcmp(role, "supervise") && argc == 2) return role_supervise();
  if (!strcmp(role, "journal-sync") && argc == 3) return role_journal_sync(argv[2]);
  if (!strcmp(role, "feasibility") && argc >= 5)
    return feasibility(argv[2], argv[3], argv[4], argc > 5 ? argv[5] : "");
  errno = 0; die("unknown role");
}
