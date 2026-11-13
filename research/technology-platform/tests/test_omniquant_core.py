import unittest
from datetime import datetime, timezone, timedelta
from omniquant_core import RiskEngine, RiskPolicy, RiskSnapshot, TradeIntent, MarketObservation

class RiskGateTests(unittest.TestCase):
    def setUp(self):
        self.engine=RiskEngine(RiskPolicy("v1",1000,5000,100,2,10,1.5,5))
        self.intent=TradeIntent("i-1","BTC-USD","buy",100,50000,4,2,"strategy-a","obs-1")
        self.now=datetime(2026,11,13,9,0,tzinfo=timezone.utc)
        self.snapshot=RiskSnapshot(10000,1000,10,1,1,False)
    def test_approved_within_limits(self):
        self.assertTrue(self.engine.evaluate(self.intent,self.snapshot,self.now).approved)
    def test_kill_switch_fails_closed(self):
        v=self.engine.evaluate(self.intent,RiskSnapshot(10000,1000,10,1,1,True),self.now)
        self.assertEqual(v.reason_code,"KILL_SWITCH_ACTIVE")
    def test_stale_data_fails_closed(self):
        v=self.engine.evaluate(self.intent,RiskSnapshot(10000,1000,10,1,6),self.now)
        self.assertEqual(v.reason_code,"STALE_MARKET_DATA")
    def test_non_finite_account_state_fails_closed(self):
        v=self.engine.evaluate(self.intent,RiskSnapshot(float("nan"),1000,10,1,1),self.now)
        self.assertEqual(v.reason_code,"NON_FINITE_ACCOUNT_STATE")
    def test_daily_loss_boundary_denied(self):
        v=self.engine.evaluate(self.intent,RiskSnapshot(10000,1000,100,1,1),self.now)
        self.assertEqual(v.reason_code,"DAILY_LOSS_LIMIT")
    def test_order_limit_denied(self):
        too_large=TradeIntent("i-2","BTC-USD","buy",1001,50000,4,2,"strategy-a","obs-1")
        self.assertEqual(self.engine.evaluate(too_large,self.snapshot,self.now).reason_code,"ORDER_NOTIONAL_LIMIT")
    def test_naive_timestamp_rejected(self):
        with self.assertRaises(ValueError):
            MarketObservation("feed-a","BTC-USD",datetime(2026,1,1),self.now,50000,"1")

if __name__=="__main__": unittest.main()
