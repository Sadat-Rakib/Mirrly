// Tool-using loop for ask/assist. Works with all providers via JSON tool protocol + live prefetch.
const {
  toolCatalogText,
  executeTool,
  statusLabel,
  prefetchLiveContext,
  parseToolCall
} = require('./tools');

const MAX_ROUNDS = 5;

const TOOL_PROTOCOL =
  '\n\nYou have tools. For live facts (weather, news, prices, "today"/"now"), you MUST use tools or the LIVE_*_DATA provided — never invent numbers.\n' +
  'When the user asks you to open an app, open a website, go somewhere online, email someone, or type/paste something, you MUST call the matching tool immediately — do not only describe how they could do it.\n' +
  'Prefer open_website for site names, open_app for desktop apps, draft_email for messages (user still clicks Send), type_text to fill the focused window, search_notes for past local knowledge.\n' +
  'If the screenshot is missing or only shows an empty desktop, say so honestly and help from the question alone.\n' +
  'To call a tool, reply with ONLY a JSON object — no markdown, no prose, no code fence:\n' +
  '{"tool":"TOOL_NAME","args":{...}}\n' +
  'Example tool call: {"tool":"open_website","args":{"query":"youtube"}}\n' +
  'Available tools:\n' + toolCatalogText() + '\n' +
  'When you are NOT calling a tool, answer in plain language only — never output bare JSON, and never wrap a normal answer in a code fence.\n' +
  'Example direct answer: That dialog is your billing settings — the total in the top right is what you owe this month.\n' +
  'After tool results arrive, answer the user in plain language. When your answer uses web results, cite them inline like (source: example.com). Prefer screen content when it answers the question.';

/**
 * Stream one model reply, holding tokens back only while the reply still looks
 * like a tool call (starts with '{' or a fence). Prose streams to the UI live.
 * Returns { text, call, emitted } — emitted means tokens already went to onToken.
 */
async function streamWithToolGate(llm, params, onToken) {
  let pending = '';
  let live = false;
  let gated = false;
  const full = await llm.stream({
    ...params,
    onToken: (t) => {
      if (live) { onToken(t); return; }
      pending += t;
      if (gated) return;
      const head = pending.replace(/^\s+/, '');
      if (!head) return;
      if (head.startsWith('{') || head.startsWith('```')) { gated = true; return; }
      live = true;
      onToken(pending);
      pending = '';
    }
  });
  const text = String(full || '').trim();
  if (live) return { text, call: null, emitted: true };
  return { text, call: parseToolCall(text), emitted: false };
}

/**
 * Run ask/assist with optional tools.
 * @param {object} opts
 * @param {object} opts.llm
 * @param {string} opts.system
 * @param {Array} opts.turns
 * @param {string|null} opts.imageDataUrl
 * @param {string} opts.userText
 * @param {boolean} opts.hasScreen
 * @param {object} opts.store
 * @param {(msg:string)=>void} opts.onStatus
 * @param {(t:string)=>void} opts.onToken
 * @param {(t:string)=>void} [opts.onSpeak]
 */
async function runAgent(opts) {
  const {
    llm, system, turns, imageDataUrl, userText, hasScreen,
    store, onStatus, onToken, onSpeak
  } = opts;

  let sys = system + TOOL_PROTOCOL;
  if (!hasScreen) {
    sys += '\n\nNOTE: No screenshot is available this turn. Do not claim to see the user\'s screen.';
  }

  const live = await prefetchLiveContext(userText || '');
  if (live) {
    onStatus && onStatus('Fetching live data…');
  }

  const workTurns = turns.map((t) => ({ ...t }));
  if (live && workTurns.length) {
    const last = workTurns[workTurns.length - 1];
    last.text = last.text + '\n\n' + live +
      '\n\nUse LIVE_*_DATA above for any current facts. Do not invent weather or numbers that contradict it.';
  }

  const toolCtx = {
    imageDataUrl,
    store,
    onSpeak: (text) => {
      onSpeak && onSpeak(text);
    }
  };

  // The screenshot stays attached every round (it rides on the latest user turn),
  // so tool-using answers can still quote what is actually on screen.
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const { text, call, emitted } = await streamWithToolGate(llm, {
      system: sys,
      turns: workTurns,
      imageDataUrl
    }, onToken);

    if (!call) {
      if (!emitted && text) onToken(text);
      return text;
    }

    onStatus && onStatus(statusLabel(call.name));
    const result = await executeTool(call.name, call.args, toolCtx);
    workTurns.push({ role: 'assistant', text: JSON.stringify({ tool: call.name, args: call.args }) });
    workTurns.push({
      role: 'user',
      text: 'TOOL_RESULT for ' + call.name + ':\n' + JSON.stringify(result, null, 2) +
        '\n\nContinue. Call another tool with JSON only if needed, otherwise answer the user now in plain language.'
    });
  }

  const { text: finalText, emitted } = await streamWithToolGate(llm, {
    system: sys + '\n\nAnswer the user now in plain language. No more tool JSON.',
    turns: workTurns,
    imageDataUrl
  }, onToken);
  if (!emitted && finalText) onToken(finalText);
  return finalText;
}

module.exports = { runAgent };
