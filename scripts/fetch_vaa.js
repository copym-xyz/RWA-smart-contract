const axios = require("axios");

async function main() {
  const wormholeRpc = "https://wormhole-v2-testnet-api.certus.one";
  const chainId = 5; 
  const emitter = "0x0CBE91CF822c73C2315FB05100b6a28C03563d3e"; 
  const sequence = "123"; 

  const url = `${wormholeRpc}/v1/signed_vaa/${chainId}/${emitter}/${sequence}`;
  const response = await axios.get(url);
  const vaaBytes = response.data.vaaBytes;
  console.log("VAA:", vaaBytes);

  
  require("fs").writeFileSync("vaa.txt", vaaBytes);
}

main().catch((error) => console.error(error));