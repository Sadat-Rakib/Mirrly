// Safe desktop + live-fact tools for Mirrly's agent loop.
const fs = require('fs');
const path = require('path');
const { shell, clipboard, Notification, app } = require('electron');
const { openApp } = require('./apps');
const { ddgSearch, fetchPage, research } = require('./research');
const { openWebsite, typeText } = require('./desktop');
const { searchNotes } = require('./brain');

function notesDir() {
  const dir = path.join(app.getPath('documents'), 'Mirrly', 'notes');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function filesDir() {
  const dir = path.join(app.getPath('documents'), 'Mirrly');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

async function getWeather(location) {
  const q = String(location || '').trim();
  if (!q) return { ok: false, error: 'location required' };
  const geoUrl = 'https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&format=json&name=' + encodeURIComponent(q);
  const geoRes = await fetch(geoUrl);
  if (!geoRes.ok) return { ok: false, error: 'geocode failed ' + geoRes.status };
  const geo = await geoRes.json();
  const place = geo.results && geo.results[0];
  if (!place) return { ok: false, error: 'place not found: ' + q };
  const weatherUrl =
    'https://api.open-meteo.com/v1/forecast?latitude=' + place.latitude +
    '&longitude=' + place.longitude +
    '&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m' +
    '&timezone=auto';
  const wRes = await fetch(weatherUrl);
  if (!wRes.ok) return { ok: false, error: 'weather failed ' + wRes.status };
  const w = await wRes.json();
  const cur = w.current || {};
  return {
    ok: true,
    location: [place.name, place.admin1, place.country].filter(Boolean).join(', '),
    latitude: place.latitude,
    longitude: place.longitude,
    temperature_c: cur.temperature_2m,
    humidity_pct: cur.relative_humidity_2m,
    wind_kmh: cur.wind_speed_10m,
    weather_code: cur.weather_code,
    observed_at: cur.time,
    source: 'Open-Meteo'
  };
}

async function webSearch(query) {
  const q = String(query || '').trim();
  if (!q) return { ok: false, error: 'query required' };
  // Real DuckDuckGo results first; Instant Answer / Wikipedia only as a last resort.
  try {
    const real = await ddgSearch(q);
    if (real.ok && real.results.length) return real;
  } catch { /* fall through to Instant Answer */ }
  return instantAnswerSearch(q);
}

async function instantAnswerSearch(q) {
  // DuckDuckGo Instant Answer API (no key). Good for facts; snippets are short.
  const url = 'https://api.duckduckgo.com/?format=json&no_html=1&skip_disambig=1&q=' + encodeURIComponent(q);
  const res = await fetch(url, { headers: { 'user-agent': 'Mirrly/0.2' } });
  if (!res.ok) return { ok: false, error: 'search failed ' + res.status };
  const data = await res.json();
  const results = [];
  if (data.AbstractText) {
    results.push({ title: data.Heading || 'Summary', snippet: data.AbstractText, url: data.AbstractURL || '' });
  }
  const topics = [].concat(data.RelatedTopics || []);
  for (const t of topics) {
    if (t.Text) results.push({ title: (t.Text || '').slice(0, 80), snippet: t.Text, url: t.FirstURL || '' });
    if (t.Topics) {
      for (const sub of t.Topics.slice(0, 3)) {
        if (sub.Text) results.push({ title: (sub.Text || '').slice(0, 80), snippet: sub.Text, url: sub.FirstURL || '' });
      }
    }
    if (results.length >= 6) break;
  }
  // Fallback: Open-Meteo-style not available; try Wikipedia summary for the query.
  if (!results.length) {
    try {
      const wiki = await fetch(
        'https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(q.replace(/\s+/g, '_')),
        { headers: { 'user-agent': 'Mirrly/0.2' } }
      );
      if (wiki.ok) {
        const page = await wiki.json();
        if (page.extract) {
          results.push({
            title: page.title || q,
            snippet: page.extract,
            url: (page.content_urls && page.content_urls.desktop && page.content_urls.desktop.page) || ''
          });
        }
      }
    } catch { /* ignore */ }
  }
  return { ok: true, query: q, results: results.slice(0, 6), source: 'DuckDuckGo / Wikipedia' };
}

function copyToClipboard(text) {
  const t = String(text || '');
  if (!t) return { ok: false, error: 'text required' };
  clipboard.writeText(t);
  return { ok: true, chars: t.length };
}

async function openUrl(url) {
  const u = String(url || '').trim();
  if (!/^https?:\/\//i.test(u) && !/^mailto:/i.test(u)) {
    return { ok: false, error: 'only http(s) or mailto URLs allowed' };
  }
  await shell.openExternal(u);
  return { ok: true, url: u };
}

function saveScreenNote({ note, imageDataUrl }) {
  const dir = notesDir();
  const id = stamp();
  const mdPath = path.join(dir, id + '.md');
  let imgPath = null;
  if (imageDataUrl && /^data:image\/\w+;base64,/.test(imageDataUrl)) {
    const b64 = imageDataUrl.split(',')[1];
    imgPath = path.join(dir, id + '.png');
    fs.writeFileSync(imgPath, Buffer.from(b64, 'base64'));
  }
  const body =
    '# Mirrly note ' + id + '\n\n' +
    (note || '') + '\n\n' +
    (imgPath ? 'Screenshot: ' + imgPath + '\n' : '');
  fs.writeFileSync(mdPath, body, 'utf8');
  return { ok: true, path: mdPath, image: imgPath };
}

function saveTextFile({ filename, content }) {
  const safe = String(filename || 'note.txt').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 80);
  const name = safe.includes('.') ? safe : safe + '.txt';
  const filePath = path.join(filesDir(), stamp() + '-' + name);
  fs.writeFileSync(filePath, String(content || ''), 'utf8');
  return { ok: true, path: filePath };
}

function draftEmail({ to, subject, body, via }) {
  const addr = String(to || '').trim();
  const fullBody = String(body || '');
  const fullSubject = String(subject || '');
  let route = String(via || '').toLowerCase().trim();
  // Default to Gmail compose — mailto truncates long bodies in many clients.
  if (!route || route === 'auto') route = fullBody.length > 400 ? 'gmail' : 'gmail';
  if (route === 'outlook') route = 'mailto';

  if (route === 'gmail') {
    const url = 'https://mail.google.com/mail/?view=cm&fs=1' +
      '&to=' + encodeURIComponent(addr) +
      '&su=' + encodeURIComponent(fullSubject) +
      '&body=' + encodeURIComponent(fullBody.slice(0, 7000));
    return openUrl(url).then(async (opened) => {
      // If the compose URL was truncated, offer a paste fallback payload for type_text.
      const truncated = fullBody.length > 7000;
      return {
        ...opened,
        via: 'gmail',
        to: addr,
        subject: fullSubject,
        body_chars: fullBody.length,
        truncated,
        hint: truncated
          ? 'Body was truncated in the URL. If the compose window is focused and empty, call type_text with the remaining body (method paste).'
          : 'Gmail compose opened with fields prefilled. User must click Send themselves.'
      };
    });
  }

  const params = [];
  if (fullSubject) params.push('subject=' + encodeURIComponent(fullSubject));
  if (fullBody) params.push('body=' + encodeURIComponent(fullBody.slice(0, 1800)));
  const mailto = 'mailto:' + encodeURIComponent(addr) + (params.length ? '?' + params.join('&') : '');
  return openUrl(mailto).then(async (opened) => ({
    ...opened,
    via: 'mailto',
    to: addr,
    subject: fullSubject,
    body_chars: fullBody.length,
    truncated: fullBody.length > 1800,
    hint: fullBody.length > 1800
      ? 'mailto body was truncated. Prefer via:"gmail", or call type_text (paste) into the compose window with the full body.'
      : 'Mail app compose opened. User must click Send themselves.'
  }));
}

function notify({ title, body }) {
  try {
    if (Notification.isSupported()) {
      new Notification({ title: String(title || 'Mirrly'), body: String(body || '') }).show();
      return { ok: true };
    }
  } catch (e) {
    return { ok: false, error: e.message };
  }
  return { ok: false, error: 'notifications not supported' };
}

function rememberFact(store, fact) {
  const f = String(fact || '').trim();
  if (!f) return { ok: false, error: 'fact required' };
  const settings = store.getSettings();
  const memory = [...(settings.memory || []), f].slice(-50);
  store.setSettings({ memory });
  return { ok: true, fact: f };
}

function readScreenTextHint(hasImage) {
  if (!hasImage) {
    return { ok: false, error: 'No screenshot available this turn. Ask the user to grant screen access or open the content they want help with.' };
  }
  return {
    ok: true,
    hint: 'A screenshot of the user\'s display is attached to this conversation. Extract visible text, links, code, and UI labels from that image. Prefer exact strings from the screen.'
  };
}

const TOOL_DEFS = [
  { name: 'get_weather', description: 'Get current weather (temperature °C) for a city/location via Open-Meteo. Use for any live weather/temperature question.', parameters: { location: 'string' } },
  { name: 'web_search', description: 'Search the web. Returns titles, real URLs, and snippets of the top results. Follow up with fetch_page on the best 1-2 URLs when you need actual details.', parameters: { query: 'string' } },
  { name: 'fetch_page', description: 'Fetch a web page and return its readable text (truncated). Cite the URL in your answer.', parameters: { url: 'string' } },
  { name: 'research', description: 'One-shot web research: searches and returns extracts of the top pages with their URLs. Prefer this for open-ended questions that need current information.', parameters: { query: 'string' } },
  { name: 'open_app', description: 'Launch an installed desktop app by name (e.g. "spotify", "chrome", "notepad", "vs code", "calculator"). Use immediately when the user asks to open an app.', parameters: { name: 'string' } },
  { name: 'open_website', description: 'Open a website by name or URL (e.g. "youtube", "gmail", "github.com", "https://…"). Prefer this over open_url when the user says a site name. Use immediately when asked to go to / open a site.', parameters: { query: 'string' } },
  { name: 'read_screen_text', description: 'Confirm screenshot access and instruct extraction of text/links/code from the user screen.', parameters: {} },
  { name: 'copy_to_clipboard', description: 'Copy text to the system clipboard so the user can paste it.', parameters: { text: 'string' } },
  { name: 'type_text', description: 'Paste (default) or type text into the currently focused window. Use after opening an app/email/site when fields need filling. method:"paste" (preferred) or "type" (short text only). Never auto-send email — user clicks Send.', parameters: { text: 'string', method: 'string' } },
  { name: 'open_url', description: 'Open an exact http(s) URL or mailto link. Prefer open_website for site names.', parameters: { url: 'string' } },
  { name: 'save_screen_note', description: 'Save a markdown note (and screenshot if available) under Documents/Mirrly/notes.', parameters: { note: 'string' } },
  { name: 'save_text_file', description: 'Save text (summary, code, action items) under Documents/Mirrly/.', parameters: { filename: 'string', content: 'string' } },
  { name: 'search_notes', description: 'Search local Mirrly notes and memory for relevant past knowledge. Use when the user asks about something they may have saved before.', parameters: { query: 'string' } },
  { name: 'remember_fact', description: 'Store a durable fact in local Mirrly memory.', parameters: { fact: 'string' } },
  { name: 'draft_email', description: 'Open an email draft already filled in. ALWAYS write complete subject and full body (greeting, content, sign-off) — never placeholders. Defaults to Gmail compose (reliable). via:"mailto" uses the default mail app. Do NOT send — user clicks Send. If body looks missing after open, follow up with type_text paste.', parameters: { to: 'string', subject: 'string', body: 'string', via: 'string' } },
  { name: 'notify', description: 'Show a desktop notification.', parameters: { title: 'string', body: 'string' } },
  { name: 'speak', description: 'Speak text aloud with system TTS (handled by the UI).', parameters: { text: 'string' } }
];

function toolCatalogText() {
  return TOOL_DEFS.map((t) => '- ' + t.name + ': ' + t.description + ' args=' + JSON.stringify(t.parameters)).join('\n');
}

async function executeTool(name, args, ctx) {
  const a = args || {};
  switch (name) {
    case 'get_weather': return getWeather(a.location);
    case 'web_search': return webSearch(a.query);
    case 'fetch_page': return fetchPage(a.url);
    case 'research': return research(a.query);
    case 'open_app': return openApp(a.name || a.app || a.query);
    case 'open_website': return openWebsite(a.query || a.name || a.url || a.site);
    case 'read_screen_text': return readScreenTextHint(!!ctx.imageDataUrl);
    case 'copy_to_clipboard': return copyToClipboard(a.text);
    case 'type_text': return typeText({ text: a.text, method: a.method });
    case 'open_url': return openUrl(a.url);
    case 'save_screen_note': return saveScreenNote({ note: a.note, imageDataUrl: ctx.imageDataUrl });
    case 'save_text_file': return saveTextFile({ filename: a.filename, content: a.content });
    case 'search_notes': return searchNotes(a.query || a.q, ctx.store);
    case 'remember_fact': return rememberFact(ctx.store, a.fact);
    case 'draft_email': return draftEmail(a);
    case 'notify': return notify(a);
    case 'speak':
      if (ctx.onSpeak) ctx.onSpeak(String(a.text || ''));
      return { ok: true, spoken: true };
    default: return { ok: false, error: 'unknown tool: ' + name };
  }
}

function statusLabel(name) {
  return ({
    get_weather: 'Checking weather…',
    web_search: 'Searching…',
    fetch_page: 'Reading page…',
    research: 'Researching…',
    open_app: 'Opening app…',
    open_website: 'Opening website…',
    read_screen_text: 'Reading screen…',
    copy_to_clipboard: 'Copied to clipboard',
    type_text: 'Typing…',
    open_url: 'Opening link…',
    save_screen_note: 'Saved screen note',
    save_text_file: 'Saved file',
    search_notes: 'Searching notes…',
    remember_fact: 'Saved to memory',
    draft_email: 'Opening email draft…',
    notify: 'Notification sent',
    speak: 'Speaking…'
  })[name] || ('Running ' + name + '…');
}

/** Heuristic prefetch so keyless / non-tool models still get live weather. */
function detectLiveFactIntent(text) {
  const t = String(text || '');
  const weather = /\b(weather|temperature|temp|forecast|how\s+hot|how\s+cold|°\s*[cf]|degrees)\b/i.test(t);
  const live = /\b(today|now|currently|right\s+now|latest|news|price|stock)\b/i.test(t);
  let location = null;
  const m =
    t.match(/(?:in|for|at)\s+([A-Za-z][A-Za-z\s.'-]{1,40}?)(?:\s+today|\s+right\s+now|\s+now|[?.!]|$)/i) ||
    t.match(/temperature\s+(?:in|for|at)\s+([A-Za-z][A-Za-z\s.'-]{1,40})/i);
  if (m) location = m[1].replace(/\s+/g, ' ').trim();
  return { weather, live, location, searchQuery: t.replace(/^question:\s*/i, '').trim() };
}

async function prefetchLiveContext(userText) {
  const intent = detectLiveFactIntent(userText);
  const blocks = [];
  if (intent.weather) {
    const loc = intent.location || 'Toronto';
    try {
      const w = await getWeather(loc);
      blocks.push('LIVE_WEATHER_DATA:\n' + JSON.stringify(w, null, 2));
    } catch (e) {
      blocks.push('LIVE_WEATHER_DATA: error ' + (e && e.message));
    }
  } else if (intent.live && intent.searchQuery) {
    try {
      const s = await webSearch(intent.searchQuery.slice(0, 120));
      blocks.push(('LIVE_SEARCH_DATA:\n' + JSON.stringify(s, null, 2)).slice(0, 2500));
    } catch (e) {
      blocks.push('LIVE_SEARCH_DATA: error ' + (e && e.message));
    }
  }
  return blocks.join('\n\n');
}

/** Parse a tool call from model output: {"tool":"name","args":{...}} optionally in a fence. */
function parseToolCall(text) {
  let candidate = String(text || '').trim();
  const fenced = candidate.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) candidate = fenced[1].trim();
  candidate = candidate.replace(/^(TOOL_CALL|tool)\s*[:=]\s*/i, '').trim();
  // Must be essentially a lone JSON object (not prose with a JSON example inside).
  if (!candidate.startsWith('{')) return null;
  const end = candidate.lastIndexOf('}');
  if (end < 1) return null;
  const jsonSlice = candidate.slice(0, end + 1);
  const trailing = candidate.slice(end + 1).trim();
  if (trailing.length > 20) return null;
  const asCall = (obj) => {
    if (obj && typeof obj.tool === 'string') return { name: obj.tool, args: obj.args || obj.arguments || {} };
    if (obj && typeof obj.name === 'string' && (obj.args || obj.arguments)) {
      return { name: obj.name, args: obj.args || obj.arguments || {} };
    }
    return null;
  };
  try {
    return asCall(JSON.parse(jsonSlice));
  } catch { /* fall through to brace-balance repair */ }
  // Repair pass: some models emit the JSON twice or tack junk after it. Walk from
  // the first '{' to its true matching '}' (string-aware) and parse just that span.
  let depth = 0, inStr = false, escaped = false;
  for (let i = 0; i < candidate.length; i++) {
    const ch = candidate[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { if (inStr) escaped = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        try { return asCall(JSON.parse(candidate.slice(0, i + 1))); } catch { return null; }
      }
    }
  }
  return null;
}

module.exports = {
  TOOL_DEFS,
  toolCatalogText,
  executeTool,
  statusLabel,
  prefetchLiveContext,
  parseToolCall,
  detectLiveFactIntent,
  getWeather,
  webSearch
};
