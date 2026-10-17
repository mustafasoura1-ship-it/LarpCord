const fs = require('fs');
const path = require('path');
const { DiscordIPC } = require('./ipc');
const { PRESETS, scanFolder } = require('./profiles');
const { CodeSimulator } = require('./simulator');

const ROOT = path.join(__dirname, '..');
const CONFIG_FILE = path.join(ROOT, 'config.json');
const STATUS_FILE = path.join(ROOT, 'status.json');
const CONTROL_FILE = path.join(ROOT, 'control.json');
const PID_FILE = path.join(ROOT, 'daemon.pid');
const LOG_FILE = path.join(ROOT, 'daemon.log');

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch (e) {
    return {
      clientId: '383226320970055681',
      appName: 'Goon Code',
      activeProfile: 'blissv2',
      timestampMode: 'file',
      showCursorPosition: true,
      showLineCount: true,
      showGitBranch: true,
      swapIntervalSeconds: { min: 90, max: 240 },
      cursorJitterIntervalSeconds: { min: 20, max: 45 }
    };
  }
}

function resolveProfile(cfg, key) {
  let p = cfg.customProfiles?.[key] || PRESETS[key] || PRESETS['blissv2'];

  if (p && typeof p.getFiles === 'function') {
    const targetDir = cfg.targetDirectory || p.directory;
    return {
      ...p,
      files: p.getFiles(targetDir)
    };
  }

  // Generic local folder scan fallback
  if (key === 'local') {
    const dir = cfg.targetDirectory || process.cwd();
    return {
      name: `Local (${path.basename(dir)})`,
      workspace: path.basename(dir),
      branch: 'main',
      files: scanFolder(dir)
    };
  }

  return p;
}

function log(msg) {
  const ts = new Date().toLocaleTimeString();
  const line = `[${ts}] ${msg}\n`;
  try { process.stdout.write(line); } catch (_) {}
  try { fs.appendFileSync(LOG_FILE, line, 'utf8'); } catch (_) {}
}

async function run() {
  fs.writeFileSync(PID_FILE, process.pid.toString(), 'utf8');

  let config = readConfig();
  let currentKey = config.activeProfile || 'blissv2';
  let profile = resolveProfile(config, currentKey);

  const simulator = new CodeSimulator(profile, config);
  const ipc = new DiscordIPC(config.clientId || '383226320970055681');

  let swapTimer = null;
  let jitterTimer = null;
  let swapDeadline = Date.now();
  let jitterDeadline = Date.now();
  let discordTag = null;

  function pushActivity(reason) {
    if (!ipc.connected) return;
    const act = simulator.buildActivity();
    if (act) {
      ipc.setActivity(act);
      log(`Updated (${reason}): ${act.details} | ${act.state}`);
    }
  }

  function queueSwap() {
    clearTimeout(swapTimer);
    const secs = simulator.getNextSwapSeconds();
    swapDeadline = Date.now() + (secs * 1000);
    swapTimer = setTimeout(() => {
      simulator.selectNextFile();
      pushActivity('file_swap');
      queueSwap();
    }, secs * 1000);
  }

  function queueJitter() {
    clearTimeout(jitterTimer);
    const secs = simulator.getNextJitterSeconds();
    jitterDeadline = Date.now() + (secs * 1000);
    jitterTimer = setTimeout(() => {
      simulator.jitter();
      pushActivity('cursor_jitter');
      queueJitter();
    }, secs * 1000);
  }

  ipc.on('connected', pipe => log(`Connected to ${pipe}`));
  ipc.on('ready', user => {
    discordTag = user.user ? `${user.user.username}#${user.user.discriminator || '0'}` : 'Online';
    log(`Discord handshake ready (${discordTag})`);
    pushActivity('ready');
    queueSwap();
    queueJitter();
  });

  ipc.on('disconnected', () => {
    log('Discord pipe closed. Reconnecting...');
    clearTimeout(swapTimer);
    clearTimeout(jitterTimer);
  });

  // Watch for CLI control events & dump status
  const watcher = setInterval(() => {
    if (fs.existsSync(CONTROL_FILE)) {
      try {
        const cmd = JSON.parse(fs.readFileSync(CONTROL_FILE, 'utf8'));
        fs.unlinkSync(CONTROL_FILE);

        if (cmd.command === 'set_profile' && cmd.profile) {
          currentKey = cmd.profile;
          profile = resolveProfile(config, currentKey);
          simulator.setProfile(profile);
          log(`Switched to profile: ${currentKey}`);
          pushActivity('profile_switched');
          queueSwap();
          queueJitter();
        } else if (cmd.command === 'set_file' && cmd.file) {
          const match = profile.files.find(f => f.name.toLowerCase() === cmd.file.toLowerCase()) || {
            name: cmd.file,
            lines: 120,
            weight: 5
          };
          simulator.selectFile(match);
          log(`Forced file: ${match.name}`);
          pushActivity('file_forced');
          queueSwap();
          queueJitter();
        } else if (cmd.command === 'reload') {
          config = readConfig();
          simulator.config = config;
          profile = resolveProfile(config, currentKey);
          simulator.setProfile(profile);
          log('Config reloaded');
          pushActivity('config_reloaded');
        } else if (cmd.command === 'stop') {
          shutdown();
        }
      } catch (_) {}
    }

    try {
      const now = Date.now();
      const status = {
        running: true,
        pid: process.pid,
        startedAt: new Date(simulator.sessionStart * 1000).toISOString(),
        discordConnected: ipc.connected,
        discordUser: discordTag,
        activeProfile: currentKey,
        workspace: profile.workspace,
        branch: profile.branch,
        currentFile: simulator.currentFile ? simulator.currentFile.name : null,
        currentLine: simulator.currentLine,
        currentCol: simulator.currentCol,
        nextSwapInSeconds: Math.max(0, Math.round((swapDeadline - now) / 1000)),
        nextJitterInSeconds: Math.max(0, Math.round((jitterDeadline - now) / 1000)),
        activity: simulator.buildActivity()
      };
      fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2), 'utf8');
    } catch (_) {}
  }, 1500);

  function shutdown() {
    log('Stopping daemon...');
    clearInterval(watcher);
    clearTimeout(swapTimer);
    clearTimeout(jitterTimer);

    try {
      if (fs.existsSync(STATUS_FILE)) fs.writeFileSync(STATUS_FILE, JSON.stringify({ running: false }, null, 2));
      if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE);
    } catch (_) {}

    ipc.disconnect();
    setTimeout(() => process.exit(0), 200);
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  log(`LarpCord started (PID: ${process.pid}, Profile: ${currentKey})`);
  ipc.connect();
}

run().catch(e => {
  log(`Fatal error: ${e.message}`);
  process.exit(1);
});
