// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {ParkinsonRegistry} from "../src/ParkinsonRegistry.sol";
import {ParkinsonTestToken} from "../src/ParkinsonTestToken.sol";

/// Deploys the registry, and on a testnet the test token with its whole supply in the registry's pool.
///   ORACLE   the server's signer (default: the deployer, the one-wallet testnet setup)
///   OWNER    who ends up owning the registry, e.g. a Safe; it must call acceptOwnership() (default: the deployer)
///   REWARD   test tokens per replicated wallet prediction (default 50); FAUCET per drip (default 250)
/// Mainnet (chain 4663) never gets a test token, so rewards and the faucet start off there.
contract Deploy is Script {
    uint256 internal constant MAINNET = 4663;

    function run() external returns (ParkinsonRegistry registry, ParkinsonTestToken token) {
        address deployer = msg.sender;
        address oracle = vm.envOr("ORACLE", deployer);
        address owner = vm.envOr("OWNER", deployer);
        bool testToken = block.chainid != MAINNET && vm.envOr("TEST_TOKEN", true);

        vm.startBroadcast();
        registry = new ParkinsonRegistry(deployer, oracle);
        if (testToken) {
            token = new ParkinsonTestToken(address(registry), 1_000_000_000 ether);
            registry.configure(token, uint128(vm.envOr("REWARD", uint256(50)) * 1 ether), uint128(vm.envOr("FAUCET", uint256(250)) * 1 ether));
        }
        if (owner != deployer) registry.transferOwnership(owner);
        vm.stopBroadcast();

        console.log("chain     ", block.chainid);
        console.log("registry  ", address(registry));
        console.log("test token", address(token));
        console.log("oracle    ", oracle);
        console.log("owner     ", owner == deployer ? deployer : owner, owner == deployer ? "" : "(pending: it must call acceptOwnership)");
    }
}
