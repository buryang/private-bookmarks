class GistClient extends BaseClient {
  constructor(settings) {
    super(settings);
    this.token = settings.gistToken || '';
    this.gistId = settings.gistId || '';
    this.filename = 'private-bookmarks.json';
  }

  getHeaders() {
    return {
      'Authorization': `Bearer ${this.token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
  }

  async download() {
    try {
      let url = 'https://api.github.com/gists';
      
      if (this.gistId) {
        url += '/' + this.gistId;
      } else {
        const response = await fetch(url, {
          method: 'GET',
          headers: this.getHeaders()
        });

        if (!response.ok) {
          if (response.status === 404) {
            return [];
          }
          throw new Error(`GitHub API failed: ${response.status}`);
        }

        const gists = await response.json();
        const existingGist = gists.find(g => 
          g.files && g.files[this.filename]
        );

        if (!existingGist) {
          return [];
        }

        this.gistId = existingGist.id;
        url += '/' + this.gistId;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Gist download failed: ${response.status}`);
      }

      const gist = await response.json();
      const file = gist.files[this.filename];
      
      if (!file || !file.content) {
        return [];
      }

      const data = JSON.parse(file.content);
      return this.parseData(data);
    } catch (error) {
      console.error('Gist download error:', error);
      throw error;
    }
  }

  async upload(bookmarks) {
    const data = this.getDataFormat(bookmarks);
    const content = JSON.stringify(data, null, 2);

    const gistData = {
      description: 'Private Bookmarks Backup',
      public: false,
      files: {
        [this.filename]: {
          content: content
        }
      }
    };

    let url = 'https://api.github.com/gists';
    
    if (this.gistId) {
      url += '/' + this.gistId;
    }

    const response = await fetch(url, {
      method: this.gistId ? 'PATCH' : 'POST',
      headers: {
        ...this.getHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(gistData)
    });

    if (!response.ok) {
      throw new Error(`Gist upload failed: ${response.status}`);
    }

    const result = await response.json();
    if (!this.gistId) {
      this.gistId = result.id;
    }

    return true;
  }
}
