from __future__ import annotations
from dataclasses import dataclass
@dataclass(frozen=True)
class EvmNetwork:
    name: str
    rpc_env: str
    flash_loan_provider: str
NETWORKS = {"ethereum": EvmNetwork("ethereum", "FLASH_ETHEREUM_RPC", "Aave V3"), "polygon": EvmNetwork("polygon", "FLASH_POLYGON_RPC", "Aave V3"), "gnosis": EvmNetwork("gnosis", "FLASH_GNOSIS_RPC", "Aave V3")}
def transaction_plan(network: str, receiver: str, asset: str, amount: str, route_calldata: str) -> dict:
    if network not in NETWORKS: raise ValueError(f"unsupported EVM network: {network}")
    if not receiver or not asset or not amount or not route_calldata: raise ValueError("receiver, asset, amount and route calldata are required")
    return {"network": network, "provider": NETWORKS[network].flash_loan_provider, "receiver": receiver, "asset": asset, "amount": amount, "route_calldata": route_calldata, "atomic": True}
