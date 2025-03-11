// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/ICrossChainBridge.sol";
import "./AssetToken.sol";

/**
 * @title AssetFactory
 * @dev Factory contract for creating new asset tokens across multiple chains
 */
contract AssetFactory is AccessControl {
    address public bridgeContract;
    address public soulboundNFTContract;
    
    // Mapping of created assets
    mapping(address => bool) public isAssetCreated;
    mapping(address => mapping(string => address)) public issuerAssets;
    
    // Events
    event AssetCreated(
        address indexed issuer,
        address indexed assetAddress,
        string name,
        string symbol,
        string chainId
    );
    
    constructor(address _bridgeContract, address _soulboundNFTContract) {
        bridgeContract = _bridgeContract;
        soulboundNFTContract = _soulboundNFTContract;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }
    
    /**
     * @dev Set the bridge contract address
     * @param _bridgeContract The new bridge contract address
     */
    function setBridgeContract(address _bridgeContract) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(_bridgeContract != address(0), "Invalid address");
        bridgeContract = _bridgeContract;
    }
    
    /**
     * @dev Set the SoulboundNFT contract address
     * @param _soulboundNFTContract The new SoulboundNFT contract address
     */
    function setSoulboundNFTContract(address _soulboundNFTContract) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(_soulboundNFTContract != address(0), "Invalid address");
        soulboundNFTContract = _soulboundNFTContract;
    }
    
    /**
     * @dev Create a new asset token on the current chain
     * @param issuer The address of the issuer
     * @param name The name of the asset
     * @param symbol The symbol of the asset
     * @param chainId The current chain identifier
     * @param soulboundTokenId The token ID of the issuer's SoulboundNFT
     */
    function createAssetCrossChain(
        address issuer,
        string memory name,
        string memory symbol,
        string memory chainId,
        uint256 soulboundTokenId
    ) 
        external 
        returns (address) 
    {
        require(issuer != address(0), "Invalid issuer address");
        require(bytes(name).length > 0, "Name cannot be empty");
        require(bytes(symbol).length > 0, "Symbol cannot be empty");
        require(bytes(chainId).length > 0, "Chain ID cannot be empty");
        
        // Verify identity through the bridge
        require(
            ICrossChainBridge(bridgeContract).verifyIdentity(
                soulboundNFTContract, 
                soulboundTokenId, 
                chainId
            ),
            "Invalid identity"
        );
        
        // Create new asset token
        AssetToken newAsset = new AssetToken();
        newAsset.initialize(name, symbol, issuer);
        
        address assetAddress = address(newAsset);
        
        isAssetCreated[assetAddress] = true;
        issuerAssets[issuer][symbol] = assetAddress;
        
        emit AssetCreated(issuer, assetAddress, name, symbol, chainId);
        
        return assetAddress;
    }
    
    /**
     * @dev Signal asset creation on another chain
     * @param issuer The address of the issuer
     * @param name The name of the asset
     * @param symbol The symbol of the asset
     * @param targetChainId The target chain identifier
     * @param soulboundTokenId The token ID of the issuer's SoulboundNFT
     */
    function signalCrossChainAssetCreation(
        address issuer,
        string memory name,
        string memory symbol,
        string memory targetChainId,
        uint256 soulboundTokenId
    ) 
        external 
        returns (bytes32) 
    {
        require(issuer != address(0), "Invalid issuer address");
        require(bytes(name).length > 0, "Name cannot be empty");
        require(bytes(symbol).length > 0, "Symbol cannot be empty");
        require(bytes(targetChainId).length > 0, "Target chain ID cannot be empty");
        
        // Verify identity through the bridge for the current chain
        require(
            ICrossChainBridge(bridgeContract).verifyIdentity(
                soulboundNFTContract, 
                soulboundTokenId, 
                "eth-mainnet"  // Current chain ID (Ethereum)
            ),
            "Invalid identity"
        );
        
        // Relay asset creation request to the bridge
        bytes32 requestId = ICrossChainBridge(bridgeContract).relayAssetCreation(
            targetChainId,
            issuer,
            name,
            symbol
        );
        
        return requestId;
    }
    
    /**
     * @dev Get an asset address by issuer and symbol
     * @param issuer The address of the issuer
     * @param symbol The symbol of the asset
     */
    function getAssetAddress(address issuer, string memory symbol) 
        external 
        view 
        returns (address) 
    {
        return issuerAssets[issuer][symbol];
    }
}