// Full-resolution screenshot via desktopCapturer (main process).
// Prefers the display under the cursor; falls back to primary.
const { desktopCapturer, screen } = require('electron');

function displayUnderCursor() {
  try {
    const point = screen.getCursorScreenPoint();
    return screen.getDisplayNearestPoint(point);
  } catch {
    return screen.getPrimaryDisplay();
  }
}

async function captureScreenshot() {
  const target = displayUnderCursor() || screen.getPrimaryDisplay();
  const { width, height } = target.size;
  const scale = target.scaleFactor || 1;
  const thumbW = Math.min(Math.floor(width * scale), 2560);
  const thumbH = Math.min(Math.floor(height * scale), 1440);

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: thumbW, height: thumbH }
  });
  if (!sources.length) {
    console.log('[screen] no sources');
    return null;
  }

  const src =
    sources.find((s) => String(s.display_id) === String(target.id)) ||
    sources.find((s) => String(s.display_id) === String(screen.getPrimaryDisplay().id)) ||
    sources[0];

  const img = src.thumbnail;
  if (!img || img.isEmpty()) {
    console.log('[screen] empty thumbnail for', src.id, src.name);
    return null;
  }
  const dataUrl = img.toDataURL();
  console.log('[screen] captured', src.name, 'bytes≈', Math.round((dataUrl.length || 0) * 0.75));
  return dataUrl;
}

module.exports = { captureScreenshot };
