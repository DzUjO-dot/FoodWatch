// js/notifications.js
// Obsługa powiadomień i prosta historia alertów FoodWatch

const ALERT_STORAGE_KEY = 'foodwatchAlerts';

function getAlertHistory() {
  try {
    const raw = localStorage.getItem(ALERT_STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.warn('Nie udało się odczytać historii alertów:', e);
    return [];
  }
}

function addAlertHistoryEntry(expired, soon) {
  const history = getAlertHistory();
  const entry = {
    timestamp: new Date().toISOString(),
    expired,
    soon
  };
  history.unshift(entry);
  const trimmed = history.slice(0, 5);
  try {
    localStorage.setItem(ALERT_STORAGE_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.warn('Nie udało się zapisać historii alertów:', e);
  }
}

async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.warn('Notifications API nieobsługiwane.');
    return false;
  }

  const perm = await Notification.requestPermission();
  return perm === 'granted';
}

async function showExpiryNotification(expiredCount, soonCount) {
  if (!('serviceWorker' in navigator)) return;

  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return;

  const bodyParts = [];
  if (expiredCount > 0) bodyParts.push(`Przeterminowane: ${expiredCount}`);
  if (soonCount > 0) bodyParts.push(`Kończą się wkrótce: ${soonCount} (≤3 dni)`);

  if (bodyParts.length === 0) return;

  reg.showNotification('FoodWatch – ważne produkty', {
    body: bodyParts.join(' | '),
    icon: 'img/icon-192.png',
    badge: 'img/icon-192.png'
  });
}

// Wywoływane z app.js
async function checkExpirationsAndNotify() {
  const granted = await requestNotificationPermission();
  if (!granted) return;

  if (!window.PantryDB) return;
  const products = await window.PantryDB.getAllProducts();
  const shoppingList = window.PantryDB.getShoppingList
    ? await window.PantryDB.getShoppingList()
    : [];

  let expired = 0;
  let soon = 0;
  const now = new Date();

  for (const p of products) {
    if (!p.expiry) continue;
    const d = new Date(p.expiry + 'T00:00:00');
    const diff = Math.floor((d - now) / (1000 * 60 * 60 * 24));

    if (diff < 0) {
      expired++;

      // Automatyczne dodanie do listy zakupów, jeśli nie ma już pozycji "pending" dla tego produktu
      if (window.PantryDB && window.PantryDB.addToShoppingList) {
        const already = shoppingList.some(
          s =>
            s.status !== 'done' &&
            ((s.barcode && p.barcode && s.barcode === p.barcode) ||
              (s.name && p.name && s.name === p.name))
        );

        if (!already) {
          try {
            await window.PantryDB.addToShoppingList({
              name: p.name || 'Produkt bez nazwy',
              brand: p.brand || null,
              barcode: p.barcode || null,
              quantity: 1,
              source: 'expired',
              addedAt: new Date().toISOString()
            });
          } catch (e) {
            console.warn(
              'Nie udało się dodać przeterminowanego produktu do listy zakupów:',
              e
            );
          }
        }
      }
    } else if (diff <= 3) {
      soon++;
    }
  }

  addAlertHistoryEntry(expired, soon);
  await showExpiryNotification(expired, soon);
}

window.checkExpirationsAndNotify = checkExpirationsAndNotify;
window.FoodWatchAlerts = {
  getAlertHistory
};
