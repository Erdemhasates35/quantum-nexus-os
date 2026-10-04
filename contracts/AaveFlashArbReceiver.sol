// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}
interface IFlashLoanSimpleReceiver {
    function executeOperation(address asset,uint256 amount,uint256 premium,address initiator,bytes calldata params) external returns (bool);
}
interface IPool {
    function flashLoanSimple(address receiverAddress,address asset,uint256 amount,bytes calldata params,uint16 referralCode) external;
}
interface IRouteExecutor { function execute(bytes calldata data) external; }

contract AaveFlashArbReceiver is IFlashLoanSimpleReceiver {
    address public immutable owner;
    IPool public immutable pool;
    mapping(address => bool) public approvedExecutors;

    error Unauthorized();
    error WrongCaller();
    error RouteFailed();
    error InsufficientRepayment();
    error InsufficientProfit();
    error SponsorPaymentFailed();

    constructor(address pool_) {
        owner = msg.sender;
        pool = IPool(pool_);
    }

    function setExecutor(address executor, bool approved) external {
        if (msg.sender != owner) revert Unauthorized();
        approvedExecutors[executor] = approved;
    }

    function executeFlashLoan(address asset,uint256 amount,bytes calldata params) external {
        if (msg.sender != owner) revert Unauthorized();
        pool.flashLoanSimple(address(this),asset,amount,params,0);
    }

    // params = (executor, route, sponsor, sponsorFee, minimumProfit).
    // The relayer/sponsor fronts native gas. If and only if the atomic trade
    // finishes with repayment + sponsorFee + minimumProfit, the receiver
    // reimburses the sponsor from the same asset in the same transaction.
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        if (msg.sender != address(pool) || initiator != address(this)) revert WrongCaller();

        (
            address executor,
            bytes memory route,
            address sponsor,
            uint256 sponsorFee,
            uint256 minimumProfit
        ) = abi.decode(params, (address, bytes, address, uint256, uint256));

        if (executor == address(0) || !approvedExecutors[executor]) revert RouteFailed();

        (bool ok,) = executor.call(abi.encodeCall(IRouteExecutor.execute, (route)));
        if (!ok) revert RouteFailed();

        uint256 repayment = amount + premium;
        uint256 required = repayment + sponsorFee + minimumProfit;
        if (IERC20(asset).balanceOf(address(this)) < required) revert InsufficientProfit();

        if (sponsorFee > 0) {
            if (sponsor == address(0)) revert SponsorPaymentFailed();
            if (!IERC20(asset).transfer(sponsor, sponsorFee)) revert SponsorPaymentFailed();
        }

        if (IERC20(asset).balanceOf(address(this)) < repayment) revert InsufficientRepayment();
        IERC20(asset).approve(address(pool), repayment);
        return true;
    }
}
