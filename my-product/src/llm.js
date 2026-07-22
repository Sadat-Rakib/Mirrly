// LLM factory — Gemini native + Anthropic + OpenAI-compatible endpoints behind one streaming interface.
// stream({ system, turns:[{role,text}], imageDataUrl, maxTokens, onToken }) -> Promise<fullText>

function stripDataUrl(dataUrl) {
  const m = /^data:(.+?);base64,(.*)$/s.exec(dataUrl || '');
  return m ? { mime: m[1], b64: m[2] } : null;
}

async function streamOpenAI({ apiKey, model, system, turns, imageDataUrl, maxTokens, onToken, baseURL }) {
  const OpenAI = require('openai');
  const clientConfig = { apiKey };
  if (baseURL) clientConfig.baseURL = baseURL;
  const client = new OpenAI(clientConfig);
  const messages = [{ role: 'system', content: system }];
  turns.forEach((t, i) => {
    const last = i === turns.length - 1;
    if (last && imageDataUrl && t.role === 'user') {
      messages.push({ role: 'user', content: [
        { type: 'text', text: t.text },
        { type: 'image_url', image_url: { url: imageDataUrl } }
      ] });
    } else {
      messages.push({ role: t.role, content: t.text });
    }
  });
  // Keep params minimal — some compat endpoints (Cohere, Pollinations) reject extras.
  const stream = await client.chat.completions.create({ model, messages, stream: true, max_tokens: maxTokens });
  let full = '';
  for await (const part of stream) {
    const d = part.choices && part.choices[0] && part.choices[0].delta && part.choices[0].delta.content;
    if (d) { full += d; onToken(d); }
  }
  return full;
}

async function streamGemini({ apiKey, model, system, turns, imageDataUrl, maxTokens, onToken }) {
  const { GoogleGenAI } = require('@google/genai');
  const ai = new GoogleGenAI({ apiKey });
  const contents = turns.map((t, i) => {
    const last = i === turns.length - 1;
    const parts = [{ text: t.text }];
    if (last && imageDataUrl && t.role === 'user') {
      const img = stripDataUrl(imageDataUrl);
      if (img) parts.push({ inlineData: { mimeType: img.mime, data: img.b64 } });
    }
    return { role: t.role === 'assistant' ? 'model' : 'user', parts };
  });
  const stream = await ai.models.generateContentStream({
    model, contents, config: { systemInstruction: system, maxOutputTokens: maxTokens }
  });
  let full = '';
  for await (const chunk of stream) {
    const t = chunk && chunk.text;
    if (t) { full += t; onToken(t); }
  }
  return full;
}

async function streamAnthropic({ apiKey, model, system, turns, imageDataUrl, maxTokens, onToken }) {
  const messages = turns.map((t, i) => {
    const last = i === turns.length - 1;
    if (last && imageDataUrl && t.role === 'user') {
      const img = stripDataUrl(imageDataUrl);
      const content = [{ type: 'text', text: t.text }];
      if (img) {
        content.push({
          type: 'image',
          source: { type: 'base64', media_type: img.mime, data: img.b64 }
        });
      }
      return { role: 'user', content };
    }
    return { role: t.role === 'assistant' ? 'assistant' : 'user', content: t.text };
  });

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages,
      stream: true
    })
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error('Anthropic ' + res.status + (errText ? ': ' + errText.slice(0, 200) : ''));
  }

  let full = '';
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split('\n');
    buf = parts.pop() || '';
    for (const line of parts) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6).trim();
      if (!payload || payload === '[DONE]') continue;
      let evt;
      try { evt = JSON.parse(payload); } catch { continue; }
      if (evt.type === 'content_block_delta' && evt.delta && evt.delta.text) {
        full += evt.delta.text;
        onToken(evt.delta.text);
      }
    }
  }
  return full;
}

// Every provider except Gemini / Anthropic speaks the OpenAI chat-completions dialect.
const BASE_URLS = {
  openai: 'https://api.openai.com/v1',
  groqcloud: 'https://api.groq.com/openai/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  cerebras: 'https://api.cerebras.ai/v1',
  mistral: 'https://api.mistral.ai/v1',
  cohere: 'https://api.cohere.ai/compatibility/v1',
  huggingface: 'https://router.huggingface.co/v1',
  pollinations: 'https://text.pollinations.ai/openai',
  alibaba: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
  omnirouter: 'https://api.omnirouter.ai/v1',
  ninerouter: 'https://api.9router.com/v1'
};
const KEYLESS = ['pollinations'];

function createLLM(settings) {
  const provider = settings.provider;
  const keys = settings.apiKeys || {};
  const apiKey = keys[provider];
  const tier = settings.smart ? 'smart' : 'fast';
  const model = (settings.models[provider] || {})[tier];
  const maxTokens = settings.smart ? 2048 : 1024;
  const customBaseUrl = (settings.customBaseUrl || '').trim();

  const ready = provider === 'custom'
    ? !!(apiKey && customBaseUrl && model)
    : (!!apiKey || KEYLESS.includes(provider)) && !!model;

  return {
    provider, model, apiKey,
    ready,
    async stream(params) {
      const args = { apiKey, model, maxTokens, ...params };
      if (provider === 'gemini') return streamGemini(args);
      if (provider === 'anthropic') return streamAnthropic(args);
      if (provider === 'custom') {
        if (!customBaseUrl) throw new Error('Set a Custom base URL in Settings.');
        return streamOpenAI({ ...args, baseURL: customBaseUrl });
      }
      if (BASE_URLS[provider]) {
        // The OpenAI SDK refuses an empty key; keyless providers get a placeholder.
        return streamOpenAI({ ...args, apiKey: apiKey || 'mirrly', baseURL: BASE_URLS[provider] });
      }
      throw new Error('unknown provider: ' + provider);
    }
  };
}

module.exports = { createLLM };
