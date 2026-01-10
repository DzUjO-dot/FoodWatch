// Barcode/QR scanner using BarcodeDetector and qr-scanner fallback.

const video = document.getElementById('video');
const btnStartScan = document.getElementById('btn-start-scan');
const btnStopScan = document.getElementById('btn-stop-scan');
const barcodeInputEl = document.getElementById('input-barcode');
const quaggaView = document.getElementById('quagga-view');

let scanning = false;
let qrScanner = null;
let barcodeDetector = null;
let scanMode = null;
let scanLoopId = null;
let activeStream = null;
let quaggaDetectedHandler = null;

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

function canUseQuagga() {
  return !!window.Quagga;
}

function showVideoStream() {
  if (video) video.hidden = false;
  if (quaggaView) quaggaView.hidden = true;
}

function showQuaggaStream() {
  if (video) video.hidden = true;
  if (quaggaView) quaggaView.hidden = false;
}

function initScanner() {
  if (!video) {
    updateScannerInfo('Scanner not available.');
    if (btnStartScan) btnStartScan.disabled = true;
    return false;
  }

  const hasBarcode = canUseBarcodeDetector();
  const hasQuagga = canUseQuagga();
  const hasQr = !!window.QrScanner;

  if (!hasBarcode && !hasQuagga && !hasQr) {
    updateScannerInfo('Scanner not supported. Use search or manual input.');
    if (btnStartScan) btnStartScan.disabled = true;
    return false;
  }

  if (hasBarcode) {
    updateScannerInfo('Skaner kodow kreskowych gotowy (kamera tylna).');
  } else if (hasQuagga) {
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

  showVideoStream();

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

  showVideoStream();

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

function attachQuaggaHandler() {
  if (quaggaDetectedHandler || !window.Quagga) return;
  quaggaDetectedHandler = (result) => {
    const code = result?.codeResult?.code;
    if (!code || !scanning || scanMode !== 'quagga') return;
    handleScanResult(code);
  };
  window.Quagga.onDetected(quaggaDetectedHandler);
}

function detachQuaggaHandler() {
  if (quaggaDetectedHandler && window.Quagga?.offDetected) {
    window.Quagga.offDetected(quaggaDetectedHandler);
  }
  quaggaDetectedHandler = null;
}

async function startQuaggaScan() {
  if (!window.Quagga || !quaggaView) {
    updateScannerInfo('Skaner kodow kreskowych niedostepny.');
    return false;
  }

  stopMediaStream();
  showQuaggaStream();

  const readers = [
    'ean_reader',
    'ean_8_reader',
    'upc_reader',
    'upc_e_reader',
    'code_128_reader',
    'code_39_reader',
    'code_93_reader',
    'i2of5_reader'
  ];

  return new Promise((resolve, reject) => {
    window.Quagga.init(
      {
        inputStream: {
          type: 'LiveStream',
          target: quaggaView,
          constraints: { facingMode: 'environment' }
        },
        locator: { patchSize: 'medium', halfSample: true },
        numOfWorkers: navigator.hardwareConcurrency
          ? Math.max(2, Math.min(navigator.hardwareConcurrency, 6))
          : 2,
        decoder: { readers }
      },
      (err) => {
        if (err) {
          reject(err);
          return;
        }
        attachQuaggaHandler();
        window.Quagga.start();
        scanning = true;
        scanMode = 'quagga';
        setButtons(true);
        updateScannerInfo('Skaner kodow kreskowych uruchomiony.');
        resolve(true);
      }
    );
  });
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

  if (canUseQuagga()) {
    try {
      const started = await startQuaggaScan();
      if (started) return;
    } catch (err) {
      console.warn('Quagga scanner failed, falling back to QR:', err);
      stopQuagga();
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

function stopQuagga() {
  detachQuaggaHandler();
  if (window.Quagga?.stop) {
    try {
      window.Quagga.stop();
    } catch (err) {
      console.warn('Quagga stop failed:', err);
    }
  }
  if (quaggaView) {
    quaggaView.innerHTML = '';
    quaggaView.hidden = true;
  }
  if (video) video.hidden = false;
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

  if (scanMode === 'quagga') {
    stopQuagga();
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
