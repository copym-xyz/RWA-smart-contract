// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IBridge
 * @dev Interface for cross-chain bridge operations
 */
interface IBridge {
    /**
     * @dev Verify identity across chains
     * @param soulboundContract Address of the SoulboundNFT contract
     * @param tokenId Token ID to verify
     * @param targetChain Target chain for verification
     * @return Whether the identity was verified
     */
    function verifyIdentity(
        address soulboundContract, 
        uint256 tokenId, 
        string memory targetChain
    ) external returns (bool);
    
    /**
     * @dev Send a message to another chain
     * @param targetChain Target chain for the message
     * @param data The message data
     */
    function sendCrossChainMessage(
        string memory targetChain, 
        bytes memory data
    ) external;
    
    /**
     * @dev Relay asset creation to another chain
     * @param targetChain Target chain ID
     * @param issuer Address of the issuer
     * @param name Asset name
     * @param symbol Asset symbol
     */
    function relayAssetCreation(
        string memory targetChain,
        address issuer,
        string memory name,
        string memory symbol
    ) external;
}