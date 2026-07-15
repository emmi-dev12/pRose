// Encryption at rest. The notebook is private even to someone holding the machine:
// nothing is stored in plaintext. Key is derived from a passphrase only the user
// holds (PBKDF2 → AES-GCM). No server ever sees any of this.

const enc = new TextEncoder();
const dec = new TextDecoder();

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase) as BufferSource,
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: 250_000, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export interface Sealed {
  salt: number[]; // PBKDF2 salt
  iv: number[]; // AES-GCM iv
  data: number[]; // ciphertext bytes
}

export async function seal(passphrase: string, plaintext: string): Promise<Sealed> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    enc.encode(plaintext) as BufferSource,
  );
  return { salt: [...salt], iv: [...iv], data: [...new Uint8Array(ct)] };
}

export async function open(passphrase: string, sealed: Sealed): Promise<string> {
  const key = await deriveKey(passphrase, new Uint8Array(sealed.salt));
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(sealed.iv) as BufferSource },
    key,
    new Uint8Array(sealed.data) as BufferSource,
  );
  return dec.decode(pt);
}
