/**
 * LAN Database - Simple JSON file-based storage for server mode
 * Stores finance data in a JSON file in the app's user data directory
 */
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class LanDatabase {
  constructor() {
    const userDataPath = app.getPath('userData');
    this.dbDir = path.join(userDataPath, 'lan-data');
    this.dbPath = path.join(this.dbDir, 'finance-data.json');
    this._ensureDir();
  }

  _ensureDir() {
    if (!fs.existsSync(this.dbDir)) {
      fs.mkdirSync(this.dbDir, { recursive: true });
    }
  }

  _readAll() {
    try {
      if (fs.existsSync(this.dbPath)) {
        return JSON.parse(fs.readFileSync(this.dbPath, 'utf8'));
      }
    } catch (err) {
      console.error('LanDB read error:', err.message);
    }
    return {};
  }

  _writeAll(data) {
    try {
      this._ensureDir();
      fs.writeFileSync(this.dbPath, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      console.error('LanDB write error:', err.message);
    }
  }

  /** Get data for a specific user/key */
  getData(key) {
    const all = this._readAll();
    return all[key] || null;
  }

  /** Set data for a specific user/key */
  setData(key, value) {
    const all = this._readAll();
    all[key] = value;
    all._lastModified = Date.now();
    this._writeAll(all);
  }

  /** Get all keys */
  getKeys() {
    const all = this._readAll();
    return Object.keys(all).filter(k => k !== '_lastModified');
  }

  /** Get last modified timestamp */
  getLastModified() {
    const all = this._readAll();
    return all._lastModified || 0;
  }

  /** Delete a key */
  deleteData(key) {
    const all = this._readAll();
    delete all[key];
    this._writeAll(all);
  }

  /** Get all data (for sync) */
  getAllData() {
    return this._readAll();
  }

  /** Replace all data (for bulk import) */
  setAllData(data) {
    this._writeAll(data);
  }
}

module.exports = { LanDatabase };
