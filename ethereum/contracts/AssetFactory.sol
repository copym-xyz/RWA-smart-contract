// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ICrossChainBridge
 * @dev Interface for cross-chain identity and asset verification
 */
interface ICrossChainBridge {
    /**
     * @dev Verify identity across different blockchain networks
     * @param soulboundNFTContract Address of the SoulboundNFT contract
     * @param soulboundTokenId Token ID of the SoulboundNFT
     * @param chainId Blockchain network identifier
     * @return bool Verification status
     */
    function verifyIdentity(
        address soulboundNFTContract,
        uint256 soulboundTokenId,
        string memory chainId
    ) external view returns (bool);

    /**
     * @dev Relay asset creation request to another blockchain network
     * @param targetChainId Target blockchain network identifier
     * @param issuer Address of the asset issuer
     * @param name Name of the asset
     * @param symbol Symbol of the asset
     * @return bytes32 Unique request identifier
     */
    function relayAssetCreation(
        string memory targetChainId,
        address issuer,
        string memory name,
        string memory symbol
    ) external returns (bytes32);

    /**
     * @dev Get cross-chain identity mapping
     * @param did Decentralized Identifier
     * @param sourceChain Source blockchain network
     * @param targetChain Target blockchain network
     * @return address Mapped address on the target chain
     */
    function getChainIdentityMapping(
        string memory did,
        string memory sourceChain,
        string memory targetChain
    ) external view returns (address);

    /**
     * @dev Register cross-chain identity mapping
     * @param did Decentralized Identifier
     * @param sourceChain Source blockchain network
     * @param sourceAddress Source blockchain address
     * @param targetChain Target blockchain network
     * @param targetAddress Target blockchain address
     */
    function registerChainIdentityMapping(
        string memory did,
        string memory sourceChain,
        address sourceAddress,
        string memory targetChain,
        address targetAddress
    ) external;
}