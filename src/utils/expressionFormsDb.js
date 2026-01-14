const DB_NAME = 'expression-forms-db';
const DB_VERSION = 1;

const STORE_FORMS = 'expressionForms';
const STORE_ASSETS = 'expressionAssets';
const STORE_RULES = 'expressionRules';

const createId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const openDb = () =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_FORMS)) {
        db.createObjectStore(STORE_FORMS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_ASSETS)) {
        const store = db.createObjectStore(STORE_ASSETS, { keyPath: 'assetId' });
        store.createIndex('expressionId', 'expressionId', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_RULES)) {
        const store = db.createObjectStore(STORE_RULES, { keyPath: 'ruleId' });
        store.createIndex('expressionId', 'expressionId', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const runTransaction = async (storeNames, mode, handler) => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, mode);
    const stores = storeNames.map((name) => tx.objectStore(name));
    const result = handler(...stores);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
  });
};

export const createExpressionFormId = () => createId();

export const getExpressionForms = () =>
  runTransaction([STORE_FORMS], 'readonly', (store) =>
    new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    })
  );

export const getExpressionForm = (id) =>
  runTransaction([STORE_FORMS], 'readonly', (store) =>
    new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    })
  );

export const upsertExpressionForm = (form) =>
  runTransaction([STORE_FORMS], 'readwrite', (store) => {
    store.put(form);
  });

export const deleteExpressionForm = (id) =>
  runTransaction([STORE_FORMS, STORE_ASSETS, STORE_RULES], 'readwrite', (forms, assets, rules) => {
    forms.delete(id);
    const assetIndex = assets.index('expressionId');
    const assetRequest = assetIndex.openCursor(IDBKeyRange.only(id));
    assetRequest.onsuccess = () => {
      const cursor = assetRequest.result;
      if (cursor) {
        assets.delete(cursor.primaryKey);
        cursor.continue();
      }
    };
    const ruleIndex = rules.index('expressionId');
    const ruleRequest = ruleIndex.openCursor(IDBKeyRange.only(id));
    ruleRequest.onsuccess = () => {
      const cursor = ruleRequest.result;
      if (cursor) {
        rules.delete(cursor.primaryKey);
        cursor.continue();
      }
    };
  });

export const getExpressionAssets = (expressionId) =>
  runTransaction([STORE_ASSETS], 'readonly', (store) =>
    new Promise((resolve, reject) => {
      const index = store.index('expressionId');
      const request = index.getAll(expressionId);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    })
  );

export const addExpressionAsset = (asset) =>
  runTransaction([STORE_ASSETS], 'readwrite', (store) => {
    store.put(asset);
  });

export const deleteExpressionAsset = (assetId) =>
  runTransaction([STORE_ASSETS], 'readwrite', (store) => {
    store.delete(assetId);
  });

export const getExpressionRules = (expressionId) =>
  runTransaction([STORE_RULES], 'readonly', (store) =>
    new Promise((resolve, reject) => {
      const index = store.index('expressionId');
      const request = index.getAll(expressionId);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    })
  );

export const upsertExpressionRule = (rule) =>
  runTransaction([STORE_RULES], 'readwrite', (store) => {
    store.put(rule);
  });

export const deleteExpressionRule = (ruleId) =>
  runTransaction([STORE_RULES], 'readwrite', (store) => {
    store.delete(ruleId);
  });

export const createExpressionAssetId = () => createId();
export const createExpressionRuleId = () => createId();
