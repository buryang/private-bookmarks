class SupabaseClient extends BaseClient {
  constructor(settings) {
    super(settings);
    this.url = settings.supabaseUrl || '';
    this.anonKey = settings.supabaseAnonKey || '';
    this.tableName = 'bookmarks';
  }

  async download() {
    try {
      const response = await fetch(`${this.url}/rest/v1/${this.tableName}?select=*`, {
        method: 'GET',
        headers: {
          'apikey': this.anonKey,
          'Authorization': `Bearer ${this.anonKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Supabase download failed: ${response.status}`);
      }

      const data = await response.json();
      return this.parseData(data);
    } catch (error) {
      console.error('Supabase download error:', error);
      throw error;
    }
  }

  async upload(bookmarks) {
    const data = this.getDataFormat(bookmarks);
    
    await fetch(`${this.url}/rest/v1/${this.tableName}`, {
      method: 'DELETE',
      headers: {
        'apikey': this.anonKey,
        'Authorization': `Bearer ${this.anonKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      }
    });

    const bookmarksToInsert = data.bookmarks.map(bm => ({
      id: bm.id,
      title: bm.title,
      url: bm.url,
      folder: bm.folder,
      tags: JSON.stringify(bm.tags || []),
      created_at: new Date(bm.createdAt).toISOString(),
      modified_at: new Date(bm.modifiedAt || Date.now()).toISOString()
    }));

    if (bookmarksToInsert.length === 0) {
      return true;
    }

    const response = await fetch(`${this.url}/rest/v1/${this.tableName}`, {
      method: 'POST',
      headers: {
        'apikey': this.anonKey,
        'Authorization': `Bearer ${this.anonKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify(bookmarksToInsert)
    });

    if (!response.ok) {
      throw new Error(`Supabase upload failed: ${response.status}`);
    }

    return true;
  }
}
