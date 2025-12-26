// Barcode scanner with native BarcodeDetector and HTML5-QRCODE fallback.

const video = document.getElementById('video');
const html5ReaderEl = document.getElementById('html5qr-reader');
const btnStartScan = document.getElementById('btn-start-scan');
const btnStopScan = document.getElementById('btn-stop-scan');
const barcodeInputEl = document.getElementById('input-barcode');

let stream = null;
let scanning = false;
let detector = null;
let html5QrCode = null;

const canUseBarcodeDetector = () => 'BarcodeDetector' in window;
const canUseHtml5Qrcode = () => typeof window.Html5Qrcode !== 'undefined';

function setButtons(isScanning) {
  if (btnStartScan) btnStartScan.disabled = isScanning;
  if (btnStopScan) btnStopScan.disabled = !isScanning;
}

function setScannerView(useHtml5) {
  if (video) video.style.display = useHtml5 ? 'none' : 'block';
  if (html5ReaderEl) html5ReaderEl.style.display = useHtml5 ? 'block' : 'none';
}

function updateScannerInfo(message) {
  const scannerInfo = document.getElementById('scanner-info');
  if (scannerInfo && message) scannerInfo.textContent = message;
}

async function initDetector() {
  if (canUseBarcodeDetector()) {
    const formats = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];
    detector = new BarcodeDetector({ formats });
    console.log('BarcodeDetector available');
    return;
  }

  if (canUseHtml5Qrcode()) {
    updateScannerInfo(
      'Native scanner not available. Using fallback mode compatible with iOS Safari.'
    );
    return;
  }

  updateScannerInfo(
    'Scanner not supported on this device. Use search or manual input.'
  );
  if (btnStartScan) btnStartScan.disabled = true;
}

async function startNativeScan() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    });
    if (video) video.srcObject = stream;
    scanning = true;
    setButtons(true);
    setScannerView(false);
    requestAnimationFrame(scanFrame);
  } catch (err) {
    console.error(err);
    alert('Camera could not be started.');
  }
}

async function startHtml5Scan() {
  if (!html5ReaderEl) {
    alert('Scanner container missing.');
    return;
  }

  try {
    if (!html5QrCode) {
      html5QrCode = new Html5Qrcode('html5qr-reader');
    }

    const config = { fps: 10, qrbox: { width: 220, height: 220 } };
    if (window.Html5QrcodeSupportedFormats) {
      config.formatsToSupport = [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E
      ];
    }

    scanning = true;
    setButtons(true);
    setScannerView(true);

    await html5QrCode.start(
      { facingMode: 'environment' },
      config,
      (decodedText) => {
        if (barcodeInputEl) barcodeInputEl.value = decodedText;
        if (navigator.vibrate) navigator.vibrate(100);
        stopScan();
      },
      () => {}
    );
  } catch (err) {
    console.error(err);
    scanning = false;
    setButtons(false);
    setScannerView(false);
    alert('Camera could not be started.');
  }
}

async function startScan() {
  if (canUseBarcodeDetector()) {
    if (!detector) await initDetector();
    if (!detector) {
      alert('Scanner not supported. Use search or manual input.');
      return;
    }
    await startNativeScan();
    return;
  }

  if (canUseHtml5Qrcode()) {
    await startHtml5Scan();
    return;
  }

  alert('Scanner not supported. Use search or manual input.');
}

async function scanFrame() {
  if (!scanning || !detector || !video) return;

  if (video.readyState === HTMLMediaElement.HAVE_ENOUGH_DATA) {
    try {
      const barcodes = await detector.detect(video);
      if (barcodes.length > 0) {
        const raw = barcodes[0].rawValue;
        if (barcodeInputEl) barcodeInputEl.value = raw;
        if (navigator.vibrate) navigator.vibrate(100);
        stopScan();
        return;
      }
    } catch (err) {
      console.error('Barcode detect error:', err);
    }
  }
  requestAnimationFrame(scanFrame);
}

function stopStream() {
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
}

function stopHtml5() {
  if (!html5QrCode) return;
  html5QrCode
    .stop()
    .then(() => html5QrCode.clear())
    .catch((err) => console.warn('HTML5 QR stop error:', err))
    .finally(() => {
      html5QrCode = null;
    });
}

function stopScan() {
  scanning = false;
  setButtons(false);
  stopStream();
  stopHtml5();
  setScannerView(false);
}

if (btnStartScan) {
  btnStartScan.addEventListener('click', startScan);
}
if (btnStopScan) {
  btnStopScan.addEventListener('click', stopScan);
}

initDetector();
