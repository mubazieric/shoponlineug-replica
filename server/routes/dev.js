'use strict';

const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/outbox', function (req, res) {
  const store = db.load();
  res.json({
    ok: true,
    transport: store.outbox[0] ? store.outbox[0].transport : 'outbox',
    messages: store.outbox.map(function (m) {
      return { id: m.id, to: m.to, subject: m.subject, at: m.at, text: m.text, html: m.html, preview: m.preview, transport: m.transport, error: m.error || null };
    })
  });
});

router.post('/outbox/clear', function (req, res) {
  const store = db.load();
  store.outbox = [];
  db.saveNow();
  res.json({ ok: true });
});

module.exports = router;
