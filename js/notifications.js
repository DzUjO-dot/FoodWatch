// js/notifications.js

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

  reg.showNotification('Spiżarnia – ważne produkty', {
    body: bodyParts.join(' | '),
    icon: '/img/icon-192.png',
    badge: '/img/icon-192.png'
  });
}

// Wywoływane z app.js (checkExpirationsAndNotify)
async function checkExpirationsAndNotify() {
  const granted = await requestNotificationPermission();
  if (!granted) return;

  if (!window.PantryDB) return;
  const products = await window.PantryDB.getAllProducts();

  let expired = 0;
  let soon = 0;
  const now = new Date();

  products.forEach(p => {
    if (!p.expiry) return;
    const d = new Date(p.expiry);
    const diff = Math.floor((d - now) / (1000 * 60 * 60 * 24));

    if (diff < 0) expired++;
    else if (diff <= 3) soon++;
  });

  await showExpiryNotification(expired, soon);
}

window.checkExpirationsAndNotify = checkExpirationsAndNotify;
