'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cookieParser = require('cookie-parser');
const db = require('./db');
const seed = require('./seed');

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const ROOT = path.join(__dirname, '..');

app.disable('x-powered-by');

const UPLOAD_PATHS = /^\/api\/(delivery|reviews|vendors|admin|orders)(\/|$)/;

app.use(function (req, res, next) {
  var limit = UPLOAD_PATHS.test(req.path) ? '8mb' : '256kb';
  express.json({ limit: limit })(req, res, next);
});
app.use(cookieParser());

app.use(function (req, res, next) {
  if (/^\/(server|\.env|\.git)(\/|$)/i.test(req.path)) return res.status(404).end();
  next();
});

app.use(function (req, res, next) {
  res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(self), microphone=(), payment=(self), usb=()');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

seed.seed();
seed.seedDeliveryDemo();

const fs = require('fs');
try { fs.mkdirSync(db.UPLOAD_DIR, { recursive: true }); } catch (e) {
  console.error('[uploads] could not create upload directory:', e.message);
}

app.use('/api/auth', require('./routes/auth'));
app.use('/api/vendors', require('./routes/vendors'));
app.use('/api/vendor', require('./routes/vendors'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/products', require('./routes/products'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/delivery', require('./routes/delivery'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/dev', require('./routes/dev'));

app.use('/uploads', express.static(db.UPLOAD_DIR, {
  maxAge: '7d',
  setHeaders: function (res) { res.setHeader('X-Content-Type-Options', 'nosniff'); }
}));

app.use(express.static(ROOT));

app.use(function (req, res, next) {
  if (req.method !== 'GET') return next();
  if (req.path.indexOf('/api/') === 0) return next();
  if (/\.[a-z0-9]+$/i.test(req.path)) return next();
  res.sendFile(path.join(ROOT, 'index.html'));
});

app.use(function (err, req, res, next) {
  console.error('[error]', err.message);
  var tooBig = err.type === 'entity.too.large';
  res.status(tooBig ? 413 : 500).json({
    error: tooBig ? 'That file is too large. Please keep images under 3MB.' : 'Server error: ' + err.message
  });
});

app.listen(PORT, function () {
  console.log('ShopOnlineUg server running: http://localhost:' + PORT);
  require('./mailer').initMailer();
});
