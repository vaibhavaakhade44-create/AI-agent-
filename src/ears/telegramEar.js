const EventEmitter = require('events');
const TelegramBot = require('node-telegram-bot-api');
const config = require('../config');
const telegramReply = require('../mouth/telegramReply');

class TelegramEar extends EventEmitter {
  constructor() {
    super();
    this.bot = null;
    this.token = config.telegram.token;
  }

  start() {
    if (!this.token || this.token === 'your_telegram_bot_token_here') {
      console.log('📱 [Telegram Ear]: No TELEGRAM_BOT_TOKEN provided in .env.');
      console.log('   Add your bot token to .env to connect your Mobile Telegram App.');
      return;
    }

    try {
      this.bot = new TelegramBot(this.token, { polling: true });
      telegramReply.setBot(this.bot);

      console.log('📱 [Telegram Ear]: Connected and listening for Mobile commands...');

      // Handle text messages
      this.bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        const text = msg.text;

        // Remember user's chat ID
        if (!config.telegram.defaultChatId) {
          config.telegram.defaultChatId = chatId;
        }

        if (text) {
          if (text === '/start') {
            await this.bot.sendMessage(
              chatId,
              '👋 *Welcome to your Personal AI Agent!*\n\nI am connected to your laptop. You can ask me to run tasks, check laptop stats, take notes, or open apps.\n\nTry sending:\n- `What is the battery and CPU status?`\n- `What time is it?`\n- `Calculate 55 * 340`',
              { parse_mode: 'Markdown' }
            );
            return;
          }

          if (text === '/help') {
            await this.bot.sendMessage(
              chatId,
              '🛠️ *Commands & Abilities*:\n- Send any natural language question or command\n- System monitoring (battery, cpu, ram, disk)\n- Run shell commands\n- Save memory & facts',
              { parse_mode: 'Markdown' }
            );
            return;
          }

          console.log(`📱 [Telegram Ear - Incoming]: "${text}" from Chat ${chatId} (${msg.from?.first_name || 'User'})`);
          this.emit('command', {
            source: 'telegram',
            senderId: chatId,
            userName: msg.from?.first_name || 'Telegram User',
            command: text,
            replyCallback: async (replyText) => {
              await telegramReply.sendMessage(chatId, replyText);
            },
          });
        } else if (msg.voice) {
          console.log(`🎤 [Telegram Ear]: Received voice message from Chat ${chatId}`);
          await this.bot.sendMessage(chatId, '🎙️ Received your voice note. Processing...');
          this.emit('command', {
            source: 'telegram',
            senderId: chatId,
            userName: msg.from?.first_name || 'Telegram User',
            command: '[Voice note received from Telegram user]',
            replyCallback: async (replyText) => {
              await telegramReply.sendMessage(chatId, replyText);
            },
          });
        }
      });

      this.bot.on('polling_error', (error) => {
        if (error.code === 'EFATAL' || error.message.includes('401')) {
          console.error('❌ [Telegram Ear Polling Error]: Invalid Telegram Bot Token. Please check .env');
          this.bot.stopPolling();
        }
      });
    } catch (err) {
      console.error('❌ [Telegram Ear Init Error]:', err.message);
    }
  }

  stop() {
    if (this.bot) {
      this.bot.stopPolling();
      console.log('📱 [Telegram Ear]: Polling stopped.');
    }
  }
}

module.exports = new TelegramEar();
