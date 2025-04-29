// src/routes/traders.js
import express from "express";
import { cache } from "../utils/cache.js";
import { chainMapper, getAlchemy } from "../utils/alchemy.js";
import {
    findBlockByTimestamp,
    fetchTransfersInBatches,
    enrichTransfersWithTimestamps,
    processTransfers,
    getTimestampFromFilter
} from "../utils/transfers.js";

const router = express.Router();

router.get("/", async (req, res) => {
    const { address, time = "all", chain = "eth" } = req.query;

    // Validate chain parameter
    if (!Object.keys(chainMapper).includes(chain)) {
        return res.status(400).json({
            error: "Invalid chain parameter",
            supportedChains: Object.keys(chainMapper)
        });
    }

    // Create cache key that includes the chain
    const cacheKey = `${chain}-${address}-${time}`;
    const cachedData = cache.get(cacheKey);

    if (cachedData) {
        console.log(`Serving cached data for ${cacheKey}`);
        return res.json(cachedData);
    }

    try {
        console.log(`Processing request for ${address} on ${chain} with time filter: ${time}`);
        const alchemy = getAlchemy(chain);

        // Check token activity
        const tokenActivity = await alchemy.core.getAssetTransfers({
            contractAddresses: [address],
            category: ["erc20"],
            maxCount: 1,
        });
        if (!tokenActivity.transfers.length) {
            return res.status(400).json({ error: `No recent activity for this token on ${chain}` });
        }

        // Determine block range using timestamp-based approach
        let fromBlock = "0x0";
        if (["2h", "6h", "24h", "3d", "7d", "30d"].includes(time)) {
            const targetTimestamp = getTimestampFromFilter(time);
            const blockNumber = await findBlockByTimestamp(targetTimestamp, chain);
            fromBlock = `0x${blockNumber.toString(16)}`;
        }

        // Fetch transfers
        const params = {
            contractAddresses: [address],
            category: ["erc20"],
            fromBlock,
            toBlock: "latest",
            maxCount: 1000,
        };
        let allTransfers = await fetchTransfersInBatches(params, chain);

        if (!allTransfers.length) {
            return res.json({
                nodes: [],
                links: [],
                message: `No valid transfers found for this token on ${chain} in the selected time period.`
            });
        }

        // Identify top traders
        const { traders } = processTransfers(allTransfers);
        const sortedTraders = Array.from(traders.entries())
            .map(([id, volume]) => ({ id, volume }))
            .sort((a, b) => Math.abs(b.volume) - Math.abs(a.volume))
            .slice(0, 100);
        if (sortedTraders.length === 0) {
            return res.json({
                nodes: [],
                links: [],
                message: `No valid transfers found for this token on ${chain} in the selected time period.`
            });
        }
        const topTraderIds = new Set(sortedTraders.map(t => t.id));
        const relevantTransfers = allTransfers.filter(tx =>
            topTraderIds.has(tx.from) && topTraderIds.has(tx.to)
        );

        // Timestamp enrichment
        const BATCH_SIZE = 1000;
        let enrichedCount = 0;
        const transferTimestamps = new Map();
        for (let i = 0; i < allTransfers.length; i += BATCH_SIZE) {
            const batchEnd = Math.min(i + BATCH_SIZE, allTransfers.length);
            const transfersBatch = allTransfers.slice(i, batchEnd);
            const relevantBatch = transfersBatch.filter(tx =>
                topTraderIds.has(tx.from) && topTraderIds.has(tx.to)
            );
            if (relevantBatch.length > 0) {
                await enrichTransfersWithTimestamps(relevantBatch, chain);
                for (const tx of relevantBatch) {
                    if (tx.timestamp) {
                        transferTimestamps.set(tx.hash, tx.timestamp);
                        enrichedCount++;
                    }
                }
            }
            const remainingBatch = transfersBatch.filter(tx => !transferTimestamps.has(tx.hash));
            if (remainingBatch.length > 0) {
                await enrichTransfersWithTimestamps(remainingBatch, chain);
                for (const tx of remainingBatch) {
                    if (tx.timestamp) {
                        transferTimestamps.set(tx.hash, tx.timestamp);
                        enrichedCount++;
                    }
                }
            }
            if (i + BATCH_SIZE < allTransfers.length) {
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }
        for (const tx of allTransfers) {
            const timestamp = transferTimestamps.get(tx.hash);
            if (timestamp) {
                tx.timestamp = timestamp;
            }
        }
        const processedData = processTransfers(allTransfers);
        const volumeThreshold = sortedTraders.length >= 4 ?
            Math.abs(sortedTraders[Math.floor(sortedTraders.length * 0.25)].volume) :
            Math.abs(sortedTraders[0].volume) / 2;
        const MAX_TX_PER_NODE = 50;
        const nodes = sortedTraders.map(node => {
            const transactions = (processedData.traderTransactions.get(node.id) || [])
                .slice(0, MAX_TX_PER_NODE);
            return {
                ...node,
                type: Math.abs(node.volume) >= volumeThreshold ? "whale" : "retail",
                transactions: transactions
            };
        });
        const validIds = new Set(nodes.map(n => n.id));
        const filteredLinks = Array.from(processedData.linksMap.values())
            .filter(link => validIds.has(link.source) && validIds.has(link.target));
        const linksWithTimestamp = filteredLinks.filter(link => link.timestamp !== null).length;
        const result = {
            nodes,
            links: filteredLinks,
            chain,
            stats: {
                totalTransfers: allTransfers.length,
                timestamped: enrichedCount,
                totalTraders: traders.size,
                topTraders: nodes.length,
                totalLinks: filteredLinks.length,
                timestampedLinks: linksWithTimestamp
            }
        };
        cache.set(cacheKey, result);
        res.json(result);
    } catch (error) {
        console.error(`Error in /api/traders for chain ${chain}:`, error);
        res.status(500).json({ error: `Failed to fetch trader data on ${chain}`, details: error.message });
    }
});

export default router;
