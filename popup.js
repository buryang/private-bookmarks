async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function getFaviconUrl(url) {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch { return null; }
}

async function encrypt(text, key) {
  if (!text || !key) return null;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), 'PBKDF2', false, ['deriveKey']);
  const cryptoKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: new TextEncoder().encode('private-bookmarks'), iterations: 100000, hash: 'SHA-256' },
    keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
  );
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, new TextEncoder().encode(text));
  return { iv: Array.from(iv), data: Array.from(new Uint8Array(encrypted)) };
}

async function decrypt(encrypted, key) {
  if (!encrypted || !key) return null;
  try {
    const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), 'PBKDF2', false, ['deriveKey']);
    const cryptoKey = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: new TextEncoder().encode('private-bookmarks'), iterations: 100000, hash: 'SHA-256' },
      keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
    );
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(encrypted.iv) }, cryptoKey, new Uint8Array(encrypted.data));
    return new TextDecoder().decode(decrypted);
  } catch { return null; }
}

let translations = {};

async function loadTranslations(lang) {
  try {
    const response = await fetch(`_locales/${lang}/messages.json`);
    translations = await response.json();
  } catch (e) {
    console.error('Failed to load translations:', e);
  }
}

function t(key) {
  return translations[key]?.message || key;
}

function detectLanguage() {
  const lang = chrome.i18n.getUILanguage();
  if (lang.startsWith('zh')) return 'zh_CN';
  if (lang.startsWith('ja')) return 'ja';
  return 'en';
}

function applyTranslations(lang) {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.textContent = t(key) || el.textContent;
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    el.placeholder = t(key) || el.placeholder;
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const lang = detectLanguage();
  await loadTranslations(lang);
  applyTranslations(lang);

  const lockedView = document.getElementById('lockedView');
  const unlockedView = document.getElementById('unlockedView');
  const passwordInput = document.getElementById('passwordInput');
  const unlockBtn = document.getElementById('unlockBtn');
  const togglePassword = document.getElementById('togglePassword');
  const errorMsg = document.getElementById('errorMsg');
  const statusText = document.getElementById('statusText');
  const lockBtn = document.getElementById('lockBtn');
  const bookmarkList = document.getElementById('bookmarkList');
  const emptyState = document.getElementById('emptyState');
  const newTitle = document.getElementById('newTitle');
  const newUrl = document.getElementById('newUrl');
  const enableAIClassify = document.getElementById('enableAIClassify');
  const addBookmarkBtn = document.getElementById('addBookmarkBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsModal = document.getElementById('settingsModal');
  const cancelSettingsBtn = document.getElementById('cancelSettingsBtn');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const classificationModal = document.getElementById('classificationModal');
  const classifyingView = document.getElementById('classifyingView');
  const classificationResult = document.getElementById('classificationResult');
  const suggestedFolder = document.getElementById('suggestedFolder');
  const suggestedTags = document.getElementById('suggestedTags');
  const editFolder = document.getElementById('editFolder');
  const editTags = document.getElementById('editTags');
  const skipClassifyBtn = document.getElementById('skipClassifyBtn');
  const confirmClassifyBtn = document.getElementById('confirmClassifyBtn');
  const toast = document.getElementById('toast');
  const lastSyncTime = document.getElementById('lastSyncTime');
  const testLlmBtn = document.getElementById('testLlmBtn');
  const llmTestResult = document.getElementById('llmTestResult');
  const testSyncBtn = document.getElementById('testSyncBtn');
  const syncTestResult = document.getElementById('syncTestResult');
  const newFolder = document.getElementById('newFolder');
  const addFolderBtn = document.getElementById('addFolderBtn');
  const newFolderModal = document.getElementById('newFolderModal');
  const newFolderName = document.getElementById('newFolderName');
  const cancelNewFolderBtn = document.getElementById('cancelNewFolderBtn');
  const confirmNewFolderBtn = document.getElementById('confirmNewFolderBtn');
  const importChromeBookmarksBtn = document.getElementById('importChromeBookmarksBtn');
  const importModal = document.getElementById('importModal');
  const chromeBookmarksList = document.getElementById('chromeBookmarksList');
  const cancelImportBtn = document.getElementById('cancelImportBtn');
  const confirmImportBtn = document.getElementById('confirmImportBtn');
  const selectAllBookmarks = document.getElementById('selectAllBookmarks');
  const resetImportStateBtn = document.getElementById('resetImportStateBtn');

  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  let isUnlocked = false;
  let pendingBookmark = null;
  let settings = {
    llmEnabled: false,
    llmProvider: 'openai',
    llmBaseUrl: 'https://api.openai.com/v1',
    llmApiKey: '',
    llmModel: 'gpt-3.5-turbo',
    llmAutoTag: false,
    syncEnabled: false,
    syncMethod: 'none',
    autoSync: false,
    syncInterval: 5,
    webdavUrl: '', webdavUsername: '', webdavPassword: '', webdavPath: '/bookmarks.json',
    s3Endpoint: '', s3Region: '', s3AccessKey: '', s3SecretKey: '', s3Bucket: '', s3Key: 'bookmarks.json',
    customApiUrl: '', customAuthHeader: '',
    encryptionKey: '',
    language: lang
  };

  async function initPendingData() {
    const result = await chrome.storage.local.get(['pendingBookmarkData']);
    if (result.pendingBookmarkData) {
      const data = result.pendingBookmarkData;
      if (data.url) {
        newUrl.value = data.url;
        newTitle.value = data.title || '';
      }
      await chrome.storage.local.remove('pendingBookmarkData');
    }
  }

  async function loadSettings() {
    const result = await chrome.storage.local.get(['llmSettings', 'syncSettings', 'language']);
    if (result.llmSettings) settings = { ...settings, ...result.llmSettings };
    if (result.syncSettings) settings = { ...settings, ...result.syncSettings };
    if (result.language) { settings.language = result.language; applyTranslations(settings.language); }
    
    document.getElementById('llmEnabled').checked = settings.llmEnabled;
    document.getElementById('llmProvider').value = settings.llmProvider;
    document.getElementById('llmBaseUrl').value = settings.llmBaseUrl;
    document.getElementById('llmApiKey').value = settings.llmApiKey;
    document.getElementById('llmModel').value = settings.llmModel;
    document.getElementById('llmAutoTag').checked = settings.llmAutoTag;
    
    document.getElementById('syncEnabled').checked = settings.syncEnabled;
    document.getElementById('syncMethod').value = settings.syncMethod;
    document.getElementById('webdavUrl').value = settings.webdavUrl;
    document.getElementById('webdavUsername').value = settings.webdavUsername;
    document.getElementById('webdavPassword').value = settings.webdavPassword;
    document.getElementById('webdavPath').value = settings.webdavPath;
    document.getElementById('s3Endpoint').value = settings.s3Endpoint;
    document.getElementById('s3Region').value = settings.s3Region;
    document.getElementById('s3AccessKey').value = settings.s3AccessKey;
    document.getElementById('s3SecretKey').value = settings.s3SecretKey;
    document.getElementById('s3Bucket').value = settings.s3Bucket;
    document.getElementById('s3Key').value = settings.s3Key;
    document.getElementById('customApiUrl').value = settings.customApiUrl;
    document.getElementById('customAuthHeader').value = settings.customAuthHeader;
    document.getElementById('encryptionKey').value = settings.encryptionKey;
    document.getElementById('autoSync').checked = settings.autoSync;
    document.getElementById('syncInterval').value = settings.syncInterval;
    document.getElementById('languageSelect').value = settings.language;
    
    updateSyncSettingsVisibility();
    updateLlmFields();
    updateLastSyncTime();
  }

  function updateSyncSettingsVisibility() {
    const method = document.getElementById('syncMethod').value;
    document.getElementById('webdavSettings').classList.toggle('active', method === 'webdav');
    document.getElementById('s3Settings').classList.toggle('active', method === 's3');
    document.getElementById('customSettings').classList.toggle('active', method === 'custom');
  }

  function updateLlmFields() {
    const provider = document.getElementById('llmProvider').value;
    const baseUrlInput = document.getElementById('llmBaseUrl');
    const modelInput = document.getElementById('llmModel');
    
    const presets = {
      openai: { url: 'https://api.openai.com/v1', model: 'gpt-3.5-turbo' },
      anthropic: { url: 'https://api.anthropic.com', model: 'claude-3-haiku-20240307' },
      gemini: { url: 'https://generativelanguage.googleapis.com/v1', model: 'gemini-pro' },
      groq: { url: 'https://api.groq.com/openai/v1', model: 'mixtral-8x7b-32768' },
      ollama: { url: 'http://localhost:11434', model: 'llama2' },
      custom: { url: '', model: '' }
    };
    
    if (presets[provider]) {
      if (!baseUrlInput.dataset.userModified) baseUrlInput.value = presets[provider].url;
      if (!modelInput.dataset.userModified) modelInput.value = presets[provider].model;
    }
  }

  document.getElementById('llmProvider').addEventListener('change', () => {
    updateLlmFields();
  });

  document.getElementById('llmBaseUrl').addEventListener('input', function() { this.dataset.userModified = 'true'; });
  document.getElementById('llmModel').addEventListener('input', function() { this.dataset.userModified = 'true'; });
  document.getElementById('syncMethod').addEventListener('change', updateSyncSettingsVisibility);

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(tab + 'Tab').classList.add('active');
    });
  });

  async function saveSettings() {
    settings.llmEnabled = document.getElementById('llmEnabled').checked;
    settings.llmProvider = document.getElementById('llmProvider').value;
    settings.llmBaseUrl = document.getElementById('llmBaseUrl').value.trim();
    settings.llmApiKey = document.getElementById('llmApiKey').value.trim();
    settings.llmModel = document.getElementById('llmModel').value.trim();
    settings.llmAutoTag = document.getElementById('llmAutoTag').checked;
    
    settings.syncEnabled = document.getElementById('syncEnabled').checked;
    settings.syncMethod = document.getElementById('syncMethod').value;
    settings.webdavUrl = document.getElementById('webdavUrl').value.trim();
    settings.webdavUsername = document.getElementById('webdavUsername').value.trim();
    settings.webdavPassword = document.getElementById('webdavPassword').value;
    settings.webdavPath = document.getElementById('webdavPath').value.trim() || '/bookmarks.json';
    settings.s3Endpoint = document.getElementById('s3Endpoint').value.trim();
    settings.s3Region = document.getElementById('s3Region').value.trim();
    settings.s3AccessKey = document.getElementById('s3AccessKey').value.trim();
    settings.s3SecretKey = document.getElementById('s3SecretKey').value;
    settings.s3Bucket = document.getElementById('s3Bucket').value.trim();
    settings.s3Key = document.getElementById('s3Key').value.trim() || 'bookmarks.json';
    settings.customApiUrl = document.getElementById('customApiUrl').value.trim();
    settings.customAuthHeader = document.getElementById('customAuthHeader').value.trim();
    settings.encryptionKey = document.getElementById('encryptionKey').value;
    settings.autoSync = document.getElementById('autoSync').checked;
    settings.syncInterval = parseInt(document.getElementById('syncInterval').value);
    settings.language = document.getElementById('languageSelect').value;

    if (settings.encryptionKey) {
      if (settings.webdavPassword) settings.webdavPassword = await encrypt(settings.webdavPassword, settings.encryptionKey);
      if (settings.s3SecretKey) settings.s3SecretKey = await encrypt(settings.s3SecretKey, settings.encryptionKey);
    }

    await chrome.storage.local.set({ llmSettings: settings, syncSettings: settings, language: settings.language });
    
    if (settings.language !== lang) {
      showToast(chrome.i18n.getMessage('settingsSaved'), 'success');
      settingsModal.classList.remove('active');
      location.reload();
      return;
    }
    
    showToast(chrome.i18n.getMessage('settingsSaved'), 'success');
    settingsModal.classList.remove('active');
  }

  function showToast(message, type = 'success') {
    toast.textContent = message;
    toast.className = 'toast ' + type + ' show';
    setTimeout(() => toast.classList.remove('show'), 2500);
  }

  function getExistingFolders(bookmarks) {
    const folders = new Set();
    (bookmarks || []).forEach(b => { if (b.folder) folders.add(b.folder); });
    return Array.from(folders);
  }

  async function checkUnlockStatus() {
    await updateFolderDropdown();
    const result = await chrome.storage.local.get(['sessionUnlocked', 'hasImportedFromChrome']);
    if (result.sessionUnlocked) { 
      isUnlocked = true; 
      showUnlockedView(); 
      loadBookmarks(); 
      
      if (!result.hasImportedFromChrome) {
        importChromeBookmarksBtn.style.display = 'block';
      } else {
        importChromeBookmarksBtn.style.display = 'none';
      }
    }
    else { checkPasswordSetup(); }
  }

  async function checkPasswordSetup() {
    const result = await chrome.storage.local.get(['passwordHash']);
    if (!result.passwordHash) {
      statusText.textContent = chrome.i18n.getMessage('createPassword');
      unlockBtn.textContent = chrome.i18n.getMessage('setPasswordBtn');
    } else {
      statusText.textContent = chrome.i18n.getMessage('unlockTitle');
      unlockBtn.textContent = chrome.i18n.getMessage('unlockBtn');
    }
  }

  function showUnlockedView() { lockedView.classList.remove('active'); unlockedView.classList.add('active'); }
  function showLockedView() { unlockedView.classList.remove('active'); lockedView.classList.add('active'); passwordInput.value = ''; errorMsg.classList.remove('show'); isUnlocked = false; }

  async function unlock(password) {
    const result = await chrome.storage.local.get(['passwordHash']);
    const storedHash = result.passwordHash;
    if (!storedHash) {
      const hash = await sha256(password);
      await chrome.storage.local.set({ passwordHash: hash, sessionUnlocked: true, privateBookmarks: [] });
      isUnlocked = true; showUnlockedView(); loadBookmarks();
      return true;
    } else {
      const inputHash = await sha256(password);
      if (inputHash === storedHash) {
        await chrome.storage.local.set({ sessionUnlocked: true });
        isUnlocked = true; showUnlockedView(); loadBookmarks();
        return true;
      }
      return false;
    }
  }

  async function loadBookmarks() {
    const result = await chrome.storage.local.get(['privateBookmarks']);
    const bookmarks = result.privateBookmarks || [];
    
    bookmarkList.querySelectorAll('.bookmark-item, .folder-header, .folder-content').forEach(el => el.remove());

    if (bookmarks.length === 0) { emptyState.style.display = 'block'; }
    else {
      emptyState.style.display = 'none';
      const folders = {};
      bookmarks.forEach(b => { const f = b.folder || 'Uncategorized'; if (!folders[f]) folders[f] = []; folders[f].push(b); });

      Object.keys(folders).sort().forEach(folder => {
        const folderHeader = document.createElement('div');
        folderHeader.className = 'folder-header';
        folderHeader.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg><span>${escapeHtml(folder)} (${folders[folder].length})</span>`;
        
        const folderContent = document.createElement('div');
        folderContent.className = 'folder-content';
        
        folderHeader.addEventListener('click', () => {
          folderHeader.classList.toggle('collapsed');
          folderContent.classList.toggle('collapsed');
        });
        
        bookmarkList.insertBefore(folderHeader, emptyState);

        folders[folder].sort((a, b) => b.createdAt - a.createdAt).forEach(bookmark => {
          const faviconUrl = getFaviconUrl(bookmark.url);
          const tagsHtml = (bookmark.tags && bookmark.tags.length > 0) ? `<div class="bookmark-tags">${bookmark.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>` : '';
          const item = document.createElement('div');
          item.className = 'bookmark-item';
          item.innerHTML = `${faviconUrl ? `<img class="favicon" src="${faviconUrl}" onerror="this.style.display='none'">` : ''}<div class="bookmark-info"><div class="bookmark-title">${escapeHtml(bookmark.title)}</div><div class="bookmark-url">${escapeHtml(truncateUrl(bookmark.url))}</div>${tagsHtml}</div><button class="delete-btn" data-id="${bookmark.id}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>`;
          item.addEventListener('click', (e) => { if (!e.target.closest('.delete-btn')) chrome.tabs.create({ url: bookmark.url }); });
          item.querySelector('.delete-btn').addEventListener('click', async (e) => { e.stopPropagation(); await deleteBookmark(bookmark.id); });
          folderContent.appendChild(item);
        });
        
        bookmarkList.insertBefore(folderContent, emptyState);
      });
    }
    updateFolderDropdown();
  }

  async function updateFolderDropdown() {
    const result = await chrome.storage.local.get(['privateBookmarks', 'customFolders']);
    const bookmarks = result.privateBookmarks || [];
    const customFolders = result.customFolders || [];
    console.log('updateFolderDropdown - customFolders:', customFolders);
    const folders = new Set();
    folders.add('Uncategorized');
    customFolders.forEach(f => folders.add(f));
    bookmarks.forEach(b => { if (b.folder) folders.add(b.folder); });
    
    const currentValue = newFolder ? newFolder.value : '';
    newFolder.innerHTML = '';
    Array.from(folders).sort().forEach(folder => {
      const option = document.createElement('option');
      option.value = folder;
      option.textContent = folder;
      newFolder.appendChild(option);
    });
    if (currentValue && folders.has(currentValue)) {
      newFolder.value = currentValue;
    }
  }

  async function createNewFolder(folderName) {
    if (!folderName || !folderName.trim()) return;
    const trimmedName = folderName.trim();
    
    const result = await chrome.storage.local.get(['customFolders']);
    const customFolders = result.customFolders || [];
    if (!customFolders.includes(trimmedName)) {
      customFolders.push(trimmedName);
      await chrome.storage.local.set({ customFolders });
      console.log('Folder saved:', trimmedName, 'Custom folders:', customFolders);
    }
    
    await updateFolderDropdown();
    newFolder.value = trimmedName;
    showToast('Folder created: ' + trimmedName, 'success');
  }

  async function deleteBookmark(id) {
    const result = await chrome.storage.local.get(['privateBookmarks']);
    const filtered = (result.privateBookmarks || []).filter(b => b.id !== id);
    await chrome.storage.local.set({ privateBookmarks: filtered });
    loadBookmarks();
  }

  async function addBookmark(title, url, folder = 'Uncategorized', tags = []) {
    const result = await chrome.storage.local.get(['privateBookmarks']);
    const bookmarks = result.privateBookmarks || [];
    bookmarks.push({ id: generateId(), title: title || 'Untitled', url: url || 'about:blank', folder, tags, createdAt: Date.now(), modifiedAt: Date.now() });
    await chrome.storage.local.set({ privateBookmarks: bookmarks });
    newTitle.value = ''; newUrl.value = ''; 
    await updateFolderDropdown();
    loadBookmarks();
  }

  async function callLLM(prompt) {
    const { llmProvider, llmBaseUrl, llmApiKey, llmModel } = settings;
    
    let endpoint = llmBaseUrl;
    let headers = { 'Content-Type': 'application/json' };
    let body = {};

    switch (llmProvider) {
      case 'openai':
      case 'groq':
      case 'custom':
        headers['Authorization'] = `Bearer ${llmApiKey}`;
        endpoint += '/chat/completions';
        body = { model: llmModel, messages: [{ role: 'user', content: prompt }], temperature: 0.3, max_tokens: 200 };
        break;
      case 'anthropic':
        headers['x-api-key'] = llmApiKey;
        headers['anthropic-version'] = '2023-06-01';
        endpoint += '/v1/messages';
        body = { model: llmModel, max_tokens: 200, messages: [{ role: 'user', content: prompt }] };
        break;
      case 'gemini':
        endpoint += `/models/${llmModel}:generateContent?key=${llmApiKey}`;
        body = { contents: [{ parts: [{ text: prompt }] }] };
        break;
      case 'ollama':
        endpoint += '/api/generate';
        body = { model: llmModel, prompt, stream: false };
        break;
    }

    const response = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data = await response.json();
    
    if (llmProvider === 'anthropic') return data.content?.[0]?.text;
    if (llmProvider === 'gemini') return data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (llmProvider === 'ollama') return data.response;
    return data.choices?.[0]?.message?.content;
  }

  async function classifyWithLLM(title, url) {
    if (!settings.llmEnabled || !settings.llmApiKey) return { folder: 'Uncategorized', tags: [] };

    const result = await chrome.storage.local.get(['privateBookmarks']);
    const existingFolders = getExistingFolders(result.privateBookmarks || []);
    const folderHint = existingFolders.length > 0 ? `已有分类: ${existingFolders.join(', ')}\n` : '';

    const prompt = `${folderHint}分析以下书签，推荐合适的分类文件夹和标签。\n\n书签标题: ${title}\n网址: ${url}\n\n请用JSON格式返回:\n{"folder": "分类文件夹名称", "tags": ["标签1", "标签2", "标签3"]}\n\n文件夹名称保持在1-3个词，标签2-4个。`;

    try {
      const content = await callLLM(prompt);
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return { folder: parsed.folder || 'Uncategorized', tags: Array.isArray(parsed.tags) ? parsed.tags : [] };
      }
    } catch (error) {
      console.error('LLM classification error:', error);
      showToast('LLM classification failed: ' + error.message, 'error');
    }
    return { folder: 'Uncategorized', tags: [] };
  }

  async function handleAddBookmark() {
    const title = newTitle.value.trim();
    const url = newUrl.value.trim();
    const folder = newFolder.value || 'Uncategorized';
    if (!title && !url) return;

    if (enableAIClassify.checked && settings.llmEnabled && settings.llmApiKey) {
      pendingBookmark = { title, url, folder };
      classificationModal.classList.add('active');
      classifyingView.style.display = 'flex';
      classificationResult.style.display = 'none';
      
      const result = await classifyWithLLM(title, url);
      
      classifyingView.style.display = 'none';
      classificationResult.style.display = 'block';
      
      suggestedFolder.textContent = result.folder;
      suggestedTags.innerHTML = result.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('') || '-';
      editFolder.value = result.folder;
      editTags.value = result.tags.join(', ');
    } else {
      await addBookmark(title, url, folder);
      window.close();
    }
  }

  confirmClassifyBtn.addEventListener('click', async () => {
    if (pendingBookmark) {
      const folder = editFolder.value.trim() || pendingBookmark.folder || 'Uncategorized';
      const tags = editTags.value.split(',').map(t => t.trim()).filter(t => t);
      await addBookmark(pendingBookmark.title, pendingBookmark.url, folder, tags);
      pendingBookmark = null;
      classificationModal.classList.remove('active');
      window.close();
    }
  });

  skipClassifyBtn.addEventListener('click', async () => {
    if (pendingBookmark) {
      await addBookmark(pendingBookmark.title, pendingBookmark.url);
      pendingBookmark = null;
      classificationModal.classList.remove('active');
      window.close();
    }
  });

  function escapeHtml(text) { const div = document.createElement('div'); div.textContent = text; return div.innerHTML; }
  function truncateUrl(url) { return url && url.length > 40 ? url.substring(0, 37) + '...' : url || ''; }

  togglePassword.addEventListener('click', () => { passwordInput.type = passwordInput.type === 'password' ? 'text' : 'password'; });

  unlockBtn.addEventListener('click', async () => {
    const password = passwordInput.value;
    if (!password) { errorMsg.textContent = chrome.i18n.getMessage('pleaseEnterPassword'); errorMsg.classList.add('show'); return; }
    const success = await unlock(password);
    if (!success) { errorMsg.textContent = chrome.i18n.getMessage('incorrectPassword'); errorMsg.classList.add('show'); }
  });

  passwordInput.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
      const password = passwordInput.value;
      if (!password) { errorMsg.textContent = chrome.i18n.getMessage('pleaseEnterPassword'); errorMsg.classList.add('show'); return; }
      const success = await unlock(password);
      if (!success) { errorMsg.textContent = chrome.i18n.getMessage('incorrectPassword'); errorMsg.classList.add('show'); }
    }
  });

  lockBtn.addEventListener('click', async () => { await chrome.storage.local.set({ sessionUnlocked: false }); showLockedView(); checkPasswordSetup(); });
  addBookmarkBtn.addEventListener('click', handleAddBookmark);
  
  addFolderBtn.addEventListener('click', () => {
    newFolderName.value = '';
    newFolderModal.classList.add('active');
    newFolderName.focus();
  });
  
  cancelNewFolderBtn.addEventListener('click', () => newFolderModal.classList.remove('active'));
  
  confirmNewFolderBtn.addEventListener('click', async () => {
    const folder = newFolderName.value.trim();
    if (folder) {
      await createNewFolder(folder);
      newFolderModal.classList.remove('active');
    }
  });
  
  newFolderName.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
      const folder = newFolderName.value.trim();
      if (folder) {
        await createNewFolder(folder);
        newFolderModal.classList.remove('active');
      }
    }
  });
  
  newFolderModal.addEventListener('click', (e) => { if (e.target === newFolderModal) newFolderModal.classList.remove('active'); });

  let chromeBookmarksData = [];

  async function loadChromeBookmarks() {
    return new Promise((resolve) => {
      chrome.bookmarks.getTree((tree) => {
        const bookmarks = [];
        function traverse(node) {
          if (node.children) {
            node.children.forEach(child => traverse(child));
          } else if (node.url) {
            bookmarks.push({
              title: node.title,
              url: node.url,
              folder: node.parentId || 'Chrome Bookmarks'
            });
          }
        }
        tree.forEach(node => traverse(node));
        resolve(bookmarks);
      });
    });
  }

  async function showImportModal() {
    importModal.classList.add('active');
    chromeBookmarksList.innerHTML = '<div class="classifying"><div class="spinner"></div><span>Loading Chrome bookmarks...</span></div>';
    
    chromeBookmarksData = await loadChromeBookmarks();
    
    if (chromeBookmarksData.length === 0) {
      chromeBookmarksList.innerHTML = '<p style="text-align: center; color: #a0a0a0; padding: 20px;">No bookmarks found in Chrome</p>';
      return;
    }

    chromeBookmarksList.innerHTML = '';
    chromeBookmarksData.forEach((bookmark, index) => {
      const faviconUrl = getFaviconUrl(bookmark.url);
      const item = document.createElement('div');
      item.className = 'bookmark-item';
      item.style.marginLeft = '0';
      item.innerHTML = `
        <input type="checkbox" class="import-checkbox" data-index="${index}" checked>
        ${faviconUrl ? `<img class="favicon" src="${faviconUrl}" onerror="this.style.display='none'">` : ''}
        <div class="bookmark-info">
          <div class="bookmark-title">${escapeHtml(bookmark.title)}</div>
          <div class="bookmark-url">${escapeHtml(truncateUrl(bookmark.url))}</div>
        </div>
      `;
      chromeBookmarksList.appendChild(item);
    });
  }

  async function importSelectedBookmarks() {
    const checkboxes = chromeBookmarksList.querySelectorAll('.import-checkbox:checked');
    const selectedBookmarks = Array.from(checkboxes).map(cb => chromeBookmarksData[cb.dataset.index]);
    
    if (selectedBookmarks.length === 0) {
      showToast('No bookmarks selected', 'error');
      return;
    }

    const result = await chrome.storage.local.get(['privateBookmarks']);
    const bookmarks = result.privateBookmarks || [];
    
    let importedCount = 0;
    for (const bm of selectedBookmarks) {
      bookmarks.push({
        id: generateId(),
        title: bm.title || 'Untitled',
        url: bm.url || 'about:blank',
        folder: 'Imported',
        tags: [],
        createdAt: Date.now(),
        modifiedAt: Date.now()
      });
      importedCount++;
    }

    await chrome.storage.local.set({ privateBookmarks: bookmarks, hasImportedFromChrome: true });
    importModal.classList.remove('active');
    loadBookmarks();
    showToast(`Imported ${importedCount} bookmarks`, 'success');
  }

  importChromeBookmarksBtn.addEventListener('click', showImportModal);
  cancelImportBtn.addEventListener('click', () => importModal.classList.remove('active'));
  importModal.addEventListener('click', (e) => { if (e.target === importModal) importModal.classList.remove('active'); });
  confirmImportBtn.addEventListener('click', importSelectedBookmarks);
  
  selectAllBookmarks.addEventListener('change', () => {
    const checkboxes = chromeBookmarksList.querySelectorAll('.import-checkbox');
    checkboxes.forEach(cb => cb.checked = selectAllBookmarks.checked);
  });

  resetImportStateBtn.addEventListener('click', async () => {
    await chrome.storage.local.set({ hasImportedFromChrome: false });
    importChromeBookmarksBtn.style.display = 'block';
    showToast('Import state reset. You can import again.', 'success');
  });

  settingsBtn.addEventListener('click', async () => { await loadSettings(); settingsModal.classList.add('active'); });
  cancelSettingsBtn.addEventListener('click', () => settingsModal.classList.remove('active'));
  saveSettingsBtn.addEventListener('click', saveSettings);
  settingsModal.addEventListener('click', (e) => { if (e.target === settingsModal) settingsModal.classList.remove('active'); });
  classificationModal.addEventListener('click', (e) => { if (e.target === classificationModal) { classificationModal.classList.remove('active'); pendingBookmark = null; } });

  testLlmBtn.addEventListener('click', async () => {
    llmTestResult.className = 'test-result';
    llmTestResult.textContent = 'Testing...';
    testLlmBtn.disabled = true;
    
    try {
      settings.llmProvider = document.getElementById('llmProvider').value;
      settings.llmBaseUrl = document.getElementById('llmBaseUrl').value.trim();
      settings.llmApiKey = document.getElementById('llmApiKey').value.trim();
      settings.llmModel = document.getElementById('llmModel').value.trim();
      
      if (!settings.llmApiKey) throw new Error('API Key is required');
      
      const result = await callLLM('Reply with just "OK" if you receive this.');
      if (result && result.toLowerCase().includes('ok')) {
        llmTestResult.textContent = '✓ Connection successful!';
        llmTestResult.classList.add('success');
      } else {
        llmTestResult.textContent = '⚠ Unexpected response';
        llmTestResult.classList.add('error');
      }
    } catch (error) {
      llmTestResult.textContent = '✗ ' + error.message;
      llmTestResult.classList.add('error');
    }
    
    testLlmBtn.disabled = false;
  });

  testSyncBtn.addEventListener('click', async () => {
    syncTestResult.className = 'test-result';
    syncTestResult.textContent = 'Testing connection...';
    testSyncBtn.disabled = true;
    
    const method = document.getElementById('syncMethod').value;
    
    try {
      if (method === 'webdav') {
        const url = document.getElementById('webdavUrl').value.trim();
        const username = document.getElementById('webdavUsername').value;
        const password = document.getElementById('webdavPassword').value;
        
        if (!url) throw new Error('Server URL is required');
        
        const response = await fetch(url, {
          method: 'HEAD',
          headers: { 'Authorization': 'Basic ' + btoa(username + ':' + password) }
        });
        
        if (response.ok || response.status === 401 || response.status === 403) {
          syncTestResult.textContent = '✓ Server reachable (check credentials)';
          syncTestResult.classList.add('success');
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } else if (method === 's3') {
        syncTestResult.textContent = '✓ S3 config saved (test upload will verify)';
        syncTestResult.classList.add('success');
      } else if (method === 'custom') {
        const url = document.getElementById('customApiUrl').value.trim();
        if (!url) throw new Error('API URL is required');
        
        const response = await fetch(url, { method: 'HEAD' });
        if (response.ok || response.status === 405) {
          syncTestResult.textContent = '✓ API endpoint reachable';
          syncTestResult.classList.add('success');
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } else {
        throw new Error('Please select a sync method');
      }
    } catch (error) {
      syncTestResult.textContent = '✗ ' + error.message;
      syncTestResult.classList.add('error');
    }
    
    testSyncBtn.disabled = false;
  });

  function updateLastSyncTime() {
    chrome.storage.local.get(['lastSyncTime'], (result) => {
      lastSyncTime.textContent = result.lastSyncTime ? new Date(result.lastSyncTime).toLocaleString() : chrome.i18n.getMessage('never');
    });
  }

  loadSettings();
  initPendingData();
  checkUnlockStatus();
});
