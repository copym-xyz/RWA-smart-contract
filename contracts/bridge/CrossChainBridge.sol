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

    mapping(string => address) public commodityTokens; // commodityType => tokenAddress
function registerCommodityToken(string memory commodityType, address tokenAddress) external onlyRole(BRIDGE_ADMIN_ROLE) {
    commodityTokens[commodityType] = tokenAddress;
}

    mapping(string => string) public bridgeEndpoints;
    uint32 private nonceCounter;

    enum MessageType {
        VERIFICATION,
        VERIFICATION_RESPONSE,
        ASSET_CREATION,
        CUSTOM,
        TOKEN_TRANSFER
    }

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

    // New mapping for token bridging requests
    mapping(uint256 => TokenTransferRequest) public tokenTransferRequests;
    uint256 private transferCounter;

    struct TokenTransferRequest {
        uint256 transferId;
        address tokenAddress;
        uint256 amount;
        string sourceChain;
        string targetChain;
        address sender;
        bool completed;
    }

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

    constructor(address _wormhole, address _tokenBridge) {
        wormhole = IWormhole(_wormhole);
        tokenBridge = ITokenBridge(_tokenBridge);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(BRIDGE_ADMIN_ROLE, msg.sender);
        nonceCounter = 0;
    }

    function setBridgeEndpoint(
        string memory chainId,
        string memory endpoint
    ) external onlyRole(BRIDGE_ADMIN_ROLE) {
        bridgeEndpoints[chainId] = endpoint;
        emit BridgeEndpointUpdated(chainId, endpoint);
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

    function requestVerification(
        string memory did,
        string memory targetChain
    ) external returns (uint256) {
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
            abi.encode(requestId, did)
        );
        sendCrossChainMessage(targetChain, payload);

        emit VerificationRequested(requestId, did, currentChain, targetChain);
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

    function sendCrossChainMessage(
        string memory targetChain,
        bytes memory data
    ) public override {
        require(
            bytes(bridgeEndpoints[targetChain]).length > 0,
            "Target chain not supported"
        );

        string memory currentChain = _getCurrentChainId();
        uint256 messageId = requestCounter++;
        uint16 targetChainId = _getWormholeChainId(targetChain);
        require(targetChainId != 0, "Unsupported target chain");

        nonceCounter++;
        wormhole.publishMessage(nonceCounter, data, uint8(targetChainId)); // Casting targetChainId to uint8

        emit CrossChainMessage(messageId, currentChain, targetChain, data);
    }

    function sendCustomMessage(
        string memory targetChain,
        bytes memory data
    ) external {
        bytes memory payload = abi.encode(MessageType.CUSTOM, data);
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
            abi.encode(issuer, name, symbol)
        );
        sendCrossChainMessage(targetChain, data);
    }

  
    // newly updated -----------------fot tokeniing engine purposr--------------------//
    function bridgeTokens(
        address tokenAddress,
        uint256 amount,
        string memory targetChain
    ) external {
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
            abi.encode(transferId, tokenAddress, amount)
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

   // Update CrossChainBridge.sol receiveCrossChainMessage
function receiveCrossChainMessage(uint16 sourceChain, bytes32 sourceAddress, uint64, bytes memory payload) external {
    require(msg.sender == address(wormhole), "Unauthorized caller");
    (MessageType msgType, bytes memory data) = abi.decode(payload, (MessageType, bytes));
    if (msgType == MessageType.VERIFICATION_RESPONSE) {
        // Existing logic
    } else if (msgType == MessageType.TOKEN_TRANSFER) {
        (uint256 transferId, address tokenAddress, uint256 amount) = abi.decode(data, (uint256, address, uint256));
        CommodityToken(tokenAddress).mint(msg.sender, amount); // Mint on Polygon
        emit TokenTransferCompleted(transferId, true);
    }
}
    function _getCurrentChainId() internal view returns (string memory) {
        uint256 id;
        assembly {
            id := chainid()
        }
        return _toString(id);
    }

    function _getWormholeChainId(
        string memory chainName
    ) internal pure returns (uint16) {
        if (keccak256(bytes(chainName)) == keccak256(bytes("solana_devnet")))
            return 1;
        if (keccak256(bytes(chainName)) == keccak256(bytes("ethereum")))
            return 2;
        if (keccak256(bytes(chainName)) == keccak256(bytes("polygon")))
            return 5;
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
