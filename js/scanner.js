// Barcode/QR scanner using BarcodeDetector and qr-scanner fallback.

const video = document.getElementById('video');
const btnStartScan = document.getElementById('btn-start-scan');
const btnStopScan = document.getElementById('btn-stop-scan');
const barcodeInputEl = document.getElementById('input-barcode');

let scanning = false;
let qrScanner = null;
let barcodeDetector = null;
let scanMode = null;
let scanLoopId = null;
let activeStream = null;

const BARCODE_FORMATS = [
  'ean_13',
  'ean_8',
  'upc_a',
  'upc_e',
  'code_128',
  'code_39',
  'code_93',
  'itf',
  'qr_code',
  'data_matrix',
  'aztec',
  'pdf417'
];

function setButtons(isScanning) {
  if (btnStartScan) btnStartScan.disabled = isScanning;
  if (btnStopScan) btnStopScan.disabled = !isScanning;
}

function updateScannerInfo(message) {
  const scannerInfo = document.getElementById('scanner-info');
  if (scannerInfo && message) scannerInfo.textContent = message;
}

function canUseBarcodeDetector() {
  return 'BarcodeDetector' in window;
}

function initScanner() {
  if (!video) {
    updateScannerInfo('Scanner not available.');
    if (btnStartScan) btnStartScan.disabled = true;
    return false;
  }

  const hasBarcode = canUseBarcodeDetector();
  const hasQr = !!window.QrScanner;

  if (!hasBarcode && !hasQr) {
    updateScannerInfo('Scanner not supported. Use search or manual input.');
    if (btnStartScan) btnStartScan.disabled = true;
    return false;
  }

  if (hasBarcode) {
    updateScannerInfo('Skaner kodow kreskowych gotowy (kamera tylna).');
  } else {
    updateScannerInfo('Skaner QR gotowy (kamera tylna).');
  }

  return true;
}

function handleScanResult(value) {
  if (barcodeInputEl) barcodeInputEl.value = value;
  if (navigator.vibrate) navigator.vibrate(100);
  stopScan();
}

async function startBarcodeScan() {
  if (!navigator.mediaDevices?.getUserMedia) {
    updateScannerInfo('Brak dostepu do kamery w tej przegladarce.');
    return false;
  }

  let formats = BARCODE_FORMATS;
  if (window.BarcodeDetector?.getSupportedFormats) {
    try {
      const supported = await BarcodeDetector.getSupportedFormats();
      formats = BARCODE_FORMATS.filter((f) => supported.includes(f));
    } catch (err) {
      console.warn('BarcodeDetector formats check failed:', err);
    }
  }

  barcodeDetector = new BarcodeDetector({ formats });

  const constraints = { video: { facingMode: { ideal: 'environment' } } };
  activeStream = await navigator.mediaDevices.getUserMedia(constraints);
  video.srcObject = activeStream;
  await video.play();

  scanning = true;
  scanMode = 'barcode';
  setButtons(true);
  updateScannerInfo('Skanowanie kodow kreskowych uruchomione.');
  scanLoopId = requestAnimationFrame(scanBarcodeFrame);
  return true;
}

async function scanBarcodeFrame() {
  if (!scanning || scanMode !== 'barcode' || !barcodeDetector || !video) {
    return;
  }

  if (video.readyState < 2) {
    scanLoopId = requestAnimationFrame(scanBarcodeFrame);
    return;
  }

  try {
    const codes = await barcodeDetector.detect(video);
    if (codes && codes.length) {
      const value = codes[0].rawValue;
      handleScanResult(value);
      return;
    }
  } catch (err) {
    console.warn('BarcodeDetector error:', err);
  }

  scanLoopId = requestAnimationFrame(scanBarcodeFrame);
}

async function startQrScan() {
  if (!window.QrScanner) {
    updateScannerInfo('QR scanner not supported. Use search or manual input.');
    return;
  }

  window.QrScanner.WORKER_PATH =
    'https://unpkg.com/qr-scanner@1.4.2/qr-scanner-worker.min.js';

  if (!qrScanner) {
    qrScanner = new QrScanner(
      video,
      (decodedText) => handleScanResult(decodedText),
      { preferredCamera: 'environment' }
    );
  }

  await qrScanner.start();
  scanning = true;
  scanMode = 'qr';
  setButtons(true);
  updateScannerInfo('Skaner QR uruchomiony.');
}

async function startScan() {
  if (!initScanner()) return;

  if (canUseBarcodeDetector()) {
    try {
      const started = await startBarcodeScan();
      if (started) return;
    } catch (err) {
      console.warn('Barcode scanner failed, falling back to QR:', err);
      stopMediaStream();
      scanning = false;
      scanMode = null;
      setButtons(false);
    }
  }

  try {
    await startQrScan();
  } catch (err) {
    console.error(err);
    scanning = false;
    setButtons(false);
    alert('Camera could not be started.');
  }
}

function stopMediaStream() {
  if (scanLoopId) {
    cancelAnimationFrame(scanLoopId);
    scanLoopId = null;
  }

  if (activeStream) {
    activeStream.getTracks().forEach((track) => track.stop());
    activeStream = null;
  }

  if (video) {
    video.pause();
    video.srcObject = null;
  }
}

function stopScan() {
  scanning = false;
  setButtons(false);

  if (scanMode === 'qr' && qrScanner) {
    qrScanner.stop();
    qrScanner.destroy();
    qrScanner = null;
  }

  if (scanMode === 'barcode') {
    stopMediaStream();
  }

  scanMode = null;
}

if (btnStartScan) {
  btnStartScan.addEventListener('click', startScan);
}
if (btnStopScan) {
  btnStopScan.addEventListener('click', stopScan);
}

initScanner();
