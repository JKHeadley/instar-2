"""Synthetic native references only; stdin EOF retires every fixture child.
No private files, process signals, artificial load, or worker ownership claims.
"""
import array
import ctypes
import json
import mmap
import os
import socket
import subprocess
import sys

if sys.argv[1] == 'worker':
    channel = socket.socket(fileno=int(sys.argv[2]))
    fd = os.open(sys.argv[3], os.O_RDONLY) if sys.argv[4] == 'holder' else None
    print(os.getpid(), flush=True)
    for command in sys.stdin:
        command = command.strip()
        if command == 'send':
            channel.sendmsg([b'F'], [(socket.SOL_SOCKET, socket.SCM_RIGHTS, array.array('i', [fd]))])
            os.close(fd)
            fd = None
            print('sent', flush=True)
        elif command == 'receive':
            _, ancillary, flags, _ = channel.recvmsg(1, socket.CMSG_SPACE(array.array('i').itemsize))
            assert not flags & socket.MSG_CTRUNC
            descriptors = array.array('i')
            descriptors.frombytes(ancillary[0][2])
            fd = descriptors[0]
            print(len(os.pread(fd, 1048576, 0)), flush=True)
        elif command == 'read':
            print(len(os.pread(fd, 1048576, 0)), flush=True)
    if fd is not None:
        os.close(fd)
    channel.close()
elif sys.argv[1] == 'pair':
    left, right = socket.socketpair()
    children = []
    try:
        for channel, role in [(left, 'empty'), (right, 'holder')]:
            children.append(subprocess.Popen([sys.executable, __file__, 'worker', str(channel.fileno()), sys.argv[2], role],
                pass_fds=(channel.fileno(),), stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True))
        left.close()
        right.close()
        print(json.dumps([int(child.stdout.readline()) for child in children]), flush=True)
        for command in sys.stdin:
            source = 1 if command.strip() == 'to-left' else 0
            sender, receiver = children[source], children[1 - source]
            sender.stdin.write('send\n')
            sender.stdin.flush()
            assert sender.stdout.readline().strip() == 'sent'
            receiver.stdin.write('receive\n')
            receiver.stdin.flush()
            print(receiver.stdout.readline().strip(), flush=True)
    finally:
        for child in children:
            child.stdin.close()
        for child in children:
            if child.wait(timeout=5) != 0:
                raise RuntimeError('fixture child failed')
elif sys.argv[1] == 'mapping':
    # libc mmap, not Python's mmap object (which retains a duplicate fd).
    lib = ctypes.CDLL(None, use_errno=True)
    lib.mmap.argtypes = [ctypes.c_void_p, ctypes.c_size_t, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_longlong]
    lib.mmap.restype = ctypes.c_void_p
    lib.munmap.argtypes = [ctypes.c_void_p, ctypes.c_size_t]
    fd = os.open(sys.argv[2], os.O_RDONLY)
    size = os.fstat(fd).st_size
    address = lib.mmap(None, size, mmap.PROT_READ, mmap.MAP_PRIVATE, fd, 0)
    assert address != ctypes.c_void_p(-1).value
    os.close(fd)
    try:
        print(json.dumps([os.getpid(), len(ctypes.string_at(address, size))]), flush=True)
        for _ in sys.stdin:
            print(len(ctypes.string_at(address, size)), flush=True)
    finally:
        assert lib.munmap(address, size) == 0
