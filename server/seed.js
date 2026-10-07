'use strict';

const db = require('./db');
const auth = require('./auth');

function seed() {
  const store = db.load();
  if (store.meta && store.meta.seeded) return;
  const now = Date.now();

  store.users.push({
    id: auth.rid('u'), name: 'Site Administrator', email: 'admin@shoponline.ug',
    phone: '+256 700 000 000', passwordHash: auth.hash('admin123'), role: 'admin',
    emailVerified: true, status: 'active', provider: 'password', vendorId: null,
    createdAt: now, lastLoginAt: null
  });

  store.users.push({
    id: 'u-demo-customer', name: 'Amina Nakato', email: 'customer@demo.ug',
    phone: '+256 701 111 111', passwordHash: auth.hash('customer123'), role: 'customer',
    emailVerified: true, status: 'active', provider: 'password', vendorId: null,
    createdAt: now, lastLoginAt: null
  });

  store.users.push({
    id: 'u-demo-vendor', name: 'Daniel Ssemakula', email: 'vendor@demo.ug',
    phone: '+256 772 222 222', passwordHash: auth.hash('vendor123'), role: 'vendor',
    emailVerified: true, status: 'active', provider: 'password', vendorId: 'v-demo',
    createdAt: now, lastLoginAt: null
  });
  store.vendors.push({
    id: 'v-demo', userId: 'u-demo-vendor', ownerName: 'Daniel Ssemakula',
    email: 'vendor@demo.ug', phone: '+256 772 222 222', storeName: 'Demo Electronics',
    category: 'phones', location: 'Kampala', description: 'Authorised reseller of smartphones and accessories in Kampala.',
    taxId: 'TIN-100200300', website: '', status: 'approved', createdAt: now, reviewedAt: now, rejectionReason: null
  });
  store.products.push({
    id: 'prd-demo-1', vendorId: 'v-demo', storeName: 'Demo Electronics',
    name: 'Anker PowerCore 20000mAh Power Bank', category: 'phones', price: 185000, old: 230000,
    stock: 40, description: 'Fast-charging 20000mAh power bank with dual USB output and PowerIQ.',
    img: 'prod-phone', loc: 'Kampala', rate: 4.6, sold: 12, status: 'approved',
    rejectionReason: null, createdAt: now, updatedAt: now
  });
  store.products.push({
    id: 'prd-demo-2', vendorId: 'v-demo', storeName: 'Demo Electronics',
    name: 'USB-C Fast Charger 65W GaN', category: 'phones', price: 96000, old: 120000,
    stock: 25, description: 'Compact GaN 65W charger, compatible with laptops, tablets and phones.',
    img: 'prod-phone', loc: 'Kampala', rate: 4.5, sold: 5, status: 'approved',
    rejectionReason: null, createdAt: now, updatedAt: now
  });
  store.products.push({
    id: 'prd-demo-3', vendorId: 'v-demo', storeName: 'Demo Electronics',
    name: 'Wireless Charging Pad 15W', category: 'phones', price: 68000, old: 85000,
    stock: 15, description: 'Qi-certified 15W wireless charging pad with anti-slip surface.',
    img: 'prod-phone', loc: 'Kampala', rate: 0, sold: 0, status: 'pending',
    rejectionReason: null, createdAt: now - 3600000, updatedAt: now - 3600000
  });

  store.users.push({
    id: 'u-pending-vendor', name: 'Grace Auma', email: 'kampalagadgets@demo.ug',
    phone: '+256 758 333 333', passwordHash: auth.hash('vendor123'), role: 'vendor',
    emailVerified: true, status: 'active', provider: 'password', vendorId: 'v-kampala',
    createdAt: now - 86400000, lastLoginAt: null
  });
  store.vendors.push({
    id: 'v-kampala', userId: 'u-pending-vendor', ownerName: 'Grace Auma',
    email: 'kampalagadgets@demo.ug', phone: '+256 758 333 333', storeName: 'Kampala Gadgets Hub',
    category: 'tv', location: 'Kampala', description: 'Home electronics, TVs and sound systems with installation support.',
    taxId: 'TIN-998877665', website: '', status: 'pending', createdAt: now - 86400000, reviewedAt: null, rejectionReason: null
  });
  store.products.push({
    id: 'prd-demo-4', vendorId: 'v-kampala', storeName: 'Kampala Gadgets Hub',
    name: 'Sony 2.1ch Soundbar 300W', category: 'tv', price: 890000, old: 1050000,
    stock: 8, description: 'Sony 2.1 channel soundbar with wireless subwoofer and Bluetooth.',
    img: 'prod-audio', loc: 'Kampala', rate: 0, sold: 0, status: 'pending',
    rejectionReason: null, createdAt: now - 86000000, updatedAt: now - 86000000
  });

  store.orders.push({
    id: 'o-demo-1', orderNo: 'UG778812430', userId: 'u-demo-customer', name: 'Amina Nakato',
    total: 281000, status: 'Delivered', createdAt: now - 5 * 86400000,
    items: [
      { id: 'prd-demo-1', name: 'Anker PowerCore 20000mAh Power Bank', price: 185000, qty: 1, vendorId: 'v-demo' },
      { id: 'prd-demo-2', name: 'USB-C Fast Charger 65W GaN', price: 96000, qty: 1, vendorId: 'v-demo' }
    ]
  });

  store.products.push({
    id: 'prd-demo-5', vendorId: 'v-demo', storeName: 'Demo Electronics',
    name: 'Bluetooth Earphones - Unbranded Clone', category: 'tv', price: 45000, old: 70000,
    stock: 60, description: 'Wireless earphones with claimed 20h battery. No brand certification on file.',
    img: 'prod-audio', loc: 'Kampala', rate: 0, sold: 0, status: 'rejected',
    rejectionReason: 'Brand certification and warranty documents missing. Upload proof to re-submit.',
    createdAt: now - 48 * 3600000, updatedAt: now - 48 * 3600000
  });
  store.products.push({
    id: 'prd-demo-6', vendorId: 'v-demo', storeName: 'Demo Electronics',
    name: 'Ultra Clear Tempered Glass Screen Protector', category: 'phones', price: 15000, old: 20000,
    stock: 3, description: '9H hardness tempered glass for 6.1" and 6.7" displays with installation kit.',
    img: 'prod-phone', loc: 'Kampala', rate: 4.7, sold: 40, status: 'approved',
    rejectionReason: null, createdAt: now - 30 * 3600000, updatedAt: now - 30 * 3600000
  });

  store.orders.push({
    id: 'o-demo-2', orderNo: 'UG778812431', userId: 'u-demo-customer', name: 'Amina Nakato',
    total: 466000, status: 'Pending', createdAt: now - 86400000,
    items: [
      { id: 'prd-demo-1', name: 'Anker PowerCore 20000mAh Power Bank', price: 185000, qty: 2, vendorId: 'v-demo' },
      { id: 'prd-demo-2', name: 'USB-C Fast Charger 65W GaN', price: 96000, qty: 1, vendorId: 'v-demo' }
    ]
  });
  store.orders.push({
    id: 'o-demo-3', orderNo: 'UG778812432', userId: 'u-demo-customer', name: 'Amina Nakato',
    total: 96000, status: 'Packed', createdAt: now - 2 * 86400000,
    items: [
      { id: 'prd-demo-2', name: 'USB-C Fast Charger 65W GaN', price: 96000, qty: 1, vendorId: 'v-demo' }
    ]
  });
  store.orders.push({
    id: 'o-demo-4', orderNo: 'UG778812433', userId: 'u-demo-customer', name: 'Amina Nakato',
    total: 185000, status: 'Shipped', createdAt: now - 3 * 86400000,
    items: [
      { id: 'prd-demo-1', name: 'Anker PowerCore 20000mAh Power Bank', price: 185000, qty: 1, vendorId: 'v-demo' }
    ]
  });

  store.vendorPayouts.push({
    id: 'pay-demo-1', vendorId: 'v-demo', amount: 200000, status: 'paid', createdAt: now - 2 * 86400000
  });

  store.meta.seeded = true;
  store.logs.unshift({ id: auth.rid('l'), at: now, type: 'system.seed', by: 'system' });
  db.saveNow();
  console.log('[seed] admin@shoponline.ug / admin123  |  vendor@demo.ug / vendor123  |  customer@demo.ug / customer123');
}

const PNG1x1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/*
 * Second-stage demo data: a rider account plus sample deliveries so the rider
 * portal and the admin delivery tab have something to show on a fresh install.
 * Runs once - it backs off as soon as any driver or delivery exists.
 */
function seedDeliveryDemo() {
  const store = db.load();
  store.drivers = store.drivers || [];
  store.deliveries = store.deliveries || [];
  store.notifications = store.notifications || [];
  if (store.drivers.length || store.deliveries.length) return;

  const now = Date.now();
  const uploads = require('./uploads');

  let rider = store.users.find(function (u) { return u.email === 'rider@demo.ug'; });
  if (!rider) {
    rider = {
      id: 'u-demo-rider', name: 'Joseph Mugisha', email: 'rider@demo.ug',
      phone: '+256 774 444 444', passwordHash: auth.hash('rider123'), role: 'customer',
      emailVerified: true, status: 'active', provider: 'password', vendorId: null,
      createdAt: now - 40 * 86400000, lastLoginAt: null
    };
    store.users.push(rider);
  }

  const driver = {
    id: 'drv-demo-1',
    userId: rider.id,
    name: 'Joseph Mugisha',
    email: 'rider@demo.ug',
    phone: '+256 774 444 444',
    dob: '1994-04-12',
    vehicleType: 'Motorcycle / Bodabonda',
    numberPlate: 'KDG 419F',
    licenseNo: 'U7845123',
    licenseExpiry: '2029-06-30',
    nationalIdNo: 'CM987654321',
    licenseFile: uploads.saveDataUrl(PNG1x1, 'driver-license'),
    nationalIdFile: uploads.saveDataUrl(PNG1x1, 'driver-nationalid'),
    selfieFile: uploads.saveDataUrl(PNG1x1, 'driver-selfie'),
    status: 'approved',
    appliedVia: 'self',
    gpsEnabled: true,
    lastLat: 0.3136,
    lastLng: 32.5811,
    lastPingAt: now - 15 * 60000,
    responseMs: 420000,
    rejectionReason: null,
    reviewedAt: now - 39 * 86400000,
    reviewedBy: 'admin@shoponline.ug',
    createdAt: now - 40 * 86400000,
    updatedAt: now - 86400000
  };
  store.drivers.push(driver);

  function itemsOf(orderId) {
    const o = (store.orders || []).find(function (x) { return x.id === orderId; });
    return o ? (o.items || []) : [];
  }
  function makeDelivery(opts) {
    const o = (store.orders || []).find(function (x) { return x.id === opts.orderId; }) || {};
    const d = {
      id: opts.id,
      orderId: opts.orderId,
      orderNo: o.orderNo || null,
      userId: o.userId || null,
      customerName: o.name || 'Customer',
      customerPhone: o.phone || '+256 701 111 111',
      items: itemsOf(opts.orderId),
      vendorIds: (itemsOf(opts.orderId) || []).map(function (it) { return it.vendorId; }).filter(Boolean),
      pickupAddress: 'Demo Electronics, Kampala Road',
      dropoffAddress: 'Plot 12, Kampala Road, Kampala',
      dropoffTown: 'Kampala',
      dropoffRegion: 'Central',
      dropoffLat: 0.3476,
      dropoffLng: 32.5825,
      status: opts.status,
      driverId: opts.driverId || null,
      driverName: opts.driverId ? driver.name : null,
      vehicleType: opts.driverId ? driver.vehicleType : null,
      numberPlate: opts.driverId ? driver.numberPlate : null,
      transportFee: 3500,
      transportPaidBy: 'customer',
      transportPaid: opts.status === 'delivered',
      driverPay: opts.status === 'delivered' ? 3000 : 0,
      distanceKm: opts.status === 'delivered' ? 6.4 : null,
      etaAt: opts.etaAt,
      pickedAt: opts.pickedAt || null,
      deliveredAt: opts.deliveredAt || null,
      rating: opts.rating || null,
      events: opts.events || [],
      createdAt: opts.createdAt,
      updatedAt: opts.updatedAt || opts.createdAt
    };
    store.deliveries.push(d);
    return d;
  }

  const day = 86400000;

  makeDelivery({
    id: 'dlv-demo-open', orderId: 'o-demo-3', status: 'approved',
    etaAt: now + 6 * 3600000, createdAt: now - 4 * 3600000,
    events: [{ at: now - 4 * 3600000, status: 'approved', by: 'system', note: 'Order approved and queued for pickup' }]
  });
  makeDelivery({
    id: 'dlv-demo-active', orderId: 'o-demo-4', status: 'assigned',
    driverId: driver.id, etaAt: now + 3 * 3600000,
    createdAt: now - 2 * 3600000, updatedAt: now - 40 * 60000,
    events: [
      { at: now - 2 * 3600000, status: 'approved', by: 'system', note: 'Order approved and queued for pickup' },
      { at: now - 40 * 60000, status: 'assigned', by: 'rider@demo.ug', byRole: 'driver', note: 'Driver accepted the pickup request' }
    ]
  });
  makeDelivery({
    id: 'dlv-demo-done', orderId: 'o-demo-1', status: 'delivered',
    driverId: driver.id, etaAt: now - 4 * day, pickedAt: now - 5 * day,
    deliveredAt: now - 4 * day + 20 * 60000, rating: 5,
    createdAt: now - 5 * day, updatedAt: now - 4 * day,
    events: [
      { at: now - 5 * day, status: 'approved', by: 'system', note: 'Order approved and queued for pickup' },
      { at: now - 5 * day + 3600000, status: 'assigned', by: 'rider@demo.ug', byRole: 'driver', note: 'Driver accepted the pickup request' },
      { at: now - 5 * day + 7200000, status: 'picked', by: 'rider@demo.ug', byRole: 'driver', note: null },
      { at: now - 5 * day + 9000000, status: 'transit', by: 'rider@demo.ug', byRole: 'driver', note: null },
      { at: now - 5 * day + 10800000, status: 'arrived', by: 'rider@demo.ug', byRole: 'driver', note: null },
      { at: now - 4 * day + 20 * 60000, status: 'delivered', by: 'rider@demo.ug', byRole: 'driver', note: 'Handed over to the customer' }
    ]
  });

  store.notifications.unshift({
    id: 'ntf-demo-pickup',
    createdAt: now - 4 * 3600000,
    readAt: null,
    status: 'unread',
    toDriverId: driver.id,
    toRole: 'driver',
    orderId: 'o-demo-3',
    orderNo: 'UG778812432',
    deliveryId: 'dlv-demo-open',
    event: 'pickup_request',
    title: 'Pickup ready for order UG778812432',
    body: 'A packed order is waiting for pickup in Kampala. Open the rider portal to claim it.'
  });

  store.logs.unshift({ id: auth.rid('l'), at: now, type: 'system.seed.delivery', by: 'system' });
  db.saveNow();
  console.log('[seed] rider@demo.ug / rider123 (approved demo rider with 1 open, 1 active and 1 completed delivery)');
}

module.exports = { seed: seed, seedDeliveryDemo: seedDeliveryDemo };
