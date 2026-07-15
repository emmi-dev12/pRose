// Storage abstraction. Today: an IndexedDB backend holding a single encrypted blob.
// The interface is intentionally backend-agnostic so a portable-file backend (USB /
// air-gapped mode) can slot in later without touching the app.

import { seal, open, type Sealed } from './crypto';
import type { Volume } from './types';

const DB_NAME = 'prose';
const STORE = 'vault';
const KEY = 'notebook'; // single-volume slice

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function put(key: string, value: unknown): Promise<void> {
  return idb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      }),
  );
}

function get<T>(key: string): Promise<T | undefined> {
  return idb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const r = tx.objectStore(STORE).get(key);
        r.onsuccess = () => resolve(r.result as T | undefined);
        r.onerror = () => reject(r.error);
      }),
  );
}

export interface Storage {
  /** Whether an encrypted notebook already exists on this device. */
  exists(): Promise<boolean>;
  /** Decrypt and load with the given passphrase. Throws if the passphrase is wrong. */
  load(passphrase: string): Promise<Volume>;
  /** Encrypt and persist. */
  save(passphrase: string, volume: Volume): Promise<void>;
}

export const indexedDbStorage: Storage = {
  async exists() {
    return (await get<Sealed>(KEY)) !== undefined;
  },
  async load(passphrase) {
    const sealed = await get<Sealed>(KEY);
    if (!sealed) throw new Error('no-notebook');
    const json = await open(passphrase, sealed); // throws on wrong passphrase (AES-GCM auth)
    return JSON.parse(json) as Volume;
  },
  async save(passphrase, volume) {
    await put(KEY, await seal(passphrase, JSON.stringify(volume)));
  },
};
