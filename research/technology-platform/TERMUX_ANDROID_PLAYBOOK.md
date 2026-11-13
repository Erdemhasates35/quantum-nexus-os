# Termux / Android Engineering Playbook

## 1. Role of the Android device

Android/Termux is the mobile operator and edge-development environment:
- Git/GitHub repository management and code review;
- diagnostics, log collection and remote orchestration;
- lightweight Python/Go/Rust/Node development and tests;
- data inspection, feature prototypes and small-model inference when compatible;
- monitoring, CLI control and incident response.

Large Pythia datasets, distributed GPT-NeoX training, CUDA workloads and heavy multi-asset backtests belong on compatible Linux/GPU compute.

## 2. Read-only preflight

Run from Termux. No root, no package installation, no file mutation.

```bash
printf '\n=== ANDROID / TERMUX PREFLIGHT ===\n'
printf '\n[DEVICE]\n'
getprop ro.product.model 2>/dev/null || true
getprop ro.build.version.release 2>/dev/null || true
uname -a
printf '\n[PATHS]\n'
printf 'HOME=%s\nPREFIX=%s\n' "$HOME" "$PREFIX"
printf '\n[STORAGE]\n'
df -h "$HOME"
printf '\n[MEMORY]\n'
grep -E 'MemTotal|MemAvailable|SwapTotal|SwapFree' /proc/meminfo
printf '\n[CPU]\n'
getconf _NPROCESSORS_ONLN 2>/dev/null || true
cat /proc/loadavg
printf '\n[TOOLS]\n'
for c in git git-lfs gh python python3 pip node npm rustc cargo clang cmake make jq curl sha256sum; do
  command -v "$c" 2>/dev/null || printf 'MISSING %s\n' "$c"
done
printf '\n[PYTHON PACKAGES]\n'
python -m pip list --format=columns 2>/dev/null | head -80 || true
printf '\n=== PREFLIGHT END ===\n'
```

## 3. Capacity-aware workload classes

| Class | Workload | Device policy |
|---|---|---|
| A | Git operations, static analysis, CLI, small tests | Native Termux |
| B | Small dataframe and feature experiments | Run after RAM/storage check |
| C | Small quantized model inference | Benchmark memory, latency, thermal behavior |
| D | Medium model inference / multi-process backtest | Prefer remote Linux |
| E | 417 GB dataset, distributed training, CUDA | Remote storage + suitable GPU |

## 4. Safe source checkout pattern

```bash
set -eu
BASE="$HOME/erdem-research"
DEST="$BASE/pythia-source"

mkdir -p "$BASE"
if [ -e "$DEST" ]; then
  printf 'STOP: destination already exists: %s\n' "$DEST"
  exit 1
fi

GIT_LFS_SKIP_SMUDGE=1 git clone --depth 1 --filter=blob:none \
  https://github.com/Erdemhasates35/Pythia.git "$DEST"

git -C "$DEST" status --short --branch
git -C "$DEST" log -1 --format='%H %cI %s'
```

## 5. Storage and memory policy

- Measure free storage before clone, package installation, model download or dataset extraction.
- Keep source, cache, datasets and outputs in separate directories.
- Do not mirror 417 GB Pile shards to the phone.
- Do not run unshard operations on Android without a measured memory/storage plan.
- Prefer streaming, chunked hashing and bounded batches.
- Keep a manifest for downloaded artifacts; verify checksums before use.
- Avoid concurrent heavy processes when thermal throttling or Android memory pressure is present.

## 6. Build and test policy

- Detect runtime and architecture before selecting wheels or binaries.
- Pin versions only after confirming Android/Termux compatibility.
- Run smallest smoke test first, then unit tests, then integration tests.
- Record elapsed time, peak RSS when available, CPU load, storage delta and exit status.
- Separate "package import works" from "model inference works" and "workload meets performance target".

## 7. Remote compute interface

Use a remote Linux worker for:
- Pythia data reconstruction and checkpoint sweeps;
- GPT-NeoX training reproduction;
- CUDA training and high-throughput inference;
- multi-year / multi-asset walk-forward backtests.

The Termux controller should submit an immutable job spec containing repository commit, dataset manifest, config hash, seed, resource request, command, output destination and expected metrics.

## 8. No-root operating assumptions

All setup, diagnostics, monitoring and automation must work as the Termux application user. No `su`, no root-only system modification, and no dependency on privileged Android services.
