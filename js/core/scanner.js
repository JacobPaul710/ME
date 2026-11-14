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
export async function startScan(video, onCode) {
  const D = await getDetector();
  const detector = new D({ formats: FORMATS });
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
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
  const loop = async () => {
    if (stopped) return;
    try {
      const codes = await detector.detect(video);
      if (codes.length && !stopped) { stop(); onCode(codes[0].rawValue); return; }
    } catch { /* frame not ready */ }
    setTimeout(loop, 200);
  };
  loop();
  return stop;
}
