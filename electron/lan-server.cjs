/**
 * LAN Server - HTTP REST API for multi-device sync
 * Runs inside Electron main process on the "Server" device
 */
const http = require('http');
const os = require('os');
const { LanDatabase } = require('./lan-database.cjs');

const DEFAULT_PORT = 9753;

class LanServer {
  constructor() {
    this.server = null;
    this.db = null;
    this.port = DEFAULT_PORT;
    this.clients = new Set();
  }

  /** Get local network IP addresses */
  static getLocalIPs() {
    const interfaces = os.networkInterfaces();
    const ips = [];
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          ips.push({ name, address: iface.address });
        }
      }
    }
    return ips;
  }

  /** Start the HTTP server */
  start(port = DEFAULT_PORT) {
    return new Promise((resolve, reject) => {
      if (this.server) {
        resolve({ port: this.port, ips: LanServer.getLocalIPs() });
        return;
      }

      this.db = new LanDatabase();
      this.port = port;

      this.server = http.createServer((req, res) => {
        this._handleRequest(req, res);
      });

      this.server.on('error', (err) => {
        console.error('LAN Server error:', err.message);
        if (err.code === 'EADDRINUSE') {
          // Try next port
          this.server = null;
          this.start(port + 1).then(resolve).catch(reject);
        } else {
          reject(err);
        }
      });

      this.server.listen(port, '0.0.0.0', () => {
        this.port = port;
        console.log(`LAN Server running on port ${port}`);
        resolve({ port: this.port, ips: LanServer.getLocalIPs() });
      });
    });
  }

  /** Stop the server */
  stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.server = null;
          this.db = null;
          console.log('LAN Server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /** Parse request body as JSON */
  _parseBody(req) {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch (e) {
          reject(new Error('Invalid JSON'));
        }
      });
      req.on('error', reject);
    });
  }

  /** Send JSON response */
  _sendJson(res, statusCode, data) {
    res.writeHead(statusCode, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end(JSON.stringify(data));
  }

  /** Route and handle HTTP requests */
  async _handleRequest(req, res) {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      this._sendJson(res, 200, {});
      return;
    }

    const url = new URL(req.url, `http://localhost:${this.port}`);
    const pathname = url.pathname;

    try {
      // GET /api/ping - Health check
      if (req.method === 'GET' && pathname === '/api/ping') {
        this._sendJson(res, 200, { status: 'ok', timestamp: Date.now() });
        return;
      }

      // GET /api/data/:key - Get data by key
      if (req.method === 'GET' && pathname.startsWith('/api/data/')) {
        const key = decodeURIComponent(pathname.slice('/api/data/'.length));
        const data = this.db.getData(key);
        this._sendJson(res, 200, { key, data, lastModified: this.db.getLastModified() });
        return;
      }

      // PUT /api/data/:key - Set data by key
      if (req.method === 'PUT' && pathname.startsWith('/api/data/')) {
        const key = decodeURIComponent(pathname.slice('/api/data/'.length));
        const body = await this._parseBody(req);
        this.db.setData(key, body.data);
        this._sendJson(res, 200, { success: true, lastModified: this.db.getLastModified() });
        return;
      }

      // DELETE /api/data/:key - Delete data by key
      if (req.method === 'DELETE' && pathname.startsWith('/api/data/')) {
        const key = decodeURIComponent(pathname.slice('/api/data/'.length));
        this.db.deleteData(key);
        this._sendJson(res, 200, { success: true });
        return;
      }

      // GET /api/sync - Get all data (for initial sync)
      if (req.method === 'GET' && pathname === '/api/sync') {
        const allData = this.db.getAllData();
        this._sendJson(res, 200, { data: allData, lastModified: this.db.getLastModified() });
        return;
      }

      // GET /api/keys - List all keys
      if (req.method === 'GET' && pathname === '/api/keys') {
        const keys = this.db.getKeys();
        this._sendJson(res, 200, { keys });
        return;
      }

      // 404
      this._sendJson(res, 404, { error: 'Not found' });
    } catch (err) {
      console.error('Request error:', err.message);
      this._sendJson(res, 500, { error: err.message });
    }
  }

  /** Check if server is running */
  isRunning() {
    return this.server !== null;
  }

  /** Get server info */
  getInfo() {
    return {
      running: this.isRunning(),
      port: this.port,
      ips: LanServer.getLocalIPs(),
    };
  }
}

module.exports = { LanServer, DEFAULT_PORT };
