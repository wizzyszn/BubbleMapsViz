// src/routes/memory.js
import express from "express";
import { cache, blockTimestampCache } from "../utils/cache.js";

const router = express.Router();

router.get("/", (req, res) => {
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

export default router;
