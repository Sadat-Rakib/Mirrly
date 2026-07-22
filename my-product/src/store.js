// Simple JSON-file settings store (avoids native modules so `npm install` stays clean).
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const FILE = path.join(app.getPath('userData'), 'mirrly-data.json');
// Pre-rename installs kept settings in the "cue" userData dir under the old filename.
const LEGACY_FILE = path.join(app.getPath('appData'), 'cue', 'cue-data.json');
const REMOVED_PROVIDERS = ['deepgram'];
const MASCOT_CHARACTERS = ['cat', 'dog', 'fox', 'bunny'];

function normalizeMascotCharacter(id) {
  return MASCOT_CHARACTERS.includes(id) ? id : 'cat';
}

const DEFAULTS = {
  provider: 'pollinations',
  smart: false,
  tts: false,
  clipboardCtx: false,
  customBaseUrl: '',
  sttModel: '',
  mascotMode: false,
  mascotRoam: true,
  mascotCharacter: 'cat',
  mascotPos: null,
  skillsEnabled: null, // null = all skills on; array of ids when customized
  memory: [],
  history: [],
  apiKeys: {
    openai: '', anthropic: '', gemini: '', groqcloud: '', openrouter: '', cerebras: '', mistral: '',
    cohere: '', huggingface: '', pollinations: '', alibaba: '', omnirouter: '', ninerouter: '', custom: ''
  },
  models: {
    openai: { fast: 'gpt-4o-mini', smart: 'gpt-4o' },
    anthropic: { fast: 'claude-3-5-haiku-latest', smart: 'claude-3-5-sonnet-latest' },
    gemini: { fast: 'gemini-2.5-flash-lite', smart: 'gemini-2.5-pro' },
    groqcloud: { fast: 'llama-3.1-8b-instant', smart: 'llama-3.3-70b-versatile' },
    openrouter: { fast: 'google/gemma-4-26b-a4b-it:free', smart: 'google/gemma-4-31b-it:free' },
    cerebras: { fast: 'llama3.1-8b', smart: 'llama-3.3-70b' },
    mistral: { fast: 'mistral-small-latest', smart: 'mistral-medium-latest' },
    cohere: { fast: 'command-r7b-12-2024', smart: 'command-a-03-2025' },
    huggingface: { fast: 'Qwen/Qwen2.5-7B-Instruct', smart: 'meta-llama/Llama-3.3-70B-Instruct' },
    pollinations: { fast: 'openai-fast', smart: 'openai-fast' },
    alibaba: { fast: 'qwen-turbo', smart: 'qwen-max' },
    omnirouter: { fast: 'meta-llama/llama-3-8b-instruct', smart: 'meta-llama/llama-3-70b-instruct' },
    ninerouter: { fast: 'default-fast', smart: 'default-smart' },
    custom: { fast: 'gpt-4o-mini', smart: 'gpt-4o' }
  }
};

let data = null;

function deepMerge(base, over) {
  const out = Array.isArray(base) ? base.slice() : { ...base };
  for (const k of Object.keys(over || {})) {
    if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) && typeof base[k] === 'object' && !Array.isArray(base[k])) {
      out[k] = deepMerge(base[k], over[k]);
    } else {
      out[k] = over[k];
    }
  }
  return out;
}

// One-time import of legacy cue settings; drops providers Mirrly no longer ships.
function migrateLegacy() {
  try {
    if (fs.existsSync(FILE) || !fs.existsSync(LEGACY_FILE)) return;
    const old = JSON.parse(fs.readFileSync(LEGACY_FILE, 'utf8'));
    for (const k of REMOVED_PROVIDERS) {
      if (old.apiKeys) delete old.apiKeys[k];
      if (old.models) delete old.models[k];
    }
    if (REMOVED_PROVIDERS.includes(old.provider)) old.provider = 'pollinations';
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(old, null, 2));
  } catch { /* fresh defaults are fine */ }
}

// Old stock model defaults that no longer exist (or lost vision). Only exact
// matches are rewritten — a model the user typed themselves is never touched.
const MODEL_UPGRADES = {
  pollinations: { fast: ['openai', 'openai-fast'], smart: ['openai-large', 'openai-fast'] },
  openrouter: {
    fast: ['deepseek/deepseek-chat-v3-0324:free', 'google/gemma-4-26b-a4b-it:free'],
    smart: ['meta-llama/llama-3.3-70b-instruct:free', 'google/gemma-4-31b-it:free']
  }
};

function migrateModels() {
  let changed = false;
  for (const provider of Object.keys(MODEL_UPGRADES)) {
    const tiers = MODEL_UPGRADES[provider];
    const current = data.models && data.models[provider];
    if (!current) continue;
    for (const tier of Object.keys(tiers)) {
      const [oldDefault, newDefault] = tiers[tier];
      if (current[tier] === oldDefault) { current[tier] = newDefault; changed = true; }
    }
  }
  if (changed) save();
}

function load() {
  if (data) return data;
  migrateLegacy();
  try { data = deepMerge(DEFAULTS, JSON.parse(fs.readFileSync(FILE, 'utf8'))); }
  catch { data = deepMerge(DEFAULTS, {}); }
  data.mascotCharacter = normalizeMascotCharacter(data.mascotCharacter);
  migrateModels();
  return data;
}
function save() { try { fs.writeFileSync(FILE, JSON.stringify(data, null, 2)); } catch (e) { /* ignore */ } }

module.exports = {
  MASCOT_CHARACTERS,
  normalizeMascotCharacter,
  getSettings() { return load(); },
  setSettings(patch) {
    load();
    const next = { ...(patch || {}) };
    if (next.mascotCharacter != null) next.mascotCharacter = normalizeMascotCharacter(next.mascotCharacter);
    data = deepMerge(data, next);
    save();
    return data;
  }
};
