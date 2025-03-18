// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./IBridge.sol";
import "../identity/SoulboundNFT.sol";
import "./IWormhole.sol";
import "./ITokenBridge.sol";
import "./CommodityToken.sol";

contract CrossChainBridge is AccessControl, IBridge {
    bytes32 public constant BRIDGE_ADMIN_ROLE = keccak256("BRIDGE_ADMIN_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    IWormhole public wormhole;
    ITokenBridge public tokenBridge;



    function _checkRateLimit(address sender) internal {
        if (lastRequestTime[sender] != 0) {
            require(
                block.timestamp >= lastRequestTime[sender] + requestCooldown, 
                "Rate limit exceeded"
            );
        }
        lastRequestTime[sender] = block.timestamp;
    }

    // Internal method to convert Wormhole chain ID to chain name
    function _getChainIdString(uint16 chainId) internal pure returns (string memory) {
        if (chainId == 1) return "solana_devnet";
        if (chainId == 2) return "ethereum";
        if (chainId == 5) return "polygon";
        return "unknown";
    }

    // Internal method to get current chain ID as string
    function _getCurrentChainId() internal view returns (string memory) {
        uint256 id;
        assembly {
            id := chainid()
        }
        return _toString(id);
    }

    // Internal method to convert uint256 to string
    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
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

    // Internal method to get Wormhole chain ID
    function _getWormholeChainId(string memory chainName) internal pure returns (uint16) {
        if (keccak256(bytes(chainName)) == keccak256(bytes("solana_devnet")))
            return 1;
        if (keccak256(bytes(chainName)) == keccak256(bytes("ethereum")))
            return 2;
        if (keccak256(bytes(chainName)) == keccak256(bytes("polygon")))
            return 5;
        return 0;
    }

    mapping(string => address) public commodityTokens; // commodityType => tokenAddress
    mapping(string => string) public bridgeEndpoints;
    uint32 private nonceCounter;
    
    // Replay protection
    mapping(bytes32 => bool) public processedMessages;
    
    // Rate limiting
    mapping(address => uint256) public lastRequestTime;
    uint256 public requestCooldown = 1 minutes; // Adjustable cooldown period

    enum MessageType {
        VERIFICATION,
        VERIFICATION_RESPONSE,
        ASSET_CREATION,
        CUSTOM,
        TOKEN_TRANSFER,
        CREDENTIAL_VERIFICATION,
        CREDENTIAL_STATUS_UPDATE,
        ROLE_SYNCHRONIZATION,
        DID_RESOLUTION
    }

    struct Message {
        MessageType msgType;
        bytes data;
        uint256 timestamp;
        bytes32 messageId;
    }

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

    // Token bridging requests
    mapping(uint256 => TokenTransferRequest) public tokenTransferRequests;
    uint256 private transferCounter;

    // New: Credential verification requests
    struct CredentialVerificationRequest {
        uint256 requestId;
        bytes32 credentialHash;
        string sourceChain;
        string targetChain;
        bool verified;
        uint256 timestamp;
    }
    
    mapping(uint256 => CredentialVerificationRequest) public credentialVerificationRequests;
    
    // New: Role synchronization tracking
    struct RoleSyncRequest {
        uint256 requestId;
        bytes32 role;
        address account;
        bool isGrant; // true for grant, false for revoke
        string sourceChain;
        string targetChain;
        uint256 timestamp;
    }
    
    mapping(uint256 => RoleSyncRequest) public roleSyncRequests;

    struct TokenTransferRequest {
        uint256 transferId;
        address tokenAddress;
        uint256 amount;
        string sourceChain;
        string targetChain;
        address sender;
        bool completed;
    }

    // Events
    event VerificationRequested(
        uint256 indexed requestId,
        string did,
        string sourceChain,
        string targetChain
    );
    event VerificationCompleted(uint256 indexed requestId, bool verified);
    event BridgeEndpointUpdated(string chainId, string endpoint);
    event CrossChainMessage(
        uint256 indexed messageId,
        string sourceChain,
        string targetChain,
        bytes data
    );
    event TokenTransferInitiated(
        uint256 indexed transferId,
        address token,
        uint256 amount,
        string targetChain
    );
    event TokenTransferCompleted(uint256 indexed transferId, bool success);
    
    // New events
    event CredentialVerificationRequested(
        uint256 indexed requestId,
        bytes32 credentialHash,
        string sourceChain,
        string targetChain
    );
    event CredentialVerificationCompleted(
        uint256 indexed requestId,
        bool verified
    );
    event RoleSynchronizationRequested(
        uint256 indexed requestId,
        bytes32 role,
        address account,
        bool isGrant,
        string sourceChain,
        string targetChain
    );
    event RoleSynchronizationCompleted(
        uint256 indexed requestId,
        bool success
    );
    event MessageReplayed(bytes32 messageId);
    event RateLimitExceeded(address sender, uint256 cooldownRemaining);

    constructor(address _wormhole, address _tokenBridge) {
        wormhole = IWormhole(_wormhole);
        tokenBridge = ITokenBridge(_tokenBridge);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(BRIDGE_ADMIN_ROLE, msg.sender);
        nonceCounter = 0;
    }

    function registerCommodityToken(string memory commodityType, address tokenAddress) external onlyRole(BRIDGE_ADMIN_ROLE) {
        commodityTokens[commodityType] = tokenAddress;
    }

    function setBridgeEndpoint(
        string memory chainId,
        string memory endpoint
    ) external onlyRole(BRIDGE_ADMIN_ROLE) {
        bridgeEndpoints[chainId] = endpoint;
        emit BridgeEndpointUpdated(chainId, endpoint);
    }
    
    /**
     * @dev Set the cooldown period for request rate limiting
     */
    function setRequestCooldown(uint256 newCooldown) external onlyRole(BRIDGE_ADMIN_ROLE) {
        requestCooldown = newCooldown;
    }

    function verifyIdentity(
        address soulboundContract,
        uint256 tokenId,
        string memory targetChain
    ) external view override returns (bool) {
        SoulboundNFT soulbound = SoulboundNFT(soulboundContract);
        string memory did = soulbound.getDID(tokenId);
        require(bytes(did).length > 0, "Invalid DID");

        string memory currentChain = _getCurrentChainId();
        if (keccak256(bytes(currentChain)) == keccak256(bytes(targetChain))) {
            return true;
        }

        string memory targetAddress = soulbound.getChainAddress(
            tokenId,
            targetChain
        );
        return bytes(targetAddress).length > 0;
    }

    /**
     * @dev Request verification of identity across chains
     */
    function requestVerification(
        string memory did,
        string memory targetChain
    ) external returns (uint256) {
        // Rate limiting check
        _checkRateLimit(msg.sender);
        
        require(bytes(did).length > 0, "Invalid DID");
        require(
            bytes(bridgeEndpoints[targetChain]).length > 0,
            "Target chain not supported"
        );

        string memory currentChain = _getCurrentChainId();
        uint256 requestId = requestCounter++;
        verificationRequests[requestId] = VerificationRequest({
            requestId: requestId,
            sourceChain: currentChain,
            targetChain: targetChain,
            did: did,
            verified: false,
            timestamp: block.timestamp
        });

        bytes memory payload = abi.encode(
            MessageType.VERIFICATION,
            abi.encode(requestId, did),
            block.timestamp,
            keccak256(abi.encodePacked(requestId, did, block.timestamp))
        );
        sendCrossChainMessage(targetChain, payload);

        emit VerificationRequested(requestId, did, currentChain, targetChain);
        return requestId;
    }
    
    /**
     * @dev Request verification of a credential across chains
     */
    function requestCredentialVerification(
        bytes32 credentialHash,
        string memory targetChain
    ) external returns (uint256) {
        // Rate limiting check
        _checkRateLimit(msg.sender);
        
        require(
            bytes(bridgeEndpoints[targetChain]).length > 0,
            "Target chain not supported"
        );

        string memory currentChain = _getCurrentChainId();
        uint256 requestId = requestCounter++;
        
        credentialVerificationRequests[requestId] = CredentialVerificationRequest({
            requestId: requestId,
            credentialHash: credentialHash,
            sourceChain: currentChain,
            targetChain: targetChain,
            verified: false,
            timestamp: block.timestamp
        });

        bytes memory payload = abi.encode(
            MessageType.CREDENTIAL_VERIFICATION,
            abi.encode(requestId, credentialHash),
            block.timestamp,
            keccak256(abi.encodePacked(requestId, credentialHash, block.timestamp))
        );
        sendCrossChainMessage(targetChain, payload);

        emit CredentialVerificationRequested(requestId, credentialHash, currentChain, targetChain);
        return requestId;
    }
    
    /**
     * @dev Synchronize role assignments across chains
     */
    function syncRole(
        bytes32 role,
        address account,
        bool isGrant,
        string memory targetChain
    ) external onlyRole(BRIDGE_ADMIN_ROLE) returns (uint256) {
        require(
            bytes(bridgeEndpoints[targetChain]).length > 0,
            "Target chain not supported"
        );

        string memory currentChain = _getCurrentChainId();
        uint256 requestId = requestCounter++;
        
        roleSyncRequests[requestId] = RoleSyncRequest({
            requestId: requestId,
            role: role,
            account: account,
            isGrant: isGrant,
            sourceChain: currentChain,
            targetChain: targetChain,
            timestamp: block.timestamp
        });

        bytes memory payload = abi.encode(
            MessageType.ROLE_SYNCHRONIZATION,
            abi.encode(requestId, role, account, isGrant),
            block.timestamp,
            keccak256(abi.encodePacked(requestId, role, account, isGrant, block.timestamp))
        );
        sendCrossChainMessage(targetChain, payload);

        emit RoleSynchronizationRequested(
            requestId, 
            role, 
            account, 
            isGrant, 
            currentChain, 
            targetChain
        );
        return requestId;
    }

    function completeVerification(
        uint256 requestId,
        bool verified
    ) external onlyRole(ORACLE_ROLE) {
        require(
            verificationRequests[requestId].requestId == requestId,
            "Invalid request ID"
        );
        require(
            !verificationRequests[requestId].verified,
            "Request already completed"
        );

        verificationRequests[requestId].verified = verified;
        emit VerificationCompleted(requestId, verified);
    }
    
    /**
     * @dev Complete credential verification process
     */
    function completeCredentialVerification(
        uint256 requestId,
        bool verified
    ) external onlyRole(ORACLE_ROLE) {
        require(
            credentialVerificationRequests[requestId].requestId == requestId,
            "Invalid request ID"
        );
        require(
            !credentialVerificationRequests[requestId].verified,
            "Request already completed"
        );

        credentialVerificationRequests[requestId].verified = verified;
        emit CredentialVerificationCompleted(requestId, verified);
    }
    
    /**
     * @dev Complete role synchronization process
     */
    function completeRoleSync(
        uint256 requestId,
        bool success
    ) external onlyRole(ORACLE_ROLE) {
        require(
            roleSyncRequests[requestId].requestId == requestId,
            "Invalid request ID"
        );

        emit RoleSynchronizationCompleted(requestId, success);
    }

    /**
     * @dev Send a cross-chain message with improved security
     */
    function sendCrossChainMessage(
        string memory targetChain,
        bytes memory data
    ) public override {
        require(
            bytes(bridgeEndpoints[targetChain]).length > 0,
            "Target chain not supported"
        );

        // Rate limiting for non-admins
        if (!hasRole(BRIDGE_ADMIN_ROLE, msg.sender)) {
            _checkRateLimit(msg.sender);
        }

        string memory currentChain = _getCurrentChainId();
        uint256 messageId = requestCounter++;
        uint16 targetChainId = _getWormholeChainId(targetChain);
        require(targetChainId != 0, "Unsupported target chain");

        nonceCounter++;
        wormhole.publishMessage(nonceCounter, data, 1); // Consistency level 1

        emit CrossChainMessage(messageId, currentChain, targetChain, data);
    }

    function sendCustomMessage(
        string memory targetChain,
        bytes memory data
    ) external {
        bytes memory payload = abi.encode(
            MessageType.CUSTOM, 
            data,
            block.timestamp,
            keccak256(abi.encodePacked(data, block.timestamp, nonceCounter))
        );
        sendCrossChainMessage(targetChain, payload);
    }

    function relayAssetCreation(
        string memory targetChain,
        address issuer,
        string memory name,
        string memory symbol
    ) external override {
        bytes memory data = abi.encode(
            MessageType.ASSET_CREATION,
            abi.encode(issuer, name, symbol),
            block.timestamp,
            keccak256(abi.encodePacked(issuer, name, symbol, block.timestamp))
        );
        sendCrossChainMessage(targetChain, data);
    }

    function bridgeTokens(
        address tokenAddress,
        uint256 amount,
        string memory targetChain
    ) external {
        // Rate limiting
        _checkRateLimit(msg.sender);
        
        require(
            bytes(bridgeEndpoints[targetChain]).length > 0,
            "Target chain not supported"
        );
        IERC20 token = IERC20(tokenAddress);
        require(
            token.transferFrom(msg.sender, address(this), amount),
            "Transfer failed"
        );

        uint256 transferId = transferCounter++;
        tokenTransferRequests[transferId] = TokenTransferRequest({
            transferId: transferId,
            tokenAddress: tokenAddress,
            amount: amount,
            sourceChain: _getCurrentChainId(),
            targetChain: targetChain,
            sender: msg.sender,
            completed: false
        });

        bytes memory payload = abi.encode(
            MessageType.TOKEN_TRANSFER,
            abi.encode(transferId, tokenAddress, amount),
            block.timestamp,
            keccak256(abi.encodePacked(transferId, tokenAddress, amount, block.timestamp))
        );
        sendCrossChainMessage(targetChain, payload);

        emit TokenTransferInitiated(
            transferId,
            tokenAddress,
            amount,
            targetChain
        );
    }

    // Complete token transfer (called by oracle or Solana program)
    function completeTokenTransfer(
        uint256 transferId,
        bool success
    ) external onlyRole(ORACLE_ROLE) {
        TokenTransferRequest storage request = tokenTransferRequests[
            transferId
        ];
        require(request.transferId == transferId, "Invalid transfer ID");
        require(!request.completed, "Transfer already completed");

        request.completed = true;
        if (success) {
            // Burn tokens on Polygon (assumes Solana minting succeeded)
            CommodityToken(request.tokenAddress).burn(
                address(this),
                request.amount
            );
        } else {
            // Refund tokens if bridging failed
            IERC20(request.tokenAddress).transfer(
                request.sender,
                request.amount
            );
        }

        emit TokenTransferCompleted(transferId, success);
    }

  /**
     * @dev Process incoming cross-chain messages with replay protection
     */
    function receiveCrossChainMessage(
        uint16 sourceChain, 
        bytes32 sourceAddress, 
        uint64, 
        bytes memory payload
    ) external {
        require(msg.sender == address(wormhole), "Unauthorized caller");
        
        // Decode the message with full security fields
        (MessageType msgType, bytes memory data, uint256 timestamp, bytes32 messageId) = 
            abi.decode(payload, (MessageType, bytes, uint256, bytes32));
        
        // Check for message replay
        if (processedMessages[messageId]) {
            emit MessageReplayed(messageId);
            return;
        }
        
        // Mark message as processed
        processedMessages[messageId] = true;
        
        // Check if message is too old (optional time-based expiry)
        // require(block.timestamp - timestamp < 1 days, "Message expired");
        
        if (msgType == MessageType.VERIFICATION_RESPONSE) {
            (uint256 requestId, bool verified) = abi.decode(data, (uint256, bool));
            
            // Update verification status
            VerificationRequest storage request = verificationRequests[requestId];
            if (request.requestId == requestId && !request.verified) {
                request.verified = verified;
                emit VerificationCompleted(requestId, verified);
            }
        } else if (msgType == MessageType.CREDENTIAL_VERIFICATION) {
            (uint256 requestId, bytes32 credentialHash) = abi.decode(data, (uint256, bytes32));
            
            // Process credential verification request
            // This would interact with the SoulboundNFT contract to verify the credential
            // For now, we'll just emit an event
            emit CredentialVerificationRequested(requestId, credentialHash, 
                _getChainIdString(sourceChain), _getCurrentChainId());
            
            // In a real implementation, you would check the credential and send a response
        } else if (msgType == MessageType.ROLE_SYNCHRONIZATION) {
            (uint256 requestId, bytes32 role, address account, bool isGrant) = 
                abi.decode(data, (uint256, bytes32, address, bool));
            
            // Process role synchronization
            if (isGrant) {
                // Grant the role on this chain
                grantRole(role, account);
            } else {
                // Revoke the role on this chain
                revokeRole(role, account);
            }
            
            // Emit completion event
            emit RoleSynchronizationCompleted(requestId, true);
        } else if (msgType == MessageType.TOKEN_TRANSFER) {
            (uint256 transferId, address tokenAddress, uint256 amount) = 
                abi.decode(data, (uint256, address, uint256));
            
            // Process token transfer
            address token = tokenAddress;
            // In production, you might need to map the token address between chains
            
            // Mint on this chain if we're on Polygon
            if (keccak256(bytes(_getCurrentChainId())) == keccak256(bytes("80002"))){ // Polygon Amoy
                CommodityToken(token).mint(msg.sender, amount);
            }
            
            emit TokenTransferCompleted(transferId, true);
        }
    } 
} 