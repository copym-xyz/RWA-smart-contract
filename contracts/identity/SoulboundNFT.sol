// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title SoulboundNFT
 * @dev Implementation of a Soulbound NFT based on ERC721 that cannot be transferred after minting
 * Implements EIP-5484 for Soulbound tokens with privacy enhancements
 */
contract SoulboundNFT is ERC721, ERC721URIStorage, AccessControl {
    using Counters for Counters.Counter;
    using Strings for uint256;

    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    Counters.Counter private _tokenIdCounter;
   
    // Mapping for token data storage with privacy enhancements
    struct TokenHierarchy {
        uint256 parentId; // 0 for root tokens
        address owner;
        string did;
        bytes32 credentialHash; // Hash of the verifiable credential instead of raw data
        string credentialCID; // IPFS CID of the verifiable credential
        mapping(string => string) chainDetails; // mapping of chainId to address on that chain
    }
   
    // Mapping tokenId to its hierarchy data
    mapping(uint256 => TokenHierarchy) public tokenHierarchy;
   
    // DID to tokenId mapping for lookup
    mapping(string => uint256) public didToTokenId;
   
    // Events
    event IdentityVerified(address indexed entity, uint256 indexed tokenId, string did, bytes32 credentialHash, string credentialCID);
    event ChainIdentityAdded(uint256 indexed tokenId, string chainId, string chainAddress);
    event CredentialUpdated(uint256 indexed tokenId, bytes32 newCredentialHash, string newCredentialCID);

    constructor() ERC721("SoulboundIdentity", "SBID") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(VERIFIER_ROLE, msg.sender);
    }

    /**
     * @dev Creates a new Soulbound identity token for an entity after verification
     * @param entity Address receiving the soulbound token
     * @param did Decentralized Identifier string
     * @param credentialHash Hash of the verifiable credential stored on IPFS
     * @param credentialCID IPFS CID of the verifiable credential
     */
    function verifyIdentity(
        address entity,
        string memory did,
        bytes32 credentialHash,
        string memory credentialCID
    ) external onlyRole(VERIFIER_ROLE) {
        require(bytes(did).length > 0, "DID cannot be empty");
        require(didToTokenId[did] == 0, "DID already exists");
       
        uint256 tokenId = _tokenIdCounter.current();
        _safeMint(entity, tokenId);
       
        // Initialize the token hierarchy
        TokenHierarchy storage hierarchy = tokenHierarchy[tokenId];
        hierarchy.parentId = 0;
        hierarchy.owner = entity;
        hierarchy.did = did;
        hierarchy.credentialHash = credentialHash;
        hierarchy.credentialCID = credentialCID;
       
        // Add the mapping from DID to tokenId
        didToTokenId[did] = tokenId;
       
        // Add current chain mapping
        string memory currentChainId = _getCurrentChainId();
        hierarchy.chainDetails[currentChainId] = Strings.toHexString(uint256(uint160(entity)), 20);
       
        _tokenIdCounter.increment();
       
        emit IdentityVerified(entity, tokenId, did, credentialHash, credentialCID);
    }

    /**
     * @dev Adds a chain identity mapping for cross-chain operations
     * @param tokenId ID of the token to update
     * @param chainId ID of the target chain
     * @param chainAddress Address on the target chain
     */
    function addChainIdentity(
        uint256 tokenId,
        string memory chainId,
        string memory chainAddress
    ) external {
        require(_exists(tokenId), "Token does not exist");
        require(ownerOf(tokenId) == msg.sender, "Not the token owner");
       
        TokenHierarchy storage hierarchy = tokenHierarchy[tokenId];
        hierarchy.chainDetails[chainId] = chainAddress;
       
        emit ChainIdentityAdded(tokenId, chainId, chainAddress);
    }

    /**
     * @dev Updates the verifiable credential for a token
     * @param tokenId ID of the token to update
     * @param newCredentialHash New hash of the verifiable credential
     * @param newCredentialCID New IPFS CID of the verifiable credential
     */
    function updateCredential(
        uint256 tokenId,
        bytes32 newCredentialHash,
        string memory newCredentialCID
    ) external onlyRole(VERIFIER_ROLE) {
        require(_exists(tokenId), "Token does not exist");
       
        TokenHierarchy storage hierarchy = tokenHierarchy[tokenId];
        hierarchy.credentialHash = newCredentialHash;
        hierarchy.credentialCID = newCredentialCID;
       
        emit CredentialUpdated(tokenId, newCredentialHash, newCredentialCID);
    }

    /**
     * @dev Get the chain address for a specific token and chain
     * @param tokenId ID of the token
     * @param chainId ID of the chain to query
     * @return The address on the specified chain
     */
    function getChainAddress(
        uint256 tokenId,
        string memory chainId
    ) external view returns (string memory) {
        require(_exists(tokenId), "Token does not exist");
        return tokenHierarchy[tokenId].chainDetails[chainId];
    }

    /**
     * @dev Get the DID for a specific token
     * @param tokenId ID of the token
     * @return The DID associated with the token
     */
    function getDID(uint256 tokenId) external view returns (string memory) {
        require(_exists(tokenId), "Token does not exist");
        return tokenHierarchy[tokenId].did;
    }

    /**
     * @dev Get the token ID for a specific DID
     * @param did The DID to query
     * @return The token ID associated with the DID
     */
    function getTokenIdByDID(string memory did) external view returns (uint256) {
        uint256 tokenId = didToTokenId[did];
        require(tokenId != 0, "DID not found");
        return tokenId;
    }

    /**
     * @dev Get the credential hash for a specific token
     * @param tokenId ID of the token
     * @return The credential hash associated with the token
     */
    function getCredentialHash(uint256 tokenId) external view returns (bytes32) {
        require(_exists(tokenId), "Token does not exist");
        return tokenHierarchy[tokenId].credentialHash;
    }
    
    /**
     * @dev Get the credential CID for a specific token
     * @param tokenId ID of the token
     * @return The IPFS CID of the credential associated with the token
     */
    function getCredentialCID(uint256 tokenId) external view returns (string memory) {
        require(_exists(tokenId), "Token does not exist");
        return tokenHierarchy[tokenId].credentialCID;
    }

    /**
     * @dev Override transfer functions to implement the soulbound property
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 firstTokenId,
        uint256 batchSize
    ) internal override(ERC721) {
        super._beforeTokenTransfer(from, to, firstTokenId, batchSize);
       
        // If this is not a mint, prevent transfer
        if (from != address(0)) {
            revert("SoulboundNFT: token transfer is not allowed");
        }
    }

    /**
     * @dev Helper function to get current chain ID
     */
    function _getCurrentChainId() internal view returns (string memory) {
        uint256 id;
        assembly {
            id := chainid()
        }
        return id.toString();
    }

    // Override required functions
    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }

    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}