// js/scanner.js
// Obsługa kamery i skanowania kodów kreskowych (BarcodeDetector + fallback)

const video = document.getElementById('video');
const btnStartScan = document.getElementById('btn-start-scan');
const btnStopScan = document.getElementById('btn-stop-scan');
const barcodeInputEl = document.getElementById('input-barcode');

let stream = null;
let scanning = false;
let detector = null;

async function initDetector() {
  if ('BarcodeDetector' in window) {
    const formats = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];
    detector = new BarcodeDetector({ formats });
    console.log('BarcodeDetector dostępny');
  } else {
    console.warn('BarcodeDetector nieobsługiwany – użyj wpisania ręcznego / wyszukiwarki.');
    if (btnStartScan) {
      btnStartScan.disabled = true;
      btnStartScan.title = 'Skaner nie jest obsługiwany w tej przeglądarce.';
    }
  }
}

async function startScan() {
  if (!detector) {
    await initDetector();
  }
  if (!detector) {
    alert('Twoja przeglądarka nie obsługuje skanera. Użyj wyszukiwarki lub wpisz kod ręcznie.');
    return;
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    });
    video.srcObject = stream;
    scanning = true;
    if (btnStartScan) btnStartScan.disabled = true;
    if (btnStopScan) btnStopScan.disabled = false;
    requestAnimationFrame(scanFrame);
  } catch (err) {
    console.error(err);
    alert('Nie udało się uruchomić kamery.');
  }
}

async function scanFrame() {
  if (!scanning || !detector) return;

  if (video.readyState === HTMLMediaElement.HAVE_ENOUGH_DATA) {
    try {
      const barcodes = await detector.detect(video);
      if (barcodes.length > 0) {
        const raw = barcodes[0].rawValue;
        console.log('Wykryty kod:', raw);
        if (barcodeInputEl) {
          barcodeInputEl.value = raw;
        }
        if (navigator.vibrate) {
          navigator.vibrate(100);
        }
        stopScan();
        return;
      }
    } catch (err) {
      console.error('Błąd detekcji kodu:', err);
    }
  }
  requestAnimationFrame(scanFrame);
}

function stopScan() {
  scanning = false;
  if (btnStartScan) btnStartScan.disabled = false;
  if (btnStopScan) btnStopScan.disabled = true;
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
}

if (btnStartScan) {
  btnStartScan.addEventListener('click', startScan);
}
if (btnStopScan) {
  btnStopScan.addEventListener('click', stopScan);
}

initDetector();
