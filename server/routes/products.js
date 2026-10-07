'use strict';

const express = require('express');
const db = require('../db');
const auth = require('../auth');
const cats = require('../categories');
const ranking = require('../ranking');
const reviews = require('../reviews');

const router = express.Router();

/*
 * Public settings (whitelist only) so the storefront reflects admin choices
 * (site name/tagline/currency/delivery fee/free threshold/banners/theme accent)
 * without requiring an admin login. All values here are storefront-safe.
 */
function publicSettings(s) {
  s = s || {};
  return {
    siteName: s.siteName || 'ShopOnlineUg',
    tagline: s.tagline || "Uganda's online marketplace",
    currencyCode: s.currencyCode || 'UGX',
    deliveryFee: s.deliveryFee != null ? s.deliveryFee : 5500,
    freeThreshold: s.freeThreshold != null ? s.freeThreshold : 200000,
    transportFee: s.transportFee != null ? s.transportFee : 0,
    freeTransportThreshold: s.freeTransportThreshold != null ? s.freeTransportThreshold : 0,
    deliveryRadiusKm: s.deliveryRadiusKm != null ? s.deliveryRadiusKm : 25,
    mapsEnabled: !!s.googleMapsApiKey,
    bannerStripVisible: s.bannerStripVisible !== false,
    dealPopupVisible: s.dealPopupVisible !== false,
    themeAccent: s.themeAccent || '#2563EB'
  };
}

router.get('/settings', function (req, res) {
  const store = db.load();
  const s = (store && store.settings) || {};
  res.json({ ok: true, settings: publicSettings(s) });
});

router.get('/categories', function (req, res) {
  const store = db.load();
  res.json({
    ok: true,
    categories: cats.publicList(),
    groups: cats.GROUPS
  });
});

router.get('/banners', function (req, res) {
  const store = db.load();
  res.json({ ok: true, banners: (store.banners || []).slice().sort(function (a, b) { return (b.sort || 0) - (a.sort || 0); }) });
});

function publicProduct(p, store, meta) {
  var s = store || db.load();
  var m = meta || {};
  var vr = reviews.summary(reviews.published(s, { vendorId: p.vendorId }));
  return {
    id: p.id,
    name: p.name,
    price: p.price,
    old: p.old || p.price,
    rate: p.rate || 4.5,
    reviewCount: p.reviewCount || 0,
    sold: p.sold || 0,
    loc: p.loc || 'Kampala',
    img: p.img || 'prod-home',
    category: p.category || 'other',
    categoryLabel: cats.label(p.category),
    attributes: p.attributes || {},
    seller: p.storeName || 'ShopOnlineUg Vendor',
    vendorId: p.vendorId,
    description: p.description || '',
    stock: p.stock || 0,
    promoted: !!p.promoted,
    listingOrigin: p.listingOrigin || 'staff',
    vendorRating: m.vendorRating != null ? m.vendorRating : vr.average,
    vendorReviewCount: vr.count,
    shareUrl: '/#/p/' + p.id,
    rankScore: m.score != null ? Math.round(m.score * 100) / 100 : null,
    rankReason: m.reason || null
  };
}

router.get('/', function (req, res) {
  var store = db.load();
  var q = req.query || {};
  var list = store.products.filter(function (p) { return p.status === 'approved'; });

  if (q.category) {
    var cat = String(q.category);
    if (cats.keys().indexOf(cat) === -1) return res.status(400).json({ error: 'Unknown category.' });
    list = list.filter(function (p) { return (p.category || 'other') === cat; });
  }
  if (q.vendorId) list = list.filter(function (p) { return p.vendorId === q.vendorId; });
  if (q.q) {
    var needle = String(q.q).toLowerCase();
    list = list.filter(function (p) {
      return (p.name || '').toLowerCase().indexOf(needle) !== -1 ||
        (p.description || '').toLowerCase().indexOf(needle) !== -1 ||
        (p.storeName || '').toLowerCase().indexOf(needle) !== -1;
    });
  }
  if (q.category && cats.hasAttributes(String(q.category))) {
    list = cats.filterByAttributes(list, String(q.category), q);
  }

  var ranked = ranking.rank(store, list, {});
  var products = ranked.scored.map(function (s) { return publicProduct(s.product, store, s); });

  if (q.sort === 'price-asc') products.sort(function (a, b) { return a.price - b.price; });
  else if (q.sort === 'price-desc') products.sort(function (a, b) { return b.price - a.price; });
  else if (q.sort === 'rating') products.sort(function (a, b) { return b.rate - a.rate; });
  else if (q.sort === 'newest') products.sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });

  res.json({
    ok: true,
    products: products,
    ranked: true,
    total: products.length,
    categories: cats.publicList()
  });
});

router.get('/:id', function (req, res) {
  const store = db.load();
  const p = store.products.find(function (x) { return x.id === req.params.id && x.status === 'approved'; });
  if (!p) return res.status(404).json({ error: 'Product not found.' });
  var explain = ranking.explain(store, p);
  var product = publicProduct(p, store, { score: explain.score, reason: explain.reason });
  res.json({
    ok: true,
    product: product,
    ranking: explain,
    reviews: reviews.publicFor({ productId: p.id }),
    vendorReviews: p.vendorId ? reviews.publicFor({ vendorId: p.vendorId }).reviews.slice(0, 5) : [],
    related: ranking.rank(store, store.products.filter(function (x) {
      return x.status === 'approved' && x.id !== p.id && x.category === p.category;
    }), {}).scored.slice(0, 8).map(function (s) { return publicProduct(s.product, store, s); })
  });
});

module.exports = router;
