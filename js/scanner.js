// js/scanner.js

const video = document.getElementById('video');
const btnStartScan = document.getElementById('btn-start-scan');
const btnStopScan = document.getElementById('btn-stop-scan');
const inputBarcode = document.getElementById('input-barcode');

let stream = null;
let scanning = false;
let detector = null;

async function initDetector() {
  if ('BarcodeDetector' in window) {
    const formats = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];
    detector = new BarcodeDetector({ formats });
    console.log('BarcodeDetector dostępny');
  } else {
    console.warn('BarcodeDetector nieobsługiwany – użyj wpisania ręcznego.');
  }
}

async function startScan() {
  await initDetector();
  if (!detector) {
    alert('Twoja przeglądarka nie obsługuje skanera. Użyj wpisania kodu.');
    return;
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    });
    video.srcObject = stream;
    scanning = true;
    btnStartScan.disabled = true;
    btnStopScan.disabled = false;
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
        inputBarcode.value = raw;
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
  btnStartScan.disabled = false;
  btnStopScan.disabled = true;
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
