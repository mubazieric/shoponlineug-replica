'use strict';

const db = require('./db');
const auth = require('./auth');
const mailer = require('./mailer');

const CODE_TTL = 10 * 60 * 1000;
const TOKEN_TTL = 24 * 60 * 60 * 1000;

function baseUrl() {
  return process.env.APP_URL || ('http://localhost:' + (process.env.PORT || 3000));
}

function links(pending) {
  return {
    code: pending.code,
    link: baseUrl() + '/api/auth/verify-link?token=' + pending.token + '&email=' + encodeURIComponent(pending.email) + '&kind=' + pending.kind
  };
}

async function issue(kind, data) {
  const store = db.load();
  store.pending = store.pending.filter(function (p) { return !(p.email === data.email && p.kind === kind); });
  const pending = {
    id: auth.rid('p'),
    kind: kind,
    email: data.email,
    name: data.name,
    phone: data.phone || '',
    passwordHash: data.passwordHash,
    payload: data.payload || null,
    code: auth.code6(),
    codeExpires: Date.now() + CODE_TTL,
    token: auth.token(),
    tokenExpires: Date.now() + TOKEN_TTL,
    attempts: 0,
    createdAt: Date.now()
  };
  store.pending.push(pending);
  store.logs.unshift({ id: auth.rid('l'), at: Date.now(), type: 'verify.issue', kind: kind, email: data.email });
  if (store.logs.length > 400) store.logs.length = 400;
  db.saveNow();

  const isVendor = kind === 'vendor';
  const u = links(pending);
  const subject = isVendor ? 'Confirm your ShopOnlineUg vendor account' : 'Confirm your ShopOnlineUg account';
  const intro = isVendor
    ? 'Welcome aboard! Use the code below to confirm the email on your vendor application, then our team will review your store.'
    : 'Welcome to ShopOnlineUg! Use the code below to confirm your email address and activate your account.';
  await mailer.sendMail({
    to: pending.email,
    subject: subject,
    text: 'Hi ' + (pending.name || 'there') + ',\n\nYour ShopOnlineUg confirmation code is ' + u.code +
      '. It expires in 10 minutes.\n\nOr confirm with this link: ' + u.link + '\n\nIf you did not request this, you can ignore this email.',
    html: mailer.render(isVendor ? 'Confirm your vendor email' : 'Confirm your email', intro, u.code, u.link,
      'You are receiving this because someone used this email on ShopOnlineUg.')
  });
  return pending;
}

async function resend(email, kind) {
  const store = db.load();
  const pending = store.pending.filter(function (p) { return p.email === email && (!kind || p.kind === kind); })[0];
  if (!pending) return { error: 'No pending registration found for this email.' };
  pending.code = auth.code6();
  pending.codeExpires = Date.now() + CODE_TTL;
  pending.token = auth.token();
  pending.tokenExpires = Date.now() + TOKEN_TTL;
  pending.attempts = 0;
  db.saveNow();
  const u = links(pending);
  await mailer.sendMail({
    to: pending.email,
    subject: 'Your new ShopOnlineUg confirmation code',
    text: 'Your new confirmation code is ' + u.code + '. It expires in 10 minutes.\n\nOr confirm with this link: ' + u.link,
    html: mailer.render('Your new confirmation code', 'Here is a fresh code for your ShopOnlineUg registration.', u.code, u.link,
      'This code expires in 10 minutes.')
  });
  return { pending: pending };
}

function findPending(email, kind) {
  return db.load().pending.filter(function (p) { return p.email === email && (!kind || p.kind === kind); })[0] || null;
}

function createAccount(pending) {
  const store = db.load();
  let user = store.users.find(function (u) { return u.email === pending.email; });
  const now = Date.now();

  if (!user) {
    user = {
      id: auth.rid('u'),
      name: pending.name,
      email: pending.email,
      phone: pending.phone,
      passwordHash: pending.passwordHash,
      role: pending.kind === 'vendor' ? 'vendor' : 'customer',
      emailVerified: true,
      status: 'active',
      provider: 'password',
      vendorId: null,
      createdAt: now,
      lastLoginAt: now
    };
    store.users.push(user);
  } else {
    user.emailVerified = true;
    user.name = user.name || pending.name;
    if (pending.passwordHash) user.passwordHash = pending.passwordHash;
  }

  let vendor = null;
  if (pending.kind === 'vendor' && pending.payload) {
    vendor = store.vendors.find(function (v) { return v.userId === user.id; });
    if (!vendor) {
      vendor = Object.assign({
        id: auth.rid('v'),
        userId: user.id,
        ownerName: pending.name,
        email: pending.email,
        phone: pending.phone,
        status: 'pending',
        createdAt: now,
        reviewedAt: null,
        rejectionReason: null
      }, pending.payload);
      store.vendors.push(vendor);
    }
    user.vendorId = vendor.id;
    user.role = 'vendor';
  }

  store.pending = store.pending.filter(function (p) { return p !== pending; });
  store.logs.unshift({ id: auth.rid('l'), at: now, type: 'verify.done', kind: pending.kind, email: pending.email });
  db.saveNow();
  return { user: user, vendor: vendor };
}

function consumeByCode(email, code, kind) {
  const pending = findPending(email, kind);
  if (!pending) return { error: 'No pending registration found. Please register again.' };
  if (Date.now() > pending.codeExpires) return { error: 'That code has expired. Request a new one.' };
  if (String(code || '').trim() !== pending.code) {
    pending.attempts = (pending.attempts || 0) + 1;
    db.saveNow();
    return { error: 'Incorrect code. Please check and try again.' };
  }
  return createAccount(pending);
}

function consumeByToken(token, email, kind) {
  const store = db.load();
  const pending = store.pending.filter(function (p) {
    return p.token === token && (!email || p.email === email) && (!kind || p.kind === kind);
  })[0];
  if (!pending) return { error: 'This confirmation link is invalid or has already been used.' };
  if (Date.now() > pending.tokenExpires) return { error: 'This confirmation link has expired. Please register again.' };
  return createAccount(pending);
}

module.exports = { issue: issue, resend: resend, findPending: findPending, consumeByCode: consumeByCode, consumeByToken: consumeByToken, baseUrl: baseUrl, CODE_TTL: CODE_TTL };
