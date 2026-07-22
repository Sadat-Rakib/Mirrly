// File-based skills — markdown packs that teach Mirrly how you like things done.
const fs = require('fs');
const path = require('path');
const { app, shell } = require('electron');

function bundledDir() {
  return path.join(__dirname, '..', 'skills');
}

function userDir() {
  const dir = path.join(app.getPath('userData'), 'skills');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function parseFrontmatter(raw) {
  const text = String(raw || '');
  if (!text.startsWith('---')) {
    return { meta: {}, body: text.trim() };
  }
  const end = text.indexOf('\n---', 3);
  if (end < 0) return { meta: {}, body: text.trim() };
  const fm = text.slice(3, end).trim();
  const body = text.slice(end + 4).trim();
  const meta = {};
  for (const line of fm.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (m) meta[m[1].toLowerCase()] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return { meta, body };
}

function readSkillFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const { meta, body } = parseFrontmatter(raw);
  const base = path.basename(filePath, path.extname(filePath));
  return {
    id: String(meta.id || base).toLowerCase().replace(/[^a-z0-9_-]+/g, '-'),
    name: meta.name || base,
    description: meta.description || '',
    body,
    path: filePath,
    bundled: filePath.startsWith(bundledDir())
  };
}

function listSkillFiles() {
  const files = new Map();
  const addDir = (dir) => {
    let entries;
    try { entries = fs.readdirSync(dir); } catch { return; }
    for (const name of entries) {
      if (!/\.md$/i.test(name)) continue;
      const full = path.join(dir, name);
      try {
        const skill = readSkillFile(full);
        files.set(skill.id, skill); // user dir overrides bundled when same id
      } catch { /* skip bad files */ }
    }
  };
  addDir(bundledDir());
  addDir(userDir());
  return [...files.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function ensureUserSkillsSeeded() {
  const dest = userDir();
  const src = bundledDir();
  let bundled;
  try { bundled = fs.readdirSync(src).filter((n) => /\.md$/i.test(n)); } catch { return; }
  for (const name of bundled) {
    const target = path.join(dest, name);
    if (fs.existsSync(target)) continue;
    try { fs.copyFileSync(path.join(src, name), target); } catch { /* ignore */ }
  }
}

function enabledSkillBodies(enabledIds, maxChars) {
  ensureUserSkillsSeeded();
  const all = listSkillFiles();
  const enabled = Array.isArray(enabledIds)
    ? new Set(enabledIds.map((id) => String(id).toLowerCase()))
    : new Set(all.map((s) => s.id)); // unset → all on by default
  const parts = [];
  let used = 0;
  const budget = maxChars || 3500;
  for (const s of all) {
    if (!enabled.has(s.id)) continue;
    const block = '### Skill: ' + s.name + '\n' + s.body;
    if (used + block.length > budget) break;
    parts.push(block);
    used += block.length;
  }
  return parts.join('\n\n');
}

function saveSkill({ name, description, body }) {
  const safe = String(name || 'custom-skill')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'custom-skill';
  const file = path.join(userDir(), safe + '.md');
  const md =
    '---\n' +
    'name: ' + String(name || safe) + '\n' +
    'description: ' + String(description || 'User-created skill') + '\n' +
    '---\n\n' +
    String(body || '').trim() + '\n';
  fs.writeFileSync(file, md, 'utf8');
  return readSkillFile(file);
}

function openSkillsFolder() {
  const dir = userDir();
  ensureUserSkillsSeeded();
  return shell.openPath(dir);
}

module.exports = {
  listSkillFiles,
  enabledSkillBodies,
  saveSkill,
  openSkillsFolder,
  userDir,
  ensureUserSkillsSeeded
};
