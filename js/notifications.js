// Powiadomienia i historia alertów

const ALERT_STORAGE_KEY = 'foodwatchAlerts';
let notificationPermissionChecked = false;

let notificationSettings = {
  notifyExpired: true,
  notifySoon: true,
  soonDaysThreshold: 3
};

function setNotificationSettings(newSettings) {
  notificationSettings = {
    ...notificationSettings,
    ...newSettings
  };
}

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
  const trimmed = history.slice(0, 20);
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

  if (Notification.permission === 'granted') {
    notificationPermissionChecked = true;
    return true;
  }
  if (Notification.permission === 'denied') {
    notificationPermissionChecked = true;
    return false;
  }
  if (notificationPermissionChecked) {
    return Notification.permission === 'granted';
  }

  const perm = await Notification.requestPermission();
  notificationPermissionChecked = true;
  return perm === 'granted';
}

async function showExpiryNotification(expiredCount, soonCount) {
  if (!('serviceWorker' in navigator)) return;

  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return;

  const bodyParts = [];
  if (expiredCount > 0 && notificationSettings.notifyExpired) {
    bodyParts.push(`Przeterminowane: ${expiredCount}`);
  }
  if (soonCount > 0 && notificationSettings.notifySoon) {
    bodyParts.push(
      `Kończą się wkrótce: ${soonCount} (≤${notificationSettings.soonDaysThreshold} dni)`
    );
  }

  if (!bodyParts.length) return;

  reg.showNotification('FoodWatch – ważne produkty', {
    body: bodyParts.join(' | '),
    icon: 'img/icon-192.png',
    badge: 'img/icon-192.png'
  });
}

async function checkExpirationsAndNotify() {
  if (!notificationSettings.notifyExpired && !notificationSettings.notifySoon) {
    return;
  }

  const granted = await requestNotificationPermission();
  if (!granted) return;

  if (!window.PantryDB || !PantryDB.getAllProducts) return;
  const products = await window.PantryDB.getAllProducts();

  let expired = 0;
  let soon = 0;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const soonThreshold = notificationSettings.soonDaysThreshold ?? 3;
  const toAutoMove = [];

  products.forEach(p => {
    if (!p.expiry) return;
    const d = new Date(p.expiry + 'T00:00:00');
    d.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((d - now) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      expired += 1;
      if (!p.autoMovedToShopping) {
        toAutoMove.push(p);
      }
    } else if (diffDays <= soonThreshold) {
      soon += 1;
    }
  });

  if (expired > 0 || soon > 0) {
    addAlertHistoryEntry(expired, soon);
    await showExpiryNotification(expired, soon);
  }

  for (const p of toAutoMove) {
    await PantryDB.addToShoppingList({
      name: p.name,
      brand: p.brand,
      barcode: p.barcode,
      source: 'expired_auto',
      linkedProductId: p.id
    });
    await PantryDB.updateProduct({ ...p, autoMovedToShopping: true });
    await PantryDB.addHistoryEntry({
      type: 'PRODUCT_EXPIRED_TO_SHOPPING',
      message: 'Produkt przeterminowany – przeniesiono na listę zakupów',
      productName: p.name,
      productBrand: p.brand,
      expiry: p.expiry
    });
  }
}

window.FoodWatchNotifications = {
  checkExpirationsAndNotify,
  getAlertHistory,
  setNotificationSettings
};

window.FoodWatchAlerts = {
  getAlertHistory
};
