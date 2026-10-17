const fs = require('fs');
const path = require('path');

const EXTENSIONS = {
  '.java': { asset: 'java', name: 'Java' },
  '.ts': { asset: 'ts', name: 'TypeScript' },
  '.tsx': { asset: 'tsx', name: 'TypeScript React' },
  '.js': { asset: 'js', name: 'JavaScript' },
  '.jsx': { asset: 'jsx', name: 'JavaScript React' },
  '.py': { asset: 'python', name: 'Python' },
  '.rs': { asset: 'rust', name: 'Rust' },
  '.go': { asset: 'go', name: 'Go' },
  '.cpp': { asset: 'cpp', name: 'C++' },
  '.cc': { asset: 'cpp', name: 'C++' },
  '.c': { asset: 'c', name: 'C' },
  '.h': { asset: 'c', name: 'C Header' },
  '.cs': { asset: 'csharp', name: 'C#' },
  '.yml': { asset: 'yaml', name: 'YAML' },
  '.yaml': { asset: 'yaml', name: 'YAML' },
  '.json': { asset: 'json', name: 'JSON' },
  '.toml': { asset: 'toml', name: 'TOML' },
  '.md': { asset: 'markdown', name: 'Markdown' },
  '.sql': { asset: 'sql', name: 'SQL' },
  '.html': { asset: 'html', name: 'HTML' },
  '.css': { asset: 'css', name: 'CSS' },
  '.scss': { asset: 'scss', name: 'SCSS' },
  '.lua': { asset: 'lua', name: 'Lua' },
  '.gradle': { asset: 'gradle', name: 'Gradle' },
  '.kts': { asset: 'kotlin', name: 'Kotlin Script' },
  '.kt': { asset: 'kotlin', name: 'Kotlin' },
  '.sh': { asset: 'shell', name: 'Shell' },
  '.ps1': { asset: 'powershell', name: 'PowerShell' },
  '.cmd': { asset: 'bat', name: 'Batch' },
  '.bat': { asset: 'bat', name: 'Batch' },
  '.php': { asset: 'php', name: 'PHP' },
  '.vue': { asset: 'vue', name: 'Vue' },
  '.svelte': { asset: 'svelte', name: 'Svelte' },
  '.dart': { asset: 'dart', name: 'Dart' },
  '.rb': { asset: 'ruby', name: 'Ruby' },
  '.xml': { asset: 'xml', name: 'XML' },
  '.prisma': { asset: 'prisma', name: 'Prisma' },
  'dockerfile': { asset: 'docker', name: 'Dockerfile' }
};

function getFileMeta(fileName) {
  const base = path.basename(fileName);
  const ext = path.extname(fileName).toLowerCase();

  if (base.toLowerCase() === 'dockerfile') return EXTENSIONS['dockerfile'];
  return EXTENSIONS[ext] || { asset: 'text', name: 'Code' };
}

function scanFolder(targetDir) {
  const files = [];
  const skip = new Set(['.git', 'node_modules', 'target', 'build', 'dist', 'libs', 'resourcepack', '.idea', '.vscode']);
  const validExts = new Set(Object.keys(EXTENSIONS));

  function walk(current) {
    try {
      const items = fs.readdirSync(current, { withFileTypes: true });
      for (const item of items) {
        if (item.name.startsWith('.') && item.name !== '.env') continue;
        if (skip.has(item.name)) continue;

        const full = path.join(current, item.name);
        if (item.isDirectory()) {
          walk(full);
        } else if (item.isFile()) {
          const ext = path.extname(item.name).toLowerCase();
          if (validExts.has(ext)) {
            const rel = path.relative(targetDir, full).replace(/\\/g, '/');
            let lines = 100;
            try {
              lines = fs.readFileSync(full, 'utf8').split('\n').length;
            } catch (_) {}

            let weight = 8;
            if (item.name === 'Bliss.java' || item.name === 'index.ts' || item.name === 'main.rs' || item.name === 'main.py') {
              weight = 25;
            } else if (item.name.includes('Manager') || item.name.includes('Controller') || item.name.includes('Service')) {
              weight = 14;
            } else if (ext === '.yml' || ext === '.json' || ext === '.toml') {
              weight = 4;
            } else if (ext === '.md') {
              weight = 2;
            }

            files.push({
              name: item.name,
              relativePath: rel,
              lines: lines,
              weight: weight
            });
          }
        }
      }
    } catch (_) {}
  }

  walk(targetDir);
  return files;
}

const PRESETS = {
  'blissv2': {
    name: 'Bliss V2 Plugin',
    workspace: 'bliss',
    branch: 'main',
    stateFormat: 'this otter is busy',
    directory: 'D:\\BLiss SCULK\\bliss\\blissv2',
    getFiles: (dir) => scanFolder(dir || 'D:\\BLiss SCULK\\bliss\\blissv2')
  },
  'minecraft-plugin': {
    name: 'Minecraft Plugin Project',
    workspace: 'ShamedPlug',
    branch: 'main',
    stateFormat: 'Working on ShamedPlug',
    files: [
      { name: 'veloRodCommand.java', relativePath: 'veloRodCommand.java', lines: 284, weight: 15 },
      { name: 'VeloRodListener.java', relativePath: 'VeloRodListener.java', lines: 215, weight: 12 },
      { name: 'VelocityVectorUtil.java', relativePath: 'VelocityVectorUtil.java', lines: 146, weight: 8 },
      { name: 'RodCooldownManager.java', relativePath: 'RodCooldownManager.java', lines: 112, weight: 8 },
      { name: 'plugin.yml', relativePath: 'plugin.yml', lines: 45, weight: 4 },
      { name: 'config.yml', relativePath: 'config.yml', lines: 86, weight: 4 },
      { name: 'build.gradle.kts', relativePath: 'build.gradle.kts', lines: 65, weight: 3 }
    ]
  },
  'fullstack': {
    name: 'Fullstack Next.js + TS',
    workspace: 'nexus-app',
    branch: 'main',
    stateFormat: 'Working on nexus-app',
    files: [
      { name: 'page.tsx', relativePath: 'app/dashboard/page.tsx', lines: 240, weight: 12 },
      { name: 'route.ts', relativePath: 'app/api/auth/route.ts', lines: 180, weight: 10 },
      { name: 'schema.prisma', relativePath: 'prisma/schema.prisma', lines: 185, weight: 8 },
      { name: 'tailwind.config.ts', relativePath: 'tailwind.config.ts', lines: 68, weight: 4 },
      { name: 'package.json', relativePath: 'package.json', lines: 54, weight: 2 }
    ]
  },
  'python': {
    name: 'Python Backend / ML',
    workspace: 'neural-engine',
    branch: 'main',
    stateFormat: 'Working on neural-engine',
    files: [
      { name: 'server.py', relativePath: 'src/server.py', lines: 310, weight: 14 },
      { name: 'pipeline.py', relativePath: 'src/core/pipeline.py', lines: 260, weight: 12 },
      { name: 'models.py', relativePath: 'src/models.py', lines: 175, weight: 8 },
      { name: 'requirements.txt', relativePath: 'requirements.txt', lines: 35, weight: 2 }
    ]
  },
  'rust': {
    name: 'Rust Systems',
    workspace: 'iron-net',
    branch: 'master',
    stateFormat: 'Working on iron-net',
    files: [
      { name: 'main.rs', relativePath: 'src/main.rs', lines: 180, weight: 10 },
      { name: 'stream.rs', relativePath: 'src/network/stream.rs', lines: 340, weight: 14 },
      { name: 'packet.rs', relativePath: 'src/codec/packet.rs', lines: 260, weight: 10 },
      { name: 'Cargo.toml', relativePath: 'Cargo.toml', lines: 48, weight: 3 }
    ]
  }
};

module.exports = {
  EXTENSIONS,
  getFileMeta,
  scanFolder,
  PRESETS
};
