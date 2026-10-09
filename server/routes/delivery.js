'use strict';

const express = require('express');
const auth = require('../auth');
const cats = require('../categories');
const db = require('../db');
const delivery = require('../delivery');
const uploads = require('../uploads');

const router = express.Router();

router.get('/config', function (req, res) {
  var cfg = delivery.settings();
  res.json({
    ok: true,
    config: {
      googleMapsApiKey: cfg.googleMapsApiKey,
      driverGpsRequired: cfg.driverGpsRequired,
      driverRatingFloor: cfg.driverRatingFloor,
      driverRatingMinSample: cfg.driverRatingMinSample,
      transportFee: cfg.transportFee,
      freeTransportThreshold: cfg.freeTransportThreshold,
      deliveryRadiusKm: cfg.deliveryRadiusKm
    },
    vehicleTypes: cats.VEHICLE_TYPES,
    deliveryStatuses: cats.DELIVERY_STATUSES,
    requiredFields: delivery.DRIVER_REQUIRED_FIELDS,
    documents: delivery.DOC_FIELDS
  });
});

router.get('/catalog', function (req, res) {
  var store = db.load();
  var drivers = (store.drivers || [])
    .filter(function (d) { return d.status === 'approved'; })
    .map(function (d) { return delivery.catalogDriver(d, store); })
    .sort(function (a, b) { return b.rating - a.rating; });
  res.json({ ok: true, drivers: drivers });
});

router.post('/apply', auth.requireAuth, function (req, res) {
  var store = db.load();
  var b = req.body || {};
  var existing = delivery.findByUser(req.user.id);
  if (existing) {
    return res.status(409).json({ error: 'You already have a driver application on file.', driver: delivery.fullDriver(existing) });
  }
  var clash = delivery.findByPhone(b.phone);
  if (clash) return res.status(409).json({ error: 'A driver application already exists for that phone number.' });

  var draft = Object.assign({}, b, { email: b.email || req.user.email, userId: req.user.id });
  var checked = delivery.validate(draft, { skipDocs: true });
  if (checked.errors.length) return res.status(400).json({ error: checked.errors[0], errors: checked.errors, missing: checked.errors });

  var docMap = { license: 'licenseFile', nationalId: 'nationalIdFile', selfie: 'selfieFile' };
  var docs = {};
  var docErrors = [];
  Object.keys(docMap).forEach(function (key) {
    var raw = b[key] != null ? b[key] : b[docMap[key]];
    if (!raw) { docs[docMap[key]] = null; return; }
    if (typeof raw === 'object') { docs[docMap[key]] = raw; return; }
    var saved = uploads.saveDataUrl(raw, 'driver-' + key);
    if (saved.error) { docErrors.push(key + ': ' + saved.error); return; }
    docs[docMap[key]] = saved;
  });
  if (docErrors.length) return res.status(400).json({ error: docErrors[0], errors: docErrors });
  var docMissing = [];
  if (!docs.licenseFile) docMissing.push("Upload your driver's licence.");
  if (!docs.nationalIdFile) docMissing.push('Upload your National ID.');
  if (!docs.selfieFile) docMissing.push('Take a selfie so we can verify your identity.');
  if (docMissing.length) return res.status(400).json({ error: docMissing[0], errors: docMissing, missing: docMissing });

  var now = Date.now();
  var driver = Object.assign({
    id: auth.rid('drv'),
    userId: req.user.id,
    licenseFile: docs.licenseFile || null,
    nationalIdFile: docs.nationalIdFile || null,
    selfieFile: docs.selfieFile || null,
    status: 'pending',
    appliedVia: 'self',
    gpsEnabled: true,
    lastLat: null,
    lastLng: null,
    lastPingAt: null,
    responseMs: 0,
    rejectionReason: null,
    reviewedAt: null,
    reviewedBy: null,
    createdAt: now,
    updatedAt: now
  }, checked.values);

  store.drivers = store.drivers || [];
  store.drivers.push(driver);
  store.logs.unshift({ id: auth.rid('l'), at: now, type: 'driver.apply', driverId: driver.id, by: req.user.email, email: req.user.email });
  db.saveNow();

  res.json({ ok: true, driver: delivery.fullDriver(driver), completeness: delivery.recordCompleteness(driver) });
});

function requireDriver(req, res, next) {
  var store = db.load();
  var d = delivery.findByUser(req.user.id);
  if (!d) return res.status(404).json({ error: 'No driver profile is linked to this account.' });
  if (d.status === 'suspended') return res.status(403).json({ error: 'Your driver account is suspended. Contact support.' });
  req.driver = d;
  next();
}

router.get('/me', auth.requireAuth, requireDriver, function (req, res) {
  var store = db.load();
  res.json({
    ok: true,
    driver: delivery.fullDriver(req.driver),
    completeness: delivery.recordCompleteness(req.driver),
    stats: delivery.driverStats(store, req.driver.id),
    rating: delivery.driverRating(req.driver.id),
    ratingFlag: delivery.lowRating(req.driver),
    canClaim: delivery.canClaim(store, req.driver),
    settings: delivery.settings()
  });
});

router.put('/me', auth.requireAuth, requireDriver, function (req, res) {
  var store = db.load();
  var b = req.body || {};
  var d = req.driver;
  var draft = {
    name: b.name != null ? b.name : d.name,
    phone: b.phone != null ? b.phone : d.phone,
    email: b.email != null ? b.email : d.email,
    dob: b.dob != null ? b.dob : d.dob,
    vehicleType: b.vehicleType != null ? b.vehicleType : d.vehicleType,
    numberPlate: b.numberPlate != null ? b.numberPlate : d.numberPlate,
    licenseNo: b.licenseNo != null ? b.licenseNo : d.licenseNo,
    licenseExpiry: b.licenseExpiry != null ? b.licenseExpiry : d.licenseExpiry,
    nationalIdNo: b.nationalIdNo != null ? b.nationalIdNo : d.nationalIdNo
  };
  var checked = delivery.validate(draft, { skipDocs: true });
  if (checked.errors.length) return res.status(400).json({ error: checked.errors[0], errors: checked.errors });

  var clash = delivery.findByPhone(checked.values.phone);
  if (clash && clash.id !== d.id) {
    return res.status(409).json({ error: 'That phone number is already used by another driver account.' });
  }

  var wasApproved = d.status === 'approved';
  var completeness = delivery.recordCompleteness({
    name: checked.values.name, dob: checked.values.dob, vehicleType: checked.values.vehicleType,
    numberPlate: checked.values.numberPlate, licenseNo: checked.values.licenseNo,
    licenseExpiry: checked.values.licenseExpiry, nationalIdNo: checked.values.nationalIdNo,
    licenseFile: b.licenseFile || d.licenseFile,
    nationalIdFile: b.nationalIdFile || d.nationalIdFile,
    selfieFile: b.selfieFile || d.selfieFile
  });

  Object.assign(d, checked.values, {
    licenseFile: b.licenseFile || d.licenseFile,
    nationalIdFile: b.nationalIdFile || d.nationalIdFile,
    selfieFile: b.selfieFile || d.selfieFile,
    updatedAt: Date.now()
  });
  if (b.gpsEnabled != null) d.gpsEnabled = !!b.gpsEnabled;

  if (wasApproved && !completeness.complete) d.status = 'pending';
  if (!wasApproved && completeness.complete && d.status === 'pending') {
    store.logs.unshift({ id: auth.rid('l'), at: Date.now(), type: 'driver.records', driverId: d.id, by: req.user.email });
  }

  store.logs.unshift({ id: auth.rid('l'), at: Date.now(), type: 'driver.update', driverId: d.id, by: req.user.email });
  db.saveNow();

  res.json({
    ok: true,
    driver: delivery.fullDriver(d),
    completeness: completeness,
    needsReview: d.status === 'pending' && completeness.complete
  });
});

router.post('/me/documents', auth.requireAuth, requireDriver, function (req, res) {
  var b = req.body || {};
  var map = { license: 'licenseFile', nationalId: 'nationalIdFile', selfie: 'selfieFile' };
  var out = {};
  var errors = [];
  Object.keys(map).forEach(function (key) {
    if (b[key] == null) return;
    var saved = uploads.saveDataUrl(b[key], 'driver-' + key);
    if (saved.error) { errors.push(key + ': ' + saved.error); return; }
    if (req.driver[map[key]]) uploads.remove(req.driver[map[key]]);
    req.driver[map[key]] = saved;
    out[key] = saved;
  });
  if (errors.length) return res.status(400).json({ error: errors[0], errors: errors });
  req.driver.updatedAt = Date.now();
  db.saveNow();
  res.json({ ok: true, documents: out, driver: delivery.fullDriver(req.driver) });
});

router.get('/jobs', auth.requireAuth, requireDriver, function (req, res) {
  var store = db.load();
  var mine = (store.deliveries || []).filter(function (d) { return d.driverId === req.driver.id; });
  var active = mine.filter(function (d) { return ['assigned', 'picked', 'transit', 'arrived'].indexOf(d.status) !== -1; });
  var done = mine.filter(function (d) { return d.status === 'delivered' || d.status === 'cancelled'; });

  var open = (store.deliveries || []).filter(function (d) { return d.status === 'approved' && !d.driverId; });
  if (req.query.vehicle) {
    var mine2 = open.filter(function (d) { return !d.vehicleType || d.vehicleType === req.query.vehicle; });
    if (mine2.length) open = mine2;
  }
  open.sort(function (a, b) { return (a.etaAt || 0) - (b.etaAt || 0); });

  res.json({
    ok: true,
    active: active.map(function (d) { return delivery.publicDelivery(d); }),
    open: open.map(function (d) { return delivery.publicDelivery(d, { redactCustomer: true }); }),
    history: done.sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); }).slice(0, 40).map(function (d) { return delivery.publicDelivery(d); }),
    stats: delivery.driverStats(store, req.driver.id),
    unread: delivery.notifications().filter(function (n) { return n.toDriverId === req.driver.id && n.status === 'unread'; }).length
  });
});

router.post('/jobs/:id/claim', auth.requireAuth, requireDriver, function (req, res) {
  var store = db.load();
  var d = delivery.findDelivery(store, req.params.id);
  if (!d) return res.status(404).json({ error: 'Delivery not found.' });
  if (d.status !== 'approved' || d.driverId) return res.status(409).json({ error: 'Another driver has already taken this delivery.' });
  var gate = delivery.canClaim(store, req.driver);
  if (!gate.ok) return res.status(403).json({ error: gate.error });
  var busy = (store.deliveries || []).filter(function (x) {
    return x.driverId === req.driver.id && ['assigned', 'picked', 'transit', 'arrived'].indexOf(x.status) !== -1;
  }).length;
  if (busy >= 5) return res.status(409).json({ error: 'Finish your current deliveries before taking more.' });

  var out = delivery.advance(store, d.id, 'assigned', {
    driverId: req.driver.id,
    by: req.user.email,
    byRole: 'driver',
    note: 'Driver accepted the pickup request'
  });
  if (out.error) return res.status(409).json({ error: out.error });

  var prior = delivery.responseMs(req.driver.id) || 0;
  store.logs.unshift({
    id: auth.rid('l'), at: Date.now(), type: 'driver.respond', driverId: req.driver.id,
    by: req.user.email, orderId: d.orderId, deliveryId: d.id,
    responseMs: Math.max(60000, Date.now() - (d.createdAt || Date.now()))
  });
  db.saveNow();

  res.json({ ok: true, delivery: delivery.publicDelivery(out.delivery) });
});

router.post('/jobs/:id/advance', auth.requireAuth, requireDriver, function (req, res) {
  var store = db.load();
  var d = delivery.findDelivery(store, req.params.id);
  if (!d) return res.status(404).json({ error: 'Delivery not found.' });
  if (d.driverId !== req.driver.id) return res.status(403).json({ error: 'This delivery is assigned to another driver.' });

  var b = req.body || {};
  var status = String(b.status || '');
  if (status === 'delivered' && !b.confirmHandover) {
    return res.status(400).json({ error: 'Confirm the handover with the customer before marking delivered.' });
  }
  if (status === 'delivered' && d.transportPaidBy === 'customer' && !b.transportPaid) {
    return res.status(400).json({ error: 'Confirm that you collected the transport fee before marking delivered.' });
  }
  var out = delivery.advance(store, d.id, status, {
    by: req.user.email,
    byRole: 'driver',
    note: b.note ? String(b.note).slice(0, 200) : null,
    lat: b.lat != null ? Number(b.lat) : null,
    lng: b.lng != null ? Number(b.lng) : null,
    requireTransportPaid: true,
    transportPaid: !!b.transportPaid
  });
  if (out.error) return res.status(409).json({ error: out.error });
  db.saveNow();
  res.json({ ok: true, delivery: delivery.publicDelivery(out.delivery), customerNotified: true });
});

router.post('/location', auth.requireAuth, requireDriver, function (req, res) {
  var b = req.body || {};
  var lat = Number(b.lat);
  var lng = Number(b.lng);
  if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return res.status(400).json({ error: 'Send a valid latitude and longitude.' });
  }
  var store = db.load();
  var d = req.driver;
  d.lastLat = lat;
  d.lastLng = lng;
  d.lastPingAt = Date.now();
  d.gpsEnabled = b.gpsEnabled != null ? !!b.gpsEnabled : d.gpsEnabled;

  var active = (store.deliveries || []).filter(function (x) {
    return x.driverId === d.id && ['picked', 'transit', 'arrived'].indexOf(x.status) !== -1;
  });
  active.forEach(function (x) {
    x.lastLat = lat;
    x.lastLng = lng;
    x.lastPingAt = Date.now();
    var km = delivery.haversineKm({ lat: x.dropoffLat, lng: x.dropoffLng }, { lat: lat, lng: lng });
    if (km != null) x.distanceKm = km;
  });
  db.save();
  res.json({ ok: true, at: d.lastPingAt, tracking: active.length });
});

router.get('/notifications', auth.requireAuth, requireDriver, function (req, res) {
  var list = delivery.notifications().filter(function (n) { return n.toDriverId === req.driver.id; });
  res.json({ ok: true, notifications: list.slice(0, 60), unread: list.filter(function (n) { return n.status === 'unread'; }).length });
});

router.post('/notifications/read', auth.requireAuth, requireDriver, function (req, res) {
  var ids = (req.body || {}).ids;
  var now = Date.now();
  var n = 0;
  delivery.notifications().forEach(function (x) {
    if (x.toDriverId !== req.driver.id) return;
    if (ids && ids.indexOf(x.id) === -1) return;
    if (x.status !== 'unread') return;
    x.status = 'read';
    x.readAt = now;
    n += 1;
  });
  db.saveNow();
  res.json({ ok: true, updated: n });
});

router.get('/driver/:id', function (req, res) {
  var store = db.load();
  var d = (store.drivers || []).find(function (x) { return x.id === req.params.id; });
  if (!d) return res.status(404).json({ error: 'Driver not found.' });
  res.json({ ok: true, driver: delivery.catalogDriver(d, store) });
});

module.exports = router;
