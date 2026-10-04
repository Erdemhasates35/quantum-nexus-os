from __future__ import annotations

import sys
from web3 import Web3

RPC = "https://rpc.gnosischain.com"
EXPECTED_CHAIN_ID = 100


def main() -> int:
    w3 = Web3(Web3.HTTPProvider(RPC, request_kwargs={"timeout": 10}))
    if not w3.is_connected():
        print("GNOSIS_RPC=FAIL")
        return 1
    chain_id = w3.eth.chain_id
    block = w3.eth.block_number
    print(f"GNOSIS_RPC=OK")
    print(f"CHAIN_ID={chain_id}")
    print(f"BLOCK={block}")
    if chain_id != EXPECTED_CHAIN_ID:
        print("CHAIN_ID_CHECK=FAIL")
        return 2
    print("CHAIN_ID_CHECK=OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
