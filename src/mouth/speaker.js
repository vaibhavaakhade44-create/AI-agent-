const { exec } = require('child_process');
const config = require('../config');

class Speaker {
  constructor() {
    this.enabled = config.speaker.enabled;
    this.rate = config.speaker.rate;
    this.volume = config.speaker.volume;
    this.isSpeaking = false;
  }

  /**
   * Speak a message using Windows native SpeechSynthesizer via PowerShell
   * @param {string} text - text to say aloud through laptop speaker
   * @returns {Promise<boolean>}
   */
  async speak(text) {
    if (!this.enabled || !text) {
      return false;
    }

    // Clean text of quotes and harmful chars for powershell
    const cleanText = text
      .replace(/["`$]/g, '')
      .replace(/\r?\n|\r/g, ' ')
      .trim();

    if (!cleanText) return false;

    console.log(`🔊 [Laptop Speaker]: "${cleanText}"`);

    return new Promise((resolve) => {
      this.isSpeaking = true;
      const psCommand = `powershell -NoProfile -Command "Add-Type -AssemblyName System.Speech; $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer; $synth.Rate = ${this.rate}; $synth.Volume = ${this.volume}; $synth.Speak('${cleanText.replace(/'/g, "''")}');"`;

      exec(psCommand, { windowsHide: true }, (error) => {
        this.isSpeaking = false;
        if (error) {
          console.error(`⚠️ [Speaker Error]: ${error.message}`);
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }
}

module.exports = new Speaker();
