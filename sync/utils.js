async function encrypt(text, key) {
  if (!text || !key) return null;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(key),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  const cryptoKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: new TextEncoder().encode('private-bookmarks'), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    new TextEncoder().encode(text)
  );
  return { iv: Array.from(iv), data: Array.from(new Uint8Array(encrypted)) };
}

async function decrypt(encrypted, key) {
  if (!encrypted || !key) return null;
  try {
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(key),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    const cryptoKey = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: new TextEncoder().encode('private-bookmarks'), iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(encrypted.iv) },
      cryptoKey,
      new Uint8Array(encrypted.data)
    );
    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error('Decryption failed:', error);
    return null;
  }
}

function sha256(message) {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(message))
    .then(hash => Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join(''));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function getFaviconUrl(url) {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch {
    return null;
  }
}

function detectLanguage() {
  const lang = chrome.i18n.getUILanguage();
  if (lang.startsWith('zh')) return 'zh_CN';
  if (lang.startsWith('ja')) return 'ja';
  return 'en';
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { encrypt, decrypt, sha256, generateId, getFaviconUrl, detectLanguage };
}
