'use strict';

/*
 * Server-side view of the built-in storefront catalogue.
 *
 * The browser draws its catalogue from js/data.js via buildCatalog(). Rather
 * than duplicate the product list on the server (and let the two drift apart),
 * we load the very same file in a sandboxed VM context and reuse its output.
 * This keeps one source of truth for platform ("ShopOnlineUg") products while
 * still validating every order line against real prices server-side.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

function decodeEntities(s) {
  return String(s == null ? '' : s)
    .replace(/&#(\d+);/g, function (_, n) { return String.fromCharCode(parseInt(n, 10)); })
    .replace(/&#x([0-9a-f]+);/gi, function (_, n) { return String.fromCharCode(parseInt(n, 16)); })
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

let list = [];
let byId = {};

try {
  const file = path.join(__dirname, '..', 'js', 'data.js');
  const code = fs.readFileSync(file, 'utf8');
  const sandbox = { console: console };
  vm.createContext(sandbox);
  vm.runInContext(code + '\nthis.__catalog = (typeof buildCatalog === "function") ? buildCatalog() : [];', sandbox, { timeout: 3000, filename: 'js/data.js' });
  list = (sandbox.__catalog || []).map(function (p) {
    return {
      id: p.id,
      key: p.key,
      name: decodeEntities(p.name),
      brand: decodeEntities(p.brand),
      price: Number(p.price) || 0,
      old: Number(p.old) || 0,
      rate: Number(p.rate) || 0,
      sold: Number(p.sold) || 0,
      img: p.img || 'prod-home',
      loc: p.loc || 'Kampala',
      seller: 'ShopOnlineUg',
      platform: true
    };
  });
  list.forEach(function (p) { byId[p.id] = p; });
} catch (e) {
  try { console.error('[catalog] failed to load js/data.js:', e.message); } catch (e2) {}
  list = [];
  byId = {};
}

function find(id) {
  return byId[id] || null;
}

function all() {
  return list.slice();
}

module.exports = { all: all, find: find, byId: byId, decodeEntities: decodeEntities, size: list.length };
