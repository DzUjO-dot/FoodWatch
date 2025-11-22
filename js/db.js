// js/db.js
// Warstwa nad IndexedDB dla FoodWatch – produkty, lista zakupów, historia działań

const DB_NAME = 'foodwatch-db';
const DB_VERSION = 3;
let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = event => {
      const db = event.target.result;

      // Produkty
      if (!db.objectStoreNames.contains('products')) {
        const store = db.createObjectStore('products', {
          keyPath: 'id',
          autoIncrement: true
        });
        store.createIndex('by_barcode', 'barcode', { unique: false });
        store.createIndex('by_expiry', 'expiry', { unique: false });
        store.createIndex('by_location', 'location', { unique: false });
      }

      // Lista zakupów
      if (!db.objectStoreNames.contains('shopping')) {
        const shoppingStore = db.createObjectStore('shopping', {
          keyPath: 'id',
          autoIncrement: true
        });
        shoppingStore.createIndex('by_status', 'status', { unique: false });
        shoppingStore.createIndex('by_addedAt', 'addedAt', { unique: false });
      }

      // Historia działań
      if (!db.objectStoreNames.contains('history')) {
        const historyStore = db.createObjectStore('history', {
          keyPath: 'id',
          autoIncrement: true
        });
        historyStore.createIndex('by_createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

// ===== Produkty =====

async function addProduct(product) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('products', 'readwrite');
    const store = tx.objectStore('products');
    const data = {
      ...product
    };
    store.add(data);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getAllProducts() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('products', 'readonly');
    const req = tx.objectStore('products').getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function updateProduct(product) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('products', 'readwrite');
    tx.objectStore('products').put(product);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function deleteProduct(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('products', 'readwrite');
    tx.objectStore('products').delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ===== Lista zakupów =====

async function addToShoppingList(item) {
  const db = await openDb();
  const base = {
    name: item.name || '',
    brand: item.brand || '',
    barcode: item.barcode || null,
    source: item.source || 'manual', // manual | used | expired
    status: item.status || 'pending', // pending | done
    addedAt: item.addedAt || new Date().toISOString(),
    doneAt: item.doneAt || null,
    category: item.category || null
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction('shopping', 'readwrite');
    tx.objectStore('shopping').add(base);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getShoppingList() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('shopping', 'readonly');
    const req = tx.objectStore('shopping').getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function updateShoppingItem(item) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('shopping', 'readwrite');
    tx.objectStore('shopping').put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function deleteShoppingItem(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('shopping', 'readwrite');
    tx.objectStore('shopping').delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ===== Historia działań =====

async function addHistoryEntry(entry) {
  const db = await openDb();
  const data = {
    type: entry.type || 'info',
    message: entry.message || '',
    createdAt: entry.createdAt || new Date().toISOString()
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction('history', 'readwrite');
    tx.objectStore('history').add(data);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getHistoryEntries(limit = 50) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('history', 'readonly');
    const store = tx.objectStore('history').index('by_createdAt');
    const req = store.getAll();

    req.onsuccess = () => {
      const all = (req.result || []).sort((a, b) =>
        (b.createdAt || '').localeCompare(a.createdAt || '')
      );
      resolve(all.slice(0, limit));
    };
    req.onerror = () => reject(req.error);
  });
}

window.PantryDB = {
  addProduct,
  getAllProducts,
  updateProduct,
  deleteProduct,
  addToShoppingList,
  getShoppingList,
  updateShoppingItem,
  deleteShoppingItem,
  addHistoryEntry,
  getHistoryEntries
};
