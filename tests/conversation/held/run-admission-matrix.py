#!/usr/bin/env python3
"""HELD P12-NF-16/18/46 reproducer; expected to exit 1 until row 99 lands."""
import json
import pathlib
import subprocess
import tempfile
import time

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[2]
SOURCE = HERE / "admission-process.ts"

reports = []
with tempfile.TemporaryDirectory(prefix="p12-row99-") as temporary:
    temporary_path = pathlib.Path(temporary)
    child = temporary_path / "admission-process.mjs"
    subprocess.run(
        ["node", str(ROOT / "scripts/slice-p12-row99-admission-build.mjs"), str(SOURCE), str(child)],
        cwd=ROOT, check=True,
    )
    for order in [("long-poll", "webhook"), ("webhook", "long-poll")]:
        for concurrent in [False, True]:
            directory = temporary_path / f"{order[0]}-{'overlap' if concurrent else 'sequential'}"
            directory.mkdir()
            subprocess.run(["node", str(child), str(directory), "seed"], cwd=ROOT, check=True)

            def start(mode):
                return subprocess.Popen(
                    ["node", str(child), str(directory), mode], cwd=ROOT,
                    stdout=(directory / f"{mode}.log").open("w"), stderr=subprocess.STDOUT,
                )

            if concurrent:
                processes = {mode: start(mode) for mode in order}
                deadline = time.time() + 60
                while not all((directory / f"{mode}.ready").exists() for mode in processes):
                    if time.time() > deadline or any(process.poll() is not None for process in processes.values()):
                        raise RuntimeError(f"admission readiness failed; see {directory}")
                    time.sleep(0.02)
                for mode, process in processes.items():
                    (directory / f"{mode}.release").touch()
                    process.wait(timeout=60)
            else:
                for mode in order:
                    (directory / f"{mode}.release").touch()
                    start(mode).wait(timeout=60)

            results = [json.loads((directory / f"{mode}.result.json").read_text()) for mode in order]
            reports.append({
                "order": order,
                "concurrent": concurrent,
                "expectedSuccesses": 1,
                "actualSuccesses": sum(result["kind"] == "Success" for result in results),
                "results": results,
            })

print(json.dumps({
    "status": "HELD-NON-EXECUTABLE-UNTIL-row-99-ten-conditional-append",
    "cases": reports,
}, indent=2))
raise SystemExit(1 if any(row["actualSuccesses"] != row["expectedSuccesses"] for row in reports) else 0)
