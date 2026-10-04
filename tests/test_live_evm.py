import pytest
from web3 import Web3
from flashloan_engine.live_evm import LiveEvmExecutor


def test_live_executor_requires_runtime_configuration():
    with pytest.raises(ValueError):
        LiveEvmExecutor("", "", "", 1)


def test_sponsored_route_encoding_shape():
    w3 = Web3()
    encoded = w3.codec.encode(
        ["(address,uint256,bytes)[]", "address", "uint256", "uint256"],
        [
            [("0x0000000000000000000000000000000000000001", 0, b"\x12\x34")],
            "0x0000000000000000000000000000000000000002",
            7,
            11,
        ],
    )
    assert encoded.startswith(b"\x00")
    assert len(encoded) > 160
