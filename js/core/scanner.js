// Barcode scanning with the phone camera. Uses the browser's built-in detector
// where it exists (Android Chrome) and a free open-source fallback elsewhere (iPhone).
// In a future store app, swap this one file for a native scanner plugin.
const FALLBACK = 'https://fastly.jsdelivr.net/npm/barcode-detector@2/dist/es/pure.min.js';
const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];

let Detector = null;
async function getDetector() {
  if (Detector) return Detector;
  if ('BarcodeDetector' in window) {
    try {
      const supported = await window.BarcodeDetector.getSupportedFormats();
      if (supported.includes('ean_13')) return (Detector = window.BarcodeDetector);
    } catch { /* use fallback */ }
  }
  const mod = await import(FALLBACK);
  return (Detector = mod.BarcodeDetector);
}

// Starts the camera in <video>. Calls onCode(text) once. Returns a stop function.
// Faster, steadier reads: a sharp high-resolution stream with continuous focus, and each
// try looks at a zoomed-in strip across the middle (where you aim the barcode), alternating
// with the full picture. Tries about 10 times a second.
export async function startScan(video, onCode) {
  const D = await getDetector();
  const detector = new D({ formats: FORMATS });
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false,
  });
  const track = stream.getVideoTracks()[0];
  try {
    const caps = track.getCapabilities ? track.getCapabilities() : {};
    const adv = {};
    if ((caps.focusMode || []).includes('continuous')) adv.focusMode = 'continuous';
    if ((caps.exposureMode || []).includes('continuous')) adv.exposureMode = 'continuous';
    if (Object.keys(adv).length) await track.applyConstraints({ advanced: [adv] });
  } catch { /* not supported on this phone */ }
  let stopped = false;
  const stop = () => {
    stopped = true;
    stream.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
  };
  video.setAttribute('playsinline', '');
  video.muted = true;
  video.srcObject = stream;
  await video.play();
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  let n = 0;
  const strip = () => {
    const vw = video.videoWidth, vh = video.videoHeight;
    if (!vw || !vh) return null;
    const sw = vw * 0.8, sh = vh * 0.35, sx = (vw - sw) / 2, sy = (vh - sh) / 2;
    const scale = Math.min(1, 1280 / sw);
    canvas.width = Math.round(sw * scale); canvas.height = Math.round(sh * scale);
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    return canvas;
  };
  const loop = async () => {
    if (stopped) return;
    try {
      const src = n++ % 3 === 2 ? video : strip() || video;
      const codes = await detector.detect(src);
      if (codes.length && !stopped) { stop(); if (navigator.vibrate) navigator.vibrate(60); onCode(codes[0].rawValue); return; }
    } catch { /* frame not ready */ }
    setTimeout(loop, 90);
  };
  loop();
  return { stop, torch: async (on) => { try { await track.applyConstraints({ advanced: [{ torch: on }] }); return true; } catch { return false; } } };
}
