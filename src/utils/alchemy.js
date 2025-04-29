// src/utils/alchemy.js
import { Network, Alchemy } from "alchemy-sdk";
import dotenv from "dotenv";
dotenv.config();

export const chainMapper = {
    eth: Network.ETH_MAINNET,
    avax: Network.AVAX_MAINNET,
    base: Network.BASE_MAINNET,
    bnb: Network.BNB_MAINNET,
    arbi: Network.ARB_MAINNET,
    poly: Network.MATIC_MAINNET,
    opt: Network.OPT_MAINNET,
    sonic: Network.SONIC_MAINNET,
    sol: Network.SOLANA_MAINNET
};

export const AlchemyFunc = (chain) => {
    const config = {
        apiKey: process.env.ALCHEMY_API_KEY,
        network: chainMapper[chain],
    };
    return new Alchemy(config);
};

export const getAlchemy = (chain = 'eth') => {
    if (!Object.keys(chainMapper).includes(chain)) {
        console.warn(`Unsupported chain: ${chain}, falling back to Ethereum`);
        return AlchemyFunc('eth');
    }
    return AlchemyFunc(chain);
};
