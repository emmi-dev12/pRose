// Storage abstraction. Today: an IndexedDB backend holding a single encrypted blob
// (the whole library). The interface is intentionally backend-agnostic so a
// portable-file backend (USB / air-gapped mode) can slot in later.

import { seal, open, type Sealed } from './crypto';
import { slugify, type Library, type Volume } from './types';

const DB_NAME = 'prose';
const STORE = 'vault';
const LIB_KEY = 'library'; // encrypted Library (all volumes)
const OLD_KEY = 'notebook'; // legacy single-volume blob (pre-shelf)

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

// Backfill fields a legacy volume (pre-shelf) might be missing.
function normalizeVolume(v: Volume, taken: string[]): Volume {
  let slug = v.slug || slugify(v.title);
  while (taken.includes(slug)) slug = `${slug}-2`;
  taken.push(slug);
  return { ...v, slug, createdAt: v.createdAt || new Date().toISOString() };
}

export interface Storage {
  /** Whether an encrypted library already exists on this device (new or legacy). */
  exists(): Promise<boolean>;
  /** Decrypt and load the library. Throws if the passphrase is wrong. */
  load(passphrase: string): Promise<Library>;
  /** Encrypt and persist the library. */
  save(passphrase: string, library: Library): Promise<void>;
}

export const indexedDbStorage: Storage = {
  async exists() {
    return (await get<Sealed>(LIB_KEY)) !== undefined || (await get<Sealed>(OLD_KEY)) !== undefined;
  },

  async load(passphrase) {
    const sealed = await get<Sealed>(LIB_KEY);
    if (sealed) {
      const lib = JSON.parse(await open(passphrase, sealed)) as Library;
      const taken: string[] = [];
      return { volumes: lib.volumes.map((v) => normalizeVolume(v, taken)) };
    }
    // migrate a legacy single-volume notebook into a one-volume library
    const legacy = await get<Sealed>(OLD_KEY);
    if (legacy) {
      const vol = JSON.parse(await open(passphrase, legacy)) as Volume; // throws on wrong pass
      const lib: Library = { volumes: [normalizeVolume(vol, [])] };
      await this.save(passphrase, lib); // persist in the new shape
      return lib;
    }
    throw new Error('no-library');
  },

  async save(passphrase, library) {
    await put(LIB_KEY, await seal(passphrase, JSON.stringify(library)));
  },
};
