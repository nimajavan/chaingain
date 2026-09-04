// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/// @notice Minimal TRC-20 interface used by LottoChain.
interface ITRC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
}

/// @notice Adapter interface for a verified randomness provider such as WINkLink VRF.
interface ILottoRandomnessOracle {
    function requestRandomness(uint256 drawId) external returns (bytes32 requestId);
}

/// @title LottoChain
/// @notice On-chain draw settlement using a fixed TRC-20 token and an external VRF adapter.
/// @dev This contract is an audit candidate. Do not deploy it with real funds before an independent audit.
contract LottoChain {
    enum DrawState {
        None,
        Open,
        RandomnessPending,
        Refundable,
        Settled
    }

    struct Draw {
        uint64 openedAt;
        uint64 closesAt;
        uint32 totalTickets;
        uint32 uniquePlayers;
        uint256 pool;
        uint64 randomnessRequestedAt;
        DrawState state;
        address winner;
        uint256 randomWord;
        bytes32 requestId;
    }

    struct TicketRange {
        uint32 upperBound;
        address buyer;
    }

    uint16 public constant BPS_DENOMINATOR = 10_000;
    uint16 public constant TREASURY_BPS = 3_000;
    uint32 public constant MAX_TICKETS_PER_PURCHASE = 10;

    ITRC20 public immutable paymentToken;
    address public immutable treasury;
    uint256 public immutable ticketPrice;
    uint32 public immutable minimumPlayers;
    uint32 public immutable maximumTicketsPerWallet;
    uint64 public immutable randomnessTimeout;

    address public admin;
    address public pendingAdmin;
    address public randomnessOracle;
    uint256 public currentDrawId;
    bool public paused;

    mapping(uint256 drawId => Draw draw) private _draws;
    mapping(uint256 drawId => TicketRange[] ranges) private _ticketRanges;
    mapping(uint256 drawId => mapping(address player => uint32 count)) public ticketsByWallet;
    mapping(uint256 drawId => mapping(address player => uint256 amount)) public contributionByWallet;
    mapping(uint256 drawId => mapping(address player => bool claimed)) public refundClaimed;

    uint256 private _reentrancyLock = 1;

    error Unauthorized();
    error InvalidConfiguration();
    error InvalidState();
    error InvalidQuantity();
    error DrawStillOpen();
    error DrawClosed();
    error WalletLimitExceeded();
    error UnexpectedTokenAmount();
    error TokenTransferFailed();
    error InvalidRandomnessRequest();
    error NothingToRefund();
    error Reentrancy();

    event DrawOpened(uint256 indexed drawId, uint64 openedAt, uint64 closesAt);
    event TicketsPurchased(uint256 indexed drawId, address indexed buyer, uint32 quantity, uint256 amount);
    event RandomnessRequested(uint256 indexed drawId, bytes32 indexed requestId);
    event DrawBecameRefundable(uint256 indexed drawId, uint32 uniquePlayers, uint256 pool);
    event DrawSettled(
        uint256 indexed drawId,
        address indexed winner,
        uint256 winnerPayout,
        uint256 treasuryPayout,
        uint256 randomWord
    );
    event RefundClaimed(uint256 indexed drawId, address indexed player, uint256 amount);
    event OracleUpdated(address indexed previousOracle, address indexed newOracle);
    event PauseUpdated(bool paused);
    event AdminTransferStarted(address indexed currentAdmin, address indexed pendingAdmin);
    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);

    modifier onlyAdmin() {
        if (msg.sender != admin) revert Unauthorized();
        _;
    }

    modifier nonReentrant() {
        if (_reentrancyLock != 1) revert Reentrancy();
        _reentrancyLock = 2;
        _;
        _reentrancyLock = 1;
    }

    constructor(
        address paymentToken_,
        address treasury_,
        address admin_,
        address randomnessOracle_,
        uint256 ticketPrice_,
        uint32 minimumPlayers_,
        uint32 maximumTicketsPerWallet_,
        uint64 randomnessTimeout_
    ) {
        if (
            paymentToken_ == address(0) || treasury_ == address(0) || admin_ == address(0)
                || randomnessOracle_ == address(0) || ticketPrice_ == 0 || minimumPlayers_ < 2
                || maximumTicketsPerWallet_ == 0 || randomnessTimeout_ == 0
        ) revert InvalidConfiguration();

        paymentToken = ITRC20(paymentToken_);
        treasury = treasury_;
        admin = admin_;
        randomnessOracle = randomnessOracle_;
        ticketPrice = ticketPrice_;
        minimumPlayers = minimumPlayers_;
        maximumTicketsPerWallet = maximumTicketsPerWallet_;
        randomnessTimeout = randomnessTimeout_;
    }

    /// @notice Opens the next draw. The admin should be a verified multisig.
    function startDraw(uint64 closesAt) external onlyAdmin returns (uint256 drawId) {
        if (paused || closesAt <= block.timestamp) revert InvalidConfiguration();

        if (currentDrawId != 0) {
            DrawState state = _draws[currentDrawId].state;
            if (state == DrawState.Open || state == DrawState.RandomnessPending) revert InvalidState();
        }

        drawId = ++currentDrawId;
        Draw storage draw = _draws[drawId];
        draw.openedAt = uint64(block.timestamp);
        draw.closesAt = closesAt;
        draw.state = DrawState.Open;
        emit DrawOpened(drawId, draw.openedAt, closesAt);
    }

    /// @notice Buys 1-10 tickets with an exact TRC-20 transferFrom payment.
    function buyTicket(uint32 quantity) external nonReentrant {
        if (paused) revert InvalidState();
        if (quantity == 0 || quantity > MAX_TICKETS_PER_PURCHASE) revert InvalidQuantity();

        uint256 drawId = currentDrawId;
        Draw storage draw = _draws[drawId];
        if (draw.state != DrawState.Open) revert InvalidState();
        if (block.timestamp >= draw.closesAt) revert DrawClosed();

        uint32 previousTickets = ticketsByWallet[drawId][msg.sender];
        uint32 nextWalletTickets = previousTickets + quantity;
        if (nextWalletTickets > maximumTicketsPerWallet) revert WalletLimitExceeded();

        uint256 amount = ticketPrice * quantity;
        uint256 balanceBefore = paymentToken.balanceOf(address(this));
        _safeTransferFrom(address(paymentToken), msg.sender, address(this), amount);
        uint256 balanceAfter = paymentToken.balanceOf(address(this));
        if (balanceAfter - balanceBefore != amount) revert UnexpectedTokenAmount();

        uint32 nextTotalTickets = draw.totalTickets + quantity;
        if (previousTickets == 0) draw.uniquePlayers += 1;
        draw.totalTickets = nextTotalTickets;
        draw.pool += amount;
        ticketsByWallet[drawId][msg.sender] = nextWalletTickets;
        contributionByWallet[drawId][msg.sender] += amount;
        _ticketRanges[drawId].push(TicketRange({ upperBound: nextTotalTickets, buyer: msg.sender }));

        emit TicketsPurchased(drawId, msg.sender, quantity, amount);
    }

    /// @notice Closes an expired draw and either enables refunds or requests VRF randomness.
    function closeDraw(uint256 drawId) external nonReentrant {
        Draw storage draw = _draws[drawId];
        if (draw.state != DrawState.Open) revert InvalidState();
        if (block.timestamp < draw.closesAt) revert DrawStillOpen();

        if (draw.uniquePlayers < minimumPlayers) {
            draw.state = DrawState.Refundable;
            emit DrawBecameRefundable(drawId, draw.uniquePlayers, draw.pool);
            return;
        }

        draw.state = DrawState.RandomnessPending;
        draw.randomnessRequestedAt = uint64(block.timestamp);
        bytes32 requestId = ILottoRandomnessOracle(randomnessOracle).requestRandomness(drawId);
        if (requestId == bytes32(0)) revert InvalidRandomnessRequest();
        draw.requestId = requestId;
        emit RandomnessRequested(drawId, requestId);
    }

    /// @notice Unlocks refunds if the oracle fails to answer within the configured timeout.
    function enableRefundsAfterOracleTimeout(uint256 drawId) external {
        Draw storage draw = _draws[drawId];
        if (draw.state != DrawState.RandomnessPending) revert InvalidState();
        if (block.timestamp < uint256(draw.randomnessRequestedAt) + randomnessTimeout) revert DrawStillOpen();
        draw.state = DrawState.Refundable;
        emit DrawBecameRefundable(drawId, draw.uniquePlayers, draw.pool);
    }

    /// @notice Called only by the configured VRF adapter after it verifies the oracle proof.
    function fulfillRandomness(bytes32 requestId, uint256 drawId, uint256 randomWord) external nonReentrant {
        if (msg.sender != randomnessOracle) revert Unauthorized();
        Draw storage draw = _draws[drawId];
        if (draw.state != DrawState.RandomnessPending || draw.requestId != requestId) {
            revert InvalidRandomnessRequest();
        }

        uint32 winningTicket = uint32(randomWord % draw.totalTickets);
        address winner = ticketOwner(drawId, winningTicket);
        uint256 treasuryPayout = draw.pool * TREASURY_BPS / BPS_DENOMINATOR;
        uint256 winnerPayout = draw.pool - treasuryPayout;

        draw.state = DrawState.Settled;
        draw.winner = winner;
        draw.randomWord = randomWord;

        _safeTransfer(address(paymentToken), winner, winnerPayout);
        _safeTransfer(address(paymentToken), treasury, treasuryPayout);
        emit DrawSettled(drawId, winner, winnerPayout, treasuryPayout, randomWord);
    }

    /// @notice Returns the owner of a zero-based ticket index using cumulative purchase ranges.
    function ticketOwner(uint256 drawId, uint32 ticketIndex) public view returns (address) {
        Draw storage draw = _draws[drawId];
        if (ticketIndex >= draw.totalTickets) revert InvalidQuantity();

        TicketRange[] storage ranges = _ticketRanges[drawId];
        uint256 low;
        uint256 high = ranges.length;
        while (low < high) {
            uint256 mid = (low + high) / 2;
            if (ticketIndex < ranges[mid].upperBound) high = mid;
            else low = mid + 1;
        }
        return ranges[low].buyer;
    }

    /// @notice Claims the caller's exact contribution when a draw misses minimum participation.
    function claimRefund(uint256 drawId) external nonReentrant {
        if (_draws[drawId].state != DrawState.Refundable) revert InvalidState();
        uint256 amount = contributionByWallet[drawId][msg.sender];
        if (amount == 0 || refundClaimed[drawId][msg.sender]) revert NothingToRefund();

        refundClaimed[drawId][msg.sender] = true;
        contributionByWallet[drawId][msg.sender] = 0;
        _safeTransfer(address(paymentToken), msg.sender, amount);
        emit RefundClaimed(drawId, msg.sender, amount);
    }

    function getDraw(uint256 drawId) external view returns (Draw memory) {
        return _draws[drawId];
    }

    function ticketRangeCount(uint256 drawId) external view returns (uint256) {
        return _ticketRanges[drawId].length;
    }

    function setPaused(bool paused_) external onlyAdmin {
        paused = paused_;
        emit PauseUpdated(paused_);
    }

    /// @notice Oracle changes are blocked while a draw is open or awaiting randomness.
    function setRandomnessOracle(address nextOracle) external onlyAdmin {
        if (nextOracle == address(0)) revert InvalidConfiguration();
        if (currentDrawId != 0) {
            DrawState state = _draws[currentDrawId].state;
            if (state == DrawState.Open || state == DrawState.RandomnessPending) revert InvalidState();
        }
        address previousOracle = randomnessOracle;
        randomnessOracle = nextOracle;
        emit OracleUpdated(previousOracle, nextOracle);
    }

    function transferAdmin(address nextAdmin) external onlyAdmin {
        if (nextAdmin == address(0)) revert InvalidConfiguration();
        pendingAdmin = nextAdmin;
        emit AdminTransferStarted(admin, nextAdmin);
    }

    function acceptAdmin() external {
        if (msg.sender != pendingAdmin) revert Unauthorized();
        address previousAdmin = admin;
        admin = msg.sender;
        pendingAdmin = address(0);
        emit AdminTransferred(previousAdmin, msg.sender);
    }

    function _safeTransfer(address token, address recipient, uint256 amount) private {
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(ITRC20.transfer.selector, recipient, amount));
        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
    }

    function _safeTransferFrom(address token, address sender, address recipient, uint256 amount) private {
        (bool success, bytes memory data) =
            token.call(abi.encodeWithSelector(ITRC20.transferFrom.selector, sender, recipient, amount));
        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
    }
}
