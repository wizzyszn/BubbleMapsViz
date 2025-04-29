import { Telegraf } from "telegraf";
import dotenv from "dotenv"
dotenv.config();
const bot = new Telegraf(process.env.BOT_TOKEN);

bot.command('start', (ctx) => {
  ctx.reply('🌟 Dive into the trading universe!\n\n🚀 Use /bubblemaps <chain> <contract_address> to uncover and visualize the top traders in action! 💸');
});
bot.command('bubblemaps', (ctx) => {
  const args = ctx.message.text.split(' ');
  const contractAddress = args[2];
  const chain = args[1]

  ctx.reply('View top traders:', {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: 'Open Bubble Map',
            web_app: { url: `https://bubblemapsviz.onrender.com/?address=${contractAddress}&chain=${chain}` },
          },
        ],
      ],
    },
  });
});

bot.launch().then(() => console.log('Bot is running...'));
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));