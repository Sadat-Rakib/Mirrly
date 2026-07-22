const { contextBridge, ipcRenderer } = require('electron');
const { modelLikelyVision, VISION_WARN_TEXT, VISION_UNKNOWN_TEXT } = require('./src/models');

contextBridge.exposeInMainWorld('mirrly', {
  platform: process.platform,
  settingsGet: () => ipcRenderer.invoke('settings:get'),
  settingsSet: (patch) => ipcRenderer.invoke('settings:set', patch),
  ask: (payload) => ipcRenderer.send('ask', payload),
  remember: () => ipcRenderer.send('remember'),
  newChat: () => ipcRenderer.invoke('chat:new'),
  captureToggle: () => ipcRenderer.invoke('capture:toggle'),
  captureState: () => ipcRenderer.invoke('capture:state'),
  micPcm: (arrayBuffer) => ipcRenderer.send('mic:pcm', arrayBuffer),
  systemPcm: (arrayBuffer) => ipcRenderer.send('system:pcm', arrayBuffer),
  dictate: (arrayBuffer) => ipcRenderer.invoke('dictation:transcribe', arrayBuffer),
  setIgnoreMouse: (v) => ipcRenderer.send('mouse:ignore', v),
  openPane: (url) => ipcRenderer.send('open-pane', url),
  log: (msg) => ipcRenderer.send('log', msg),
  modelVision: (provider, model) => modelLikelyVision(provider, model),
  visionTexts: { warn: VISION_WARN_TEXT, unknown: VISION_UNKNOWN_TEXT },
  mascotSet: (payload) => ipcRenderer.invoke('mascot:set', payload),
  mascotClosePanel: () => ipcRenderer.send('mascot:closePanel'),
  mascotDrag: (payload) => ipcRenderer.send('mascot:drag', payload),
  skillsList: () => ipcRenderer.invoke('skills:list'),
  skillsSetEnabled: (ids) => ipcRenderer.invoke('skills:setEnabled', ids),
  skillsSave: (payload) => ipcRenderer.invoke('skills:save', payload),
  skillsOpenFolder: () => ipcRenderer.invoke('skills:openFolder'),
  on: (channel, cb) => {
    const allowed = ['capture:state', 'llm:start', 'llm:token', 'llm:done', 'llm:error', 'status', 'transcript', 'tts:speak', 'mascot:state', 'voice:state'];
    if (!allowed.includes(channel)) return;
    ipcRenderer.on(channel, (_e, data) => cb(data));
  }
});
