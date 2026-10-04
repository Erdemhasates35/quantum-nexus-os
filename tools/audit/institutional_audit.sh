#!/data/data/com.termux/files/usr/bin/bash
set +e

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT" || exit 1

REPORT="$ROOT/INSTITUTIONAL_FLASHLOAN_AUDIT.txt"
: > "$REPORT"

log() {
    printf '%s\n' "$*" | tee -a "$REPORT"
}

section() {
    log ""
    log "============================================================"
    log "$1"
    log "============================================================"
}

section "[01] ENVIRONMENT"

log "DATE=$(date -Iseconds)"
log "PWD=$(pwd)"
log "TERMUX_PREFIX=${PREFIX:-UNSET}"

command -v forge >/dev/null 2>&1 \
    && forge --version | head -1 | tee -a "$REPORT"

command -v cast >/dev/null 2>&1 \
    && cast --version | head -1 | tee -a "$REPORT"

command -v solc >/dev/null 2>&1 \
    && solc --version | head -3 | tee -a "$REPORT"

section "[02] GIT STATE"

git rev-parse --show-toplevel 2>/dev/null | tee -a "$REPORT"
git branch --show-current 2>/dev/null | tee -a "$REPORT"
git status --short 2>/dev/null | tee -a "$REPORT"

section "[03] PROJECT INVENTORY"

find . \
    -path './.git' -prune -o \
    -type f -print 2>/dev/null \
    | sort \
    | tee -a "$REPORT"

section "[04] FOUNDRY CONFIG"

if [ -f foundry.toml ]; then
    cat foundry.toml | tee -a "$REPORT"
else
    log "foundry.toml NOT FOUND"
fi

section "[05] RECEIVER SOURCE"

if [ -f contracts/AaveFlashArbReceiver.sol ]; then
    sed -n '1,400p' contracts/AaveFlashArbReceiver.sol \
        | tee -a "$REPORT"
else
    log "AaveFlashArbReceiver.sol NOT FOUND"
fi

section "[06] EVM ENGINE"

if [ -f flashloan_engine/live_evm.py ]; then
    sed -n '1,400p' flashloan_engine/live_evm.py \
        | tee -a "$REPORT"
else
    log "flashloan_engine/live_evm.py NOT FOUND"
fi

section "[07] ARCHITECTURE DOCUMENTS"

for f in \
    FLASHLOAN_ARCHITECTURE.md \
    FLASHLOAN_SPONSORED_EXECUTION.md \
    .env.flashloan.example
do
    if [ -f "$f" ]; then
        log ""
        log "----- $f -----"
        sed -n '1,400p' "$f" | tee -a "$REPORT"
    else
        log "$f NOT FOUND"
    fi
done

section "[08] BUILD"

forge clean >/dev/null 2>&1

forge build 2>&1 | tee -a "$REPORT"
BUILD_RC=${PIPESTATUS[0]}

log "BUILD_RC=$BUILD_RC"

section "[09] TEST"

if find test -type f 2>/dev/null | grep -q .; then
    forge test -vvv 2>&1 | tee -a "$REPORT"
    TEST_RC=${PIPESTATUS[0]}
else
    log "NO_TEST_FILES_FOUND"
    TEST_RC=2
fi

log "TEST_RC=$TEST_RC"

section "[10] FLASHLOAN SECURITY PATTERN SCAN"

grep -RInE \
'executeOperation|flashLoan|flashLoanSimple|initiator|msg.sender|allowance|approve|transfer|transferFrom|reentr|slippage|deadline|profit|premium|require|onlyOwner' \
contracts flashloan_engine test script 2>/dev/null \
| head -500 \
| tee -a "$REPORT" || true

section "[11] SECRET PRESENCE — VALUES NEVER PRINTED"

for v in \
    FLASH_PRIVATE_KEY \
    SPONSOR_PRIVATE_KEY \
    PRIVATE_KEY
do
    if [ -n "${!v+x}" ]; then
        log "$v=SET_REDACTED"
    else
        log "$v=UNSET"
    fi
done

section "[12] CHAIN"

RPC="${FLASH_GNOSIS_RPC:-}"

if [ -n "$RPC" ]; then

    log "FLASH_GNOSIS_RPC=SET_REDACTED"

    CHAIN_ID="$(
        cast chain-id \
        --rpc-url "$RPC" \
        2>/dev/null
    )"

    BLOCK="$(
        cast block-number \
        --rpc-url "$RPC" \
        2>/dev/null
    )"

    log "CHAIN_ID=$CHAIN_ID"
    log "BLOCK_NUMBER=$BLOCK"

else
    log "FLASH_GNOSIS_RPC=UNSET"
    CHAIN_ID=""
fi

section "[13] AAVE"

PROVIDER="${AAVE_GNOSIS_PROVIDER:-}"

if [ -n "$RPC" ] && [ -n "$PROVIDER" ]; then

    POOL="$(
        cast call "$PROVIDER" \
        'getPool()(address)' \
        --rpc-url "$RPC" \
        2>/dev/null
    )"

    log "AAVE_PROVIDER=SET_REDACTED"
    log "AAVE_POOL=$POOL"

else

    POOL=""
    log "AAVE_PROVIDER_OR_RPC_MISSING"

fi

section "[14] RUNTIME CONFIG PRESENCE"

for v in \
    FLASH_ACTIVE_CHAIN \
    FLASH_GNOSIS_RPC \
    AAVE_GNOSIS_PROVIDER \
    FLASH_PRIVATE_KEY \
    REAL_TARGET \
    FLASH_ASSET \
    FLASH_AMOUNT \
    FLASH_TARGET \
    FLASH_CALLDATA \
    FLASH_SPONSOR \
    SPONSOR_PRIVATE_KEY
do

    if [ -n "${!v+x}" ]; then
        log "$v=SET"
    else
        log "$v=UNSET"
    fi

done

section "[15] DEPLOYMENT EVIDENCE"

grep -RInE \
'contractAddress|deployed|deployment|txHash|transactionHash|broadcast|CREATE|AaveFlashArbReceiver' \
broadcast deployments script 2>/dev/null \
| head -300 \
| tee -a "$REPORT" || true

section "[16] ARTIFACT"

ARTIFACT="out/AaveFlashArbReceiver.sol/AaveFlashArbReceiver.json"

if [ -f "$ARTIFACT" ] && command -v jq >/dev/null 2>&1; then

    jq -r '
    {
        contractName,
        abi_count: (.abi | length),
        bytecode_size: ((.bytecode.object // "") | length),
        deployedBytecode_size:
            ((.deployedBytecode.object // "") | length)
    }' "$ARTIFACT" \
    | tee -a "$REPORT"

else

    log "RECEIVER_ARTIFACT_OR_JQ_NOT_FOUND"

fi

section "[17] FINAL CLASSIFICATION"

if [ "$BUILD_RC" -eq 0 ]; then
    log "BUILD_STATUS=PASS"
else
    log "BUILD_STATUS=FAIL"
fi

if [ "$TEST_RC" -eq 0 ]; then
    log "TEST_STATUS=PASS"
else
    log "TEST_STATUS=FAIL_OR_MISSING"
fi

if [ -n "$POOL" ]; then
    log "AAVE_POOL_RESOLUTION=PASS"
else
    log "AAVE_POOL_RESOLUTION=FAIL"
fi

if [ "$CHAIN_ID" = "100" ]; then
    log "GNOSIS_CHAIN_ID_STATUS=PASS"
else
    log "GNOSIS_CHAIN_ID_STATUS=NOT_PROVEN"
fi

log "DEPLOYMENT_STATUS=NOT_PROVEN"
log "LIVE_EXECUTION_STATUS=NOT_PROVEN"
log "PRODUCTION_STATUS=NOT_PROVEN"
log "PROFITABILITY_STATUS=NOT_PROVEN"
log "SPONSORSHIP_STATUS=NOT_PROVEN"

section "[18] EVIDENCE PROTOCOL"

log "E1_SOURCE"
log "E2_BUILD"
log "E3_TEST"
log "E4_CHAIN_STATE"
log "E5_AAVE_STATE"
log "E6_DEPLOYMENT_EVIDENCE"
log "E7_RUNTIME_EVIDENCE"
log "E8_ECONOMIC_EVIDENCE"
log "E9_LIVE_EXECUTION_EVIDENCE"
log "E10_INDEPENDENT_CLASSIFICATION"

log ""
log "REPORT=$REPORT"

exit 0
