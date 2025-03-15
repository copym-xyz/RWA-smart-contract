// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IWormhole {
    function publishMessage(
        uint32 nonce,
        bytes memory payload,
        uint8 consistencyLevel
    ) external returns (uint64 sequence);
}

contract MessageSender {
    IWormhole public wormhole;
    address public owner;

    constructor(address _wormhole) {
        wormhole = IWormhole(_wormhole);
        owner = msg.sender;
    }

    function sendMessage(string memory message) external {
        require(msg.sender == owner, "Only owner");
        bytes memory payload = abi.encodePacked(message);
        // Consistency level 1 = finalized on Polygon Amoy
        wormhole.publishMessage(0, payload, 1);
    }
}