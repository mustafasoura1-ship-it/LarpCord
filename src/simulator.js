const EventEmitter = require('events');
const { getFileMeta } = require('./profiles');

class CodeSimulator extends EventEmitter {
  constructor(profile, config = {}) {
    super();
    this.profile = profile;
    this.config = config;

    if (config.fixedStartTimestamp) {
      this.sessionStart = Math.floor(config.fixedStartTimestamp / 1000);
    } else {
      const offsetSec = (config.offsetHours || 0) * 3600;
      this.sessionStart = Math.floor(Date.now() / 1000) - offsetSec;
    }
    this.fileStart = this.sessionStart;

    this.currentFile = null;
    this.currentLine = 1;
    this.currentCol = 1;
    this.isIdle = false;

    this.focusFile = null;
    this._pickFocus();
    this.selectFile(this.focusFile || this.profile.files[0]);
  }

  _pickFocus() {
    if (!this.profile.files || !this.profile.files.length) return;
    const sorted = [...this.profile.files].sort((a, b) => (b.weight || 1) - (a.weight || 1));
    this.focusFile = sorted[0];
  }

  setProfile(p) {
    this.profile = p;
    this._pickFocus();
    this.selectFile(this.focusFile || p.files[0]);
  }

  selectFile(fileObj) {
    if (!fileObj) return;
    this.currentFile = fileObj;
    this.fileStart = Math.floor(Date.now() / 1000);

    const total = fileObj.lines || 150;
    this.currentLine = Math.min(total, Math.max(10, Math.floor(Math.random() * (total * 0.7)) + 5));
    this.currentCol = Math.floor(Math.random() * 30) + 4;

    this.emit('file_changed', {
      file: this.currentFile.name,
      line: this.currentLine,
      col: this.currentCol
    });
  }

  selectNextFile() {
    if (!this.profile.files || this.profile.files.length <= 1) return;

    // 65% chance to return to main focus file if currently in a secondary file
    if (this.currentFile !== this.focusFile && Math.random() < 0.65) {
      this.selectFile(this.focusFile);
      return;
    }

    const pool = this.profile.files.filter(f => f.name !== (this.currentFile ? this.currentFile.name : ''));
    if (!pool.length) return;

    const totalWeight = pool.reduce((acc, f) => acc + (f.weight || 1), 0);
    let r = Math.random() * totalWeight;

    for (const f of pool) {
      r -= (f.weight || 1);
      if (r <= 0) {
        this.selectFile(f);
        return;
      }
    }
    this.selectFile(pool[0]);
  }

  // Micro-keystroke simulation
  jitter() {
    if (!this.currentFile) return;

    const total = this.currentFile.lines || 150;
    const roll = Math.random();

    if (roll < 0.65) {
      // Typing forward or down a couple lines
      this.currentLine = Math.min(total, this.currentLine + (Math.random() > 0.45 ? 1 : 0));
      this.currentCol = Math.floor(Math.random() * 45) + 4;
    } else if (roll < 0.85) {
      // Jumping to another function block in the same file
      const offset = Math.floor(Math.random() * 30) - 12;
      this.currentLine = Math.max(5, Math.min(total, this.currentLine + offset));
      this.currentCol = Math.floor(Math.random() * 20) + 4;
    } else {
      // Checking top of file / imports
      this.currentLine = Math.max(1, Math.floor(Math.random() * 15) + 1);
      this.currentCol = Math.floor(Math.random() * 12) + 1;
    }

    this.emit('cursor_jitter', {
      file: this.currentFile.name,
      line: this.currentLine,
      col: this.currentCol
    });
  }

  getNextSwapSeconds() {
    const min = this.config.swapIntervalSeconds?.min || 90;
    const max = this.config.swapIntervalSeconds?.max || 240;

    if (this.currentFile === this.focusFile) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    const subMin = Math.max(30, Math.floor(min * 0.5));
    const subMax = Math.max(subMin + 20, Math.floor(max * 0.6));
    return Math.floor(Math.random() * (subMax - subMin + 1)) + subMin;
  }

  getNextJitterSeconds() {
    const min = this.config.cursorJitterIntervalSeconds?.min || 20;
    const max = this.config.cursorJitterIntervalSeconds?.max || 45;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  buildActivity() {
    if (!this.currentFile) return null;

    const meta = getFileMeta(this.currentFile.name);
    const fileName = this.currentFile.name;
    const workspace = this.profile.workspace || 'Workspace';
    const branch = this.profile.branch ? ` (${this.profile.branch})` : '';

    let details;
    if (this.isIdle) {
      details = `Idling in ${fileName}`;
    } else if (this.config.showCursorPosition) {
      details = `Editing ${fileName}:${this.currentLine}:${this.currentCol}`;
    } else {
      details = `Editing ${fileName}`;
    }

    const state = this.config.customState
      || (this.profile.stateFormat ? `${this.profile.stateFormat}${this.config.showGitBranch && branch ? branch : ''}` : `Working on ${workspace}${this.config.showGitBranch ? branch : ''}`);

    const start = (this.config.timestampMode === 'session' ? this.sessionStart : this.fileStart) * 1000;

    let hoverText = this.config.customLargeText || (this.currentFile.relativePath
      ? `${this.currentFile.relativePath} (${meta.name}${this.currentFile.lines ? ' - ' + this.currentFile.lines + ' lines' : ''})`
      : `${meta.name} (Workspace: ${workspace})`);

    if (hoverText.length > 120) {
      hoverText = hoverText.substring(0, 117) + '...';
    }

    const largeImg = this.config.customLargeImage || (this.isIdle ? 'idle' : meta.asset);
    const smallImg = this.config.customSmallImage || 'vscode';
    const smallTxt = this.config.customSmallText || this.config.appName || 'Goon Code';

    const activity = {
      name: this.config.appName || 'Goon Code',
      details: details,
      state: state,
      timestamps: { start: start },
      assets: {
        large_image: largeImg,
        large_text: hoverText,
        small_image: smallImg,
        small_text: smallTxt
      }
    };

    if (this.config.enableButtons && Array.isArray(this.config.buttons) && this.config.buttons.length) {
      activity.buttons = this.config.buttons.slice(0, 2);
    }

    return activity;
  }
}

module.exports = { CodeSimulator };
