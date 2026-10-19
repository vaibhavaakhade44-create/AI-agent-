require('dotenv').config();

module.exports = {
  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN || '',
    defaultChatId: process.env.TELEGRAM_DEFAULT_CHAT_ID || '',
  },
  ollama: {
    host: process.env.OLLAMA_HOST || 'http://127.0.0.1:11434',
    model: process.env.OLLAMA_MODEL || 'llama3.2',
  },
  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ai_agent?schema=public',
  },
  observer: {
    intervalSeconds: parseInt(process.env.OBSERVER_CHECK_INTERVAL_SECONDS || '30', 10),
    cpuThreshold: parseFloat(process.env.CPU_ALERT_THRESHOLD_PERCENT || '85'),
    ramThreshold: parseFloat(process.env.RAM_ALERT_THRESHOLD_PERCENT || '90'),
    batteryThreshold: parseFloat(process.env.BATTERY_LOW_THRESHOLD_PERCENT || '20'),
  },
  speaker: {
    enabled: process.env.SPEAKER_ENABLED !== 'false',
    rate: parseInt(process.env.SPEAKER_RATE || '0', 10),
    volume: parseInt(process.env.SPEAKER_VOLUME || '100', 10),
  },
};
