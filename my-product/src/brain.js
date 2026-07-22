// Lightweight second brain: keyword search over Documents/Mirrly notes + memory[].
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

function mirrlyRoot() {
  return path.join(app.getPath('documents'), 'Mirrly');
}

function walkMdFiles(dir, out, depth) {
  if (depth < 0) return;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walkMdFiles(full, out, depth - 1);
    else if (/\.(md|txt)$/i.test(e.name)) out.push(full);
  }
}

function tokenize(q) {
  return String(q || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((w) => w.length > 2);
}

function scoreText(text, tokens) {
  const hay = String(text || '').toLowerCase();
  if (!hay || !tokens.length) return 0;
  let score = 0;
  for (const t of tokens) {
    if (!hay.includes(t)) continue;
    score += 2;
    // Bonus for denser matches
    const re = new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const hits = hay.match(re);
    if (hits && hits.length > 1) score += Math.min(hits.length, 5);
  }
  return score;
}

function snippetAround(text, tokens, maxLen) {
  const hay = String(text || '');
  const lower = hay.toLowerCase();
  let idx = -1;
  for (const t of tokens) {
    const i = lower.indexOf(t);
    if (i >= 0 && (idx < 0 || i < idx)) idx = i;
  }
  if (idx < 0) return hay.slice(0, maxLen).trim();
  const start = Math.max(0, idx - 60);
  const end = Math.min(hay.length, idx + maxLen);
  return (start > 0 ? '…' : '') + hay.slice(start, end).trim() + (end < hay.length ? '…' : '');
}

function searchNotes(query, store) {
  const q = String(query || '').trim();
  if (!q) return { ok: false, error: 'query required' };
  const tokens = tokenize(q);
  if (!tokens.length) return { ok: false, error: 'query too short' };

  const hits = [];

  // Memory facts
  const memory = (store && store.getSettings && store.getSettings().memory) || [];
  memory.forEach((fact, i) => {
    const score = scoreText(fact, tokens);
    if (score > 0) {
      hits.push({
        source: 'memory',
        path: 'memory#' + i,
        score,
        snippet: String(fact).slice(0, 240)
      });
    }
  });

  // Notes / files under Documents/Mirrly
  const files = [];
  walkMdFiles(mirrlyRoot(), files, 3);
  for (const file of files.slice(0, 80)) {
    let body = '';
    try { body = fs.readFileSync(file, 'utf8'); } catch { continue; }
    const score = scoreText(body, tokens) + scoreText(path.basename(file), tokens);
    if (score > 0) {
      hits.push({
        source: 'file',
        path: file,
        score,
        snippet: snippetAround(body, tokens, 280)
      });
    }
  }

  hits.sort((a, b) => b.score - a.score);
  const top = hits.slice(0, 6);
  return {
    ok: true,
    query: q,
    count: top.length,
    results: top,
    hint: top.length ? 'Use these facts if relevant; cite local notes as (local note).' : 'No matching local notes or memory.'
  };
}

/** Pick the most relevant memory lines for prompt injection (instead of dumping all 50). */
function relevantMemory(memory, userText, limit) {
  const list = Array.isArray(memory) ? memory.filter(Boolean) : [];
  if (!list.length) return [];
  const tokens = tokenize(userText);
  if (!tokens.length) return list.slice(-Math.min(limit || 8, list.length));
  const ranked = list
    .map((fact, i) => ({ fact, i, score: scoreText(fact, tokens) }))
    .sort((a, b) => b.score - a.score || b.i - a.i);
  const picked = ranked.filter((r) => r.score > 0).slice(0, limit || 8).map((r) => r.fact);
  if (picked.length) return picked;
  return list.slice(-Math.min(limit || 8, list.length));
}

module.exports = { searchNotes, relevantMemory, mirrlyRoot };
