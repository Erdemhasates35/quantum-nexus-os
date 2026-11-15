"""
Quantum Nexus OS — Swarm + Pythia SAE Production Contract

Defines the real interfaces for sparse autoencoder feature extraction
and hierarchical Swarm agents. No mock activations or synthetic features.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Protocol

import torch
from torch import Tensor


@dataclass(frozen=True)
class SAEFeature:
    feature_id: int
    activation: float
    layer: str
    explanation: Optional[str] = None  # only if human-labeled or auto-interpreted offline


class ActivationSource(Protocol):
    def residual_stream(self, layer: str, tokens: Tensor) -> Tensor: ...


class SparseAutoencoder(Protocol):
    def encode(self, residual: Tensor) -> Tensor: ...
    def decode(self, features: Tensor) -> Tensor: ...
    def topk(self, residual: Tensor, k: int) -> List[SAEFeature]: ...


@dataclass
class SwarmAgentSpec:
    role: str  # Scout | Cartographer | Judge | Guard | Executor
    model_id: str
    max_tokens: int = 512
    temperature: float = 0.1
    requires_sae: bool = False


class ProductionSwarmCoordinator:
    """
    Hierarchical agent coordinator.
    Agents only receive real SAE features or real market state.
    No internal random feature generation.
    """

    def __init__(self, agents: List[SwarmAgentSpec], sae: Optional[SparseAutoencoder] = None) -> None:
        self.agents = {a.role: a for a in agents}
        self.sae = sae

    def extract_features(self, residual: Tensor, k: int = 32) -> List[SAEFeature]:
        if self.sae is None:
            raise RuntimeError("No SAE attached — production mode forbids synthetic features")
        return self.sae.topk(residual, k=k)

    def route(self, role: str, context: Dict[str, Any]) -> Dict[str, Any]:
        if role not in self.agents:
            raise KeyError(f"Unknown role: {role}")
        # Actual model call is left to the operator's inference backend.
        # This class only enforces structure and SAE purity.
        return {"role": role, "context": context, "status": "routed"}


def create_default_swarm() -> ProductionSwarmCoordinator:
    specs = [
        SwarmAgentSpec(role="Scout", model_id="pythia-160m", requires_sae=True),
        SwarmAgentSpec(role="Cartographer", model_id="pythia-410m", requires_sae=True),
        SwarmAgentSpec(role="Judge", model_id="pythia-1b", requires_sae=False),
        SwarmAgentSpec(role="Guard", model_id="guard-policy", requires_sae=False),
        SwarmAgentSpec(role="Executor", model_id="execution-core", requires_sae=False),
    ]
    return ProductionSwarmCoordinator(specs)
