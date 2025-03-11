interface IAssetToken {
    function initialize(string memory name_, string memory symbol_, address issuer_) external;
    function mint(address to, uint256 amount) external;
    function burn(uint256 amount) external;
    function setTokenMetadata(string memory metadata) external;
    function addMinter(address minter) external;
    function addBurner(address burner) external;
    function removeMinter(address minter) external;
    function removeBurner(address burner) external;
}