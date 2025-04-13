import { Network, Alchemy } from "alchemy-sdk";
const alchemy = new Alchemy({
  apiKey: "jOM8IJdxbECRz4Vm-QVQZIuBY0EC3RZe",
  network: Network.ETH_MAINNET,
});
async function test() {
  try {
    const block = await alchemy.core.getBlockNumber();
    console.log('Latest block:', block);
    const transfers = await alchemy.core.getAssetTransfers({
      contractAddresses: ['0xdac17f958d2ee523a2206206994597c13d831ec7'],
      category: ['erc20'],
      maxCount: 10,
    });
    console.log('Transfers:', transfers.transfers.length);
  } catch (error) {
    console.error('Error:', error);
  }
}
test();