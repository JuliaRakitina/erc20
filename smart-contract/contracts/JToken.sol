// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract JToken is ERC20, Ownable {
    uint8 private constant _decimals = 18;

    constructor(uint256 initialSupply)
    ERC20("JToken", "JTK")
    Ownable(msg.sender)
    {
        _mint(msg.sender, initialSupply * (10 ** uint256(_decimals)));
    }

    function decimals() public pure override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
