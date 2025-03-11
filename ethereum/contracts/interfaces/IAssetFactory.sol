interface IAssetFactory {
    function createAssetCrossChain(address issuer, string memory name, string memory symbol, string memory chainId, uint256 soulboundTokenId) external returns (address);
    function signalCrossChainAssetCreation(address issuer, string memory name, string memory symbol, string memory targetChainId, uint256 soulboundTokenId) external returns (bytes32);
    function getAssetAddress(address issuer, string memory symbol) external view returns (address);
}
