// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MockTokenBridge {
    function transferTokens(address, uint256, uint16, bytes32, uint256, uint32) external payable returns (uint64) {
        return 1; // Mock sequence
    }
}