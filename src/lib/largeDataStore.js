const DATABASE_NAME = 'sentiknn_large_results';
const STORE_NAME = 'pipeline_details';

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function put(key, value) {
  if (typeof window === 'undefined' || !window.indexedDB) return;
  const database = await openDatabase();
  await new Promise((resolve, reject) => {
    const request = database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(value, key);
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
  });
  database.close();
}

async function get(key) {
  if (typeof window === 'undefined' || !window.indexedDB) return [];
  const database = await openDatabase();
  const value = await new Promise((resolve, reject) => {
    const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return value;
}

export function savePreprocessingResults(results) {
  return put('preprocessing_results', results);
}

export function getPreprocessingResults() {
  return get('preprocessing_results');
}

export async function clearLargePipelineDetails() {
  if (typeof window === 'undefined' || !window.indexedDB) return;
  const database = await openDatabase();
  await new Promise((resolve, reject) => {
    const request = database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).clear();
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
  });
  database.close();
}
