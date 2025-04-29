// api.js
import { config } from './config.js';

export async function fetchTraderData(tokenAddress, timeFilter, selectedChain) {
    const url = `${config.apiUrl}?address=${tokenAddress}&time=${timeFilter}&chain=${selectedChain}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`API responded with status: ${response.status}`);
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    return data;
}
