const axios = require('axios');
const config = require('../config');
const tools = require('../tools/tools');
const memory = require('../memory/memory');

class TheBrain {
  constructor() {
    this.host = config.ollama.host;
    this.model = config.ollama.model;
  }

  buildSystemPrompt(memoriesSummary) {
    const toolList = JSON.stringify(tools.getToolDefinitions(), null, 2);

    return `You are "The Brain", an advanced personal AI Agent running locally on the user's laptop.
You receive requests from:
1. Mobile (Telegram text & voice commands)
2. Laptop (Microphone voice commands)
3. Background Monitor (System observer alerts: battery, CPU, RAM, disk, logs)

=== STORED MEMORIES & USER PROFILE ===
${memoriesSummary}

=== AVAILABLE TOOLS ===
You can trigger local actions by returning a single JSON object.
Tools available:
${toolList}

=== INSTRUCTIONS FOR OUTPUT ===
- If you need to perform an action, output STRICTLY a JSON object matching this schema:
  {"tool": "tool_name", "args": { ...arguments... }}
- If you do NOT need a tool and have your final answer or response to the user, respond normally in clear, concise, natural language.
- Keep responses friendly, helpful, and concise (since responses may be spoken aloud via the laptop speaker or read on mobile Telegram).`;
  }

  /**
   * Main thinking & reasoning method
   * @param {object} params
   * @param {string} params.input - User or observer text
   * @param {string} params.source - 'telegram' | 'voice' | 'observer'
   * @param {Array} params.history - conversation history
   * @returns {Promise<string>} final response
   */
  async think({ input, source, history = [] }) {
    console.log(`🧠 [The Brain]: Processing incoming message from [${source}]`);

    // 1. Fetch long-term memory context
    const memoriesSummary = await memory.getAllMemoriesSummary();
    const systemPrompt = this.buildSystemPrompt(memoriesSummary);

    // 2. Format messages for Ollama chat
    const formattedMessages = [
      { role: 'system', content: systemPrompt },
    ];

    // Append recent history
    for (const h of history.slice(-6)) {
      const isUser = h.sender === 'User' || h.role === 'user';
      formattedMessages.push({
        role: isUser ? 'user' : 'assistant',
        content: h.message,
      });
    }

    // Append current user message
    formattedMessages.push({ role: 'user', content: input });

    let rawReply = '';
    try {
      const response = await axios.post(
        `${this.host}/api/chat`,
        {
          model: this.model,
          messages: formattedMessages,
          stream: false,
          options: {
            temperature: 0.7,
          },
        },
        { timeout: 45000 }
      );

      rawReply = response.data?.message?.content || '';
    } catch (err) {
      if (err.code === 'ECONNREFUSED' || err.message.includes('ECONNREFUSED')) {
        console.warn(`⚠️ [The Brain]: Ollama is not running at ${this.host}.`);
        return `[Offline Brain Mode]: Ollama (${this.model}) is not running on ${this.host}.\nTo activate Ollama, open your terminal and run:\n  ollama run ${this.model}\n\nI received your request: "${input}".`;
      }
      console.error(`❌ [The Brain Error]: ${err.message}`);
      return `I encountered an issue processing your request through Ollama: ${err.message}`;
    }

    // 3. Check if Llama 3.2 decided to call a tool
    const toolCall = this.parseToolCall(rawReply);
    if (toolCall) {
      console.log(`⚙️ [The Brain]: Decision -> Execute tool "${toolCall.tool}"`);
      const executionResult = await tools.executeTool(toolCall.tool, toolCall.args);

      // Now ask Ollama to synthesize the final answer given the tool output
      const followupMessages = [
        ...formattedMessages,
        { role: 'assistant', content: rawReply },
        {
          role: 'user',
          content: `Tool "${toolCall.tool}" execution result: ${JSON.stringify(executionResult)}.\nPlease formulate the final helpful response for the user.`,
        },
      ];

      try {
        const finalResponse = await axios.post(
          `${this.host}/api/chat`,
          {
            model: this.model,
            messages: followupMessages,
            stream: false,
          },
          { timeout: 45000 }
        );
        return finalResponse.data?.message?.content || JSON.stringify(executionResult);
      } catch (fErr) {
        return `Tool executed: ${JSON.stringify(executionResult)}`;
      }
    }

    return rawReply.trim();
  }

  parseToolCall(text) {
    if (!text) return null;
    try {
      // Look for JSON block or standalone JSON
      const jsonMatch = text.match(/\{[\s\S]*"tool"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.tool) {
          return {
            tool: parsed.tool,
            args: parsed.args || {},
          };
        }
      }
    } catch (e) {
      // Not a valid JSON tool call
    }
    return null;
  }
}

module.exports = new TheBrain();
