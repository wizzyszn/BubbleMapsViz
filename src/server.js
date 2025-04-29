// src/server.js
import express from "express";
import dotenv from "dotenv";
import tradersRouter from "./routes/traders.js";
import chainsRouter from "./routes/chains.js";
import memoryRouter from "./routes/memory.js";
import healthRouter from "./routes/health.js";

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

app.use(express.static("public"));

app.use("/api/traders", tradersRouter);
app.use("/api/chains", chainsRouter);
app.use("/memory", memoryRouter);
app.use("/health", healthRouter);

app.use((req, res) => {
    console.log("404 Not Found:", req.url);
    res.status(404).send("Not Found");
});

app.listen(port, () => console.log(`Multi-chain server running on port ${port}`));
