'use strict';

const express = require('express');
const db = require('../db');
const auth = require('../auth');
const verify = require('../verify');

const router = express.Router();

function normalizeEmail(e) { return String(e || '').trim().toLowerCase(); }
function validEmail(e) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e); }

function publicVendor(v) {
  if (!v) return null;
  return {
    id: v.id, storeName: v.storeName, category: v.category, location: v.location,
    description: v.description, status: v.status, createdAt: v.createdAt, rejectionReason: v.rejectionReason || null
  };
}

function upsertOAuthUser(profile) {
  const store = db.load();
  const email = normalizeEmail(profile.email);
  let user = store.users.find(function (u) { return u.email === email; });
  const now = Date.now();
  if (!user) {
    user = {
      id: auth.rid('u'), name: profile.name, email: email, phone: '',
      passwordHash: null, role: 'customer', emailVerified: true, status: 'active',
      provider: profile.provider || 'google', picture: profile.picture || null,
      vendorId: null, createdAt: now, lastLoginAt: now
    };
    store.users.push(user);
  } else {
    user.emailVerified = true;
    user.lastLoginAt = now;
    if (!user.passwordHash) user.provider = profile.provider || 'google';
    if (profile.picture) user.picture = profile.picture;
  }
  store.logs.unshift({ id: auth.rid('l'), at: now, type: 'auth.oauth', provider: profile.provider || 'google', email: email });
  db.saveNow();
  return user;
}

router.post('/register', async function (req, res) {
  try {
    const b = req.body || {};
    const email = normalizeEmail(b.email);
    if (!b.name || String(b.name).trim().length < 2) return res.status(400).json({ error: 'Please enter your full name.' });
    if (!validEmail(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
    if (!b.password || String(b.password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });

    const store = db.load();
    const existing = store.users.find(function (u) { return u.email === email; });
    if (existing && existing.emailVerified) return res.status(409).json({ error: 'An account with this email already exists. Please sign in.' });

    await verify.issue('customer', { name: b.name.trim(), email: email, phone: b.phone, passwordHash: auth.hash(b.password) });
    res.json({ ok: true, email: email, expiresIn: verify.CODE_TTL });
  } catch (e) {
    res.status(500).json({ error: 'Could not create your account. ' + e.message });
  }
});

router.post('/verify', function (req, res) {
  const b = req.body || {};
  const email = normalizeEmail(b.email);
  const out = verify.consumeByCode(email, b.code, b.kind || 'customer');
  if (out.error) return res.status(400).json({ error: out.error });
  auth.setSession(res, out.user);
  res.json({ ok: true, user: auth.safeUser(out.user), vendor: publicVendor(out.vendor) });
});

router.get('/verify-link', function (req, res) {
  const out = verify.consumeByToken(req.query.token, req.query.email, req.query.kind);
  if (out.error) {
    return res.redirect('/#/account?verified=0&msg=' + encodeURIComponent(out.error));
  }
  auth.setSession(res, out.user);
  const base = out.user.role === 'vendor' ? '/#/vendor?verified=1' : '/#/account?verified=1';
  res.redirect(base);
});

router.post('/resend', async function (req, res) {
  const b = req.body || {};
  const out = await verify.resend(normalizeEmail(b.email), b.kind || 'customer');
  if (out.error) return res.status(400).json({ error: out.error });
  res.json({ ok: true });
});

router.post('/login', function (req, res) {
  const b = req.body || {};
  const email = normalizeEmail(b.email);
  const store = db.load();
  const user = store.users.find(function (u) { return u.email === email; });
  if (!user) return res.status(401).json({ error: 'Invalid email or password.' });
  if (!user.passwordHash) return res.status(400).json({ error: 'This account uses Google sign-in. Continue with Google instead.' });
  if (!auth.compare(b.password, user.passwordHash)) return res.status(401).json({ error: 'Invalid email or password.' });
  if (!user.emailVerified) return res.status(403).json({ error: 'Your email is not confirmed yet.', needsVerification: true, email: email });
  if (user.status === 'suspended') return res.status(403).json({ error: 'This account has been suspended. Contact support.' });
  user.lastLoginAt = Date.now();
  store.logs.unshift({ id: auth.rid('l'), at: Date.now(), type: 'auth.login', email: email });
  db.saveNow();
  auth.setSession(res, user);
  res.json({ ok: true, user: auth.safeUser(user) });
});

router.post('/logout', function (req, res) {
  auth.clearSession(res);
  res.json({ ok: true });
});

router.get('/me', function (req, res) {
  const u = auth.currentUser(req);
  res.json({ ok: true, user: auth.safeUser(u) });
});

router.get('/config', function (req, res) {
  res.json({ ok: true, google: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) });
});

router.get('/google', function (req, res) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.redirect('/#/account?google=unconfigured');
  }
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: verify.baseUrl() + '/api/auth/google/callback',
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'online',
    prompt: 'select_account'
  });
  res.redirect('https://accounts.google.com/o/oauth2/v2/auth?' + params.toString());
});

router.get('/google/callback', async function (req, res) {
  try {
    if (!req.query.code) throw new Error('Missing authorization code');
    const body = new URLSearchParams({
      code: req.query.code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: verify.baseUrl() + '/api/auth/google/callback',
      grant_type: 'authorization_code'
    });
    const tr = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body
    });
    const tokens = await tr.json();
    if (!tokens.access_token) throw new Error(tokens.error_description || 'Google token exchange failed');
    const ur = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: 'Bearer ' + tokens.access_token }
    });
    const prof = await ur.json();
    if (!prof.email) throw new Error('Google did not return an email address');
    const user = upsertOAuthUser({ name: prof.name || prof.given_name || prof.email, email: prof.email, provider: 'google', picture: prof.picture });
    auth.setSession(res, user);
    res.redirect('/#/account?google=1');
  } catch (e) {
    res.redirect('/#/account?google=0&msg=' + encodeURIComponent(e.message));
  }
});

router.get('/google/mock/accounts', function (req, res) {
  res.json({
    ok: true,
    accounts: [
      { email: 'amina.nakato@gmail.com', name: 'Amina Nakato', note: 'Signed in on this device' },
      { email: 'brian.ochieng@gmail.com', name: 'Brian Ochieng' },
      { email: 'sarah.kirabo@gmail.com', name: 'Sarah Kirabo' }
    ]
  });
});

router.post('/google/mock', function (req, res) {
  const b = req.body || {};
  const email = normalizeEmail(b.email || 'demo.google@gmail.com');
  const user = upsertOAuthUser({ name: b.name || email.split('@')[0], email: email, provider: 'google' });
  auth.setSession(res, user);
  res.json({ ok: true, user: auth.safeUser(user) });
});

module.exports = router;
