// js/db.js

const DB_NAME = 'pantry-db';
const DB_VERSION = 1;
let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = event => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains('products')) {
        const store = db.createObjectStore('products', {
          keyPath: 'id',
          autoIncrement: true
        });
        store.createIndex('by_barcode', 'barcode', { unique: false });
        store.createIndex('by_expiry', 'expiry', { unique: false });
        store.createIndex('by_location', 'location', { unique: false });
      }

      if (!db.objectStoreNames.contains('shopping')) {
        db.createObjectStore('shopping', {
          keyPath: 'id',
          autoIncrement: true
        });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

async function addProduct(product) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('products', 'readwrite');
    tx.objectStore('products').add(product);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getAllProducts() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('products', 'readonly');
    const req = tx.objectStore('products').getAll();
    req.onsuccess = () => resolve(req.result);
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

async function addToShoppingList(item) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('shopping', 'readwrite');
    tx.objectStore('shopping').add(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getShoppingList() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('shopping', 'readonly');
    const req = tx.objectStore('shopping').getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

window.PantryDB = {
  addProduct,
  getAllProducts,
  updateProduct,
  addToShoppingList,
  getShoppingList
};
