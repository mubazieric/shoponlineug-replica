'use strict';

const express = require('express');
const db = require('../db');
const auth = require('../auth');
const cats = require('../categories');
const delivery = require('../delivery');
const ranking = require('../ranking');
const reviews = require('../reviews');

const router = express.Router();

router.use(auth.requireRole('admin'));

function log(type, req, extra) {
  const store = db.load();
  store.logs.unshift(Object.assign({ id: auth.rid('l'), at: Date.now(), type: type, by: req.user ? req.user.email : null }, extra || {}));
  if (store.logs.length > 400) store.logs.length = 400;
}

router.get('/stats', function (req, res) {
  const store = db.load();
  const users = store.users;
  const vendors = store.vendors;
  const products = store.products;
  const orders = store.orders;
  const revenue = orders.reduce(function (n, o) { return n + (o.total || 0); }, 0);
  res.json({
    ok: true,
    stats: {
      users: users.length,
      customers: users.filter(function (u) { return u.role === 'customer'; }).length,
      vendors: vendors.length,
      vendorsPending: vendors.filter(function (v) { return v.status === 'pending'; }).length,
      vendorsApproved: vendors.filter(function (v) { return v.status === 'approved'; }).length,
      products: products.length,
      productsPending: products.filter(function (p) { return p.status === 'pending'; }).length,
      productsApproved: products.filter(function (p) { return p.status === 'approved'; }).length,
      productsRejected: products.filter(function (p) { return p.status === 'rejected'; }).length,
      orders: orders.length,
      revenue: revenue,
      suspended: users.filter(function (u) { return u.status === 'suspended'; }).length
    },
    recentLogs: store.logs.slice(0, 12)
  });
});

router.get('/vendors', function (req, res) {
  const status = req.query.status;
  const store = db.load();
  const vendors = store.vendors
    .filter(function (v) { return !status || v.status === status; })
    .map(function (v) {
      const user = store.users.find(function (u) { return u.id === v.userId; });
      const count = store.products.filter(function (p) { return p.vendorId === v.id; }).length;
      return Object.assign({}, v, { user: auth.safeUser(user), productCount: count });
    })
    .sort(function (a, b) { return b.createdAt - a.createdAt; });
  res.json({ ok: true, vendors: vendors });
});

router.post('/vendors/:id/approve', function (req, res) {
  const store = db.load();
  const vendor = store.vendors.find(function (v) { return v.id === req.params.id; });
  if (!vendor) return res.status(404).json({ error: 'Vendor not found.' });
  vendor.status = 'approved';
  vendor.reviewedAt = Date.now();
  vendor.rejectionReason = null;
  const user = store.users.find(function (u) { return u.id === vendor.userId; });
  if (user) { user.role = 'vendor'; user.status = 'active'; user.vendorId = vendor.id; }
  log('admin.vendor.approve', req, { vendorId: vendor.id, storeName: vendor.storeName });
  db.saveNow();
  res.json({ ok: true, vendor: vendor });
});

router.post('/vendors/:id/reject', function (req, res) {
  const store = db.load();
  const vendor = store.vendors.find(function (v) { return v.id === req.params.id; });
  if (!vendor) return res.status(404).json({ error: 'Vendor not found.' });
  vendor.status = 'rejected';
  vendor.reviewedAt = Date.now();
  vendor.rejectionReason = String((req.body || {}).reason || 'Application did not meet our seller requirements.').slice(0, 300);
  log('admin.vendor.reject', req, { vendorId: vendor.id, storeName: vendor.storeName });
  db.saveNow();
  res.json({ ok: true, vendor: vendor });
});

router.post('/vendors/:id/suspend', function (req, res) {
  const store = db.load();
  const vendor = store.vendors.find(function (v) { return v.id === req.params.id; });
  if (!vendor) return res.status(404).json({ error: 'Vendor not found.' });
  vendor.status = vendor.status === 'suspended' ? 'approved' : 'suspended';
  log('admin.vendor.suspend', req, { vendorId: vendor.id, status: vendor.status });
  db.saveNow();
  res.json({ ok: true, vendor: vendor });
});

router.post('/vendors/:id/message', function (req, res) {
  const store = db.load();
  const vendor = store.vendors.find(function (v) { return v.id === req.params.id; });
  if (!vendor) return res.status(404).json({ error: 'Vendor not found.' });
  const b = req.body || {};
  const subject = String(b.subject || 'Message from the ShopOnlineUg team').trim().slice(0, 140) || 'Message from the ShopOnlineUg team';
  const message = String(b.message || '').trim().slice(0, 2000);
  if (message.length < 2) return res.status(400).json({ error: 'Write a short message before sending.' });
  const to = vendor.email;
  if (!to) return res.status(400).json({ error: 'This vendor has no email address on file.' });

  delivery.push({
    toUserId: vendor.userId || null,
    toRole: 'vendor',
    vendorId: vendor.id,
    storeName: vendor.storeName,
    subject: subject,
    title: subject,
    body: message,
    from: 'admin',
    by: req.user.email,
    status: 'unread'
  });

  const fromName = (req.user && req.user.name) || 'ShopOnlineUg admin';
  const html = '<div style="font-family:Arial,Helvetica,sans-serif;background:#f5f6f8;padding:24px">' +
    '<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e8e8e8">' +
    '<div style="background:#2563EB;padding:18px 24px;color:#fff;font-size:18px;font-weight:700">ShopOnlineUg</div>' +
    '<div style="padding:24px;color:#313133;font-size:14px;line-height:1.6">' +
    '<h2 style="margin:0 0 8px;font-size:18px">' + subject + '</h2>' +
    '<p style="margin:0 0 12px;color:#555;white-space:pre-wrap">' + message + '</p>' +
    '<p style="color:#888;font-size:12px;margin:0">Sent by ' + fromName + ' from the ShopOnlineUg admin portal.</p>' +
    '</div></div></div>';

  log('admin.vendor.message', req, { vendorId: vendor.id, storeName: vendor.storeName, subject: subject });
  db.saveNow();
  require('../mailer').sendMail({
    to: to,
    subject: subject,
    text: message + '\n\n-- ' + fromName + ' (ShopOnlineUg admin portal)',
    html: html
  }).then(function () {
    res.json({ ok: true, sentTo: to, notification: true });
  }).catch(function () {
    res.json({ ok: true, sentTo: to, notification: true, note: 'Stored in the vendor hub; email could not be delivered.' });
  });
});

router.get('/products', function (req, res) {
  const status = req.query.status;
  const store = db.load();
  const products = store.products
    .filter(function (p) { return !status || p.status === status; })
    .sort(function (a, b) { return b.createdAt - a.createdAt; })
    .map(function (p) {
      var x = ranking.explain(store, p);
      return Object.assign({}, p, {
        categoryLabel: cats.label(p.category),
        rankScore: x.score,
        rankReason: x.reason,
        needsReview: !!(p.pendingChanges && p.pendingChanges.status === 'pending')
      });
    });
  res.json({ ok: true, products: products });
});

router.post('/products/:id/approve', function (req, res) {
  const store = db.load();
  const product = store.products.find(function (p) { return p.id === req.params.id; });
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  var wasEdit = !!(product.pendingChanges && product.pendingChanges.status === 'pending');
  if (wasEdit) {
    Object.assign(product, product.pendingChanges.changes);
    product.pendingChanges = null;
  }
  product.status = 'approved';
  product.rejectionReason = null;
  product.reviewedAt = Date.now();
  product.reviewedBy = req.user.email;
  if (!product.rate) product.rate = 4.5;
  if (!product.sold) product.sold = 0;
  log('admin.product.approve', req, { productId: product.id, appliedEdit: wasEdit });
  db.saveNow();
  res.json({ ok: true, product: product, appliedEdit: wasEdit });
});

router.post('/products/:id/reject', function (req, res) {
  const store = db.load();
  const product = store.products.find(function (p) { return p.id === req.params.id; });
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  var reason = String((req.body || {}).reason || 'Listing did not meet our marketplace guidelines.').slice(0, 300);
  product.status = 'rejected';
  product.rejectionReason = reason;
  if (product.pendingChanges) {
    product.pendingChanges.status = 'rejected';
    product.pendingChanges.reviewedAt = Date.now();
    product.pendingChanges.reviewedBy = req.user.email;
  }
  log('admin.product.reject', req, { productId: product.id, reason: reason });
  db.saveNow();
  res.json({ ok: true, product: product });
});

router.post('/products/:id/promote', function (req, res) {
  const store = db.load();
  const product = store.products.find(function (p) { return p.id === req.params.id; });
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  const on = (req.body || {}).promoted != null ? !!req.body.promoted : !product.promoted;
  product.promoted = on;
  if (on) {
    product.promotedAt = Date.now();
    product.promotedBy = req.user.email;
  }
  log('admin.product.promote', req, { productId: product.id, promoted: on });
  db.saveNow();
  res.json({ ok: true, product: product, promoted: on });
});

router.get('/ranking', function (req, res) {
  const store = db.load();
  var list = store.products.filter(function (p) { return p.status === 'approved'; });
  if (req.query.category) list = list.filter(function (p) { return p.category === req.query.category; });
  const ranked = ranking.rank(store, list, {});
  res.json({
    ok: true,
    ranked: ranked.scored.slice(0, 100).map(function (s) {
      return { id: s.product.id, name: s.product.name, category: s.product.category, score: s.score, reason: s.reason, promoted: !!s.product.promoted };
    }),
    vendors: store.vendors.map(function (v) { return ranking.vendorScore(store, v.id); }).sort(function (a, b) { return b.score - a.score; }),
    flagged: ranking.flaggedVendors(store)
  });
});

router.get('/users', function (req, res) {
  const q = String(req.query.q || '').toLowerCase();
  const role = req.query.role;
  const store = db.load();
  const users = store.users
    .filter(function (u) { return (!role || u.role === role); })
    .filter(function (u) { return !q || u.name.toLowerCase().indexOf(q) !== -1 || u.email.toLowerCase().indexOf(q) !== -1; })
    .map(function (u) { return auth.safeUser(u); })
    .sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
  res.json({ ok: true, users: users });
});

router.post('/users/:id/status', function (req, res) {
  const store = db.load();
  const user = store.users.find(function (u) { return u.id === req.params.id; });
  if (!user) return res.status(404).json({ error: 'User not found.' });
  if (user.role === 'admin') return res.status(400).json({ error: 'Admin accounts cannot be suspended.' });
  const status = (req.body || {}).status === 'suspended' ? 'suspended' : 'active';
  user.status = status;
  log('admin.user.status', req, { userId: user.id, status: status });
  db.saveNow();
  res.json({ ok: true, user: auth.safeUser(user) });
});

router.put('/orders/:id/status', function (req, res) {
  const status = String(req.body.status || '').toLowerCase();
  const allowed = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
  if (allowed.indexOf(status) < 0) return res.status(400).json({ error: 'Invalid order status.' });
  const store = db.load();
  const o = store.orders.find(function (x) { return x.id === req.params.id; });
  if (!o) return res.status(404).json({ error: 'Order not found.' });
  o.status = status;
  o.activity = o.activity || [];
  o.activity.push({ at: Date.now(), text: 'Status changed to ' + status + ' by admin.' });
  store.logs = store.logs || [];
  store.logs.unshift({ at: Date.now(), type: 'order', orderId: o.id, adminId: req.user.id, text: 'Order ' + o.no + ' set to ' + status });
  db.saveNow(store);
  res.json({ ok: true, order: o });
});

router.get('/orders', function (req, res) {
  res.json({ ok: true, orders: db.load().orders });
});

router.get('/reviews', function (req, res) {
  const store = db.load();
  var list = (store.reviews || []).slice();
  if (req.query.subjectType) list = list.filter(function (r) { return r.subjectType === req.query.subjectType; });
  if (req.query.status) list = list.filter(function (r) { return r.status === req.query.status; });
  res.json({ ok: true, reviews: list.sort(function (a, b) { return b.createdAt - a.createdAt; }).slice(0, 200) });
});

router.get('/drivers', function (req, res) {
  const store = db.load();
  const status = req.query.status;
  const drivers = (store.drivers || [])
    .filter(function (d) { return !status || d.status === status; })
    .map(function (d) {
      return Object.assign(delivery.fullDriver(d), {
        rating: delivery.driverRating(d.id),
        stats: delivery.driverStats(store, d.id)
      });
    })
    .sort(function (a, b) { return b.createdAt - a.createdAt; });
  res.json({
    ok: true,
    drivers: drivers,
    counts: {
      pending: (store.drivers || []).filter(function (d) { return d.status === 'pending'; }).length,
      approved: (store.drivers || []).filter(function (d) { return d.status === 'approved'; }).length,
      suspended: (store.drivers || []).filter(function (d) { return d.status === 'suspended'; }).length,
      rejected: (store.drivers || []).filter(function (d) { return d.status === 'rejected'; }).length
    },
    vehicleTypes: cats.VEHICLE_TYPES,
    settings: delivery.settings()
  });
});

router.post('/drivers', auth.requireRole('admin'), function (req, res) {
  const b = req.body || {};
  const store = db.load();
  if (b.phone && delivery.findByPhone(b.phone)) return res.status(409).json({ error: 'A driver already exists with that phone number.' });
  const draft = Object.assign({}, b, { email: b.email || '', userId: null, appliedVia: 'admin' });
  const checked = delivery.validate(draft);
  const completeness = delivery.recordCompleteness(checked.values);
  if (checked.errors) return res.status(400).json({ error: checked.errors[0], errors: checked.errors });

  const now = Date.now();
  const driver = Object.assign({
    id: auth.rid('drv'),
    status: b.status === 'approved' && completeness.complete ? 'approved' : 'pending',
    licenseFile: b.licenseFile || null,
    nationalIdFile: b.nationalIdFile || null,
    selfieFile: b.selfieFile || null,
    gpsEnabled: true,
    lastLat: null, lastLng: null, lastPingAt: null,
    responseMs: 0,
    rejectionReason: null,
    reviewedAt: Date.now(),
    reviewedBy: req.user.email,
    createdAt: now, updatedAt: now
  }, checked.values);

  store.drivers = store.drivers || [];
  store.drivers.push(driver);
  log('admin.driver.add', req, { driverId: driver.id, name: driver.name });
  db.saveNow();
  res.json({ ok: true, driver: Object.assign(delivery.fullDriver(driver), { completeness: completeness }) });
});

router.post('/drivers/:id/status', function (req, res) {
  const store = db.load();
  const d = (store.drivers || []).find(function (x) { return x.id === req.params.id; });
  if (!d) return res.status(404).json({ error: 'Driver not found.' });
  const status = String((req.body || {}).status || '');
  if (['approved', 'rejected', 'suspended', 'pending'].indexOf(status) === -1) return res.status(400).json({ error: 'Unknown driver status.' });
  const completeness = delivery.recordCompleteness(d);
  if (status === 'approved' && !completeness.complete) {
    return res.status(400).json({ error: 'This driver is still missing records.', completeness: completeness });
  }
  const prev = d.status;
  d.status = status;
  d.reviewedAt = Date.now();
  d.reviewedBy = req.user.email;
  if (status === 'rejected' || status === 'suspended') {
    d.rejectionReason = String((req.body || {}).reason || (status === 'suspended' ? 'Suspended by admin.' : 'Records did not meet our requirements.')).slice(0, 300);
  } else {
    d.rejectionReason = null;
  }
  if (status === 'suspended') {
    (store.deliveries || []).forEach(function (x) {
      if (x.driverId === d.id && ['assigned', 'picked', 'transit', 'arrived'].indexOf(x.status) !== -1) {
        x.status = 'approved';
        x.driverId = null;
        x.updatedAt = Date.now();
        x.events = x.events || [];
        x.events.push({ at: Date.now(), status: 'approved', by: req.user.email, byRole: 'admin', note: 'Returned to the pool after the driver was suspended' });
      }
    });
  }
  log('admin.driver.status', req, { driverId: d.id, from: prev, to: status });
  db.saveNow();
  res.json({ ok: true, driver: Object.assign(delivery.fullDriver(d), { completeness: completeness }) });
});

router.get('/deliveries', function (req, res) {
  const store = db.load();
  var list = (store.deliveries || []).slice();
  if (req.query.status) list = list.filter(function (d) { return d.status === req.query.status; });
  if (req.query.driverId) list = list.filter(function (d) { return d.driverId === req.query.driverId; });
  const enriched = list.map(function (d) {
    var o = (store.orders || []).find(function (x) { return x.id === d.orderId; });
    var drv = d.driverId ? (store.drivers || []).find(function (x) { return x.id === d.driverId; }) : null;
    return Object.assign(delivery.publicDelivery(d), {
      orderNo: o ? (o.orderNo || o.no) : null,
      customerName: o ? o.name : null,
      customerPhone: o ? o.phone : null,
      town: o ? o.town : null,
      addr: o ? o.addr : null,
      vendorName: drv ? drv.name : null,
      vehicleType: drv ? drv.vehicleType : null,
      numberPlate: drv ? drv.numberPlate : null,
      driverPhone: drv ? drv.phone : null
    });
  }).sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });

  var revenue = enriched.reduce(function (n, d) { return n + (Number(d.transportFee) || 0); }, 0);
  res.json({
    ok: true,
    deliveries: enriched,
    transactions: {
      count: enriched.length,
      transportRevenue: revenue,
      delivered: enriched.filter(function (d) { return d.status === 'delivered'; }).length,
      inTransit: enriched.filter(function (d) { return ['assigned', 'picked', 'transit', 'arrived'].indexOf(d.status) !== -1; }).length,
      awaitingDriver: enriched.filter(function (d) { return d.status === 'approved' && !d.driverId; }).length,
      cancelled: enriched.filter(function (d) { return d.status === 'cancelled'; }).length,
      transportPaid: enriched.filter(function (d) { return d.transportPaid; }).length
    },
    statuses: cats.DELIVERY_STATUSES,
    settings: delivery.settings()
  });
});

router.put('/deliveries/:id/status', function (req, res) {
  const store = db.load();
  var out = delivery.advance(store, req.params.id, String((req.body || {}).status || ''), {
    by: req.user.email,
    byRole: 'admin',
    note: (req.body || {}).note ? String(req.body.note).slice(0, 200) : null
  });
  if (out.error) return res.status(out.status || 400).json({ error: out.error });
  log('admin.delivery.status', req, { deliveryId: out.delivery.id, status: out.delivery.status });
  db.saveNow();
  res.json({ ok: true, delivery: delivery.publicDelivery(out.delivery) });
});

router.get('/notifications', function (req, res) {
  res.json({ ok: true, notifications: delivery.notifications().slice(0, 150) });
});

router.get('/logs', function (req, res) {
  res.json({ ok: true, logs: db.load().logs.slice(0, 120) });
});

const SETTINGS_WHITELIST = [
  'siteName', 'tagline', 'currencyCode', 'deliveryFee', 'freeThreshold',
  'bannerStripVisible', 'dealPopupVisible', 'themeAccent',
  'transportFee', 'freeTransportThreshold', 'deliveryRadiusKm', 'googleMapsApiKey',
  'driverGpsRequired', 'driverRatingFloor', 'vendorRatingFloor'
];

router.get('/settings', function (req, res) {
  const store = db.load();
  const out = {};
  SETTINGS_WHITELIST.forEach(function (k) { if (store.settings && store.settings[k] !== undefined) out[k] = store.settings[k]; });
  res.json({ ok: true, settings: Object.assign({}, SETTINGS_DEFAULTS(), out) });
});

router.put('/settings', function (req, res) {
  const b = (req.body || {}).settings || req.body || {};
  const store = db.load();
  if (!store.settings) store.settings = {};
  const errors = [];
  if (b.siteName !== undefined && String(b.siteName).trim().length < 2) errors.push('Site name must be at least 2 characters.');
  const fee = Number(b.deliveryFee);
  if (b.deliveryFee !== undefined && (!isFinite(fee) || fee < 0)) errors.push('Delivery fee must be a valid amount.');
  const thr = Number(b.freeThreshold);
  if (b.freeThreshold !== undefined && (!isFinite(thr) || thr < 0)) errors.push('Free-delivery threshold must be a valid amount.');
  if (errors.length) return res.status(400).json({ error: errors[0], errors: errors });
  SETTINGS_WHITELIST.forEach(function (k) {
    if (b[k] !== undefined) store.settings[k] = String(b[k]).replace(/^[\s"']+|[\s"']+$/g, '');
  });
  if (b.deliveryFee !== undefined) store.settings.deliveryFee = Math.round(fee);
  if (b.freeThreshold !== undefined) store.settings.freeThreshold = Math.round(thr);
  if (b.bannerStripVisible !== undefined) store.settings.bannerStripVisible = !!b.bannerStripVisible;
  if (b.dealPopupVisible !== undefined) store.settings.dealPopupVisible = !!b.dealPopupVisible;
  if (b.transportFee !== undefined) store.settings.transportFee = Math.max(0, Math.round(Number(b.transportFee) || 0));
  if (b.freeTransportThreshold !== undefined) store.settings.freeTransportThreshold = Math.max(0, Math.round(Number(b.freeTransportThreshold) || 0));
  if (b.deliveryRadiusKm !== undefined) store.settings.deliveryRadiusKm = Math.max(1, Math.round(Number(b.deliveryRadiusKm) || 25));
  if (b.driverGpsRequired !== undefined) store.settings.driverGpsRequired = !!b.driverGpsRequired;
  if (b.driverRatingFloor !== undefined) store.settings.driverRatingFloor = Math.min(5, Math.max(0, Number(b.driverRatingFloor) || 0));
  if (b.vendorRatingFloor !== undefined) store.settings.vendorRatingFloor = Math.min(5, Math.max(0, Number(b.vendorRatingFloor) || 0));
  log('admin.settings.update', req, { keys: SETTINGS_WHITELIST.filter(function (k) { return b[k] !== undefined; }) });
  db.saveNow();
  res.json({ ok: true, settings: publicSettings(store.settings) });
});

router.get('/payouts', function (req, res) {
  const store = db.load();
  const payouts = (store.vendorPayouts || []).map(function (p) {
    const vendor = store.vendors.find(function (v) { return v.id === p.vendorId; });
    return Object.assign({}, p, {
      vendorName: p.vendorName || (vendor ? vendor.storeName : null),
      ownerName: vendor ? vendor.ownerName : null
    });
  });
  res.json({ ok: true, payouts: payouts.sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); }) });
});

router.post('/payouts/:id/pay', function (req, res) {
  const store = db.load();
  const payout = (store.vendorPayouts || []).find(function (p) { return p.id === req.params.id; });
  if (!payout) return res.status(404).json({ error: 'Payout not found.' });
  payout.status = 'paid';
  payout.paidAt = Date.now();
  log('admin.payout.pay', req, { payoutId: payout.id, vendorId: payout.vendorId, amount: payout.amount });
  db.saveNow();
  res.json({ ok: true, payout: payout });
});

router.post('/products', auth.requireRole('admin'), function (req, res) {
  const b = req.body || {};
  const store = db.load();
  const errors = [];
  if (!b.name || String(b.name).trim().length < 3) errors.push('Product name is required.');
  const price = Number(b.price);
  if (!price || price <= 0) errors.push('Enter a valid price.');
  if (errors.length) return res.status(400).json({ error: errors[0], errors: errors });
  const now = Date.now();
  const category = b.category || 'other';
  if (cats.keys().indexOf(category) === -1) errors.push('Unknown category.');
  const attrs = cats.validateAttributes(category, b.attributes);
  errors.push.apply(errors, attrs.errors);
  if (errors.length) return res.status(400).json({ error: errors[0], errors: errors });
  const product = {
    id: auth.rid('prd'),
    vendorId: (b.vendorId) ? String(b.vendorId) : (req.user.vendorId || 'v-admin'),
    storeName: String((b.vendorId && store.vendors.find(function (v) { return v.id === b.vendorId; })) ? store.vendors.find(function (v) { return v.id === b.vendorId; }).storeName : (b.storeName || 'ShopOnlineUg')),
    name: String(b.name).trim(), category: category,
    price: Math.round(price), old: b.old ? Math.round(Number(b.old)) : Math.round(price),
    stock: b.stock != null && b.stock !== '' ? Math.max(0, parseInt(b.stock, 10) || 0) : 0,
    description: String(b.description || '').trim(), img: b.img || 'prod-home',
    loc: b.loc || 'Kampala', attributes: attrs.values,
    rate: 0, sold: 0, reviewCount: 0, status: 'approved',
    listingOrigin: 'staff', promoted: !!b.promoted, pendingChanges: null,
    rejectionReason: null, createdAt: now, updatedAt: now
  };
  store.products.push(product);
  log('admin.product.add', req, { productId: product.id, name: product.name });
  db.saveNow();
  res.json({ ok: true, product: product });
});

function publicSettings(s) {
  s = s || {};
  return {
    siteName: s.siteName || 'ShopOnlineUg', tagline: s.tagline || "Uganda's online marketplace",
    currencyCode: s.currencyCode || 'UGX', deliveryFee: s.deliveryFee != null ? s.deliveryFee : 5500,
    freeThreshold: s.freeThreshold != null ? s.freeThreshold : 200000,
    transportFee: s.transportFee != null ? s.transportFee : 0,
    freeTransportThreshold: s.freeTransportThreshold != null ? s.freeTransportThreshold : 0,
    deliveryRadiusKm: s.deliveryRadiusKm != null ? s.deliveryRadiusKm : 25,
    googleMapsApiKey: s.googleMapsApiKey || '',
    driverGpsRequired: s.driverGpsRequired !== false,
    driverRatingFloor: s.driverRatingFloor != null ? s.driverRatingFloor : 3.5,
    vendorRatingFloor: s.vendorRatingFloor != null ? s.vendorRatingFloor : 3.5,
    bannerStripVisible: s.bannerStripVisible !== false, dealPopupVisible: s.dealPopupVisible !== false,
    themeAccent: s.themeAccent || '#2563EB'
  };
}
function SETTINGS_DEFAULTS() {
  var base = publicSettings({});
  base.googleMapsApiKey = '';
  base.driverGpsRequired = true;
  base.driverRatingFloor = 3.5;
  base.vendorRatingFloor = 3.5;
  return base;
}

module.exports = router;
