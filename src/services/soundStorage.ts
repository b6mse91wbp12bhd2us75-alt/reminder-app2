/**
 * IndexedDB Sound Storage Service
 * 5MB制限なしでMP3/WAV音源を保存するデータベース
 */

export interface CustomSoundItem {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  size: number;
  createdAt: number;
}

const DB_NAME = 'ReminderSoundsDB';
const DB_VERSION = 1;
const STORE_NAME = 'sounds';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB is not supported.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'name' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open DB.'));
  });
}

export async function getAllCustomSounds(): Promise<{ name: string; url: string }[]> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const results = request.result as CustomSoundItem[];
        resolve(
          results.map((item) => ({
            name: item.name,
            url: item.url,
          }))
        );
      };

      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    return [];
  }
}

export async function saveCustomSound(item: CustomSoundItem): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(item);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteCustomSound(name: string): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(name);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {}
}
