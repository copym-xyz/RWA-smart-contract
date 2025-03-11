// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

/**
 * @title ICrossChainBridge
 * @dev Interface for the cross-chain bridge contract
 */
interface ICrossChainBridge {
    /**
     * @dev Enum for supported blockchain networks
     */
    enum Network {
        Ethereum,
        Solana,
        Polygon
    }
    
    /**
     * @dev Event emitted when a cross-chain identity is verified
     */
    event IdentityVerified(address indexed soulboundNFT, uint256 indexed tokenId, string chainId);
    
    /**
     * @dev Event emitted when asset creation is relayed to another chain
     */
    event AssetCreationRelayed(string targetChain, address issuer, string name, string symbol);
    
    /**
     * @dev Verifies an identity across chains
     * @param soulboundNFT Address of the SoulboundNFT contract
     * @param tokenId The token ID to verify
     * @param chainId The target chain ID
     * @return isValid Boolean indicating if the identity is valid
     */
    function verifyIdentity(address soulboundNFT, uint256 tokenId, string calldata chainId) 
        external 
        returns (bool);
    
    /**
     * @dev Relays asset creation to another chain
     * @param targetChainId The target chain identifier
     * @param issuer The issuer address
     * @param name Asset name
     * @param symbol Asset symbol
     */
    function relayAssetCreation(
        string calldata targetChainId,
        address issuer,
        string calldata name,
        string calldata symbol
    ) external;
    
    /**
     * @dev Sets a validator for a specific chain
     * @param chainId The chain identifier
     * @param validator The validator address
     */
    function setChainValidator(string calldata chainId, address validator) external;
}