const config = require('../config');

class TelegramReply {
  constructor() {
    this.bot = null;
    this.defaultChatId = config.telegram.defaultChatId;
  }

  setBot(bot) {
    this.bot = bot;
  }

  /**
   * Send text reply back to mobile on Telegram
   * @param {string|number} chatId - target Telegram chat ID
   * @param {string} text - message content
   * @param {object} options - extra telegram options
   */
  async sendMessage(chatId, text, options = {}) {
    const targetChatId = chatId || this.defaultChatId;
    if (!this.bot || !targetChatId) {
      console.log(`📱 [Telegram Reply (Mock/No Bot)]: To [${targetChatId || 'Unset'}]: ${text}`);
      return false;
    }

    try {
      await this.bot.sendMessage(targetChatId, text, {
        parse_mode: 'Markdown',
        ...options,
      });
      console.log(`📱 [Telegram Reply Sent]: To [${targetChatId}]: ${text.slice(0, 80)}...`);
      return true;
    } catch (err) {
      // Fallback without parse_mode if markdown parsing fails
      try {
        await this.bot.sendMessage(targetChatId, text, options);
        return true;
      } catch (innerErr) {
        console.error('❌ [Telegram Reply Error]:', innerErr.message);
        return false;
      }
    }
  }

  /**
   * Broadcast high-priority alert to default chat
   */
  async sendAlert(title, message) {
    const formatted = `🚨 *[AI AGENT ALERT]*: ${title}\n\n${message}`;
    return this.sendMessage(this.defaultChatId, formatted);
  }
}

module.exports = new TelegramReply();
