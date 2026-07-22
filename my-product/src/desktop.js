// Safe desktop helpers: open websites by name, type/paste into the focused window.
const { execFile } = require('child_process');
const { promisify } = require('util');
const { clipboard, shell } = require('electron');

const execFileAsync = promisify(execFile);

const SITE_ALIASES = {
  youtube: 'https://www.youtube.com',
  yt: 'https://www.youtube.com',
  gmail: 'https://mail.google.com',
  mail: 'https://mail.google.com',
  outlook: 'https://outlook.live.com/mail/',
  'outlook web': 'https://outlook.live.com/mail/',
  twitter: 'https://x.com',
  x: 'https://x.com',
  linkedin: 'https://www.linkedin.com',
  github: 'https://github.com',
  chatgpt: 'https://chatgpt.com',
  drive: 'https://drive.google.com',
  docs: 'https://docs.google.com',
  sheets: 'https://sheets.google.com',
  maps: 'https://maps.google.com',
  google: 'https://www.google.com',
  reddit: 'https://www.reddit.com',
  netflix: 'https://www.netflix.com',
  spotify: 'https://open.spotify.com',
  amazon: 'https://www.amazon.com',
  wikipedia: 'https://en.wikipedia.org',
  calendar: 'https://calendar.google.com',
  slack: 'https://app.slack.com',
  notion: 'https://www.notion.so',
  discord: 'https://discord.com/app'
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function resolveWebsite(query) {
  const raw = String(query || '').trim();
  if (!raw) return { ok: false, error: 'query required' };
  if (/^https?:\/\//i.test(raw)) return { ok: true, url: raw, how: 'url' };
  if (/^mailto:/i.test(raw)) return { ok: true, url: raw, how: 'mailto' };

  const key = raw.toLowerCase().replace(/^open\s+/, '').trim();
  if (SITE_ALIASES[key]) return { ok: true, url: SITE_ALIASES[key], how: 'alias' };

  // Bare domain-ish: example.com or www.example.com
  if (/^(?:www\.)?[a-z0-9]([a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(raw.replace(/\/.*$/, ''))) {
    const host = raw.replace(/^https?:\/\//i, '');
    return { ok: true, url: 'https://' + host, how: 'domain' };
  }

  // DuckDuckGo bang that jumps to the top result in the browser.
  return {
    ok: true,
    url: 'https://duckduckgo.com/?q=!ducky+' + encodeURIComponent(raw),
    how: 'search'
  };
}

async function openWebsite(query) {
  const resolved = resolveWebsite(query);
  if (!resolved.ok) return resolved;
  await shell.openExternal(resolved.url);
  return { ok: true, url: resolved.url, how: resolved.how, query: String(query || '').trim() };
}

function escapeSendKeys(text) {
  // SendKeys treats + ^ % ~ ( ) { } [ ] as special — wrap literals in braces.
  return String(text).replace(/[+^%~(){}[\]]/g, (ch) => '{' + ch + '}');
}

async function sendKeysWindows(keys) {
  const script =
    "Add-Type -AssemblyName System.Windows.Forms; " +
    "[System.Windows.Forms.SendKeys]::SendWait('" + keys.replace(/'/g, "''") + "')";
  await execFileAsync('powershell.exe', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', script], {
    windowsHide: true,
    timeout: 8000
  });
}

async function sendPasteMac() {
  await execFileAsync('osascript', ['-e', 'tell application "System Events" to keystroke "v" using command down'], {
    timeout: 5000
  });
}

async function typeText({ text, method }) {
  const t = String(text || '');
  if (!t) return { ok: false, error: 'text required' };
  if (t.length > 12000) return { ok: false, error: 'text too long (max 12000 chars)' };

  const mode = String(method || 'paste').toLowerCase() === 'type' ? 'type' : 'paste';
  const platform = process.platform;

  // Give the newly opened window a moment to take focus.
  await sleep(500);

  try {
    if (mode === 'paste') {
      clipboard.writeText(t);
      if (platform === 'win32') await sendKeysWindows('^v');
      else if (platform === 'darwin') await sendPasteMac();
      else return { ok: false, error: 'paste automation not supported on this OS — text is on the clipboard' };
      return { ok: true, method: 'paste', chars: t.length };
    }

    // Short typed strings only — SendKeys escaping is lossy for long prose.
    if (t.length > 400) {
      return { ok: false, error: 'type method limited to 400 chars; use method:"paste" instead' };
    }
    if (platform === 'win32') {
      await sendKeysWindows(escapeSendKeys(t));
      return { ok: true, method: 'type', chars: t.length };
    }
    if (platform === 'darwin') {
      const escaped = t.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      await execFileAsync('osascript', ['-e', 'tell application "System Events" to keystroke "' + escaped + '"'], {
        timeout: 8000
      });
      return { ok: true, method: 'type', chars: t.length };
    }
    return { ok: false, error: 'type automation not supported on this OS' };
  } catch (e) {
    return { ok: false, error: (e && e.message) || String(e) };
  }
}

module.exports = { openWebsite, typeText, resolveWebsite, SITE_ALIASES };
