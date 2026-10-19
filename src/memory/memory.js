const fs = require('fs');
const path = require('path');
const config = require('../config');

// Fallback JSON store path if PostgreSQL is offline or credentials need updating
const FALLBACK_STORE_DIR = path.join(__dirname, '../../data');
const FALLBACK_STORE_FILE = path.join(FALLBACK_STORE_DIR, 'memory_store.json');

class MemoryManager {
  constructor() {
    this.prisma = null;
    this.isPostgresConnected = false;
    this.localStore = {
      conversations: [],
      memories: [],
      systemAlerts: [],
    };
    this.initFallbackStore();
    this.initPrisma();
  }

  initFallbackStore() {
    try {
      if (!fs.existsSync(FALLBACK_STORE_DIR)) {
        fs.mkdirSync(FALLBACK_STORE_DIR, { recursive: true });
      }
      if (fs.existsSync(FALLBACK_STORE_FILE)) {
        const raw = fs.readFileSync(FALLBACK_STORE_FILE, 'utf8');
        this.localStore = JSON.parse(raw);
        if (!Array.isArray(this.localStore.memories)) {
          this.localStore.memories = [];
        }
      } else {
        this.persistLocalStore();
      }
    } catch (err) {
      console.warn('⚠️ [Memory Fallback Warning]: Could not initialize local fallback store:', err.message);
    }
  }

  persistLocalStore() {
    try {
      fs.writeFileSync(FALLBACK_STORE_FILE, JSON.stringify(this.localStore, null, 2), 'utf8');
    } catch (err) {
      console.error('❌ [Memory Persist Error]:', err.message);
    }
  }

  async initPrisma() {
    try {
      const { PrismaClient } = require('@prisma/client');
      this.prisma = new PrismaClient({
        datasources: {
          db: {
            url: config.database.url,
          },
        },
      });

      // Test connection with timeout
      await this.prisma.$connect();
      this.isPostgresConnected = true;
      console.log('✅ [Memory - PostgreSQL]: Connected successfully via Prisma.');
    } catch (err) {
      this.isPostgresConnected = false;
      console.log('ℹ️ [Memory - PostgreSQL Status]: Connection pending (' + (err.message.split('\n')[0] || 'Check credentials') + ').');
      console.log('   Using resilient JSON backup in ./data/memory_store.json until PostgreSQL password is added to .env');
    }
  }

  /**
   * Save a conversation message
   * @param {object} param
   * @param {string} param.sender - 'User' | 'Jarvis'
   * @param {string} param.message - Chat text
   */
  async saveConversation({ sender = 'User', message = '' }) {
    const entry = {
      id: Date.now(),
      sender,
      message,
      timestamp: new Date(),
    };

    if (this.isPostgresConnected && this.prisma) {
      try {
        return await this.prisma.conversation.create({
          data: {
            sender,
            message,
          },
        });
      } catch (err) {
        console.warn('⚠️ [Memory Postgres Error]: Falling back to local store for conversation.');
      }
    }

    this.localStore.conversations.push(entry);
    if (this.localStore.conversations.length > 100) {
      this.localStore.conversations = this.localStore.conversations.slice(-100);
    }
    this.persistLocalStore();
    return entry;
  }

  /**
   * Get recent conversation history
   */
  async getRecentConversations(limit = 10) {
    if (this.isPostgresConnected && this.prisma) {
      try {
        const history = await this.prisma.conversation.findMany({
          take: limit,
          orderBy: { timestamp: 'desc' },
        });
        return history.reverse();
      } catch (err) {
        console.warn('⚠️ [Memory Postgres Error]: Failed fetching history from DB, using fallback.');
      }
    }

    return this.localStore.conversations.slice(-limit);
  }

  /**
   * Save long term memory / topic fact
   * @param {object} param
   * @param {string} param.topic - e.g. "Clinic Project Folder"
   * @param {string} param.content - e.g. "D:/Projects/Clinic"
   */
  async saveMemory({ topic, content }) {
    if (this.isPostgresConnected && this.prisma) {
      try {
        return await this.prisma.memory.create({
          data: {
            topic,
            content,
          },
        });
      } catch (err) {
        console.warn('⚠️ [Memory Postgres Error]: Failed saving memory to DB, using local store.');
      }
    }

    const memoryItem = {
      id: Date.now(),
      topic,
      content,
      createdAt: new Date(),
    };
    this.localStore.memories.push(memoryItem);
    this.persistLocalStore();
    return memoryItem;
  }

  /**
   * Get memory by topic
   */
  async getMemoryByTopic(topic) {
    if (this.isPostgresConnected && this.prisma) {
      try {
        return await this.prisma.memory.findFirst({
          where: { topic: { contains: topic, mode: 'insensitive' } },
        });
      } catch (err) {
        // fallback
      }
    }

    return this.localStore.memories.find(m => m.topic && m.topic.toLowerCase().includes(topic.toLowerCase())) || null;
  }

  /**
   * Get all memories formatted for context injection
   */
  async getAllMemoriesSummary() {
    let memoriesList = [];
    if (this.isPostgresConnected && this.prisma) {
      try {
        memoriesList = await this.prisma.memory.findMany({ take: 30, orderBy: { createdAt: 'desc' } });
      } catch (err) {
        memoriesList = this.localStore.memories;
      }
    } else {
      memoriesList = this.localStore.memories;
    }

    if (!memoriesList || memoriesList.length === 0) {
      return 'No prior memories stored yet.';
    }

    return memoriesList
      .map(m => `- [${m.topic}]: ${m.content}`)
      .join('\n');
  }

  /**
   * Log an observer system alert
   */
  async saveSystemAlert({ type, level = 'warning', metric = null, message }) {
    const alert = {
      id: Date.now(),
      type,
      level,
      metric,
      message,
      createdAt: new Date(),
    };

    if (this.isPostgresConnected && this.prisma) {
      try {
        return await this.prisma.systemAlert.create({
          data: {
            type,
            level,
            metric: metric ? parseFloat(metric) : null,
            message,
          },
        });
      } catch (err) {
        // fallback
      }
    }

    this.localStore.systemAlerts.push(alert);
    if (this.localStore.systemAlerts.length > 50) {
      this.localStore.systemAlerts = this.localStore.systemAlerts.slice(-50);
    }
    this.persistLocalStore();
    return alert;
  }
}

module.exports = new MemoryManager();
