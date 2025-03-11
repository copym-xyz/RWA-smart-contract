// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

/**
 * @title AssetToken
 * @dev ERC20 token with minting and burning capabilities
 */
contract AssetToken is ERC20("", ""), ERC20Burnable, AccessControl, Initializable {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    
    address public issuer;
    string public tokenMetadata;
    bool private _initialized;
    
    /**
     * @dev Initialize the token (used instead of constructor for factory pattern)
     * @param name_ The name of the token
     * @param symbol_ The symbol of the token
     * @param issuer_ The address of the issuer
     */
    function initialize(
        string memory name_,
        string memory symbol_,
        address issuer_
    ) 
        external 
        initializer 
    {
        require(!_initialized, "Token already initialized");
        require(issuer_ != address(0), "Invalid issuer address");
        
        __ERC20_init(name_, symbol_);
        
        _grantRole(DEFAULT_ADMIN_ROLE, issuer_);
        _grantRole(MINTER_ROLE, issuer_);
        _grantRole(BURNER_ROLE, issuer_);
        
        issuer = issuer_;
        _initialized = true;
    }
    
    /**
     * @dev Mint tokens to an address
     * @param to The address to mint tokens to
     * @param amount The amount of tokens to mint
     */
    function mint(address to, uint256 amount) 
        external 
        onlyRole(MINTER_ROLE) 
    {
        _mint(to, amount);
    }
    
    /**
     * @dev Set token metadata (JSON string with additional information)
     * @param metadata The metadata JSON string
     */
    function setTokenMetadata(string memory metadata) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        tokenMetadata = metadata;
    }
    
    /**
     * @dev Add a new minter
     * @param minter The address to grant minter role
     */
    function addMinter(address minter) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        _grantRole(MINTER_ROLE, minter);
    }
    
    /**
     * @dev Add a new burner
     * @param burner The address to grant burner role
     */
    function addBurner(address burner) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        _grantRole(BURNER_ROLE, burner);
    }
    
    /**
     * @dev Remove a minter
     * @param minter The address to revoke minter role from
     */
    function removeMinter(address minter) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        _revokeRole(MINTER_ROLE, minter);
    }
    
    /**
     * @dev Remove a burner
     * @param burner The address to revoke burner role from
     */
    function removeBurner(address burner) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        _revokeRole(BURNER_ROLE, burner);
    }
    
    /**
     * @dev Required function to initialize ERC20
     */
    function __ERC20_init(string memory name_, string memory symbol_) internal {
        super._mint(issuer, 0); // Initialize with zero supply
    }
    
    /**
     * @dev The following functions are overrides required by Solidity
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}