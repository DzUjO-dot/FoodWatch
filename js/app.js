// js/app.js

// ====== Rejestracja Service Workera ======
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then(reg => {
        console.log('Service worker zarejestrowany', reg.scope);
      })
      .catch(err => console.error('SW error:', err));
  });
}

// ====== UI: przełączanie widoków ======
const navButtons = document.querySelectorAll('.nav-btn');
const views = document.querySelectorAll('.view');

navButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.view;

    // aktywne w nav
    navButtons.forEach(b => b.classList.remove('nav-btn--active'));
    btn.classList.add('nav-btn--active');

    // widoki
    views.forEach(v => {
      if (v.id === `view-${target}`) {
        v.classList.add('view--active');
      } else {
        v.classList.remove('view--active');
      }
    });
  });
});

// ====== Offline / Online banner ======
const offlineBanner = document.getElementById('offline-banner');

function updateOnlineStatus() {
  if (navigator.onLine) {
    offlineBanner.hidden = true;
  } else {
    offlineBanner.hidden = false;
  }
}

window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
document.addEventListener('DOMContentLoaded', updateOnlineStatus);

// Reszta logiki będzie niżej (DB, dashboard, itd.)
// ====== OpenFoodFacts: pobranie danych po kodzie ======
const btnFetchProduct = document.getElementById('btn-fetch-product');
const inputName = document.getElementById('input-name');
const inputBrand = document.getElementById('input-brand');

if (btnFetchProduct) {
  btnFetchProduct.addEventListener('click', async () => {
    const barcode = inputBarcode.value.trim();
    if (!barcode) {
      alert('Najpierw podaj kod kreskowy.');
      return;
    }

    try {
      const res = await fetch(
        `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`
      );
      const data = await res.json();

      if (data.status === 1) {
        const product = data.product;
        inputName.value = product.product_name || '';
        inputBrand.value = product.brands || '';
      } else {
        alert('Nie znaleziono produktu w bazie. Wpisz ręcznie.');
      }
    } catch (err) {
      console.error(err);
      alert('Błąd podczas pobierania danych. Sprawdź połączenie.');
    }
  });
}
const inputExpiry = document.getElementById('input-expiry');
const inputQuantity = document.getElementById('input-quantity');
const inputLocation = document.getElementById('input-location');
const btnSaveProduct = document.getElementById('btn-save-product');

const pantryList = document.getElementById('pantry-list');
const shoppingList = document.getElementById('shopping-list');

// Statystyki
const statTotal = document.getElementById('stat-total');
const statSoonExpiring = document.getElementById('stat-soon-expiring');
const statExpired = document.getElementById('stat-expired');

// ====== Zapis produktu ======
if (btnSaveProduct) {
  btnSaveProduct.addEventListener('click', async () => {
    const product = {
      barcode: inputBarcode.value.trim(),
      name: inputName.value.trim(),
      brand: inputBrand.value.trim(),
      expiry: inputExpiry.value,       // yyyy-mm-dd
      quantity: Number(inputQuantity.value) || 1,
      location: inputLocation.value.trim(),
      createdAt: new Date().toISOString()
    };

    if (!product.name || !product.expiry || !product.location) {
      alert('Nazwa, data ważności i lokalizacja są wymagane.');
      return;
    }

    await PantryDB.addProduct(product);
    alert('Produkt zapisany.');
    clearProductForm();
    refreshAll();
  });
}

function clearProductForm() {
  inputBarcode.value = '';
  inputName.value = '';
  inputBrand.value = '';
  inputExpiry.value = '';
  inputQuantity.value = 1;
  inputLocation.value = '';
}

// ====== Render listy spiżarni ======
async function renderPantry() {
  const products = await PantryDB.getAllProducts();
  const filterLoc = document.getElementById('filter-location').value.trim().toLowerCase();
  pantryList.innerHTML = '';

  products
    .filter(p => !filterLoc || (p.location || '').toLowerCase().includes(filterLoc))
    .forEach(p => {
      const li = document.createElement('li');
      li.className = 'list-item';

      const status = expiryStatus(p.expiry);

      li.innerHTML = `
        <div>
          <strong>${p.name}</strong> (${p.brand || 'brak marki'})<br/>
          Lokacja: <strong>${p.location}</strong><br/>
          Data ważności: ${p.expiry} (${status.label})<br/>
          Ilość: ${p.quantity}
        </div>
        <button class="btn-to-shopping">Do zakupów</button>
      `;

      li.querySelector('.btn-to-shopping').addEventListener('click', async () => {
        await PantryDB.addToShoppingList({
          name: p.name,
          brand: p.brand,
          barcode: p.barcode,
          addedAt: new Date().toISOString()
        });
        alert('Dodano do listy zakupów.');
        renderShopping();
      });

      pantryList.appendChild(li);
    });
}

function expiryStatus(dateStr) {
  if (!dateStr) return { label: 'brak daty', type: 'unknown' };
  const today = new Date();
  const expiry = new Date(dateStr);
  const diffDays = Math.floor((expiry - today) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { label: 'przeterminowany', type: 'expired' };
  if (diffDays <= 3) return { label: 'kończy się wkrótce', type: 'soon' };
  return { label: 'OK', type: 'ok' };
}

// ====== Render listy zakupów ======
async function renderShopping() {
  const items = await PantryDB.getShoppingList();
  shoppingList.innerHTML = '';

  items.forEach(i => {
    const li = document.createElement('li');
    li.className = 'list-item';
    li.textContent = `${i.name} (${i.brand || 'brak marki'})`;
    shoppingList.appendChild(li);
  });
}

// ====== Statystyki na dashboardzie ======
async function renderDashboard() {
  const products = await PantryDB.getAllProducts();
  let total = products.length;
  let soon = 0;
  let expired = 0;

  products.forEach(p => {
    const status = expiryStatus(p.expiry);
    if (status.type === 'soon') soon++;
    if (status.type === 'expired') expired++;
  });

  statTotal.textContent = total;
  statSoonExpiring.textContent = soon;
  statExpired.textContent = expired;
}

// ====== Odśwież wszystko ======
async function refreshAll() {
  await renderPantry();
  await renderShopping();
  await renderDashboard();
  checkExpirationsAndNotify(); // powiadomienia
}

document.addEventListener('DOMContentLoaded', () => {
  refreshAll();

  const btnApplyFilter = document.getElementById('btn-apply-filter');
  if (btnApplyFilter) {
    btnApplyFilter.addEventListener('click', renderPantry);
  }
});
