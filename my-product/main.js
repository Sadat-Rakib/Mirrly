const { app, BrowserWindow, ipcMain, globalShortcut, screen, session, desktopCapturer, shell, clipboard } = require('electron');
const path = require('path');
const store = require('./src/store');
const { captureScreenshot } = require('./src/screen');
const { createSTT } = require('./src/stt');
const { createLLM } = require('./src/llm');
const { MODES, formatTranscript, REMEMBER_SYSTEM } = require('./src/prompts');
const { modelLikelyVision } = require('./src/models');
const { runAgent } = require('./src/agent');
const { rms16 } = require('./src/wav');
const { enabledSkillBodies, listSkillFiles, saveSkill, openSkillsFolder, ensureUserSkillsSeeded } = require('./src/skills');
const { relevantMemory } = require('./src/brain');

let win = null;

// -------- capture / transcript state --------
const state = { capturing: false, busy: false, transcribing: { you: false, them: false } };
let sttDisabled = false; // set when the key can't reach any speech model (stops retry spam)
let visionWarned = false; // one text-only-model warning per session / settings change
const buffers = { you: [], them: [] };
const transcript = []; // { channel, text, ts }
const FLUSH_MS = 3500;
const MIN_BYTES = Math.floor(16000 * 2 * 0.6); // ~0.6s
const RMS_GATE = 240;
let flushTimer = null;

// -------- chat history (survives restarts via the store) --------
let chat = []; // { role:'user'|'assistant', text }
const HISTORY_CONTEXT = 8;   // turns sent to the model
const HISTORY_KEEP = 20;     // turns persisted

function send(channel, data) { if (win && !win.isDestroyed()) win.webContents.send(channel, data); }

// -------- window --------
function createWindow() {
  const { workArea } = screen.getPrimaryDisplay();
  const W = 700, H = 600;
  win = new BrowserWindow({
    width: W,
    height: H,
    x: Math.round(workArea.x + (workArea.width - W) / 2),
    y: workArea.y + 6,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: true,
    skipTaskbar: true,
    alwaysOnTop: true,
    fullscreenable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  // Overlay behavior. Set MIRRLY_NO_PROTECT=1 to allow the window in screen captures (debugging).
  win.setContentProtection(!(process.env.MIRRLY_NO_PROTECT || process.env.CUE_NO_PROTECT));
  win.setAlwaysOnTop(true, 'screen-saver', 1);
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  if (typeof win.setHiddenInMissionControl === 'function') win.setHiddenInMissionControl(true);

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  win.webContents.on('did-finish-load', () => win.showInactive());
  win.webContents.on('render-process-gone', (_e, d) => console.log('[mirrly] renderer gone', JSON.stringify(d)));
}

// -------- mascot mode --------
// The single overlay window doubles as the cat: shrunk to a small roaming
// "cat window" moved with setPosition; opening the chat resizes the same window
// around the cat so the panel appears next to it.
const MASCOT_W = 150, MASCOT_H = 160;
const PILL_W = 700, PILL_H = 600;
const mascot = {
  enabled: false, panelOpen: false, roam: true, reducedMotion: false,
  x: 0, y: 0, dir: 1, targetX: null, sitUntil: 0,
  timer: null, drag: null, anim: 'idle', wa: null
};

// The cat is pinned to one display's work area (re-anchored when dragged):
// letting it roam across monitor boundaries triggers Electron's mixed-DPI
// bounds drift and can strand the window off-screen.
function mascotWorkArea() {
  if (mascot.wa) return mascot.wa;
  mascot.wa = screen.getDisplayNearestPoint({
    x: Math.round(mascot.x + MASCOT_W / 2),
    y: Math.round(mascot.y + MASCOT_H / 2)
  }).workArea;
  return mascot.wa;
}

function mascotReanchor() {
  mascot.wa = null;
  mascotWorkArea();
}

// Reassert the full bounds on every move: setPosition alone lets the OS
// rescale the window when it brushes a display edge on mixed-DPI setups.
function mascotApplyBounds() {
  win.setBounds({
    x: Math.round(mascot.x),
    y: Math.round(mascot.y),
    width: MASCOT_W,
    height: MASCOT_H
  });
}

function clampPos(x, y, w, h, wa) {
  return {
    x: Math.round(Math.min(Math.max(x, wa.x), wa.x + wa.width - w)),
    y: Math.round(Math.min(Math.max(y, wa.y), wa.y + wa.height - h))
  };
}

function sendMascotState(extra) {
  send('mascot:state', {
    mode: mascot.enabled ? 'mascot' : 'pill',
    panel: mascot.panelOpen,
    anim: mascot.anim,
    dir: mascot.dir,
    ...extra
  });
}

function setMascotAnim(anim, dir) {
  const d = dir == null ? mascot.dir : dir;
  if (anim === mascot.anim && d === mascot.dir) return;
  mascot.anim = anim; mascot.dir = d;
  sendMascotState();
}

function persistMascotPos() {
  store.setSettings({ mascotPos: { x: Math.round(mascot.x), y: Math.round(mascot.y) } });
}

function mascotTick() {
  if (!mascot.enabled || mascot.panelOpen || mascot.drag || state.busy) return;
  if (!mascot.roam || mascot.reducedMotion) { setMascotAnim('idle'); return; }
  const wa = mascotWorkArea();
  const groundY = wa.y + wa.height - MASCOT_H;
  const now = Date.now();
  // Gently drop to the "ground" (bottom edge) if the cat was left mid-air by a drag.
  if (mascot.y < groundY - 2) {
    mascot.y = Math.min(groundY, mascot.y + 5);
    mascotApplyBounds();
    setMascotAnim('idle');
    return;
  }
  mascot.y = groundY;
  if (now < mascot.sitUntil) { setMascotAnim('idle'); return; }
  const minX = wa.x + 10, maxX = wa.x + wa.width - MASCOT_W - 10;
  if (mascot.targetX == null) {
    mascot.targetX = minX + Math.random() * Math.max(1, maxX - minX);
    setMascotAnim('walk', mascot.targetX > mascot.x ? 1 : -1);
  }
  const step = 1.6;
  if (Math.abs(mascot.targetX - mascot.x) <= step) {
    mascot.x = Math.min(Math.max(mascot.targetX, minX), maxX);
    mascot.targetX = null;
    mascot.sitUntil = now + 5000 + Math.random() * 15000;
    setMascotAnim('idle');
    persistMascotPos();
  } else {
    mascot.x += step * (mascot.targetX > mascot.x ? 1 : -1);
    setMascotAnim('walk', mascot.targetX > mascot.x ? 1 : -1);
  }
  mascot.x = Math.min(Math.max(mascot.x, minX), maxX);
  mascotApplyBounds();
}

function enterMascot() {
  mascot.enabled = true;
  mascot.panelOpen = false;
  const saved = store.getSettings().mascotPos;
  const disp = saved ? screen.getDisplayNearestPoint(saved) : screen.getPrimaryDisplay();
  const wa = disp.workArea;
  const start = clampPos(
    saved ? saved.x : wa.x + wa.width - MASCOT_W - 40,
    saved ? saved.y : wa.y + wa.height - MASCOT_H,
    MASCOT_W, MASCOT_H, wa
  );
  mascot.x = start.x; mascot.y = start.y;
  mascot.wa = wa;
  mascot.targetX = null;
  mascot.sitUntil = Date.now() + 2500;
  mascotApplyBounds();
  // No click-through in mascot mode: resizing kills forward:true mouse-move
  // forwarding on Windows, which the hover-based toggle depends on. The cat
  // window is tiny, so making it fully interactive costs almost nothing.
  win.setIgnoreMouseEvents(false);
  if (!mascot.timer) mascot.timer = setInterval(mascotTick, 33);
  mascot.anim = 'idle';
  sendMascotState();
}

function exitMascot() {
  if (mascot.timer) { clearInterval(mascot.timer); mascot.timer = null; }
  if (mascot.enabled) persistMascotPos();
  mascot.enabled = false;
  mascot.panelOpen = false;
  mascot.wa = null;
  const { workArea } = screen.getPrimaryDisplay();
  win.setBounds({
    x: Math.round(workArea.x + (workArea.width - PILL_W) / 2),
    y: workArea.y + 6,
    width: PILL_W,
    height: PILL_H
  });
  // Back to pill mode: restore hover-driven click-through.
  win.setIgnoreMouseEvents(true, { forward: true });
  sendMascotState();
}

function mascotOpenPanel() {
  if (!mascot.enabled || mascot.panelOpen) return;
  mascot.panelOpen = true;
  mascot.targetX = null;
  const wa = mascotWorkArea();
  const pw = Math.min(PILL_W, wa.width - 16);
  const ph = Math.min(PILL_H, wa.height - 16);
  // Panel above the cat when it fits, else below; the window grows around the cat
  // so the cat itself never visually moves.
  const below = (mascot.y - wa.y) + MASCOT_H < ph;
  const px = Math.min(Math.max(mascot.x + MASCOT_W / 2 - pw / 2, wa.x + 8), wa.x + wa.width - pw - 8);
  const py = below
    ? Math.min(Math.max(mascot.y, wa.y + 8), wa.y + wa.height - ph - 8)
    : Math.min(Math.max(mascot.y + MASCOT_H - ph, wa.y + 8), wa.y + wa.height - ph - 8);
  win.setBounds({ x: Math.round(px), y: Math.round(py), width: pw, height: ph });
  mascot.anim = 'idle';
  sendMascotState({
    catLocalX: Math.round(mascot.x - px),
    catLocalY: Math.round(mascot.y - py),
    below
  });
}

function mascotClosePanel() {
  if (!mascot.enabled || !mascot.panelOpen) return;
  mascot.panelOpen = false;
  const wa = mascotWorkArea();
  const pos = clampPos(mascot.x, mascot.y, MASCOT_W, MASCOT_H, wa);
  mascot.x = pos.x; mascot.y = pos.y;
  mascotApplyBounds();
  mascot.sitUntil = Date.now() + 3000;
  sendMascotState();
}

function mascotDragEvent(p) {
  if (!mascot.enabled || !p) return;
  if (p.phase === 'start') {
    mascot.drag = {
      offX: p.screenX - mascot.x,
      offY: p.screenY - mascot.y,
      moved: 0, lastX: p.screenX, lastY: p.screenY
    };
    setMascotAnim('idle');
    return;
  }
  if (!mascot.drag) return;
  if (p.phase === 'move') {
    mascot.drag.moved += Math.abs(p.screenX - mascot.drag.lastX) + Math.abs(p.screenY - mascot.drag.lastY);
    mascot.drag.lastX = p.screenX; mascot.drag.lastY = p.screenY;
    if (!mascot.panelOpen) {
      mascot.x = p.screenX - mascot.drag.offX;
      mascot.y = p.screenY - mascot.drag.offY;
      mascotApplyBounds();
    }
    return;
  }
  if (p.phase === 'end') {
    const wasClick = mascot.drag.moved < 5;
    mascot.drag = null;
    if (wasClick) {
      if (mascot.panelOpen) mascotClosePanel();
      else mascotOpenPanel();
    } else if (!mascot.panelOpen) {
      mascotReanchor(); // the drag may have moved the cat to another display
      const pos = clampPos(mascot.x, mascot.y, MASCOT_W, MASCOT_H, mascotWorkArea());
      mascot.x = pos.x; mascot.y = pos.y;
      mascotApplyBounds();
      mascot.targetX = null;
      mascot.sitUntil = Date.now() + 4000;
      persistMascotPos();
    }
  }
}

// -------- STT flushing --------
async function flushChannel(channel) {
  if (state.transcribing[channel]) return;
  const chunks = buffers[channel];
  if (!chunks.length) return;
  const pcm = Buffer.concat(chunks);
  buffers[channel] = [];
  if (pcm.length < MIN_BYTES) return;
  if (rms16(pcm) < RMS_GATE) return; // silence gate

  state.transcribing[channel] = true;
  try {
    const settings = store.getSettings();
    const stt = createSTT(settings);
    if (!stt.available) {
      if (!sttDisabled) { sttDisabled = true; send('status', { message: 'No transcription key set. Add a Groq or Gemini key in Settings to enable listening. Screen features work without it.' }); }
      return;
    }
    const res = await stt.transcribe(pcm);
    if (res.error) {
      handleSttError(res.error, settings);
      return;
    }
    if (res.text && res.text.trim()) {
      const turn = { channel, text: res.text.trim(), ts: Date.now() };
      transcript.push(turn);
      send('transcript', turn);
    }
  } catch (e) {
    console.log('[stt] error', e && e.message);
  } finally {
    state.transcribing[channel] = false;
  }
}

function handleSttError(err, settings) {
  console.log('[stt] error', err.provider, err.status, err.code, err.message);
  if (sttDisabled) return;
  const noAccess = err.status === 403 || err.status === 401 || err.code === 'model_not_found';
  sttDisabled = true; // stop hammering the API every few seconds
  if (noAccess) {
    send('status', { message: 'Transcription off: your ' + err.provider + ' key has no access to a speech-to-text model. Screen features still work. To enable listening, add a Groq or Gemini key in Settings and reopen.' });
  } else {
    send('status', { message: 'Transcription error (' + err.provider + '): ' + err.message });
  }
}

function startFlushLoop() {
  if (flushTimer) return;
  flushTimer = setInterval(() => { flushChannel('you'); flushChannel('them'); }, FLUSH_MS);
}
function stopFlushLoop() { if (flushTimer) { clearInterval(flushTimer); flushTimer = null; } }

// -------- capture toggle --------
// Mic + system audio are both captured in the RENDERER (getUserMedia for the mic,
// getDisplayMedia loopback for system audio) so they run inside Mirrly's own process
// and use Mirrly's own capture grant — no separate helper binary to authorize.
function setCapturing(active) {
  state.capturing = active;
  if (active) {
    startFlushLoop();
  } else {
    stopFlushLoop();
    buffers.you = []; buffers.them = [];
  }
  send('capture:state', { active });
  return active;
}

// -------- feature runner --------
function buildSystem(def, settings, userText) {
  let system = def.system;
  const mem = relevantMemory(settings.memory, userText || '', 8);
  if (mem.length) system += '\n\nThings you know about the user (local memory):\n- ' + mem.join('\n- ');
  const skills = enabledSkillBodies(settings.skillsEnabled, 3500);
  if (skills) system += '\n\nActive skills (follow these preferences):\n' + skills;
  return system;
}

function persistChat() {
  chat = chat.slice(-HISTORY_KEEP);
  store.setSettings({ history: chat });
}

async function runFeature(mode, userText) {
  if (state.busy) return;
  const def = MODES[mode];
  if (!def) return;
  state.busy = true;
  try {
    if (mascot.enabled && !mascot.panelOpen) mascotOpenPanel(); // shortcuts work in mascot mode too
    const settings = store.getSettings();
    const llm = createLLM(settings);
    const userBubble = def.userBubble !== null ? def.userBubble : (mode === 'ask' ? userText : null);
    send('llm:start', { userBubble, small: !!def.small });

    if (!llm.ready) {
      send('llm:error', { message: 'Add an API key in Settings (or pick Pollinations — no key needed). Active provider: ' + settings.provider + '. Model: ' + (llm.model || 'unset') + '.' });
      return;
    }

    let imageDataUrl = null;
    let hasScreen = false;
    if (def.needsScreen) {
      try {
        imageDataUrl = await captureScreenshot();
        hasScreen = !!(imageDataUrl && imageDataUrl.length > 32);
        if (!hasScreen) {
          imageDataUrl = null;
          send('status', { message: 'Could not capture the screen. Answering without it — grant screen access if needed, or open the window you want help with.' });
        }
      } catch (e) {
        send('status', { message: 'Screen capture needs permission. Grant screen access to Mirrly in your system settings.' });
        imageDataUrl = null;
        hasScreen = false;
      }
      if (hasScreen && !visionWarned && modelLikelyVision(settings.provider, llm.model) === 'no') {
        visionWarned = true;
        send('status', { message: 'Heads up: "' + llm.model + '" likely can\'t see images, so it can\'t actually read your screen and may invent details. Pick a vision-capable model in Settings for screen features.' });
      }
    }

    let built = def.build({ transcript, userText: userText || '' });
    if (!hasScreen && def.needsScreen) {
      built += '\n\n(System: no screenshot attached this turn.)';
    }
    if (settings.clipboardCtx) {
      const clip = (clipboard.readText() || '').slice(0, 2000).trim();
      if (clip) built += '\n\nClipboard contents (may be relevant):\n' + clip;
    }

    const turns = [...chat.slice(-HISTORY_CONTEXT), { role: 'user', text: built }];
    let full = '';

    if (def.useTools) {
      full = await runAgent({
        llm,
        system: buildSystem(def, settings, userText || built),
        turns,
        imageDataUrl,
        userText: userText || built,
        hasScreen,
        store,
        onStatus: (message) => send('status', { message }),
        onToken: (t) => send('llm:token', { text: t }),
        onSpeak: (text) => send('tts:speak', { text })
      });
    } else {
      full = await llm.stream({
        system: buildSystem(def, settings, userText || built),
        turns,
        imageDataUrl,
        onToken: (t) => send('llm:token', { text: t })
      });
    }

    chat.push({ role: 'user', text: userBubble || built.slice(0, 400) });
    chat.push({ role: 'assistant', text: full || '' });
    persistChat();
    send('llm:done', {});
  } catch (e) {
    let message = 'Error: ' + (e && e.message ? e.message : String(e));
    // Pollinations is winding down anonymous access — 402s are their rate gate.
    if (/\b402\b/.test(message) && store.getSettings().provider === 'pollinations') {
      message = 'Pollinations (the no-key provider) is refusing anonymous requests right now — it is being phased out. ' +
        'Try again in a moment, or better: add a free API key in Settings (Gemini, Groq, and OpenRouter all have free tiers) for reliable, screen-aware answers.';
    }
    send('llm:error', { message });
  } finally {
    state.busy = false;
  }
}

// -------- "Remember this" — extract durable facts into local memory --------
async function runRemember() {
  if (state.busy) return;
  const settings = store.getSettings();
  const llm = createLLM(settings);
  if (!llm.ready) { send('status', { message: 'Add an API key in Settings before using memory.' }); return; }
  const exchange = chat.slice(-4).map((t) => (t.role === 'user' ? 'User: ' : 'Mirrly: ') + t.text).join('\n');
  const heard = formatTranscript(transcript.slice(-6), 6);
  if (!exchange && !heard) { send('status', { message: 'Nothing to remember yet. Ask something first.' }); return; }
  state.busy = true;
  try {
    let out = '';
    await llm.stream({
      system: REMEMBER_SYSTEM,
      turns: [{ role: 'user', text: (exchange ? 'Exchange:\n' + exchange + '\n\n' : '') + (heard ? 'Heard in the room:\n' + heard : '') }],
      onToken: (t) => { out += t; }
    });
    const facts = out.split('\n').map((s) => s.replace(/^[-*\d.\s]+/, '').trim()).filter((s) => s && s !== 'NOTHING');
    if (!facts.length) { send('status', { message: 'Nothing worth remembering long-term in that exchange.' }); return; }
    const memory = [...(settings.memory || []), ...facts].slice(-50);
    store.setSettings({ memory });
    send('status', { message: 'Remembered: ' + facts.join(' · ') });
  } catch (e) {
    send('status', { message: 'Memory error: ' + (e && e.message ? e.message : String(e)) });
  } finally {
    state.busy = false;
  }
}

// -------- IPC --------
ipcMain.handle('settings:get', () => store.getSettings());
ipcMain.handle('settings:set', (_e, patch) => { sttDisabled = false; visionWarned = false; return store.setSettings(patch); });
ipcMain.handle('chat:new', () => { chat = []; store.setSettings({ history: [] }); return true; });
ipcMain.handle('capture:toggle', () => setCapturing(!state.capturing));
ipcMain.handle('capture:state', () => ({ active: state.capturing }));
ipcMain.on('ask', (_e, payload) => runFeature(payload.mode, payload.text));
ipcMain.on('remember', () => runRemember());
ipcMain.on('mic:pcm', (_e, arrayBuffer) => { if (state.capturing) buffers.you.push(Buffer.from(arrayBuffer)); });
ipcMain.handle('dictation:transcribe', async (_e, arrayBuffer) => {
  const stt = createSTT(store.getSettings());
  if (!stt.available) return { error: 'no_stt_key' };
  try {
    const res = await stt.transcribe(Buffer.from(arrayBuffer));
    if (res.error) return { error: 'stt_failed', detail: res.error.message };
    return { text: (res.text || '').trim() };
  } catch (e) {
    return { error: 'stt_failed', detail: (e && e.message) || String(e) };
  }
});
ipcMain.on('system:pcm', (_e, arrayBuffer) => { if (state.capturing) buffers.them.push(Buffer.from(arrayBuffer)); });
ipcMain.on('mouse:ignore', (_e, v) => { if (win) win.setIgnoreMouseEvents(!!v, { forward: true }); });
ipcMain.handle('mascot:set', (_e, p) => {
  p = p || {};
  const patch = {};
  if (typeof p.enabled === 'boolean') patch.mascotMode = p.enabled;
  if (typeof p.roam === 'boolean') { patch.mascotRoam = p.roam; mascot.roam = p.roam; }
  if (typeof p.character === 'string') patch.mascotCharacter = store.normalizeMascotCharacter(p.character);
  if (typeof p.reducedMotion === 'boolean') mascot.reducedMotion = p.reducedMotion;
  if (Object.keys(patch).length) store.setSettings(patch);
  if (p.enabled === true && !mascot.enabled) enterMascot();
  else if (p.enabled === false && mascot.enabled) exitMascot();
  else sendMascotState();
  return true;
});
ipcMain.on('mascot:closePanel', () => mascotClosePanel());
ipcMain.on('mascot:drag', (_e, p) => mascotDragEvent(p));
ipcMain.handle('skills:list', () => {
  ensureUserSkillsSeeded();
  const settings = store.getSettings();
  const all = listSkillFiles();
  const enabled = Array.isArray(settings.skillsEnabled)
    ? new Set(settings.skillsEnabled.map((id) => String(id).toLowerCase()))
    : null;
  return all.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    bundled: !!s.bundled,
    enabled: enabled ? enabled.has(s.id) : true
  }));
});
ipcMain.handle('skills:setEnabled', (_e, ids) => {
  const list = Array.isArray(ids) ? ids.map((id) => String(id)) : [];
  store.setSettings({ skillsEnabled: list });
  return true;
});
ipcMain.handle('skills:save', (_e, payload) => {
  const skill = saveSkill(payload || {});
  const settings = store.getSettings();
  const enabled = Array.isArray(settings.skillsEnabled)
    ? [...new Set([...settings.skillsEnabled, skill.id])]
    : null;
  if (enabled) store.setSettings({ skillsEnabled: enabled });
  return { id: skill.id, name: skill.name, description: skill.description };
});
ipcMain.handle('skills:openFolder', async () => {
  const err = await openSkillsFolder();
  return { ok: !err, error: err || null };
});
ipcMain.on('open-pane', (_e, url) => { shell.openExternal(url).catch(() => {}); });
ipcMain.on('log', (_e, msg) => console.log('[renderer]', msg));

// -------- shortcuts --------
function registerShortcuts() {
  globalShortcut.register('CommandOrControl+Return', () => runFeature('assist', ''));
  globalShortcut.register('CommandOrControl+H', () => runFeature('leetcode', ''));
  globalShortcut.register('CommandOrControl+E', () => runFeature('explain', ''));
  globalShortcut.register('CommandOrControl+Shift+X', () => app.quit());
}

// -------- lifecycle --------
app.whenReady().then(() => {
  if (app.dock) app.dock.hide();

  chat = (store.getSettings().history || []).filter((t) => t && t.role && t.text);

  const allowMedia = (permission) => permission === 'media' || permission === 'microphone' || permission === 'audioCapture' || permission === 'display-capture';
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => cb(allowMedia(permission)));
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => allowMedia(permission));

  // System-audio loopback for getDisplayMedia: hand back a screen source with 'loopback'
  // audio so the renderer can capture what's playing (calls, videos) using Mirrly's own grant.
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
      if (sources.length) callback({ video: sources[0], audio: 'loopback' });
      else callback();
    }).catch(() => callback());
  }, { useSystemPicker: false });

  createWindow();
  registerShortcuts();

  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('will-quit', () => { globalShortcut.unregisterAll(); });
app.on('window-all-closed', () => app.quit());
