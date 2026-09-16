// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title JToken local demo token
/// @author Julia Rakitina
/// @notice An 18-decimal ERC-20 with owner-authorized minting for local demos.
contract JToken is ERC20, Ownable {
    /// @notice Creates the token and assigns the initial supply to its owner.
    /// @param initialOwner Account authorized to mint tokens.
    /// @param initialSupplyBaseUnits Initial supply in the smallest token unit.
    constructor(
        address initialOwner,
        uint256 initialSupplyBaseUnits
    ) ERC20("JToken", "JTK") Ownable(initialOwner) {
        _mint(initialOwner, initialSupplyBaseUnits);
    }

    /// @notice Mints additional tokens to the recipient, callable by the owner.
    /// @param to Recipient of the new tokens.
    /// @param amount Number of base units to mint.
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
