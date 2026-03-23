/**
 * LAN Client - HTTP client to communicate with LAN Server
 * Used by Electron main process to proxy renderer requests
 */
const http = require('http');

class LanClient {
  constructor() {
    this.serverUrl = null;
    this.connected = false;
  }

  _normalizeTarget(ip, port = 9753) {
    const raw = String(ip || '').trim();
    if (!raw) {
      throw new Error('عنوان السيرفر غير صالح');
    }

    try {
      if (raw.startsWith('http://') || raw.startsWith('https://')) {
        const parsed = new URL(raw);
        return {
          host: parsed.hostname,
          port: Number(parsed.port) || port,
        };
      }
    } catch {
      throw new Error('عنوان السيرفر غير صالح');
    }

    const match = raw.match(/^([^/:\s]+)(?::(\d+))?$/);
    if (!match) {
      throw new Error('عنوان السيرفر غير صالح');
    }

    return {
      host: match[1],
      port: Number(match[2]) || port,
    };
  }

  /** Connect to a server */
  async connect(ip, port = 9753) {
    const target = this._normalizeTarget(ip, port);
    this.serverUrl = `http://${target.host}:${target.port}`;
    try {
      const result = await this._request('GET', '/api/ping');
      if (result.status === 'ok') {
        this.connected = true;
        return { success: true, serverUrl: this.serverUrl, host: target.host, port: target.port };
      }
      throw new Error('Server responded but status is not ok');
    } catch (err) {
      this.serverUrl = null;
      this.connected = false;
      throw new Error(`لا يمكن الاتصال بالسيرفر: ${err.message}`);
    }
  }

  /** Disconnect */
  disconnect() {
    this.serverUrl = null;
    this.connected = false;
  }

  /** Get data by key */
  async getData(key) {
    this._ensureConnected();
    const result = await this._request('GET', `/api/data/${encodeURIComponent(key)}`);
    return result.data;
  }

  /** Set data by key */
  async setData(key, data) {
    this._ensureConnected();
    return this._request('PUT', `/api/data/${encodeURIComponent(key)}`, { data });
  }

  /** Delete data by key */
  async deleteData(key) {
    this._ensureConnected();
    return this._request('DELETE', `/api/data/${encodeURIComponent(key)}`);
  }

  /** Get all data for sync */
  async syncAll() {
    this._ensureConnected();
    const result = await this._request('GET', '/api/sync');
    return result.data;
  }

  /** Ping server */
  async ping() {
    this._ensureConnected();
    return this._request('GET', '/api/ping');
  }

  /** Check connection status */
  isConnected() {
    return this.connected && this.serverUrl !== null;
  }

  _ensureConnected() {
    if (!this.connected || !this.serverUrl) {
      throw new Error('غير متصل بالسيرفر');
    }
  }

  /** Make HTTP request */
  _request(method, path, body = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.serverUrl);
      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000,
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode >= 400) {
              reject(new Error(parsed.error || `HTTP ${res.statusCode}`));
            } else {
              resolve(parsed);
            }
          } catch (e) {
            reject(new Error('Invalid response from server'));
          }
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('انتهت مهلة الاتصال'));
      });

      req.on('error', (err) => {
        reject(new Error(`خطأ في الاتصال: ${err.message}`));
      });

      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  }
}

module.exports = { LanClient };
