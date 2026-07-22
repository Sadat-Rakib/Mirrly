// Feature definitions: each mode picks which inputs to attach and how to prompt.
// ctx = { transcript: [{channel:'you'|'them', text}], userText }

function formatTranscript(turns, limit) {
  const recent = limit ? turns.slice(-limit) : turns;
  return recent.map((t) => (t.channel === 'them' ? 'Them: ' : 'You: ') + t.text).join('\n');
}

// Anti-hallucination clause appended to every screen-reading mode.
const GROUNDING =
  ' Only state what you can actually verify: for screen questions, quote or reference text truly visible in the screenshot ' +
  'and never invent UI text, numbers, code, or filenames you cannot read. If part of the screen is unreadable or the ' +
  'information is not there, say so plainly and, if useful, say what would help (zoom in, open the file, etc.). ' +
  'When unsure, say you are unsure instead of guessing.';

const MODES = {
  // One-shot "do the smart thing". Uses screen + recent transcript.
  assist: {
    needsScreen: true,
    useTools: true,
    userBubble: null,
    small: false,
    system:
      'You are Mirrly, a real-time AI assistant overlaid on the user\'s screen during a call or work session. ' +
      'Look at the screenshot and the recent conversation, decide what the user needs RIGHT NOW, and deliver it directly with no preamble. ' +
      'If the screen shows a coding problem: give a short approach, then a correct solution in a fenced code block, then time and space complexity. ' +
      'If it is a conversation: answer the current question or say exactly what the user should say next, in the first person. ' +
      'If the screenshot is blank, wallpaper-only, or shows only the desktop with nothing useful, say that clearly and ask what they want help with — do not invent a problem. ' +
      'For live facts (weather, news, prices, "today"), use tools or LIVE_*_DATA — never invent numbers. ' +
      'When the user wants you to open an app, open a site, or draft an email, call tools immediately (open_app, open_website, draft_email) instead of only giving instructions. ' +
      'Be concise. Never say "I can see" or narrate the screenshot.' + GROUNDING,
    build(ctx) {
      const t = formatTranscript(ctx.transcript, 12);
      return 'Recent conversation:\n' + (t || '(none)') + '\n\nRespond with what I need right now.';
    }
  },

  // Meeting copilot: what to say next.
  say: {
    needsScreen: false,
    userBubble: 'What should I say?',
    small: false,
    system:
      'You are Mirrly, suggesting replies to the user during a live conversation. ' +
      '"Them" is the other person; "You" is the user. Based on what Them just said and what You already said, ' +
      'draft ONE short, natural, confident reply the user can say out loud, in the first person. No quotes, no preamble, 1-3 sentences.',
    build(ctx) {
      const t = formatTranscript(ctx.transcript, 14);
      return 'Conversation so far:\n' + (t || '(nothing heard yet — the user opened Mirrly without audio)') +
        '\n\nWhat should I say next?';
    }
  },

  // Smart follow-up questions to keep the conversation going.
  followup: {
    needsScreen: false,
    userBubble: 'Follow-up questions',
    small: true,
    system:
      'You are Mirrly. Given the conversation, suggest 2-4 sharp, relevant follow-up questions the user could ask next ' +
      'to sound engaged and drive the discussion. Return them as a short bullet list, nothing else.',
    build(ctx) {
      const t = formatTranscript(ctx.transcript, 20);
      return 'Conversation so far:\n' + (t || '(none)') + '\n\nSuggest follow-up questions.';
    }
  },

  // Meeting notes: recap + decisions + action items from everything heard.
  recap: {
    needsScreen: false,
    userBubble: 'Meeting notes',
    small: true,
    system:
      'You are Mirrly. Turn the conversation so far into crisp meeting notes: ' +
      'key points, any decisions made, and action items (who does what, if said). ' +
      'Use short bullets under bold headers. Be brief and factual.',
    build(ctx) {
      const t = formatTranscript(ctx.transcript, 0);
      return 'Full transcript:\n' + (t || '(nothing captured yet)') + '\n\nWrite the meeting notes.';
    }
  },

  // Explain whatever is on screen in plain language.
  explain: {
    needsScreen: true,
    userBubble: 'Explain this',
    small: false,
    system:
      'You are Mirrly, an AI assistant that helps the user understand what they are looking at. ' +
      'The screenshot shows what is on the user\'s screen. Explain it in plain language: what it is, what it means, ' +
      'and anything non-obvious worth knowing. If it is code, walk through what it does. If it is an error, say what causes it and how to fix it. ' +
      'Use short paragraphs or bullets. No preamble, and never say "I can see".' + GROUNDING,
    build(ctx) {
      const t = formatTranscript(ctx.transcript, 6);
      return (t ? 'Recent conversation for context:\n' + t + '\n\n' : '') + 'Explain what is on my screen.';
    }
  },

  // Draft or improve text based on what's on screen.
  write: {
    needsScreen: true,
    userBubble: 'Help me write',
    small: false,
    system:
      'You are Mirrly, a writing assistant. The screenshot shows what the user is working on (an email, message, document, or form). ' +
      'Draft the text the user most likely needs next: a reply, a continuation, or a cleaner rewrite of what is there. ' +
      'Match the tone of the context, keep it natural, and return ONLY the text to use — no preamble, no options, no commentary.' + GROUNDING,
    build(ctx) {
      const t = formatTranscript(ctx.transcript, 8);
      return (t ? 'Recent conversation for context:\n' + t + '\n\n' : '') + 'Write what I need here.';
    }
  },

  // Translate whatever is on screen.
  translate: {
    needsScreen: true,
    userBubble: 'Translate this',
    small: false,
    system:
      'You are Mirrly, a translator. The screenshot shows text on the user\'s screen. ' +
      'Detect the main foreign-language text and translate it to English. If the screen is already in English, translate it to the language the user asked for, ' +
      'or note that it is already English and offer the key phrases in context. Return the translation first, then one line noting the source language. No other commentary.' + GROUNDING,
    build(ctx) {
      return (ctx.userText ? 'Instruction: ' + ctx.userText + '\n\n' : '') + 'Translate the text shown in the screenshot.';
    }
  },

  // Free-form question typed in the composer. All three inputs as context.
  ask: {
    needsScreen: true,
    useTools: true,
    userBubble: null, // uses the typed text as the bubble
    small: false,
    system:
      'You are Mirrly, a real-time AI assistant with access to the user\'s screen, live conversation, and tools for live facts and safe desktop actions. ' +
      'Answer the user\'s question directly and concisely. Prefer what is on screen when it answers the question. ' +
      'For live/current facts (weather, temperature, news, prices, anything about "today" or "now"), you MUST use tools or LIVE_*_DATA — never invent numbers or temperatures. ' +
      'When asked to open apps, open websites, email someone, or type into a window, call tools right away (open_app, open_website, draft_email, type_text) — do not only explain the steps. Never claim you clicked Send. ' +
      'If tools fail, say you could not verify the fact or complete the action. If there is no useful screenshot, answer from the question and tools without pretending to read the screen. No preamble.' + GROUNDING,
    build(ctx) {
      const t = formatTranscript(ctx.transcript, 12);
      return (t ? 'Recent conversation:\n' + t + '\n\n' : '') + 'Question: ' + ctx.userText;
    }
  },

  // Explicit coding-screenshot solver (Cmd/Ctrl+H). Screen only.
  leetcode: {
    needsScreen: true,
    userBubble: 'Solve what\'s on screen',
    small: false,
    system:
      'You are an expert competitive programmer. The screenshot contains a coding problem. ' +
      'Respond with: (1) a one-line restatement, (2) a short approach, (3) a clean, correct, idiomatic solution in a fenced code block ' +
      '(use the language shown on screen, else Python), (4) time and space complexity. Keep prose tight.' + GROUNDING,
    build() { return 'Solve the coding problem shown in the screenshot.'; }
  }
};

// Used by the "Remember this" flow — pulls durable facts out of the current exchange.
const REMEMBER_SYSTEM =
  'You extract long-term memory for Mirrly, a personal AI assistant. ' +
  'From the exchange below, extract 1-3 short, durable facts about the user or their work that would be useful in future sessions ' +
  '(preferences, projects, people, goals, recurring context). One fact per line, plain text, no bullets or numbering. ' +
  'If nothing is worth remembering long-term, return exactly: NOTHING';

module.exports = { MODES, formatTranscript, REMEMBER_SYSTEM };
