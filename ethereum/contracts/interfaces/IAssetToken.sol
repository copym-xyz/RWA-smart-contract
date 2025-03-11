// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

// interfaces/ISoulboundNFT.sol
interface ISoulboundNFT {
    function ownerOf(uint256 tokenId) external view returns (address);
    function getChainAddress(uint256 tokenId, string memory chainId) external view returns (string memory);
    function getTokenIdByDid(string memory did) external view returns (uint256);
    function getDidByTokenId(uint256 tokenId) external view returns (string memory);
    function getVerifiableCredential(uint256 tokenId) external view returns (string memory);
    function verifyDidOnChain(string memory did, string memory chainId) external view returns (bool, string memory);
}

// interfaces/ICrossChainBridge.sol
interface ICrossChainBridge {
    function verifyIdentity(address soulboundContract, uint256 tokenId, string calldata chainId) external view returns (bool);
    function relayAssetCreation(string calldata targetChainId, address issuer, string calldata name, string calldata symbol) external returns (bytes32);
    function requestIdentityVerification(string calldata did, string calldata targetChainId, string calldata targetAddress) external returns (bytes32);
    function markRequestProcessed(bytes32 requestId) external;
}

// interfaces/IAssetFactory.sol
interface IAssetFactory {
    function createAssetCrossChain(address issuer, string memory name, string memory symbol, string memory chainId, uint256 soulboundTokenId) external returns (address);
    function signalCrossChainAssetCreation(address issuer, string memory name, string memory symbol, string memory targetChainId, uint256 soulboundTokenId) external returns (bytes32);
    function getAssetAddress(address issuer, string memory symbol) external view returns (address);
}

// interfaces/IAssetToken.sol
interface IAssetToken {
    function initialize(string memory name_, string memory symbol_, address issuer_) external;
    function mint(address to, uint256 amount) external;
    function burn(uint256 amount) external;
    function setTokenMetadata(string memory metadata) external;
    function addMinter(address minter) external;
    function addBurner(address burner) external;
    function removeMinter(address minter) external;
    function removeBurner(address burner) external;
}