// Launch installed apps by name, safely. Windows: Start Menu .lnk scan + a small
// alias list of built-ins. macOS: `open -a`. Model input is sanitized and can only
// ever launch an alias exe or a shortcut discovered by our own scan — never a
// model-supplied path, and never through a shell.
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { shell } = require('electron');

// Windows built-ins that have no Start Menu shortcut. Launched by bare exe name
// (resolved via PATH/System32 by spawn) or an ms-settings: URI.
const WIN_ALIASES = {
  notepad: { exe: 'notepad.exe' },
  calculator: { exe: 'calc.exe' },
  calc: { exe: 'calc.exe' },
  paint: { exe: 'mspaint.exe' },
  mspaint: { exe: 'mspaint.exe' },
  explorer: { exe: 'explorer.exe' },
  'file explorer': { exe: 'explorer.exe' },
  cmd: { exe: 'cmd.exe' },
  'command prompt': { exe: 'cmd.exe' },
  terminal: { exe: 'wt.exe' },
  'task manager': { exe: 'taskmgr.exe' },
  'snipping tool': { exe: 'snippingtool.exe' },
  settings: { uri: 'ms-settings:' }
};

let appCache = null;
let appCacheAt = 0;
const CACHE_MS = 5 * 60 * 1000;

function scanDir(dir, depth, out) {
  if (depth < 0) return;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { scanDir(full, depth - 1, out); continue; }
    if (/\.(lnk|url|appref-ms)$/i.test(e.name)) {
      out.push({ name: e.name.replace(/\.(lnk|url|appref-ms)$/i, ''), path: full });
    }
  }
}

function listStartMenuApps() {
  const now = Date.now();
  if (appCache && now - appCacheAt < CACHE_MS) return appCache;
  const out = [];
  const roots = [
    process.env.APPDATA && path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
    process.env.ProgramData && path.join(process.env.ProgramData, 'Microsoft', 'Windows', 'Start Menu', 'Programs')
  ].filter(Boolean);
  for (const root of roots) scanDir(root, 3, out);
  appCache = out;
  appCacheAt = now;
  return out;
}

function sanitizeQuery(q) {
  const s = String(q || '').trim().toLowerCase();
  if (!s || s.length > 60) return null;
  if (/[\\/"'`$&|;<>%*?~^{}[\]]/.test(s)) return null;
  return s;
}

function rankMatches(q, apps) {
  const tokens = q.split(/\s+/).filter(Boolean);
  const scored = [];
  for (const a of apps) {
    const n = a.name.toLowerCase();
    let score = 0;
    if (n === q) score = 100;
    else if (n.startsWith(q)) score = 80;
    else if (n.includes(q)) score = 60;
    else {
      const hit = tokens.filter((t) => n.includes(t)).length;
      if (hit && hit === tokens.length) score = 40;
      else if (hit) score = 10 * hit;
    }
    // Uninstallers etc. show up next to the real shortcut — push them down.
    if (score && /uninstall|repair|update|readme|help|documentation|website/i.test(n)) score -= 35;
    if (score > 0) scored.push({ ...a, score });
  }
  scored.sort((x, y) => y.score - x.score || x.name.length - y.name.length);
  return scored;
}

async function openApp(query) {
  const q = sanitizeQuery(query);
  if (!q) return { ok: false, error: 'App name missing or contains characters that are not allowed.' };

  if (process.platform === 'darwin') {
    return new Promise((resolve) => {
      const child = spawn('open', ['-a', q], { detached: true, shell: false });
      child.on('error', (e) => resolve({ ok: false, error: e.message }));
      child.on('exit', (code) => resolve(code === 0
        ? { ok: true, opened: q }
        : { ok: false, error: 'No app named "' + q + '" found.' }));
    });
  }

  const alias = WIN_ALIASES[q];
  if (alias) {
    if (alias.uri) {
      await shell.openExternal(alias.uri);
      return { ok: true, opened: q };
    }
    try {
      spawn(alias.exe, [], { detached: true, shell: false, stdio: 'ignore' }).unref();
      return { ok: true, opened: q };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  const matches = rankMatches(q, listStartMenuApps());
  if (!matches.length) {
    return { ok: false, error: 'No installed app matching "' + q + '" was found in the Start Menu.' };
  }
  const top = matches[0];
  const runnersUp = matches.slice(1, 4).filter((m) => m.score >= top.score - 5 && m.name !== top.name);
  if (top.score < 60 && runnersUp.length) {
    return {
      ok: false,
      ambiguous: true,
      candidates: [top, ...runnersUp].map((m) => m.name),
      error: 'Multiple apps match "' + q + '". Ask the user which one they meant.'
    };
  }
  const err = await shell.openPath(top.path); // resolves .lnk natively; '' on success
  if (err) return { ok: false, error: err };
  return { ok: true, opened: top.name };
}

module.exports = { openApp, listStartMenuApps };
