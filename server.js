import { Network, Alchemy } from "alchemy-sdk";
import express from "express"
import dotenv from "dotenv"
dotenv.config();
const app = express();
const port = process.env.PORT || 3000;

app.use(express.static('public'));

const alchemy = new Alchemy({
    apiKey: process.env.ALCHEMY_API_KEY,
    network: Network.ETH_MAINNET,
});


async function findBlockByTimestamp(targetTimestamp) {
    try {
        console.log('Finding block for timestamp:', targetTimestamp);
        let low = 0;
        let high = await alchemy.core.getBlockNumber();
        let bestBlock = high;
        let bestDiff = Infinity;

        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            const block = await alchemy.core.getBlock(mid);
            if (!block || !block.timestamp) {
                low = mid + 1;
                continue;
            }

            const diff = Math.abs(block.timestamp - targetTimestamp);
            if (diff < bestDiff) {
                bestDiff = diff;
                bestBlock = mid;
            }

            if (block.timestamp > targetTimestamp) {
                high = mid - 1;
            } else if (block.timestamp < targetTimestamp) {
                low = mid + 1;
            } else {
                return mid;
            }
        }
        console.log(`Best block: ${bestBlock}`);
        return bestBlock;
    } catch (error) {
        console.error('Error finding block:', error);
        throw new Error('Failed to find block');
    }
}

app.get('/api/traders', async (req, res) => {
    const { address, time = 'all' } = req.query;

    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
        return res.status(400).json({ error: 'Invalid contract address' });
    }


    try {
        // Determine block range
        let fromBlock = '0x0';
        if (time === '7d' || time === '30d') {
            const latestBlock = await alchemy.core.getBlock('latest');
            const currentTime = latestBlock.timestamp;
            const targetTime = currentTime - (time === '7d' ? 7 * 24 * 3600 : 30 * 24 * 3600);
            const targetBlock = await findBlockByTimestamp(targetTime);
            fromBlock = `0x${targetBlock.toString(16)}`;
        }

        // Fetch transfers
        let allTransfers = [];
        let pageKey = undefined;
        let pageCount = 0;
        const maxPages = 10;

        const params = {
            contractAddresses: [address],
            category: ['erc20'],
            fromBlock,
            toBlock: 'latest',
            maxCount: 1000,
        };

        while (pageKey || pageCount === 0) {
            if (pageCount >= maxPages) {
                break;
            }
            try {
                const result = await alchemy.core.getAssetTransfers({
                    ...params,
                    pageKey,
                });
                if (result.transfers.length > 0) {
                }
                allTransfers = allTransfers.concat(result.transfers);
                pageKey = result.pageKey;
                pageCount++;
            } catch (error) {
                console.error('Error fetching transfers:', error);
                return res.status(500).json({ error: 'Failed to fetch transfers', details: error.message });
            }
        }


        // Process transfers
        const traders = {};
        const links = [];

        allTransfers.forEach((tx, index) => {
            const value = tx.value ? parseFloat(tx.value) : 0;
            if (value <= 0 || !tx.from || !tx.to) {
                return;
            }
            traders[tx.from] = (traders[tx.from] || 0) + value;
            traders[tx.to] = (traders[tx.to] || 0) + value;
            links.push({ source: tx.from, target: tx.to });
        });

        // Handle empty data
        if (Object.keys(traders).length === 0) {
            const result = { nodes: [], links: [], message: 'No valid transfers found for this token in the selected time period.' };
            return res.json(result);
        }

        // Get top 50 traders
        let nodes = Object.entries(traders)
            .map(([id, volume]) => ({ id, volume }))
            .sort((a, b) => b.volume - a.volume)
            .slice(0, 100);

        // Classify whales (top 25% by volume) vs. retail
        const volumeThreshold = nodes[Math.floor(nodes.length * 0.25)].volume;
        nodes = nodes.map(node => ({
            ...node,
            type: node.volume >= volumeThreshold ? 'whale' : 'retail',
        }));

        // Filter links
        const validIds = new Set(nodes.map(n => n.id));
        const filteredLinks = links.filter(l => validIds.has(l.source) && validIds.has(l.target));

        const result = { nodes, links: filteredLinks };
        res.json(result);
    } catch (error) {
        console.error('Error in /api/traders:', error);
        res.status(500).json({ error: 'Failed to fetch trader data', details: error.message });
    }
});

app.use((req, res) => {
    console.log('404 Not Found:', req.url);
    res.status(404).send('Not Found');
});

app.listen(port, () => console.log(`Server running on port ${port}`));