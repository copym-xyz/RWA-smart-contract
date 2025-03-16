// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MockWormhole {
    uint32 public nonce;
    event MessagePublished(uint32 nonce, bytes payload, uint8 consistencyLevel);

    function publishMessage(uint32 _nonce, bytes memory payload, uint8 consistencyLevel) external returns (uint64) {
        nonce = _nonce;
        emit MessagePublished(_nonce, payload, consistencyLevel);
        return uint64(nonce);
    }
}