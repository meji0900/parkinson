// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {ParkinsonRegistry} from "../src/ParkinsonRegistry.sol";
import {ParkinsonTestToken} from "../src/ParkinsonTestToken.sol";

/// Deploys the registry, and on a testnet the test token with its whole supply in the registry's pool.
///   ORACLE   the server's signer (default: the deployer, the one-wallet testnet setup)
///   OWNER    who ends up owning the registry, e.g. a Safe; it must call acceptOwnership() (default: the deployer)
///   REWARD   test tokens per replicated wallet prediction (default 50); FAUCET per drip (default 250)
///   FUND_ORACLE  wei the deployer sends the oracle for gas in the same run (default none)
/// Mainnet (chain 4663) never gets a test token, so rewards and the faucet start off there.
contract Deploy is Script {
    uint256 internal constant MAINNET = 4663;

    function run() external returns (ParkinsonRegistry registry, ParkinsonTestToken token) {
        // with --account or --keystore the script itself runs from Foundry's default sender, so the deployer is the
        // wallet given on the command line; with --unlocked --sender it is msg.sender
        address[] memory wallets = vm.getWallets();
        address deployer = wallets.length > 0 ? wallets[0] : msg.sender;
        address oracle = vm.envOr("ORACLE", deployer);
        address owner = vm.envOr("OWNER", deployer);
        bool testToken = block.chainid != MAINNET && vm.envOr("TEST_TOKEN", true);

        vm.startBroadcast(deployer);
        registry = new ParkinsonRegistry(deployer, oracle);
        if (testToken) {
            token = new ParkinsonTestToken(address(registry), 1_000_000_000 ether);
            registry.configure(token, uint128(vm.envOr("REWARD", uint256(50)) * 1 ether), uint128(vm.envOr("FAUCET", uint256(250)) * 1 ether));
        }
        if (owner != deployer) registry.transferOwnership(owner);
        uint256 fund = vm.envOr("FUND_ORACLE", uint256(0));
        if (fund > 0 && oracle != deployer) payable(oracle).transfer(fund);
        vm.stopBroadcast();

        console.log("chain     ", block.chainid);
        console.log("registry  ", address(registry));
        console.log("test token", address(token));
        console.log("oracle    ", oracle);
        console.log("owner     ", owner == deployer ? deployer : owner, owner == deployer ? "" : "(pending: it must call acceptOwnership)");
    }
}
