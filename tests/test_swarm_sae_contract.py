import unittest

from src.contracts.swarm_sae_contract import (
    SAEFeature,
    SwarmAgentSpec,
    ProductionSwarmCoordinator,
    create_default_swarm,
)


class FakeSAE:
    def topk(self, residual, k):
        return [SAEFeature(feature_id=7, activation=0.9, layer="layer-1")][:k]


class FakeExecutor:
    def execute(self, spec, context, features):
        return {"role": spec.role, "context": context, "features": features}


class SwarmSAEContractTests(unittest.TestCase):
    def test_default_swarm_is_disabled(self):
        self.assertFalse(create_default_swarm().production_ready)

    def test_route_fails_closed_without_executor(self):
        with self.assertRaisesRegex(RuntimeError, "No inference executor"):
            create_default_swarm().route("Judge", {"input": "real context"})

    def test_sae_required_role_fails_without_trained_sae(self):
        swarm = ProductionSwarmCoordinator(
            [SwarmAgentSpec(role="Scout", model_id="pythia-160m", requires_sae=True)],
            executor=FakeExecutor(),
        )
        with self.assertRaisesRegex(RuntimeError, "requires a trained SAE"):
            swarm.route("Scout", {"input": "real context"}, residual=object())

    def test_sae_feature_extraction_requires_real_sae(self):
        with self.assertRaisesRegex(RuntimeError, "No trained SAE"):
            create_default_swarm().extract_features(object())

    def test_route_uses_injected_executor_and_validated_sae_features(self):
        swarm = ProductionSwarmCoordinator(
            [SwarmAgentSpec(role="Scout", model_id="pythia-160m", requires_sae=True)],
            sae=FakeSAE(),
            executor=FakeExecutor(),
        )
        self.assertTrue(swarm.production_ready)
        result = swarm.route("Scout", {"correlation_id": "test-1"}, residual=object())
        self.assertEqual(result["role"], "Scout")
        self.assertEqual(result["features"][0].feature_id, 7)

    def test_unknown_role_and_duplicate_roles_are_rejected(self):
        swarm = create_default_swarm()
        with self.assertRaises(KeyError):
            swarm.route("Unknown", {})
        with self.assertRaises(ValueError):
            ProductionSwarmCoordinator([
                SwarmAgentSpec(role="Judge", model_id="judge-a"),
                SwarmAgentSpec(role="Judge", model_id="judge-b"),
            ])

    def test_invalid_feature_values_are_rejected(self):
        with self.assertRaises(ValueError):
            SAEFeature(feature_id=-1, activation=0.2, layer="layer-1")
        with self.assertRaises(ValueError):
            SAEFeature(feature_id=1, activation=float("nan"), layer="layer-1")


if __name__ == "__main__":
    unittest.main()
