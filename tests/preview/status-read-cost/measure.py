import subprocess,os,pathlib,resource,time,json,sys,hashlib,argparse
# CPU seconds include user+system time of the foreground status process and loader thread.
parser=argparse.ArgumentParser()
parser.add_argument('root_pointer')
parser.add_argument('--runs',type=int,default=3)
parser.add_argument('--plain',action='store_true')
args=parser.parse_args()
root=pathlib.Path(args.root_pointer).read_text().strip()
repository=pathlib.Path(__file__).resolve().parents[3]
os.chdir(repository)
env={**os.environ,'INSTAR_SECRET_PREVIEW_STORAGE_KEY':'07'*32,'INSTAR_CONVERSATION_OWNERS':root+'/owners'}
journal=pathlib.Path(root)/'journal.encrypted'
original=hashlib.sha256(journal.read_bytes()).hexdigest()

loader='./scripts/slice-ts-loader.mjs' if args.plain else str(pathlib.Path(__file__).with_name('profile-loader.mjs'))
for i in range(args.runs):
 start=time.monotonic(); before=resource.getrusage(resource.RUSAGE_CHILDREN)
 p=subprocess.run(['node','--no-warnings','--loader',loader,'tests/preview/journal-agent.mjs','status','--root',root],env=env,capture_output=True,text=True)
 after=resource.getrusage(resource.RUSAGE_CHILDREN)
 row={'i':i,'returncode':p.returncode,'wall':time.monotonic()-start,'cpu':after.ru_utime+after.ru_stime-before.ru_utime-before.ru_stime,'stderr':p.stderr,'stdoutBytes':len(p.stdout),'stdoutSha256':hashlib.sha256(p.stdout.encode()).hexdigest()}
 print(json.dumps(row),flush=True)

 if p.returncode: sys.exit(p.returncode)

assert hashlib.sha256(journal.read_bytes()).hexdigest()==original, 'status modified journal bytes'
