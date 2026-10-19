# 🤖 Personal Multi-Modal AI Agent

An intelligent, multi-input, multi-output personal AI Agent running locally on your laptop, controllable remotely from your mobile phone via Telegram, via laptop microphone voice commands, and protected by a background system observer.

---

## 🏛️ Architecture Overview

```
📱 Mobile (Baherun)    💻 Laptop (Mic)      🔍 Background Monitor (Dole)
   [Telegram App]          [Microphone]          [System Logs, Battery, CPU]
         │                      │                          │
    (Text Command)        (Voice Command)            (Auto Alerts / Errors)
         │                      │                          │
         ▼                      ▼                          ▼
 [ telegramEar.js ]      [ voiceEar.js ]            [ observer.js ] (NEW)
         │                      │                          │
         └──────────────────────┼──────────────────────────┘
                                ▼
                         [ index.js ]  <================> 🗄️ [ memory.js ] (NEW)
                       (Main Controller)                      (Prisma + PostgreSQL)
                                │                             [Saves & Reads Past Data]
                                ▼
                        🧠 [ The Brain ]
                       Ollama (Llama 3.2)
                     (Reasoning & Decision)
                                │
         ┌──────────────────────┴──────────────────────┐
         ▼                      ▼                      ▼
    [ tools.js ]        [ Telegram Reply ]    [ Laptop Speaker ]
 (Actions / Tasks)   (Message back to Mobile) (Voice Output/TTS)
```

---

## 📁 Project Structure

```
.
├── index.js                     # Root execution entrypoint
├── package.json                 # Project dependencies & npm scripts
├── .env.example                 # Environment configuration template
├── prisma/
│   └── schema.prisma            # PostgreSQL schema for Conversations, Memories & Alerts
├── src/
│   ├── config.js                # Centralized configuration loader
│   ├── ears/
│   │   ├── telegramEar.js       # Mobile Telegram input listener
│   │   └── voiceEar.js          # Laptop microphone voice input listener & interactive CLI
│   ├── monitors/
│   │   └── observer.js          # Background observer (CPU, Battery, RAM, Disk, Error alerts)
│   ├── controller/
│   │   └── index.js             # Main Controller orchestrating inputs, memory, brain, and outputs
│   ├── memory/
│   │   └── memory.js            # Persistent memory manager (Prisma + PostgreSQL with local fallback)
│   ├── brain/
│   │   └── theBrain.js          # Ollama (Llama 3.2) reasoning & tool-call engine
│   ├── tools/
│   │   └── tools.js             # Action engine (System stats, commands, app launcher, math, etc.)
│   └── mouth/
│       ├── speaker.js           # Laptop Speaker Voice Output (Windows Speech Synthesis)
│       └── telegramReply.js     # Telegram reply & high-priority alert broadcaster
└── data/
    └── memory_store.json        # Resilient local fallback store when Postgres is offline
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js** (v18+)
- **Ollama** installed on your laptop ([Download Ollama](https://ollama.ai))
  ```bash
  ollama run llama3.2
  ```
- **PostgreSQL** (Optional, falls back to `./data/memory_store.json` if offline)

### 2. Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in your configuration:
- `TELEGRAM_BOT_TOKEN`: Get this from [@BotFather](https://t.me/botfather) on Telegram.
- `TELEGRAM_DEFAULT_CHAT_ID`: Your chat ID on Telegram to receive alerts.
- `DATABASE_URL`: PostgreSQL connection URL (e.g., `postgresql://postgres:password@localhost:5432/ai_agent?schema=public`).
- `OLLAMA_HOST`: `http://127.0.0.1:11434`
- `OLLAMA_MODEL`: `llama3.2`

### 3. Initialize Prisma Database (When PostgreSQL is running)
```bash
npm run db:push
npm run db:generate
```

### 4. Run the Agent
```bash
npm start
```

---

## ⚡ Key Capabilities & Components

### 1. 📱 Mobile Ear (`src/ears/telegramEar.js`)
- Receives text and voice commands from your phone via Telegram.
- Supports commands like `/start`, `/help`, and freeform natural queries.

### 2. 💻 Laptop Voice Ear (`src/ears/voiceEar.js`)
- Interactive microphone input listener.
- Automatically routes responses to the Laptop Speaker.

### 3. 🔍 Background Monitor (`src/monitors/observer.js`)
- Continuously tracks:
  - **Battery**: Alerts when battery drops `< 20%` and is unplugged.
  - **CPU**: Alerts when CPU load exceeds `85%`.
  - **RAM**: Alerts when memory exceeds `90%`.
  - **Disk**: Alerts when disk usage exceeds `90%`.
- Emits voice warnings via laptop speakers and sends alert push notifications to Telegram.

### 4. 🗄️ Memory (`src/memory/memory.js`)
- Saves conversation history and facts into PostgreSQL using Prisma.
- Includes automated zero-crash fallback to `./data/memory_store.json` if PostgreSQL is offline or restarting.

### 5. 🧠 The Brain (`src/brain/theBrain.js`)
- Powered by local Ollama running `llama3.2`.
- Reads past memories and conversation history to maintain context.
- Autonomously invokes tools when physical tasks are required.

### 6. 🛠️ Tools Engine (`src/tools/tools.js`)
- `get_system_status`: Real-time CPU, RAM, Battery, Disk stats.
- `run_system_command`: Safe execution of shell commands.
- `open_application`: Launch applications (Notepad, Calculator, Chrome, etc.).
- `get_date_time`: Real-time date and timezone.
- `calculate`: Evaluate mathematical formulas.

### 7. 🔊 Laptop Speaker (`src/mouth/speaker.js`)
- Speaks responses aloud via native Windows Speech Synthesis.
- Configurable speaking rate and volume.