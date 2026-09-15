#!/usr/bin/env python3
"""Run the permanent P12-NF-16/18/46 four-case process matrix."""
import json
from admission_matrix import run_matrix, valid

report = run_matrix(False)
print(json.dumps(report, indent=2))
raise SystemExit(0 if valid(report, False) else 1)
