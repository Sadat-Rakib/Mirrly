// Keyless web research: real DuckDuckGo results + readable page extraction.
// No API keys, no scraping libraries — regex parsing kept deliberately tolerant.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Mirrly/0.3';
const FETCH_TIMEOUT_MS = 10000;
const MAX_BODY_BYTES = 600 * 1024;

async function timedFetch(url, opts) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...opts, signal: ctl.signal, headers: { 'user-agent': UA, ...(opts && opts.headers) } });
  } finally {
    clearTimeout(timer);
  }
}

function decodeEntities(s) {
  return String(s)
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ');
}

function stripTags(html) {
  return decodeEntities(String(html).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

// DDG result links are /l/?uddg=<encoded-real-url>&... redirects.
function resolveDdgHref(href) {
  const h = decodeEntities(String(href || ''));
  const m = h.match(/[?&]uddg=([^&]+)/);
  if (m) { try { return decodeURIComponent(m[1]); } catch { /* keep raw */ } }
  if (/^https?:\/\//i.test(h)) return h;
  if (h.startsWith('//')) return 'https:' + h;
  return null;
}

function parseDdgHtml(html) {
  const results = [];
  const linkRe = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const snippetRe = /<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>|<td[^>]*class="[^"]*result-snippet[^"]*"[^>]*>([\s\S]*?)<\/td>/gi;
  const snippets = [];
  let m;
  while ((m = snippetRe.exec(html)) && snippets.length < 10) snippets.push(stripTags(m[1] || m[2] || ''));
  let i = 0;
  while ((m = linkRe.exec(html)) && results.length < 6) {
    const url = resolveDdgHref(m[1]);
    const title = stripTags(m[2]);
    if (!url || !title) continue;
    if (/duckduckgo\.com/i.test(url)) continue;
    results.push({ title, url, snippet: snippets[i] || '' });
    i++;
  }
  return results;
}

// lite.duckduckgo.com markup: plain <a> results in a table, snippets in .result-snippet cells.
function parseDdgLite(html) {
  const results = [];
  const linkRe = /<a[^>]*rel="nofollow"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const snippetRe = /<td[^>]*class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi;
  const snippets = [];
  let m;
  while ((m = snippetRe.exec(html)) && snippets.length < 10) snippets.push(stripTags(m[1]));
  let i = 0;
  while ((m = linkRe.exec(html)) && results.length < 6) {
    const url = resolveDdgHref(m[1]);
    const title = stripTags(m[2]);
    if (!url || !title) continue;
    if (/duckduckgo\.com/i.test(url)) continue;
    results.push({ title, url, snippet: snippets[i] || '' });
    i++;
  }
  return results;
}

async function ddgSearch(query) {
  const q = String(query || '').trim();
  if (!q) return { ok: false, error: 'query required' };
  try {
    const res = await timedFetch('https://html.duckduckgo.com/html/?q=' + encodeURIComponent(q));
    if (res.ok) {
      const results = parseDdgHtml(await res.text());
      if (results.length) return { ok: true, query: q, results, source: 'DuckDuckGo' };
    }
  } catch { /* fall through to lite */ }
  try {
    const res = await timedFetch('https://lite.duckduckgo.com/lite/?q=' + encodeURIComponent(q));
    if (res.ok) {
      const results = parseDdgLite(await res.text());
      if (results.length) return { ok: true, query: q, results, source: 'DuckDuckGo Lite' };
    }
  } catch { /* fall through */ }
  return { ok: false, error: 'search unavailable', query: q };
}

function extractReadable(html) {
  let s = String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, ' ')
    .replace(/<(nav|footer|header|aside)[\s\S]*?<\/\1>/gi, ' ');
  s = s.replace(/<(p|div|br|li|h[1-6]|tr)[^>]*>/gi, '\n');
  s = decodeEntities(s.replace(/<[^>]*>/g, ' '));
  return s.replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim().slice(0, 6000);
}

async function fetchPage(url) {
  const u = String(url || '').trim();
  if (!/^https?:\/\//i.test(u)) return { ok: false, error: 'only http(s) URLs allowed' };
  let res;
  try {
    res = await timedFetch(u);
  } catch (e) {
    return { ok: false, error: 'fetch failed: ' + ((e && e.message) || String(e)) };
  }
  if (!res.ok) return { ok: false, error: 'fetch failed: HTTP ' + res.status };
  const type = (res.headers.get('content-type') || '').toLowerCase();
  if (!type.includes('text/html') && !type.includes('text/plain') && !type.includes('application/xhtml')) {
    return { ok: false, error: 'not a readable page (content-type: ' + (type || 'unknown') + ')' };
  }
  const raw = (await res.text()).slice(0, MAX_BODY_BYTES);
  const text = type.includes('text/plain') ? raw.slice(0, 6000) : extractReadable(raw);
  if (!text) return { ok: false, error: 'page had no readable text' };
  return { ok: true, url: u, text };
}

// One-shot compound research: search + read the top pages. Keeps weak models to a single round.
async function research(query) {
  const search = await ddgSearch(query);
  if (!search.ok) return search;
  const top = search.results.slice(0, 2);
  const pages = await Promise.all(top.map(async (r) => {
    const page = await fetchPage(r.url);
    return page.ok ? { url: r.url, title: r.title, text: page.text.slice(0, 3000) } : { url: r.url, title: r.title, error: page.error };
  }));
  return { ok: true, query: search.query, results: search.results, pages, note: 'Cite the URLs you used in the answer.' };
}

module.exports = { ddgSearch, fetchPage, research };
