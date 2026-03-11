class CustomAPIClient extends BaseClient {
  constructor(settings) {
    super(settings);
    this.apiUrl = settings.customApiUrl || '';
    this.authHeader = settings.customAuthHeader || '';
  }

  getHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };
    if (this.authHeader) {
      if (this.authHeader.startsWith('Bearer ') || this.authHeader.startsWith('Basic ')) {
        headers['Authorization'] = this.authHeader;
      } else {
        headers['X-Custom-Auth'] = this.authHeader;
      }
    }
    return headers;
  }

  async download() {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (response.status === 404 || response.status === 204) return [];
      if (!response.ok) throw new Error(`API download failed: ${response.status}`);

      const data = await response.json();
      return this.parseData(data);
    } catch (error) {
      console.error('Custom API download error:', error);
      throw error;
    }
  }

  async upload(bookmarks) {
    const data = this.getDataFormat(bookmarks);

    const response = await fetch(this.apiUrl, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data)
    });

    if (!response.ok) throw new Error(`API upload failed: ${response.status}`);
    return true;
  }
}
