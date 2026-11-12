import unittest
from math import nan, inf
from portfolio_core import RiskLimits, TradeProposal, assess_trade, make_event, summarize_returns, validate_time_series

class MetricsTests(unittest.TestCase):
    def test_compounded_return_and_drawdown(self):
        result = summarize_returns([0.10, -0.10], periods_per_year=2)
        self.assertAlmostEqual(result.cumulative_return, -0.01)
        self.assertAlmostEqual(result.max_drawdown, 0.10)
        self.assertEqual(result.observations, 2)
    def test_invalid_return_rejected(self):
        with self.assertRaises(ValueError):
            summarize_returns([-1.0])
        with self.assertRaises(ValueError):
            summarize_returns([nan])

class RiskTests(unittest.TestCase):
    def setUp(self):
        self.limits = RiskLimits(10, 3, 15, 1.2)
    def test_approval(self):
        self.assertTrue(assess_trade(TradeProposal(2, .5, 4, 2), self.limits).approved)
    def test_position_limit(self):
        self.assertEqual(assess_trade(TradeProposal(11, .5, 4, 2), self.limits).reason, "POSITION_LIMIT")
    def test_liquidity_limit(self):
        self.assertEqual(assess_trade(TradeProposal(2, .5, 4, 1), self.limits).reason, "LIQUIDITY_COVERAGE")
    def test_non_finite_values_rejected(self):
        self.assertEqual(assess_trade(TradeProposal(inf, .5, 4, 2), self.limits).reason, "NON_FINITE_VALUE")

class DataQualityTests(unittest.TestCase):
    def test_duplicate_order_and_missing_detection(self):
        rows = [{"event_id":"a","timestamp":2,"price":10},
                {"event_id":"a","timestamp":1,"price":None}]
        report = validate_time_series(rows, ["event_id","timestamp","price"])
        self.assertEqual(report.duplicate_ids, 1)
        self.assertEqual(report.non_monotonic_timestamps, 1)
        self.assertEqual(report.missing_required_values, 1)
        self.assertFalse(report.passed)

class EventTests(unittest.TestCase):
    def test_versioned_envelope(self):
        event = make_event("market.quote", "unit-test", {"symbol":"BTC-USD"})
        self.assertEqual(event["schema_version"], 1)
        self.assertTrue(event["correlation_id"])
        self.assertEqual(event["payload"]["symbol"], "BTC-USD")

if __name__ == "__main__":
    unittest.main()
