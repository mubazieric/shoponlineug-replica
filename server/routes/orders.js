'use strict';

const express = require('express');
const auth = require('../auth');
const cats = require('../categories');
const catalog = require('../catalog');
const db = require('../db');
const delivery = require('../delivery');

const router = express.Router();

function normalizePhone(p) { return String(p || '').replace(/[^\d+]/g, ''); }

function orderNo() {
  return 'UG' + Math.floor(100000000 + Math.random() * 899999999);
}

function publicOrder(o, store) {
  var d = delivery.deliveryForOrder(store, o.id);
  return {
    id: o.id,
    orderNo: o.orderNo || o.no,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt || o.createdAt,
    name: o.name,
    phone: o.phone,
    email: o.email || '',
    region: o.region,
    town: o.town,
    addr: o.addr,
    lat: o.lat != null ? o.lat : null,
    lng: o.lng != null ? o.lng : null,
    items: o.items || [],
    subtotal: o.subtotal,
    deliveryFee: o.deliveryFee,
    transportFee: o.transportFee,
    total: o.total,
    status: o.status,
    deliveryStatus: d ? d.status : null,
    deliveryStatusLabel: d ? delivery.statusLabel(d.status) : null,
    delivery: d ? delivery.publicDelivery(d) : null,
    pay: o.pay,
    payMethod: o.payMethod,
    payStatus: o.payStatus,
    activity: (o.activity || []).slice(-30),
    vendorIds: (o.items || []).map(function (it) { return it.vendorId; }).filter(Boolean).filter(function (v, i, a) { return a.indexOf(v) === i; })
  };
}

router.post('/', auth.requireAuth, function (req, res) {
  var b = req.body || {};
  var store = db.load();
  var errors = [];

  var rawItems = Array.isArray(b.items) ? b.items : [];
  var items = [];
  rawItems.forEach(function (it) {
    if (!it || it.id == null) return;
    var qty = Math.max(1, Math.min(99, parseInt(it.qty, 10) || 1));
    var p = (store.products || []).find(function (x) { return x.id === it.id; });
    if (p && p.status === 'approved') {
      items.push({ id: p.id, name: p.name, price: p.price, qty: qty, vendorId: p.vendorId || null, img: p.img || 'prod-home' });
      return;
    }
    var c = catalog.find(it.id);
    if (c) {
      items.push({ id: c.id, name: c.name, price: c.price, qty: qty, vendorId: null, img: c.img || 'prod-home', platform: true });
    }
  });
  if (!items.length) errors.push('Your cart is empty or the items are no longer available.');

  var name = String(b.name || req.user.name || '').trim();
  if (name.length < 2) errors.push('Delivery name is required.');
  var phone = normalizePhone(b.phone || req.user.phone);
  if (phone.replace(/\D/g, '').length < 7) errors.push('A reachable phone number is required.');
  var town = String(b.town || '').trim();
  if (!town) errors.push('Town or city is required.');
  var addr = String(b.addr || '').trim();
  if (addr.length < 4) errors.push('Delivery address is required.');

  if (errors.length) return res.status(400).json({ error: errors[0], errors: errors });

  var subtotal = items.reduce(function (n, it) { return n + it.price * it.qty; }, 0);
  var settings = store.settings || {};
  var freeThreshold = Number(settings.freeThreshold != null ? settings.freeThreshold : 200000);
  var deliveryFee = subtotal >= freeThreshold ? 0 : Number(settings.deliveryFee != null ? settings.deliveryFee : 5500);
  var transport = delivery.transportPlan({ subtotal: subtotal, total: subtotal + deliveryFee });
  var now = Date.now();

  var order = {
    id: auth.rid('ord'),
    orderNo: orderNo(),
    userId: req.user.id,
    name: name,
    phone: phone,
    email: req.user.email,
    region: String(b.region || town),
    town: town,
    addr: addr,
    lat: b.lat != null ? Number(b.lat) : null,
    lng: b.lng != null ? Number(b.lng) : null,
    items: items,
    subtotal: subtotal,
    deliveryFee: deliveryFee,
    transportFee: transport.fee,
    total: subtotal + deliveryFee + transport.fee,
    status: 'Pending',
    deliveryStatus: null,
    pay: String(b.pay || 'Pay on Delivery'),
    payMethod: String(b.payMethod || 'pod'),
    payStatus: String(b.payStatus || 'Pending'),
    notes: String(b.notes || '').slice(0, 300),
    activity: [{ at: now, status: 'Pending', text: 'Order placed by ' + name, by: req.user.email }],
    createdAt: now,
    updatedAt: now
  };

  store.orders = store.orders || [];
  store.orders.unshift(order);

  items.forEach(function (it) {
    var p = (store.products || []).find(function (x) { return x.id === it.id; });
    if (p) p.sold = (Number(p.sold) || 0) + it.qty;
  });

  delivery.notifyCustomer(order, null, 'placed', 'Order placed', 'We received order ' + order.orderNo + '. We are preparing it for delivery.');

  /*
   * Platform (ShopOnlineUg) stock can be fulfilled immediately: there is no
   * vendor to confirm, so we auto-approve and drop a pickup job straight into
   * the rider pool. Vendor orders stay "Pending" until the vendor confirms.
   */
  var platformOnly = items.every(function (it) { return !it.vendorId; });
  if (platformOnly) {
    order.status = 'Approved';
    order.activity.push({ at: now, status: 'Approved', text: 'Order approved and queued for pickup.', by: 'system' });
    var dlv = delivery.ensureDelivery(store, order);
    order.deliveryId = dlv.id;
    order.deliveryStatus = dlv.status;
    var targets = delivery.notifyDrivers(dlv, order, 'Pickup available', 'Order ' + order.orderNo + ' is ready for pickup in ' + (dlv.pickupAddress || 'Kampala') + '.');
    order.activity.push({ at: Date.now(), status: 'Approved', text: 'Delivery request broadcast to ' + targets + ' nearby rider' + (targets === 1 ? '' : 's') + '.', by: 'system' });
  }

  store.logs.unshift({ id: auth.rid('l'), at: now, type: 'order.create', orderId: order.id, orderNo: order.orderNo, by: req.user.email, amount: order.total });
  db.saveNow();

  res.json({ ok: true, order: publicOrder(order, store) });
});

router.get('/', auth.requireAuth, function (req, res) {
  var store = db.load();
  var list = (store.orders || []).filter(function (o) { return o.userId === req.user.id; });
  res.json({ ok: true, orders: list.map(function (o) { return publicOrder(o, store); }) });
});

router.get('/:id', auth.requireAuth, function (req, res) {
  var store = db.load();
  var o = (store.orders || []).find(function (x) {
    return x.id === req.params.id || x.orderNo === req.params.id;
  });
  if (!o) return res.status(404).json({ error: 'Order not found.' });
  var isVendor = req.user.role === 'vendor' && (o.items || []).some(function (it) { return it.vendorId === req.user.vendorId; });
  if (o.userId !== req.user.id && !isVendor && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'You do not have access to this order.' });
  }
  var out = publicOrder(o, store);
  var d = delivery.deliveryForOrder(store, o.id);
  if (d && d.driverId) {
    var drv = (store.drivers || []).find(function (x) { return x.id === d.driverId; });
    if (drv) out.driver = { id: drv.id, name: drv.name, rating: delivery.driverRating(drv.id).rating, phone: drv.phone, vehicleType: drv.vehicleType, numberPlate: drv.numberPlate };
  }
  res.json({ ok: true, order: out, statuses: cats.DELIVERY_STATUSES });
});

router.post('/:id/rate-driver', auth.requireAuth, function (req, res) {
  var store = db.load();
  var o = (store.orders || []).find(function (x) { return x.id === req.params.id || x.orderNo === req.params.id; });
  if (!o) return res.status(404).json({ error: 'Order not found.' });
  if (o.userId !== req.user.id) return res.status(403).json({ error: 'You can only rate a driver on your own order.' });
  var out = delivery.rateDriver(o.id, req.user, req.body && req.body.rating, req.body && req.body.text);
  if (out.errors) return res.status(400).json({ error: out.errors[0], errors: out.errors });
  var d = delivery.deliveryForOrder(store, o.id);
  res.json({ ok: true, review: out.review, driver: d ? delivery.publicDriver((store.drivers || []).find(function (x) { return x.id === d.driverId; }), store) : null });
});

router.get('/:id/track', function (req, res) {
  var store = db.load();
  var o = (store.orders || []).find(function (x) { return x.orderNo === req.params.id; });
  if (!o) return res.status(404).json({ error: 'Order not found.' });
  var d = delivery.deliveryForOrder(store, o.id);
  res.json({
    ok: true,
    orderNo: o.orderNo,
    status: o.status,
    placedAt: o.createdAt,
    items: (o.items || []).map(function (it) { return { name: it.name, qty: it.qty }; }),
    total: o.total,
    delivery: d ? delivery.publicDelivery(d) : null,
    stages: cats.DELIVERY_STATUSES
  });
});

module.exports = router;
