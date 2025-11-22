// js/scanner.js
// Live skanowanie kodów kreskowych z użyciem BarcodeDetector (tam gdzie wspierany)

const video = document.getElementById('video');
const btnStartScan = document.getElementById('btn-start-scan');
const btnStopScan = document.getElementById('btn-stop-scan');
const barcodeInputEl = document.getElementById('input-barcode');
const scannerInfo = document.getElementById('scanner-info');

let stream = null;
let scanning = false;
let detector = null;

async function initDetector() {
  // 1) Sprawdzenie wsparcia kamery
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    console.warn('getUserMedia nieobsługiwane w tej przeglądarce.');
    if (scannerInfo) {
      scannerInfo.textContent =
        'Twoja przeglądarka nie wspiera dostępu do kamery. ' +
        'Skorzystaj z wyszukiwarki produktów poniżej i wpisz dane ręcznie.';
    }
    if (btnStartScan) btnStartScan.disabled = true;
    return false;
  }

  // 2) Sprawdzenie wsparcia BarcodeDetector
  if (!('BarcodeDetector' in window)) {
    console.warn('BarcodeDetector nieobsługiwany.');
    if (scannerInfo) {
      scannerInfo.textContent =
        'Ta przeglądarka nie wspiera API BarcodeDetector (działa np. w Chrome/Edge). ' +
        'Zamiast skanera użyj wyszukiwarki produktów poniżej lub wpisz kod ręcznie.';
    }
    if (btnStartScan) btnStartScan.disabled = true;
    return false;
  }

  // 3) Inicjalizacja detektora (jednorazowo)
  if (!detector) {
    const formats = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];
    detector = new BarcodeDetector({ formats });
    console.log('BarcodeDetector zainicjalizowany');
  }

  // Ustawiamy informację, że skaner jest dostępny
  if (scannerInfo) {
    scannerInfo.textContent =
      'Skaner używa kamery tylnej (BarcodeDetector). Jeśli skaner nie działa, ' +
      'użyj wyszukiwarki produktów poniżej lub wpisz kod ręcznie.';
  }

  return true;
}

async function startScan() {
  const ok = await initDetector();
  if (!ok) return;

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
    console.error('Błąd uruchamiania kamery:', err);
    alert('Nie udało się uruchomić kamery. Sprawdź uprawnienia przeglądarki do kamery.');
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

// Zatrzymujemy skaner gdy karta przechodzi w tło
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopScan();
  }
});

if (btnStartScan) {
  btnStartScan.addEventListener('click', startScan);
}
if (btnStopScan) {
  btnStopScan.addEventListener('click', stopScan);
}
