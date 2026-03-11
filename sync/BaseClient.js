class BaseClient {
  constructor(settings) {
    this.settings = settings;
  }

  async download() {
    throw new Error('Not implemented');
  }

  async upload(bookmarks) {
    throw new Error('Not implemented');
  }

  getDataFormat(bookmarks) {
    return {
      version: 1,
      lastModified: Date.now(),
      deviceId: this.settings.deviceId || 'unknown',
      bookmarks: bookmarks,
      folders: this.extractFolders(bookmarks)
    };
  }

  extractFolders(bookmarks) {
    const folderMap = new Map();
    bookmarks.forEach(bm => {
      if (bm.folder && !folderMap.has(bm.folder)) {
        folderMap.set(bm.folder, {
          id: 'folder_' + bm.folder.toLowerCase().replace(/\s+/g, '_'),
          title: bm.folder,
          createdAt: bm.createdAt
        });
      }
    });
    return Array.from(folderMap.values());
  }

  parseData(data) {
    if (!data) return [];
    if (data.bookmarks && Array.isArray(data.bookmarks)) {
      return data.bookmarks;
    }
    if (Array.isArray(data)) {
      return data;
    }
    return [];
  }
}
