const fs = require('fs');
const path = require('path');
const os = require('os');
const si = require('systeminformation');
const { exec } = require('child_process');

class ToolRegistry {
  constructor() {
    this.tools = {};
    this.screenshotsDir = path.join(__dirname, '../../screenshots');
    this.ensureDirectories();
    this.registerBuiltinTools();
  }

  ensureDirectories() {
    if (!fs.existsSync(this.screenshotsDir)) {
      fs.mkdirSync(this.screenshotsDir, { recursive: true });
    }
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
    // 1. System Health Status
    this.registerTool(
      'get_system_status',
      'Get real-time laptop health: CPU, RAM, Battery, Disk, and OS info',
      {},
      async () => {
        const [cpu, mem, battery, disk, osInfo] = await Promise.all([
          si.currentLoad(),
          si.mem(),
          si.battery(),
          si.fsSize(),
          si.osInfo(),
        ]);

        const primaryDisk = disk[0] || {};
        return {
          os: `${osInfo.distro} ${osInfo.release} (${osInfo.arch})`,
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

    // 2. Open Application
    this.registerTool(
      'open_application',
      'Open any application on the laptop (e.g. notepad, calc, chrome, vscode, spotify, explorer, taskmgr)',
      { appName: 'string (name of application to open)' },
      async ({ appName }) => {
        if (!appName) throw new Error('appName is required');
        const cleanName = appName.toLowerCase().trim();
        const knownApps = {
          notepad: 'notepad.exe',
          calculator: 'calc.exe',
          calc: 'calc.exe',
          chrome: 'start chrome',
          browser: 'start chrome',
          vscode: 'code',
          code: 'code',
          explorer: 'explorer.exe',
          files: 'explorer.exe',
          taskmgr: 'taskmgr.exe',
          'task manager': 'taskmgr.exe',
          settings: 'start ms-settings:',
          cmd: 'start cmd.exe',
          terminal: 'start wt.exe',
          spotify: 'start spotify:',
        };
        const command = knownApps[cleanName] || `start ${appName}`;
        return new Promise((resolve) => {
          exec(`cmd /c "${command}"`, (err) => {
            if (err) {
              resolve({ success: false, error: err.message });
            } else {
              resolve({ success: true, message: `Successfully opened ${appName}` });
            }
          });
        });
      }
    );

    // 3. Close Application
    this.registerTool(
      'close_application',
      'Close a running application on the laptop (e.g. notepad, chrome, calc)',
      { appName: 'string (name of application to close)' },
      async ({ appName }) => {
        if (!appName) throw new Error('appName is required');
        const clean = appName.toLowerCase().replace('.exe', '').trim();
        const targets = {
          notepad: 'notepad.exe',
          calculator: 'CalculatorApp.exe',
          calc: 'CalculatorApp.exe',
          chrome: 'chrome.exe',
          code: 'Code.exe',
          vscode: 'Code.exe',
          spotify: 'Spotify.exe',
        };
        const procName = targets[clean] || `${clean}.exe`;
        return new Promise((resolve) => {
          exec(`taskkill /IM "${procName}" /F`, (err, stdout) => {
            if (err) {
              resolve({ success: false, message: `Could not close ${appName}. Process may not be running.` });
            } else {
              resolve({ success: true, message: `Closed ${appName} successfully.` });
            }
          });
        });
      }
    );

    // 4. Open Website in Browser
    this.registerTool(
      'open_website',
      'Open a specific website or URL in the default web browser',
      { url: 'string (the URL to open, e.g. "https://youtube.com")' },
      async ({ url }) => {
        if (!url) throw new Error('url is required');
        let fullUrl = url.trim();
        if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
          fullUrl = 'https://' + fullUrl;
        }
        return new Promise((resolve) => {
          exec(`start "" "${fullUrl}"`, (err) => {
            if (err) resolve({ success: false, error: err.message });
            else resolve({ success: true, message: `Opened ${fullUrl}` });
          });
        });
      }
    );

    // 5. Search Google
    this.registerTool(
      'search_google',
      'Search for any topic or query on Google in the web browser',
      { query: 'string (what to search for)' },
      async ({ query }) => {
        if (!query) throw new Error('query is required');
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        return new Promise((resolve) => {
          exec(`start "" "${searchUrl}"`, (err) => {
            if (err) resolve({ success: false, error: err.message });
            else resolve({ success: true, message: `Searching Google for: "${query}"` });
          });
        });
      }
    );

    // 6. Volume Control
    this.registerTool(
      'control_volume',
      'Control laptop master audio volume: up, down, or mute',
      { action: 'string: "up" | "down" | "mute"' },
      async ({ action }) => {
        const act = (action || 'up').toLowerCase();
        // 175 = Volume Up, 174 = Volume Down, 173 = Mute
        let key = 175;
        let count = 5;
        if (act === 'down') key = 174;
        if (act === 'mute') {
          key = 173;
          count = 1;
        }

        const script = `powershell -NoProfile -Command "$w = New-Object -ComObject WScript.Shell; 1..${count} | ForEach-Object { $w.SendKeys([char]${key}) }"`;
        return new Promise((resolve) => {
          exec(script, (err) => {
            if (err) resolve({ success: false, error: err.message });
            else resolve({ success: true, message: `Volume action '${act}' executed.` });
          });
        });
      }
    );

    // 7. Media Control (Play/Pause, Next, Previous)
    this.registerTool(
      'media_control',
      'Control media playback on laptop: play_pause, next, previous',
      { action: 'string: "play_pause" | "next" | "previous"' },
      async ({ action }) => {
        const act = (action || 'play_pause').toLowerCase();
        // 179 = Play/Pause, 176 = Next Track, 177 = Previous Track
        let key = 179;
        if (act === 'next') key = 176;
        if (act === 'previous' || act === 'prev') key = 177;

        const script = `powershell -NoProfile -Command "$w = New-Object -ComObject WScript.Shell; $w.SendKeys([char]${key})"`;
        return new Promise((resolve) => {
          exec(script, (err) => {
            if (err) resolve({ success: false, error: err.message });
            else resolve({ success: true, message: `Media action '${act}' executed.` });
          });
        });
      }
    );

    // 8. Take Desktop Screenshot
    this.registerTool(
      'take_screenshot',
      'Take a full-screen screenshot of the laptop display and save it',
      {},
      async () => {
        const filename = `screenshot_${Date.now()}.png`;
        const filepath = path.join(this.screenshotsDir, filename);

        const psScript = `powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing; $b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds; $bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height; $g = [System.Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen($b.Location, [System.Drawing.Point]::Empty, $b.Size); $bmp.Save('${filepath.replace(/\\/g, '\\\\')}', [System.Drawing.Imaging.ImageFormat]::Png); $g.Dispose(); $bmp.Dispose();"`;

        return new Promise((resolve) => {
          exec(psScript, (err) => {
            if (err) {
              resolve({ success: false, error: err.message });
            } else {
              resolve({
                success: true,
                message: `Screenshot captured and saved to ${filepath}`,
                filepath,
                filename,
              });
            }
          });
        });
      }
    );

    // 9. Lock Laptop Workstation
    this.registerTool(
      'lock_laptop',
      'Immediately lock the laptop workstation for security',
      {},
      async () => {
        return new Promise((resolve) => {
          exec('rundll32.exe user32.dll,LockWorkStation', (err) => {
            if (err) resolve({ success: false, error: err.message });
            else resolve({ success: true, message: 'Laptop workstation locked.' });
          });
        });
      }
    );

    // 10. Clipboard Manager
    this.registerTool(
      'clipboard_manager',
      'Read or write text to the Windows clipboard',
      { action: 'string: "read" | "write"', text: 'string (optional, text to write)' },
      async ({ action, text }) => {
        if (action === 'write' && text) {
          const safeText = text.replace(/'/g, "''");
          return new Promise((resolve) => {
            exec(`powershell -NoProfile -Command "Set-Clipboard -Value '${safeText}'"`, (err) => {
              if (err) resolve({ success: false, error: err.message });
              else resolve({ success: true, message: `Copied to clipboard: "${text}"` });
            });
          });
        }

        return new Promise((resolve) => {
          exec('powershell -NoProfile -Command "Get-Clipboard"', (err, stdout) => {
            if (err) resolve({ success: false, error: err.message });
            else resolve({ success: true, clipboardContent: (stdout || '').trim() });
          });
        });
      }
    );

    // 11. List Directory / Files
    this.registerTool(
      'list_files',
      'List files and folders in a location (e.g. "Desktop", "Downloads", "Documents")',
      { folder: 'string: "Desktop" | "Downloads" | "Documents" | path' },
      async ({ folder = 'Desktop' }) => {
        let targetPath = folder;
        const userHome = os.homedir();
        if (folder.toLowerCase() === 'desktop') targetPath = path.join(userHome, 'Desktop');
        if (folder.toLowerCase() === 'downloads') targetPath = path.join(userHome, 'Downloads');
        if (folder.toLowerCase() === 'documents') targetPath = path.join(userHome, 'Documents');

        try {
          if (!fs.existsSync(targetPath)) {
            return { error: `Folder ${targetPath} does not exist.` };
          }
          const items = fs.readdirSync(targetPath).slice(0, 25);
          return { folder: targetPath, count: items.length, items };
        } catch (err) {
          return { error: err.message };
        }
      }
    );

    // 12. Safe Shell Command
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

    // 13. Date & Time
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

    // 14. Math Calculation
    this.registerTool(
      'calculate',
      'Perform mathematical computation safely',
      { expression: 'string (math expression, e.g. "45 * 12 + 100")' },
      async ({ expression }) => {
        if (!expression) throw new Error('Expression is required');
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
