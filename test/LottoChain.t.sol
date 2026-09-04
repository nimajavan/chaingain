// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import { LottoChain, ITRC20, ILottoRandomnessOracle } from "../contracts/LottoChain.sol";

interface Vm {
    function warp(uint256 timestamp) external;
}

interface ILottoRandomnessReceiver {
    function fulfillRandomness(bytes32 requestId, uint256 drawId, uint256 randomWord) external;
}

contract MockUSDT is ITRC20 {
    string public constant name = "Mock USDT";
    string public constant symbol = "USDT";
    uint8 public constant decimals = 6;

    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address recipient, uint256 amount) external {
        balanceOf[recipient] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address recipient, uint256 amount) external override returns (bool) {
        _transfer(msg.sender, recipient, amount);
        return true;
    }

    function transferFrom(address sender, address recipient, uint256 amount) external override returns (bool) {
        uint256 permitted = allowance[sender][msg.sender];
        require(permitted >= amount, "allowance");
        allowance[sender][msg.sender] = permitted - amount;
        _transfer(sender, recipient, amount);
        return true;
    }

    function _transfer(address sender, address recipient, uint256 amount) private {
        require(balanceOf[sender] >= amount, "balance");
        balanceOf[sender] -= amount;
        balanceOf[recipient] += amount;
    }
}

contract MockOracle is ILottoRandomnessOracle {
    address public consumer;
    uint256 public nonce;

    function setConsumer(address consumer_) external {
        require(consumer == address(0), "consumer already set");
        consumer = consumer_;
    }

    function requestRandomness(uint256 drawId) external returns (bytes32 requestId) {
        require(msg.sender == consumer, "only consumer");
        requestId = keccak256(abi.encode(++nonce, drawId, consumer));
    }

    function fulfill(bytes32 requestId, uint256 drawId, uint256 randomWord) external {
        ILottoRandomnessReceiver(consumer).fulfillRandomness(requestId, drawId, randomWord);
    }
}

contract Player {
    function approve(MockUSDT token, LottoChain lottery, uint256 amount) external {
        token.approve(address(lottery), amount);
    }

    function buy(LottoChain lottery, uint32 quantity) external {
        lottery.buyTicket(quantity);
    }

    function refund(LottoChain lottery, uint256 drawId) external {
        lottery.claimRefund(drawId);
    }

    function start(LottoChain lottery, uint64 closesAt) external {
        lottery.startDraw(closesAt);
    }

    function acceptAdmin(LottoChain lottery) external {
        lottery.acceptAdmin();
    }
}

contract LottoChainTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    uint256 private constant USDT = 1_000_000;
    uint256 private constant TICKET_PRICE = 10 * USDT;
    uint256 private constant STARTING_BALANCE = 1_000 * USDT;

    MockUSDT private token;
    MockOracle private oracle;
    LottoChain private lottery;
    Player private alice;
    Player private bob;
    address private constant TREASURY = address(0xBEEF);

    function setUp() public {
        token = new MockUSDT();
        oracle = new MockOracle();
        lottery = new LottoChain(
            address(token), TREASURY, address(this), address(oracle), TICKET_PRICE, 2, 100, 1 days
        );
        oracle.setConsumer(address(lottery));

        alice = new Player();
        bob = new Player();
        token.mint(address(alice), STARTING_BALANCE);
        token.mint(address(bob), STARTING_BALANCE);
        alice.approve(token, lottery, type(uint256).max);
        bob.approve(token, lottery, type(uint256).max);
    }

    function testPurchaseRecordsExactPoolAndUniquePlayers() public {
        _openDraw();
        alice.buy(lottery, 3);
        bob.buy(lottery, 2);

        LottoChain.Draw memory draw = lottery.getDraw(1);
        require(draw.totalTickets == 5, "ticket total");
        require(draw.uniquePlayers == 2, "unique players");
        require(draw.pool == 5 * TICKET_PRICE, "pool");
        require(lottery.ticketsByWallet(1, address(alice)) == 3, "alice tickets");
        require(lottery.ticketRangeCount(1) == 2, "purchase ranges");
    }

    function testTicketOwnershipUsesPurchaseRanges() public {
        _openDraw();
        alice.buy(lottery, 3);
        bob.buy(lottery, 2);

        require(lottery.ticketOwner(1, 0) == address(alice), "ticket zero");
        require(lottery.ticketOwner(1, 2) == address(alice), "last alice ticket");
        require(lottery.ticketOwner(1, 3) == address(bob), "first bob ticket");
        require(lottery.ticketOwner(1, 4) == address(bob), "last bob ticket");
    }

    function testRejectsInvalidPurchaseQuantity() public {
        _openDraw();
        _expectFailure(address(alice), abi.encodeCall(Player.buy, (lottery, 0)));
        _expectFailure(address(alice), abi.encodeCall(Player.buy, (lottery, 11)));
    }

    function testEnforcesPerWalletTicketLimit() public {
        _openDraw();
        for (uint256 index = 0; index < 10; index++) alice.buy(lottery, 10);
        _expectFailure(address(alice), abi.encodeCall(Player.buy, (lottery, 1)));
        require(lottery.ticketsByWallet(1, address(alice)) == 100, "wallet limit");
    }

    function testOnlyAdminCanStartDraw() public {
        _expectFailure(address(alice), abi.encodeCall(Player.start, (lottery, uint64(block.timestamp + 1 days))));
    }

    function testAdminTransferRequiresAcceptance() public {
        lottery.transferAdmin(address(alice));
        require(lottery.admin() == address(this), "admin changed before acceptance");

        alice.acceptAdmin(lottery);
        require(lottery.admin() == address(alice), "admin not transferred");
        _expectFailure(address(lottery), abi.encodeCall(LottoChain.startDraw, (uint64(block.timestamp + 1 days))));
        alice.start(lottery, uint64(block.timestamp + 1 days));
    }

    function testCannotReplaceOracleDuringActiveDraw() public {
        MockOracle replacement = new MockOracle();
        _openDraw();

        (bool success,) = address(lottery).call(
            abi.encodeCall(LottoChain.setRandomnessOracle, (address(replacement)))
        );
        require(!success, "oracle replaced during active draw");
        require(lottery.randomnessOracle() == address(oracle), "oracle changed");
    }

    function testCannotCloseBeforeDeadline() public {
        _openDraw();
        (bool success,) = address(lottery).call(abi.encodeCall(LottoChain.closeDraw, (1)));
        require(!success, "early close accepted");
    }

    function testMissedMinimumEnablesExactRefund() public {
        _openDraw();
        alice.buy(lottery, 2);
        _expireAndClose();

        LottoChain.Draw memory draw = lottery.getDraw(1);
        require(draw.state == LottoChain.DrawState.Refundable, "not refundable");
        alice.refund(lottery, 1);
        require(token.balanceOf(address(alice)) == STARTING_BALANCE, "refund not exact");
        require(token.balanceOf(address(lottery)) == 0, "contract retained refund");
        _expectFailure(address(alice), abi.encodeCall(Player.refund, (lottery, 1)));
    }

    function testVerifiedRandomnessPaysWinnerAndTreasuryExactly() public {
        _openDraw();
        alice.buy(lottery, 1);
        bob.buy(lottery, 2);
        _expireAndClose();

        LottoChain.Draw memory pending = lottery.getDraw(1);
        require(pending.state == LottoChain.DrawState.RandomnessPending, "not pending");
        oracle.fulfill(pending.requestId, 1, 1);

        LottoChain.Draw memory settled = lottery.getDraw(1);
        require(settled.state == LottoChain.DrawState.Settled, "not settled");
        require(settled.winner == address(bob), "wrong winner");
        require(token.balanceOf(TREASURY) == 9 * USDT, "treasury split");
        require(token.balanceOf(address(bob)) == STARTING_BALANCE + 1 * USDT, "winner payout");
        require(token.balanceOf(address(lottery)) == 0, "pool retained");
    }

    function testRejectsUnverifiedRandomnessCallback() public {
        _openDraw();
        alice.buy(lottery, 1);
        bob.buy(lottery, 1);
        _expireAndClose();
        LottoChain.Draw memory pending = lottery.getDraw(1);

        (bool success,) = address(lottery).call(
            abi.encodeCall(LottoChain.fulfillRandomness, (pending.requestId, 1, 123))
        );
        require(!success, "unverified callback accepted");
    }

    function testOracleTimeoutUnlocksRefunds() public {
        _openDraw();
        alice.buy(lottery, 1);
        bob.buy(lottery, 1);
        _expireAndClose();

        (bool early,) = address(lottery).call(abi.encodeCall(LottoChain.enableRefundsAfterOracleTimeout, (1)));
        require(!early, "early timeout accepted");

        vm.warp(block.timestamp + 1 days + 1);
        lottery.enableRefundsAfterOracleTimeout(1);
        LottoChain.Draw memory draw = lottery.getDraw(1);
        require(draw.state == LottoChain.DrawState.Refundable, "timeout not refundable");

        alice.refund(lottery, 1);
        bob.refund(lottery, 1);
        require(token.balanceOf(address(alice)) == STARTING_BALANCE, "alice timeout refund");
        require(token.balanceOf(address(bob)) == STARTING_BALANCE, "bob timeout refund");
    }

    function testPauseStopsTicketSales() public {
        _openDraw();
        lottery.setPaused(true);
        _expectFailure(address(alice), abi.encodeCall(Player.buy, (lottery, 1)));
        lottery.setPaused(false);
        alice.buy(lottery, 1);
        require(lottery.ticketsByWallet(1, address(alice)) == 1, "resume failed");
    }

    function _openDraw() private {
        lottery.startDraw(uint64(block.timestamp + 1 days));
    }

    function _expireAndClose() private {
        vm.warp(block.timestamp + 1 days + 1);
        lottery.closeDraw(1);
    }

    function _expectFailure(address target, bytes memory data) private {
        (bool success,) = target.call(data);
        require(!success, "expected failure");
    }
}
