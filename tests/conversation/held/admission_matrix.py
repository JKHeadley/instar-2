#!/usr/bin/env python3
"""Permanent P12-NF-16/18/46 competing-process admission matrix."""
import json
import pathlib
import subprocess
import tempfile
import time

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[2]
SOURCE = HERE / "admission-process.ts"


def run_matrix(include_restart: bool) -> dict:
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

                def start(mode: str) -> subprocess.Popen:
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
                row = {
                    "order": order,
                    "concurrent": concurrent,
                    "expectedSuccesses": 1,
                    "actualSuccesses": sum(result["kind"] == "Success" for result in results),
                    "results": results,
                }
                if include_restart:
                    restart_results = []
                    for mode in order:
                        start(mode).wait(timeout=60)
                        restart_results.append(json.loads((directory / f"{mode}.result.json").read_text()))
                    row["restartResults"] = restart_results
                reports.append(row)
    return {"status": "EXECUTABLE-row-99-ten-conditional-append", "cases": reports}


def valid(report: dict, include_restart: bool) -> bool:
    for row in report["cases"]:
        if row["actualSuccesses"] != 1:
            return False
        winner = next(result for result in row["results"] if result["kind"] == "Success")
        loser = next(result for result in row["results"] if result["kind"] == "Refused")
        if len(winner["rows"]) != 1 or winner["rows"][0]["mode"] != winner["mode"]:
            return False
        if len(loser["rows"]) != 1 or loser["rows"][0]["mode"] != winner["mode"]:
            return False
        if row["concurrent"] and "conditional append subject frontier changed; current=" not in loser["detail"]:
            return False
        if include_restart:
            restarted = {result["mode"]: result for result in row["restartResults"]}
            if restarted[winner["mode"]]["kind"] != "Success" or restarted[loser["mode"]]["kind"] != "Refused":
                return False
            if any(len(result["rows"]) != 1 or result["rows"][0]["mode"] != winner["mode"]
                   for result in restarted.values()):
                return False
    return True
