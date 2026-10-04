from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from enum import Enum


class SponsorMode(str, Enum):
    SELF_FUNDED = "self_funded"
    RELAYER_REIMBURSED = "relayer_reimbursed"
    PAYMASTER = "paymaster"
    BUILDER_BUNDLE = "builder_bundle"


@dataclass(frozen=True)
class GasQuote:
    native_cost: Decimal
    sponsor_fee: Decimal = Decimal("0")
    max_gas_cost: Decimal | None = None

    @property
    def total_execution_cost(self) -> Decimal:
        return self.native_cost + self.sponsor_fee


@dataclass(frozen=True)
class SponsorshipDecision:
    mode: SponsorMode
    approved: bool
    required_fronted_value: Decimal
    reimbursed_value: Decimal
    net_profit_after_gas: Decimal
    reason: str


def evaluate_sponsorship(
    *,
    gross_profit: Decimal,
    non_gas_costs: Decimal,
    gas_quote: GasQuote,
    minimum_profit: Decimal,
    mode: SponsorMode,
    sponsor_fee: Decimal = Decimal("0"),
) -> SponsorshipDecision:
    if gross_profit < 0 or non_gas_costs < 0 or gas_quote.native_cost < 0:
        return SponsorshipDecision(mode, False, Decimal("0"), Decimal("0"), Decimal("0"), "invalid_economics")
    if gas_quote.max_gas_cost is not None and gas_quote.native_cost > gas_quote.max_gas_cost:
        return SponsorshipDecision(mode, False, gas_quote.native_cost, Decimal("0"), Decimal("0"), "gas_quote_limit")
    total_cost = non_gas_costs + gas_quote.native_cost + sponsor_fee
    net = gross_profit - total_cost
    if net < minimum_profit:
        return SponsorshipDecision(mode, False, gas_quote.native_cost, Decimal("0"), net, "insufficient_net_profit")

    if mode is SponsorMode.SELF_FUNDED:
        return SponsorshipDecision(mode, True, gas_quote.native_cost, Decimal("0"), net, "self_funded")
    if mode is SponsorMode.RELAYER_REIMBURSED:
        return SponsorshipDecision(mode, True, gas_quote.native_cost, gas_quote.native_cost + sponsor_fee, net, "relayer_can_be_reimbursed_from_trade_proceeds")
    if mode is SponsorMode.PAYMASTER:
        return SponsorshipDecision(mode, True, gas_quote.native_cost, gas_quote.native_cost + sponsor_fee, net, "paymaster_can_sponsor_user_operation")
    if mode is SponsorMode.BUILDER_BUNDLE:
        return SponsorshipDecision(mode, True, gas_quote.native_cost, gas_quote.native_cost + sponsor_fee, net, "bundle_requires_external_inclusion_economics")
    raise ValueError("unsupported_sponsor_mode")


def choose_mode(
    *,
    gross_profit: Decimal,
    non_gas_costs: Decimal,
    gas_quote: GasQuote,
    minimum_profit: Decimal,
    sponsor_fee: Decimal = Decimal("0"),
    paymaster_available: bool = False,
    relayer_available: bool = False,
    builder_available: bool = False,
) -> SponsorshipDecision:
    modes = []
    if paymaster_available:
        modes.append(SponsorMode.PAYMASTER)
    if relayer_available:
        modes.append(SponsorMode.RELAYER_REIMBURSED)
    if builder_available:
        modes.append(SponsorMode.BUILDER_BUNDLE)
    modes.append(SponsorMode.SELF_FUNDED)

    for mode in modes:
        decision = evaluate_sponsorship(
            gross_profit=gross_profit,
            non_gas_costs=non_gas_costs,
            gas_quote=gas_quote,
            minimum_profit=minimum_profit,
            mode=mode,
            sponsor_fee=sponsor_fee,
        )
        if decision.approved:
            return decision
    return evaluate_sponsorship(
        gross_profit=gross_profit,
        non_gas_costs=non_gas_costs,
        gas_quote=gas_quote,
        minimum_profit=minimum_profit,
        mode=SponsorMode.SELF_FUNDED,
        sponsor_fee=sponsor_fee,
    )
