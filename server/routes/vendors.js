'use strict';

const express = require('express');
const db = require('../db');
const auth = require('../auth');
const cats = require('../categories');
const delivery = require('../delivery');
const ranking = require('../ranking');
const reviews = require('../reviews');
const verify = require('../verify');

const router = express.Router();

const CATEGORIES = cats.keys();

const ORDER_STATUSES = ['Pending', 'Approved', 'Packed', 'Shipped', 'Delivered', 'Cancelled'];

function normalizeEmail(e) { return String(e || '').trim().toLowerCase(); }
function validEmail(e) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e); }

function vendorProducts(vendorId) {
  return db.load().products.filter(function (p) { return p.vendorId === vendorId; });
}

function vendorFinance(vendorId) {
  const store = db.load();
  const orders = store.orders.filter(function (o) {
    return (o.items || []).some(function (it) { return it.vendorId === vendorId; });
  });
  const revenue = orders.reduce(function (n, o) {
    (o.items || []).forEach(function (it) { if (it.vendorId === vendorId) n += (it.price || 0) * (it.qty || 0); });
    return n;
  }, 0);
  const unitsSold = orders.reduce(function (n, o) {
    (o.items || []).forEach(function (it) { if (it.vendorId === vendorId) n += (it.qty || 0); });
    return n;
  }, 0);
  const net = Math.round(revenue * 0.9);
  const payouts = (store.vendorPayouts || []).filter(function (p) { return p.vendorId === vendorId; });
  const paidOut = payouts.reduce(function (n, p) { return n + (p.amount || 0); }, 0);
  return {
    orders: orders, revenue: revenue, unitsSold: unitsSold,
    net: net, commission: revenue - net, payouts: payouts, paidOut: paidOut, available: Math.max(0, net - paidOut)
  };
}

function publicVendor(v, user, store) {
  var s = store || db.load();
  var vr = reviews.summary(reviews.published(s, { vendorId: v.id }));
  return {
    id: v.id, storeName: v.storeName, category: v.category, categoryLabel: cats.label(v.category),
    location: v.location,
    description: v.description, taxId: v.taxId || '', website: v.website || '',
    phone: v.phone, email: v.email, ownerName: v.ownerName, status: v.status,
    createdAt: v.createdAt, reviewedAt: v.reviewedAt || null, rejectionReason: v.rejectionReason || null,
    rating: vr.average, ratingCount: vr.count,
    responseMinutes: v.responseMs ? Math.round(v.responseMs / 60000) : null,
    user: auth.safeUser(user)
  };
}

function validateProduct(b) {
  var errors = [];
  if (!b.name || String(b.name).trim().length < 3) errors.push('Product name is required.');
  var price = Number(b.price);
  if (!price || price <= 0) errors.push('Enter a valid price.');
  if (b.category && CATEGORIES.indexOf(b.category) === -1) errors.push('Unknown category.');
  if (b.stock != null && b.stock !== '' && Number(b.stock) < 0) errors.push('Stock cannot be negative.');
  return errors;
}

function applyAttributes(product, category, raw) {
  var checked = cats.validateAttributes(category, raw);
  if (checked.errors.length) return checked.errors;
  product.attributes = checked.values;
  return [];
}

router.get('/categories', function (req, res) {
  res.json({
    ok: true,
    categories: cats.publicList(),
    groups: cats.GROUPS,
    bookGenres: cats.BOOK_GENRES,
    bookLevels: cats.BOOK_LEVELS,
    bookConditions: cats.BOOK_CONDITIONS,
    cameraTypes: cats.CAMERA_TYPES
  });
});

router.get('/ranking/:id', auth.requireRole('vendor'), function (req, res) {
  var store = db.load();
  var vendor = store.vendors.find(function (v) { return v.id === req.params.id; });
  if (!vendor) return res.status(404).json({ error: 'Vendor not found.' });
  res.json({ ok: true, vendor: ranking.vendorScore(store, vendor.id) });
});

router.post('/apply', async function (req, res) {
  try {
    const b = req.body || {};
    const email = normalizeEmail(b.email);
    const errors = [];
    if (!b.ownerName || String(b.ownerName).trim().length < 2) errors.push('Your full name is required.');
    if (!validEmail(email)) errors.push('A valid business email is required.');
    if (!b.storeName || String(b.storeName).trim().length < 2) errors.push('Store name is required.');
    if (!b.phone || String(b.phone).replace(/\D/g, '').length < 7) errors.push('A reachable phone number is required.');
    if (!b.location) errors.push('Please choose your location.');
    if (!b.password || String(b.password).length < 6) errors.push('Password must be at least 6 characters.');
    if (errors.length) return res.status(400).json({ error: errors[0], errors: errors });

    const store = db.load();
    const existing = store.users.find(function (u) { return u.email === email; });
    if (existing && existing.emailVerified) {
      return res.status(409).json({ error: 'An account already uses this email. Sign in and apply from your account.' });
    }

    await verify.issue('vendor', {
      name: String(b.ownerName).trim(), email: email, phone: b.phone,
      passwordHash: auth.hash(b.password),
      payload: {
        storeName: String(b.storeName).trim(),
        category: b.category || 'other',
        location: b.location,
        description: String(b.description || '').trim(),
        taxId: String(b.taxId || '').trim(),
        website: String(b.website || '').trim()
      }
    });
    res.json({ ok: true, email: email, expiresIn: verify.CODE_TTL });
  } catch (e) {
    res.status(500).json({ error: 'Could not submit your application. ' + e.message });
  }
});

router.post('/apply-authed', auth.requireAuth, function (req, res) {
  const b = req.body || {};
  const errors = [];
  if (!b.storeName || String(b.storeName).trim().length < 2) errors.push('Store name is required.');
  if (!b.phone || String(b.phone).replace(/\D/g, '').length < 7) errors.push('A reachable phone number is required.');
  if (!b.location) errors.push('Please choose your location.');
  if (errors.length) return res.status(400).json({ error: errors[0], errors: errors });

  const store = db.load();
  const user = store.users.find(function (u) { return u.id === req.user.id; });
  if (!user) return res.status(404).json({ error: 'Account not found.' });
  if (user.vendorId) return res.status(409).json({ error: 'You already have a vendor application on file.' });

  const now = Date.now();
  const vendor = {
    id: auth.rid('vnd'), userId: user.id, storeName: String(b.storeName).trim(),
    category: b.category || 'other', location: b.location, description: String(b.description || '').trim(),
    taxId: String(b.taxId || '').trim(), website: String(b.website || '').trim(),
    phone: b.phone, email: user.email, ownerName: user.name, status: 'pending',
    createdAt: now, reviewedAt: null, rejectionReason: null
  };
  store.vendors.push(vendor);
  user.vendorId = vendor.id;
  user.role = 'vendor';
  store.logs.unshift({ id: auth.rid('l'), at: now, type: 'vendor.apply', vendorId: vendor.id, email: user.email });
  db.saveNow();
  res.json({ ok: true, vendor: publicVendor(vendor, user), user: auth.safeUser(user) });
});

router.get('/me', auth.requireRole('vendor'), function (req, res) {
  const store = db.load();
  const vendor = store.vendors.find(function (v) { return v.id === req.user.vendorId; })
    || store.vendors.find(function (v) { return v.userId === req.user.id; });
  if (!vendor) return res.status(404).json({ error: 'No vendor profile is linked to this account.' });
  const products = vendorProducts(vendor.id);
  const counts = {
    total: products.length,
    pending: products.filter(function (p) { return p.status === 'pending'; }).length,
    approved: products.filter(function (p) { return p.status === 'approved'; }).length,
    rejected: products.filter(function (p) { return p.status === 'rejected'; }).length
  };
  const fin = vendorFinance(vendor.id);
  const lowStock = products.filter(function (p) { return p.stock != null && p.stock <= 5; }).length;
  const activity = (store.logs || []).filter(function (l) { return l.vendorId === vendor.id; }).slice(0, 10).map(function (l) {
    return {
      at: l.at, type: l.type,
      detail: l.productId ? ('product ' + l.productId) : (l.orderId ? ('order ' + l.orderId) : (l.status ? ('status ' + l.status) : (l.amount ? ('UGX ' + l.amount) : '')))
    };
  });
  res.json({
    ok: true, vendor: publicVendor(vendor, req.user), counts: counts,
    revenue: fin.revenue, net: fin.net, commission: fin.commission, available: fin.available,
    paidOut: fin.paidOut, payouts: fin.payouts.slice().sort(function (a, b) { return b.createdAt - a.createdAt; }),
    ordersCount: fin.orders.length, unitsSold: fin.unitsSold, lowStock: lowStock, activity: activity
  });
});

router.put('/me', auth.requireRole('vendor'), function (req, res) {
  const b = req.body || {};
  const store = db.load();
  const vendor = store.vendors.find(function (v) { return v.id === req.user.vendorId; })
    || store.vendors.find(function (v) { return v.userId === req.user.id; });
  if (!vendor) return res.status(404).json({ error: 'No vendor profile is linked to this account.' });
  const errors = [];
  if (!b.storeName || String(b.storeName).trim().length < 2) errors.push('Store name is required.');
  if (!b.phone || String(b.phone).replace(/\D/g, '').length < 7) errors.push('A reachable phone number is required.');
  if (!b.location) errors.push('Please choose your location.');
  if (errors.length) return res.status(400).json({ error: errors[0], errors: errors });
  vendor.storeName = String(b.storeName).trim();
  if (b.category && CATEGORIES.indexOf(b.category) !== -1) vendor.category = b.category;
  vendor.location = String(b.location).trim();
  vendor.description = String(b.description || '').trim();
  vendor.taxId = String(b.taxId || '').trim();
  vendor.website = String(b.website || '').trim();
  vendor.phone = String(b.phone).trim();
  vendor.updatedAt = Date.now();
  store.logs.unshift({ id: auth.rid('l'), at: Date.now(), type: 'vendor.profile', vendorId: vendor.id, email: req.user.email });
  db.saveNow();
  res.json({ ok: true, vendor: publicVendor(vendor, req.user) });
});

router.get('/notifications', auth.requireRole('vendor'), function (req, res) {
  const list = (db.load().notifications || []).filter(function (n) {
    return n.toRole === 'vendor' && (n.toUserId === req.user.id || n.vendorId === req.user.vendorId);
  });
  res.json({
    ok: true,
    notifications: list.slice(0, 40),
    unread: list.filter(function (n) { return n.status === 'unread'; }).length
  });
});

router.post('/notifications/read', auth.requireRole('vendor'), function (req, res) {
  const ids = (req.body || {}).ids;
  const now = Date.now();
  let updated = 0;
  (db.load().notifications || []).forEach(function (n) {
    if (n.toRole !== 'vendor') return;
    if (n.toUserId !== req.user.id && n.vendorId !== req.user.vendorId) return;
    if (ids && ids.indexOf(n.id) === -1) return;
    if (n.status !== 'unread') return;
    n.status = 'read';
    n.readAt = now;
    updated += 1;
  });
  db.saveNow();
  res.json({ ok: true, updated: updated });
});

router.get('/products', auth.requireRole('vendor'), function (req, res) {
  const store = db.load();
  const products = vendorProducts(req.user.vendorId);
  const ranked = ranking.rank(store, products, {});
  res.json({
    ok: true,
    products: ranked.scored.slice().sort(function (a, b) { return b.product.createdAt - a.product.createdAt; })
      .map(function (s) {
        return Object.assign({}, s.product, {
          rankScore: s.score,
          rankReason: s.reason,
          vendorRating: s.vendorRating,
          vendorReviewCount: s.vendorReviewCount
        });
      })
  });
});

router.post('/products', auth.requireRole('vendor'), function (req, res) {
  const b = req.body || {};
  const category = b.category || 'other';
  const errors = validateProduct(b);
  errors.push.apply(errors, cats.validateAttributes(category, b.attributes).errors);
  if (errors.length) return res.status(400).json({ error: errors[0], errors: errors });
  const store = db.load();
  const vendor = store.vendors.find(function (v) { return v.id === req.user.vendorId; });
  if (!vendor) return res.status(404).json({ error: 'Vendor profile not found.' });
  if (vendor.status !== 'approved') return res.status(403).json({ error: 'Your store must be approved by admin before you can add products.' });

  const now = Date.now();
  const product = {
    id: auth.rid('prd'),
    vendorId: vendor.id,
    storeName: vendor.storeName,
    name: String(b.name).trim(),
    category: category,
    price: Math.round(Number(b.price)),
    old: b.old ? Math.round(Number(b.old)) : Math.round(Number(b.price)),
    stock: b.stock != null && b.stock !== '' ? Math.max(0, parseInt(b.stock, 10) || 0) : 0,
    description: String(b.description || '').trim(),
    img: b.img || 'prod-home',
    loc: b.loc || vendor.location || 'Kampala',
    attributes: cats.validateAttributes(category, b.attributes).values,
    rate: 0, sold: 0, reviewCount: 0,
    status: 'pending',
    listingOrigin: 'vendor',
    promoted: false,
    pendingChanges: null,
    rejectionReason: null,
    createdAt: now, updatedAt: now
  };
  store.products.push(product);
  store.logs.unshift({ id: auth.rid('l'), at: now, type: 'product.submit', vendorId: vendor.id, productId: product.id, email: req.user.email });
  db.saveNow();
  res.json({ ok: true, product: product });
});

router.put('/products/:id', auth.requireRole('vendor'), function (req, res) {
  const store = db.load();
  const product = store.products.find(function (p) { return p.id === req.params.id && p.vendorId === req.user.vendorId; });
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  const b = req.body || {};
  const category = b.category || product.category;
  const errors = validateProduct(b);
  errors.push.apply(errors, cats.validateAttributes(category, b.attributes).errors);
  if (errors.length) return res.status(400).json({ error: errors[0], errors: errors });

  const wasLive = product.status === 'approved';
  const reason = String(b.editReason || '').trim();
  if (wasLive && reason.length < 5) {
    return res.status(400).json({
      error: 'This product is already live. Tell us why it needs to change so our team can review it.',
      errors: ['A reason for the change is required (at least 5 characters).'],
      requiresReason: true
    });
  }

  const next = {};
  if (b.name != null) next.name = String(b.name).trim();
  if (b.price != null) {
    next.price = Math.round(Number(b.price));
    next.old = b.old ? Math.round(Number(b.old)) : next.price;
  }
  if (b.stock != null && b.stock !== '') next.stock = Math.max(0, parseInt(b.stock, 10) || 0);
  if (b.description != null) next.description = String(b.description).trim();
  if (b.img) next.img = b.img;
  if (b.loc) next.loc = b.loc;
  if (b.category) next.category = category;
  if (b.attributes) next.attributes = cats.validateAttributes(category, b.attributes).values;

  const now = Date.now();
  const changed = Object.keys(next).filter(function (k) {
    return JSON.stringify(next[k]) !== JSON.stringify(product[k]);
  });

  if (wasLive) {
    product.pendingChanges = {
      requestedAt: now,
      requestedBy: req.user.email,
      reason: reason.slice(0, 400),
      changes: next,
      changedFields: changed,
      status: 'pending'
    };
    product.status = 'pending';
    product.rejectionReason = null;
    product.updatedAt = now;
    store.logs.unshift({
      id: auth.rid('l'), at: now, type: 'product.reapproval', vendorId: req.user.vendorId,
      productId: product.id, email: req.user.email, reason: reason.slice(0, 200)
    });
    db.saveNow();
    return res.json({
      ok: true,
      product: product,
      preview: Object.assign({}, product, next),
      reapproval: true,
      message: 'Your change was sent for approval. The live listing stays visible until an admin approves it.'
    });
  }

  Object.assign(product, next);
  product.status = 'pending';
  product.rejectionReason = null;
  product.pendingChanges = null;
  product.updatedAt = now;
  store.logs.unshift({ id: auth.rid('l'), at: now, type: 'product.update', vendorId: req.user.vendorId, productId: product.id });
  db.saveNow();
  res.json({ ok: true, product: product, reapproval: false });
});

router.delete('/products/:id', auth.requireRole('vendor'), function (req, res) {
  const store = db.load();
  const before = store.products.length;
  store.products = store.products.filter(function (p) { return !(p.id === req.params.id && p.vendorId === req.user.vendorId); });
  if (store.products.length === before) return res.status(404).json({ error: 'Product not found.' });
  db.saveNow();
  res.json({ ok: true });
});

router.get('/orders', auth.requireRole('vendor'), function (req, res) {
  const store = db.load();
  const orders = store.orders.filter(function (o) {
    return (o.items || []).some(function (it) { return it.vendorId === req.user.vendorId; });
  });
  res.json({
    ok: true,
    orders: orders.slice().sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); }).map(function (o) {
      var d = delivery.deliveryForOrder(store, o.id);
      return Object.assign({}, o, {
        delivery: d ? delivery.publicDelivery(d) : null,
        deliveryStatus: d ? d.status : null,
        deliveryStatusLabel: d ? delivery.statusLabel(d.status) : null
      });
    }),
    deliveryConfig: delivery.settings()
  });
});

router.put('/orders/:id/status', auth.requireRole('vendor'), function (req, res) {
  const store = db.load();
  const order = store.orders.find(function (o) {
    return o.id === req.params.id && (o.items || []).some(function (it) { return it.vendorId === req.user.vendorId; });
  });
  if (!order) return res.status(404).json({ error: 'Order not found for this vendor.' });
  const status = String((req.body || {}).status || '');
  if (ORDER_STATUSES.indexOf(status) === -1) return res.status(400).json({ error: 'Unknown order status.' });
  const now = Date.now();
  order.status = status;
  order.updatedAt = now;
  order.activity = order.activity || [];
  order.activity.push({ at: now, status: status, text: 'Store moved this order to ' + status, by: req.user.email });

  var d = null;
  if (status === 'Approved' || status === 'Packed') {
    d = delivery.ensureDelivery(store, order);
    delivery.notifyDrivers(d, order, 'Pickup ready for order ' + (order.orderNo || order.id),
      'A packed order is waiting for pickup in ' + (order.town || order.region || 'Kampala') + '. Open the rider portal to claim it.');
  } else {
    d = delivery.syncFromOrder(store, order);
    if (status === 'Delivered' && d && d.status !== 'delivered') {
      d = delivery.advance(store, d.id, 'delivered', { by: req.user.email, byRole: 'vendor', note: 'Marked delivered by the store' }).delivery || d;
    }
  }

  store.logs.unshift({
    id: auth.rid('l'), at: now, type: 'vendor.order',
    vendorId: req.user.vendorId, orderId: order.id, status: status, email: req.user.email
  });
  db.saveNow();
  res.json({
    ok: true,
    order: order,
    delivery: d ? delivery.publicDelivery(d) : null,
    driversNotified: status === 'Approved' || status === 'Packed'
  });
});

router.post('/payouts', auth.requireRole('vendor'), function (req, res) {
  const store = db.load();
  const vendor = store.vendors.find(function (v) { return v.id === req.user.vendorId; });
  if (!vendor) return res.status(404).json({ error: 'Vendor profile not found.' });
  const fin = vendorFinance(vendor.id);
  const amount = (req.body || {}).amount ? Math.round(Number((req.body || {}).amount)) : fin.available;
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Enter a valid payout amount.' });
  if (amount > fin.available) return res.status(400).json({ error: 'Insufficient balance to request this payout.' });
  const now = Date.now();
  const payout = { id: auth.rid('pay'), vendorId: vendor.id, amount: amount, status: 'processing', createdAt: now };
  store.vendorPayouts.push(payout);
  store.logs.unshift({ id: auth.rid('l'), at: now, type: 'vendor.payout', vendorId: vendor.id, amount: amount, email: req.user.email });
  db.saveNow();
  res.json({ ok: true, payout: payout, available: fin.available - amount });
});

module.exports = router;
