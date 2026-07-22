// Vision-capability heuristic shared by main and the renderer (via preload).
// Verdicts are substring guesses, not guarantees — used only to warn, never to block.

const VISION_HINTS = [
  'gpt-4o', 'gpt-4.1', 'gpt-5', 'chatgpt', 'o3', 'o4',
  'gemini', 'gemma-3', 'gemma-4',
  'claude-3', 'claude-sonnet', 'claude-opus', 'claude-haiku',
  'llava', 'vision', '-vl', 'vl-', 'omni',
  'llama-4', 'scout', 'maverick',
  'pixtral', 'phi-4-multimodal', 'internvl', 'minicpm', 'qwen2.5-vl', 'qwen3-vl'
];

const TEXT_ONLY_HINTS = [
  // Pollinations' anonymous tier is GPT-OSS (text-only); 'openai'/'openai-large'/'openai-fast' alias it.
  'gpt-oss', 'openai-fast',
  'llama-3', 'llama3.', '8b-instant', '70b-versatile',
  'deepseek', 'command-', 'qwen-turbo', 'qwen-max', 'mistral-small', 'mistral-medium',
  'whisper'
];

function modelLikelyVision(provider, model) {
  const m = String(model || '').toLowerCase();
  if (!m) return 'unknown';
  // Pollinations aliases don't reveal the text-only backend by name.
  if (provider === 'pollinations' && (m === 'openai' || m === 'openai-large')) return 'no';
  for (const h of TEXT_ONLY_HINTS) if (m.includes(h)) return 'no';
  for (const h of VISION_HINTS) if (m.includes(h)) return 'yes';
  return 'unknown';
}

const VISION_WARN_TEXT =
  'This model likely can’t see images — screen features (Assist, Explain, Solve) may describe nothing or make things up. Pick a vision-capable model.';
const VISION_UNKNOWN_TEXT =
  'Unverified whether this model supports images. If screen answers look invented, switch to a vision-capable model.';

module.exports = { modelLikelyVision, VISION_WARN_TEXT, VISION_UNKNOWN_TEXT };
