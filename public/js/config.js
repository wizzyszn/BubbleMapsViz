// config.js
export const config = {
    apiUrl: '/api/traders',
    nodeSizeRange: [10, 50],
    colors: {
        whale: '#ff6b8b',
        retail: '#4ade80',
        linkDefault: '#8b95a8',
        linkHighlight: '#3a6df0'
    },
    explorers: {
        eth: { name: 'Etherscan', baseUrl: 'https://etherscan.io' },
        avax: { name: 'Snowtrace', baseUrl: 'https://snowtrace.io' },
        base: { name: 'Basescan', baseUrl: 'https://basescan.org' },
        bnb: { name: 'BscScan', baseUrl: 'https://bscscan.com' },
        arbi: { name: 'Arbiscan', baseUrl: 'https://arbiscan.io' },
        poly: { name: 'PolygonScan', baseUrl: 'https://polygonscan.com' },
        opt: { name: 'Optimism Explorer', baseUrl: 'https://optimistic.etherscan.io' },
        sonic: { name: 'Sonic Explorer', baseUrl: 'https://explorer.sonic.network' }
    },
    tokenData: {
        eth: {
            'Tether (USDT)': '0xdac17f958d2ee523a2206206994597c13d831ec7',
            'USD Coin (USDC)': '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            'Chainlink (LINK)': '0x514910771af9ca656af840dff83e8264ecf986ca',
            'Wrapped Bitcoin (WBTC)': '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
            'Shiba Inu (SHIB)': '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE'
        },
        bnb: {
            'Binance Coin (BNB)': '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
            'Binance USD (BUSD)': '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
            'PancakeSwap (CAKE)': '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82',
            'Wrapped BNB (WBNB)': '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
            'Chainlink (LINK)': '0xF8A0BF9cF54Bb92f17374d9e9A321E6a111a51bD'
        },
        arbi: {
            'USD Coin (USDC)': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            'Tether (USDT)': '0xdAC17F958D2ee523a2206206994597C13D831ec7',
            'Wrapped Bitcoin (WBTC)': '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
            'Chainlink (LINK)': '0x514910771AF9Ca656af840dff83E8264EcF986CA',
            'Uniswap (UNI)': '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984'
        }
    }
};
