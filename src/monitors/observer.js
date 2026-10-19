const EventEmitter = require('events');
const si = require('systeminformation');
const config = require('../config');
const memory = require('../memory/memory');

class Observer extends EventEmitter {
  constructor() {
    super();
    this.intervalSeconds = config.observer.intervalSeconds || 30;
    this.cpuThreshold = config.observer.cpuThreshold || 85;
    this.ramThreshold = config.observer.ramThreshold || 90;
    this.batteryThreshold = config.observer.batteryThreshold || 20;
    this.timer = null;
    this.lastAlertTimes = {};
    this.COOLDOWN_MS = 5 * 60 * 1000; // 5 minute cooldown between duplicate alerts
  }

  start() {
    console.log(`🔍 [Observer - Background Monitor]: Started. Checking system every ${this.intervalSeconds}s...`);
    this.check();
    this.timer = setInterval(() => this.check(), this.intervalSeconds * 1000);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('🔍 [Observer]: Stopped.');
    }
  }

  canSendAlert(key) {
    const now = Date.now();
    const last = this.lastAlertTimes[key] || 0;
    if (now - last > this.COOLDOWN_MS) {
      this.lastAlertTimes[key] = now;
      return true;
    }
    return false;
  }

  async check() {
    try {
      const [cpu, mem, battery, fsSize] = await Promise.all([
        si.currentLoad(),
        si.mem(),
        si.battery(),
        si.fsSize(),
      ]);

      const cpuLoad = cpu.currentLoad;
      const ramPercent = (mem.used / mem.total) * 100;

      // 1. Check CPU load
      if (cpuLoad > this.cpuThreshold && this.canSendAlert('cpu')) {
        await this.triggerAlert({
          type: 'cpu',
          level: 'warning',
          metric: cpuLoad,
          message: `High CPU usage detected: ${cpuLoad.toFixed(1)}% (Threshold: ${this.cpuThreshold}%)`,
        });
      }

      // 2. Check RAM
      if (ramPercent > this.ramThreshold && this.canSendAlert('ram')) {
        await this.triggerAlert({
          type: 'memory',
          level: 'warning',
          metric: ramPercent,
          message: `High RAM usage detected: ${ramPercent.toFixed(1)}% used (${(mem.used / 1024 / 1024 / 1024).toFixed(1)} GB / ${(mem.total / 1024 / 1024 / 1024).toFixed(1)} GB)`,
        });
      }

      // 3. Check Battery
      if (battery.hasBattery && !battery.isCharging && battery.percent <= this.batteryThreshold && this.canSendAlert('battery')) {
        await this.triggerAlert({
          type: 'battery',
          level: 'critical',
          metric: battery.percent,
          message: `Battery low: ${battery.percent}% remaining. Laptop is not connected to charger!`,
        });
      }

      // 4. Check Primary Disk
      if (fsSize && fsSize.length > 0) {
        const primary = fsSize[0];
        if (primary.use > 90 && this.canSendAlert('disk')) {
          await this.triggerAlert({
            type: 'disk',
            level: 'warning',
            metric: primary.use,
            message: `Disk storage low on ${primary.mount || 'C:'}: ${primary.use.toFixed(1)}% full.`,
          });
        }
      }
    } catch (err) {
      console.error('❌ [Observer Check Error]:', err.message);
    }
  }

  async triggerAlert({ type, level, metric, message }) {
    console.warn(`🚨 [Observer Alert - ${type.toUpperCase()}]: ${message}`);

    // Persist to Memory (Postgres / Fallback)
    await memory.saveSystemAlert({ type, level, metric, message });

    // Emit event to Main Controller
    this.emit('alert', {
      type,
      level,
      metric,
      message,
      timestamp: new Date(),
    });
  }
}

module.exports = new Observer();
