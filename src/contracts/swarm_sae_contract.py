"""
Quantum Nexus OS — deferred Swarm / Pythia SAE integration contract.

This module is intentionally outside the deployed Next.js runtime. It defines
interfaces only; it does not load a model, produce activations, execute agents,
or authorize trades. Runtime use fails closed until an executor and (for
SAE-dependent roles) a real trained SAE are injected.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Protocol


@dataclass(frozen=True)
class SAEFeature:
    feature_id: int
    activation: float
    layer: str
    explanation: Optional[str] = None

    def __post_init__(self) -> None:
        if self.feature_id < 0:
            raise ValueError("feature_id must be non-negative")
        if not math.isfinite(self.activation):
            raise ValueError("activation must be finite")
        if not self.layer.strip():
            raise ValueError("layer must be non-empty")


class ActivationSource(Protocol):
    def residual_stream(self, layer: str, tokens: Any) -> Any: ...


class SparseAutoencoder(Protocol):
    def encode(self, residual: Any) -> Any: ...
    def decode(self, features: Any) -> Any: ...
    def topk(self, residual: Any, k: int) -> List[SAEFeature]: ...


@dataclass(frozen=True)
class SwarmAgentSpec:
    role: str
    model_id: str
    max_tokens: int = 512
    temperature: float = 0.1
    requires_sae: bool = False

    def __post_init__(self) -> None:
        if not self.role.strip():
            raise ValueError("role must be non-empty")
        if not self.model_id.strip():
            raise ValueError("model_id must be non-empty")
        if self.max_tokens < 1:
            raise ValueError("max_tokens must be positive")
        if not 0.0 <= self.temperature <= 2.0:
            raise ValueError("temperature must be between 0 and 2")


class AgentExecutor(Protocol):
    def execute(
        self,
        spec: SwarmAgentSpec,
        context: Dict[str, Any],
        features: Optional[List[SAEFeature]],
    ) -> Dict[str, Any]: ...


class ProductionSwarmCoordinator:
    """Contract-only coordinator. It is not production-ready without a real executor."""

    def __init__(
        self,
        agents: List[SwarmAgentSpec],
        sae: Optional[SparseAutoencoder] = None,
        executor: Optional[AgentExecutor] = None,
    ) -> None:
        roles = [agent.role for agent in agents]
        if len(roles) != len(set(roles)):
            raise ValueError("agent roles must be unique")
        self.agents = {agent.role: agent for agent in agents}
        self.sae = sae
        self.executor = executor

    @property
    def production_ready(self) -> bool:
        return self.executor is not None and all(
            not agent.requires_sae or self.sae is not None
            for agent in self.agents.values()
        )

    def extract_features(self, residual: Any, k: int = 32) -> List[SAEFeature]:
        if k < 1:
            raise ValueError("k must be positive")
        if self.sae is None:
            raise RuntimeError("No trained SAE attached; synthetic features are forbidden")
        features = self.sae.topk(residual, k=k)
        if len(features) > k:
            raise ValueError("SAE returned more than k features")
        if not all(isinstance(feature, SAEFeature) for feature in features):
            raise TypeError("SAE must return validated SAEFeature values")
        return features

    def route(
        self,
        role: str,
        context: Dict[str, Any],
        residual: Any = None,
    ) -> Dict[str, Any]:
        if role not in self.agents:
            raise KeyError(f"Unknown role: {role}")
        if self.executor is None:
            raise RuntimeError("No inference executor attached; Swarm routing is disabled")
        spec = self.agents[role]
        features: Optional[List[SAEFeature]] = None
        if spec.requires_sae:
            if self.sae is None:
                raise RuntimeError(f"{role} requires a trained SAE; routing is disabled")
            if residual is None:
                raise ValueError(f"{role} requires a real residual stream")
            features = self.extract_features(residual)
        return self.executor.execute(spec, context, features)


def create_default_swarm(
    sae: Optional[SparseAutoencoder] = None,
    executor: Optional[AgentExecutor] = None,
) -> ProductionSwarmCoordinator:
    """Create a disabled-by-default contract; no model or checkpoint is loaded."""
    specs = [
        SwarmAgentSpec(role="Scout", model_id="pythia-160m", requires_sae=True),
        SwarmAgentSpec(role="Cartographer", model_id="pythia-410m", requires_sae=True),
        SwarmAgentSpec(role="Judge", model_id="pythia-1b"),
        SwarmAgentSpec(role="Guard", model_id="guard-policy"),
        SwarmAgentSpec(role="Executor", model_id="execution-core"),
    ]
    return ProductionSwarmCoordinator(specs, sae=sae, executor=executor)
