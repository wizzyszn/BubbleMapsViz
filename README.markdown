# Top Token Traders Bubble Tool

## Overview

The **Top Token Traders Bubble Tool** is a Telegram Web App that visualizes the top traders of ERC20 tokens on the Ethereum blockchain using an interactive bubble map. It fetches real-time transaction data via the Alchemy API and renders it with D3.js, allowing users to explore token trading activity within a specified time frame. The tool was developed to meet bounty requirements for a cryptocurrency analytics challenge, providing an intuitive interface for traders and enthusiasts to analyze market trends.

The project integrates a Telegram bot for user interaction, a Node.js Express server for data processing, and a frontend built with pure HTML, CSS, and JavaScript (using D3.js for visualization). It is hosted on a platform like Render. The bubble map displays traders as bubbles, with size representing trading volume and color indicating activity frequency.

## Features

- **Real-Time Data**: Fetches ERC20 token transfer events using Alchemy’s Ethereum API, filtered by block timestamps.
- **Interactive Visualization**: Renders a bubble map with D3.js, where each bubble represents a trader, sized by trading volume and colored by transaction frequency.
- **Telegram Integration**: Accessible via a Telegram bot, allowing users to input token addresses and time ranges.
- **Responsive Design**: Styled with CSS for a seamless experience on mobile and desktop.
- **Customizable Filters**: Users can specify token addresses and time ranges (e.g., last 24 hours) to analyze trading activity.

## Prerequisites

- **Node.js**: Version 18.x or higher.
- **Alchemy API Key**: Obtain from [Alchemy](https://www.alchemy.com/) for Ethereum data access.
- **Telegram Bot Token**: Create a bot via [BotFather](https://t.me/BotFather) on Telegram.
- **Git**: For cloning the repository.
- **Hosting Platform**: Render, Vercel, or similar for deployment.

## Installation

1. **Clone the Repository**:

   ```bash
   git clone https://github.com/your-username/top-token-traders-bubble-tool.git
   cd top-token-traders-bubble-tool
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
   top-token-traders-bubble-tool/
   ├── public/                # Static frontend files
   │   ├── index.html         # Main HTML file
   │   ├── styles.css         # CSS styles
   │   ├── script.js             # JavaScript logic and D3.js visualization
   │   └── assets/            # Images,favicon, etc.
   ├── server.js              # Node.js Express server API endpoints and Alchemy integration
   ├── bot.js                 # Telegram Bot 
   ├── .env                   # Environment variables
   ├── package.json           # Project dependencies
   └── README.md              # This file
   ```

## Usage

1. **Run Locally**: Start the server to serve the frontend and API:

   ```bash
   npm start
   ```

   The app will be available at `http://localhost:3000`.

2. **Interact via Telegram**:

   - Start the Telegram bot by messaging `/start` to your bot.
   - Use the command `/bubblemaps <token_address> <hours>` (e.g., `/bubblemaps 0xdac17f958d2ee523a2206206994597c13d831ec7`) to fetch and visualize top traders for a token (like USDT) over the specified time (in hours).
   - The bot responds with a link to the Web App displaying the bubble map.

3. **Explore the Visualization**:

   - The bubble map shows top traders, with bubble size indicating trading volume and color indicating transaction frequency.
   - Hover over bubbles to see details like wallet address and total volume.
   - Use the interface to adjust time ranges or switch tokens via input fields.

## Technical Details

### Backend (server.js)

- **Framework**: Node.js with Express.
- **Data Source**: Alchemy SDK to fetch ERC20 token transfer events.
- **Logic**:
  - Queries transfer events using `alchemy.core.getLogs` with block timestamp filters.
  - Processes logs to aggregate trading volume and frequency per wallet.
  - Serves aggregated data via a `/api/traders` endpoint.
- **Optimizations**:
  - Caches recent queries to reduce API calls.
  - Handles Alchemy rate limits by batching requests and retrying on failure.

**Example Endpoint**:

```http
GET /api/traders?token=0xdac17f958d2ee523a2206206994597c13d831ec7&hours=24
```

Returns JSON with trader data:

```json
[
  { "address": "0x...", "volume": 1000000, "transactions": 50 },
  ...
]
```

### Frontend (HTML, CSS, JavaScript)

- **Structure**: A single `index.html` file serves as the entry point, styled with `styles.css` and powered by `app.js`.
- **Visualization**: D3.js renders a force-directed bubble map in an SVG element.
- **Styling**: CSS provides responsive design with a clean layout, using media queries for mobile compatibility.
- **Logic**:
  - Fetches trader data from the backend API using `fetch`.
  - Maps data to bubbles, with size scaled by volume and color by transaction count.
  - Implements hover effects and tooltips for interactivity.

### Telegram Bot

- **Library**: Telegraf.js for bot development.
- **Functionality**:
  - Handles `/start` and `/analyze` commands.
  - Validates user input (token address and hours).
  - Generates a Web App link with query parameters for the frontend.

### Deployment

- **Platform**: Deployed on Render for simplicity.
- **Steps**:
  1. Push code to a GitHub repository.
  2. Create a new Web Service on Render, linking to the repository.
  3. Set environment variables (`ALCHEMY_API_KEY`, `TELEGRAM_BOT_TOKEN`, `PORT`) in Render’s dashboard.
  4. Configure the build command (`npm install`) and start command (`npm start`).
- **Post-Deployment**:
  - Verify API endpoints (`/api/traders`) are accessible.
  - Ensure static files (from `/public`) are served correctly.
  - Test Telegram bot integration by sending commands.

## Troubleshooting

- **No Data for Token**: Ensure the token address is a valid ERC20 contract (e.g., USDT: `0xdac17f958d2ee523a2206206994597c13d831ec7`). Check block range and Alchemy API key validity.
- **Rate Limit Errors**: Monitor Alchemy usage in their dashboard. Adjust batch sizes in `server.js` or implement exponential backoff.
- **Visualization Issues**: Verify D3.js data mapping. Log `data` in `app.js` to ensure correct format.
- **Telegram Web App Fails**: Confirm the bot token is set and the Web App URL is registered with BotFather.

## Future Improvements

- Add support for multiple blockchains (e.g., Solana, BNB Chain).
- Implement advanced filters (e.g., minimum transaction size).
- Enhance visualization with zoom and pan capabilities.
- Integrate caching with Redis for faster API responses.
- Add client-side input validation for better UX.

## License

This project is licensed under the MIT License. See the LICENSE file for details.

## Acknowledgments

- **Alchemy**: For providing robust Ethereum API access.
- **D3.js**: For powerful data visualization capabilities.
- **Telegraf**: For seamless Telegram bot development.
- **Render**: For easy deployment and hosting.

For issues or questions, please open an issue on the GitHub repository or contact the maintainer.