#!/bin/sh
set -eu
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
cd "$ROOT"
printf '%s\n' '[FLASH-LOAN] Deterministic multi-chain opportunity engine starting.'
python3 -m pytest -q tests/test_economics.py tests/test_orchestrator.py tests/test_controls.py
python3 scripts/run_flashloan_engine.py
