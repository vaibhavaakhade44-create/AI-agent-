const EventEmitter = require('events');
const readline = require('readline');
const speaker = require('../mouth/speaker');

class VoiceEar extends EventEmitter {
  constructor() {
    super();
    this.rl = null;
    this.isActive = false;
  }

  /**
   * Start listening for voice commands from laptop microphone.
   * Also binds an interactive terminal prompt so the user can test speech / voice commands directly.
   */
  start() {
    this.isActive = true;
    console.log('🎤 [Voice Ear - Laptop Mic]: Ready and listening.');
    console.log('   (Tip: Type voice commands below and press ENTER to simulate microphone input)');

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '🎤 [Laptop Voice Command] > ',
    });

    this.rl.prompt();

    this.rl.on('line', (line) => {
      const cleanLine = line.trim();
      if (!cleanLine) {
        this.rl.prompt();
        return;
      }

      console.log(`🎙️ [Voice Ear captured]: "${cleanLine}"`);

      this.emit('command', {
        source: 'voice',
        senderId: 'laptop_mic',
        userName: 'Local User',
        command: cleanLine,
        replyCallback: async (replyText) => {
          console.log(`\n🤖 [Agent Response]:\n${replyText}\n`);
          // Voice output back through laptop speaker
          await speaker.speak(replyText);
          if (this.isActive && this.rl) {
            this.rl.prompt();
          }
        },
      });
    });

    this.rl.on('close', () => {
      this.isActive = false;
    });
  }

  stop() {
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
    this.isActive = false;
    console.log('🎤 [Voice Ear]: Stopped.');
  }
}

module.exports = new VoiceEar();
