// Entrypoint for AI Agent
const controller = require('./src/controller/index');

controller.start().catch((err) => {
  console.error('Fatal initialization error:', err);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down AI Agent gracefully...');
  controller.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  controller.stop();
  process.exit(0);
});
