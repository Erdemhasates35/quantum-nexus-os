from __future__ import annotations

from decimal import Decimal

from .audit import opportunity_record
from .config import Config
from .economics import build_opportunity
from .evm import NETWORKS
from .models import Chain, Opportunity
from .risk import gate


class FlashLoanOrchestrator:
    """Coordinates opportunity research and fail-closed economic validation."""
    def __init__(self, config: Config | None = None):
        self.config = config or Config()
        self.config.validate()

    def capabilities(self) -> dict:
        return {
            "ethereum": NETWORKS["ethereum"].flash_loan_provider,
            "polygon": NETWORKS["polygon"].flash_loan_provider,
            "gnosis": NETWORKS["gnosis"].flash_loan_provider,
            "solana": "Jupiter quote adapter; flash-loan execution not implemented",
            "binance": "market-data/account observer; not a flash-loan lender",
            "live_execution": self.config.live_execution,
        }

    def evaluate(self, *, chain: Chain, asset: str, borrow_amount: str,
                 gross_spread_bps: str, loan_fee_bps: str, swap_fee_bps: str,
                 gas_cost_usd: str, slippage_bps: str, priority_cost_usd: str) -> Opportunity:
        opportunity = build_opportunity(
            chain=chain, asset=asset, borrow_amount=borrow_amount,
            gross_spread=gross_spread_bps, loan_fee_bps=loan_fee_bps,
            swap_fee_bps=swap_fee_bps, gas_cost=gas_cost_usd,
            slippage_bps=slippage_bps, priority_cost=priority_cost_usd,
            min_profit=self.config.min_profit_usd,
        )
        decision = gate(
            net_profit=opportunity.net_profit,
            min_profit=Decimal(self.config.min_profit_usd),
            slippage_bps=Decimal(slippage_bps),
            max_slippage_bps=Decimal(self.config.max_slippage_bps),
            gas_cost=Decimal(gas_cost_usd),
            max_gas_cost=Decimal(self.config.max_gas_cost_usd),
        )
        if not decision.approved:
            return Opportunity(
                opportunity.chain, opportunity.asset, opportunity.borrow_amount,
                opportunity.gross_spread, opportunity.loan_fee, opportunity.swap_fees,
                opportunity.gas_cost, opportunity.slippage_cost, opportunity.priority_cost,
                opportunity.net_profit, opportunity.roi_on_borrowed, False, decision.reason
            )
        return opportunity

    @staticmethod
    def audit(opportunity: Opportunity) -> dict:
        return opportunity_record(opportunity)
