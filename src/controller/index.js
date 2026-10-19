const config = require('../config');
const telegramEar = require('../ears/telegramEar');
const voiceEar = require('../ears/voiceEar');
const observer = require('../monitors/observer');
const theBrain = require('../brain/theBrain');
const memory = require('../memory/memory');
const speaker = require('../mouth/speaker');
const telegramReply = require('../mouth/telegramReply');

class MainController {
  constructor() {
    this.isRunning = false;
  }

  async start() {
    console.log('====================================================');
    console.log('🚀 AI AGENT SYSTEM STARTING...');
    console.log('====================================================');
    console.log(`📱 Telegram Bot: ${config.telegram.token ? 'Configured' : 'Unconfigured (Add token to .env)'}`);
    console.log(`🧠 Brain Engine: Ollama (${config.ollama.model}) at ${config.ollama.host}`);
    console.log(`🗄️ Database:     Prisma + PostgreSQL (${config.database.url.split('@')[1] || 'Configured'})`);
    console.log(`🔍 Observer:     Checking battery, CPU, RAM every ${config.observer.intervalSeconds}s`);
    console.log(`🔊 Speaker:      Windows Speech Synthesis (Enabled: ${config.speaker.enabled})`);
    console.log('====================================================\n');

    // 1. Wire Telegram Ear (Mobile)
    telegramEar.on('command', async (event) => {
      await this.handleIncomingCommand(event);
    });

    // 2. Wire Voice Ear (Laptop Mic)
    voiceEar.on('command', async (event) => {
      await this.handleIncomingCommand(event);
    });

    // 3. Wire Observer (Background System Monitor)
    observer.on('alert', async (alert) => {
      await this.handleObserverAlert(alert);
    });

    // Start all ears and background observers
    telegramEar.start();
    voiceEar.start();
    observer.start();

    this.isRunning = true;
    console.log('✨ [Main Controller]: All systems operational and ready for commands!\n');
  }

  async handleIncomingCommand({ source, senderId, userName, command, replyCallback }) {
    console.log(`\n📥 [Controller Received]: [${source.toUpperCase()}] from "${userName}": "${command}"`);

    try {
      // 1. Save user query to persistent memory
      await memory.saveConversation({
        sender: 'User',
        message: command,
      });

      // 2. Retrieve recent history for context
      const history = await memory.getRecentConversations(8);

      // 3. Ask The Brain (Ollama Llama 3.2)
      const assistantReply = await theBrain.think({
        input: command,
        source,
        history,
      });

      // 4. Save assistant response to persistent memory
      await memory.saveConversation({
        sender: 'Jarvis',
        message: assistantReply,
      });

      // 5. Send reply back to original requester (Mobile Telegram or Laptop Mic/Speaker)
      if (replyCallback) {
        await replyCallback(assistantReply);
      }
    } catch (err) {
      console.error('❌ [Controller Execution Error]:', err.message);
      const errorMsg = `Sorry, an error occurred while processing: ${err.message}`;
      if (replyCallback) {
        await replyCallback(errorMsg);
      }
    }
  }

  async handleObserverAlert(alert) {
    console.log(`\n🚨 [Controller - System Alert]: ${alert.type.toUpperCase()} -> ${alert.message}`);

    // Speak aloud on laptop speaker
    await speaker.speak(`Alert: ${alert.message}`);

    // Send notification to mobile on Telegram
    await telegramReply.sendAlert(
      `${alert.type.toUpperCase()} Warning`,
      alert.message
    );
  }

  stop() {
    telegramEar.stop();
    voiceEar.stop();
    observer.stop();
    this.isRunning = false;
    console.log('🛑 [Main Controller]: AI Agent stopped.');
  }
}

module.exports = new MainController();
