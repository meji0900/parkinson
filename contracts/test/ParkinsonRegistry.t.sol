// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {IERC1271} from "@openzeppelin/contracts/interfaces/IERC1271.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {ParkinsonRegistry} from "../src/ParkinsonRegistry.sol";
import {ParkinsonTestToken} from "../src/ParkinsonTestToken.sol";

/// a smart-contract wallet that accepts signatures from one key, like a Safe with one owner
contract MockWallet is IERC1271 {
    address internal immutable SIGNER;

    constructor(address signer_) {
        SIGNER = signer_;
    }

    function isValidSignature(bytes32 hash, bytes calldata signature) external view returns (bytes4) {
        return ECDSA.recover(hash, signature) == SIGNER ? IERC1271.isValidSignature.selector : bytes4(0xffffffff);
    }
}

contract ParkinsonRegistryTest is Test {
    event Registered(bytes32 indexed hash, address indexed predictor, bytes16 gene, uint8 group, uint8 axis);
    event Sealed(bytes32 indexed hash);
    event Resolved(bytes32 indexed hash, bool passed, int16 effectDiscovery, int16 effectReplication, uint32 receiptNo);
    event Rewarded(bytes32 indexed hash, address indexed predictor, uint256 amount);
    event Anchored(uint64 indexed headNo, bytes32 headHash);
    event Dripped(address indexed to, uint256 amount);

    bytes32 internal constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    uint256 internal constant REWARD = 50 ether;
    uint256 internal constant FAUCET = 250 ether;

    ParkinsonRegistry internal registry;
    ParkinsonTestToken internal token;
    address internal owner = makeAddr("owner");
    address internal oracle = makeAddr("oracle");
    uint256 internal aliceKey = 0xA11CE;
    address internal alice = vm.addr(0xA11CE);
    address internal bob = makeAddr("bob");

    bytes32 internal constant H = keccak256("parkinson-test-1");
    bytes32 internal constant H2 = keccak256("parkinson-test-2");

    function setUp() public {
        registry = new ParkinsonRegistry(owner, oracle);
        token = new ParkinsonTestToken(address(registry), 1_000_000_000 ether);
        vm.prank(owner);
        registry.configure(token, uint128(REWARD), uint128(FAUCET));
    }

    // ---------------------------------------------------------------- helpers

    function digest(bytes32 hash, string memory gene, uint8 group, uint8 axis, uint256 chainId) internal view returns (bytes32) {
        bytes32 domain = keccak256(abi.encode(DOMAIN_TYPEHASH, keccak256("ParkinsonRegistry"), keccak256("1"), chainId, address(registry)));
        bytes32 structHash = keccak256(abi.encode(registry.REGISTER_TYPEHASH(), hash, keccak256(bytes(gene)), group, axis));
        return keccak256(abi.encodePacked("\x19\x01", domain, structHash));
    }

    function sign(uint256 key, bytes32 hash, string memory gene, uint8 group, uint8 axis) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest(hash, gene, group, axis, block.chainid));
        return abi.encodePacked(r, s, v);
    }

    function registered(bytes32 hash, bool passed) internal {
        vm.prank(alice);
        registry.register(hash, "LRRK2", 0, 1);
        vm.prank(oracle);
        registry.resolve(hash, passed, 4200, 3100, 7);
    }

    // ---------------------------------------------------------------- deployment

    function test_constructor() public view {
        assertEq(registry.owner(), owner);
        assertEq(registry.oracle(), oracle);
        assertEq(address(registry.token()), address(token));
        assertEq(registry.rewardAmount(), REWARD);
        assertEq(registry.faucetAmount(), FAUCET);
        assertEq(token.balanceOf(address(registry)), 1_000_000_000 ether);
        assertEq(token.symbol(), "tPARKINSON");
    }

    function test_constructor_rejectsZeroOracle() public {
        vm.expectRevert(ParkinsonRegistry.ZeroAddress.selector);
        new ParkinsonRegistry(owner, address(0));
    }

    function test_constructor_rejectsZeroOwner() public {
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableInvalidOwner.selector, address(0)));
        new ParkinsonRegistry(address(0), oracle);
    }

    // ---------------------------------------------------------------- register

    function test_register_storesTheCaller() public {
        vm.warp(1_800_000_000);
        vm.expectEmit(address(registry));
        emit Registered(H, alice, bytes16("GBA1"), 3, 2);
        vm.prank(alice);
        registry.register(H, "GBA1", 3, 2);

        ParkinsonRegistry.Prediction memory p = registry.prediction(H);
        assertEq(p.predictor, alice);
        assertEq(p.registeredAt, 1_800_000_000);
        assertEq(p.group, 3);
        assertEq(p.axis, 2);
        assertEq(uint8(p.status), uint8(ParkinsonRegistry.Status.Pending));
        assertEq(p.gene, bytes16("GBA1"));
        assertFalse(p.rewarded);
        assertEq(registry.count(), 1);
        assertEq(registry.hashes(0), H);
    }

    function test_register_onlyOnce() public {
        vm.prank(alice);
        registry.register(H, "GBA1", 0, 0);
        vm.prank(bob);
        vm.expectRevert(ParkinsonRegistry.AlreadyRegistered.selector);
        registry.register(H, "SNCA", 1, 1);
    }

    function test_register_rejectsBadGenes() public {
        vm.expectRevert(ParkinsonRegistry.BadGene.selector);
        registry.register(H, "", 0, 0);
        vm.expectRevert(ParkinsonRegistry.BadGene.selector);
        registry.register(H, "ABCDEFGHIJKLMNOPQ", 0, 0);
    }

    function test_register_sixteenCharacterGene() public {
        registry.register(H, "ABCDEFGHIJKLMNOP", 0, 0);
        assertEq(registry.prediction(H).gene, bytes16("ABCDEFGHIJKLMNOP"));
    }

    // ---------------------------------------------------------------- registerFor (signed, someone else pays)

    function test_registerFor_withAWalletSignature() public {
        bytes memory sig = sign(aliceKey, H, "PINK1", 0, 0);
        vm.expectEmit(address(registry));
        emit Registered(H, alice, bytes16("PINK1"), 0, 0);
        vm.prank(oracle);
        registry.registerFor(H, "PINK1", 0, 0, alice, sig);
        assertEq(registry.prediction(H).predictor, alice);
    }

    function test_registerFor_anyoneCanSubmitIt() public {
        bytes memory sig = sign(aliceKey, H, "PINK1", 0, 0);
        vm.prank(bob);
        registry.registerFor(H, "PINK1", 0, 0, alice, sig);
        assertEq(registry.prediction(H).predictor, alice);
    }

    function test_registerFor_rejectsAnotherSigner() public {
        bytes memory sig = sign(0xB0B, H, "PINK1", 0, 0);
        vm.expectRevert(ParkinsonRegistry.BadSignature.selector);
        registry.registerFor(H, "PINK1", 0, 0, alice, sig);
    }

    function test_registerFor_rejectsChangedFields() public {
        bytes memory sig = sign(aliceKey, H, "PINK1", 0, 0);
        vm.expectRevert(ParkinsonRegistry.BadSignature.selector);
        registry.registerFor(H2, "PINK1", 0, 0, alice, sig);
        vm.expectRevert(ParkinsonRegistry.BadSignature.selector);
        registry.registerFor(H, "PINK2", 0, 0, alice, sig);
        vm.expectRevert(ParkinsonRegistry.BadSignature.selector);
        registry.registerFor(H, "PINK1", 1, 0, alice, sig);
        vm.expectRevert(ParkinsonRegistry.BadSignature.selector);
        registry.registerFor(H, "PINK1", 0, 1, alice, sig);
        vm.expectRevert(ParkinsonRegistry.BadSignature.selector);
        registry.registerFor(H, "PINK1", 0, 0, bob, sig);
    }

    function test_registerFor_rejectsASignatureForAnotherChain() public {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(aliceKey, digest(H, "PINK1", 0, 0, 1));
        vm.expectRevert(ParkinsonRegistry.BadSignature.selector);
        registry.registerFor(H, "PINK1", 0, 0, alice, abi.encodePacked(r, s, v));
    }

    function test_registerFor_cannotBeReplayed() public {
        bytes memory sig = sign(aliceKey, H, "PINK1", 0, 0);
        registry.registerFor(H, "PINK1", 0, 0, alice, sig);
        vm.expectRevert(ParkinsonRegistry.AlreadyRegistered.selector);
        registry.registerFor(H, "PINK1", 0, 0, alice, sig);
    }

    function test_registerFor_withAContractWallet() public {
        MockWallet wallet = new MockWallet(alice);
        bytes memory sig = sign(aliceKey, H, "VPS35", 2, 1);
        registry.registerFor(H, "VPS35", 2, 1, address(wallet), sig);
        assertEq(registry.prediction(H).predictor, address(wallet));

        bytes memory wrong = sign(0xB0B, H2, "VPS35", 2, 1);
        vm.expectRevert(ParkinsonRegistry.BadSignature.selector);
        registry.registerFor(H2, "VPS35", 2, 1, address(wallet), wrong);
    }

    // ---------------------------------------------------------------- resolve

    function test_resolve_writesTheResult() public {
        vm.prank(alice);
        registry.register(H, "LRRK2", 0, 1);
        vm.warp(1_800_000_600);
        vm.expectEmit(address(registry));
        emit Resolved(H, true, 4200, -3100, 12);
        vm.prank(oracle);
        registry.resolve(H, true, 4200, -3100, 12);

        ParkinsonRegistry.Prediction memory p = registry.prediction(H);
        assertEq(uint8(p.status), uint8(ParkinsonRegistry.Status.Replicated));
        assertEq(p.effectDiscovery, 4200);
        assertEq(p.effectReplication, -3100);
        assertEq(p.receiptNo, 12);
        assertEq(p.resolvedAt, 1_800_000_600);
        assertEq(registry.resolved(), 1);
        assertEq(registry.replicated(), 1);
    }

    function test_resolve_aFailure() public {
        registered(H, false);
        assertEq(uint8(registry.prediction(H).status), uint8(ParkinsonRegistry.Status.Failed));
        assertEq(registry.resolved(), 1);
        assertEq(registry.replicated(), 0);
    }

    function test_resolve_onlyTheOracle() public {
        vm.prank(alice);
        registry.register(H, "LRRK2", 0, 1);
        vm.prank(alice);
        vm.expectRevert(ParkinsonRegistry.NotOracle.selector);
        registry.resolve(H, true, 0, 0, 0);
    }

    function test_resolve_onlyPendingOnes() public {
        vm.prank(oracle);
        vm.expectRevert(ParkinsonRegistry.NotPending.selector);
        registry.resolve(H, true, 0, 0, 0);

        registered(H, true);
        vm.prank(oracle);
        vm.expectRevert(ParkinsonRegistry.NotPending.selector);
        registry.resolve(H, false, 0, 0, 0);
    }

    // ---------------------------------------------------------------- reward

    function test_reward_paysThePredictorOnce() public {
        registered(H, true);
        vm.expectEmit(address(registry));
        emit Rewarded(H, alice, REWARD);
        vm.prank(oracle);
        registry.reward(H);
        assertEq(token.balanceOf(alice), REWARD);
        assertTrue(registry.prediction(H).rewarded);

        vm.prank(oracle);
        vm.expectRevert(ParkinsonRegistry.AlreadyRewarded.selector);
        registry.reward(H);
    }

    function test_reward_onlyReplicatedOnes() public {
        vm.prank(alice);
        registry.register(H, "LRRK2", 0, 1);
        vm.prank(oracle);
        vm.expectRevert(ParkinsonRegistry.NotReplicated.selector);
        registry.reward(H);

        registered(H2, false);
        vm.prank(oracle);
        vm.expectRevert(ParkinsonRegistry.NotReplicated.selector);
        registry.reward(H2);
    }

    function test_reward_offWithoutATokenOrAmount() public {
        registered(H, true);
        vm.prank(owner);
        registry.configure(token, 0, uint128(FAUCET));
        vm.prank(oracle);
        vm.expectRevert(ParkinsonRegistry.NoReward.selector);
        registry.reward(H);

        vm.prank(owner);
        registry.configure(IERC20(address(0)), uint128(REWARD), 0);
        vm.prank(oracle);
        vm.expectRevert(ParkinsonRegistry.NoReward.selector);
        registry.reward(H);
    }

    function test_reward_onlyTheOracle() public {
        registered(H, true);
        vm.prank(alice);
        vm.expectRevert(ParkinsonRegistry.NotOracle.selector);
        registry.reward(H);
    }

    // ---------------------------------------------------------------- the agent's own seals and results

    function test_seal_emitsOneEventPerHash() public {
        bytes32[] memory hs = new bytes32[](2);
        hs[0] = H;
        hs[1] = H2;
        vm.expectEmit(address(registry));
        emit Sealed(H);
        vm.expectEmit(address(registry));
        emit Sealed(H2);
        vm.prank(oracle);
        registry.seal(hs);
    }

    function test_publish_emitsOneEventPerResult() public {
        ParkinsonRegistry.Result[] memory rs = new ParkinsonRegistry.Result[](2);
        rs[0] = ParkinsonRegistry.Result(H, true, 100, 90, 0);
        rs[1] = ParkinsonRegistry.Result(H2, false, -5, 2, 31);
        vm.expectEmit(address(registry));
        emit Resolved(H, true, 100, 90, 0);
        vm.expectEmit(address(registry));
        emit Resolved(H2, false, -5, 2, 31);
        vm.prank(oracle);
        registry.publish(rs);
    }

    function test_sealAndPublish_onlyTheOracle() public {
        vm.startPrank(alice);
        vm.expectRevert(ParkinsonRegistry.NotOracle.selector);
        registry.seal(new bytes32[](1));
        vm.expectRevert(ParkinsonRegistry.NotOracle.selector);
        registry.publish(new ParkinsonRegistry.Result[](1));
        vm.stopPrank();
    }

    // ---------------------------------------------------------------- receipt checkpoints

    function test_anchor_onlyMovesForward() public {
        vm.warp(1_800_001_000);
        vm.expectEmit(address(registry));
        emit Anchored(25, H);
        vm.prank(oracle);
        registry.anchor(25, H);
        assertEq(registry.receiptHeadNo(), 25);
        assertEq(registry.receiptHeadHash(), H);
        assertEq(registry.anchoredAt(), 1_800_001_000);

        vm.startPrank(oracle);
        vm.expectRevert(ParkinsonRegistry.StaleCheckpoint.selector);
        registry.anchor(25, H2);
        vm.expectRevert(ParkinsonRegistry.StaleCheckpoint.selector);
        registry.anchor(24, H2);
        registry.anchor(26, H2);
        vm.stopPrank();
        assertEq(registry.receiptHeadHash(), H2);
    }

    function test_anchor_onlyTheOracle() public {
        vm.prank(alice);
        vm.expectRevert(ParkinsonRegistry.NotOracle.selector);
        registry.anchor(1, H);
    }

    // ---------------------------------------------------------------- faucet

    function test_drip_sendsTestTokens() public {
        vm.expectEmit(address(registry));
        emit Dripped(bob, FAUCET);
        vm.prank(oracle);
        registry.drip(bob);
        assertEq(token.balanceOf(bob), FAUCET);
    }

    function test_drip_offWhenTheAmountIsZero() public {
        vm.prank(owner);
        registry.configure(token, uint128(REWARD), 0);
        vm.prank(oracle);
        vm.expectRevert(ParkinsonRegistry.FaucetOff.selector);
        registry.drip(bob);
    }

    function test_drip_stopsWhenThePoolIsEmpty() public {
        uint256 pool = token.balanceOf(address(registry));
        vm.prank(owner);
        registry.sweep(token, owner, pool - 1);
        vm.prank(oracle);
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, address(registry), 1, FAUCET));
        registry.drip(bob);
    }

    function test_drip_onlyTheOracle() public {
        vm.prank(bob);
        vm.expectRevert(ParkinsonRegistry.NotOracle.selector);
        registry.drip(bob);
    }

    // ---------------------------------------------------------------- owner

    function test_owner_setsTheOracle() public {
        vm.prank(owner);
        registry.setOracle(bob);
        assertEq(registry.oracle(), bob);
        vm.prank(oracle);
        vm.expectRevert(ParkinsonRegistry.NotOracle.selector);
        registry.anchor(1, H);
        vm.prank(bob);
        registry.anchor(1, H);
    }

    function test_owner_cannotSetAZeroOracle() public {
        vm.prank(owner);
        vm.expectRevert(ParkinsonRegistry.ZeroAddress.selector);
        registry.setOracle(address(0));
    }

    function test_owner_onlyTheOwner() public {
        vm.startPrank(oracle);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, oracle));
        registry.setOracle(bob);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, oracle));
        registry.configure(token, 1, 1);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, oracle));
        registry.sweep(token, oracle, 1);
        vm.stopPrank();
    }

    function test_owner_sweepsThePool() public {
        vm.prank(owner);
        registry.sweep(token, owner, 1000 ether);
        assertEq(token.balanceOf(owner), 1000 ether);
    }

    function test_owner_handsOverInTwoSteps() public {
        address safe = makeAddr("safe");
        vm.prank(owner);
        registry.transferOwnership(safe);
        assertEq(registry.owner(), owner);
        assertEq(registry.pendingOwner(), safe);
        vm.prank(safe);
        registry.acceptOwnership();
        assertEq(registry.owner(), safe);
    }

    // ---------------------------------------------------------------- reads

    function test_page_walksTheRegistrations() public {
        for (uint256 i; i < 5; ++i) {
            registry.register(keccak256(abi.encode(i)), "TH", uint8(i), 0);
        }
        (bytes32[] memory hs, ParkinsonRegistry.Prediction[] memory ps) = registry.page(1, 3);
        assertEq(hs.length, 3);
        assertEq(hs[0], keccak256(abi.encode(uint256(1))));
        assertEq(ps[2].group, 3);

        (hs, ps) = registry.page(3, 10);
        assertEq(hs.length, 2);
        (hs, ps) = registry.page(5, 10);
        assertEq(hs.length, 0);
        (hs, ps) = registry.page(99, 10);
        assertEq(ps.length, 0);
    }

    function test_state_inOneCall() public {
        registered(H, true);
        vm.prank(oracle);
        registry.anchor(9, H2);
        ParkinsonRegistry.State memory s = registry.state();
        assertEq(s.owner, owner);
        assertEq(s.oracle, oracle);
        assertEq(s.token, address(token));
        assertEq(s.rewardAmount, REWARD);
        assertEq(s.faucetAmount, FAUCET);
        assertEq(s.pool, 1_000_000_000 ether);
        assertEq(s.predictions, 1);
        assertEq(s.resolved, 1);
        assertEq(s.replicated, 1);
        assertEq(s.receiptHeadNo, 9);
        assertEq(s.receiptHeadHash, H2);
    }

    function test_state_withoutAToken() public {
        ParkinsonRegistry bare = new ParkinsonRegistry(owner, oracle);
        ParkinsonRegistry.State memory s = bare.state();
        assertEq(s.token, address(0));
        assertEq(s.pool, 0);
    }

    // ---------------------------------------------------------------- fuzz

    function testFuzz_registerThenResolve(bytes32 hash, address who, uint8 group, uint8 axis, bool passed, int16 d, int16 r, uint32 no) public {
        vm.prank(who);
        registry.register(hash, "SNCA", group, axis);
        vm.prank(oracle);
        registry.resolve(hash, passed, d, r, no);
        ParkinsonRegistry.Prediction memory p = registry.prediction(hash);
        assertEq(p.predictor, who);
        assertEq(p.group, group);
        assertEq(p.axis, axis);
        assertEq(p.effectDiscovery, d);
        assertEq(p.effectReplication, r);
        assertEq(p.receiptNo, no);
        assertEq(uint8(p.status), uint8(passed ? ParkinsonRegistry.Status.Replicated : ParkinsonRegistry.Status.Failed));
    }

    function testFuzz_registerForAnyKey(uint256 key, bytes32 hash, uint8 group, uint8 axis) public {
        key = bound(key, 1, 115792089237316195423570985008687907852837564279074904382605163141518161494336);
        address who = vm.addr(key);
        registry.registerFor(hash, "GPNMB", group, axis, who, sign(key, hash, "GPNMB", group, axis));
        assertEq(registry.prediction(hash).predictor, who);
    }

    function testFuzz_anchorIsMonotonic(uint64 a, uint64 b) public {
        a = uint64(bound(a, 1, type(uint64).max));
        vm.startPrank(oracle);
        registry.anchor(a, H);
        if (b <= a) vm.expectRevert(ParkinsonRegistry.StaleCheckpoint.selector);
        registry.anchor(b, H2);
        vm.stopPrank();
        assertEq(registry.receiptHeadNo(), b > a ? b : a);
    }
}
