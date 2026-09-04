// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

interface IWinkLinkToken {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function transferAndCall(address recipient, uint256 amount, bytes calldata data) external returns (bool);
}

interface IWinkLinkVRFV2Wrapper {
    function calculateRequestPrice(uint32 callbackGasLimit) external view returns (uint256);
    function lastRequestId() external view returns (uint256);
}

interface ILottoChainRandomnessReceiver {
    function fulfillRandomness(bytes32 requestId, uint256 drawId, uint256 randomWord) external;
}

/// @title WinkLinkVRFAdapter
/// @notice Direct-funding WINkLink VRF v2 wrapper adapter for LottoChain.
/// @dev Fund this contract with enough WIN before a draw is closed. Deployment addresses must be
///      verified against WINkLink's official network configuration before production use.
contract WinkLinkVRFAdapter {
    IWinkLinkToken public immutable winkToken;
    IWinkLinkVRFV2Wrapper public immutable wrapper;
    ILottoChainRandomnessReceiver public immutable lottery;
    address public immutable administrator;
    uint32 public immutable callbackGasLimit;
    uint16 public immutable requestConfirmations;

    mapping(uint256 requestId => uint256 drawId) public drawByRequest;
    mapping(uint256 requestId => bool pending) public requestPending;

    error Unauthorized();
    error InvalidConfiguration();
    error InsufficientWinkBalance();
    error FeeTransferFailed();
    error InvalidRequest();
    error TokenTransferFailed();

    event RandomnessRequested(uint256 indexed drawId, uint256 indexed requestId, uint256 fee);
    event RandomnessFulfilled(uint256 indexed drawId, uint256 indexed requestId, uint256 randomWord);
    event WinkRecovered(address indexed recipient, uint256 amount);

    constructor(
        address winkToken_,
        address wrapper_,
        address lottery_,
        address administrator_,
        uint32 callbackGasLimit_,
        uint16 requestConfirmations_
    ) {
        if (
            winkToken_ == address(0) || wrapper_ == address(0) || lottery_ == address(0)
                || administrator_ == address(0) || callbackGasLimit_ == 0 || requestConfirmations_ == 0
        ) revert InvalidConfiguration();
        winkToken = IWinkLinkToken(winkToken_);
        wrapper = IWinkLinkVRFV2Wrapper(wrapper_);
        lottery = ILottoChainRandomnessReceiver(lottery_);
        administrator = administrator_;
        callbackGasLimit = callbackGasLimit_;
        requestConfirmations = requestConfirmations_;
    }

    function requestRandomness(uint256 drawId) external returns (bytes32 requestIdBytes) {
        if (msg.sender != address(lottery)) revert Unauthorized();

        uint256 fee = wrapper.calculateRequestPrice(callbackGasLimit);
        if (winkToken.balanceOf(address(this)) < fee) revert InsufficientWinkBalance();

        bool paid = winkToken.transferAndCall(
            address(wrapper), fee, abi.encode(callbackGasLimit, requestConfirmations, uint32(1))
        );
        if (!paid) revert FeeTransferFailed();

        uint256 requestId = wrapper.lastRequestId();
        if (requestId == 0 || requestPending[requestId]) revert InvalidRequest();
        requestPending[requestId] = true;
        drawByRequest[requestId] = drawId;
        emit RandomnessRequested(drawId, requestId, fee);
        return bytes32(requestId);
    }

    /// @notice WINkLink wrapper callback. Any caller other than the configured wrapper is rejected.
    function rawFulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) external {
        if (msg.sender != address(wrapper)) revert Unauthorized();
        if (!requestPending[requestId] || randomWords.length != 1) revert InvalidRequest();

        uint256 drawId = drawByRequest[requestId];
        requestPending[requestId] = false;
        delete drawByRequest[requestId];
        lottery.fulfillRandomness(bytes32(requestId), drawId, randomWords[0]);
        emit RandomnessFulfilled(drawId, requestId, randomWords[0]);
    }

    /// @notice Recover unused WIN to a controlled address. Administrator should be a multisig.
    function recoverWink(address recipient, uint256 amount) external {
        if (msg.sender != administrator) revert Unauthorized();
        if (recipient == address(0)) revert InvalidConfiguration();
        bool success = winkToken.transfer(recipient, amount);
        if (!success) revert TokenTransferFailed();
        emit WinkRecovered(recipient, amount);
    }
}
