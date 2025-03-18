// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title SoulboundNFT
 * @dev Implementation of a Soulbound NFT with enhanced credential management
 */
contract SoulboundNFT is ERC721, ERC721URIStorage, AccessControl {
    using Counters for Counters.Counter;
    using Strings for uint256;

    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant CREDENTIAL_MANAGER_ROLE = keccak256("CREDENTIAL_MANAGER_ROLE");
    Counters.Counter private _tokenIdCounter;
    
    // Credential status enum
    enum CredentialStatus { ACTIVE, SUSPENDED, REVOKED, EXPIRED }

    // Mapping for token data storage with privacy enhancements
    struct TokenHierarchy {
        uint256 parentId; // 0 for root tokens
        address owner;
        string did;
        bytes32 credentialHash; // Hash of the verifiable credential
        string credentialCID; // IPFS CID of the verifiable credential
        mapping(string => string) chainDetails; // mapping of chainId to address on that chain
        CredentialStatus status; // Current status of the credential
        uint256 expirationTime; // When the credential expires (0 for no expiration)
        mapping(bytes32 => bool) issuedCredentials; // Credentials issued to this identity
    }
    
    // Mapping tokenId to its hierarchy data
    mapping(uint256 => TokenHierarchy) public tokenHierarchy;
    
    // DID to tokenId mapping for lookup
    mapping(string => uint256) public didToTokenId;
    
    // Credential hash to validity mapping
    mapping(bytes32 => bool) public credentialValidity;
    
    // Controller mapping - which DID can control which other DIDs
    mapping(string => mapping(string => bool)) public didControllers;
    
    // Events
    event IdentityVerified(address indexed entity, uint256 indexed tokenId, string did, bytes32 credentialHash, string credentialCID);
    event ChainIdentityAdded(uint256 indexed tokenId, string chainId, string chainAddress);
    event CredentialUpdated(uint256 indexed tokenId, bytes32 newCredentialHash, string newCredentialCID);
    event CredentialStatusChanged(uint256 indexed tokenId, CredentialStatus newStatus);
    event CredentialIssued(string indexed issuerDid, string indexed subjectDid, bytes32 credentialHash);
    event DIDControllerAdded(string indexed did, string indexed controllerDid);
    event DIDControllerRemoved(string indexed did, string indexed controllerDid);

    constructor() ERC721("SoulboundIdentity", "SBID") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(VERIFIER_ROLE, msg.sender);
        _grantRole(CREDENTIAL_MANAGER_ROLE, msg.sender);
    }

    /**
     * @dev Creates a new Soulbound identity token for an entity after verification
     */
    function verifyIdentity(
        address entity,
        string memory did,
        bytes32 credentialHash,
        string memory credentialCID,
        uint256 expirationTime
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
        hierarchy.status = CredentialStatus.ACTIVE;
        hierarchy.expirationTime = expirationTime;
        
        // Add the mapping from DID to tokenId
        didToTokenId[did] = tokenId;
        
        // Set credential as valid
        credentialValidity[credentialHash] = true;
        
        // Add current chain mapping
        string memory currentChainId = _getCurrentChainId();
        hierarchy.chainDetails[currentChainId] = Strings.toHexString(uint256(uint160(entity)), 20);
        
        _tokenIdCounter.increment();
        
        emit IdentityVerified(entity, tokenId, did, credentialHash, credentialCID);
    }

    /**
     * @dev Adds a chain identity mapping for cross-chain operations
     */
    function addChainIdentity(
        uint256 tokenId,
        string memory chainId,
        string memory chainAddress
    ) external {
        require(_exists(tokenId), "Token does not exist");
        require(ownerOf(tokenId) == msg.sender || hasRole(CREDENTIAL_MANAGER_ROLE, msg.sender), 
                "Not authorized");
        
        TokenHierarchy storage hierarchy = tokenHierarchy[tokenId];
        hierarchy.chainDetails[chainId] = chainAddress;
        
        emit ChainIdentityAdded(tokenId, chainId, chainAddress);
    }

    /**
     * @dev Updates the credential status
     */
    function updateCredentialStatus(
        uint256 tokenId,
        CredentialStatus newStatus
    ) external onlyRole(CREDENTIAL_MANAGER_ROLE) {
        require(_exists(tokenId), "Token does not exist");
        
        TokenHierarchy storage hierarchy = tokenHierarchy[tokenId];
        hierarchy.status = newStatus;
        
        // If revoked, invalidate the credential
        if (newStatus == CredentialStatus.REVOKED) {
            credentialValidity[hierarchy.credentialHash] = false;
        }
        
        emit CredentialStatusChanged(tokenId, newStatus);
    }

    /**
     * @dev Updates the verifiable credential for a token
     */
    function updateCredential(
        uint256 tokenId,
        bytes32 newCredentialHash,
        string memory newCredentialCID,
        uint256 expirationTime
    ) external onlyRole(VERIFIER_ROLE) {
        require(_exists(tokenId), "Token does not exist");
        
        TokenHierarchy storage hierarchy = tokenHierarchy[tokenId];
        
        // Invalidate old credential
        credentialValidity[hierarchy.credentialHash] = false;
        
        // Update with new credential
        hierarchy.credentialHash = newCredentialHash;
        hierarchy.credentialCID = newCredentialCID;
        hierarchy.expirationTime = expirationTime;
        
        // Set new credential as valid
        credentialValidity[newCredentialHash] = true;
        
        emit CredentialUpdated(tokenId, newCredentialHash, newCredentialCID);
    }

    /**
     * @dev Issues a credential from one identity to another
     */
    function issueCredential(
        string memory issuerDid,
        string memory subjectDid,
        bytes32 credentialHash
    ) external {
        uint256 issuerTokenId = didToTokenId[issuerDid];
        uint256 subjectTokenId = didToTokenId[subjectDid];
        
        require(issuerTokenId > 0, "Issuer DID not found");
        require(subjectTokenId > 0, "Subject DID not found");
        require(
            ownerOf(issuerTokenId) == msg.sender || hasRole(CREDENTIAL_MANAGER_ROLE, msg.sender),
            "Not authorized to issue credentials"
        );
        
        // Add credential to subject's issued credentials
        tokenHierarchy[subjectTokenId].issuedCredentials[credentialHash] = true;
        
        // Set credential as valid
        credentialValidity[credentialHash] = true;
        
        emit CredentialIssued(issuerDid, subjectDid, credentialHash);
    }

    /**
     * @dev Verifies if a credential is valid
     */
    function verifyCredential(bytes32 credentialHash) external view returns (bool) {
        return credentialValidity[credentialHash];
    }

    /**
     * @dev Gets the current status of a credential
     */
    function getCredentialStatus(uint256 tokenId) external view returns (CredentialStatus) {
        require(_exists(tokenId), "Token does not exist");
        return tokenHierarchy[tokenId].status;
    }

    /**
     * @dev Checks if a credential has expired
     */
    function isCredentialExpired(uint256 tokenId) external view returns (bool) {
        require(_exists(tokenId), "Token does not exist");
        uint256 expirationTime = tokenHierarchy[tokenId].expirationTime;
        
        // 0 means no expiration
        if (expirationTime == 0) return false;
        
        return block.timestamp > expirationTime;
    }

    /**
     * @dev Adds a controller for a DID
     */
    function addDIDController(string memory did, string memory controllerDid) external {
        uint256 tokenId = didToTokenId[did];
        require(tokenId > 0, "DID not found");
        require(
            ownerOf(tokenId) == msg.sender || hasRole(CREDENTIAL_MANAGER_ROLE, msg.sender),
            "Not authorized"
        );
        
        didControllers[did][controllerDid] = true;
        emit DIDControllerAdded(did, controllerDid);
    }

    /**
     * @dev Removes a controller for a DID
     */
    function removeDIDController(string memory did, string memory controllerDid) external {
        uint256 tokenId = didToTokenId[did];
        require(tokenId > 0, "DID not found");
        require(
            ownerOf(tokenId) == msg.sender || hasRole(CREDENTIAL_MANAGER_ROLE, msg.sender),
            "Not authorized"
        );
        
        didControllers[did][controllerDid] = false;
        emit DIDControllerRemoved(did, controllerDid);
    }

    /**
     * @dev Checks if a DID is controlled by another DID
     */
    function isControlledBy(string memory did, string memory controllerDid) external view returns (bool) {
        return didControllers[did][controllerDid];
    }

    /**
     * @dev Get the chain address for a specific token and chain
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
     */
    function getDID(uint256 tokenId) external view returns (string memory) {
        require(_exists(tokenId), "Token does not exist");
        return tokenHierarchy[tokenId].did;
    }

    /**
     * @dev Get the token ID for a specific DID
     */
    function getTokenIdByDID(string memory did) external view returns (uint256) {
        uint256 tokenId = didToTokenId[did];
        require(tokenId != 0, "DID not found");
        return tokenId;
    }

    /**
     * @dev Get the credential hash for a specific token
     */
    function getCredentialHash(uint256 tokenId) external view returns (bytes32) {
        require(_exists(tokenId), "Token does not exist");
        return tokenHierarchy[tokenId].credentialHash;
    }
    
    /**
     * @dev Get the credential CID for a specific token
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