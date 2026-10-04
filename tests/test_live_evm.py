import pytest
from flashloan_engine.live_evm import LiveEvmExecutor


def test_live_executor_requires_runtime_configuration():
    with pytest.raises(ValueError):
        LiveEvmExecutor("", "", "", 1)
