'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

const COOKIE = 'sou_token';
const WEEK = 7 * 24 * 3600 * 1000;

function secret() { return process.env.JWT_SECRET || 'shoponlineug-dev-secret-change-me'; }

function hash(pw) { return bcrypt.hashSync(String(pw), 10); }
function compare(pw, h) { try { return bcrypt.compareSync(String(pw), h || ''); } catch (e) { return false; } }

function sign(user) { return jwt.sign({ uid: user.id, role: user.role }, secret(), { expiresIn: '7d' }); }
function verifyJwt(token) { try { return jwt.verify(token, secret()); } catch (e) { return null; } }

function setSession(res, user) {
  res.cookie(COOKIE, sign(user), { httpOnly: true, sameSite: 'lax', maxAge: WEEK });
}
function clearSession(res) { res.clearCookie(COOKIE); }

function code6() { return String(Math.floor(100000 + Math.random() * 900000)); }
function token() { return crypto.randomBytes(24).toString('hex'); }
function rid(prefix) { return (prefix || 'id') + crypto.randomBytes(7).toString('hex'); }

function safeUser(u) {
  if (!u) return null;
  return {
    id: u.id, name: u.name, email: u.email, phone: u.phone || '', role: u.role,
    emailVerified: !!u.emailVerified, status: u.status || 'active', vendorId: u.vendorId || null,
    provider: u.provider || 'password', createdAt: u.createdAt || null, lastLoginAt: u.lastLoginAt || null
  };
}

function currentUser(req) {
  const raw = (req.cookies && req.cookies[COOKIE]) || null;
  if (!raw) return null;
  const payload = verifyJwt(raw);
  if (!payload) return null;
  const user = db.load().users.find(function (u) { return u.id === payload.uid; });
  if (!user || user.status === 'suspended') return null;
  return user;
}

function requireAuth(req, res, next) {
  const u = currentUser(req);
  if (!u) return res.status(401).json({ error: 'Please sign in to continue.' });
  req.user = u;
  next();
}

function requireRole(role) {
  return function (req, res, next) {
    const u = currentUser(req);
    if (!u) return res.status(401).json({ error: 'Please sign in to continue.' });
    if (u.role !== role) return res.status(403).json({ error: 'You do not have access to this area.' });
    req.user = u;
    next();
  };
}

module.exports = {
  COOKIE: COOKIE, hash: hash, compare: compare, setSession: setSession, clearSession: clearSession,
  code6: code6, token: token, rid: rid, safeUser: safeUser, currentUser: currentUser,
  requireAuth: requireAuth, requireRole: requireRole
};
