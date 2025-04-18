import { Telegraf } from "telegraf";
import dotenv from "dotenv"
dotenv.config();
const bot = new Telegraf(process.env.BOT_TOKEN);

bot.command('start', (ctx) => {
  ctx.reply('Welcome! Use /bubblemaps <contract_address> to visualize top traders.');
});

bot.command('bubblemaps', (ctx) => {
  const args = ctx.message.text.split(' ');
  const contractAddress = args[1];

  if (!contractAddress || !/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
    return ctx.reply('Please provide a valid Ethereum contract address.');
  }

  ctx.reply('View top traders:', {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: 'Open Bubble Map',
            web_app: { url: `https://bubblemapsviz.onrender.com/?address=${contractAddress}` },
          },
        ],
      ],
    },
  });
});

bot.launch().then(() => console.log('Bot is running...'));
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));