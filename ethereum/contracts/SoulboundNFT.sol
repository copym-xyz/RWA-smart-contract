// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title SoulboundNFT
 * @dev Implementation of ERC-5484 Soulbound NFT with multi-chain identity capabilities
 */
contract SoulboundNFT is ERC721, ERC721URIStorage, AccessControl {
    using Counters for Counters.Counter;

    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant BRIDGE_ROLE = keccak256("BRIDGE_ROLE");
    
    Counters.Counter private _tokenIdCounter;
    
    // Struct to store token details
    struct TokenHierarchy {
        uint256 parentTokenId;
        address owner;
        string did;              // Decentralized Identifier
        string verifiableCredential; // JSON string containing verification data
        mapping(string => string) chainDetails; // chainId => address mapping
    }
    
    // Mapping from token ID to TokenHierarchy
    mapping(uint256 => TokenHierarchy) public tokenHierarchy;
    
    // Mapping from DID to token ID
    mapping(string => uint256) public didToTokenId;
    
    // Events
    event IdentityVerified(address indexed entity, uint256 tokenId, string did);
    event ChainIdentityAdded(uint256 tokenId, string chainId, string chainAddress);
    event CredentialUpdated(uint256 tokenId, string verifiableCredential);
    
    constructor() ERC721("SoulboundIdentity", "SOUL") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(VERIFIER_ROLE, msg.sender);
        _grantRole(BRIDGE_ROLE, msg.sender);
    }
    
    /**
     * @dev Verifies identity and mints a Soulbound NFT
     * @param entity Address to mint the token to
     * @param did Decentralized Identifier string
     * @param vc Verifiable Credential JSON string
     */
    function verifyIdentity(address entity, string memory did, string memory vc) 
        external 
        onlyRole(VERIFIER_ROLE) 
        returns (uint256)
    {
        require(bytes(did).length > 0, "DID cannot be empty");
        require(didToTokenId[did] == 0, "DID already exists");
        
        uint256 tokenId = _tokenIdCounter.current();
        _mint(entity, tokenId);
        
        TokenHierarchy storage newToken = tokenHierarchy[tokenId];
        newToken.parentTokenId = 0;
        newToken.owner = entity;
        newToken.did = did;
        newToken.verifiableCredential = vc;
        
        // Default to Ethereum mainnet with the current address
        newToken.chainDetails["eth-mainnet"] = _addressToString(entity);
        
        didToTokenId[did] = tokenId;
        
        _tokenIdCounter.increment();
        
        emit IdentityVerified(entity, tokenId, did);
        
        return tokenId;
    }
    
    /**
     * @dev Adds a chain-specific address to an existing identity
     * @param tokenId The token ID of the identity
     * @param chainId The chain identifier (e.g., "solana-mainnet")
     * @param chainAddress The address on the specified chain
     */
    function addChainIdentity(uint256 tokenId, string memory chainId, string memory chainAddress) 
        external 
    {
        require(_exists(tokenId), "Token does not exist");
        require(
            ownerOf(tokenId) == msg.sender || hasRole(BRIDGE_ROLE, msg.sender),
            "Not authorized"
        );
        require(bytes(chainId).length > 0, "Chain ID cannot be empty");
        require(bytes(chainAddress).length > 0, "Chain address cannot be empty");
        
        tokenHierarchy[tokenId].chainDetails[chainId] = chainAddress;
        
        emit ChainIdentityAdded(tokenId, chainId, chainAddress);
    }
    
    /**
     * @dev Updates the verifiable credential for an identity
     * @param tokenId The token ID of the identity
     * @param vc New Verifiable Credential JSON string
     */
    function updateCredential(uint256 tokenId, string memory vc) 
        external 
        onlyRole(VERIFIER_ROLE) 
    {
        require(_exists(tokenId), "Token does not exist");
        require(bytes(vc).length > 0, "VC cannot be empty");
        
        tokenHierarchy[tokenId].verifiableCredential = vc;
        
        emit CredentialUpdated(tokenId, vc);
    }
    
    /**
     * @dev Gets the chain-specific address for an identity
     * @param tokenId The token ID of the identity
     * @param chainId The chain identifier
     */
    function getChainAddress(uint256 tokenId, string memory chainId) 
        external 
        view 
        returns (string memory) 
    {
        require(_exists(tokenId), "Token does not exist");
        return tokenHierarchy[tokenId].chainDetails[chainId];
    }
    
    /**
     * @dev Gets the token ID for a DID
     * @param did The Decentralized Identifier
     */
    function getTokenIdByDid(string memory did) 
        external 
        view 
        returns (uint256) 
    {
        return didToTokenId[did];
    }
    
    /**
     * @dev Gets the DID for a token ID
     * @param tokenId The token ID
     */
    function getDidByTokenId(uint256 tokenId) 
        external 
        view 
        returns (string memory) 
    {
        require(_exists(tokenId), "Token does not exist");
        return tokenHierarchy[tokenId].did;
    }
    
    /**
     * @dev Gets the verifiable credential for a token ID
     * @param tokenId The token ID
     */
    function getVerifiableCredential(uint256 tokenId) 
        external 
        view 
        returns (string memory) 
    {
        require(_exists(tokenId), "Token does not exist");
        return tokenHierarchy[tokenId].verifiableCredential;
    }
    
    /**
     * @dev Verifies if a DID exists on a specific chain
     * @param did The Decentralized Identifier
     * @param chainId The chain identifier
     */
    function verifyDidOnChain(string memory did, string memory chainId) 
        external 
        view 
        returns (bool, string memory) 
    {
        uint256 tokenId = didToTokenId[did];
        if (tokenId == 0) {
            return (false, "");
        }
        
        string memory chainAddress = tokenHierarchy[tokenId].chainDetails[chainId];
        return (bytes(chainAddress).length > 0, chainAddress);
    }
    
    // Override functions to implement soulbound (non-transferable) behavior
    
    function _beforeTokenTransfer(address from, address to, uint256 tokenId, uint256 batchSize)
        internal
        override
    {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
        
        // Only allow minting, not transfers
        require(from == address(0) || to == address(0), "Token is soulbound");
    }
    
    function _burn(uint256 tokenId) 
        internal 
        override(ERC721, ERC721URIStorage) 
    {
        super._burn(tokenId);
        
        // Clean up the DID mapping
        string memory did = tokenHierarchy[tokenId].did;
        if (bytes(did).length > 0) {
            delete didToTokenId[did];
        }
    }
    
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
    
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }
    
    /**
     * @dev Converts an address to a string
     * @param addr The address to convert
     */
    function _addressToString(address addr) 
        internal 
        pure 
        returns (string memory) 
    {
        bytes memory addressBytes = abi.encodePacked(addr);
        bytes memory stringBytes = new bytes(42);
        
        stringBytes[0] = '0';
        stringBytes[1] = 'x';
        
        for (uint256 i = 0; i < 20; i++) {
            bytes1 char = addressBytes[i];
            bytes1 hi = bytes1(uint8(char) / 16);
            bytes1 lo = bytes1(uint8(char) - 16 * uint8(hi));
            
            stringBytes[2 + i*2] = _char(hi);
            stringBytes[2 + i*2 + 1] = _char(lo);
        }
        
        return string(stringBytes);
    }
    
    /**
     * @dev Converts a byte to its hex char representation
     * @param b The byte to convert
     */
    function _char(bytes1 b) 
        internal 
        pure 
        returns (bytes1) 
    {
        if (uint8(b) < 10) {
            return bytes1(uint8(b) + 0x30);
        } else {
            return bytes1(uint8(b) + 0x57);
        }
    }
}