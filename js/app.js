// js/app.js
// Główna logika FoodWatch: widoki, ustawienia, dashboard, statystyki, CRUD, zakupy

// ====== Service Worker ======
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("sw.js")
      .then((reg) => console.log("Service worker zarejestrowany", reg.scope))
      .catch((err) => console.error("SW error:", err));
  });
}

// ====== Nawigacja widoków ======
const navButtons = document.querySelectorAll(".nav-btn");
const views = document.querySelectorAll(".view");

function setActiveView(viewName) {
  views.forEach((v) => {
    if (v.id === `view-${viewName}`) {
      v.classList.add("view--active");
    } else {
      v.classList.remove("view--active");
    }
  });

  navButtons.forEach((btn) => {
    if (btn.dataset.view === viewName) {
      btn.classList.add("nav-btn--active");
    } else {
      btn.classList.remove("nav-btn--active");
    }
  });

  // lekkie dogranie danych przy wejściu
  if (viewName === "stats") {
    renderStats();
  } else if (viewName === "history") {
    renderHistory();
  } else if (viewName === "shopping") {
    renderShopping();
  }
}

navButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.view;
    setActiveView(target);
  });
});

// ====== Offline banner + status w nagłówku ======
const offlineBanner = document.getElementById("offline-banner");
const headerStatusPill = document.getElementById("header-status-pill");
const headerStatusText = document.getElementById("header-status-text");

function updateOnlineStatus() {
  const isOnline = navigator.onLine;

  // Banner na górze
  if (offlineBanner) {
    offlineBanner.hidden = isOnline;
  }

  // Pigułka statusu w nagłówku
  if (headerStatusPill && headerStatusText) {
    headerStatusPill.classList.toggle("header-pill--online", isOnline);
    headerStatusPill.classList.toggle("header-pill--offline", !isOnline);
    headerStatusText.textContent = isOnline ? "Online" : "Offline";
  }
}

window.addEventListener("online", updateOnlineStatus);
window.addEventListener("offline", updateOnlineStatus);

// ====== USTAWIENIA ======
const SETTINGS_KEY = "foodwatchSettings";

const defaultSettings = {
  notifyExpired: true,
  notifySoon: true,
  soonDaysThreshold: 3,
  checkIntervalHours: 12,
  theme: "auto", // auto / light / dark
  shelfPresets: "A1;A2;Lodówka;Zamrażarka",
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...defaultSettings };
    const parsed = JSON.parse(raw);
    return { ...defaultSettings, ...parsed };
  } catch {
    return { ...defaultSettings };
  }
}

let settings = loadSettings();

// DOM referencje ustawień
const inputNotifyExpired = document.getElementById("settings-notify-expired");
const inputNotifySoon = document.getElementById("settings-notify-soon");
const inputSoonDays = document.getElementById("settings-soon-days");
const selectCheckInterval = document.getElementById("settings-check-interval");
const selectTheme = document.getElementById("settings-theme");
const inputShelfPresets = document.getElementById("settings-shelf-presets");
const btnSettingsSave = document.getElementById("btn-settings-save");

function applyTheme(theme) {
  const prefersDark =
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;

  let mode = theme;
  if (theme === "auto") {
    mode = prefersDark ? "dark" : "light";
  }
  document.body.dataset.theme = mode;
}

function syncSettingsFormFromState() {
  if (inputNotifyExpired) inputNotifyExpired.checked = settings.notifyExpired;
  if (inputNotifySoon) inputNotifySoon.checked = settings.notifySoon;
  if (inputSoonDays) inputSoonDays.value = String(settings.soonDaysThreshold);
  if (selectCheckInterval)
    selectCheckInterval.value = String(settings.checkIntervalHours);
  if (selectTheme) selectTheme.value = settings.theme;
  if (inputShelfPresets) inputShelfPresets.value = settings.shelfPresets || "";
}

function saveSettingsFromForm() {
  settings.notifyExpired = !!inputNotifyExpired.checked;
  settings.notifySoon = !!inputNotifySoon.checked;
  const days = Number(inputSoonDays.value) || 3;
  settings.soonDaysThreshold = Math.max(1, Math.min(days, 14));
  settings.checkIntervalHours = Number(selectCheckInterval.value) || 12;
  settings.theme = selectTheme.value || "auto";
  settings.shelfPresets =
    inputShelfPresets.value || defaultSettings.shelfPresets;

  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));

  applyTheme(settings.theme);

  if (window.FoodWatchNotifications) {
    FoodWatchNotifications.setNotificationSettings({
      notifyExpired: settings.notifyExpired,
      notifySoon: settings.notifySoon,
      soonDaysThreshold: settings.soonDaysThreshold,
    });
  }

  buildLocationPresetsDatalist();

  alert("Ustawienia zapisane.");
}

if (btnSettingsSave) {
  btnSettingsSave.addEventListener("click", saveSettingsFromForm);
}

function buildLocationPresetsDatalist() {
  const datalist = document.getElementById("location-presets");
  if (!datalist) return;
  datalist.innerHTML = "";
  const parts = (settings.shelfPresets || "")
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean);
  parts.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p;
    datalist.appendChild(opt);
  });
}

// Zastosuj początkowo
applyTheme(settings.theme);

// ====== Referencje DOM & stan ======
let editingProductId = null;

const inputBarcode = document.getElementById("input-barcode");
const inputName = document.getElementById("input-name");
const inputBrand = document.getElementById("input-brand");
const inputExpiry = document.getElementById("input-expiry");
const inputQuantity = document.getElementById("input-quantity");
const inputLocation = document.getElementById("input-location");
const editHint = document.getElementById("edit-hint");

const pantryList = document.getElementById("pantry-list");

const statTotal = document.getElementById("stat-total");
const statSoonExpiring = document.getElementById("stat-soon-expiring");
const statExpired = document.getElementById("stat-expired");
const statRiskPercentage = document.getElementById("stat-risk-percentage");
const riskProgressBar = document.getElementById("risk-progress-bar");

const alertHistoryList = document.getElementById("alert-history-list");
const btnRefreshDashboard = document.getElementById("btn-refresh-dashboard");
const btnToggleInfo = document.getElementById("btn-toggle-info");
const infoPanel = document.getElementById("info-panel");

const btnFetchProduct = document.getElementById("btn-fetch-product");
const btnSaveProduct = document.getElementById("btn-save-product");

const filterLocation = document.getElementById("filter-location");
const filterSearch = document.getElementById("filter-search");
const filterSort = document.getElementById("filter-sort");
const btnApplyFilter = document.getElementById("btn-apply-filter");

// Shopping view
const shoppingListTodo = document.getElementById("shopping-list-todo");
const shoppingListBought = document.getElementById("shopping-list-bought");
const shoppingCountTodo = document.getElementById("shopping-count-todo");
const shoppingEstimateValue = document.getElementById("shopping-estimate");
const shoppingEstimateCaption = document.getElementById(
  "shopping-estimate-caption"
);
const shoppingAiBreakdown = document.getElementById("shopping-ai-breakdown");
const btnShoppingShare = document.getElementById("btn-shopping-share");
const btnShoppingNearby = document.getElementById("btn-shopping-nearby");
const btnShoppingClearBought = document.getElementById(
  "btn-shopping-clear-bought"
);

// Stats view
const statZeroScoreValue = document.getElementById("stat-zero-score-value");
const statZeroScoreLabel = document.getElementById("stat-zero-score-label");
const zeroScoreBar = document.getElementById("zero-score-bar");
const statAddedMonth = document.getElementById("stat-added-month");
const statUsedMonth = document.getElementById("stat-used-month");
const statExpiredMonth = document.getElementById("stat-expired-month");
const statWastedCategories = document.getElementById("stat-wasted-categories");
const statIdeasList = document.getElementById("stat-ideas-list");

// Historia
const historyList = document.getElementById("history-list");
const btnExportData = document.getElementById("btn-export-data");

// OFF search
const inputSearchExisting = document.getElementById("input-search-existing");
const searchExistingResults = document.getElementById(
  "search-existing-results"
);
const searchExistingStatus = document.getElementById("search-existing-status");
let searchExistingTimeout = null;

// ====== Status daty ważności ======
function expiryStatus(dateStr, soonDaysOverride) {
  if (!dateStr) return { label: "brak daty", type: "unknown" };

  const today = new Date();
  const expiry = new Date(dateStr + "T00:00:00");
  const diffDays = Math.floor((expiry - today) / (1000 * 60 * 60 * 24));
  const soonDays = soonDaysOverride ?? settings.soonDaysThreshold;

  if (diffDays < 0) return { label: "przeterminowany", type: "expired" };
  if (diffDays <= soonDays)
    return { label: "kończy się wkrótce", type: "soon" };
  return { label: "OK", type: "ok" };
}

// ====== OpenFoodFacts: pobranie produktu po kodzie ======
if (btnFetchProduct) {
  btnFetchProduct.addEventListener("click", async () => {
    const barcode = inputBarcode.value.trim();
    if (!barcode) {
      alert("Najpierw podaj kod kreskowy.");
      return;
    }

    try {
      const res = await fetch(
        `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`
      );
      const data = await res.json();

      if (data.status === 1) {
        const product = data.product;
        inputName.value = product.product_name || "";
        inputBrand.value = product.brands || "";
        await PantryDB.addHistoryEntry({
          type: "OFF_LOOKUP_CODE_SUCCESS",
          message: "Użyto wyszukiwania OpenFoodFacts po kodzie kreskowym",
          barcode,
        });
      } else {
        alert("Nie znaleziono produktu w bazie. Wpisz nazwę ręcznie.");
        await PantryDB.addHistoryEntry({
          type: "OFF_LOOKUP_CODE_EMPTY",
          message: "Brak produktu w OpenFoodFacts dla podanego kodu",
          barcode,
        });
      }
    } catch (err) {
      console.error(err);
      alert("Błąd podczas pobierania danych. Sprawdź połączenie.");
    }
  });
}

// ====== Wyszukiwanie OpenFoodFacts po nazwie ======
async function performOffSearchByName(query) {
  if (!query || query.length < 3) return;

  searchExistingStatus.textContent = "Wyszukiwanie w OpenFoodFacts...";
  searchExistingResults.innerHTML = "";

  try {
    const url =
      "https://world.openfoodfacts.org/cgi/search.pl?" +
      new URLSearchParams({
        search_terms: query,
        search_simple: "1",
        action: "process",
        json: "1",
        page_size: "8",
        fields: "product_name,brands,code,quantity",
      }).toString();

    const res = await fetch(url);
    const data = await res.json();
    const products = data.products || [];

    await PantryDB.addHistoryEntry({
      type: "OFF_SEARCH_NAME",
      message: "Użyto wyszukiwarki OpenFoodFacts po nazwie",
      query,
      resultsCount: products.length,
    });

    if (!products.length) {
      searchExistingStatus.textContent = "Brak wyników – spróbuj inną frazę.";
      return;
    }

    searchExistingStatus.textContent = "Wybierz produkt z listy:";

    products.forEach((p) => {
      const li = document.createElement("li");
      li.className = "list-item list-item--compact";
      const name = p.product_name || "Bez nazwy";
      const brand = p.brands || "";
      const code = p.code || "";
      const qty = p.quantity || "";

      li.innerHTML = `
        <div class="list-item-main">
          <div class="list-item-title-row">
            <strong>${name}</strong>
            <span class="product-brand">${brand || "brak marki"}</span>
          </div>
          <div class="list-item-extra">
            Kod: ${code || "brak"}${qty ? " · Opakowanie: " + qty : ""}
          </div>
        </div>
      `;

      li.addEventListener("click", async () => {
        inputName.value = name;
        inputBrand.value = brand;
        inputBarcode.value = code;
        searchExistingResults.innerHTML = "";
        searchExistingStatus.textContent = "Wybrano produkt z OpenFoodFacts.";
        await PantryDB.addHistoryEntry({
          type: "OFF_SEARCH_PICKED_RESULT",
          message: "Wybrano produkt z wyników wyszukiwarki",
          productName: name,
          productBrand: brand,
          barcode: code,
        });
      });

      searchExistingResults.appendChild(li);
    });
  } catch (e) {
    console.error(e);
    searchExistingStatus.textContent =
      "Błąd podczas wyszukiwania. Sprawdź połączenie.";
  }
}

if (inputSearchExisting) {
  inputSearchExisting.addEventListener("input", () => {
    const q = inputSearchExisting.value.trim();
    clearTimeout(searchExistingTimeout);

    if (q.length < 3) {
      searchExistingStatus.textContent = "Wpisz min. 3 znaki.";
      searchExistingResults.innerHTML = "";
      return;
    }

    searchExistingStatus.textContent = "Wpisujesz…";
    searchExistingTimeout = setTimeout(() => {
      performOffSearchByName(q);
    }, 350);
  });
}

// ====== Zapis / edycja produktu ======
function clearProductForm() {
  inputBarcode.value = "";
  inputName.value = "";
  inputBrand.value = "";
  inputExpiry.value = "";
  inputQuantity.value = 1;
  inputLocation.value = "";
}

function exitEditMode() {
  editingProductId = null;
  if (editHint) editHint.hidden = true;
}

if (btnSaveProduct) {
  btnSaveProduct.addEventListener("click", async () => {
    const productBase = {
      barcode: inputBarcode.value.trim() || null,
      name: inputName.value.trim(),
      brand: inputBrand.value.trim() || null,
      expiry: inputExpiry.value,
      quantity: Number(inputQuantity.value) || 1,
      location: inputLocation.value.trim(),
      createdAt: new Date().toISOString(),
    };

    if (!productBase.name || !productBase.expiry || !productBase.location) {
      alert("Nazwa, data ważności i lokalizacja są wymagane.");
      return;
    }

    if (editingProductId != null) {
      const product = { ...productBase, id: editingProductId };
      await PantryDB.updateProduct(product);
      await PantryDB.addHistoryEntry({
        type: "PRODUCT_UPDATED",
        message: "Zaktualizowano produkt w spiżarni",
        productName: product.name,
        productBrand: product.brand,
        expiry: product.expiry,
      });
      alert("Produkt zaktualizowany.");
      exitEditMode();
    } else {
      await PantryDB.addProduct(productBase);
      await PantryDB.addHistoryEntry({
        type: "PRODUCT_ADDED",
        message: "Dodano produkt do spiżarni",
        productName: productBase.name,
        productBrand: productBase.brand,
        expiry: productBase.expiry,
      });
      alert("Produkt zapisany.");
    }

    clearProductForm();
    await refreshAll();
    setActiveView("pantry");
  });
}

// ====== Renderowanie listy spiżarni ======
async function renderPantry() {
  const products = await PantryDB.getAllProducts();
  const loc = (filterLocation.value || "").trim().toLowerCase();
  const search = (filterSearch.value || "").trim().toLowerCase();
  const sortVal = filterSort.value;

  let filtered = products.filter((p) => {
    const matchesLoc = !loc || (p.location || "").toLowerCase().includes(loc);
    const text = `${p.name || ""} ${(p.brand || "")}`.toLowerCase();
    const matchesSearch = !search || text.includes(search);
    return matchesLoc && matchesSearch;
  });

  filtered.sort((a, b) => {
    if (sortVal === "name-asc") {
      return (a.name || "").localeCompare(b.name || "", "pl");
    }
    if (sortVal === "location-asc") {
      return (a.location || "").localeCompare(b.location || "", "pl");
    }
    if (!a.expiry && !b.expiry) return 0;
    if (!a.expiry) return 1;
    if (!b.expiry) return -1;
    return a.expiry.localeCompare(b.expiry);
  });

  pantryList.innerHTML = "";

  if (filtered.length === 0) {
    const li = document.createElement("li");
    li.className = "list-item list-item--muted";
    li.textContent = "Brak produktów spełniających kryteria.";
    pantryList.appendChild(li);
    return;
  }

  filtered.forEach((p) => {
    const li = document.createElement("li");
    li.className = "list-item";

    const statusInfo = expiryStatus(p.expiry);

    const mainDiv = document.createElement("div");
    mainDiv.className = "list-item-main";

    const titleRow = document.createElement("div");
    titleRow.className = "list-item-title-row";
    const nameEl = document.createElement("strong");
    nameEl.textContent = p.name;
    const brandEl = document.createElement("span");
    brandEl.className = "product-brand";
    brandEl.textContent = p.brand || "brak marki";

    titleRow.appendChild(nameEl);
    titleRow.appendChild(brandEl);

    const metaRow = document.createElement("div");
    metaRow.className = "list-item-meta";

    const locTag = document.createElement("span");
    locTag.className = "tag-location";
    locTag.textContent = p.location || "brak lokalizacji";

    const badge = document.createElement("span");
    badge.className = `badge badge--${statusInfo.type}`;
    badge.textContent = statusInfo.label;

    metaRow.appendChild(locTag);
    metaRow.appendChild(badge);

    const extra = document.createElement("div");
    extra.className = "list-item-extra";
    extra.textContent = `Data ważności: ${p.expiry || "brak"} · Ilość: ${
      p.quantity ?? 1
    }`;

    mainDiv.appendChild(titleRow);
    mainDiv.appendChild(metaRow);
    mainDiv.appendChild(extra);

    const actionsDiv = document.createElement("div");
    actionsDiv.className = "list-item-actions";

    const btnUseOne = document.createElement("button");
    btnUseOne.className = "btn-secondary";
    btnUseOne.title = "Zużyj 1 sztukę";
    btnUseOne.textContent = "Zużyj 1";

    btnUseOne.addEventListener("click", async () => {
      const qty = (p.quantity ?? 1) - 1;
      if (qty <= 0) {
        await PantryDB.deleteProduct(p.id);
        await PantryDB.addToShoppingList({
          name: p.name,
          brand: p.brand,
          barcode: p.barcode,
          source: "used_to_zero",
        });
        await PantryDB.addHistoryEntry({
          type: "PRODUCT_FINISHED_TO_SHOPPING",
          message: "Produkt zużyty – przeniesiony na listę zakupów",
          productName: p.name,
          productBrand: p.brand,
        });
      } else {
        const updated = { ...p, quantity: qty };
        await PantryDB.updateProduct(updated);
        await PantryDB.addHistoryEntry({
          type: "PRODUCT_USED_ONE",
          message: "Zużyto 1 sztukę produktu",
          productName: p.name,
          productBrand: p.brand,
        });
      }
      await refreshAll();
    });

    const btnEdit = document.createElement("button");
    btnEdit.className = "btn-secondary";
    btnEdit.title = "Edytuj produkt";
    btnEdit.textContent = "Edytuj";

    btnEdit.addEventListener("click", () => {
      editingProductId = p.id;
      inputBarcode.value = p.barcode || "";
      inputName.value = p.name || "";
      inputBrand.value = p.brand || "";
      inputExpiry.value = p.expiry || "";
      inputQuantity.value = p.quantity ?? 1;
      inputLocation.value = p.location || "";
      if (editHint) editHint.hidden = false;
      setActiveView("scanner");
    });

    const btnDelete = document.createElement("button");
    btnDelete.className = "btn-secondary";
    btnDelete.title = "Usuń produkt";
    btnDelete.textContent = "Usuń";

    btnDelete.addEventListener("click", async () => {
      if (confirm("Na pewno usunąć ten produkt ze spiżarni?")) {
        await PantryDB.deleteProduct(p.id);
        await PantryDB.addHistoryEntry({
          type: "PRODUCT_DELETED",
          message: "Usunięto produkt ze spiżarni",
          productName: p.name,
          productBrand: p.brand,
        });
        await refreshAll();
      }
    });

    const btnToShopping = document.createElement("button");
    btnToShopping.className = "btn-secondary";
    btnToShopping.textContent = "Do zakupów";

    btnToShopping.addEventListener("click", async () => {
      await PantryDB.addToShoppingList({
        name: p.name,
        brand: p.brand,
        barcode: p.barcode,
        source: "manual",
      });
      await PantryDB.addHistoryEntry({
        type: "PRODUCT_MANUAL_TO_SHOPPING",
        message: "Ręcznie dodano produkt do listy zakupów",
        productName: p.name,
        productBrand: p.brand,
      });
      alert("Dodano do listy zakupów.");
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
  const items = await PantryDB.getShoppingList();
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const todo = items.filter((i) => i.status !== "bought");
  const boughtRecent = items.filter(
    (i) =>
      i.status === "bought" &&
      i.boughtAt &&
      new Date(i.boughtAt) >= sevenDaysAgo
  );

  // AI szacowanie kosztu – na podstawie pozycji DO KUPIENIA
  let estimate = {
    totalEstimate: 0,
    count: 0,
    byCategory: [],
  };
  if (window.FoodWatchAI) {
    estimate = FoodWatchAI.estimateBasketFromShoppingList(todo);
  }

  // UI – podsumowanie
  if (shoppingCountTodo) {
    shoppingCountTodo.textContent = todo.length.toString();
  }
  if (shoppingEstimateValue) {
    const total = Math.round(estimate.totalEstimate);
    shoppingEstimateValue.textContent = `${total || 0} zł`;
  }
  if (shoppingEstimateCaption) {
    if (estimate.count === 0) {
      shoppingEstimateCaption.textContent =
        "Dodaj produkty do listy, aby zobaczyć szacunkowy koszt.";
    } else {
      shoppingEstimateCaption.textContent = `Na podstawie ${
        estimate.count
      } rozpoznanych pozycji z listy „Do kupienia”.`;
    }
  }

  // Rozbicie na kategorie
  if (shoppingAiBreakdown) {
    shoppingAiBreakdown.innerHTML = "";
    if (estimate.byCategory && estimate.byCategory.length) {
      estimate.byCategory.forEach((cat) => {
        const div = document.createElement("div");
        div.className = "shopping-ai-chip";
        div.textContent = `${cat.emoji} ${cat.label}: ~${Math.round(
          cat.estimate
        )} zł (${cat.share}%)`;
        shoppingAiBreakdown.appendChild(div);
      });
    }
  }

  // Listy
  shoppingListTodo.innerHTML = "";
  shoppingListBought.innerHTML = "";

  if (!todo.length) {
    const li = document.createElement("li");
    li.className = "list-item list-item--muted";
    li.textContent = "Lista zakupów jest pusta.";
    shoppingListTodo.appendChild(li);
  } else {
    todo.forEach((i) => {
      const li = document.createElement("li");
      li.className = "list-item";
      const main = document.createElement("div");
      main.className = "list-item-main";
      main.innerHTML = `
        <div class="list-item-title-row">
          <strong>${i.name}</strong>
          <span class="product-brand">${i.brand || "brak marki"}</span>
        </div>
      `;
      const actions = document.createElement("div");
      actions.className = "list-item-actions";

      const btnBought = document.createElement("button");
      btnBought.className = "btn-secondary";
      btnBought.textContent = "Kupione";
      btnBought.addEventListener("click", async () => {
        i.status = "bought";
        i.boughtAt = new Date().toISOString();
        await PantryDB.updateShoppingItem(i);
        await PantryDB.addHistoryEntry({
          type: "SHOPPING_MARKED_BOUGHT",
          message: "Oznaczono produkt jako kupiony",
          productName: i.name,
          productBrand: i.brand,
        });
        await renderShopping();
        await renderDashboard();
      });

      const btnDelete = document.createElement("button");
      btnDelete.className = "btn-secondary";
      btnDelete.textContent = "Usuń";
      btnDelete.addEventListener("click", async () => {
        if (confirm("Usunąć ten produkt z listy zakupów?")) {
          await PantryDB.deleteShoppingItem(i.id);
          await PantryDB.addHistoryEntry({
            type: "SHOPPING_DELETED",
            message: "Usunięto produkt z listy zakupów",
            productName: i.name,
            productBrand: i.brand,
          });
          await renderShopping();
        }
      });

      actions.appendChild(btnBought);
      actions.appendChild(btnDelete);

      li.appendChild(main);
      li.appendChild(actions);
      shoppingListTodo.appendChild(li);
    });
  }

  if (!boughtRecent.length) {
    const li = document.createElement("li");
    li.className = "list-item list-item--muted";
    li.textContent = "Brak kupionych produktów z ostatnich 7 dni.";
    shoppingListBought.appendChild(li);
  } else {
    boughtRecent.forEach((i) => {
      const li = document.createElement("li");
      li.className = "list-item list-item--compact";
      const dt = i.boughtAt ? new Date(i.boughtAt) : null;
      li.innerHTML = `
        <div class="list-item-main">
          <div class="list-item-title-row">
            <strong>${i.name}</strong>
            <span class="product-brand">${i.brand || "brak marki"}</span>
          </div>
          <div class="list-item-extra">
            Kupione: ${
              dt
                ? dt.toLocaleString("pl-PL", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })
                : "-"
            }
          </div>
        </div>
      `;
      shoppingListBought.appendChild(li);
    });
  }
}

// Akcje shopping
if (btnShoppingShare) {
  btnShoppingShare.addEventListener("click", async () => {
    const items = await PantryDB.getShoppingList();
    const todo = items.filter((i) => i.status !== "bought");
    if (!todo.length) {
      alert("Lista zakupów jest pusta.");
      return;
    }
    const lines = todo.map((i) => `• ${i.name} (${i.brand || "brak marki"})`);
    const text = `Lista zakupów – FoodWatch:\n\n${lines.join("\n")}`;

    try {
      if (navigator.share) {
        await navigator.share({ text });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        alert("Skopiowano listę do schowka.");
      } else {
        alert(text);
      }
      await PantryDB.addHistoryEntry({
        type: "SHOPPING_SHARED",
        message: "Udostępniono listę zakupów",
      });
    } catch (e) {
      console.warn("Udostępnianie przerwane:", e);
    }
  });
}

if (btnShoppingNearby) {
  btnShoppingNearby.addEventListener("click", async () => {
    if (!navigator.geolocation) {
      alert("Geolokalizacja nie jest obsługiwana w tej przeglądarce.");
      return;
    }
    if (!navigator.onLine) {
      alert("Wymagane jest połączenie z internetem, aby otworzyć mapę.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const url = `https://www.google.com/maps/search/sklep+spożywczy/@${latitude},${longitude},15z`;
        window.open(url, "_blank");
      },
      (err) => {
        console.error(err);
        alert("Nie udało się pobrać lokalizacji.");
      }
    );
  });
}

if (btnShoppingClearBought) {
  btnShoppingClearBought.addEventListener("click", async () => {
    const items = await PantryDB.getShoppingList();
    const bought = items.filter((i) => i.status === "bought");
    if (!bought.length) {
      alert("Brak produktów oznaczonych jako kupione.");
      return;
    }
    if (!confirm("Usunąć wszystkie produkty oznaczone jako kupione?")) return;

    for (const i of bought) {
      await PantryDB.deleteShoppingItem(i.id);
    }
    await PantryDB.addHistoryEntry({
      type: "SHOPPING_CLEAR_BOUGHT",
      message: "Wyczyszczono listę kupionych produktów",
    });
    await renderShopping();
  });
}

// ====== Dashboard ======
async function renderDashboard() {
  const products = await PantryDB.getAllProducts();

  const total = products.length;
  let soon = 0;
  let expired = 0;

  products.forEach((p) => {
    const status = expiryStatus(p.expiry);
    if (status.type === "soon") soon++;
    if (status.type === "expired") expired++;
  });

  const risk = soon + expired;
  const riskPerc = total > 0 ? Math.round((risk / total) * 100) : 0;

  statTotal.textContent = total;
  statSoonExpiring.textContent = soon;
  statExpired.textContent = expired;
  statRiskPercentage.textContent = `${riskPerc}%`;
  riskProgressBar.style.width = `${Math.min(riskPerc, 100)}%`;
}

// ====== Historia alertów ======
function renderAlertHistory() {
  if (!window.FoodWatchNotifications) return;

  // Maksymalnie 5 ostatnich wpisów
  const history = window.FoodWatchNotifications.getAlertHistory().slice(0, 5);
  alertHistoryList.innerHTML = "";

  if (!history.length) {
    const li = document.createElement("li");
    li.className = "list-item list-item--muted";
    li.textContent = "Brak zarejestrowanych alertów – wszystko pod kontrolą.";
    alertHistoryList.appendChild(li);
    return;
  }

  history.forEach((entry) => {
    const li = document.createElement("li");
    li.className = "list-item list-item--compact";
    const date = new Date(entry.timestamp);
    const dateStr = date.toLocaleString("pl-PL", {
      dateStyle: "short",
      timeStyle: "short",
    });

    li.innerHTML = `
      <div class="list-item-main">
        <strong>${dateStr}</strong>
        <div class="list-item-extra">
          Przeterminowane: ${entry.expired} · Kończące się: ${entry.soon}
        </div>
      </div>
    `;
    alertHistoryList.appendChild(li);
  });
}

// ====== Historia operacji (IndexedDB) ======
async function renderHistory() {
  const entries = await PantryDB.getHistory(15);
  historyList.innerHTML = "";

  if (!entries.length) {
    const li = document.createElement("li");
    li.className = "list-item list-item--muted";
    li.textContent = "Brak zarejestrowanych operacji.";
    historyList.appendChild(li);
    return;
  }

  entries.forEach((e) => {
    const li = document.createElement("li");
    li.className = "list-item list-item--compact";
    const dt = e.createdAt ? new Date(e.createdAt) : null;
    const dateStr = dt
      ? dt.toLocaleString("pl-PL", {
          dateStyle: "short",
          timeStyle: "short",
        })
      : "";

    const main = document.createElement("div");
    main.className = "list-item-main";
    const title = document.createElement("strong");
    title.textContent = e.message || e.type || "Operacja";

    const meta = document.createElement("div");
    meta.className = "history-meta";
    meta.textContent = dateStr;

    main.appendChild(title);
    main.appendChild(meta);

    historyList.appendChild(li);
    li.appendChild(main);
  });
}

// Eksport danych
if (btnExportData) {
  btnExportData.addEventListener("click", async () => {
    const [products, shopping, history] = await Promise.all([
      PantryDB.getAllProducts(),
      PantryDB.getShoppingList(),
      PantryDB.getHistory(1000),
    ]);

    const exportObj = {
      exportedAt: new Date().toISOString(),
      products,
      shopping,
      history,
    };

    const blob = new Blob([JSON.stringify(exportObj, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `foodwatch-export-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    await PantryDB.addHistoryEntry({
      type: "DATA_EXPORTED",
      message: "Wyeksportowano dane do pliku JSON",
    });
  });
}

// ====== Statystyki / Zero waste ======
const ZERO_WASTE_USED_TYPES = [
  "PRODUCT_USED_ONE",
  "PRODUCT_FINISHED_TO_SHOPPING",
];
const ZERO_WASTE_EXPIRED_TYPES = ["PRODUCT_EXPIRED_TO_SHOPPING"];

const IDEAS_BY_CATEGORY = {
  Nabiał: ["Naleśniki z twarogiem", "Makaron w sosie śmietanowym"],
  Pieczywo: ["Grzanki z czosnkiem", "Zapiekanki z pieczywa"],
  Warzywa: ["Zupa krem z warzyw", "Leczo warzywne"],
  Owoce: ["Sałatka owocowa", "Smoothie owocowe"],
  "Słodycze i przekąski": ["Deser warstwowy", "Domowe lody z dodatkami"],
};

async function renderStats() {
  const [history, products] = await Promise.all([
    PantryDB.getHistory(1000),
    PantryDB.getAllProducts(),
  ]);

  // Zero waste score
  const totalUsed = history.filter((e) =>
    ZERO_WASTE_USED_TYPES.includes(e.type)
  ).length;
  const totalExpired = history.filter((e) =>
    ZERO_WASTE_EXPIRED_TYPES.includes(e.type)
  ).length;
  const totalRelevant = totalUsed + totalExpired;

  let score = 0;
  if (totalRelevant > 0) {
    score = Math.round((totalUsed / totalRelevant) * 100);
  }
  statZeroScoreValue.textContent = `${score}%`;

  if (totalRelevant === 0) {
    statZeroScoreLabel.textContent =
      "Brak danych – zużywaj produkty i oznaczaj ruchy, aby zobaczyć statystyki.";
  } else if (score >= 80) {
    statZeroScoreLabel.textContent =
      "Świetnie! Marnujesz bardzo mało jedzenia.";
  } else if (score >= 50) {
    statZeroScoreLabel.textContent =
      "Jest dobrze, ale można jeszcze trochę poprawić zużycie produktów.";
  } else {
    statZeroScoreLabel.textContent =
      "Uwaga – sporo produktów się marnuje. Warto przejrzeć spiżarnię.";
  }
  zeroScoreBar.style.width = `${score}%`;

  // Ten miesiąc
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const monthAdded = history.filter(
    (e) =>
      e.type === "PRODUCT_ADDED" &&
      e.createdAt &&
      new Date(e.createdAt) >= startOfMonth
  ).length;
  const monthUsed = history.filter(
    (e) =>
      ZERO_WASTE_USED_TYPES.includes(e.type) &&
      e.createdAt &&
      new Date(e.createdAt) >= startOfMonth
  ).length;
  const monthExpired = history.filter(
    (e) =>
      ZERO_WASTE_EXPIRED_TYPES.includes(e.type) &&
      e.createdAt &&
      new Date(e.createdAt) >= startOfMonth
  ).length;

  statAddedMonth.textContent = monthAdded.toString();
  statUsedMonth.textContent = monthUsed.toString();
  statExpiredMonth.textContent = monthExpired.toString();

  // Najczęściej marnowane kategorie
  const wastedEntries = history.filter((e) =>
    ZERO_WASTE_EXPIRED_TYPES.includes(e.type)
  );
  const catCounts = new Map();

  wastedEntries.forEach((e) => {
    const cat = window.FoodWatchAI
      ? FoodWatchAI.getCategoryForName(e.productName, e.productBrand)
      : null;
    const key = cat?.category || "Inne";
    const emoji = cat?.emoji || "🗑️";
    const prev = catCounts.get(key) || { label: key, emoji, count: 0 };
    prev.count += 1;
    catCounts.set(key, prev);
  });

  statWastedCategories.innerHTML = "";
  if (!catCounts.size) {
    const li = document.createElement("li");
    li.textContent = "Brak danych o marnowaniu – tak trzymać!";
    statWastedCategories.appendChild(li);
  } else {
    const arr = Array.from(catCounts.values()).sort((a, b) => b.count - a.count);
    arr.slice(0, 4).forEach((c) => {
      const li = document.createElement("li");
      li.textContent = `${c.emoji} ${c.label}: ${c.count} razy`;
      statWastedCategories.appendChild(li);
    });
  }

  // Pomysły na wykorzystanie – na podstawie produktów "soon"
  const soonProducts = products.filter((p) => {
    const st = expiryStatus(p.expiry);
    return st.type === "soon";
  });

  const ideasMap = new Map();
  soonProducts.forEach((p) => {
    const cat = window.FoodWatchAI
      ? FoodWatchAI.getCategoryForName(p.name, p.brand)
      : null;
    const key = cat?.category || "Inne";
    const ideas = IDEAS_BY_CATEGORY[key];
    if (!ideas || !ideas.length) return;
    if (!ideasMap.has(key)) {
      ideasMap.set(key, { emoji: cat?.emoji || "🍽️", ideas: new Set() });
    }
    const set = ideasMap.get(key).ideas;
    ideas.forEach((idea) => set.add(idea));
  });

  statIdeasList.innerHTML = "";
  if (!ideasMap.size) {
    const li = document.createElement("li");
    li.textContent =
      "Brak produktów z kończącym się terminem albo brak przypisanej kategorii.";
    statIdeasList.appendChild(li);
  } else {
    ideasMap.forEach((val, key) => {
      const li = document.createElement("li");
      li.innerHTML = `<strong>${val.emoji} ${key}</strong>`;
      const ul = document.createElement("ul");
      ul.style.margin = "0.2rem 0 0";
      ul.style.paddingLeft = "1rem";
      Array.from(val.ideas)
        .slice(0, 3)
        .forEach((idea) => {
          const sub = document.createElement("li");
          sub.textContent = idea;
          ul.appendChild(sub);
        });
      li.appendChild(ul);
      statIdeasList.appendChild(li);
    });
  }
}

// ====== Refresh całości ======
async function refreshAll() {
  await Promise.all([
    renderPantry(),
    renderShopping(),
    renderDashboard(),
    renderHistory(),
    renderStats(),
  ]);

  if (window.FoodWatchNotifications) {
    FoodWatchNotifications.setNotificationSettings({
      notifyExpired: settings.notifyExpired,
      notifySoon: settings.notifySoon,
      soonDaysThreshold: settings.soonDaysThreshold,
    });
    FoodWatchNotifications.checkExpirationsAndNotify();
  }

  renderAlertHistory();
}

// ====== Eventy UI ======
if (btnApplyFilter) {
  btnApplyFilter.addEventListener("click", renderPantry);
}

if (filterSearch) {
  filterSearch.addEventListener("input", renderPantry);
}

if (filterLocation) {
  filterLocation.addEventListener("input", renderPantry);
}

if (btnRefreshDashboard) {
  btnRefreshDashboard.addEventListener("click", () => {
    refreshAll();
  });
}

if (btnToggleInfo && infoPanel) {
  btnToggleInfo.addEventListener("click", () => {
    infoPanel.hidden = !infoPanel.hidden;
  });
}

// ====== Auto sprawdzanie terminów, gdy aplikacja jest otwarta ======
function setupAutoExpiryCheck() {
  if (!window.FoodWatchNotifications) return;
  const hours = settings.checkIntervalHours || 12;
  const intervalMs = hours * 60 * 60 * 1000;

  setInterval(() => {
    if (document.visibilityState === "visible") {
      FoodWatchNotifications.checkExpirationsAndNotify();
    }
  }, intervalMs);
}

// ====== Start ======
document.addEventListener("DOMContentLoaded", () => {
  updateOnlineStatus();
  syncSettingsFormFromState();
  buildLocationPresetsDatalist();
  refreshAll();
  setupAutoExpiryCheck();
});
