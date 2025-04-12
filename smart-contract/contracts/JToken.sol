// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract JToken is ERC20 {
    uint8 private constant _decimals = 18;

    constructor(uint256 initialSupply) ERC20("JToken", "JTK") {
        _mint(msg.sender, initialSupply * (10 ** uint256(_decimals)));
    }

    function decimals() public pure override returns (uint8) {
        return _decimals;
    }
}
