import { Network, Alchemy } from "alchemy-sdk";
import express from "express";
import dotenv from "dotenv";
import NodeCache from "node-cache";

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;

// Add caching with 15-minute TTL
const cache = new NodeCache({ stdTTL: 900 });

// Add a persistent block-timestamp cache to reduce API calls across requests
const blockTimestampCache = new NodeCache({
    stdTTL: 86400,     // 24 hour TTL for block data
    checkperiod: 600,  // Check for expired keys every 10 minutes
    useClones: false   // Don't clone objects (better memory usage)
});

app.use(express.static('public'));

// Chain mapping for supported networks
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

// Function to initialize Alchemy client for a specific chain
export const AlchemyFunc = (chain) => {
    const config = {
        apiKey: process.env.ALCHEMY_API_KEY,
        network: chainMapper[chain],
    };
    const alchemy = new Alchemy(config);
    return alchemy;
};

// Default to Ethereum if no chain is specified
const getAlchemy = (chain = 'eth') => {
    if (!Object.keys(chainMapper).includes(chain)) {
        console.warn(`Unsupported chain: ${chain}, falling back to Ethereum`);
        return AlchemyFunc('eth');
    }
    return AlchemyFunc(chain);
};

// Memory-efficient method to find block by timestamp
async function findBlockByTimestamp(targetTimestamp, chain = 'eth') {
    try {
        const alchemy = getAlchemy(chain);
        let low = 0;
        let high = await alchemy.core.getBlockNumber();
        let bestBlock = high;
        let bestDiff = Infinity;
        let searchIteration = 0;
        const maxIterations = 30; // Limit search iterations to prevent excessive API calls

        while (low <= high && searchIteration < maxIterations) {
            searchIteration++;
            const mid = Math.floor((low + high) / 2);

            // Check cache first
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

                    // Cache the block data
                    blockTimestampCache.set(cacheKey, {
                        timestamp: blockTimestamp,
                        date: new Date(blockTimestamp * 1000).toISOString()
                    });
                } catch (error) {
                    console.error(`Error fetching block ${mid} on ${chain}:`, error);
                    // If we hit an error, just skip this block
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

        console.log(`Found best block ${bestBlock} on ${chain} after ${searchIteration} iterations, time diff: ${bestDiff} seconds`);
        return bestBlock;
    } catch (error) {
        console.error(`Error finding block on ${chain}:`, error);
        throw new Error(`Failed to find block on ${chain}`);
    }
}

// Optimized batch fetching with memory safeguards
async function fetchTransfersInBatches(params, chain = 'eth') {
    const alchemy = getAlchemy(chain);
    const allTransfers = [];
    let pageKey = undefined;
    let batchCount = 0;
    const maxBatches = 5;
    const batchSize = 3; // Smaller batch size for stability

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
                    .catch(error => {
                        console.error(`Error in transfer batch ${batchCount}:${i} on ${chain}:`, error);
                        return null;
                    })
            );

            batchKeys.push(pageKey);
            if (i > 0) pageKey = batchKeys[i - 1];
            if (!pageKey) break;
        }

        try {
            const results = await Promise.all(batchPromises);
            pageKey = results.filter(Boolean).pop();

            batchCount++;
            console.log(`Fetched batch ${batchCount} on ${chain}, total transfers: ${allTransfers.length}`);
            //tweak the below for optimizations
            if (allTransfers.length >= 3000) {
                console.log('Reached transfer limit, stopping fetch');
                break;
            }

            if (pageKey) {
                // Adaptive throttling - increase delay for larger batches
                const delay = 200 + Math.min(allTransfers.length / 100, 300);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        } catch (error) {
            console.error(`Error processing batch ${batchCount} on ${chain}:`, error);
            // Continue with next batch even if this one failed
            batchCount++;
            await new Promise(resolve => setTimeout(resolve, 500)); // Longer delay after error
        }

        // Free memory
        batchPromises = null;
        batchKeys = null;
    }

    return allTransfers;
}

// Improved timestamp enrichment function for stability and completeness
async function enrichTransfersWithTimestamps(transfers, chain = 'eth') {
    if (!transfers || transfers.length === 0) return transfers;

    const alchemy = getAlchemy(chain);
    console.log(`Starting timestamp enrichment for ${transfers.length} transfers on ${chain}`);

    // Step 1: Extract all unique block numbers
    const uniqueBlocks = new Set();
    let blocksWithoutTimestamp = 0;

    transfers.forEach(tx => {
        if (tx.blockNum) {
            const blockNum = typeof tx.blockNum === 'string' ? parseInt(tx.blockNum.substring(2), 16) : tx.blockNum;
            uniqueBlocks.add(blockNum);
        } else {
            blocksWithoutTimestamp++;
        }
    });

    if (blocksWithoutTimestamp > 0) {
        console.log(`Note: ${blocksWithoutTimestamp} transfers without block numbers on ${chain}`);
    }

    console.log(`Found ${uniqueBlocks.size} unique blocks to process on ${chain}`);

    // Step 2: Build a map of block numbers to timestamps, using cache where possible
    const blockTimestamps = new Map();
    const blocksToFetch = [];

    // Check which blocks we already have in cache
    for (const blockNum of uniqueBlocks) {
        const cacheKey = `block-${chain}-${blockNum}`;
        const cachedData = blockTimestampCache.get(cacheKey);

        if (cachedData && cachedData.date) {
            blockTimestamps.set(blockNum, cachedData.date);
        } else {
            blocksToFetch.push(blockNum);
        }
    }

    console.log(`Found ${blockTimestamps.size} blocks in cache, need to fetch ${blocksToFetch.length} blocks on ${chain}`);

    // Step 3: Fetch timestamps for blocks not in cache, with controlled concurrency
    if (blocksToFetch.length > 0) {
        // Process in smaller batches with increased concurrency
        const chunkSize = 30; // Increased from 20
        const concurrentRequests = 5; // Process 5 blocks at once

        for (let i = 0; i < blocksToFetch.length; i += chunkSize) {
            const chunk = blocksToFetch.slice(i, i + chunkSize);
            console.log(`Processing block chunk ${Math.floor(i / chunkSize) + 1}/${Math.ceil(blocksToFetch.length / chunkSize)} on ${chain}`);

            // Process the chunk in smaller concurrent batches
            for (let j = 0; j < chunk.length; j += concurrentRequests) {
                const concurrentBatch = chunk.slice(j, j + concurrentRequests);

                try {
                    // Create promises for each block in the concurrent batch
                    const promises = concurrentBatch.map(blockNum => {
                        return new Promise(async (resolve) => {
                            try {
                                const cacheKey = `block-${chain}-${blockNum}`;
                                const block = await alchemy.core.getBlock(blockNum);

                                if (block && block.timestamp) {
                                    const timestamp = new Date(block.timestamp * 1000).toISOString();
                                    blockTimestamps.set(blockNum, timestamp);

                                    // Cache the result
                                    blockTimestampCache.set(cacheKey, {
                                        timestamp: block.timestamp,
                                        date: timestamp
                                    });
                                }
                                resolve();
                            } catch (error) {
                                console.error(`Error fetching block ${blockNum} on ${chain}:`, error);
                                resolve(); // Resolve anyway to continue processing
                            }
                        });
                    });

                    // Wait for all promises in this concurrent batch to complete
                    await Promise.all(promises);

                    // Small delay between concurrent batches
                    if (j + concurrentRequests < chunk.length) {
                        await new Promise(resolve => setTimeout(resolve, 50));
                    }
                } catch (error) {
                    console.error(`Error processing concurrent batch in chunk ${Math.floor(i / chunkSize) + 1} on ${chain}:`, error);
                    // Continue with the next batch
                }
            }

            // Add a delay between chunks to prevent rate limiting
            if (i + chunkSize < blocksToFetch.length) {
                await new Promise(resolve => setTimeout(resolve, 150));
            }
        }
    }

    // Step 4: Apply timestamps to all transfers more efficiently
    let timestamped = 0;
    let missing = 0;

    for (const tx of transfers) {
        if (tx.blockNum) {
            // Handle different block number formats
            let blockNum;
            if (typeof tx.blockNum === 'string') {
                // Convert hex string to number
                blockNum = parseInt(tx.blockNum.substring(2), 16);
            } else {
                blockNum = tx.blockNum;
            }

            const timestamp = blockTimestamps.get(blockNum);

            if (timestamp) {
                tx.timestamp = timestamp;
                timestamped++;
            } else {
                missing++;
            }
        }
    }

    console.log(`Timestamp enrichment complete on ${chain}: ${timestamped} transfers timestamped, ${missing} missing timestamps`);

    // Attempt recovery for missing timestamps if transaction hash is available
    if (missing > 0 && timestamped > 0) {
        console.log(`Attempting to recover timestamps for ${missing} transfers using transaction details on ${chain}`);
        await recoverMissingTimestamps(transfers, chain);
    }

    return transfers;
}

// Improved recovery function for missing timestamps
async function recoverMissingTimestamps(transfers, chain = 'eth') {
    const alchemy = getAlchemy(chain);
    // Find transfers that have a hash but no timestamp
    const missingTimestampTransfers = transfers.filter(tx => !tx.timestamp && tx.hash);

    if (missingTimestampTransfers.length === 0) {
        return;
    }

    console.log(`Attempting to recover timestamps for ${missingTimestampTransfers.length} transfers on ${chain}`);

    // Increase MAX_RECOVER for better coverage
    const MAX_RECOVER = 200; // Up from 50
    const transfersToRecover = missingTimestampTransfers.slice(0, MAX_RECOVER);

    // Process in batches with higher concurrency
    const batchSize = 10; // Up from 5
    const concurrentRequests = 3; // Process 3 transactions at once
    let recovered = 0;

    for (let i = 0; i < transfersToRecover.length; i += batchSize) {
        const batch = transfersToRecover.slice(i, i + batchSize);

        // Process the batch in concurrent requests
        for (let j = 0; j < batch.length; j += concurrentRequests) {
            const concurrentBatch = batch.slice(j, j + concurrentRequests);

            const promises = concurrentBatch.map(tx => {
                return new Promise(async (resolve) => {
                    try {
                        // Try to get the transaction by hash
                        const txData = await alchemy.core.getTransaction(tx.hash);

                        if (txData && txData.blockNumber) {
                            // If we got the block number, try to get the block
                            const blockNum = txData.blockNumber;
                            const cacheKey = `block-${chain}-${blockNum}`;

                            // Check cache first
                            let blockData = blockTimestampCache.get(cacheKey);

                            if (!blockData) {
                                const block = await alchemy.core.getBlock(blockNum);

                                if (block && block.timestamp) {
                                    const timestamp = new Date(block.timestamp * 1000).toISOString();

                                    // Cache the result
                                    blockTimestampCache.set(cacheKey, {
                                        timestamp: block.timestamp,
                                        date: timestamp
                                    });

                                    // Update the transaction
                                    tx.timestamp = timestamp;
                                    tx.blockNum = blockNum;
                                    recovered++;
                                }
                            } else {
                                // Use cached timestamp
                                tx.timestamp = blockData.date;
                                tx.blockNum = blockNum;
                                recovered++;
                            }
                        }
                        resolve();
                    } catch (error) {
                        console.error(`Error recovering timestamp for tx ${tx.hash} on ${chain}:`, error);
                        resolve(); // Continue even if this one fails
                    }
                });
            });

            await Promise.all(promises);

            // Small delay between concurrent batches
            if (j + concurrentRequests < batch.length) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }

        // Add a delay between batches
        if (i + batchSize < transfersToRecover.length) {
            await new Promise(resolve => setTimeout(resolve, 150));
        }
    }

    console.log(`Timestamp recovery complete on ${chain}: recovered ${recovered} out of ${transfersToRecover.length} timestamps`);
}

// Process transfers stream efficiently
function processTransfers(transfers) {
    const traders = new Map();
    const traderTransactions = new Map();
    const linksMap = new Map();

    // Process transfers in a single pass
    transfers.forEach(tx => {
        // Extract value from rawContract if value is null
        let value;
        if (tx.value === null && tx.rawContract && tx.rawContract.value) {
            // Convert hex value to decimal and adjust for decimals
            // WBNB uses 18 decimals like ETH
            const rawValue = tx.rawContract.value;
            const valueInWei = parseInt(rawValue, 16);
            value = valueInWei / 1e18; // Convert to full token units
        } else {
            value = tx.value ? parseFloat(tx.value) : 0;
        }

        if (value <= 0 || !tx.from || !tx.to) return;

        // Update volume for sender
        traders.set(tx.from, (traders.get(tx.from) || 0) - value);

        // Update volume for receiver
        traders.set(tx.to, (traders.get(tx.to) || 0) + value);

        // Add link with timestamp
        const linkKey = `${tx.from}-${tx.to}`;

        // Store the link with its timestamp
        linksMap.set(linkKey, {
            source: tx.from,
            target: tx.to,
            timestamp: tx.timestamp || null,
            hash: tx.hash,
            value: value
        });

        // Track transactions for each trader
        const txInfo = {
            hash: tx.hash,
            timestamp: tx.timestamp || null,
            value: value // Use the calculated value here
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

    console.log(`After proper processing: Found ${traders.size} traders`);
    return { traders, traderTransactions, linksMap };
}

// Convert time filter to timestamp
function getTimestampFromFilter(timeFilter) {
    const now = Math.floor(Date.now() / 1000);

    switch (timeFilter) {
        case '2h':
            return now - (2 * 60 * 60);
        case '6h':
            return now - (6 * 60 * 60);
        case '24h':
            return now - (24 * 60 * 60);
        case '3d':
            return now - (3 * 24 * 60 * 60);
        case '7d':
            return now - (7 * 24 * 60 * 60);
        case '30d':
            return now - (30 * 24 * 60 * 60);
        default:
            return null; // For 'all' time, return null to indicate no time filtering
    }
}

// Updated API endpoint to accept chain parameter
app.get('/api/traders', async (req, res) => {
    const { address, time = 'all', chain = 'eth' } = req.query;

    /* if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
         return res.status(400).json({ error: 'Invalid contract address' });
     }
         */

    // Validate chain parameter
    if (!Object.keys(chainMapper).includes(chain)) {
        return res.status(400).json({
            error: 'Invalid chain parameter',
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
            category: ['erc20'],
            maxCount: 1,
        });
        console.log("Token Activity: ", tokenActivity)
        if (!tokenActivity.transfers.length) {
            return res.status(400).json({ error: `No recent activity for this token on ${chain}` });
        }

        // Determine block range using more precise timestamp-based approach
        let fromBlock = '0x0';

        // Handle all time filters using the same approach
        if (['2h', '6h', '24h', '3d', '7d', '30d'].includes(time)) {
            const targetTimestamp = getTimestampFromFilter(time);

            // Find the block closest to the target timestamp
            console.log(`Finding block for ${time} filter (timestamp ${targetTimestamp}) on ${chain}...`);
            const blockNumber = await findBlockByTimestamp(targetTimestamp, chain);
            fromBlock = `0x${blockNumber.toString(16)}`;
            console.log(`Using ${time} filter with timestamp ${targetTimestamp}, found block ${blockNumber} on ${chain}`);
        }

        // Fetch transfers with optimized batching
        const params = {
            contractAddresses: [address],
            category: ['erc20'],
            fromBlock,
            toBlock: 'latest',
            maxCount: 1000,
        };

        console.log(`Fetching transfers from block ${fromBlock} to latest on ${chain}`);
        let allTransfers = await fetchTransfersInBatches(params, chain);

        if (!allTransfers.length) {
            return res.json({
                nodes: [],
                links: [],
                message: `No valid transfers found for this token on ${chain} in the selected time period.`
            });
        }

        console.log(`Fetched ${allTransfers.length} transfers on ${chain}, processing...`);

        // First identify top traders without timestamps
        const { traders } = processTransfers(allTransfers);

        // Get top 100 traders
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

        // Create a set of top trader addresses
        const topTraderIds = new Set(sortedTraders.map(t => t.id));

        // Filter transfers to only include ones between top traders
        const relevantTransfers = allTransfers.filter(tx =>
            topTraderIds.has(tx.from) && topTraderIds.has(tx.to)
        );

        console.log(`Found ${relevantTransfers.length} transfers between top traders on ${chain}`);

        // Process all transfers in batches for timestamp enrichment
        const BATCH_SIZE = 1000; // Adjust based on your server's capacity
        console.log(`Starting timestamp enrichment for all ${allTransfers.length} transfers in batches on ${chain}...`);

        let enrichedCount = 0;
        // Create a map to track which transfers have timestamps
        const transferTimestamps = new Map();

        // Process transfers in batches to avoid memory issues
        for (let i = 0; i < allTransfers.length; i += BATCH_SIZE) {
            const batchEnd = Math.min(i + BATCH_SIZE, allTransfers.length);
            console.log(`Processing timestamp batch ${i / BATCH_SIZE + 1}/${Math.ceil(allTransfers.length / BATCH_SIZE)} (transfers ${i}-${batchEnd - 1}) on ${chain}`);

            const transfersBatch = allTransfers.slice(i, batchEnd);

            // First, prioritize relevant transfers in this batch
            const relevantBatch = transfersBatch.filter(tx =>
                topTraderIds.has(tx.from) && topTraderIds.has(tx.to)
            );

            if (relevantBatch.length > 0) {
                console.log(`Enriching ${relevantBatch.length} relevant transfers in this batch on ${chain}`);
                await enrichTransfersWithTimestamps(relevantBatch, chain);

                // Add enriched transfers to our map
                for (const tx of relevantBatch) {
                    if (tx.timestamp) {
                        transferTimestamps.set(tx.hash, tx.timestamp);
                        enrichedCount++;
                    }
                }
            }

            // Then process remaining transfers in this batch that don't have timestamps yet
            const remainingBatch = transfersBatch.filter(tx => !transferTimestamps.has(tx.hash));

            if (remainingBatch.length > 0) {
                console.log(`Enriching ${remainingBatch.length} remaining transfers in this batch on ${chain}`);
                await enrichTransfersWithTimestamps(remainingBatch, chain);

                // Add newly enriched transfers to our map
                for (const tx of remainingBatch) {
                    if (tx.timestamp) {
                        transferTimestamps.set(tx.hash, tx.timestamp);
                        enrichedCount++;
                    }
                }
            }

            // Free memory
            if (i + BATCH_SIZE < allTransfers.length) {
                // Add a delay between batches to prevent overloading
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }

        console.log(`Total transfers enriched with timestamps on ${chain}: ${enrichedCount}/${allTransfers.length}`);

        // Apply the timestamps to all transfers
        for (const tx of allTransfers) {
            const timestamp = transferTimestamps.get(tx.hash);
            if (timestamp) {
                tx.timestamp = timestamp;
            }
        }

        // Process all transfers with timestamps
        const processedData = processTransfers(allTransfers);

        // Classify whales (top 25%) vs. retail
        const volumeThreshold = sortedTraders.length >= 4 ?
            Math.abs(sortedTraders[Math.floor(sortedTraders.length * 0.25)].volume) :
            Math.abs(sortedTraders[0].volume) / 2;

        // Create nodes with transaction data, but limit transactions per node
        const MAX_TX_PER_NODE = 50;
        const nodes = sortedTraders.map(node => {
            const transactions = (processedData.traderTransactions.get(node.id) || [])
                .slice(0, MAX_TX_PER_NODE);

            return {
                ...node,
                type: Math.abs(node.volume) >= volumeThreshold ? 'whale' : 'retail',
                transactions: transactions
            };
        });

        // Create valid links between traders in our top 100
        const validIds = new Set(nodes.map(n => n.id));
        const filteredLinks = Array.from(processedData.linksMap.values())
            .filter(link => validIds.has(link.source) && validIds.has(link.target));

        // Count links with and without timestamps
        const linksWithTimestamp = filteredLinks.filter(link => link.timestamp !== null).length;
        console.log(`Links with timestamp on ${chain}: ${linksWithTimestamp}/${filteredLinks.length}`);

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

        // Cache the result
        cache.set(cacheKey, result);

        res.json(result);
    } catch (error) {
        console.error(`Error in /api/traders for chain ${chain}:`, error);
        res.status(500).json({ error: `Failed to fetch trader data on ${chain}`, details: error.message });
    }
});

// Get supported chains endpoint
app.get('/api/chains', (req, res) => {
    res.json({
        supportedChains: Object.keys(chainMapper),
        defaultChain: 'eth'
    });
});

// Memory usage endpoint for monitoring
app.get('/memory', (req, res) => {
    const used = process.memoryUsage();
    const usage = {
        rss: `${Math.round(used.rss / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)} MB`,
        external: `${Math.round(used.external / 1024 / 1024)} MB`,
        cacheStats: {
            blockTimestampCacheSize: blockTimestampCache.getStats().keys,
            requestCacheSize: cache.getStats().keys
        }
    };
    res.json(usage);
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

app.use((req, res) => {
    console.log('404 Not Found:', req.url);
    res.status(404).send('Not Found');
});

app.listen(port, () => console.log(`Multi-chain server running on port ${port}`));