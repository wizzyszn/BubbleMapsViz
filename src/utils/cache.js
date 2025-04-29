// src/utils/cache.js
import NodeCache from "node-cache";

export const cache = new NodeCache({ stdTTL: 900 });
export const blockTimestampCache = new NodeCache({
    stdTTL: 86400,
    checkperiod: 600,
    useClones: false
});
