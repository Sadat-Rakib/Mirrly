/* Mirrly renderer — UI state, mic capture, IPC, streaming render. */
(function () {
  const { icon } = window.ICONS;
  const mirrly = window.mirrly; // exposed by preload
  const $ = (s) => document.querySelector(s);

  const IS_MAC = mirrly.platform === 'darwin';
  const MOD = IS_MAC ? '⌘' : 'Ctrl';
  const kbd = (k) => '<span class="kbd">' + k + '</span>';

  // ---- paint icons -------------------------------------------------------
  $('#logo-btn').innerHTML = icon('logo', { size: 20 });
  $('.tb-hide .chev').innerHTML = icon('chevron-down', { size: 14 });
  $('#new-chat-btn').innerHTML = icon('plus', { size: 16 });
  $('#stop-btn').innerHTML = icon('mic', { size: 15 });
  $('#voice-btn').innerHTML = icon('audio-lines', { size: 15 });
  $('#kc-mod').textContent = MOD;
  const ACT_ICONS = { assist: 'sparkles', explain: 'lightbulb', write: 'pen-line', translate: 'languages', say: 'wand-sparkles', recap: 'book-open' };
  document.querySelectorAll('.act[data-mode]').forEach((btn) => {
    btn.querySelector('.ic').innerHTML = icon(ACT_ICONS[btn.dataset.mode] || 'sparkles', { size: 15 });
  });
  $('#remember-btn .ic').innerHTML = icon('bookmark', { size: 15 });
  $('#smart-toggle .ic').innerHTML = icon('zap', { size: 14 });
  $('#more-btn').innerHTML = icon('more-horizontal', { size: 18 });
  $('#dictate-btn').innerHTML = icon('mic', { size: 16 });
  $('#send-btn').innerHTML = icon('play', { size: 15 });

  // ---- state -------------------------------------------------------------
  let settings = null;
  let busy = false;
  let aiEl = null;       // current streaming <div class="ai-text">
  let caretEl = null;

  const messages = $('#messages');

  function esc(s) { return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  // minimal, safe markdown: fenced code, bullets, inline code, bold, paragraphs
  function renderMarkdown(text) {
    const lines = text.split('\n');
    let html = '', inCode = false, inList = false, buf = [];
    const flushP = () => { if (buf.length) { html += '<p>' + inline(buf.join(' ')) + '</p>'; buf = []; } };
    const inline = (s) => esc(s)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    for (const raw of lines) {
      const line = raw;
      if (/^```/.test(line.trim())) {
        if (!inCode) { flushP(); if (inList) { html += '</ul>'; inList = false; } html += '<pre><code>'; inCode = true; }
        else { html += '</code></pre>'; inCode = false; }
        continue;
      }
      if (inCode) { html += esc(line) + '\n'; continue; }
      if (/^\s*[-*]\s+/.test(line)) { flushP(); if (!inList) { html += '<ul>'; inList = true; } html += '<li>' + inline(line.replace(/^\s*[-*]\s+/, '')) + '</li>'; continue; }
      if (line.trim() === '') { flushP(); if (inList) { html += '</ul>'; inList = false; } continue; }
      buf.push(line.trim());
    }
    flushP(); if (inList) html += '</ul>'; if (inCode) html += '</code></pre>';
    return html;
  }

  function clearMessages() { messages.innerHTML = ''; aiEl = null; caretEl = null; }

  function addUserBubble(text) {
    const b = document.createElement('div');
    b.className = 'user-bubble';
    b.textContent = text;
    messages.appendChild(b);
  }

  function startAi(small) {
    aiEl = document.createElement('div');
    aiEl.className = 'ai-text' + (small ? ' small' : '');
    aiEl.dataset.raw = '';
    caretEl = document.createElement('span');
    caretEl.className = 'ai-caret';
    aiEl.appendChild(caretEl);
    messages.appendChild(aiEl);
  }

  function appendToken(t) {
    if (!aiEl) startAi(false);
    aiEl.dataset.raw += t;
    const span = document.createElement('span');
    span.className = 'w';
    span.textContent = t;
    aiEl.insertBefore(span, caretEl);
  }

  function finalizeAi() {
    if (!aiEl) return '';
    const raw = aiEl.dataset.raw || '';
    aiEl.innerHTML = renderMarkdown(raw);
    aiEl = null; caretEl = null;
    return raw;
  }

  function setBusy(v) { busy = v; $('#send-btn').classList.toggle('busy', v); }

  // ---- spoken answers (built-in speechSynthesis, no deps) ----------------
  function speak(raw, force) {
    return new Promise((resolve) => {
      if (!raw) { resolve(); return; }
      if (!force && (!settings || !settings.tts)) { resolve(); return; }
      const plain = String(raw)
        .replace(/```[\s\S]*?```/g, ' Code block omitted. ')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/^[-*]\s+/gm, '');
      try {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(plain.slice(0, 1200));
        u.rate = 1.05;
        u.onend = () => resolve();
        u.onerror = () => resolve();
        speechSynthesis.speak(u);
      } catch { resolve(); }
    });
  }

  // ---- actions -----------------------------------------------------------
  function runMode(mode, text) {
    if (busy) return;
    try { speechSynthesis.cancel(); } catch { }
    setBusy(true);
    mirrly.ask({ mode, text: text || '' });
  }

  document.querySelectorAll('.act[data-mode]').forEach((btn) => {
    btn.addEventListener('click', () => runMode(btn.dataset.mode, ''));
  });
  $('#remember-btn').addEventListener('click', () => { if (!busy) mirrly.remember(); });

  const input = $('#input');
  const placeholder = $('#placeholder');
  const composer = $('#composer');

  function syncPlaceholder() {
    placeholder.classList.toggle('hidden', input.value.length > 0 || document.activeElement === input);
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 140) + 'px';
  }
  input.addEventListener('input', syncPlaceholder);
  input.addEventListener('focus', () => { composer.classList.add('focused'); placeholder.classList.add('hidden'); });
  input.addEventListener('blur', () => { composer.classList.remove('focused'); syncPlaceholder(); });
  $('#input-area').addEventListener('click', () => input.focus());

  function send() {
    const text = input.value.trim();
    if (!text) { runMode('assist', ''); return; }
    input.value = ''; syncPlaceholder();
    runMode('ask', text);
  }
  $('#send-btn').addEventListener('click', send);
  input.addEventListener('keydown', (e) => {
    const mod = IS_MAC ? e.metaKey : e.ctrlKey;
    if (e.key === 'Enter' && !e.shiftKey && !mod) { e.preventDefault(); send(); }
    if (e.key === 'Enter' && mod) { e.preventDefault(); runMode('assist', ''); }
  });

  // Smart toggle
  const smartBtn = $('#smart-toggle');
  smartBtn.addEventListener('click', async () => {
    settings.smart = !settings.smart;
    smartBtn.classList.toggle('on', settings.smart);
    await mirrly.settingsSet({ smart: settings.smart });
  });

  // Hide / collapse (in mascot mode the whole panel window shrinks back to the cat)
  $('#hide-btn').addEventListener('click', () => {
    if (document.body.classList.contains('mascot-mode')) { mirrly.mascotClosePanel(); return; }
    const collapsed = $('#panel').classList.toggle('collapsed');
    $('#hide-btn').classList.toggle('collapsed', collapsed);
    $('#live-dot').style.display = collapsed ? 'none' : '';
  });

  // New chat: clear the on-screen exchange and the persisted history.
  $('#new-chat-btn').addEventListener('click', async () => {
    await mirrly.newChat();
    clearMessages();
    showStatus('New chat started. Mirrly kept your saved memory.');
  });

  // Stop = start/stop listening. Kick off system-audio capture straight from the click so
  // the user-gesture is fresh for getDisplayMedia (loopback capture needs it).
  $('#stop-btn').addEventListener('click', () => {
    const turningOn = !$('#stop-btn').classList.contains('active');
    if (turningOn) startSystemAudio();
    mirrly.captureToggle();
  });

  // ---- capture: mic (renderer side) --------------------------------------
  let audioCtx = null, micStream = null, micNode = null, micProc = null;
  async function startMic() {
    if (micStream) return;
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
      audioCtx = new AudioContext({ sampleRate: 16000 });
      micNode = audioCtx.createMediaStreamSource(micStream);
      micProc = audioCtx.createScriptProcessor(4096, 1, 1);
      const sink = audioCtx.createGain(); sink.gain.value = 0; // run processor silently
      micNode.connect(micProc); micProc.connect(sink); sink.connect(audioCtx.destination);
      micProc.onaudioprocess = (e) => {
        const f = e.inputBuffer.getChannelData(0);
        const out = new Int16Array(f.length);
        for (let i = 0; i < f.length; i++) { const s = Math.max(-1, Math.min(1, f[i])); out[i] = s < 0 ? s * 0x8000 : s * 0x7fff; }
        mirrly.micPcm(out.buffer);
      };
    } catch (err) {
      mirrly.log('mic error: ' + (err && err.message));
    }
  }
  function stopMic() {
    if (micProc) { micProc.disconnect(); micProc.onaudioprocess = null; micProc = null; }
    if (micNode) { micNode.disconnect(); micNode = null; }
    if (audioCtx) { audioCtx.close(); audioCtx = null; }
    if (micStream) { micStream.getTracks().forEach((t) => t.stop()); micStream = null; }
  }

  // ---- capture: system/meeting audio (getDisplayMedia loopback, in Mirrly's process) ----
  let sysStream = null, sysCtx = null, sysNode = null, sysProc = null;
  async function startSystemAudio() {
    if (sysStream) return;
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      stream.getVideoTracks().forEach((t) => t.stop()); // we only want the audio
      const tracks = stream.getAudioTracks();
      if (!tracks.length) { mirrly.log('system audio: no loopback track available here'); stream.getTracks().forEach((t) => t.stop()); return; }
      sysStream = stream;
      sysCtx = new AudioContext({ sampleRate: 16000 });
      sysNode = sysCtx.createMediaStreamSource(new MediaStream(tracks));
      sysProc = sysCtx.createScriptProcessor(4096, 1, 1);
      const sink = sysCtx.createGain(); sink.gain.value = 0;
      sysNode.connect(sysProc); sysProc.connect(sink); sink.connect(sysCtx.destination);
      sysProc.onaudioprocess = (e) => {
        const f = e.inputBuffer.getChannelData(0);
        const out = new Int16Array(f.length);
        for (let i = 0; i < f.length; i++) { const s = Math.max(-1, Math.min(1, f[i])); out[i] = s < 0 ? s * 0x8000 : s * 0x7fff; }
        mirrly.systemPcm(out.buffer);
      };
      mirrly.log('system audio: capturing loopback');
    } catch (err) {
      mirrly.log('system audio error: ' + (err && err.message));
    }
  }
  function stopSystemAudio() {
    if (sysProc) { sysProc.disconnect(); sysProc.onaudioprocess = null; sysProc = null; }
    if (sysNode) { sysNode.disconnect(); sysNode = null; }
    if (sysCtx) { sysCtx.close(); sysCtx = null; }
    if (sysStream) { sysStream.getTracks().forEach((t) => t.stop()); sysStream = null; }
  }

  // ---- dictation: push-to-talk that lands in the composer -----------------
  // Separate from the ambient listen toggle: records one short utterance locally,
  // transcribes it in main, and sends the text as a normal question.
  const dictBtn = $('#dictate-btn');
  const NO_STT_KEY_MSG = 'Dictation needs a Groq or Gemini API key (used only for speech-to-text). Add one in Settings — your chat provider can stay as-is.';
  let dictStream = null, dictCtx = null, dictNode = null, dictProc = null, dictChunks = null, dictTimer = null;

  async function startDictation() {
    if (dictStream) return;
    const k = (settings && settings.apiKeys) || {};
    if (!k.groqcloud && !k.gemini) { showStatus(NO_STT_KEY_MSG); return; }
    try {
      dictStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
    } catch (err) {
      showStatus('Microphone unavailable: ' + ((err && err.message) || 'permission denied') + '. Check microphone access in your system privacy settings.');
      return;
    }
    dictChunks = [];
    dictCtx = new AudioContext({ sampleRate: 16000 });
    dictNode = dictCtx.createMediaStreamSource(dictStream);
    dictProc = dictCtx.createScriptProcessor(4096, 1, 1);
    const sink = dictCtx.createGain(); sink.gain.value = 0;
    dictNode.connect(dictProc); dictProc.connect(sink); sink.connect(dictCtx.destination);
    dictProc.onaudioprocess = (e) => {
      const f = e.inputBuffer.getChannelData(0);
      const out = new Int16Array(f.length);
      for (let i = 0; i < f.length; i++) { const s = Math.max(-1, Math.min(1, f[i])); out[i] = s < 0 ? s * 0x8000 : s * 0x7fff; }
      if (dictChunks) dictChunks.push(out);
    };
    dictBtn.classList.add('rec');
    dictBtn.innerHTML = icon('stop-square', { size: 16 });
    dictBtn.title = 'Stop and transcribe';
    dictTimer = setTimeout(stopDictation, 30000); // don't record forever if the click never comes
  }

  async function stopDictation() {
    clearTimeout(dictTimer); dictTimer = null;
    if (dictProc) { dictProc.disconnect(); dictProc.onaudioprocess = null; dictProc = null; }
    if (dictNode) { dictNode.disconnect(); dictNode = null; }
    if (dictCtx) { dictCtx.close(); dictCtx = null; }
    if (dictStream) { dictStream.getTracks().forEach((t) => t.stop()); dictStream = null; }
    dictBtn.classList.remove('rec');
    dictBtn.innerHTML = icon('mic', { size: 16 });
    dictBtn.title = 'Dictate your question';
    const chunks = dictChunks || []; dictChunks = null;
    const total = chunks.reduce((n, c) => n + c.length, 0);
    if (total < 16000 * 0.4) { showStatus('Didn\'t catch that — click the mic, speak, then click again to stop.'); return; }
    const pcm = new Int16Array(total);
    let off = 0;
    for (const c of chunks) { pcm.set(c, off); off += c.length; }
    dictBtn.disabled = true;
    showStatus('Transcribing…');
    try {
      const res = await mirrly.dictate(pcm.buffer);
      if (res && res.text) {
        input.value = res.text;
        syncPlaceholder();
        send();
      } else if (res && res.error === 'no_stt_key') {
        showStatus(NO_STT_KEY_MSG);
      } else if (res && res.error) {
        showStatus('Dictation failed: ' + (res.detail || res.error));
      } else {
        showStatus('Didn\'t catch any speech — try again a little closer to the mic.');
      }
    } catch (err) {
      showStatus('Dictation failed: ' + ((err && err.message) || String(err)));
    } finally {
      dictBtn.disabled = false;
    }
  }

  dictBtn.addEventListener('click', () => { if (dictStream) stopDictation(); else startDictation(); });

  // ---- voice conversation mode (continuous listen → ask → speak) --------
  const voiceBtn = $('#voice-btn');
  let voiceMode = false;
  let voicePhase = 'idle'; // idle | listening | thinking | speaking
  let voiceStream = null, voiceCtx = null, voiceNode = null, voiceProc = null;
  let voiceChunks = null, voiceSilenceMs = 0, voiceHeard = false, voiceWatch = null;
  let voicePendingReply = null;

  function setVoiceUi() {
    voiceBtn.classList.toggle('active', voiceMode);
    voiceBtn.classList.toggle('listening', voiceMode && voicePhase === 'listening');
    voiceBtn.title = !voiceMode
      ? 'Voice mode — continuous talk'
      : ('Voice mode on — ' + voicePhase);
  }

  function rmsInt16(buf) {
    if (!buf || !buf.length) return 0;
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    return Math.sqrt(sum / buf.length);
  }

  function stopVoiceCapture() {
    clearInterval(voiceWatch); voiceWatch = null;
    if (voiceProc) { voiceProc.disconnect(); voiceProc.onaudioprocess = null; voiceProc = null; }
    if (voiceNode) { voiceNode.disconnect(); voiceNode = null; }
    if (voiceCtx) { try { voiceCtx.close(); } catch { } voiceCtx = null; }
    if (voiceStream) { voiceStream.getTracks().forEach((t) => t.stop()); voiceStream = null; }
  }

  async function stopVoiceMode() {
    voiceMode = false;
    voicePhase = 'idle';
    voicePendingReply = null;
    stopVoiceCapture();
    try { speechSynthesis.cancel(); } catch { }
    setVoiceUi();
  }

  async function voiceListenCycle() {
    if (!voiceMode) return;
    const k = (settings && settings.apiKeys) || {};
    if (!k.groqcloud && !k.gemini) {
      showStatus(NO_STT_KEY_MSG);
      await stopVoiceMode();
      return;
    }
    // Pause meeting listen — both can't own the mic cleanly.
    const st = await mirrly.captureState();
    if (st && st.active) await mirrly.captureToggle();

    stopVoiceCapture();
    voiceChunks = [];
    voiceSilenceMs = 0;
    voiceHeard = false;
    voicePhase = 'listening';
    setVoiceUi();
    showStatus('Voice mode: listening…');

    try {
      voiceStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
    } catch (err) {
      showStatus('Microphone unavailable for voice mode.');
      await stopVoiceMode();
      return;
    }

    voiceCtx = new AudioContext({ sampleRate: 16000 });
    voiceNode = voiceCtx.createMediaStreamSource(voiceStream);
    voiceProc = voiceCtx.createScriptProcessor(4096, 1, 1);
    const sink = voiceCtx.createGain(); sink.gain.value = 0;
    voiceNode.connect(voiceProc); voiceProc.connect(sink); sink.connect(voiceCtx.destination);
    voiceProc.onaudioprocess = (e) => {
      if (!voiceMode || voicePhase !== 'listening') return;
      const f = e.inputBuffer.getChannelData(0);
      const out = new Int16Array(f.length);
      for (let i = 0; i < f.length; i++) {
        const s = Math.max(-1, Math.min(1, f[i]));
        out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      voiceChunks.push(out);
      const level = rmsInt16(out);
      if (level > 500) { voiceHeard = true; voiceSilenceMs = 0; }
      else if (voiceHeard) voiceSilenceMs += (f.length / 16000) * 1000;
    };

    const started = Date.now();
    voiceWatch = setInterval(async () => {
      if (!voiceMode || voicePhase !== 'listening') return;
      const elapsed = Date.now() - started;
      if ((voiceHeard && voiceSilenceMs >= 1100) || elapsed >= 14000) {
        clearInterval(voiceWatch); voiceWatch = null;
        await finishVoiceUtterance();
      }
    }, 120);
  }

  async function finishVoiceUtterance() {
    if (!voiceMode) return;
    const chunks = voiceChunks || [];
    stopVoiceCapture();
    const total = chunks.reduce((n, c) => n + c.length, 0);
    if (total < 16000 * 0.45) {
      showStatus('Voice mode: say something…');
      voiceListenCycle();
      return;
    }
    const pcm = new Int16Array(total);
    let off = 0;
    for (const c of chunks) { pcm.set(c, off); off += c.length; }
    voicePhase = 'thinking';
    setVoiceUi();
    showStatus('Voice mode: thinking…');
    try {
      const res = await mirrly.dictate(pcm.buffer);
      if (!voiceMode) return;
      if (res && res.error === 'no_stt_key') { showStatus(NO_STT_KEY_MSG); await stopVoiceMode(); return; }
      if (res && res.error) { showStatus('Voice STT failed — try again.'); voiceListenCycle(); return; }
      const text = (res && res.text || '').trim();
      if (!text) { showStatus('Voice mode: didn’t catch that.'); voiceListenCycle(); return; }
      voicePendingReply = true;
      runMode('ask', text);
    } catch (err) {
      showStatus('Voice mode error: ' + ((err && err.message) || String(err)));
      voiceListenCycle();
    }
  }

  async function onVoiceAnswer(raw) {
    if (!voiceMode || !voicePendingReply) return;
    voicePendingReply = false;
    voicePhase = 'speaking';
    setVoiceUi();
    showStatus('Voice mode: speaking…');
    await speak(raw, true);
    if (!voiceMode) return;
    voiceListenCycle();
  }

  voiceBtn.addEventListener('click', async () => {
    if (voiceMode) { await stopVoiceMode(); showStatus('Voice mode off.'); return; }
    if (dictStream) await stopDictation();
    voiceMode = true;
    setVoiceUi();
    voiceListenCycle();
  });

  // ---- mascot -----------------------------------------------------------
  const mascotEl = $('#mascot');
  let selectedMascot = 'cat';

  function applyMascotCharacter(id, opts) {
    const ch = window.MASCOT.get(id);
    selectedMascot = ch.id;
    const keepBusy = opts && opts.keepBusy && mascotEl.classList.contains('busy');
    const keepWalk = mascotEl.classList.contains('walk');
    const keepFlip = mascotEl.classList.contains('flip');
    mascotEl.dataset.character = ch.id;
    mascotEl.innerHTML = ch.svg;
    mascotEl.setAttribute('aria-label', 'Mirrly ' + ch.name.toLowerCase() + ' — click to open chat');
    mascotEl.classList.toggle('walk', keepWalk);
    mascotEl.classList.toggle('flip', keepFlip);
    mascotEl.classList.toggle('busy', !!keepBusy);
    document.querySelectorAll('#mascot-pick .mascot-pick-btn').forEach((b) => {
      b.classList.toggle('on', b.dataset.character === ch.id);
    });
  }

  function buildMascotPicker() {
    const row = $('#mascot-pick');
    row.innerHTML = '';
    window.MASCOT.ids.forEach((id) => {
      const ch = window.MASCOT.characters[id];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mascot-pick-btn' + (id === selectedMascot ? ' on' : '');
      btn.dataset.character = id;
      btn.setAttribute('aria-pressed', id === selectedMascot ? 'true' : 'false');
      btn.innerHTML = ch.svg + '<span>' + ch.name + '</span>';
      btn.addEventListener('click', async () => {
        if (id === selectedMascot) return;
        applyMascotCharacter(id, { keepBusy: true });
        settings.mascotCharacter = id;
        await mirrly.mascotSet({
          character: id,
          enabled: !!settings.mascotMode,
          roam: settings.mascotRoam !== false,
          reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        });
        document.querySelectorAll('#mascot-pick .mascot-pick-btn').forEach((b) => {
          b.setAttribute('aria-pressed', b.dataset.character === id ? 'true' : 'false');
        });
      });
      row.appendChild(btn);
    });
  }

  applyMascotCharacter(window.MASCOT.defaultId);
  buildMascotPicker();

  mirrly.on('mascot:state', (s) => {
    const isMascot = s.mode === 'mascot';
    document.body.classList.toggle('mascot-mode', isMascot);
    document.body.classList.toggle('panel-open', isMascot && !!s.panel);
    mascotEl.classList.toggle('hidden', !isMascot);
    mascotEl.classList.toggle('walk', s.anim === 'walk');
    mascotEl.classList.toggle('flip', s.dir === -1);
    if (isMascot && s.panel) {
      // The window grew around the mascot — pin it to its old on-screen spot.
      mascotEl.style.left = (s.catLocalX || 0) + 'px';
      mascotEl.style.top = (s.catLocalY || 0) + 'px';
      $('#panel-wrap').style.marginTop = s.below ? '158px' : '';
      $('#panel').classList.remove('collapsed');
      $('#hide-btn').classList.remove('collapsed');
    } else {
      // Small mascot window: center the character, feet at the bottom edge.
      mascotEl.style.left = '15px';
      mascotEl.style.top = '46px';
      $('#panel-wrap').style.marginTop = '';
    }
  });

  // Manual drag (not -webkit-app-region) so a tiny movement counts as a click:
  // main decides click-vs-drag and opens/closes the panel accordingly.
  let mascotDragging = false; // keeps the window mouse-capturing even if the cursor outruns the mascot
  mascotEl.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    mascotDragging = true;
    setIgnore(false);
    mirrly.mascotDrag({ phase: 'start', screenX: e.screenX, screenY: e.screenY });
    const onMove = (ev) => mirrly.mascotDrag({ phase: 'move', screenX: ev.screenX, screenY: ev.screenY });
    const onUp = (ev) => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      mascotDragging = false;
      mirrly.mascotDrag({ phase: 'end', screenX: ev.screenX, screenY: ev.screenY });
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  });

  // ---- events from main --------------------------------------------------
  mirrly.on('capture:state', ({ active }) => {
    $('#live-dot').classList.toggle('off', !active);
    $('#stop-btn').classList.toggle('active', active);
    if (active) { startMic(); startSystemAudio(); } else { stopMic(); stopSystemAudio(); }
  });
  mirrly.on('llm:start', ({ userBubble, small }) => {
    clearMessages();
    if (userBubble) addUserBubble(userBubble);
    startAi(!!small);
    setBusy(true);
    mascotEl.classList.add('busy');
  });
  mirrly.on('llm:token', ({ text }) => appendToken(text));
  mirrly.on('llm:done', () => {
    const raw = finalizeAi();
    setBusy(false);
    mascotEl.classList.remove('busy');
    if (voiceMode && voicePendingReply) onVoiceAnswer(raw);
    else speak(raw);
  });
  mirrly.on('llm:error', ({ message }) => {
    if (!aiEl) startAi(true);
    aiEl.dataset.raw = message; finalizeAi(); setBusy(false);
    mascotEl.classList.remove('busy');
    if (voiceMode && voicePendingReply) {
      voicePendingReply = false;
      showStatus(message || 'Voice mode error');
      voiceListenCycle();
    }
  });
  let statusTimer = null;
  function showStatus(message) {
    let el = document.getElementById('status-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'status-toast';
      const panel = document.getElementById('panel');
      panel.insertBefore(el, document.getElementById('action-row'));
    }
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => el.classList.remove('show'), 11000);
  }
  mirrly.on('status', ({ message }) => { mirrly.log('[status] ' + message); showStatus(message); });
  mirrly.on('tts:speak', ({ text }) => { speak(text || '', true); });

  // ---- settings ----------------------------------------------------------
  // Single source of truth for the settings UI; ids must match store.js + llm.js.
  const PROVIDERS = [
    { id: 'pollinations', label: 'Pollinations', ph: 'no key needed', keyless: true },
    { id: 'openai', label: 'OpenAI', ph: 'sk-...' },
    { id: 'anthropic', label: 'Anthropic', ph: 'sk-ant-...' },
    { id: 'gemini', label: 'Gemini', ph: 'AIza...' },
    { id: 'groqcloud', label: 'Groq', ph: 'gsk_...' },
    { id: 'openrouter', label: 'OpenRouter', ph: 'sk-or-v1-...' },
    { id: 'cerebras', label: 'Cerebras', ph: 'csk-...' },
    { id: 'mistral', label: 'Mistral', ph: 'key...' },
    { id: 'cohere', label: 'Cohere', ph: 'key...' },
    { id: 'huggingface', label: 'HF', ph: 'hf_...' },
    { id: 'alibaba', label: 'Alibaba', ph: 'sk-...' },
    { id: 'omnirouter', label: 'Omnirouter', ph: 'sk-...' },
    { id: 'ninerouter', label: '9router', ph: 'sk-...' },
    { id: 'custom', label: 'Custom', ph: 'any key...' }
  ];

  function syncCustomBaseVisibility() {
    const wrap = $('#custom-base-wrap');
    if (!wrap) return;
    wrap.classList.toggle('hidden', settings.provider !== 'custom');
  }

  // Warn when the selected model probably can't see images (screen features would hallucinate).
  function syncVisionHint() {
    const hint = $('#vision-hint');
    if (!hint) return;
    const fast = mirrly.modelVision(settings.provider, $('#model-fast').value.trim());
    const smart = mirrly.modelVision(settings.provider, $('#model-smart').value.trim());
    const worst = (fast === 'no' || smart === 'no') ? 'no' : ((fast === 'unknown' || smart === 'unknown') ? 'unknown' : 'yes');
    hint.classList.toggle('hidden', worst === 'yes');
    hint.classList.toggle('warn', worst === 'no');
    if (worst === 'no') {
      const which = [fast === 'no' ? 'Fast' : null, smart === 'no' ? 'Smart' : null].filter(Boolean).join(' and ');
      hint.textContent = '⚠ ' + which + ': ' + mirrly.visionTexts.warn;
    } else if (worst === 'unknown') {
      hint.textContent = mirrly.visionTexts.unknown;
    }
  }
  $('#model-fast').addEventListener('input', syncVisionHint);
  $('#model-smart').addEventListener('input', syncVisionHint);

  const scrim = $('#settings-scrim');
  function openSettings() { fillSettings(); scrim.classList.remove('hidden'); }
  function closeSettings() { saveSettings(); scrim.classList.add('hidden'); }
  $('#more-btn').addEventListener('click', openSettings);
  $('#s-close').addEventListener('click', closeSettings);
  scrim.addEventListener('click', (e) => { if (e.target === scrim) closeSettings(); });

  function buildSettingsUI() {
    const seg = $('#provider-seg'); seg.innerHTML = '';
    const fields = $('#key-fields'); fields.innerHTML = '';
    PROVIDERS.forEach((p) => {
      const b = document.createElement('button');
      b.dataset.provider = p.id; b.textContent = p.label;
      b.addEventListener('click', () => {
        settings.provider = p.id;
        seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
        const m = settings.models[p.id] || { fast: '', smart: '' };
        $('#model-fast').value = m.fast; $('#model-smart').value = m.smart;
        syncCustomBaseVisibility();
        syncVisionHint();
        $('#s-status').textContent = statusText();
      });
      seg.appendChild(b);

      const row = document.createElement('div');
      row.className = 's-field';
      const lab = document.createElement('span'); lab.textContent = p.label === 'HF' ? 'HuggingFace' : p.label;
      const inp = document.createElement('input');
      inp.type = 'password'; inp.autocomplete = 'off'; inp.id = 'key-' + p.id; inp.placeholder = p.ph;
      if (p.keyless) { inp.disabled = true; inp.type = 'text'; row.classList.add('keyless'); }
      row.appendChild(lab); row.appendChild(inp);
      fields.appendChild(row);
    });
  }

  function renderMemoryList() {
    const list = $('#memory-list'); list.innerHTML = '';
    const mem = settings.memory || [];
    if (!mem.length) {
      const empty = document.createElement('div');
      empty.className = 'mem-empty';
      empty.textContent = 'Nothing saved yet. After an answer, hit Remember to keep a fact.';
      list.appendChild(empty);
      return;
    }
    mem.forEach((fact, i) => {
      const row = document.createElement('div');
      row.className = 'mem-item';
      const txt = document.createElement('span'); txt.textContent = fact;
      const del = document.createElement('button'); del.textContent = '×'; del.title = 'Forget';
      del.addEventListener('click', async () => {
        settings.memory = settings.memory.filter((_, j) => j !== i);
        await mirrly.settingsSet({ memory: settings.memory });
        renderMemoryList();
      });
      row.appendChild(txt); row.appendChild(del);
      list.appendChild(row);
    });
  }

  async function renderSkillsList() {
    const list = $('#skills-list');
    if (!list) return;
    list.innerHTML = '';
    let skills = [];
    try { skills = await mirrly.skillsList(); } catch { skills = []; }
    if (!skills.length) {
      const empty = document.createElement('div');
      empty.className = 'mem-empty';
      empty.textContent = 'No skills yet. Open the skills folder and add a .md file.';
      list.appendChild(empty);
      return;
    }
    skills.forEach((sk) => {
      const row = document.createElement('label');
      row.className = 'skill-row s-toggle';
      const inp = document.createElement('input');
      inp.type = 'checkbox';
      inp.checked = !!sk.enabled;
      inp.addEventListener('change', async () => {
        const next = skills.map((s) => {
          if (s.id === sk.id) s.enabled = inp.checked;
          return s;
        });
        const ids = next.filter((s) => s.enabled).map((s) => s.id);
        settings.skillsEnabled = ids;
        await mirrly.skillsSetEnabled(ids);
      });
      const sw = document.createElement('span'); sw.className = 's-switch';
      const meta = document.createElement('div'); meta.className = 'skill-meta';
      meta.innerHTML = '<div class="skill-name"></div><div class="skill-desc"></div>';
      meta.querySelector('.skill-name').textContent = sk.name;
      meta.querySelector('.skill-desc').textContent = sk.description || sk.id;
      row.appendChild(inp); row.appendChild(sw); row.appendChild(meta);
      list.appendChild(row);
    });
  }

  $('#skills-open-folder').addEventListener('click', async () => {
    const res = await mirrly.skillsOpenFolder();
    if (res && res.error) showStatus('Could not open skills folder: ' + res.error);
  });
  $('#skills-save-last').addEventListener('click', async () => {
    const text = (input.value || '').trim();
    if (!text) {
      showStatus('Type an instruction in the composer first, then save it as a skill.');
      return;
    }
    const name = text.slice(0, 40).replace(/\s+/g, ' ');
    await mirrly.skillsSave({
      name: name,
      description: 'Saved from composer',
      body: text
    });
    if (!Array.isArray(settings.skillsEnabled)) settings.skillsEnabled = null;
    await renderSkillsList();
    showStatus('Saved skill from your instruction.');
  });

  function fillSettings() {
    document.querySelectorAll('#provider-seg button').forEach((b) => b.classList.toggle('on', b.dataset.provider === settings.provider));
    PROVIDERS.forEach((p) => { if (!p.keyless) $('#key-' + p.id).value = settings.apiKeys[p.id] || ''; });
    const m = settings.models[settings.provider] || { fast: '', smart: '' };
    $('#model-fast').value = m.fast; $('#model-smart').value = m.smart;
    $('#custom-base-url').value = settings.customBaseUrl || '';
    syncCustomBaseVisibility();
    syncVisionHint();
    $('#opt-tts').checked = !!settings.tts;
    $('#opt-clip').checked = !!settings.clipboardCtx;
    $('#opt-mascot').checked = !!settings.mascotMode;
    $('#opt-roam').checked = settings.mascotRoam !== false;
    applyMascotCharacter(settings.mascotCharacter || window.MASCOT.defaultId);
    renderMemoryList();
    renderSkillsList();
    $('#s-status').textContent = statusText();
  }
  function statusText() {
    const k = settings.apiKeys;
    const has = PROVIDERS.filter((p) => p.keyless || k[p.id]).map((p) => p.label);
    const stt = k.groqcloud ? 'Groq Whisper' : (k.gemini ? 'Gemini' : 'none');
    return 'Active: ' + settings.provider + ' · ready: ' + (has.join(', ') || 'none') + ' · transcription: ' + stt;
  }
  async function saveSettings() {
    PROVIDERS.forEach((p) => { if (!p.keyless) settings.apiKeys[p.id] = $('#key-' + p.id).value.trim(); });
    if (!settings.models[settings.provider]) settings.models[settings.provider] = {};
    settings.models[settings.provider].fast = $('#model-fast').value.trim();
    settings.models[settings.provider].smart = $('#model-smart').value.trim();
    settings.customBaseUrl = ($('#custom-base-url').value || '').trim();
    settings.tts = $('#opt-tts').checked;
    settings.clipboardCtx = $('#opt-clip').checked;
    // Patch only what this sheet owns — never echo back history/memory snapshots.
    await mirrly.settingsSet({
      provider: settings.provider,
      apiKeys: settings.apiKeys,
      models: settings.models,
      customBaseUrl: settings.customBaseUrl,
      tts: settings.tts,
      clipboardCtx: settings.clipboardCtx
    });
    // Appearance is applied (and persisted) by the mascot controller in main.
    const wantMascot = $('#opt-mascot').checked;
    const wantRoam = $('#opt-roam').checked;
    const wantCharacter = selectedMascot;
    if (
      wantMascot !== !!settings.mascotMode ||
      wantRoam !== (settings.mascotRoam !== false) ||
      wantCharacter !== (settings.mascotCharacter || 'cat')
    ) {
      settings.mascotMode = wantMascot;
      settings.mascotRoam = wantRoam;
      settings.mascotCharacter = wantCharacter;
      await mirrly.mascotSet({
        enabled: wantMascot,
        roam: wantRoam,
        character: wantCharacter,
        reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches
      });
    }
  }

  function showGreeting() {
    clearMessages();
    const ai = document.createElement('div');
    ai.className = 'ai-text';
    ai.textContent = 'Hey — ask anything, or use Assist on what\'s on screen.';
    messages.appendChild(ai);
  }

  // ---- global keys -------------------------------------------------------
  document.addEventListener('keydown', (e) => {
    const mod = IS_MAC ? e.metaKey : e.ctrlKey;
    if (e.key === 'Escape' && voiceMode) { stopVoiceMode(); return; }
    if (e.key === 'Escape' && !scrim.classList.contains('hidden')) { closeSettings(); return; }
    if (e.key === 'Escape' && document.body.classList.contains('panel-open')) mirrly.mascotClosePanel();
    if (mod && e.key === ',') { e.preventDefault(); openSettings(); }
  });

  // ---- click-through: only the UI blocks the mouse; empty gaps pass to your screen ----
  let ignoring = null;
  function setIgnore(v) { if (v !== ignoring) { ignoring = v; mirrly.setIgnoreMouse(v); } }
  document.addEventListener('mousemove', (e) => {
    // Mascot mode never ignores the mouse (main owns that state there) —
    // resizing breaks forward:true forwarding, so hover-toggling can't work.
    if (document.body.classList.contains('mascot-mode')) { ignoring = null; return; }
    if (mascotDragging) { setIgnore(false); return; }
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const overUI = !!(el && el.closest && el.closest('#toolbar, #panel-wrap, #settings-scrim, #onboard-scrim, #mascot'));
    setIgnore(!overUI);
  });
  setIgnore(true); // start fully click-through; hovering the panel re-enables it

  // ---- onboarding / first-run walkthrough --------------------------------
  const obScrim = $('#onboard-scrim');
  const OB_STEPS = [
    {
      iconHtml: icon('hand', { size: 40 }),
      title: 'What is Mirrly?',
      body: 'Mirrly is a small AI helper that sits on your desktop while you work.<br><br>It stays on top of your other apps so you can ask for help without switching windows.'
    },
    {
      iconHtml: icon('lightbulb', { size: 40 }),
      title: 'How it works',
      body: 'You bring your own AI key in Settings — or try <span class="hl">Pollinations</span> with no key.<br><br>When you ask, Mirrly can look at your screen. If you allow the mic, it can listen too.<br><br>Your keys and memory stay on your computer.'
    },
    {
      iconHtml: icon('list-checks', { size: 40 }),
      title: 'What it can do',
      body: '<ul>' +
        '<li>Help with what’s on your screen</li>' +
        '<li>Open apps and websites for you</li>' +
        '<li>Draft emails (you still click Send)</li>' +
        '<li>Look things up on the real web</li>' +
        '<li>Talk with you in voice mode</li>' +
        '<li>Remember facts you ask it to keep</li>' +
        '<li>Turn into a cat, dog, fox, or bunny</li></ul>'
    },
    IS_MAC ? {
      iconHtml: icon('shield', { size: 40 }),
      title: 'A couple of permissions',
      body: 'On a Mac, turn these on for Mirrly:<ul><li><strong>Microphone</strong> — so it can hear you</li><li><strong>Screen Recording</strong> — so it can see your screen</li></ul>Use the buttons below, flip Mirrly ON, then come back.',
      buttons: [
        { label: 'Open Microphone settings', action: () => mirrly.openPane('x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone') },
        { label: 'Open Screen Recording settings', action: () => mirrly.openPane('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture') }
      ]
    } : {
      iconHtml: icon('shield', { size: 40 }),
      title: 'A couple of permissions',
      body: 'On Windows, screen help works right away.<br><br>The first time you listen or use voice mode, Windows will ask for the <strong>microphone</strong> — click <strong>Allow</strong>.',
      buttons: [
        { label: 'Open Microphone settings', action: () => mirrly.openPane('ms-settings:privacy-microphone') }
      ]
    },
    {
      iconHtml: icon('rocket', { size: 40 }),
      title: 'You’re ready',
      body: '<ul>' +
        '<li>' + kbd(MOD) + ' ' + kbd('↵') + ' — help with what’s on screen</li>' +
        '<li>Type a question and press ' + kbd('↵') + '</li>' +
        '<li>Top-bar mic — listen on a call</li>' +
        '<li>Waveform button — voice mode</li>' +
        '<li>Click the <strong>Mirrly logo</strong> anytime to see this guide again</li></ul>' +
        'Add an API key in Settings when you’re ready. Quit with ' + kbd(MOD) + ' ' + kbd(IS_MAC ? '⇧' : 'Shift') + ' ' + kbd('X') + '.',
      buttons: [{ label: 'Open Settings', action: () => { finishOnboard(); openSettings(); } }]
    }
  ];
  let obIndex = 0;
  function renderOnboard() {
    const step = OB_STEPS[obIndex];
    if (step.iconHtml) { $('#ob-icon').innerHTML = step.iconHtml; }
    else { $('#ob-icon').textContent = step.icon || ''; }
    $('#ob-title').textContent = step.title;
    $('#ob-body').innerHTML = step.body;
    const btns = $('#ob-buttons'); btns.innerHTML = '';
    (step.buttons || []).forEach((b) => { const el = document.createElement('button'); el.textContent = b.label; el.addEventListener('click', b.action); btns.appendChild(el); });
    $('#ob-back').style.visibility = obIndex === 0 ? 'hidden' : 'visible';
    $('#ob-next').textContent = obIndex === OB_STEPS.length - 1 ? 'Done' : 'Next';
    $('#ob-skip').style.visibility = obIndex === OB_STEPS.length - 1 ? 'hidden' : 'visible';
  }
  function showOnboard() { obIndex = 0; renderOnboard(); obScrim.classList.remove('hidden'); setIgnore(false); }
  async function finishOnboard() {
    obScrim.classList.add('hidden');
    if (settings && !settings.onboarded) { settings.onboarded = true; await mirrly.settingsSet({ onboarded: true }); }
  }
  $('#ob-next').addEventListener('click', () => { if (obIndex === OB_STEPS.length - 1) finishOnboard(); else { obIndex++; renderOnboard(); } });
  $('#ob-back').addEventListener('click', () => { if (obIndex > 0) { obIndex--; renderOnboard(); } });
  $('#ob-skip').addEventListener('click', finishOnboard);
  $('#logo-btn').addEventListener('click', showOnboard);

  // ---- boot --------------------------------------------------------------
  (async function boot() {
    settings = await mirrly.settingsGet();
    buildSettingsUI();
    applyMascotCharacter(settings.mascotCharacter || window.MASCOT.defaultId);
    smartBtn.classList.toggle('on', !!settings.smart);
    showGreeting();
    syncPlaceholder();
    const st = await mirrly.captureState();
    $('#live-dot').classList.toggle('off', !st.active);
    $('#stop-btn').classList.toggle('active', st.active);
    if (settings.mascotMode) {
      await mirrly.mascotSet({
        enabled: true,
        roam: settings.mascotRoam !== false,
        character: settings.mascotCharacter || window.MASCOT.defaultId,
        reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches
      });
    }
    if (!settings.onboarded) showOnboard();
  })();
})();
