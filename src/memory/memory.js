const fs = require('fs');
const path = require('path');
const config = require('../config');

// Fallback JSON store path if PostgreSQL is offline
const FALLBACK_STORE_DIR = path.join(__dirname, '../../data');
const FALLBACK_STORE_FILE = path.join(FALLBACK_STORE_DIR, 'memory_store.json');

class MemoryManager {
  constructor() {
    this.prisma = null;
    this.isPostgresConnected = false;
    this.localStore = {
      conversations: [],
      memories: {},
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
      console.log('ℹ️ [Memory - Note]: PostgreSQL is not currently connected (' + err.message + ').');
      console.log('   Using graceful local memory store in ./data/memory_store.json until PostgreSQL is active.');
    }
  }

  /**
   * Save a conversation message
   */
  async saveConversation({ source, senderId = null, role, message, metadata = null }) {
    const entry = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      source,
      senderId: senderId ? String(senderId) : null,
      role,
      message,
      metadata,
      createdAt: new Date(),
    };

    if (this.isPostgresConnected && this.prisma) {
      try {
        return await this.prisma.conversation.create({
          data: {
            source,
            senderId: entry.senderId,
            role,
            message,
            metadata: metadata || undefined,
          },
        });
      } catch (err) {
        console.warn('⚠️ [Memory Postgres Error]: Falling back to local store for conversation:', err.message);
      }
    }

    this.localStore.conversations.push(entry);
    // Keep last 100 in local fallback
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
          orderBy: { createdAt: 'desc' },
        });
        return history.reverse();
      } catch (err) {
        console.warn('⚠️ [Memory Postgres Error]: Failed fetching history from DB, using fallback.');
      }
    }

    return this.localStore.conversations.slice(-limit);
  }

  /**
   * Save long term memory / key-value fact
   */
  async saveMemory({ key, value, category = 'general', tags = [] }) {
    if (this.isPostgresConnected && this.prisma) {
      try {
        return await this.prisma.memory.upsert({
          where: { key },
          update: { value, category, tags, updatedAt: new Date() },
          create: { key, value, category, tags },
        });
      } catch (err) {
        console.warn('⚠️ [Memory Postgres Error]: Failed saving memory to DB, using local store.');
      }
    }

    this.localStore.memories[key] = {
      key,
      value,
      category,
      tags,
      updatedAt: new Date(),
    };
    this.persistLocalStore();
    return this.localStore.memories[key];
  }

  /**
   * Get a memory by key
   */
  async getMemory(key) {
    if (this.isPostgresConnected && this.prisma) {
      try {
        return await this.prisma.memory.findUnique({ where: { key } });
      } catch (err) {
        // fallback
      }
    }

    return this.localStore.memories[key] || null;
  }

  /**
   * Get all memories formatted for context injection
   */
  async getAllMemoriesSummary() {
    let memoriesList = [];
    if (this.isPostgresConnected && this.prisma) {
      try {
        memoriesList = await this.prisma.memory.findMany({ take: 30 });
      } catch (err) {
        memoriesList = Object.values(this.localStore.memories);
      }
    } else {
      memoriesList = Object.values(this.localStore.memories);
    }

    if (!memoriesList || memoriesList.length === 0) {
      return 'No prior memories stored yet.';
    }

    return memoriesList
      .map(m => `- [${m.category}] ${m.key}: ${m.value}`)
      .join('\n');
  }

  /**
   * Log an observer system alert
   */
  async saveSystemAlert({ type, level = 'warning', metric = null, message }) {
    const alert = {
      id: 'alert_' + Date.now(),
      type,
      level,
      metric,
      message,
      resolved: false,
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
