// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ISoulboundNFT
 * @dev Interface for SoulboundNFT contract with credential management
 */
interface ISoulboundNFT {
    function ownerOf(uint256 tokenId) external view returns (address);
    function getDID(uint256 tokenId) external view returns (string memory);
    function getTokenIdByDID(string memory did) external view returns (uint256);
    function getChainAddress(uint256 tokenId, string memory chainId) external view returns (string memory);
    function getTokenCredentials(uint256 tokenId) external view returns (bytes32[] memory);
    function isCredentialValid(uint256 tokenId, bytes32 credentialHash) external view returns (bool);
    function getCredentialHash(uint256 tokenId) external view returns (bytes32);
    function getCredentialCID(uint256 tokenId) external view returns (string memory);
}