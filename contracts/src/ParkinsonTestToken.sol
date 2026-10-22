// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title tPARKINSON, the testnet token
/// @notice A fixed supply minted once to the registry, which pays the faucet and the rewards from it. It has no value and
/// is never deployed on mainnet; the $PARKINSON token is a separate thing.
contract ParkinsonTestToken is ERC20 {
    constructor(address to, uint256 supply) ERC20("parkinson test token", "tPARKINSON") {
        _mint(to, supply);
    }
}
