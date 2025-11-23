// js/db.js
// Warstwa nad IndexedDB dla FoodWatch: produkty, zakupy, historia działań

const DB_NAME = 'foodwatch-db';
const DB_VERSION = 3;
let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = event => {
      const db = event.target.result;

      // Produkty w spiżarni
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
        db.createObjectStore('shopping', {
          keyPath: 'id',
          autoIncrement: true
        });
      }

      // Historia operacji
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

// ===== Helpery ogólne =====

async function getAllFromStore(storeName) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function putToStore(storeName, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function addToStore(storeName, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).add(value);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function deleteFromStore(storeName, id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ===== Produkty =====

async function addProduct(product) {
  const withMeta = {
    ...product,
    createdAt: product.createdAt || new Date().toISOString()
  };
  await addToStore('products', withMeta);
}

async function getAllProducts() {
  return getAllFromStore('products');
}

async function updateProduct(product) {
  await putToStore('products', product);
}

async function deleteProduct(id) {
  await deleteFromStore('products', id);
}

// ===== Zakupy =====

async function addToShoppingList(item) {
  const withMeta = {
    ...item,
    status: item.status || 'todo',
    createdAt: item.createdAt || new Date().toISOString(),
    boughtAt: item.boughtAt || null
  };
  await addToStore('shopping', withMeta);
}

async function getShoppingList() {
  return getAllFromStore('shopping');
}

async function updateShoppingItem(item) {
  await putToStore('shopping', item);
}

async function deleteShoppingItem(id) {
  await deleteFromStore('shopping', id);
}

// ===== Historia =====

async function addHistoryEntry(entry) {
  const withMeta = {
    ...entry,
    createdAt: entry.createdAt || new Date().toISOString()
  };
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('history', 'readwrite');
    tx.objectStore('history').add(withMeta);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getHistory(limit = 100) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('history', 'readonly');
    const store = tx.objectStore('history');
    let req;
    if (store.indexNames.contains('by_createdAt')) {
      req = store.index('by_createdAt').getAll();
    } else {
      req = store.getAll();
    }
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
  getHistory
};
