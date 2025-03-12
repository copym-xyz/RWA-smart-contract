// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./IBridge.sol";
import "../identity/SoulboundNFT.sol";

/**
 * @title CrossChainBridge
 * @dev Bridge contract for cross-chain identity verification and operations
 */
contract CrossChainBridge is AccessControl, IBridge {
    bytes32 public constant BRIDGE_ADMIN_ROLE = keccak256("BRIDGE_ADMIN_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    
    // Mapping of chain ID to bridge endpoint
    mapping(string => string) public bridgeEndpoints;
    
    // Mapping for verification requests across chains
    struct VerificationRequest {
        uint256 requestId;
        string sourceChain;
        string targetChain;
        string did;
        bool verified;
        uint256 timestamp;
    }
    
    mapping(uint256 => VerificationRequest) public verificationRequests;
    uint256 private requestCounter;
    
    // Events
    event VerificationRequested(uint256 indexed requestId, string did, string sourceChain, string targetChain);
    event VerificationCompleted(uint256 indexed requestId, bool verified);
    event BridgeEndpointUpdated(string chainId, string endpoint);
    event CrossChainMessage(uint256 indexed messageId, string sourceChain, string targetChain, bytes data);
    
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(BRIDGE_ADMIN_ROLE, msg.sender);
    }
    
    /**
     * @dev Set or update a bridge endpoint for a specific chain
     * @param chainId Target chain ID
     * @param endpoint Bridge endpoint for that chain
     */
    function setBridgeEndpoint(
        string memory chainId, 
        string memory endpoint
    ) external onlyRole(BRIDGE_ADMIN_ROLE) {
        bridgeEndpoints[chainId] = endpoint;
        emit BridgeEndpointUpdated(chainId, endpoint);
    }
    
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
    ) external view override returns (bool) {
        SoulboundNFT soulbound = SoulboundNFT(soulboundContract);
        
        // Get the DID from the token
        string memory did = soulbound.getDID(tokenId);
        require(bytes(did).length > 0, "Invalid DID");
        
        // Get the current chain ID
        string memory currentChain = _getCurrentChainId();
        
        // For same chain verification, we can directly validate
        if (keccak256(bytes(currentChain)) == keccak256(bytes(targetChain))) {
            return true;
        }
        
        // For cross-chain verification, we need to check if the DID has a valid 
        // registration on the target chain via oracle (simplified for this implementation)
        string memory targetAddress = soulbound.getChainAddress(tokenId, targetChain);
        return bytes(targetAddress).length > 0;
    }
    
    /**
     * @dev Initiate a cross-chain verification request
     * @param did The DID to verify
     * @param targetChain Target chain for verification
     * @return requestId The ID of the verification request
     */
    function requestVerification(
        string memory did, 
        string memory targetChain
    ) external returns (uint256) {
        require(bytes(did).length > 0, "Invalid DID");
        require(bytes(bridgeEndpoints[targetChain]).length > 0, "Target chain not supported");
        
        string memory currentChain = _getCurrentChainId();
        
        // Create a verification request
        uint256 requestId = requestCounter++;
        verificationRequests[requestId] = VerificationRequest({
            requestId: requestId,
            sourceChain: currentChain,
            targetChain: targetChain,
            did: did,
            verified: false,
            timestamp: block.timestamp
        });
        
        emit VerificationRequested(requestId, did, currentChain, targetChain);
        
        // In a real implementation, this would trigger an off-chain oracle process
        // For this sample, we'll leave it as a manual process to be completed by an oracle
        
        return requestId;
    }
    
    /**
     * @dev Complete a verification request (called by oracle)
     * @param requestId The ID of the verification request
     * @param verified Whether the identity was verified
     */
    function completeVerification(
        uint256 requestId, 
        bool verified
    ) external onlyRole(ORACLE_ROLE) {
        require(verificationRequests[requestId].requestId == requestId, "Invalid request ID");
        require(!verificationRequests[requestId].verified, "Request already completed");
        
        verificationRequests[requestId].verified = verified;
        
        emit VerificationCompleted(requestId, verified);
    }
    
    /**
     * @dev Send a message to another chain
     * @param targetChain Target chain for the message
     * @param data The message data
     */
    function sendCrossChainMessage(
        string memory targetChain, 
        bytes memory data
    ) external override {
        require(bytes(bridgeEndpoints[targetChain]).length > 0, "Target chain not supported");
        
        string memory currentChain = _getCurrentChainId();
        uint256 messageId = requestCounter++;
        
        // In a real implementation, this would interact with a cross-chain messaging protocol
        // For this sample, we'll just emit an event
        emit CrossChainMessage(messageId, currentChain, targetChain, data);
    }
    
    /**
     * @dev Relay asset creation to another chain
     * This would connect to an external cross-chain solution in a real implementation
     */
    function relayAssetCreation(
        string memory targetChain,
        address issuer,
        string memory name,
        string memory symbol
    ) external override {
        // Pack the data to be sent
        bytes memory data = abi.encode(issuer, name, symbol);
        
        // Send the message - Direct call instead of using this.
        this.sendCrossChainMessage(targetChain, data);
    }
    
    /**
     * @dev Helper function to get current chain ID
     */
    function _getCurrentChainId() internal view returns (string memory) {
        uint256 id;
        assembly {
            id := chainid()
        }
        return _toString(id);
    }
    
    /**
     * @dev Helper function to convert uint to string
     */
    function _toString(uint256 value) internal pure returns (string memory) {
        // This is a simplified implementation
        if (value == 0) {
            return "0";
        }
        
        uint256 temp = value;
        uint256 digits;
        
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        
        return string(buffer);
    }
}