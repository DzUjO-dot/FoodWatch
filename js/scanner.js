// QR scanner using qr-scanner library.

const video = document.getElementById('video');
const btnStartScan = document.getElementById('btn-start-scan');
const btnStopScan = document.getElementById('btn-stop-scan');
const barcodeInputEl = document.getElementById('input-barcode');

let scanning = false;
let qrScanner = null;

function setButtons(isScanning) {
  if (btnStartScan) btnStartScan.disabled = isScanning;
  if (btnStopScan) btnStopScan.disabled = !isScanning;
}

function updateScannerInfo(message) {
  const scannerInfo = document.getElementById('scanner-info');
  if (scannerInfo && message) scannerInfo.textContent = message;
}

function initScanner() {
  if (!video) {
    updateScannerInfo('Scanner not available.');
    if (btnStartScan) btnStartScan.disabled = true;
    return false;
  }

  if (!window.QrScanner) {
    updateScannerInfo('QR scanner not supported. Use search or manual input.');
    if (btnStartScan) btnStartScan.disabled = true;
    return false;
  }

  window.QrScanner.WORKER_PATH =
    'https://unpkg.com/qr-scanner@1.4.2/qr-scanner-worker.min.js';
  updateScannerInfo('QR scanner ready (rear camera).');
  return true;
}

async function startScan() {
  if (!initScanner()) return;

  if (!qrScanner) {
    qrScanner = new QrScanner(
      video,
      (decodedText) => {
        if (barcodeInputEl) barcodeInputEl.value = decodedText;
        if (navigator.vibrate) navigator.vibrate(100);
        stopScan();
      },
      { preferredCamera: 'environment' }
    );
  }

  try {
    await qrScanner.start();
    scanning = true;
    setButtons(true);
  } catch (err) {
    console.error(err);
    scanning = false;
    setButtons(false);
    alert('Camera could not be started.');
  }
}

function stopScan() {
  scanning = false;
  setButtons(false);

  if (qrScanner) {
    qrScanner.stop();
    qrScanner.destroy();
    qrScanner = null;
  }
}

if (btnStartScan) {
  btnStartScan.addEventListener('click', startScan);
}
if (btnStopScan) {
  btnStopScan.addEventListener('click', stopScan);
}

initScanner();
