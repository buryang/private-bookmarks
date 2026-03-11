class S3Client extends BaseClient {
  constructor(settings) {
    super(settings);
    this.endpoint = settings.s3Endpoint || '';
    this.region = settings.s3Region || 'us-east-1';
    this.accessKey = settings.s3AccessKey || '';
    this.secretKey = settings.s3SecretKey || '';
    this.bucket = settings.s3Bucket || '';
    this.key = settings.s3Key || 'bookmarks.json';
  }

  getSignature(method, path, query, headers, payload) {
    const date = new Date();
    const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.substring(0, 8);
    
    const canonicalHeaders = Object.entries(headers).sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => `${k.toLowerCase()}:${v}`).join('\n') + '\n';
    const signedHeaders = Object.keys(headers).sort((a, b) => a.localeCompare(b)).join(';');
    
    const canonicalRequest = [
      method,
      path,
      query || '',
      canonicalHeaders,
      signedHeaders,
      payload
    ].join('\n');
    
    const canonicalRequestHash = this.sha256(canonicalRequest);
    
    const credentialScope = `${dateStamp}/${this.region}/s3/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      canonicalRequestHash
    ].join('\n');
    
    const kSecret = 'AWS4' + this.secretKey;
    const kDate = this.hmacSHA256(kSecret, dateStamp);
    const kRegion = this.hmacSHA256(kDate, this.region);
    const kService = this.hmacSHA256(kRegion, 's3');
    const kSigning = this.hmacSHA256(kService, 'aws4_request');
    const signature = this.hmacSHA256Hex(kSigning, stringToSign);
    
    return `AWS4-HMAC-SHA256 Credential=${this.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  }

  sha256(str) {
    const hash = crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  hmacSHA256(key, data) {
    return crypto.subtle.sign('HMAC', { name: 'HMAC', hash: 'SHA-256' }, new TextEncoder().encode(key), new TextEncoder().encode(data)).then(buf => new Uint8Array(buf));
  }

  hmacSHA256Hex(key, data) {
    return this.hmacSHA256(key, data).then(hash => Array.from(hash).map(b => b.toString(16).padStart(2, '0')).join(''));
  }

  async download() {
    const path = `/${this.bucket}/${this.key}`;
    const headers = {
      'Host': new URL(this.endpoint).host,
      'x-amz-date': new Date().toISOString().replace(/[:-]|\.\d{3}/g, '').substring(0, 15)
    };
    
    const auth = this.getSignature('GET', path, '', headers, '');
    headers['Authorization'] = auth;

    try {
      const response = await fetch(this.endpoint + path, { method: 'GET', headers });
      if (response.status === 404) return [];
      if (!response.ok) throw new Error(`S3 download failed: ${response.status}`);
      const data = await response.json();
      return this.parseData(data);
    } catch (error) {
      console.error('S3 download error:', error);
      throw error;
    }
  }

  async upload(bookmarks) {
    const data = this.getDataFormat(bookmarks);
    const body = JSON.stringify(data);
    const payloadHash = this.sha256(body);
    
    const path = `/${this.bucket}/${this.key}`;
    const headers = {
      'Host': new URL(this.endpoint).host,
      'x-amz-date': new Date().toISOString().replace(/[:-]|\.\d{3}/g, '').substring(0, 15),
      'x-amz-content-sha256': payloadHash,
      'Content-Type': 'application/json'
    };
    
    const auth = this.getSignature('PUT', path, '', headers, payloadHash);
    headers['Authorization'] = auth;

    const response = await fetch(this.endpoint + path, {
      method: 'PUT',
      headers,
      body
    });

    if (!response.ok) throw new Error(`S3 upload failed: ${response.status}`);
    return true;
  }
}
