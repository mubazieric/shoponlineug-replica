'use strict';

const fs = require('fs');
const path = require('path');
const auth = require('./auth');
const db = require('./db');

const MAX_BYTES = 3 * 1024 * 1024;
const EXT_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic'
};

function ensureDir() {
  if (!fs.existsSync(db.UPLOAD_DIR)) fs.mkdirSync(db.UPLOAD_DIR, { recursive: true });
  return db.UPLOAD_DIR;
}

function parseDataUrl(value) {
  var s = String(value || '').trim();
  var m = /^data:([a-z0-9.+/-]+);base64,([\s\S]+)$/i.exec(s);
  if (!m) return null;
  var mime = m[1].toLowerCase();
  if (!EXT_BY_MIME[mime]) return null;
  var buf;
  try {
    buf = Buffer.from(m[2].replace(/\s+/g, ''), 'base64');
  } catch (e) {
    return null;
  }
  if (!buf.length || buf.length > MAX_BYTES) return null;
  return { mime: mime, ext: EXT_BY_MIME[mime], buffer: buf };
}

function publicPath(file) {
  return '/uploads/' + file.name;
}

function saveDataUrl(value, prefix) {
  var parsed = parseDataUrl(value);
  if (!parsed) return { error: 'Upload a JPG, PNG or WEBP image smaller than 3MB.' };
  var name = (prefix || 'file') + '-' + auth.rid('').replace(/^/, '') + '.' + parsed.ext;
  name = name.replace(/[^A-Za-z0-9._-]/g, '');
  ensureDir();
  fs.writeFileSync(path.join(db.UPLOAD_DIR, name), parsed.buffer);
  return {
    name: name,
    url: publicPath({ name: name }),
    mime: parsed.mime,
    bytes: parsed.buffer.length,
    uploadedAt: Date.now()
  };
}

function remove(file) {
  if (!file || !file.name) return;
  try {
    var full = path.join(db.UPLOAD_DIR, path.basename(file.name));
    if (fs.existsSync(full)) fs.unlinkSync(full);
  } catch (e) {
    console.error('[uploads] remove failed:', e.message);
  }
}

function exists(file) {
  if (!file || !file.name) return false;
  try {
    return fs.existsSync(path.join(db.UPLOAD_DIR, path.basename(file.name)));
  } catch (e) {
    return false;
  }
}

module.exports = {
  MAX_BYTES: MAX_BYTES,
  EXT_BY_MIME: EXT_BY_MIME,
  ensureDir: ensureDir,
  parseDataUrl: parseDataUrl,
  publicPath: publicPath,
  saveDataUrl: saveDataUrl,
  remove: remove,
  exists: exists
};
