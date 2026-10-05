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

contract AaveFlashArbReceiver is IFlashLoanSimpleReceiver {
    struct RouteAction {
        address target;
        uint256 value;
        bytes data;
    }

    address public immutable owner;
    IPool public immutable pool;
    address public profitRecipient;
    mapping(address => bool) public approvedTargets;

    error Unauthorized();
    error WrongCaller();
    error RouteFailed();
    error TargetNotApproved();
    error InsufficientRepayment();
    error InsufficientProfit();
    error SponsorPaymentFailed();
    error ProfitPaymentFailed();

    constructor(address pool_, address profitRecipient_) {
        if (pool_ == address(0) || profitRecipient_ == address(0)) revert Unauthorized();
        owner = msg.sender;
        pool = IPool(pool_);
        profitRecipient = profitRecipient_;
    }

    function setTarget(address target, bool approved) external {
        if (msg.sender != owner) revert Unauthorized();
        approvedTargets[target] = approved;
    }

    function setProfitRecipient(address recipient) external {
        if (msg.sender != owner || recipient == address(0)) revert Unauthorized();
        profitRecipient = recipient;
    }

    function executeFlashLoan(address asset,uint256 amount,bytes calldata params) external {
        if (msg.sender != owner) revert Unauthorized();
        pool.flashLoanSimple(address(this),asset,amount,params,0);
    }

    // params = (RouteAction[] actions, address sponsor, uint256 sponsorFee,
    //           uint256 minimumProfit).
    // The receiver itself calls each approved target, so DEX routers see the
    // receiver as msg.sender and can use token approvals owned by the receiver.
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        if (msg.sender != address(pool) || initiator != address(this)) revert WrongCaller();

        (
            RouteAction[] memory actions,
            address sponsor,
            uint256 sponsorFee,
            uint256 minimumProfit
        ) = abi.decode(params, (RouteAction[], address, uint256, uint256));

        if (actions.length == 0 || actions.length > 8) revert RouteFailed();

        for (uint256 i = 0; i < actions.length; i++) {
            RouteAction memory action = actions[i];
            if (action.target == address(0) || !approvedTargets[action.target]) {
                revert TargetNotApproved();
            }
            (bool ok,) = action.target.call{value: action.value}(action.data);
            if (!ok) revert RouteFailed();
        }

        uint256 repayment = amount + premium;
        uint256 balance = IERC20(asset).balanceOf(address(this));
        uint256 required = repayment + sponsorFee + minimumProfit;
        if (balance < required) revert InsufficientProfit();

        if (sponsorFee > 0) {
            if (sponsor == address(0)) revert SponsorPaymentFailed();
            if (!IERC20(asset).transfer(sponsor, sponsorFee)) revert SponsorPaymentFailed();
        }

        uint256 profit = balance - repayment - sponsorFee;
        if (profit < minimumProfit) revert InsufficientProfit();
        if (!IERC20(asset).approve(address(pool), repayment)) revert InsufficientRepayment();

        if (profit > 0) {
            if (!IERC20(asset).transfer(profitRecipient, profit)) revert ProfitPaymentFailed();
        }

        return true;
    }

    receive() external payable {}
}
