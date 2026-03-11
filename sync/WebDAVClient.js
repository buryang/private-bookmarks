class WebDAVClient extends BaseClient {
  constructor(settings) {
    super(settings);
    this.baseUrl = settings.webdavUrl || '';
    this.username = settings.webdavUsername || '';
    this.password = settings.webdavPassword || '';
    this.path = settings.webdavPath || '/bookmarks.json';
  }

  getAuthHeader() {
    const credentials = btoa(this.username + ':' + this.password);
    return 'Basic ' + credentials;
  }

  async download() {
    try {
      const response = await fetch(this.baseUrl + this.path, {
        method: 'GET',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 404) {
        return [];
      }

      if (!response.ok) {
        throw new Error(`WebDAV download failed: ${response.status}`);
      }

      const data = await response.json();
      return this.parseData(data);
    } catch (error) {
      console.error('WebDAV download error:', error);
      throw error;
    }
  }

  async upload(bookmarks) {
    const data = this.getDataFormat(bookmarks);
    
    const response = await fetch(this.baseUrl + this.path, {
      method: 'PUT',
      headers: {
        'Authorization': this.getAuthHeader(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`WebDAV upload failed: ${response.status}`);
    }

    return true;
  }

  async exists() {
    try {
      const response = await fetch(this.baseUrl + this.path, {
        method: 'HEAD',
        headers: {
          'Authorization': this.getAuthHeader()
        }
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
