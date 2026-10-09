'use strict';

/*
 * End-to-end API tests for the storefront -> orders -> delivery flow.
 *
 * These exercise the real Express app against an isolated temp data store, so
 * they never touch the developer's server/data/db.json. Run with `npm test`
 * (or `node --test test/`) inside the server folder.
 */

const os = require('os');
const path = require('path');
const fs = require('fs');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'sou-test-'));
process.env.SOU_DATA_DIR = path.join(TMP, 'data');
process.env.SOU_UPLOAD_DIR = path.join(TMP, 'uploads');
process.env.PORT = '0';

const test = require('node:test');
const assert = require('node:assert');

const app = require('../server');
const catalog = require('../catalog');

let server;
let base;

function makeJar() {
  let cookie = '';
  return {
    get: function () { return cookie; },
    absorb: function (res) {
      const list = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
      list.forEach(function (c) { cookie = c.split(';')[0]; });
    }
  };
}

async function req(jar, method, urlPath, body) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (jar && jar.get()) headers['Cookie'] = jar.get();
  const res = await fetch(base + urlPath, {
    method: method,
    headers: headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (jar) jar.absorb(res);
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
  return { status: res.status, data: data };
}

async function login(email, password) {
  const jar = makeJar();
  const r = await req(jar, 'POST', '/api/auth/login', { email: email, password: password });
  assert.strictEqual(r.status, 200, 'login failed for ' + email + ': ' + JSON.stringify(r.data));
  return jar;
}

test.before(async function () {
  await new Promise(function (resolve) {
    server = app.listen(0, '127.0.0.1', function () {
      base = 'http://127.0.0.1:' + server.address().port;
      resolve();
    });
  });
});

test.after(function () {
  if (server) server.close();
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('delivery + order integration', async function (t) {
  const customer = await login('customer@demo.ug', 'customer123');
  const rider = await login('rider@demo.ug', 'rider123');
  const admin = await login('admin@shoponline.ug', 'admin123');

  const state = {};

  await t.test('built-in catalogue is available', function () {
    assert.ok(catalog.size > 0, 'catalog should load js/data.js');
    assert.ok(catalog.find('flash-0'), 'flash-0 should exist');
  });

  await t.test('rider catalogue never exposes driver PII', async function () {
    const r = await req(null, 'GET', '/api/delivery/catalog');
    assert.strictEqual(r.status, 200);
    const raw = JSON.stringify(r.data);
    assert.ok(!/customerPhone/.test(raw));
    (r.data.drivers || []).forEach(function (d) {
      assert.strictEqual(d.phone, undefined, 'catalog must not expose phone');
      assert.strictEqual(d.email, undefined, 'catalog must not expose email');
      assert.strictEqual(d.lastLat, undefined, 'catalog must not expose live location');
    });
  });

  await t.test('platform order is auto-approved and creates a delivery', async function () {
    const p = catalog.find('flash-0');
    const r = await req(customer, 'POST', '/api/orders', {
      items: [{ id: 'flash-0', qty: 1 }],
      name: 'Test Shopper', phone: '0772000000', region: 'Central', town: 'Kampala', addr: 'Plot 1, Kampala Road',
      lat: 0.3136, lng: 32.5811
    });
    assert.strictEqual(r.status, 200, JSON.stringify(r.data));
    assert.strictEqual(r.data.order.status, 'Approved');
    assert.strictEqual(r.data.order.total, p.price, 'high-value order should have free fees');
    assert.ok(r.data.order.delivery, 'order should carry a delivery');
    state.flashOrder = r.data.order;
    state.flashDelivery = r.data.order.delivery;
  });

  await t.test('open jobs hide customer contact and exact location', async function () {
    const r = await req(rider, 'GET', '/api/delivery/jobs');
    assert.strictEqual(r.status, 200);
    const job = (r.data.open || []).filter(function (d) { return d.orderId === state.flashOrder.id; })[0];
    assert.ok(job, 'new delivery should appear in the open pool');
    assert.strictEqual(job.customerRedacted, true);
    assert.strictEqual(job.customerPhone, null);
    assert.strictEqual(job.dropoffLat, null);
    assert.strictEqual(job.dropoffLng, null);
    assert.ok(!/0772000000/.test(JSON.stringify(r.data)), 'open jobs must not leak the phone number');
  });

  await t.test('claiming reveals the customer to the assigned rider only', async function () {
    const c = await req(rider, 'POST', '/api/delivery/jobs/' + state.flashDelivery.id + '/claim');
    assert.strictEqual(c.status, 200, JSON.stringify(c.data));
    assert.strictEqual(c.data.delivery.customerRedacted, false);
    assert.strictEqual(c.data.delivery.customerPhone, '0772000000');
    assert.ok(c.data.delivery.dropoffLat != null);
  });

  await t.test('transport fee must be collected before marking delivered', async function () {
    const cheap = catalog.find('super-3');
    const created = await req(customer, 'POST', '/api/orders', {
      items: [{ id: 'super-3', qty: 1 }],
      name: 'Test Shopper', phone: '0772000000', region: 'Central', town: 'Kampala', addr: 'Plot 2, Kampala Road'
    });
    assert.strictEqual(created.status, 200, JSON.stringify(created.data));
    const dlv = created.data.order.delivery;
    assert.strictEqual(dlv.transportPaidBy, 'customer');
    assert.strictEqual(dlv.transportFee, 3500);
    assert.strictEqual(created.data.order.total, cheap.price + 5500 + 3500);

    const claim = await req(rider, 'POST', '/api/delivery/jobs/' + dlv.id + '/claim');
    assert.strictEqual(claim.status, 200, JSON.stringify(claim.data));

    for (const step of ['picked', 'transit', 'arrived']) {
      const a = await req(rider, 'POST', '/api/delivery/jobs/' + dlv.id + '/advance', { status: step });
      assert.strictEqual(a.status, 200, step + ': ' + JSON.stringify(a.data));
    }

    const blocked = await req(rider, 'POST', '/api/delivery/jobs/' + dlv.id + '/advance', { status: 'delivered', confirmHandover: true });
    assert.strictEqual(blocked.status, 400, 'must refuse delivery without transport confirmation');

    const ok = await req(rider, 'POST', '/api/delivery/jobs/' + dlv.id + '/advance', { status: 'delivered', confirmHandover: true, transportPaid: true });
    assert.strictEqual(ok.status, 200, JSON.stringify(ok.data));
    assert.strictEqual(ok.data.delivery.transportPaid, true);
    state.ratedOrderId = created.data.order.id;
  });

  await t.test('GPS sharing is enforced when required', async function () {
    const off = await req(rider, 'PUT', '/api/delivery/me', { gpsEnabled: false });
    assert.strictEqual(off.status, 200, JSON.stringify(off.data));
    assert.strictEqual(off.data.driver.gpsEnabled, false);

    const order = await req(customer, 'POST', '/api/orders', {
      items: [{ id: 'super-4', qty: 1 }],
      name: 'Test Shopper', phone: '0772000000', region: 'Central', town: 'Kampala', addr: 'Plot 3, Kampala Road'
    });
    const blocked = await req(rider, 'POST', '/api/delivery/jobs/' + order.data.order.delivery.id + '/claim');
    assert.strictEqual(blocked.status, 403, JSON.stringify(blocked.data));
    assert.match(blocked.data.error, /location sharing/i);

    const on = await req(rider, 'PUT', '/api/delivery/me', { gpsEnabled: true });
    assert.strictEqual(on.status, 200, JSON.stringify(on.data));
  });

  await t.test('rating floor pauses new claims after poor ratings', async function () {
    const rated = await req(customer, 'POST', '/api/orders/' + state.ratedOrderId + '/rate-driver', { rating: 1, text: 'Late and rude.' });
    assert.strictEqual(rated.status, 200, JSON.stringify(rated.data));

    const cfg = await req(admin, 'PUT', '/api/admin/settings', { settings: { driverRatingFloor: 5, driverRatingMinSample: 1 } });
    assert.strictEqual(cfg.status, 200, JSON.stringify(cfg.data));

    const order = await req(customer, 'POST', '/api/orders', {
      items: [{ id: 'super-5', qty: 1 }],
      name: 'Test Shopper', phone: '0772000000', region: 'Central', town: 'Kampala', addr: 'Plot 4, Kampala Road'
    });
    const blocked = await req(rider, 'POST', '/api/delivery/jobs/' + order.data.order.delivery.id + '/claim');
    assert.strictEqual(blocked.status, 403, JSON.stringify(blocked.data));
    assert.match(blocked.data.error, /rating/i);
    state.openForAdmin = order.data.order.delivery.id;
  });

  await t.test('admin can dispatch and cancel a delivery', async function () {
    const list = await req(admin, 'GET', '/api/admin/deliveries');
    assert.strictEqual(list.status, 200);
    const target = (list.data.deliveries || []).filter(function (d) { return d.id === state.openForAdmin; })[0];
    assert.ok(target, 'delivery should be visible to admin');
    assert.strictEqual(target.assignedDriverId, null);

    const riderRec = (list.data.drivers || []);
    const listDrivers = await req(admin, 'GET', '/api/admin/drivers');
    const demoDriver = (listDrivers.data.drivers || []).filter(function (d) { return d.id === 'drv-demo-1'; })[0];
    assert.ok(demoDriver, 'demo rider exists');
    assert.ok(demoDriver.ratingFlag, 'driver exposes rating flag');

    const assigned = await req(admin, 'PUT', '/api/admin/deliveries/' + state.openForAdmin + '/status', { status: 'assigned', driverId: 'drv-demo-1' });
    assert.strictEqual(assigned.status, 200, JSON.stringify(assigned.data));
    assert.ok(assigned.data.delivery.driver, 'delivery now has a driver');
    assert.strictEqual(assigned.data.delivery.driver.id, 'drv-demo-1');

    const cancelled = await req(admin, 'PUT', '/api/admin/deliveries/' + state.openForAdmin + '/status', { status: 'cancelled', note: 'Customer asked to cancel' });
    assert.strictEqual(cancelled.status, 200, JSON.stringify(cancelled.data));
    assert.strictEqual(cancelled.data.delivery.status, 'cancelled');
  });

  await t.test('admin endpoints reject anonymous callers', async function () {
    const r = await req(null, 'GET', '/api/admin/deliveries');
    assert.ok(r.status === 401 || r.status === 403, 'expected auth failure, got ' + r.status);
  });

  await t.test('rider applications can be submitted (validated)', async function () {
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const bad = await req(customer, 'POST', '/api/delivery/apply', {
      name: 'New Rider', phone: '0751111111', dob: '1995-04-02', vehicleType: 'Motorcycle / Bodabonda',
      numberPlate: 'UBD 123X', licenseNo: 'LIC-999', licenseExpiry: '2030-01-01', nationalIdNo: 'CM95012345678',
      license: png, nationalId: png, selfie: png
    });
    assert.strictEqual(bad.status, 200, JSON.stringify(bad.data));
    assert.strictEqual(bad.data.driver.status, 'pending');
    assert.strictEqual(bad.data.completeness.complete, true);

    const invalid = await req(customer, 'POST', '/api/delivery/apply', { name: 'X' });
    assert.strictEqual(invalid.status, 409, 'second application is rejected as duplicate');
  });

  await t.test('customer sees live delivery status on their order', async function () {
    const r = await req(customer, 'GET', '/api/orders');
    assert.strictEqual(r.status, 200);
    const flash = (r.data.orders || []).filter(function (o) { return o.id === state.flashOrder.id; })[0];
    assert.ok(flash, 'order should be listed');
    assert.ok(flash.delivery, 'order should expose its delivery');
    assert.strictEqual(flash.deliveryStatus, 'assigned');
  });
});
