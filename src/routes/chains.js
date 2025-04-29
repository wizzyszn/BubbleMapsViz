// src/routes/chains.js
import express from "express";
import { chainMapper } from "../utils/alchemy.js";

const router = express.Router();

router.get("/", (req, res) => {
    res.json({
        supportedChains: Object.keys(chainMapper),
        defaultChain: "eth"
    });
});

export default router;
