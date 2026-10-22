// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";

/// @title parkinson registry: the on-chain half of the Parkinson's research notebook
/// @notice
/// * A prediction (gene, cell group, outcome) is registered by its hash before any data is read. A hash can be
///   registered once, and the block time is the public proof that it was sealed before the result existed.
/// * A wallet registers its own prediction, or signs one (EIP-712) for the agent to register and pay for.
/// * The oracle (the agent's key) writes the split-half result back; the wallet behind a replicated prediction can be
///   rewarded once from the registry's token pool.
/// * The agent's own predictions are sealed and resolved as events only, many in one transaction.
/// * The head of the off-chain receipt hash chain is checkpointed here, and it only moves forward.
/// The owner (a Safe on mainnet) sets the oracle and the token; the oracle does the day-to-day writes.
contract ParkinsonRegistry is Ownable2Step, EIP712 {
    using SafeERC20 for IERC20;

    enum Status {
        None,
        Pending,
        Replicated,
        Failed
    }

    struct Prediction {
        address predictor;
        uint40 registeredAt;
        uint40 resolvedAt;
        uint8 group;
        uint8 axis;
        Status status;
        bool rewarded;
        bytes16 gene;
        /// Spearman or rank-biserial effects x 10_000
        int16 effectDiscovery;
        int16 effectReplication;
        uint32 receiptNo;
    }

    struct Result {
        bytes32 hash;
        bool passed;
        int16 effectDiscovery;
        int16 effectReplication;
        uint32 receiptNo;
    }

    struct State {
        address owner;
        address oracle;
        address token;
        uint128 rewardAmount;
        uint128 faucetAmount;
        uint256 pool;
        uint256 predictions;
        uint64 resolved;
        uint64 replicated;
        uint64 receiptHeadNo;
        uint64 anchoredAt;
        bytes32 receiptHeadHash;
    }

    bytes32 public constant REGISTER_TYPEHASH = keccak256("Register(bytes32 hash,string gene,uint8 group,uint8 axis)");

    address public oracle;
    /// the reward and faucet token; unset turns both off (mainnet starts that way)
    IERC20 public token;
    uint128 public rewardAmount;
    uint128 public faucetAmount;

    uint64 public resolved;
    uint64 public replicated;
    uint64 public receiptHeadNo;
    uint64 public anchoredAt;
    bytes32 public receiptHeadHash;

    mapping(bytes32 => Prediction) private _predictions;
    /// every wallet prediction in registration order, so a client can sync with plain calls instead of log queries
    bytes32[] public hashes;

    event Registered(bytes32 indexed hash, address indexed predictor, bytes16 gene, uint8 group, uint8 axis);
    event Sealed(bytes32 indexed hash);
    event Resolved(bytes32 indexed hash, bool passed, int16 effectDiscovery, int16 effectReplication, uint32 receiptNo);
    event Rewarded(bytes32 indexed hash, address indexed predictor, uint256 amount);
    event Anchored(uint64 indexed headNo, bytes32 headHash);
    event Dripped(address indexed to, uint256 amount);
    event OracleChanged(address indexed oracle);
    event Configured(address indexed token, uint128 rewardAmount, uint128 faucetAmount);

    error NotOracle();
    error ZeroAddress();
    error BadGene();
    error BadSignature();
    error AlreadyRegistered();
    error NotPending();
    error NotReplicated();
    error AlreadyRewarded();
    error NoReward();
    error FaucetOff();
    error StaleCheckpoint();

    modifier onlyOracle() {
        if (msg.sender != oracle) revert NotOracle();
        _;
    }

    constructor(address owner_, address oracle_) Ownable(owner_) EIP712("ParkinsonRegistry", "1") {
        _setOracle(oracle_);
    }

    // ------------------------------------------------------------------ predictions

    /// @notice registers a prediction made by the caller
    function register(bytes32 hash, string calldata gene, uint8 group, uint8 axis) external {
        _register(hash, gene, group, axis, msg.sender);
    }

    /// @notice registers a prediction the predictor signed, so someone else (the agent) can pay for it
    function registerFor(bytes32 hash, string calldata gene, uint8 group, uint8 axis, address predictor, bytes calldata signature)
        external
    {
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(REGISTER_TYPEHASH, hash, keccak256(bytes(gene)), group, axis)));
        if (!SignatureChecker.isValidSignatureNow(predictor, digest, signature)) revert BadSignature();
        _register(hash, gene, group, axis, predictor);
    }

    /// @notice the split-half result of a wallet prediction
    function resolve(bytes32 hash, bool passed, int16 effectDiscovery, int16 effectReplication, uint32 receiptNo) external onlyOracle {
        Prediction storage p = _predictions[hash];
        if (p.status != Status.Pending) revert NotPending();
        p.status = passed ? Status.Replicated : Status.Failed;
        p.effectDiscovery = effectDiscovery;
        p.effectReplication = effectReplication;
        p.receiptNo = receiptNo;
        p.resolvedAt = uint40(block.timestamp);
        resolved++;
        if (passed) replicated++;
        emit Resolved(hash, passed, effectDiscovery, effectReplication, receiptNo);
    }

    /// @notice pays the reward once to the wallet behind a replicated prediction
    function reward(bytes32 hash) external onlyOracle {
        Prediction storage p = _predictions[hash];
        if (p.status != Status.Replicated) revert NotReplicated();
        if (p.rewarded) revert AlreadyRewarded();
        uint256 amount = rewardAmount;
        if (amount == 0 || address(token) == address(0)) revert NoReward();
        p.rewarded = true;
        token.safeTransfer(p.predictor, amount);
        emit Rewarded(hash, p.predictor, amount);
    }

    /// @notice the agent's own predictions, sealed before it reads the data
    function seal(bytes32[] calldata batch) external onlyOracle {
        for (uint256 i; i < batch.length; ++i) {
            emit Sealed(batch[i]);
        }
    }

    /// @notice results of predictions sealed with `seal`
    function publish(Result[] calldata results) external onlyOracle {
        for (uint256 i; i < results.length; ++i) {
            Result calldata r = results[i];
            emit Resolved(r.hash, r.passed, r.effectDiscovery, r.effectReplication, r.receiptNo);
        }
    }

    // ------------------------------------------------------------------ receipts and the faucet

    /// @notice checkpoints the head of the receipt hash chain; heads only move forward
    function anchor(uint64 headNo, bytes32 headHash) external onlyOracle {
        if (headNo <= receiptHeadNo) revert StaleCheckpoint();
        receiptHeadNo = headNo;
        receiptHeadHash = headHash;
        anchoredAt = uint64(block.timestamp);
        emit Anchored(headNo, headHash);
    }

    /// @notice test tokens from the pool; the agent rate-limits who it does this for
    function drip(address to) external onlyOracle {
        uint256 amount = faucetAmount;
        if (amount == 0 || address(token) == address(0)) revert FaucetOff();
        token.safeTransfer(to, amount);
        emit Dripped(to, amount);
    }

    // ------------------------------------------------------------------ owner

    function setOracle(address oracle_) external onlyOwner {
        _setOracle(oracle_);
    }

    /// @notice the token that pays rewards and the faucet, and how much each pays; zero turns that one off
    function configure(IERC20 token_, uint128 rewardAmount_, uint128 faucetAmount_) external onlyOwner {
        token = token_;
        rewardAmount = rewardAmount_;
        faucetAmount = faucetAmount_;
        emit Configured(address(token_), rewardAmount_, faucetAmount_);
    }

    /// @notice moves tokens out of the pool (or anything sent here by mistake)
    function sweep(IERC20 token_, address to, uint256 amount) external onlyOwner {
        token_.safeTransfer(to, amount);
    }

    // ------------------------------------------------------------------ reads

    function prediction(bytes32 hash) external view returns (Prediction memory) {
        return _predictions[hash];
    }

    function count() external view returns (uint256) {
        return hashes.length;
    }

    /// @notice up to `max` wallet predictions from position `start`, in registration order
    function page(uint256 start, uint256 max) external view returns (bytes32[] memory hs, Prediction[] memory ps) {
        uint256 end = start + max;
        if (end > hashes.length) end = hashes.length;
        uint256 n = end > start ? end - start : 0;
        hs = new bytes32[](n);
        ps = new Prediction[](n);
        for (uint256 i; i < n; ++i) {
            hs[i] = hashes[start + i];
            ps[i] = _predictions[hs[i]];
        }
    }

    /// @notice everything the status page shows, in one call
    function state() external view returns (State memory s) {
        s.owner = owner();
        s.oracle = oracle;
        s.token = address(token);
        s.rewardAmount = rewardAmount;
        s.faucetAmount = faucetAmount;
        s.pool = address(token) == address(0) ? 0 : token.balanceOf(address(this));
        s.predictions = hashes.length;
        s.resolved = resolved;
        s.replicated = replicated;
        s.receiptHeadNo = receiptHeadNo;
        s.anchoredAt = anchoredAt;
        s.receiptHeadHash = receiptHeadHash;
    }

    // ------------------------------------------------------------------ internal

    function _register(bytes32 hash, string calldata gene, uint8 group, uint8 axis, address predictor) private {
        uint256 len = bytes(gene).length;
        if (len == 0 || len > 16) revert BadGene();
        Prediction storage p = _predictions[hash];
        if (p.status != Status.None) revert AlreadyRegistered();
        p.predictor = predictor;
        p.registeredAt = uint40(block.timestamp);
        p.group = group;
        p.axis = axis;
        p.status = Status.Pending;
        p.gene = bytes16(bytes(gene));
        hashes.push(hash);
        emit Registered(hash, predictor, p.gene, group, axis);
    }

    function _setOracle(address oracle_) private {
        if (oracle_ == address(0)) revert ZeroAddress();
        oracle = oracle_;
        emit OracleChanged(oracle_);
    }
}
