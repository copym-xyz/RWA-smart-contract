// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./IBridge.sol";
import "../identity/SoulboundNFT.sol";
import "./IWormhole.sol";
import "./ITokenBridge.sol";

contract CrossChainBridge is AccessControl, IBridge {
    bytes32 public constant BRIDGE_ADMIN_ROLE = keccak256("BRIDGE_ADMIN_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    IWormhole public wormhole;
    ITokenBridge public tokenBridge;

    mapping(string => string) public bridgeEndpoints;
    uint32 private nonceCounter;

    enum MessageType { VERIFICATION, VERIFICATION_RESPONSE, ASSET_CREATION, CUSTOM }
    
    struct Message {
        MessageType msgType;
        bytes data;
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

    event VerificationRequested(uint256 indexed requestId, string did, string sourceChain, string targetChain);
    event VerificationCompleted(uint256 indexed requestId, bool verified);
    event BridgeEndpointUpdated(string chainId, string endpoint);
    event CrossChainMessage(uint256 indexed messageId, string sourceChain, string targetChain, bytes data);

    constructor(address _wormhole, address _tokenBridge) {
        wormhole = IWormhole(_wormhole);
        tokenBridge = ITokenBridge(_tokenBridge);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(BRIDGE_ADMIN_ROLE, msg.sender);
        nonceCounter = 0;
    }

    function setBridgeEndpoint(string memory chainId, string memory endpoint) external onlyRole(BRIDGE_ADMIN_ROLE) {
        bridgeEndpoints[chainId] = endpoint;
        emit BridgeEndpointUpdated(chainId, endpoint);
    }

    function verifyIdentity(address soulboundContract, uint256 tokenId, string memory targetChain) external view override returns (bool) {
        SoulboundNFT soulbound = SoulboundNFT(soulboundContract);
        string memory did = soulbound.getDID(tokenId);
        require(bytes(did).length > 0, "Invalid DID");

        string memory currentChain = _getCurrentChainId();
        if (keccak256(bytes(currentChain)) == keccak256(bytes(targetChain))) {
            return true;
        }

        string memory targetAddress = soulbound.getChainAddress(tokenId, targetChain);
        return bytes(targetAddress).length > 0;
    }

    function requestVerification(string memory did, string memory targetChain) external returns (uint256) {
        require(bytes(did).length > 0, "Invalid DID");
        require(bytes(bridgeEndpoints[targetChain]).length > 0, "Target chain not supported");

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

        bytes memory payload = abi.encode(MessageType.VERIFICATION, abi.encode(requestId, did));
        sendCrossChainMessage(targetChain, payload);

        emit VerificationRequested(requestId, did, currentChain, targetChain);
        return requestId;
    }

    function completeVerification(uint256 requestId, bool verified) external onlyRole(ORACLE_ROLE) {
        require(verificationRequests[requestId].requestId == requestId, "Invalid request ID");
        require(!verificationRequests[requestId].verified, "Request already completed");

        verificationRequests[requestId].verified = verified;
        emit VerificationCompleted(requestId, verified);
    }

    function sendCrossChainMessage(string memory targetChain, bytes memory data) public override {
        require(bytes(bridgeEndpoints[targetChain]).length > 0, "Target chain not supported");

        string memory currentChain = _getCurrentChainId();
        uint256 messageId = requestCounter++;
        uint16 targetChainId = _getWormholeChainId(targetChain);
        require(targetChainId != 0, "Unsupported target chain");

        nonceCounter++;
       wormhole.publishMessage(nonceCounter, data, uint8(targetChainId)); // Casting targetChainId to uint8


        emit CrossChainMessage(messageId, currentChain, targetChain, data);
    }

    function sendCustomMessage(string memory targetChain, bytes memory data) external {
        bytes memory payload = abi.encode(MessageType.CUSTOM, data);
        sendCrossChainMessage(targetChain, payload);
    }

    function relayAssetCreation(string memory targetChain, address issuer, string memory name, string memory symbol) external override {
        bytes memory data = abi.encode(MessageType.ASSET_CREATION, abi.encode(issuer, name, symbol));
        sendCrossChainMessage(targetChain, data);
    }

    function receiveCrossChainMessage(uint16 sourceChain, bytes32 sourceAddress, uint64, bytes memory payload) external {
        require(msg.sender == address(wormhole), "Unauthorized caller");

        (MessageType msgType, bytes memory data) = abi.decode(payload, (MessageType, bytes));
        if (msgType == MessageType.VERIFICATION_RESPONSE) {
            (uint256 requestId, bool verified) = abi.decode(data, (uint256, bool));
            if (verificationRequests[requestId].requestId == requestId) {
                verificationRequests[requestId].verified = verified;
                emit VerificationCompleted(requestId, verified);
            }
        }
    }

    function _getCurrentChainId() internal view returns (string memory) {
        uint256 id;
        assembly {
            id := chainid()
        }
        return _toString(id);
    }

    function _getWormholeChainId(string memory chainName) internal pure returns (uint16) {
        if (keccak256(bytes(chainName)) == keccak256(bytes("solana_devnet"))) return 1;
        if (keccak256(bytes(chainName)) == keccak256(bytes("ethereum"))) return 2;
        if (keccak256(bytes(chainName)) == keccak256(bytes("polygon"))) return 5;
        return 0;
    }

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
}