class SyncManager {
  constructor() {
    this.client = null;
    this.syncTimer = null;
    this.settings = null;
    this.deviceId = this.generateDeviceId();
  }

  generateDeviceId() {
    return 'device_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
  }

  async init(settings) {
    this.settings = settings;
    this.stopAutoSync();
    
    if (!settings.syncMethod || settings.syncMethod === 'none') {
      return;
    }

    switch (settings.syncMethod) {
      case 'webdav':
        const { decrypt } = await import('./utils.js');
        let webdavPassword = settings.webdavPassword;
        if (settings.encryptionKey && typeof webdavPassword === 'object') {
          webdavPassword = await decrypt(webdavPassword, settings.encryptionKey);
        }
        this.client = new WebDAVClient({
          ...settings,
          webdavPassword: webdavPassword
        });
        break;
      case 'supabase':
        this.client = new SupabaseClient(settings);
        break;
      case 'gist':
        const { decrypt: gistDecrypt } = await import('./utils.js');
        let gistToken = settings.gistToken;
        if (settings.encryptionKey && typeof gistToken === 'object') {
          gistToken = await gistDecrypt(gistToken, settings.encryptionKey);
        }
        this.client = new GistClient({
          ...settings,
          gistToken: gistToken
        });
        break;
    }

    if (settings.autoSync && settings.syncInterval) {
      this.startAutoSync(settings.syncInterval);
    }
  }

  async sync() {
    if (!this.client) {
      throw new Error('Sync client not initialized');
    }

    const localResult = await chrome.storage.local.get(['privateBookmarks']);
    const local = localResult.privateBookmarks || [];

    let remote = [];
    try {
      remote = await this.client.download();
    } catch (error) {
      console.warn('Remote fetch failed, using local only:', error);
    }

    const merged = this.merge(local, remote);

    await chrome.storage.local.set({ privateBookmarks: merged });

    try {
      await this.client.upload(merged);
      await this.updateStatus('success');
    } catch (error) {
      await this.updateStatus('error', error.message);
      throw error;
    }
  }

  merge(local, remote) {
    const map = new Map();

    remote.forEach(b => {
      map.set(b.id, { ...b, synced: true });
    });

    local.forEach(b => {
      const existing = map.get(b.id);
      if (!existing || (b.modifiedAt || b.createdAt) > (existing.modifiedAt || existing.createdAt)) {
        map.set(b.id, { ...b, synced: true });
      } else if (existing && (existing.modifiedAt || existing.createdAt) > (b.modifiedAt || b.createdAt)) {
        map.set(b.id, { ...existing, synced: true });
      }
    });

    return Array.from(map.values());
  }

  startAutoSync(minutes) {
    this.stopAutoSync();
    this.syncTimer = setInterval(() => {
      this.sync().catch(err => {
        console.error('Auto sync failed:', err);
      });
    }, minutes * 60 * 1000);
  }

  stopAutoSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  async updateStatus(status, error = null) {
    await chrome.storage.local.set({
      lastSyncTime: Date.now(),
      lastSyncStatus: status,
      lastSyncError: error
    });
  }
}
