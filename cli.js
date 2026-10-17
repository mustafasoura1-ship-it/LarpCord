const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const { PRESETS } = require('./src/profiles');

const ROOT = __dirname;
const PID_FILE = path.join(ROOT, 'daemon.pid');
const STATUS_FILE = path.join(ROOT, 'status.json');
const CONTROL_FILE = path.join(ROOT, 'control.json');
const CONFIG_FILE = path.join(ROOT, 'config.json');

function isRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (_) {
    return false;
  }
}

function getPid() {
  if (!fs.existsSync(PID_FILE)) return null;
  try {
    const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim(), 10);
    return isNaN(pid) ? null : (isRunning(pid) ? pid : null);
  } catch (_) {
    return null;
  }
}

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch (_) {
    return {};
  }
}

const action = (process.argv[2] || 'help').toLowerCase();
const param = process.argv[3];

switch (action) {
  case 'start': {
    const pid = getPid();
    if (pid) {
      console.log(`\x1b[33m[!] LarpCord is already running (PID: ${pid})\x1b[0m`);
      process.exit(0);
    }

    if (process.platform === 'win32') {
      execSync(`powershell -WindowStyle Hidden -Command "Start-Process -FilePath 'node' -ArgumentList 'src\\daemon.js' -WorkingDirectory '${ROOT}' -WindowStyle Hidden"`);
    } else {
      const child = spawn(process.execPath, [path.join(ROOT, 'src', 'daemon.js')], {
        detached: true,
        stdio: 'ignore',
        cwd: ROOT
      });
      child.unref();
    }

    console.log(`\x1b[32m[✓] LarpCord started in background.\x1b[0m`);
    setTimeout(() => {
      printStatus();
      process.exit(0);
    }, 2000);
    break;
  }

  case 'stop': {
    const pid = getPid();
    if (!pid) {
      console.log('\x1b[33m[i] LarpCord is not running.\x1b[0m');
      if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE);
      process.exit(0);
    }

    fs.writeFileSync(CONTROL_FILE, JSON.stringify({ command: 'stop' }), 'utf8');

    setTimeout(() => {
      if (isRunning(pid)) {
        try { process.kill(pid, 'SIGKILL'); } catch (_) {}
      }
      if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE);
      if (fs.existsSync(STATUS_FILE)) fs.writeFileSync(STATUS_FILE, JSON.stringify({ running: false }));
      console.log(`\x1b[32m[✓] LarpCord stopped.\x1b[0m`);
      process.exit(0);
    }, 800);
    break;
  }

  case 'restart': {
    console.log('[*] Restarting LarpCord...');
    execSync(`node "${path.join(ROOT, 'cli.js')}" stop`, { stdio: 'inherit' });
    setTimeout(() => {
      execSync(`node "${path.join(ROOT, 'cli.js')}" start`, { stdio: 'inherit' });
    }, 1000);
    break;
  }

  case 'reload': {
    const pid = getPid();
    if (!pid) {
      console.log('Daemon is not running.');
      process.exit(1);
    }
    fs.writeFileSync(CONTROL_FILE, JSON.stringify({ command: 'reload' }), 'utf8');
    console.log('[✓] Sent reload signal to running daemon.');
    break;
  }

  case 'status': {
    printStatus();
    break;
  }

  case 'profile': {
    if (!param) {
      console.log('Usage: node cli.js profile <name>');
      printProfiles();
      process.exit(1);
    }

    const cfg = readConfig();
    cfg.activeProfile = param;
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');

    const pid = getPid();
    if (pid) {
      fs.writeFileSync(CONTROL_FILE, JSON.stringify({ command: 'set_profile', profile: param }), 'utf8');
      console.log(`[✓] Switched active profile to: ${param}`);
    } else {
      console.log(`[✓] Active profile set to ${param} in config.json (start with: node cli.js start)`);
    }
    break;
  }

  case 'file': {
    if (!param) {
      console.log('Usage: node cli.js file <filename>');
      process.exit(1);
    }
    const pid = getPid();
    if (!pid) {
      console.log('[!] Daemon not running.');
      process.exit(1);
    }
    fs.writeFileSync(CONTROL_FILE, JSON.stringify({ command: 'set_file', file: param }), 'utf8');
    console.log(`[✓] Jumping to file: ${param}`);
    break;
  }

  case 'profiles':
  case 'list': {
    printProfiles();
    break;
  }

  case 'run':
  case 'dev': {
    console.log('[i] Running in interactive mode. Ctrl+C to exit.');
    require('./src/daemon.js');
    break;
  }

  case 'help':
  default: {
    console.log(`
LarpCord - Discord Rich Presence Faker

Usage:
  node cli.js <command> [arg]

Commands:
  start               Start daemon silently in background
  stop                Stop the running daemon
  restart             Restart background daemon
  status              Check what Discord is displaying
  profile <name>      Switch project stack on the fly
  file <filename>     Force jump to a specific file
  profiles            List all presets
  run                 Run in foreground with live logs
`);
    break;
  }
}

function printStatus() {
  const pid = getPid();
  if (!pid || !fs.existsSync(STATUS_FILE)) {
    console.log('\x1b[31m● Status: STOPPED\x1b[0m');
    return;
  }

  try {
    const s = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
    if (!s.running) {
      console.log('\x1b[31m● Status: STOPPED\x1b[0m');
      return;
    }

    const appTitle = (s.activity?.name || 'Visual Studio Code').padEnd(45);
    console.log('\x1b[32m● Status: RUNNING\x1b[0m (PID: ' + s.pid + ')');
    console.log(`  Discord:  ${s.discordConnected ? '\x1b[32mConnected (' + (s.discordUser || 'Ready') + ')\x1b[0m' : '\x1b[33mConnecting...\x1b[0m'}`);
    console.log(`  Profile:  ${s.activeProfile} [${s.workspace || 'Workspace'}]`);
    console.log(`  Editing:  \x1b[33m${s.currentFile}\x1b[0m (Line ${s.currentLine}, Col ${s.currentCol})`);
    console.log(`  Next Swap: ~${s.nextSwapInSeconds}s | Next Jitter: ~${s.nextJitterInSeconds}s`);
    console.log(`\n  ┌───────────────────────────────────────────────┐`);
    console.log(`  │ \x1b[1m${appTitle}\x1b[0m │`);
    console.log(`  │ Details: ${(s.activity?.details || '').padEnd(36)} │`);
    console.log(`  │ State:   ${(s.activity?.state || '').padEnd(36)} │`);
    console.log(`  └───────────────────────────────────────────────┘`);
  } catch (e) {
    console.log('[!] Error reading status:', e.message);
  }
}

function printProfiles() {
  const cfg = readConfig();
  console.log('\nAvailable Profiles:');
  for (const [key, p] of Object.entries(PRESETS)) {
    const star = cfg.activeProfile === key ? '* ' : '  ';
    console.log(`  ${star}${key.padEnd(18)} - ${p.name}`);
  }
  console.log('    local              - Auto-scans directory from config.targetDirectory\n');
}
