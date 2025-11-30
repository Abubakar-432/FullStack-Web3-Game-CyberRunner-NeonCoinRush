// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

interface IHoverboardNFT {
    function balanceOf(address owner) external view returns (uint256);
    function transferFrom(address from, address to, uint256 tokenId) external;
}

contract NeonCoin is ERC20, ERC20Burnable, AccessControl {
    bytes32 public constant GAME_MASTER_ROLE = keccak256("GAME_MASTER_ROLE");
    IHoverboardNFT public hoverboardContract;

    mapping(address => uint256) public consecutiveFails;
    mapping(address => uint256) public winStreak;
    mapping(address => bool) public hasShield; 
    mapping(address => bool) public hasMagnet; 

    uint256 public constant RUN_REWARD = 10 * 10**18; 
    uint256 public constant SHIELD_PRICE = 15 * 10**18; 
    uint256 public constant MAGNET_PRICE = 20 * 10**18; 

    event RunCompleted(address indexed player, uint256 reward, uint256 multiplier);
    event RunFailed(address indexed player, uint256 burnedAmount, uint256 failCount);
    event PowerUpPurchased(address indexed player, string item);

    constructor() ERC20("NeonCoin", "NNC") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(GAME_MASTER_ROLE, msg.sender);
    }

    function setHoverboardAddress(address _nftAddress) external onlyRole(DEFAULT_ADMIN_ROLE) {
        hoverboardContract = IHoverboardNFT(_nftAddress);
    }

    // --- STRICT CONSUMPTION LOGIC ---

    function completeRun(address player, uint256 coinsCollected) external onlyRole(GAME_MASTER_ROLE) {
        consecutiveFails[player] = 0;
        winStreak[player] += 1;
        uint256 multiplier = 1;
        if (winStreak[player] >= 3) multiplier = 2; 

        if (address(hoverboardContract) != address(0)) {
            if (hoverboardContract.balanceOf(player) > 0) multiplier += 1; 
        }

        // CONSUME MAGNET (Use it once for bonus, then it's gone)
        uint256 magnetBonus = 0;
        if (hasMagnet[player]) {
            magnetBonus = 5 * 10**18; 
            hasMagnet[player] = false; // Gone after 1 run (Win)
        }

        // SHIELD PERSISTS ON WIN (You didn't crash, so you keep it)
        // No code needed here, just don't set it to false.

        uint256 coinReward = (coinsCollected * 10**18) / 4; 
        uint256 totalReward = ((RUN_REWARD + coinReward) * multiplier) + magnetBonus;
        _mint(player, totalReward);
        emit RunCompleted(player, totalReward, multiplier);
    }

    function failRun(address player) external onlyRole(GAME_MASTER_ROLE) {
        // CONSUME MAGNET (Wasted on crash)
        if (hasMagnet[player]) {
            hasMagnet[player] = false; 
        }

        // CONSUME SHIELD (Saved you from crash)
        if (hasShield[player]) {
            hasShield[player] = false; // Consumed to save you
            return; // Exit early (No burn, no streak reset)
        }

        winStreak[player] = 0;
        consecutiveFails[player] += 1;
        uint256 fails = consecutiveFails[player];
        uint256 balance = balanceOf(player);
        if (balance == 0) return;

        uint256 burnAmount;
        if (fails >= 5) burnAmount = balance; 
        else burnAmount = (balance * (fails * 20)) / 100;

        _burn(player, burnAmount);
        emit RunFailed(player, burnAmount, fails);
    }

    function buyShield() external {
        require(balanceOf(msg.sender) >= SHIELD_PRICE, "Need 15 NNC");
        _burn(msg.sender, SHIELD_PRICE);
        hasShield[msg.sender] = true;
        emit PowerUpPurchased(msg.sender, "Shield");
    }

    function buyMagnet() external {
        require(balanceOf(msg.sender) >= MAGNET_PRICE, "Need 20 NNC");
        _burn(msg.sender, MAGNET_PRICE);
        hasMagnet[msg.sender] = true;
        emit PowerUpPurchased(msg.sender, "Magnet");
    }
}