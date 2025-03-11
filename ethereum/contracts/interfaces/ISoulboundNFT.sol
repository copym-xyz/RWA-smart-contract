// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/**
 * @title ISoulboundNFT
 * @dev Interface for SoulboundNFT defining core functionality
 */
interface ISoulboundNFT is IERC721 {
    /**
     * @dev Struct representing token hierarchy and identity details
     */
    struct TokenHierarchy {
        uint256 parentTokenId;
        address owner;
        string did;
        string verifiableCredentials;
    }

    /**
     * @dev Verify and mint identity token
     * @param entity Address of the identity owner
     * @param did Decentralized Identifier
     * @param vc Verifiable Credentials
     */
    function verifyIdentity(
        address entity, 
        string memory did, 
        string memory vc
    ) external;

    /**
     * @dev Add cross-chain identity mapping
     * @param tokenId ID of the existing token
     * @param chainName Name of the blockchain
     * @param chainAddress Address on the specified blockchain
     */
    function addChainIdentity(
        uint256 tokenId, 
        string memory chainName, 
        string memory chainAddress
    ) external;

    /**
     * @dev Get the Decentralized Identifier (DID) for a token
     * @param tokenId ID of the token
     * @return The DID associated with the token
     */
    function getTokenDID(uint256 tokenId) external view returns (string memory);

    /**
     * @dev Get the chain-specific identity for a token
     * @param tokenId ID of the token
     * @param chainName Name of the blockchain
     * @return The address associated with the specified chain
     */
    function getChainIdentity(
        uint256 tokenId, 
        string memory chainName
    ) external view returns (string memory);

    /**
     * @dev Enum defining burn authorization levels
     */
    enum BurnAuth {
        IssuerOnly,
        OwnerOnly,
        Both,
        Neither
    }

    /**
     * @dev Get burn authorization for a specific token
     * @param tokenId ID of the token
     * @return The burn authorization level
     */
    function burnAuth(uint256 tokenId) external view returns (BurnAuth);
}