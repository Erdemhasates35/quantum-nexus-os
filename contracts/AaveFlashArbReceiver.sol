// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
interface IERC20 { function balanceOf(address account) external view returns (uint256); function approve(address spender, uint256 amount) external returns (bool); }
interface IFlashLoanSimpleReceiver { function executeOperation(address asset,uint256 amount,uint256 premium,address initiator,bytes calldata params) external returns (bool); }
interface IPool { function flashLoanSimple(address receiverAddress,address asset,uint256 amount,bytes calldata params,uint16 referralCode) external; }
interface IRouteExecutor { function execute(bytes calldata data) external; }
contract AaveFlashArbReceiver is IFlashLoanSimpleReceiver {
    address public immutable owner; IPool public immutable pool;
    error Unauthorized(); error WrongCaller(); error RouteFailed(); error InsufficientRepayment();
    constructor(address pool_) { owner=msg.sender; pool=IPool(pool_); }
    function executeFlashLoan(address asset,uint256 amount,bytes calldata params) external { if(msg.sender!=owner) revert Unauthorized(); pool.flashLoanSimple(address(this),asset,amount,params,0); }
    function executeOperation(address asset,uint256 amount,uint256 premium,address initiator,bytes calldata params) external override returns(bool) {
        if(msg.sender!=address(pool)||initiator!=address(this)) revert WrongCaller();
        (address executor,bytes memory route)=abi.decode(params,(address,bytes)); if(executor==address(0)) revert RouteFailed();
        (bool ok,)=executor.call(abi.encodeCall(IRouteExecutor.execute,(route))); if(!ok) revert RouteFailed();
        uint256 repayment=amount+premium; if(IERC20(asset).balanceOf(address(this))<repayment) revert InsufficientRepayment();
        IERC20(asset).approve(address(pool),repayment); return true;
    }
}
