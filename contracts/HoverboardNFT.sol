// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol"; // Added Burnable for completeness

interface INeonCoin {
    // We only need the transferFrom function to take payment
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
}

contract HoverboardNFT is ERC721, ERC721Burnable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    // This address stores the NeonCoin contract address
    INeonCoin public neonCoin;
    
    // Price of the NFT (30 NNC)
    uint256 public constant MINT_PRICE = 30 * 10**18; 

    // Constructor requires the address of the NeonCoin token
    constructor(address _neonCoinAddress) ERC721("CyberBoard", "CYBR") {
        neonCoin = INeonCoin(_neonCoinAddress);
    }

    function mintBoard() external returns (uint256) {
        // This fails if the user hasn't approved THIS contract yet.
        // It transfers 30 NNC from the user (msg.sender) to this NFT contract's address.
        bool success = neonCoin.transferFrom(msg.sender, address(this), MINT_PRICE);
        require(success, "Payment failed: Need 30 NNC");

        _tokenIds.increment();
        uint256 newItemId = _tokenIds.current();
        _safeMint(msg.sender, newItemId);
        return newItemId;
    }
}