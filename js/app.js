// js/app.js
// Główna logika FoodWatch: widoki, dashboard, CRUD produktów, filtrowanie, zakupy + pseudo-AI

// ====== Service Worker ======
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('sw.js')
      .then(reg => {
        console.log('Service worker zarejestrowany', reg.scope);
      })
      .catch(err => console.error('SW error:', err));
  });
}

// ====== Nawigacja widoków ======
const navButtons = document.querySelectorAll('.nav-btn');
const views = document.querySelectorAll('.view');

function setActiveView(viewName) {
  views.forEach(v => {
    if (v.id === `view-${viewName}`) {
      v.classList.add('view--active');
    } else {
      v.classList.remove('view--active');
    }
  });

  navButtons.forEach(btn => {
    if (btn.dataset.view === viewName) {
      btn.classList.add('nav-btn--active');
    } else {
      btn.classList.remove('nav-btn--active');
    }
  });
}

navButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.view;
    setActiveView(target);
  });
});

// ====== Offline banner ======
const offlineBanner = document.getElementById('offline-banner');
const shoppingOfflineHint = document.getElementById('shopping-offline-hint');

function updateOnlineStatus() {
  const online = navigator.onLine;
  if (offlineBanner) offlineBanner.hidden = online;
  if (shoppingOfflineHint) shoppingOfflineHint.hidden = online;
}

window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

// ====== Referencje DOM & stan ======
let editingProductId = null;

const inputBarcode = document.getElementById('input-barcode');
const inputName = document.getElementById('input-name');
const inputBrand = document.getElementById('input-brand');
const inputExpiry = document.getElementById('input-expiry');
const inputQuantity = document.getElementById('input-quantity');
const inputLocation = document.getElementById('input-location');
const editHint = document.getElementById('edit-hint');

const pantryList = document.getElementById('pantry-list');

const shoppingListPending = document.getElementById('shopping-list-pending');
const shoppingListDone = document.getElementById('shopping-list-done');

const statTotal = document.getElementById('stat-total');
const statSoonExpiring = document.getElementById('stat-soon-expiring');
const statExpired = document.getElementById('stat-expired');
const statRiskPercentage = document.getElementById('stat-risk-percentage');
const riskProgressBar = document.getElementById('risk-progress-bar');

const alertHistoryList = document.getElementById('alert-history-list');
const btnRefreshDashboard = document.getElementById('btn-refresh-dashboard');
const btnToggleInfo = document.getElementById('btn-toggle-info');
const infoPanel = document.getElementById('info-panel');

const btnFetchProduct = document.getElementById('btn-fetch-product');
const btnSaveProduct = document.getElementById('btn-save-product');

const filterLocation = document.getElementById('filter-location');
const filterSearch = document.getElementById('filter-search');
const filterSort = document.getElementById('filter-sort');
const btnApplyFilter = document.getElementById('btn-apply-filter');

// Wyszukiwanie w OpenFoodFacts po nazwie
const searchExistingInput = document.getElementById('input-search-existing');
const searchExistingResults = document.getElementById('search-existing-results');

// AI koszyka
const aiCostValue = document.getElementById('ai-cost-value');
const aiCostHint = document.getElementById('ai-cost-hint');
const aiCategoryGrid = document.getElementById('ai-category-grid');

// Toolbar zakupów
const btnShareShopping = document.getElementById('btn-share-shopping');
const btnFindStores = document.getElementById('btn-find-stores');
const btnClearDone = document.getElementById('btn-clear-done');

// Historia działań
const historyList = document.getElementById('history-list');
const btnExportData = document.getElementById('btn-export-data');

// ====== Status daty ważności ======
function expiryStatus(dateStr) {
  if (!dateStr) return { label: 'brak daty', type: 'unknown' };

  const today = new Date();
  const expiry = new Date(dateStr + 'T00:00:00');
  const diffDays = Math.floor((expiry - today) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { label: 'przeterminowany', type: 'expired' };
  if (diffDays <= 3) return { label: 'kończy się wkrótce', type: 'soon' };
  return { label: 'OK', type: 'ok' };
}

// ====== Historia działań – helper ======
async function logEvent(type, message) {
  try {
    if (!window.PantryDB || !PantryDB.addHistoryEntry) return;
    await PantryDB.addHistoryEntry({
      type,
      message,
      createdAt: new Date().toISOString()
    });
  } catch (e) {
    console.warn('Nie udało się zapisać historii:', e);
  }
}

// ====== OpenFoodFacts: pobieranie po kodzie kreskowym ======
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

        // log: pobrano dane z OpenFoodFacts po kodzie kreskowym
        await logEvent(
          'off_barcode_fill',
          `Pobrano dane produktu z OpenFoodFacts po kodzie: ${barcode}.`
        );
      } else {
        alert('Nie znaleziono produktu w bazie. Wpisz nazwę ręcznie.');
        await logEvent(
          'off_barcode_not_found',
          `Brak produktu w OpenFoodFacts dla kodu: ${barcode}.`
        );
      }
    } catch (err) {
      console.error(err);
      alert('Błąd podczas pobierania danych. Sprawdź połączenie.');
      await logEvent(
        'off_barcode_error',
        `Błąd podczas pobierania danych z OpenFoodFacts (kod: ${barcode}).`
      );
    }
  });
}

// ====== OpenFoodFacts: wyszukiwanie po nazwie (z loaderem) ======
let searchExistingTimeout = null;
let lastSearchTerm = '';

async function searchInOpenFoodFactsByName(term) {
  const q = term.trim();
  lastSearchTerm = q;

  if (!q) {
    searchExistingResults.innerHTML = '';
    return;
  }

  // Loader
  searchExistingResults.innerHTML = `
    <li class="list-item list-item--compact list-item--muted search-result-item loading">
      Szukam „${q}” w OpenFoodFacts...
    </li>
  `;

  if (!navigator.onLine) {
    searchExistingResults.innerHTML = `
      <li class="list-item list-item--muted">
        Brak połączenia – wyszukiwarka OpenFoodFacts wymaga internetu.
      </li>
    `;
    await logEvent(
      'off_search_offline',
      `Próba wyszukiwania w OpenFoodFacts bez połączenia: „${q}”.`
    );
    return;
  }

  // log: rozpoczęto wyszukiwanie
  await logEvent(
    'off_search_start',
    `Rozpoczęto wyszukiwanie w OpenFoodFacts: „${q}”.`
  );

  try {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?action=process&search_terms=${encodeURIComponent(
      q
    )}&page_size=10&json=1`;
    const res = await fetch(url);
    const data = await res.json();
    const products = Array.isArray(data.products) ? data.products : [];

    // Jeśli w międzyczasie użytkownik zmienił zapytanie, tej odpowiedzi już nie renderujemy
    if (q !== lastSearchTerm) return;

    if (!products.length) {
      searchExistingResults.innerHTML = `
        <li class="list-item list-item--muted">
          Nie znaleziono produktów dla: „${q}”. Spróbuj bardziej ogólnego hasła.
        </li>
      `;
      await logEvent(
        'off_search_no_results',
        `Brak wyników w OpenFoodFacts dla zapytania: „${q}”.`
      );
      return;
    }

    searchExistingResults.innerHTML = '';
    products.forEach(p => {
      const name =
        p.product_name_pl ||
        p.product_name ||
        p.generic_name_pl ||
        p.generic_name ||
        'Bez nazwy';
      const brand = p.brands || '';
      const barcode = p.code || '';

      const li = document.createElement('li');
      li.className = 'list-item list-item--compact search-result-item';

      li.innerHTML = `
        <div class="list-item-main">
          <div class="list-item-title-row">
            <strong>${name}</strong>
            <span class="product-brand">${brand || 'brak marki'}</span>
          </div>
          <div class="list-item-extra">
            Kod: ${barcode || 'brak'}
          </div>
        </div>
      `;

      li.addEventListener('click', () => {
        inputName.value = name;
        inputBrand.value = brand;
        inputBarcode.value = barcode;

        // log: kliknięcie wyniku i wypełnienie formularza
        logEvent(
          'off_search_fill',
          `Użyto wyszukiwarki OpenFoodFacts do wypełnienia formularza: ${name}.`
        );
      });

      searchExistingResults.appendChild(li);
    });
  } catch (err) {
    console.error('Błąd wyszukiwania OpenFoodFacts:', err);
    searchExistingResults.innerHTML = `
      <li class="list-item list-item--muted">
        Wystąpił błąd podczas wyszukiwania. Spróbuj ponownie później.
      </li>
    `;
    await logEvent(
      'off_search_error',
      `Błąd podczas wyszukiwania w OpenFoodFacts dla: „${q}”.`
    );
  }
}

if (searchExistingInput) {
  // Debounce przy wpisywaniu
  searchExistingInput.addEventListener('input', () => {
    const term = searchExistingInput.value;
    clearTimeout(searchExistingTimeout);
    searchExistingTimeout = setTimeout(() => {
      searchInOpenFoodFactsByName(term);
    }, 400);
  });

  // Enter = natychmiastowe wyszukiwanie
  searchExistingInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(searchExistingTimeout);
      searchInOpenFoodFactsByName(searchExistingInput.value);
    }
  });
}

// ====== Zapis / edycja produktu ======
function clearProductForm() {
  if (!inputBarcode) return;
  inputBarcode.value = '';
  inputName.value = '';
  inputBrand.value = '';
  inputExpiry.value = '';
  inputQuantity.value = 1;
  inputLocation.value = '';
}

function exitEditMode() {
  editingProductId = null;
  if (editHint) editHint.hidden = true;
}

if (btnSaveProduct) {
  btnSaveProduct.addEventListener('click', async () => {
    const productBase = {
      barcode: inputBarcode.value.trim() || null,
      name: inputName.value.trim(),
      brand: inputBrand.value.trim() || null,
      expiry: inputExpiry.value,
      quantity: Number(inputQuantity.value) || 1,
      location: inputLocation.value.trim(),
      createdAt: new Date().toISOString()
    };

    if (!productBase.name || !productBase.expiry || !productBase.location) {
      alert('Nazwa, data ważności i lokalizacja są wymagane.');
      return;
    }

    if (editingProductId != null) {
      const product = { ...productBase, id: editingProductId };
      await PantryDB.updateProduct(product);
      await logEvent(
        'product_update',
        `Zaktualizowano produkt: ${product.name} (lokalizacja: ${product.location}).`
      );
      alert('Produkt zaktualizowany.');
      exitEditMode();
    } else {
      await PantryDB.addProduct(productBase);
      await logEvent(
        'product_add',
        `Dodano produkt: ${productBase.name} (ilość: ${productBase.quantity}, lokalizacja: ${productBase.location}).`
      );
      alert('Produkt zapisany.');
    }

    clearProductForm();
    await refreshAll();
    setActiveView('pantry');
  });
}

// ====== Renderowanie listy spiżarni ======
async function renderPantry() {
  if (!pantryList) return;

  const products = await PantryDB.getAllProducts();
  const loc = (filterLocation?.value || '').trim().toLowerCase();
  const search = (filterSearch?.value || '').trim().toLowerCase();
  const sortVal = filterSort?.value || 'expiry-asc';

  let filtered = products.filter(p => {
    const matchesLoc = !loc || (p.location || '').toLowerCase().includes(loc);
    const text = `${p.name || ''} ${(p.brand || '')}`.toLowerCase();
    const matchesSearch = !search || text.includes(search);
    return matchesLoc && matchesSearch;
  });

  // Sortowanie
  filtered.sort((a, b) => {
    if (sortVal === 'name-asc') {
      return (a.name || '').localeCompare(b.name || '', 'pl');
    }
    if (sortVal === 'location-asc') {
      return (a.location || '').localeCompare(b.location || '', 'pl');
    }
    // expiry-asc (domyślnie)
    if (!a.expiry && !b.expiry) return 0;
    if (!a.expiry) return 1;
    if (!b.expiry) return -1;
    return a.expiry.localeCompare(b.expiry);
  });

  pantryList.innerHTML = '';

  if (filtered.length === 0) {
    const li = document.createElement('li');
    li.className = 'list-item list-item--muted';
    li.textContent = 'Brak produktów spełniających kryteria.';
    pantryList.appendChild(li);
    return;
  }

  filtered.forEach(p => {
    const li = document.createElement('li');
    li.className = 'list-item';

    const statusInfo = expiryStatus(p.expiry);

    const mainDiv = document.createElement('div');
    mainDiv.className = 'list-item-main';

    const titleRow = document.createElement('div');
    titleRow.className = 'list-item-title-row';
    const nameEl = document.createElement('strong');
    nameEl.textContent = p.name;
    const brandEl = document.createElement('span');
    brandEl.className = 'product-brand';
    brandEl.textContent = p.brand || 'brak marki';

    titleRow.appendChild(nameEl);
    titleRow.appendChild(brandEl);

    const metaRow = document.createElement('div');
    metaRow.className = 'list-item-meta';

    const locTag = document.createElement('span');
    locTag.className = 'tag-location';
    locTag.textContent = p.location || 'brak lokalizacji';

    const badge = document.createElement('span');
    badge.className = `badge badge--${statusInfo.type}`;
    badge.textContent = statusInfo.label;

    metaRow.appendChild(locTag);
    metaRow.appendChild(badge);

    const extra = document.createElement('div');
    extra.className = 'list-item-extra';
    extra.textContent = `Data ważności: ${p.expiry || 'brak'} · Ilość: ${
      p.quantity ?? 1
    }`;

    mainDiv.appendChild(titleRow);
    mainDiv.appendChild(metaRow);
    mainDiv.appendChild(extra);

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'list-item-actions';

    const btnUseOne = document.createElement('button');
    btnUseOne.className = 'btn-icon';
    btnUseOne.title = 'Zużyj 1 sztukę';
    btnUseOne.textContent = '−1';

    btnUseOne.addEventListener('click', async () => {
      const prevQty = p.quantity ?? 1;
      const qty = prevQty - 1;
      if (qty <= 0) {
        await PantryDB.deleteProduct(p.id);
        await PantryDB.addToShoppingList({
          name: p.name,
          brand: p.brand,
          barcode: p.barcode,
          source: 'used',
          status: 'pending',
          addedAt: new Date().toISOString()
        });
        await logEvent(
          'product_depleted',
          `Zużyto ostatnią sztukę: ${p.name} – dodano do listy zakupów.`
        );
      } else {
        const updated = { ...p, quantity: qty };
        await PantryDB.updateProduct(updated);
        await logEvent(
          'product_use_one',
          `Zużyto 1 sztukę: ${p.name}. Nowa ilość: ${qty}.`
        );
      }
      await refreshAll();
    });

    const btnEdit = document.createElement('button');
    btnEdit.className = 'btn-icon';
    btnEdit.title = 'Edytuj produkt';
    btnEdit.textContent = '✏';

    btnEdit.addEventListener('click', () => {
      editingProductId = p.id;
      inputBarcode.value = p.barcode || '';
      inputName.value = p.name || '';
      inputBrand.value = p.brand || '';
      inputExpiry.value = p.expiry || '';
      inputQuantity.value = p.quantity ?? 1;
      inputLocation.value = p.location || '';
      if (editHint) editHint.hidden = false;
      setActiveView('scanner');
    });

    const btnDelete = document.createElement('button');
    btnDelete.className = 'btn-icon btn-icon--danger';
    btnDelete.title = 'Usuń produkt';
    btnDelete.textContent = '🗑';

    btnDelete.addEventListener('click', async () => {
      if (confirm('Na pewno usunąć ten produkt ze spiżarni?')) {
        await PantryDB.deleteProduct(p.id);
        await logEvent('product_delete', `Usunięto produkt: ${p.name}.`);
        await refreshAll();
      }
    });

    const btnToShopping = document.createElement('button');
    btnToShopping.className = 'btn-small';
    btnToShopping.textContent = 'Do zakupów';

    btnToShopping.addEventListener('click', async () => {
      await PantryDB.addToShoppingList({
        name: p.name,
        brand: p.brand,
        barcode: p.barcode,
        source: 'manual',
        status: 'pending',
        addedAt: new Date().toISOString()
      });
      await logEvent(
        'shopping_add_manual',
        `Dodano do listy zakupów (z poziomu spiżarni): ${p.name}.`
      );
      alert('Dodano do listy zakupów.');
      await renderShopping();
    });

    actionsDiv.appendChild(btnUseOne);
    actionsDiv.appendChild(btnEdit);
    actionsDiv.appendChild(btnDelete);
    actionsDiv.appendChild(btnToShopping);

    li.appendChild(mainDiv);
    li.appendChild(actionsDiv);

    pantryList.appendChild(li);
  });
}

// ====== Render listy zakupów ======
async function renderShopping() {
  if (!shoppingListPending || !shoppingListDone) return;

  const items = await PantryDB.getShoppingList();

  const pending = items.filter(i => i.status !== 'done');
  const done = items.filter(i => i.status === 'done');

  // Do kupienia
  shoppingListPending.innerHTML = '';
  if (!pending.length) {
    const li = document.createElement('li');
    li.className = 'list-item list-item--muted';
    li.textContent = 'Lista „Do kupienia” jest pusta.';
    shoppingListPending.appendChild(li);
  } else {
    pending.forEach(i => {
      const li = document.createElement('li');
      li.className = 'list-item';

      const main = document.createElement('div');
      main.className = 'list-item-main';
      main.innerHTML = `
        <div class="list-item-title-row">
          <strong>${i.name}</strong>
          <span class="product-brand">${i.brand || 'brak marki'}</span>
        </div>
        <div class="list-item-extra">
          Dodano: ${new Date(i.addedAt || i.createdAt || new Date()).toLocaleString('pl-PL', {
            dateStyle: 'short',
            timeStyle: 'short'
          })}
        </div>
      `;

      const actions = document.createElement('div');
      actions.className = 'list-item-actions';

      const sourceBadge = document.createElement('span');
      let sourceClass = 'badge--source-manual';
      let sourceLabel = 'dodano ręcznie';
      if (i.source === 'used') {
        sourceClass = 'badge--source-used';
        sourceLabel = 'zużyty produkt';
      } else if (i.source === 'expired') {
        sourceClass = 'badge--source-expired';
        sourceLabel = 'przeterminowany';
      }
      sourceBadge.className = `badge ${sourceClass}`;
      sourceBadge.textContent = sourceLabel;

      const btnDone = document.createElement('button');
      btnDone.className = 'btn-small';
      btnDone.textContent = 'Kupione';

      btnDone.addEventListener('click', async () => {
        const updated = {
          ...i,
          status: 'done',
          doneAt: new Date().toISOString()
        };
        await PantryDB.updateShoppingItem(updated);
        await logEvent('shopping_mark_done', `Oznaczono jako kupione: ${i.name}.`);
        await renderShopping();
      });

      const btnDelete = document.createElement('button');
      btnDelete.className = 'btn-icon btn-icon--danger';
      btnDelete.textContent = '🗑';
      btnDelete.title = 'Usuń z listy zakupów';

      btnDelete.addEventListener('click', async () => {
        if (confirm(`Usunąć „${i.name}” z listy zakupów?`)) {
          await PantryDB.deleteShoppingItem(i.id);
          await logEvent(
            'shopping_delete_item',
            `Usunięto z listy zakupów: ${i.name}.`
          );
          await renderShopping();
        }
      });

      actions.appendChild(sourceBadge);
      actions.appendChild(btnDone);
      actions.appendChild(btnDelete);

      li.appendChild(main);
      li.appendChild(actions);

      shoppingListPending.appendChild(li);
    });
  }

  // Kupione (ostatnie 7 dni)
  shoppingListDone.innerHTML = '';
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const recentDone = done.filter(i => {
    if (!i.doneAt) return false;
    return new Date(i.doneAt) >= sevenDaysAgo;
  });

  if (!recentDone.length) {
    const li = document.createElement('li');
    li.className = 'list-item list-item--muted';
    li.textContent = 'Brak produktów oznaczonych jako kupione w ostatnich 7 dniach.';
    shoppingListDone.appendChild(li);
  } else {
    recentDone.forEach(i => {
      const li = document.createElement('li');
      li.className = 'list-item list-item--compact';

      const main = document.createElement('div');
      main.className = 'list-item-main';
      main.innerHTML = `
        <div class="list-item-title-row">
          <strong>${i.name}</strong>
          <span class="product-brand">${i.brand || 'brak marki'}</span>
        </div>
        <div class="list-item-extra">
          Kupione: ${new Date(i.doneAt).toLocaleString('pl-PL', {
            dateStyle: 'short',
            timeStyle: 'short'
          })}
        </div>
      `;

      const actions = document.createElement('div');
      actions.className = 'list-item-actions';

      const btnUndo = document.createElement('button');
      btnUndo.className = 'btn-small';
      btnUndo.textContent = 'Cofnij';

      btnUndo.addEventListener('click', async () => {
        const updated = {
          ...i,
          status: 'pending',
          doneAt: null
        };
        await PantryDB.updateShoppingItem(updated);
        await logEvent(
          'shopping_mark_pending',
          `Przywrócono do „Do kupienia”: ${i.name}.`
        );
        await renderShopping();
      });

      const btnDelete = document.createElement('button');
      btnDelete.className = 'btn-icon btn-icon--danger';
      btnDelete.textContent = '🗑';

      btnDelete.addEventListener('click', async () => {
        if (confirm(`Usunąć „${i.name}” z historii zakupów?`)) {
          await PantryDB.deleteShoppingItem(i.id);
          await logEvent(
            'shopping_delete_done',
            `Usunięto kupiony produkt z listy: ${i.name}.`
          );
          await renderShopping();
        }
      });

      actions.appendChild(btnUndo);
      actions.appendChild(btnDelete);

      li.appendChild(main);
      li.appendChild(actions);

      shoppingListDone.appendChild(li);
    });
  }

  // AI – szacunek kosztów na podstawie recentDone
  updateAIBasketInsights(recentDone);
}

// ====== AI: szacowanie kosztów + kategorie ======
function updateAIBasketInsights(recentDoneItems) {
  if (!window.FoodWatchAI || !aiCostValue || !aiCategoryGrid) return;

  const result = FoodWatchAI.estimateBasketFromShoppingList(recentDoneItems || []);
  const total = result.totalEstimate || 0;
  const count = result.count || 0;
  const byCategory = result.byCategory || [];

  aiCostValue.textContent = `~ ${total.toFixed(2)} zł`;
  aiCostHint.textContent =
    count > 0
      ? `Na podstawie ${count} produktów oznaczonych jako kupione w ostatnich 7 dniach.`
      : 'Brak danych – oznacz produkty jako kupione, aby zobaczyć szacunek.';

  aiCategoryGrid.innerHTML = '';
  if (!byCategory.length) {
    const div = document.createElement('div');
    div.className = 'card ai-category-card';
    div.textContent = 'Za mało danych, aby wyświetlić strukturę koszyka.';
    aiCategoryGrid.appendChild(div);
    return;
  }

  byCategory.forEach(cat => {
    const card = document.createElement('div');
    card.className = 'card ai-category-card';
    card.innerHTML = `
      <h3>
        <span class="ai-cat-emoji">${cat.emoji}</span>
        ${cat.label}
      </h3>
      <p class="stat-hint">
        Szacowany koszt: ~ ${cat.estimate.toFixed(2)} zł · ${cat.share}% koszyka
      </p>
      <div class="ai-cat-share-bar">
        <div class="ai-cat-share-fill" style="width: ${Math.min(
          cat.share,
          100
        )}%"></div>
      </div>
    `;
    aiCategoryGrid.appendChild(card);
  });
}

// ====== Dashboard ======
async function renderDashboard() {
  const products = await PantryDB.getAllProducts();

  const total = products.length;
  let soon = 0;
  let expired = 0;

  products.forEach(p => {
    const status = expiryStatus(p.expiry);
    if (status.type === 'soon') soon++;
    if (status.type === 'expired') expired++;
  });

  const risk = soon + expired;
  const riskPerc = total > 0 ? Math.round((risk / total) * 100) : 0;

  statTotal.textContent = total;
  statSoonExpiring.textContent = soon;
  statExpired.textContent = expired;
  statRiskPercentage.textContent = `${riskPerc}%`;
  riskProgressBar.style.width = `${Math.min(riskPerc, 100)}%`;
}

// ====== Historia alertów (z notifications.js) ======
function renderAlertHistory() {
  if (!window.FoodWatchAlerts) return;
  const history = window.FoodWatchAlerts.getAlertHistory();
  alertHistoryList.innerHTML = '';

  if (!history.length) {
    const li = document.createElement('li');
    li.className = 'list-item list-item--muted';
    li.textContent = 'Brak zarejestrowanych alertów – wszystko pod kontrolą.';
    alertHistoryList.appendChild(li);
    return;
  }

  history.forEach(entry => {
    const li = document.createElement('li');
    li.className = 'list-item list-item--compact';
    const date = new Date(entry.timestamp);
    const dateStr = date.toLocaleString('pl-PL', {
      dateStyle: 'short',
      timeStyle: 'short'
    });

    li.innerHTML = `
      <div class="list-item-main">
        <div><strong>${dateStr}</strong></div>
        <div class="list-item-extra">
          Przeterminowane: ${entry.expired} · Kończące się: ${entry.soon}
        </div>
      </div>
    `;
    alertHistoryList.appendChild(li);
  });
}

// ====== Historia działań (IndexedDB) ======
async function renderHistory() {
  if (!historyList || !PantryDB.getHistoryEntries) return;
  const entries = await PantryDB.getHistoryEntries(50);
  historyList.innerHTML = '';

  if (!entries.length) {
    const li = document.createElement('li');
    li.className = 'list-item list-item--muted';
    li.textContent = 'Brak zapisanej historii działań.';
    historyList.appendChild(li);
    return;
  }

  entries.forEach(e => {
    const li = document.createElement('li');
    li.className = 'list-item list-item--compact';
    const date = new Date(e.createdAt || new Date());
    const dateStr = date.toLocaleString('pl-PL', {
      dateStyle: 'short',
      timeStyle: 'short'
    });

    li.innerHTML = `
      <div class="list-item-main">
        <div><strong>${dateStr}</strong></div>
        <div class="list-item-extra">
          ${e.message || ''}
        </div>
      </div>
    `;
    historyList.appendChild(li);
  });
}

// ====== Eksport danych ======
if (btnExportData) {
  btnExportData.addEventListener('click', async () => {
    try {
      const products = await PantryDB.getAllProducts();
      const shopping = await PantryDB.getShoppingList();
      const history = await PantryDB.getHistoryEntries(500);

      const payload = {
        exportedAt: new Date().toISOString(),
        products,
        shopping,
        history
      };

      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = 'foodwatch-export.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      await logEvent('data_export', 'Wyeksportowano dane do pliku JSON.');
    } catch (err) {
      console.error('Błąd eksportu danych:', err);
      alert('Nie udało się wyeksportować danych.');
    }
  });
}

// ====== Toolbar zakupów: udostępnianie, sklepy, czyszczenie ======
if (btnShareShopping) {
  btnShareShopping.addEventListener('click', async () => {
    const items = await PantryDB.getShoppingList();
    const pending = items.filter(i => i.status !== 'done');

    if (!pending.length) {
      alert('Lista „Do kupienia” jest pusta.');
      return;
    }

    const lines = pending.map(
      (i, idx) => `${idx + 1}. ${i.name}${i.brand ? ' (' + i.brand + ')' : ''}`
    );
    const text = `Lista zakupów – FoodWatch:\n\n${lines.join('\n')}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'FoodWatch – lista zakupów',
          text
        });
      } catch (e) {
        console.warn('Udostępnianie przerwane:', e);
      }
    } else {
      alert(text);
    }
  });
}

if (btnFindStores) {
  btnFindStores.addEventListener('click', () => {
    if (!navigator.onLine) {
      alert('Brak połączenia – wyszukiwanie sklepów wymaga internetu.');
      return;
    }

    if (!navigator.geolocation) {
      alert('Geolokalizacja nie jest dostępna w tej przeglądarce.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        const url = `https://www.google.com/maps/search/sklep+spożywczy/@${latitude},${longitude},15z`;
        window.open(url, '_blank');
      },
      err => {
        console.warn('Błąd geolokalizacji:', err);
        alert('Nie udało się pobrać lokalizacji.');
      }
    );
  });
}

if (btnClearDone) {
  btnClearDone.addEventListener('click', async () => {
    const items = await PantryDB.getShoppingList();
    const done = items.filter(i => i.status === 'done');

    if (!done.length) {
      alert('Brak produktów oznaczonych jako kupione.');
      return;
    }

    if (!confirm('Usunąć wszystkie pozycje z sekcji „Kupione”?')) {
      return;
    }

    for (const i of done) {
      await PantryDB.deleteShoppingItem(i.id);
    }

    await logEvent(
      'shopping_clear_done',
      `Wyczyszczono ${done.length} pozycji z sekcji „Kupione”.`
    );
    await renderShopping();
  });
}

// ====== Refresh całości ======
async function refreshAll() {
  await renderPantry();
  await renderShopping();
  await renderDashboard();
  renderAlertHistory();
  await renderHistory();
  if (window.checkExpirationsAndNotify) {
    window.checkExpirationsAndNotify();
  }
}

// ====== Eventy UI filtrów ======
if (btnApplyFilter) {
  btnApplyFilter.addEventListener('click', renderPantry);
}

if (filterSearch) {
  filterSearch.addEventListener('input', renderPantry);
}

if (filterLocation) {
  filterLocation.addEventListener('input', renderPantry);
}

if (btnRefreshDashboard) {
  btnRefreshDashboard.addEventListener('click', () => {
    refreshAll();
  });
}

if (btnToggleInfo && infoPanel) {
  btnToggleInfo.addEventListener('click', () => {
    infoPanel.hidden = !infoPanel.hidden;
  });
}

// ====== Start ======
document.addEventListener('DOMContentLoaded', () => {
  updateOnlineStatus();
  refreshAll();
});
