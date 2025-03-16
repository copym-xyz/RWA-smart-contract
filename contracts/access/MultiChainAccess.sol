// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./IAccessControl.sol";

/**
 * @title MultiChainAccess
 * @dev Implementation of access control for multi-chain operations
 */
contract MultiChainAccess is IAccessControl {
    struct RoleData {
        mapping(address => bool) members;
        bytes32 adminRole;
    }

    mapping(bytes32 => RoleData) private _roles;

    bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant BRIDGE_ROLE = keccak256("BRIDGE_ROLE");

    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /**
     * @dev See {IAccessControl-hasRole}.
     */
    function hasRole(bytes32 role, address account) public view override returns (bool) {
        return _roles[role].members[account];
    }

    /**
     * @dev See {IAccessControl-getRoleAdmin}.
     */
    function getRoleAdmin(bytes32 role) public view override returns (bytes32) {
        return _roles[role].adminRole;
    }

    /**
     * @dev See {IAccessControl-grantRole}.
     */
    function grantRole(bytes32 role, address account) public override {
        require(hasRole(getRoleAdmin(role), msg.sender), "MultiChainAccess: must have admin role");

        _grantRole(role, account);
    }

    /**
     * @dev See {IAccessControl-revokeRole}.
     */
    function revokeRole(bytes32 role, address account) public override {
        require(hasRole(getRoleAdmin(role), msg.sender), "MultiChainAccess: must have admin role");

        _revokeRole(role, account);
    }

    /**
     * @dev See {IAccessControl-renounceRole}.
     */
    function renounceRole(bytes32 role, address account) public override {
        require(account == msg.sender, "MultiChainAccess: can only renounce roles for self");

        _revokeRole(role, account);
    }

    /**
     * @dev Internal function to grant a role to `account`.
     */
    function _grantRole(bytes32 role, address account) internal {
        if (!hasRole(role, account)) {
            _roles[role].members[account] = true;
            emit RoleGranted(role, account, msg.sender);
        }
    }

    /**
     * @dev Internal function to revoke a role from `account`.
     */
    function _revokeRole(bytes32 role, address account) internal {
        if (hasRole(role, account)) {
            _roles[role].members[account] = false;
            emit RoleRevoked(role, account, msg.sender);
        }
    }

    /**
     * @dev Internal function to set up a role's admin role.
     */
    function _setupRole(bytes32 role, address account) internal {
        _grantRole(role, account);
    }

    /**
     * @dev Internal function to set `adminRole` as `role`'s admin role.
     */
    function _setRoleAdmin(bytes32 role, bytes32 adminRole) internal {
        bytes32 previousAdminRole = getRoleAdmin(role);
        _roles[role].adminRole = adminRole;
        emit RoleAdminChanged(role, previousAdminRole, adminRole);
    }
}