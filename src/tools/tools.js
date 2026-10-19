const si = require('systeminformation');
const { exec } = require('child_process');

class ToolRegistry {
  constructor() {
    this.tools = {};
    this.registerBuiltinTools();
  }

  registerTool(name, description, parameters, handler) {
    this.tools[name] = {
      name,
      description,
      parameters,
      handler,
    };
  }

  getToolDefinitions() {
    return Object.values(this.tools).map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));
  }

  async executeTool(name, args = {}) {
    const tool = this.tools[name];
    if (!tool) {
      return { error: `Tool "${name}" not found.` };
    }
    try {
      console.log(`🛠️ [Tool Invocation]: ${name}(${JSON.stringify(args)})`);
      const result = await tool.handler(args);
      return { success: true, result };
    } catch (err) {
      console.error(`❌ [Tool Error - ${name}]:`, err.message);
      return { error: err.message };
    }
  }

  registerBuiltinTools() {
    // Tool 1: System Status
    this.registerTool(
      'get_system_status',
      'Get real-time computer health: CPU, RAM, Battery, Disk, and OS info',
      {},
      async () => {
        const [cpu, mem, battery, disk, os] = await Promise.all([
          si.currentLoad(),
          si.mem(),
          si.battery(),
          si.fsSize(),
          si.osInfo(),
        ]);

        const primaryDisk = disk[0] || {};
        return {
          os: `${os.distro} ${os.release} (${os.arch})`,
          cpuUsagePercent: cpu.currentLoad.toFixed(1) + '%',
          memoryUsage: {
            totalMB: (mem.total / 1024 / 1024).toFixed(0),
            usedMB: (mem.used / 1024 / 1024).toFixed(0),
            freeMB: (mem.free / 1024 / 1024).toFixed(0),
            percentUsed: ((mem.used / mem.total) * 100).toFixed(1) + '%',
          },
          battery: {
            hasBattery: battery.hasBattery,
            percent: battery.percent + '%',
            isCharging: battery.isCharging,
          },
          disk: {
            mount: primaryDisk.mount || 'C:',
            sizeGB: ((primaryDisk.size || 0) / 1024 / 1024 / 1024).toFixed(1),
            usedGB: ((primaryDisk.used || 0) / 1024 / 1024 / 1024).toFixed(1),
            percentUsed: (primaryDisk.use || 0).toFixed(1) + '%',
          },
        };
      }
    );

    // Tool 2: Execute safe command
    this.registerTool(
      'run_system_command',
      'Execute a system command in the local environment',
      { command: 'string (the shell command to run)' },
      async ({ command }) => {
        if (!command) throw new Error('Command is required');
        return new Promise((resolve) => {
          exec(command, { timeout: 15000, windowsHide: true }, (err, stdout, stderr) => {
            if (err) {
              resolve({ exitCode: err.code || 1, error: err.message, stderr: stderr ? stderr.slice(0, 1000) : '' });
            } else {
              resolve({ stdout: stdout ? stdout.slice(0, 2000) : '', stderr: stderr ? stderr.slice(0, 500) : '' });
            }
          });
        });
      }
    );

    // Tool 3: Open Application
    this.registerTool(
      'open_application',
      'Open a native application on the laptop (e.g. notepad, calc, chrome, explorer)',
      { appName: 'string (name of application)' },
      async ({ appName }) => {
        if (!appName) throw new Error('appName is required');
        const knownApps = {
          notepad: 'notepad.exe',
          calculator: 'calc.exe',
          calc: 'calc.exe',
          explorer: 'explorer.exe',
          chrome: 'start chrome',
          browser: 'start chrome',
          terminal: 'start wt.exe',
          cmd: 'start cmd.exe',
        };
        const target = knownApps[appName.toLowerCase()] || `start ${appName}`;
        return new Promise((resolve) => {
          exec(`cmd /c "${target}"`, (err) => {
            if (err) {
              resolve({ success: false, error: err.message });
            } else {
              resolve({ success: true, message: `Opened ${appName}` });
            }
          });
        });
      }
    );

    // Tool 4: Get Date & Time
    this.registerTool(
      'get_date_time',
      'Get the current date, time, day, and timezone of the laptop system',
      {},
      async () => {
        const now = new Date();
        return {
          iso: now.toISOString(),
          localeString: now.toLocaleString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          date: now.toDateString(),
          time: now.toLocaleTimeString(),
        };
      }
    );

    // Tool 5: Math Calculation
    this.registerTool(
      'calculate',
      'Perform mathematical computation safely',
      { expression: 'string (math expression, e.g. "45 * 12 + 100")' },
      async ({ expression }) => {
        if (!expression) throw new Error('Expression is required');
        // Only allow digits, math operators, parens, decimal
        if (!/^[0-9+\-*/().\s^%]+$/.test(expression)) {
          throw new Error('Invalid mathematical characters in expression.');
        }
        // eslint-disable-next-line no-eval
        const result = Function(`'use strict'; return (${expression})`)();
        return { expression, result };
      }
    );
  }
}

module.exports = new ToolRegistry();
