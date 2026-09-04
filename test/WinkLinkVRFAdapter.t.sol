// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import { WinkLinkVRFAdapter, IWinkLinkToken } from "../contracts/WinkLinkVRFAdapter.sol";

contract MockWinkToken is IWinkLinkToken {
    mapping(address => uint256) public override balanceOf;
    bool public failTransferAndCall;
    address public lastRecipient;
    bytes public lastData;
    uint256 public lastAmount;

    function mint(address recipient, uint256 amount) external { balanceOf[recipient] += amount; }
    function setFailTransferAndCall(bool value) external { failTransferAndCall = value; }

    function transfer(address recipient, uint256 amount) external returns (bool) {
        if (balanceOf[msg.sender] < amount) return false;
        balanceOf[msg.sender] -= amount;
        balanceOf[recipient] += amount;
        return true;
    }

    function transferAndCall(address recipient, uint256 amount, bytes calldata data) external returns (bool) {
        if (failTransferAndCall || balanceOf[msg.sender] < amount) return false;
        balanceOf[msg.sender] -= amount;
        balanceOf[recipient] += amount;
        lastRecipient = recipient;
        lastAmount = amount;
        lastData = data;
        return true;
    }
}

contract MockWrapper {
    uint256 public price = 7;
    uint256 public lastRequestId;

    function calculateRequestPrice(uint32) external view returns (uint256) { return price; }
    function setRequestId(uint256 requestId) external { lastRequestId = requestId; }

    function fulfill(WinkLinkVRFAdapter adapter, uint256 requestId, uint256 randomWord) external {
        uint256[] memory words = new uint256[](1);
        words[0] = randomWord;
        adapter.rawFulfillRandomWords(requestId, words);
    }
}

contract MockLotteryReceiver {
    bytes32 public receivedRequestId;
    uint256 public receivedDrawId;
    uint256 public receivedRandomWord;

    function request(WinkLinkVRFAdapter adapter, uint256 drawId) external returns (bytes32) {
        return adapter.requestRandomness(drawId);
    }

    function fulfillRandomness(bytes32 requestId, uint256 drawId, uint256 randomWord) external {
        receivedRequestId = requestId;
        receivedDrawId = drawId;
        receivedRandomWord = randomWord;
    }
}

contract WinkLinkVRFAdapterTest {
    MockWinkToken private token;
    MockWrapper private wrapper;
    MockLotteryReceiver private lottery;
    WinkLinkVRFAdapter private adapter;

    function setUp() public {
        token = new MockWinkToken();
        wrapper = new MockWrapper();
        lottery = new MockLotteryReceiver();
        adapter = new WinkLinkVRFAdapter(address(token), address(wrapper), address(lottery), address(this), 500_000, 3);
        token.mint(address(adapter), 100);
    }

    function testRequestsAndForwardsVerifiedRandomness() public {
        wrapper.setRequestId(41);
        bytes32 requestId = lottery.request(adapter, 9);
        require(requestId == bytes32(uint256(41)), "request id");
        require(adapter.requestPending(41), "not pending");
        require(adapter.drawByRequest(41) == 9, "draw mapping");
        require(token.lastRecipient() == address(wrapper), "fee recipient");
        require(token.lastAmount() == 7, "fee amount");

        wrapper.fulfill(adapter, 41, 1234);
        require(lottery.receivedRequestId() == requestId, "callback request");
        require(lottery.receivedDrawId() == 9, "callback draw");
        require(lottery.receivedRandomWord() == 1234, "callback word");
        require(!adapter.requestPending(41), "still pending");
    }

    function testRejectsUnauthorizedRequestAndCallback() public {
        (bool requested,) = address(adapter).call(abi.encodeCall(WinkLinkVRFAdapter.requestRandomness, (1)));
        require(!requested, "unauthorized request accepted");
        uint256[] memory words = new uint256[](1);
        words[0] = 1;
        (bool fulfilled,) = address(adapter).call(
            abi.encodeCall(WinkLinkVRFAdapter.rawFulfillRandomWords, (1, words))
        );
        require(!fulfilled, "unauthorized callback accepted");
    }

    function testRejectsDuplicateCallback() public {
        wrapper.setRequestId(42);
        lottery.request(adapter, 10);
        wrapper.fulfill(adapter, 42, 1);
        (bool duplicate,) = address(wrapper).call(
            abi.encodeCall(MockWrapper.fulfill, (adapter, 42, 2))
        );
        require(!duplicate, "duplicate callback accepted");
    }

    function testRejectsInsufficientFeeBalance() public {
        WinkLinkVRFAdapter empty = new WinkLinkVRFAdapter(
            address(token), address(wrapper), address(lottery), address(this), 500_000, 3
        );
        (bool success,) = address(lottery).call(
            abi.encodeCall(MockLotteryReceiver.request, (empty, 1))
        );
        require(!success, "unfunded request accepted");
    }

    function testAdministratorCanRecoverWink() public {
        adapter.recoverWink(address(0xBEEF), 10);
        require(token.balanceOf(address(0xBEEF)) == 10, "recovery failed");
    }
}
