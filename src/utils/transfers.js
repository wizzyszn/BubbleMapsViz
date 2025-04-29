// src/utils/transfers.js
import { getAlchemy } from "./alchemy.js";
import { blockTimestampCache } from "./cache.js";

// Memory-efficient method to find block by timestamp
async function findBlockByTimestamp(targetTimestamp, chain = 'eth') {
    const alchemy = getAlchemy(chain);
    let low = 0;
    let high = await alchemy.core.getBlockNumber();
    let bestBlock = high;
    let bestDiff = Infinity;
    let searchIteration = 0;
    const maxIterations = 30;
    while (low <= high && searchIteration < maxIterations) {
        searchIteration++;
        const mid = Math.floor((low + high) / 2);
        const cacheKey = `block-${chain}-${mid}`;
        let blockData = blockTimestampCache.get(cacheKey);
        let blockTimestamp;
        if (!blockData) {
            try {
                const block = await alchemy.core.getBlock(mid);
                if (!block || !block.timestamp) {
                    low = mid + 1;
                    continue;
                }
                blockTimestamp = block.timestamp;
                blockTimestampCache.set(cacheKey, {
                    timestamp: blockTimestamp,
                    date: new Date(blockTimestamp * 1000).toISOString()
                });
            } catch (error) {
                low = mid + 1;
                continue;
            }
        } else {
            blockTimestamp = blockData.timestamp;
        }
        const diff = Math.abs(blockTimestamp - targetTimestamp);
        if (diff < bestDiff) {
            bestDiff = diff;
            bestBlock = mid;
        }
        if (blockTimestamp > targetTimestamp) {
            high = mid - 1;
        } else if (blockTimestamp < targetTimestamp) {
            low = mid + 1;
        } else {
            return mid;
        }
    }
    return bestBlock;
}

// Optimized batch fetching with memory safeguards
async function fetchTransfersInBatches(params, chain = 'eth') {
    const alchemy = getAlchemy(chain);
    const allTransfers = [];
    let pageKey = undefined;
    let batchCount = 0;
    const maxBatches = 5;
    const batchSize = 3;
    while ((pageKey || batchCount === 0) && batchCount < maxBatches) {
        let batchPromises = [];
        let batchKeys = [];
        for (let i = 0; i < batchSize; i++) {
            if (i > 0 && !pageKey) break;
            const batchParams = { ...params };
            if (pageKey) batchParams.pageKey = pageKey;
            batchPromises.push(
                alchemy.core.getAssetTransfers(batchParams)
                    .then(result => {
                        if (result && result.transfers) {
                            allTransfers.push(...result.transfers);
                            return result.pageKey;
                        }
                        return null;
                    })
                    .catch(() => null)
            );
            batchKeys.push(pageKey);
            if (i > 0) pageKey = batchKeys[i - 1];
            if (!pageKey) break;
        }
        try {
            const results = await Promise.all(batchPromises);
            pageKey = results.filter(Boolean).pop();
            batchCount++;
            if (allTransfers.length >= 3000) break;
            if (pageKey) {
                const delay = 200 + Math.min(allTransfers.length / 100, 300);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        } catch {
            batchCount++;
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        batchPromises = null;
        batchKeys = null;
    }
    return allTransfers;
}

// Timestamp enrichment
async function enrichTransfersWithTimestamps(transfers, chain = 'eth') {
    if (!transfers || transfers.length === 0) return transfers;
    const alchemy = getAlchemy(chain);
    const uniqueBlocks = new Set();
    transfers.forEach(tx => {
        if (tx.blockNum) {
            const blockNum = typeof tx.blockNum === 'string' ? parseInt(tx.blockNum.substring(2), 16) : tx.blockNum;
            uniqueBlocks.add(blockNum);
        }
    });
    const blockTimestamps = new Map();
    const blocksToFetch = [];
    for (const blockNum of uniqueBlocks) {
        const cacheKey = `block-${chain}-${blockNum}`;
        const cachedData = blockTimestampCache.get(cacheKey);
        if (cachedData && cachedData.date) {
            blockTimestamps.set(blockNum, cachedData.date);
        } else {
            blocksToFetch.push(blockNum);
        }
    }
    if (blocksToFetch.length > 0) {
        const chunkSize = 30;
        const concurrentRequests = 5;
        for (let i = 0; i < blocksToFetch.length; i += chunkSize) {
            const chunk = blocksToFetch.slice(i, i + chunkSize);
            for (let j = 0; j < chunk.length; j += concurrentRequests) {
                const concurrentBatch = chunk.slice(j, j + concurrentRequests);
                await Promise.all(concurrentBatch.map(async blockNum => {
                    try {
                        const cacheKey = `block-${chain}-${blockNum}`;
                        const block = await alchemy.core.getBlock(blockNum);
                        if (block && block.timestamp) {
                            const timestamp = new Date(block.timestamp * 1000).toISOString();
                            blockTimestamps.set(blockNum, timestamp);
                            blockTimestampCache.set(cacheKey, {
                                timestamp: block.timestamp,
                                date: timestamp
                            });
                        }
                    } catch { }
                }));
                if (j + concurrentRequests < chunk.length) {
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            }
            if (i + chunkSize < blocksToFetch.length) {
                await new Promise(resolve => setTimeout(resolve, 150));
            }
        }
    }
    for (const tx of transfers) {
        if (tx.blockNum) {
            let blockNum;
            if (typeof tx.blockNum === 'string') {
                blockNum = parseInt(tx.blockNum.substring(2), 16);
            } else {
                blockNum = tx.blockNum;
            }
            const timestamp = blockTimestamps.get(blockNum);
            if (timestamp) {
                tx.timestamp = timestamp;
            }
        }
    }
    return transfers;
}

// Process transfers
function processTransfers(transfers) {
    const traders = new Map();
    const traderTransactions = new Map();
    const linksMap = new Map();
    transfers.forEach(tx => {
        let value;
        if (tx.value === null && tx.rawContract && tx.rawContract.value) {
            const rawValue = tx.rawContract.value;
            const valueInWei = parseInt(rawValue, 16);
            value = valueInWei / 1e18;
        } else {
            value = tx.value ? parseFloat(tx.value) : 0;
        }
        if (value <= 0 || !tx.from || !tx.to) return;
        traders.set(tx.from, (traders.get(tx.from) || 0) - value);
        traders.set(tx.to, (traders.get(tx.to) || 0) + value);
        const linkKey = `${tx.from}-${tx.to}`;
        linksMap.set(linkKey, {
            source: tx.from,
            target: tx.to,
            timestamp: tx.timestamp || null,
            hash: tx.hash,
            value: value
        });
        const txInfo = {
            hash: tx.hash,
            timestamp: tx.timestamp || null,
            value: value
        };
        if (!traderTransactions.has(tx.from)) {
            traderTransactions.set(tx.from, []);
        }
        traderTransactions.get(tx.from).push(txInfo);
        if (!traderTransactions.has(tx.to)) {
            traderTransactions.set(tx.to, []);
        }
        traderTransactions.get(tx.to).push(txInfo);
    });
    return { traders, traderTransactions, linksMap };
}

// Convert time filter to timestamp
function getTimestampFromFilter(timeFilter) {
    const now = Math.floor(Date.now() / 1000);
    switch (timeFilter) {
        case '2h': return now - (2 * 60 * 60);
        case '6h': return now - (6 * 60 * 60);
        case '24h': return now - (24 * 60 * 60);
        case '3d': return now - (3 * 24 * 60 * 60);
        case '7d': return now - (7 * 24 * 60 * 60);
        case '30d': return now - (30 * 24 * 60 * 60);
        default: return null;
    }
}

export {
    findBlockByTimestamp,
    fetchTransfersInBatches,
    enrichTransfersWithTimestamps,
    processTransfers,
    getTimestampFromFilter
};