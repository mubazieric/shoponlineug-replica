'use strict';

const auth = require('./auth');
const db = require('./db');

const SUBJECTS = ['product', 'vendor', 'driver'];

function list(store, query) {
  var q = query || {};
  return (store.reviews || []).filter(function (r) {
    if (q.status && r.status !== q.status) return false;
    if (q.productId && r.productId !== q.productId) return false;
    if (q.vendorId && r.vendorId !== q.vendorId) return false;
    if (q.driverId && r.driverId !== q.driverId) return false;
    if (q.userId && r.userId !== q.userId) return false;
    return true;
  });
}

function published(store, query) {
  var q = Object.assign({}, query || {}, { status: 'published' });
  return list(store, q);
}

function summary(items) {
  var n = items.length;
  var sum = items.reduce(function (a, r) { return a + (Number(r.rating) || 0); }, 0);
  var avg = n ? Math.round((sum / n) * 100) / 100 : 0;
  var buckets = [0, 0, 0, 0, 0];
  items.forEach(function (r) {
    var idx = Math.min(4, Math.max(0, Math.round(Number(r.rating) || 0) - 1));
    buckets[idx] += 1;
  });
  return { count: n, average: avg, distribution: buckets };
}

function normalizeSubject(body) {
  var b = body || {};
  var type = String(b.subjectType || '').toLowerCase();
  if (SUBJECTS.indexOf(type) === -1) {
    if (b.productId) type = 'product';
    else if (b.driverId) type = 'driver';
    else if (b.vendorId) type = 'vendor';
    else type = '';
  }
  return type;
}

function create(body, user) {
  var b = body || {};
  var store = db.load();
  var errors = [];

  var type = normalizeSubject(b);
  if (!type) errors.push('Tell us what you are reviewing.');

  var rating = Number(b.rating);
  if (!isFinite(rating) || rating < 1 || rating > 5) errors.push('Pick a rating between 1 and 5 stars.');

  var text = String(b.text || '').trim();
  if (text.length < 4) errors.push('Please write a short review.');
  if (text.length > 1200) text = text.slice(0, 1200);

  var product = null;
  var vendor = null;
  var driver = null;

  if (type === 'product') {
    product = (store.products || []).find(function (p) { return p.id === b.productId; }) || null;
    if (!product) errors.push('That product no longer exists.');
  } else if (type === 'vendor') {
    vendor = (store.vendors || []).find(function (v) { return v.id === b.vendorId; }) || null;
    if (!vendor) errors.push('That store no longer exists.');
  } else if (type === 'driver') {
    driver = (store.drivers || []).find(function (d) { return d.id === b.driverId; }) || null;
    if (!driver) errors.push('That driver record no longer exists.');
  }

  if (errors.length) return { errors: errors };

  if (b.orderId) {
    var seen = published(store, { productId: product ? product.id : null, vendorId: vendor ? vendor.id : null, driverId: driver ? driver.id : null, userId: user ? user.id : null })
      .filter(function (r) { return r.orderId === b.orderId && r.subjectType === type; });
    if (seen.length && user) return { errors: ['You have already reviewed this ' + type + ' for that order.'] };
  }

  var now = Date.now();
  var review = {
    id: auth.rid('rev'),
    subjectType: type,
    productId: product ? product.id : null,
    vendorId: vendor ? vendor.id : (product ? product.vendorId : null),
    driverId: driver ? driver.id : null,
    orderId: b.orderId ? String(b.orderId) : null,
    userId: user ? user.id : null,
    name: String(b.name || (user ? user.name : '') || 'Shopper').trim().slice(0, 60) || 'Shopper',
    rating: Math.round(rating),
    text: text,
    status: 'published',
    verifiedPurchase: !!b.verifiedPurchase,
    createdAt: now
  };

  store.reviews = store.reviews || [];
  store.reviews.unshift(review);
  if (store.reviews.length > 2000) store.reviews.length = 2000;

  if (product) {
    var s = summary(published(store, { productId: product.id }));
    if (s.count) product.rate = s.average;
    product.reviewCount = s.count;
  }

  store.logs.unshift({
    id: auth.rid('l'), at: now, type: 'review.create',
    subjectType: type, productId: review.productId, vendorId: review.vendorId, driverId: review.driverId,
    by: user ? user.email : null, rating: review.rating
  });

  db.saveNow();
  return { review: review };
}

function hide(id, byEmail) {
  var store = db.load();
  var r = (store.reviews || []).find(function (x) { return x.id === id; });
  if (!r) return null;
  r.status = 'hidden';
  r.hiddenAt = Date.now();
  r.hiddenBy = byEmail || null;
  if (r.productId) {
    var p = (store.products || []).find(function (x) { return x.id === r.productId; });
    if (p) {
      var s = summary(published(store, { productId: p.id }));
      p.reviewCount = s.count;
      if (s.count && p.rateSource === 'reviews') p.rate = s.average;
    }
  }
  store.logs.unshift({ id: auth.rid('l'), at: Date.now(), type: 'review.hide', by: byEmail || null, productId: r.productId, rating: r.rating });
  db.saveNow();
  return r;
}

function decorate(r) {
  return {
    id: r.id, subjectType: r.subjectType, productId: r.productId, vendorId: r.vendorId,
    driverId: r.driverId, orderId: r.orderId, name: r.name, rating: r.rating,
    text: r.text, status: r.status, verifiedPurchase: !!r.verifiedPurchase, createdAt: r.createdAt
  };
}

function publicFor(query) {
  var store = db.load();
  var items = published(store, query).sort(function (a, b) { return b.createdAt - a.createdAt; });
  return {
    reviews: items.slice(0, 100).map(decorate),
    summary: summary(items)
  };
}

module.exports = {
  SUBJECTS: SUBJECTS,
  list: list,
  published: published,
  summary: summary,
  create: create,
  hide: hide,
  decorate: decorate,
  publicFor: publicFor
};
