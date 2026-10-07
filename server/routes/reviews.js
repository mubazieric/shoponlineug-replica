'use strict';

const express = require('express');
const auth = require('../auth');
const db = require('../db');
const ranking = require('../ranking');
const reviews = require('../reviews');

const router = express.Router();

function queryFor(req) {
  var q = req.query || {};
  return {
    productId: q.productId ? String(q.productId) : null,
    vendorId: q.vendorId ? String(q.vendorId) : null,
    driverId: q.driverId ? String(q.driverId) : null,
    userId: q.mine === '1' && req.user ? req.user.id : null
  };
}

router.get('/', function (req, res) {
  var user = auth.currentUser(req);
  if (req.query.mine === '1' && !user) return res.status(401).json({ error: 'Please sign in to continue.' });
  var out = reviews.publicFor(queryFor(req));
  var store = db.load();
  var extras = {};
  if (req.query.productId) {
    var p = (store.products || []).find(function (x) { return x.id === req.query.productId; });
    if (p) extras.product = ranking.explain(store, p);
  }
  if (req.query.vendorId) extras.vendor = ranking.vendorScore(store, String(req.query.vendorId));
  res.json(Object.assign({ ok: true }, out, extras));
});

router.post('/', auth.requireAuth, function (req, res) {
  var body = req.body || {};
  var orderId = body.orderId ? String(body.orderId) : null;
  var store = db.load();
  var order = orderId ? (store.orders || []).find(function (o) { return o.id === orderId; }) : null;
  if (orderId && !order) return res.status(404).json({ error: 'Order not found.' });
  if (order && order.userId && order.userId !== req.user.id) {
    return res.status(403).json({ error: 'You can only review your own orders.' });
  }
  if (!orderId && body.subjectType === 'driver') {
    return res.status(400).json({ error: 'Rate the driver from one of your delivered orders.' });
  }

  var out = reviews.create(body, req.user);
  if (out.errors) return res.status(400).json({ error: out.errors[0], errors: out.errors });

  var extras = {};
  if (out.review.productId) {
    var p = (store.products || []).find(function (x) { return x.id === out.review.productId; });
    if (p) extras.product = ranking.explain(store, p);
  }
  res.json({ ok: true, review: reviews.decorate(out.review), ranking: extras.product || null });
});

router.post('/:id/hide', auth.requireRole('admin'), function (req, res) {
  var r = reviews.hide(req.params.id, req.user.email);
  if (!r) return res.status(404).json({ error: 'Review not found.' });
  res.json({ ok: true, review: reviews.decorate(r) });
});

router.get('/subjects', function (req, res) {
  res.json({ ok: true, subjects: reviews.SUBJECTS });
});

module.exports = router;
