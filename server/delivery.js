'use strict';

const auth = require('./auth');
const db = require('./db');
const cats = require('./categories');
const reviews = require('./reviews');

const DRIVER_REQUIRED_FIELDS = [
  { key: 'name', label: 'Full name', type: 'text' },
  { key: 'dob', label: 'Date of birth', type: 'date' },
  { key: 'vehicleType', label: 'Vehicle', type: 'select', options: cats.VEHICLE_TYPES },
  { key: 'numberPlate', label: 'Number plate', type: 'text' },
  { key: 'licenseNo', label: "Driver's licence number", type: 'text' },
  { key: 'licenseExpiry', label: "Driver's licence expiry date", type: 'date' },
  { key: 'nationalIdNo', label: 'National ID number', type: 'text' }
];

const DOC_FIELDS = [
  { key: 'licenseFile', label: "Driver's licence photo" },
  { key: 'nationalIdFile', label: 'National ID photo' },
  { key: 'selfieFile', label: 'Selfie photo' }
];

function store() { return db.load(); }

function num(v, f) { var n = Number(v); return isFinite(n) ? n : (f == null ? 0 : f); }

function settings() {
  var s = store().settings || {};
  return {
    googleMapsApiKey: s.googleMapsApiKey || process.env.GOOGLE_MAPS_API_KEY || '',
    driverGpsRequired: s.driverGpsRequired !== false,
    driverRatingFloor: num(s.driverRatingFloor, 3.5),
    driverRatingMinSample: Math.max(1, num(s.driverRatingMinSample, 5)),
    transportFee: num(s.transportFee, 3500),
    freeTransportThreshold: num(s.freeTransportThreshold, 500000),
    deliveryRadiusKm: num(s.deliveryRadiusKm, 60)
  };
}

function notifications() {
  var s = store();
  s.notifications = s.notifications || [];
  return s.notifications;
}

function push(notification) {
  var list = notifications();
  var record = Object.assign({
    id: auth.rid('ntf'),
    createdAt: Date.now(),
    readAt: null,
    status: 'unread'
  }, notification);
  list.unshift(record);
  if (list.length > 500) list.length = 500;
  return record;
}

function notifyCustomer(order, delivery, status, label, body) {
  if (!order || !order.userId) return null;
  return push({
    toUserId: order.userId,
    toRole: 'customer',
    orderId: order.id,
    orderNo: order.orderNo || order.no || null,
    deliveryId: delivery ? delivery.id : null,
    event: status,
    title: label,
    body: body
  });
}

function notifyDriver(driverId, order, delivery, status, label, body) {
  if (!driverId) return null;
  return push({
    toDriverId: driverId,
    toRole: 'driver',
    orderId: order ? order.id : null,
    orderNo: order ? (order.orderNo || order.no || null) : null,
    deliveryId: delivery ? delivery.id : null,
    event: status,
    title: label,
    body: body
  });
}

function notifyDrivers(delivery, order, label, body) {
  var s = store();
  var drivers = (s.drivers || []).filter(function (d) { return d.status === 'approved'; });
  var vehicle = delivery.vehicleType || null;
  var targets = drivers.filter(function (d) { return !vehicle || !d.vehicleType || d.vehicleType === vehicle; });
  if (!targets.length) targets = drivers;
  targets.forEach(function (d) { notifyDriver(d.id, order, delivery, 'pickup_request', label, body); });
  return targets.length;
}

function driverRating(driverId) {
  var s = store();
  var sum = summary(s, driverId);
  return {
    rating: sum.average,
    count: sum.count,
    distribution: sum.distribution
  };
}

function summary(s, driverId) {
  return reviews.summary(reviews.published(s, { driverId: driverId }));
}

/*
 * A driver whose published rating has fallen below the configured floor (once
 * enough customers have rated them) is flagged. Flagged drivers keep their
 * active jobs but cannot claim new ones until their rating recovers, which is
 * the marketplace side of the trust balance.
 */
function lowRating(driver) {
  var cfg = settings();
  var r = driverRating(driver && driver.id);
  var enough = r.count >= cfg.driverRatingMinSample;
  var flagged = enough && r.rating > 0 && r.rating < cfg.driverRatingFloor;
  return {
    rating: r.rating,
    count: r.count,
    floor: cfg.driverRatingFloor,
    minSample: cfg.driverRatingMinSample,
    flagged: flagged
  };
}

/*
 * Central claim gate. Every path that attaches a driver to a delivery (driver
 * self-claim and the advance() helper) goes through here so the same rules
 * apply everywhere.
 */
function canClaim(storeRef, driver) {
  if (!driver) return { ok: false, error: 'No driver profile is linked to this account.' };
  if (driver.status !== 'approved') return { ok: false, error: 'Only approved drivers can claim deliveries.' };
  if (settings().driverGpsRequired && driver.gpsEnabled === false) {
    return { ok: false, error: 'Turn on location sharing in your profile before claiming deliveries.' };
  }
  var lr = lowRating(driver);
  if (lr.flagged) {
    return { ok: false, error: 'Your rating (' + lr.rating.toFixed(1) + ' of 5) is below the ' + lr.floor + ' minimum. Contact support to have your account reviewed.' };
  }
  return { ok: true };
}

function hasRecentLocation(storeRef, driverId, withinMs) {
  var drv = (storeRef.drivers || []).find(function (d) { return d.id === driverId; });
  if (!drv || !drv.lastPingAt) return false;
  return Date.now() - drv.lastPingAt <= (withinMs || 30 * 60 * 1000);
}

function driverStats(s, driverId) {
  var list = (s.deliveries || []).filter(function (d) { return d.driverId === driverId; });
  var done = list.filter(function (d) { return d.status === 'delivered'; });
  var earnings = done.reduce(function (n, d) { return n + num(d.driverPay, 0); }, 0);
  var rated = done.filter(function (d) { return d.rating; });
  return {
    total: list.length,
    active: list.filter(function (d) { return ['assigned', 'picked', 'transit', 'arrived'].indexOf(d.status) !== -1; }).length,
    delivered: done.length,
    cancelled: list.filter(function (d) { return d.status === 'cancelled'; }).length,
    onTime: done.filter(function (d) { return d.etaAt && d.deliveredAt && d.deliveredAt <= d.etaAt; }).length,
    earnings: earnings,
    avgRating: rated.length ? Math.round((rated.reduce(function (n, d) { return n + num(d.rating, 0); }, 0) / rated.length) * 100) / 100 : 0
  };
}

function publicDriver(d, s) {
  s = s || store();
  if (!d) return null;
  var r = driverRating(d.id);
  var st = driverStats(s, d.id);
  return {
    id: d.id,
    name: d.name,
    phone: d.phone || '',
    email: d.email || '',
    vehicleType: d.vehicleType || '',
    numberPlate: d.numberPlate || '',
    licenseNo: d.licenseNo || '',
    licenseExpiry: d.licenseExpiry || '',
    nationalIdNo: d.nationalIdNo || '',
    dob: d.dob || '',
    status: d.status,
    rejectionReason: d.rejectionReason || null,
    appliedVia: d.appliedVia || 'self',
    rating: r.rating,
    ratingCount: r.count,
    ratingDistribution: r.distribution,
    gpsEnabled: d.gpsEnabled !== false,
    lastPingAt: d.lastPingAt || null,
    lastLat: d.lastLat != null ? d.lastLat : null,
    lastLng: d.lastLng != null ? d.lastLng : null,
    responseMs: d.responseMs || 0,
    hasDocuments: !!(d.licenseFile && d.nationalIdFile && d.selfieFile),
    documents: {
      license: d.licenseFile ? d.licenseFile.url : null,
      nationalId: d.nationalIdFile ? d.nationalIdFile.url : null,
      selfie: d.selfieFile ? d.selfieFile.url : null
    },
    stats: st,
    createdAt: d.createdAt,
    reviewedAt: d.reviewedAt || null
  };
}

/*
 * Safe, PII-free view of a driver for the public "meet our riders" catalog.
 * No phone, email, licence number, national ID, date of birth or live
 * coordinates - those never leave the server unless the driver is your own.
 */
function catalogDriver(d, s) {
  s = s || store();
  if (!d) return null;
  var r = driverRating(d.id);
  var st = driverStats(s, d.id);
  return {
    id: d.id,
    name: d.name,
    vehicleType: d.vehicleType || '',
    numberPlate: d.numberPlate || '',
    status: d.status,
    rating: r.rating,
    ratingCount: r.count,
    ratingDistribution: r.distribution,
    gpsEnabled: d.gpsEnabled !== false,
    lastPingAt: d.lastPingAt || null,
    responseMs: d.responseMs || 0,
    stats: {
      delivered: st.delivered,
      onTime: st.onTime,
      avgRating: st.avgRating
    },
    createdAt: d.createdAt
  };
}

function fullDriver(d) {
  return Object.assign({}, publicDriver(d), {
    userId: d.userId || null,
    licenseFile: d.licenseFile || null,
    nationalIdFile: d.nationalIdFile || null,
    selfieFile: d.selfieFile || null,
    responseMs: d.responseMs || 0
  });
}

function recordCompleteness(d) {
  var missing = [];
  DRIVER_REQUIRED_FIELDS.forEach(function (f) {
    if (!String(d[f.key] || '').trim()) missing.push(f.label);
  });
  DOC_FIELDS.forEach(function (f) {
    if (!d[f.key]) missing.push(f.label);
  });
  return { complete: missing.length === 0, missing: missing };
}

function validate(draft, opts) {
  opts = opts || {};
  var errors = [];
  var d = draft || {};

  var name = String(d.name || '').trim();
  if (name.length < 2) errors.push('Enter your full name.');
  if (name.length > 80) errors.push('Name is too long.');

  var phone = String(d.phone || '').replace(/\D/g, '');
  if (phone.length < 7) errors.push('Enter a reachable phone number.');

  var dob = String(d.dob || '').trim();
  if (!dob) errors.push('Date of birth is required.');
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) errors.push('Date of birth must be a valid date.');
  else {
    var age = (Date.now() - new Date(dob + 'T00:00:00Z').getTime()) / (365.25 * 86400000);
    if (age < 18) errors.push('Drivers must be at least 18 years old.');
    if (age > 80) errors.push('Please check the date of birth.');
  }

  if (cats.VEHICLE_TYPES.indexOf(d.vehicleType) === -1) errors.push('Choose your vehicle type.');

  var plate = String(d.numberPlate || '').trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9 -]{2,11}$/.test(plate)) errors.push('Enter a valid number plate.');

  var licence = String(d.licenseNo || '').trim();
  if (licence.length < 4) errors.push("Enter your driver's licence number.");

  var expiry = String(d.licenseExpiry || '').trim();
  if (!expiry) errors.push("Enter your driver's licence expiry date.");
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(expiry)) errors.push('Licence expiry must be a valid date.');
  else if (new Date(expiry + 'T23:59:59Z').getTime() < Date.now()) errors.push("Your driver's licence has expired. Upload a valid licence.");

  var nid = String(d.nationalIdNo || '').replace(/\s+/g, '');
  if (nid.length < 8) errors.push('Enter your National ID number.');

  if (!opts.skipDocs) {
    if (!d.licenseFile) errors.push("Upload your driver's licence.");
    if (!d.nationalIdFile) errors.push('Upload your National ID.');
    if (!d.selfieFile) errors.push('Take a selfie so we can verify your identity.');
  }

  return {
    errors: errors,
    values: {
      name: name,
      phone: String(d.phone || '').trim(),
      email: String(d.email || '').trim().toLowerCase(),
      dob: dob,
      vehicleType: d.vehicleType,
      numberPlate: plate,
      licenseNo: licence,
      licenseExpiry: expiry,
      nationalIdNo: nid
    }
  };
}

function findByUser(userId) {
  return (store().drivers || []).find(function (d) { return d.userId === userId; }) || null;
}

function findByPhone(phone) {
  var digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  return (store().drivers || []).find(function (d) {
    return String(d.phone || '').replace(/\D/g, '').indexOf(digits) !== -1 || digits.indexOf(String(d.phone || '').replace(/\D/g, '')) !== -1;
  }) || null;
}

function responseMs(driverId, since) {
  var s = store();
  var list = (s.logs || []).filter(function (l) {
    return l.driverId === driverId && l.responseMs != null && (!since || l.at >= since);
  });
  if (!list.length) return 0;
  return Math.round(list.reduce(function (n, l) { return n + num(l.responseMs, 0); }, 0) / list.length);
}

function transportPlan(order) {
  var cfg = settings();
  var subtotal = num(order.subtotal, num(order.total, 0));
  var free = subtotal >= cfg.freeTransportThreshold;
  var fee = free ? 0 : cfg.transportFee;
  return {
    subtotal: subtotal,
    free: free,
    fee: fee,
    freeThreshold: cfg.freeTransportThreshold,
    paidBy: free ? 'platform' : 'customer',
    label: free ? 'Free delivery' : ('Transport UGX ' + fee.toLocaleString('en-US'))
  };
}

function haversineKm(a, b) {
  if (!a || !b || a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null;
  var R = 6371;
  var toRad = function (v) { return (v * Math.PI) / 180; };
  var dLat = toRad(b.lat - a.lat);
  var dLng = toRad(b.lng - a.lng);
  var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return Math.round(2 * R * Math.asin(Math.sqrt(s)) * 100) / 100;
}

function orderReadyForPickup(o) {
  var s = String(o.status || '').toLowerCase();
  return s === 'approved' || s === 'ready' || s === 'packed';
}

function ensureDelivery(storeRef, order) {
  storeRef.deliveries = storeRef.deliveries || [];
  var existing = storeRef.deliveries.find(function (d) { return d.orderId === order.id; });
  if (existing) return existing;

  var plan = transportPlan(order);
  var now = Date.now();
  var items = order.items || [];
  var vendorIds = [];
  items.forEach(function (it) { if (it.vendorId && vendorIds.indexOf(it.vendorId) === -1) vendorIds.push(it.vendorId); });

  var delivery = {
    id: auth.rid('dlv'),
    orderId: order.id,
    orderNo: order.orderNo || order.no || null,
    userId: order.userId || null,
    customerName: order.name || 'Customer',
    customerPhone: order.phone || '',
    items: items,
    vendorIds: vendorIds,
    pickupAddress: order.pickupAddress || order.pickupLocation || order.region || 'Kampala',
    dropoffAddress: order.addr || order.address || '',
    dropoffTown: order.town || '',
    dropoffRegion: order.region || '',
    dropoffLat: order.lat != null ? order.lat : null,
    dropoffLng: order.lng != null ? order.lng : null,
    status: 'approved',
    driverId: null,
    driverName: null,
    vehicleType: null,
    transportFee: plan.fee,
    transportPaidBy: plan.paidBy,
    transportPaid: false,
    distanceKm: null,
    etaAt: now + 24 * 3600 * 1000,
    pickedAt: null,
    deliveredAt: null,
    rating: null,
    events: [{ at: now, status: 'approved', by: 'system', note: 'Order approved and queued for pickup' }],
    createdAt: now,
    updatedAt: now
  };
  storeRef.deliveries.push(delivery);
  return delivery;
}

/*
 * Customer contact details are only revealed to the driver who actually holds
 * the job. While a delivery is still open in the marketplace we redact them so
 * a browser can never scrape every shopper's phone number and home address.
 */
function publicDelivery(d, opts) {
  opts = opts || {};
  var redact = opts.redactCustomer === true;
  var customerName = d.customerName;
  var customerPhone = d.customerPhone;
  var dropoffAddress = d.dropoffAddress;
  var dropoffLat = d.dropoffLat;
  var dropoffLng = d.dropoffLng;
  if (redact) {
    var first = String(d.customerName || 'Customer').trim().charAt(0).toUpperCase();
    customerName = first ? first + '. (hidden until accepted)' : 'Customer';
    customerPhone = null;
    dropoffAddress = d.dropoffTown || d.dropoffRegion || 'Shown after you accept';
    dropoffLat = null;
    dropoffLng = null;
  }
  return {
    id: d.id,
    orderId: d.orderId,
    orderNo: d.orderNo,
    customerName: customerName,
    customerPhone: customerPhone,
    customerRedacted: !!redact,
    items: (d.items || []).map(function (it) { return { id: it.id, name: it.name, qty: it.qty, vendorId: it.vendorId }; }),
    pickupAddress: d.pickupAddress,
    dropoffAddress: dropoffAddress,
    dropoffTown: d.dropoffTown,
    dropoffRegion: d.dropoffRegion,
    dropoffLat: dropoffLat,
    dropoffLng: dropoffLng,
    status: d.status,
    statusLabel: statusLabel(d.status),
    driver: d.driverId ? { id: d.driverId, name: d.driverName, vehicleType: d.vehicleType, numberPlate: d.numberPlate } : null,
    transportFee: d.transportFee,
    transportPaidBy: d.transportPaidBy,
    transportPaid: !!d.transportPaid,
    driverPay: d.driverPay || 0,
    distanceKm: d.distanceKm,
    etaAt: d.etaAt,
    pickedAt: d.pickedAt,
    deliveredAt: d.deliveredAt,
    rating: d.rating,
    events: (d.events || []).slice(-24),
    createdAt: d.createdAt,
    updatedAt: d.updatedAt
  };
}

function statusLabel(key) {
  var found = cats.DELIVERY_STATUSES.filter(function (s) { return s.key === key; })[0];
  return found ? found.label : key;
}

function nextStatuses(key) {
  var flow = { approved: ['assigned', 'cancelled'], assigned: ['picked', 'cancelled'], picked: ['transit', 'cancelled'], transit: ['arrived', 'cancelled'], arrived: ['delivered', 'cancelled'] };
  return flow[key] || [];
}

function customerMessage(status, delivery) {
  var order = delivery.orderNo || delivery.orderId;
  var map = {
    assigned: 'A driver has been assigned to your order ' + order + '. You will be notified when they collect it.',
    picked: 'Your order ' + order + ' has been picked up by the driver.',
    transit: 'Your order ' + order + ' is on the way to you.',
    arrived: 'Your order ' + order + ' has arrived at ' + (delivery.dropoffTown || 'your destination') + '. The driver is waiting to hand it over.',
    delivered: 'Your order ' + order + ' has been delivered. Thank you for shopping on ShopOnlineUg.',
    cancelled: 'Your order ' + order + ' delivery has been cancelled. Our team will contact you.'
  };
  return map[status] || ('Your order ' + order + ' update: ' + statusLabel(status));
}

function findDelivery(storeRef, id) {
  return (storeRef.deliveries || []).find(function (d) { return d.id === id; }) || null;
}

function deliveryForOrder(storeRef, orderId) {
  return (storeRef.deliveries || []).find(function (d) { return d.orderId === orderId; }) || null;
}

function syncFromOrder(storeRef, order) {
  if (!orderReadyForPickup(order)) return null;
  var existed = deliveryForOrder(storeRef, order.id);
  var delivery = ensureDelivery(storeRef, order);
  var isNew = !existed;
  if (!delivery.events) delivery.events = [];
  return { delivery: delivery, isNew: isNew };
}

/*
 * Single entry point for every delivery status change so the customer is
 * notified at each stage and the order, driver and activity log stay in step.
 */
function advance(storeRef, deliveryId, status, opts) {
  opts = opts || {};
  var delivery = findDelivery(storeRef, deliveryId);
  if (!delivery) return { error: 'Delivery not found.' };
  if (cats.DELIVERY_STATUS_KEYS.indexOf(status) === -1) return { error: 'Unknown delivery status.' };
  if (delivery.status === status) return { error: 'This delivery is already marked "' + statusLabel(status) + '".' };
  if (delivery.status !== 'cancelled' && nextStatuses(delivery.status).indexOf(status) === -1) {
    return { error: 'Cannot move from "' + statusLabel(delivery.status) + '" to "' + statusLabel(status) + '".' };
  }

  var order = (storeRef.orders || []).find(function (o) { return o.id === delivery.orderId; }) || null;
  var now = Date.now();

  if (opts.driverId && !delivery.driverId) {
    var drv = (storeRef.drivers || []).find(function (d) { return d.id === opts.driverId; });
    if (!drv) return { error: 'Driver not found.' };
    if (opts.byRole === 'driver') {
      var gate = canClaim(storeRef, drv);
      if (!gate.ok) return { error: gate.error };
    } else if (drv.status !== 'approved') {
      return { error: 'Only approved drivers can take deliveries.' };
    }
    delivery.driverId = drv.id;
    delivery.driverName = drv.name;
    delivery.vehicleType = drv.vehicleType || null;
    delivery.numberPlate = drv.numberPlate || null;
    drv.responseMs = responseMs(drv.id) || drv.responseMs || 0;
  }

  if (opts.byRole === 'driver' && ['picked', 'transit', 'arrived', 'delivered'].indexOf(status) !== -1) {
    var active = (storeRef.drivers || []).find(function (d) { return d.id === delivery.driverId; });
    if (active && settings().driverGpsRequired && active.gpsEnabled === false) {
      return { error: 'Turn on location sharing before updating this delivery.' };
    }
  }

  if (status === 'delivered' && delivery.transportPaidBy === 'customer' && opts.requireTransportPaid && !opts.transportPaid) {
    return { error: 'Confirm that you collected the transport fee before marking this delivery as delivered.' };
  }

  delivery.status = status;
  delivery.updatedAt = now;
  delivery.events = delivery.events || [];
  delivery.events.push({
    at: now,
    status: status,
    by: opts.by || (opts.byRole || 'system'),
    byRole: opts.byRole || 'system',
    note: opts.note || null
  });

  if (status === 'picked') delivery.pickedAt = now;
  if (status === 'delivered') {
    delivery.deliveredAt = now;
    delivery.transportPaid = delivery.transportPaidBy === 'platform' ? true : (opts.transportPaid != null ? !!opts.transportPaid : !!delivery.transportPaid);
    if (delivery.driverPay == null) delivery.driverPay = Math.max(2500, Math.round(num(delivery.transportFee, 0) * 0.7));
    if (order && order.deliveryId == null) order.deliveryId = delivery.id;
    if (order) order.status = 'Delivered';
  }
  if (status === 'cancelled') {
    delivery.driverId = null;
    delivery.driverName = null;
    if (order) order.status = 'Cancelled';
  }
  if (status === 'assigned' && order) order.status = 'Shipped';
  if (status === 'picked' && order) order.status = 'Shipped';
  if (status === 'transit' && order) order.status = 'Shipped';

  if (opts.lat != null && opts.lng != null) {
    delivery.lastLat = opts.lat;
    delivery.lastLng = opts.lng;
    delivery.lastPingAt = now;
    var km = haversineKm(
      { lat: delivery.dropoffLat, lng: delivery.dropoffLng },
      { lat: opts.lat, lng: opts.lng }
    );
    if (km != null) delivery.distanceKm = km;
    var drv = (storeRef.drivers || []).find(function (d) { return d.id === delivery.driverId; });
    if (drv) { drv.lastLat = opts.lat; drv.lastLng = opts.lng; drv.lastPingAt = now; }
  }

  if (order) {
    order.activity = order.activity || [];
    order.activity.push({ at: now, status: status, text: statusLabel(status) + (opts.note ? ' - ' + opts.note : ''), by: opts.by || null });
    order.deliveryStatus = status;
    order.updatedAt = now;
  }

  storeRef.logs.unshift({
    id: auth.rid('l'), at: now, type: 'delivery.' + status,
    orderId: delivery.orderId, orderNo: delivery.orderNo, deliveryId: delivery.id,
    driverId: delivery.driverId || null, vendorId: (delivery.vendorIds || [])[0] || null,
    by: opts.by || null, status: status
  });
  if (storeRef.logs.length > 400) storeRef.logs.length = 400;

  var notified = [];
  notified.push(notifyCustomer(order, delivery, status, statusLabel(status), customerMessage(status, delivery)));
  if (delivery.driverId && status !== 'delivered') {
    notified.push(notifyDriver(delivery.driverId, order, delivery, status, statusLabel(status), 'Order ' + (delivery.orderNo || '') + ' is now "' + statusLabel(status) + '".'));
  }

  return { delivery: delivery, order: order, notified: notified };
}

function rateDriver(orderId, user, rating, text) {
  var storeRef = store();
  var delivery = deliveryForOrder(storeRef, orderId);
  if (!delivery || !delivery.driverId) return { errors: ['This order is not linked to a driver yet.'] };
  if (delivery.rating) return { errors: ['You have already rated this delivery.'] };
  var res = reviews.create({
    subjectType: 'driver',
    driverId: delivery.driverId,
    orderId: orderId,
    rating: rating,
    text: text || 'Delivery completed.',
    name: user ? user.name : 'Shopper',
    verifiedPurchase: true
  }, user);
  if (res.errors) return res;
  delivery.rating = Math.round(Number(rating));
  storeRef.deliveries = storeRef.deliveries;
  db.saveNow();
  return res;
}

module.exports = {
  DRIVER_REQUIRED_FIELDS: DRIVER_REQUIRED_FIELDS,
  DOC_FIELDS: DOC_FIELDS,
  settings: settings,
  store: store,
  num: num,
  notifications: notifications,
  push: push,
  notifyCustomer: notifyCustomer,
  notifyDriver: notifyDriver,
  notifyDrivers: notifyDrivers,
  driverRating: driverRating,
  driverStats: driverStats,
  lowRating: lowRating,
  canClaim: canClaim,
  hasRecentLocation: hasRecentLocation,
  publicDriver: publicDriver,
  catalogDriver: catalogDriver,
  fullDriver: fullDriver,
  recordCompleteness: recordCompleteness,
  validate: validate,
  findByUser: findByUser,
  findByPhone: findByPhone,
  findDelivery: findDelivery,
  deliveryForOrder: deliveryForOrder,
  responseMs: responseMs,
  transportPlan: transportPlan,
  haversineKm: haversineKm,
  orderReadyForPickup: orderReadyForPickup,
  ensureDelivery: ensureDelivery,
  syncFromOrder: syncFromOrder,
  publicDelivery: publicDelivery,
  statusLabel: statusLabel,
  nextStatuses: nextStatuses,
  customerMessage: customerMessage,
  advance: advance,
  rateDriver: rateDriver
};
