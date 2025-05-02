# Top Token Traders Bubble Tool

> **Note:** This app can be used in two ways:
>
> - As a **Telegram Web App** via the bot [@bubble_viz_bot](https://t.me/bubble_viz_bot)
> - As a **standalone web dashboard** (SPA) rendered by the Express server at [https://bubblemapsviz.onrender.com/](https://bubblemapsviz.onrender.com/)

## Demo Video
Click on the screenshot below👇 to see the demo on Youtube.
[![Watch the demo](./assets/images/Screenshot%20(329).png)](https://youtu.be/mDeC0j1BDxs)
## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Usage](#usage)
- [Technical Details](#technical-details)
  - [Backend (server.js)](#backend-serverjs)
  - [Algorithm: Trader Volume Calculation](#algorithm-trader-volume-calculation)
  - [Frontend (HTML, CSS, JavaScript)](#frontend-html-css-javascript)
  - [Telegram Bot](#telegram-bot)
  - [Custom UI/UX Features](#custom-uiux-features)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Future Improvements](#future-improvements)
- [License](#license)
- [Acknowledgments](#acknowledgments)

## Overview

The **Top Token Traders Bubble Tool** is a Telegram Web App and web dashboard that visualizes the top traders of ERC20 tokens (and other supported chains) using an interactive bubble map. It fetches real-time transaction data via the Alchemy API and renders it with D3.js, allowing users to explore token trading activity within a specified time frame. The tool was developed for a cryptocurrency analytics challenge, providing an intuitive interface for traders and enthusiasts to analyze market trends.

The project integrates a Telegram bot for user interaction, a Node.js Express server for data processing, and a frontend built with HTML, CSS, and JavaScript (using D3.js for visualization). The bubble map displays traders as bubbles, with size representing trading volume and color indicating activity frequency/type.

## Features

- **Real-Time Data**: Fetches ERC20 token transfer events using Alchemy’s API, filtered by block timestamps.
- **Interactive Visualization**: Renders a bubble map with D3.js, where each bubble represents a trader, sized by trading volume and colored by trader type (whale/retail).
- **Telegram Integration**: Accessible via a Telegram bot, allowing users to input token addresses and time ranges.
- **Responsive Design**: Styled for a seamless experience on mobile and desktop.
- **Customizable Filters**: Users can specify token addresses, chains, and time ranges (e.g., last 24 hours) to analyze trading activity.
- **Zoom & Pan**: Custom zoom controls for the bubble map.

## Prerequisites

- **Node.js**: Version 18.x or higher.
- **Alchemy API Key**: Obtain from [Alchemy](https://www.alchemy.com/) for blockchain data access.
- **Telegram Bot Token**: Create a bot via [BotFather](https://t.me/BotFather) on Telegram.
- **Git**: For cloning the repository.
- **Hosting Platform**: Render, Vercel, or similar for deployment.

## Installation

1. **Clone the Repository**:

   ```bash
   git clone https://github.com/wizzyszn/BubbleMapsViz.git
   cd BubbleMapsViz
   ```

2. **Install Dependencies**:

   ```bash
   npm install
   ```

3. **Set Up Environment Variables**: Create a `.env` file in the root directory with the following:

   ```
   ALCHEMY_API_KEY=your_alchemy_api_key
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token
   PORT=3000
   ```

4. **Directory Structure**:

   ```
   BubbleMapsViz/
   ├── public/                # Static frontend files
   │   ├── index.html         # Main HTML file
   │   ├── style.css          # CSS styles (with custom scrollbar)
   │   ├── js/                # Modular JS (main.js, ui.js, etc.)
   │   └── assets/            # Images, favicon, etc.
   ├── src/                   # Express server, API routes, and backend utilities
   │   ├── server.js          # Node.js Express server API endpoints and Alchemy integration
   │   ├── routes/            # API route handlers (traders.js, chains.js, etc.)
   │   └── utils/             # Backend utility modules (alchemy.js, cache.js, transfers.js)
   ├── services/              # (Present, purpose not documented)
   ├── bot.js                 # Telegram Bot
   ├── .env                   # Environment variables
   ├── package.json           # Project dependencies
   └── README.markdown        # This file
   ```

## Usage

1. **Run Locally**: Start the server to serve the frontend and API:

   ```bash
   npm start
   ```

   The app will be available at `http://localhost:3000`.

2. **Interact via Telegram**:

   - Start the Telegram bot by messaging `/start` to your bot.
   - Use the command `/bubblemaps <chain> <token_address>` (e.g., `/bubblemaps eth 0xdac17f958d2ee523a2206206994597c13d831ec7`) to fetch and visualize top traders for a token.
   - The bot responds with a link to the Web App displaying the bubble map.

3. **Explore the Visualization**:

   - The bubble map shows top traders, with bubble size indicating trading volume and color indicating trader type.
   - Hover over bubbles to see details like wallet address and total volume.
   - Use the interface to adjust time ranges, switch tokens, or change chains.
   - Click a bubble to view detailed info and recent transactions.

## Technical Details

### Backend (server.js)

- **Framework**: Node.js with Express.
- **Data Source**: Alchemy SDK to fetch ERC20 token transfer events.
- **Logic**:
  - Queries transfer events using `alchemy.core.getAssetTransfers` with block timestamp filters.
  - Processes logs to aggregate trading volume and frequency per wallet.
  - Serves aggregated data via a `/api/traders` endpoint.
- **Optimizations**:
  - Caches recent queries to reduce API calls.
  - Handles Alchemy rate limits by batching requests and retrying on failure.
  - Uses in-memory cache for block timestamps to minimize redundant lookups.
  - Supports multiple chains (Ethereum, BNB, Arbitrum, etc.).

### Algorithm: Trader Volume Calculation

- **Volume Calculation**:
  - For each transfer, the sender's volume is **decreased** by the transfer value (negative volume), and the receiver's volume is **increased** by the transfer value (positive volume).
  - This means:
    - **Positive volume**: The trader is a net receiver (accumulated more tokens than sent).
    - **Negative volume**: The trader is a net sender (sent out more tokens than received).
  - Example:
    - If Alice sends 100 tokens to Bob, Alice's volume is -100, Bob's is +100.
  - The top traders are ranked by the absolute value of their net volume (regardless of direction).
  - The top 25% by absolute volume are classified as **whales**; others are **retail**.
- **Link Construction**:
  - Only transfers between the top 100 traders are visualized as links.
  - Each link includes source, target, value, timestamp, and transaction hash.
- **Transaction Enrichment**:
  - Each node (trader) includes up to 50 recent transactions for detail display.
  - Timestamps are enriched using block lookups and cached for efficiency.

### Frontend (HTML, CSS, JavaScript)

- **Structure**: Modular JS (`main.js`, `ui.js`, etc.), single-page app.
- **Visualization**: D3.js renders a force-directed bubble map in an SVG element.
- **Styling**: CSS provides responsive design, custom scrollbars, and a modern look.
- **Logic**:
  - Fetches trader data from the backend API using `fetch`.
  - Maps data to bubbles, with size scaled by volume and color by trader type.
  - Implements hover effects, tooltips, and a detail panel.
  - Custom zoom controls and cluster/reset layout features.

### Telegram Bot

- **Library**: Telegraf.js for bot development.
- **Functionality**:
  - Handles `/start` and `/bubblemaps` commands.
  - Validates user input (chain and token address).
  - Generates a Web App link with query parameters for the frontend.

### UI/UX Features

- **Detail Panel**: Enhanced with a header-close button, address copy, and transaction list.
- **Zoom Controls**: Floating controls for zoom in/out/reset.
- **Cluster by Type**: Group bubbles by whale/retail.
- **Responsive**: Works on desktop and mobile.

## Deployment

- **Platform**: Deployed on Render, Vercel, or similar.
- **Steps**:
  1. Push code to a GitHub repository.
  2. Create a new Web Service on your platform, linking to the repository.
  3. Set environment variables (`ALCHEMY_API_KEY`, `TELEGRAM_BOT_TOKEN`, `PORT`).
  4. Configure the build command (`npm install`) and start command (`npm start`).
- **Post-Deployment**:
  - Verify API endpoints (`/api/traders`) are accessible.
  - Ensure static files (from `/public`) are served correctly.
  - Test Telegram bot integration by sending commands.

## Troubleshooting

- **No Data for Token**: Ensure the token address is a valid ERC20 contract. Check block range and Alchemy API key validity.
- **Rate Limit Errors**: Monitor Alchemy usage. Adjust batch sizes or implement exponential backoff.
- **Visualization Issues**: Verify D3.js data mapping. Log `data` in the console to ensure correct format.
- **Telegram Web App Fails**: Confirm the bot token is set and the Web App URL is registered with BotFather.

## Future Improvements

- Add support for more blockchains (e.g., Solana).
- Implement advanced filters (e.g., minimum transaction size).
- Enhance visualization with more analytics and export options.
- Integrate persistent caching (e.g., Redis) for faster API responses.
- Add client-side input validation for better UX.

## License

This project is licensed under the MIT License. See the LICENSE file for details.

## Acknowledgments

- **Alchemy**: For providing robust blockchain API access.
- **D3.js**: For powerful data visualization capabilities.
- **Telegraf**: For seamless Telegram bot development.
- **Render**: For easy deployment and hosting.

For issues or questions, please open an issue on the GitHub repository.
