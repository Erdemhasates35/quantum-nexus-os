from __future__ import annotations
import os
from dataclasses import dataclass
from web3 import Web3
from eth_account import Account

RECEIVER_ABI = [
    {"inputs":[
        {"internalType":"address","name":"asset","type":"address"},
        {"internalType":"uint256","name":"amount","type":"uint256"},
        {"internalType":"bytes","name":"params","type":"bytes"}
    ],"name":"executeFlashLoan","outputs":[],"stateMutability":"nonpayable","type":"function"},
]


@dataclass(frozen=True)
class TxResult:
    tx_hash: str
    block_number: int
    gas_used: int


class LiveEvmExecutor:
    def __init__(self, rpc_url: str, private_key: str, receiver: str, chain_id: int):
        if not rpc_url or not private_key or not receiver:
            raise ValueError("RPC, private key and receiver are required")
        self.w3 = Web3(Web3.HTTPProvider(rpc_url, request_kwargs={"timeout": 8}))
        if not self.w3.is_connected():
            raise ConnectionError("RPC connection failed")
        self.account = Account.from_key(private_key)
        self.chain_id = chain_id
        self.receiver = Web3.to_checksum_address(receiver)

    def encode_sponsored_params(
        self,
        *,
        executor: str,
        route: bytes,
        sponsor: str,
        sponsor_fee: int,
        minimum_profit: int,
    ) -> bytes:
        return self.w3.codec.encode(
            ["address", "bytes", "address", "uint256", "uint256"],
            [
                Web3.to_checksum_address(executor),
                route,
                Web3.to_checksum_address(sponsor),
                sponsor_fee,
                minimum_profit,
            ],
        )

    def preflight(self, asset: str, amount: int, params: bytes) -> bool:
        contract = self.w3.eth.contract(address=self.receiver, abi=RECEIVER_ABI)
        contract.functions.executeFlashLoan(
            Web3.to_checksum_address(asset), amount, params
        ).call({"from": self.account.address})
        return True

    def execute(self, asset: str, amount: int, params: bytes) -> TxResult:
        if os.getenv("FLASHLOAN_LIVE_EXECUTION", "false").lower() != "true":
            raise RuntimeError("FLASHLOAN_LIVE_EXECUTION is not true")
        self.preflight(asset, amount, params)
        contract = self.w3.eth.contract(address=self.receiver, abi=RECEIVER_ABI)
        nonce = self.w3.eth.get_transaction_count(self.account.address, "pending")
        base = self.w3.eth.get_block("latest").get("baseFeePerGas")
        priority = int(os.getenv("FLASH_MAX_PRIORITY_FEE_WEI", "1000000000"))
        max_fee = int(os.getenv("FLASH_MAX_FEE_WEI", str((base or 0) * 2 + priority)))
        tx = contract.functions.executeFlashLoan(
            Web3.to_checksum_address(asset), amount, params
        ).build_transaction({
            "from": self.account.address,
            "chainId": self.chain_id,
            "nonce": nonce,
            "gas": 0,
            "maxPriorityFeePerGas": priority,
            "maxFeePerGas": max_fee,
        })
        tx["gas"] = int(self.w3.eth.estimate_gas(tx) * 115 // 100)
        signed = self.account.sign_transaction(tx)
        tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
        if receipt.status != 1:
            raise RuntimeError(f"flashloan transaction reverted: {tx_hash.hex()}")
        return TxResult(tx_hash.hex(), receipt.blockNumber, receipt.gasUsed)
