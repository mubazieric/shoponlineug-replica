'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.SOU_DATA_DIR ? path.resolve(process.env.SOU_DATA_DIR) : path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const UPLOAD_DIR = process.env.SOU_UPLOAD_DIR ? path.resolve(process.env.SOU_UPLOAD_DIR) : path.join(__dirname, 'uploads');

const DEFAULT = {
  users: [],
  vendors: [],
  products: [],
  orders: [],
  pending: [],
  outbox: [],
  vendorPayouts: [],
  logs: [],
  drivers: [],
  deliveries: [],
  reviews: [],
  notifications: [],
  promoCampaigns: [],
  settings: {
    siteName: 'ShopOnlineUg',
    tagline: 'Uganda\'s online marketplace',
    currencyCode: 'UGX',
    deliveryFee: 5500,
    freeThreshold: 200000,
    transportFee: 3500,
    freeTransportThreshold: 500000,
    bannerStripVisible: true,
    dealPopupVisible: true,
    themeAccent: '#2563EB',
    googleMapsApiKey: '',
    driverGpsRequired: true,
    driverRatingFloor: 3.5,
    deliveryRadiusKm: 60
  },
  meta: { seeded: false, createdAt: null }
};

let state = null;
let timer = null;

function clone(o) { return JSON.parse(JSON.stringify(o)); }

function load() {
  if (state) return state;
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(DB_FILE)) {
      const raw = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      state = Object.assign(clone(DEFAULT), raw);
      state.meta = Object.assign(clone(DEFAULT.meta), raw.meta || {});
      Object.keys(DEFAULT).forEach(function (k) {
        if (!Array.isArray(DEFAULT[k]) && k !== 'meta' && !Array.isArray(raw[k]) && typeof raw[k] === 'object') {
          state[k] = Object.assign(clone(DEFAULT[k]), raw[k] || {});
        }
      });
    } else {
      state = clone(DEFAULT);
      state.meta.createdAt = new Date().toISOString();
    }
  } catch (e) {
    console.error('[db] failed to load, starting fresh:', e.message);
    state = clone(DEFAULT);
  }
  return state;
}

function writeNow() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = DB_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
    fs.renameSync(tmp, DB_FILE);
  } catch (e) {
    console.error('[db] write failed:', e.message);
  }
}

function save() {
  load();
  if (timer) return;
  timer = setTimeout(function () { timer = null; writeNow(); }, 25);
}

function saveNow() {
  load();
  if (timer) { clearTimeout(timer); timer = null; }
  writeNow();
}

module.exports = {
  load: load, save: save, saveNow: saveNow,
  DATA_DIR: DATA_DIR, DB_FILE: DB_FILE, UPLOAD_DIR: UPLOAD_DIR
};
