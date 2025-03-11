// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

/**
 * @title IERC5484
 * @dev Interface for the ERC5484 Soulbound Token standard
 */
interface IERC5484 {
    /// @notice Enum for the different consent types
    enum BurnAuth {
        None,       // Neither issuer nor owner can burn
        IssuerOnly, // Only the issuer can burn
        OwnerOnly,  // Only the owner can burn
        Both        // Both issuer and owner can burn
    }

    /// @notice Emitted when a token is locked to an address
    event Locked(uint256 indexed tokenId, address indexed tokenOwner, BurnAuth burnAuth);

    /// @notice Returns the burn authorization of the token
    /// @param tokenId The token to query
    /// @return The burn authorization
    function burnAuth(uint256 tokenId) external view returns (BurnAuth);
}