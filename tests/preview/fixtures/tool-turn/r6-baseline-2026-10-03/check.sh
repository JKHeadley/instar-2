#!/bin/sh
# Configuration check (residual 6): reports names and counts only, never a value.
echo "shell-env-messaging-vars: $(env | grep -c '^CLAUDE_CODE_MESSAGING_')"
if [ -n "$CLAUDE_CODE_MESSAGING_SOCKET" ]; then echo "socket-var: set ($CLAUDE_CODE_MESSAGING_SOCKET)"; else echo "socket-var: unset"; fi
echo "process-env-listings-with-token-name: $(ps -E -ww -o command= -U "$(id -u)" 2>/dev/null | grep -c 'CLAUDE_CODE_MESSAGING_TOKEN=')"
echo "cc-socks-listing: $(ls /tmp/cc-socks 2>&1 | head -1)"
/usr/bin/perl -MIO::Socket::UNIX -e 'for my $p (@ARGV) { next unless length $p; my $s = IO::Socket::UNIX->new(Type => SOCK_STREAM(), Peer => $p); print(($s ? "connected" : "refused: $!"), " <- $p\n"); close $s if $s }' "$CLAUDE_CODE_MESSAGING_SOCKET" "/tmp/w4tr-r6-dummy.sock"
