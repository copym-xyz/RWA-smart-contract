// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/ISoulboundNFT.sol";

/**
 * @title CrossChainBridge
 * @dev Bridge contract for handling cross-chain identity verification and asset creation
 */
contract CrossChainBridge is AccessControl {
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");
    bytes32 public constant SERVICE_ROLE = keccak256("SERVICE_ROLE");
    
    address public soulboundNFTContract;
    
    // Mapping of supported chains
    mapping(string => bool) public supportedChains;
    
    // Mapping for tracking cross-chain requests
    mapping(bytes32 => bool) public processedRequests;
    
    // Events
    event AssetCreationRequested(
        bytes32 requestId,
        string targetChain,
        address issuer,
        string name,
        string symbol
    );
    
    event IdentityVerificationRequested(
        bytes32 requestId,
        string sourceDid,
        string targetChain,
        string targetAddress
    );
    
    event RequestProcessed(bytes32 requestId);
    
    constructor(address _soulboundNFTContract) {
        soulboundNFTContract = _soulboundNFTContract;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(RELAYER_ROLE, msg.sender);
        _grantRole(SERVICE_ROLE, msg.sender);
        
        // Add default supported chains
        supportedChains["eth-mainnet"] = true;
        supportedChains["eth-goerli"] = true;
        supportedChains["solana-mainnet"] = true;
        supportedChains["solana-devnet"] = true;
        supportedChains["polygon-mainnet"] = true;
        supportedChains["polygon-mumbai"] = true;
    }
    
    /**
     * @dev Set the SoulboundNFT contract address
     * @param _soulboundNFTContract The new contract address
     */
    function setSoulboundNFTContract(address _soulboundNFTContract) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(_soulboundNFTContract != address(0), "Invalid address");
        soulboundNFTContract = _soulboundNFTContract;
    }
    
    /**
     * @dev Add or remove supported chains
     * @param chainId The chain identifier
     * @param supported Whether the chain is supported
     */
    function setChainSupport(string calldata chainId, bool supported) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        supportedChains[chainId] = supported;
    }
    
    /**
     * @dev Verify a user's identity on a specified chain
     * @param soulboundContract The SoulboundNFT contract
     * @param tokenId The token ID of the identity
     * @param chainId The chain identifier
     */
    function verifyIdentity(
        address soulboundContract,
        uint256 tokenId,
        string calldata chainId
    ) 
        external 
        view 
        returns (bool) 
    {
        require(supportedChains[chainId], "Chain not supported");
        require(soulboundContract == soulboundNFTContract, "Invalid contract");
        
        ISoulboundNFT soulbound = ISoulboundNFT(soulboundContract);
        require(soulbound.ownerOf(tokenId) == msg.sender, "Not the owner");
        
        string memory chainAddress = soulbound.getChainAddress(tokenId, chainId);
        return bytes(chainAddress).length > 0;
    }
    
    /**
     * @dev Relay asset creation to another chain
     * @param targetChainId The target chain identifier
     * @param issuer The address of the issuer on the current chain
     * @param name The name of the asset
     * @param symbol The symbol of the asset
     */
    function relayAssetCreation(
        string calldata targetChainId,
        address issuer,
        string calldata name,
        string calldata symbol
    ) 
        external 
        onlyRole(SERVICE_ROLE) 
        returns (bytes32) 
    {
        require(supportedChains[targetChainId], "Chain not supported");
        
        bytes32 requestId = keccak256(
            abi.encodePacked(targetChainId, issuer, name, symbol, block.timestamp)
        );
        
        require(!processedRequests[requestId], "Request already processed");
        
        processedRequests[requestId] = true;
        
        emit AssetCreationRequested(requestId, targetChainId, issuer, name, symbol);
        
        return requestId;
    }
    
    /**
     * @dev Request identity verification across chains
     * @param did The Decentralized Identifier
     * @param targetChainId The target chain identifier
     * @param targetAddress The address on the target chain
     */
    function requestIdentityVerification(
        string calldata did,
        string calldata targetChainId,
        string calldata targetAddress
    ) 
        external 
        returns (bytes32) 
    {
        require(supportedChains[targetChainId], "Chain not supported");
        
        ISoulboundNFT soulbound = ISoulboundNFT(soulboundNFTContract);
        uint256 tokenId = soulbound.getTokenIdByDid(did);
        require(tokenId > 0, "DID not found");
        require(soulbound.ownerOf(tokenId) == msg.sender, "Not the owner");
        
        bytes32 requestId = keccak256(
            abi.encodePacked(did, targetChainId, targetAddress, block.timestamp)
        );
        
        require(!processedRequests[requestId], "Request already processed");
        
        processedRequests[requestId] = true;
        
        emit IdentityVerificationRequested(requestId, did, targetChainId, targetAddress);
        
        return requestId;
    }
    
    /**
     * @dev Mark a request as processed (called by relayer)
     * @param requestId The ID of the request
     */
    function markRequestProcessed(bytes32 requestId) 
        external 
        onlyRole(RELAYER_ROLE) 
    {
        require(processedRequests[requestId], "Request not found");
        
        emit RequestProcessed(requestId);
    }
}