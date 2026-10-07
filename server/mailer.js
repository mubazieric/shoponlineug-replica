'use strict';

const nodemailer = require('nodemailer');
const db = require('./db');

let transporter = null;
let transportKind = 'outbox';
let initPromise = null;

function initMailer() {
  if (initPromise) return initPromise;
  initPromise = (async function () {
    const host = process.env.SMTP_HOST;
    try {
      if (host) {
        const port = parseInt(process.env.SMTP_PORT || '587', 10);
        transporter = nodemailer.createTransport({
          host: host,
          port: port,
          secure: String(process.env.SMTP_SECURE) === 'true' || port === 465,
          auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
        });
        transportKind = 'smtp';
      } else if (String(process.env.USE_ETHEREAL) !== 'false') {
        const acct = await nodemailer.createTestAccount();
        transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email', port: 587, secure: false,
          auth: { user: acct.user, pass: acct.pass }
        });
        transportKind = 'ethereal';
      }
    } catch (e) {
      console.warn('[mail] no live SMTP available, emails go to the local outbox only:', e.message);
      transporter = null;
      transportKind = 'outbox';
    }
    console.log('[mail] delivery transport:', transportKind);
  })();
  return initPromise;
}

function render(title, intro, code, link, footer) {
  return '<div style="font-family:Arial,Helvetica,sans-serif;background:#f5f6f8;padding:24px">' +
    '<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e8e8e8">' +
    '<div style="background:#2563EB;padding:18px 24px;color:#fff;font-size:18px;font-weight:700">ShopOnlineUg</div>' +
    '<div style="padding:24px;color:#313133;font-size:14px;line-height:1.6">' +
    '<h2 style="margin:0 0 8px;font-size:18px">' + title + '</h2>' +
    '<p style="margin:0 0 16px;color:#555">' + intro + '</p>' +
    '<div style="text-align:center;margin:20px 0">' +
    '<div style="display:inline-block;letter-spacing:10px;font-size:30px;font-weight:700;color:#1D4ED8;background:#E8F0FE;border-radius:10px;padding:12px 18px 12px 28px">' + code + '</div>' +
    '<p style="color:#888;font-size:12px;margin-top:8px">This code expires in 10 minutes.</p>' +
    '</div>' +
    '<p style="margin:0 0 8px;color:#555">Prefer one click? Confirm your email with the button below:</p>' +
    '<p style="margin:0 0 20px"><a href="' + link + '" style="display:inline-block;background:#2563EB;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700">Confirm my email</a></p>' +
    '<p style="color:#888;font-size:12px;word-break:break-all;margin:0 0 16px">' + link + '</p>' +
    '<p style="color:#888;font-size:12px;margin:0">' + footer + '</p>' +
    '</div></div></div>';
}

async function sendMail(opts) {
  await initMailer();
  const data = db.load();
  const rec = {
    id: 'm' + Date.now() + Math.random().toString(36).slice(2, 7),
    to: opts.to, subject: opts.subject, text: opts.text, html: opts.html || null,
    at: new Date().toISOString(), transport: transportKind, preview: null, messageId: null, error: null
  };
  data.outbox.unshift(rec);
  if (data.outbox.length > 120) data.outbox.length = 120;
  db.save();

  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: process.env.MAIL_FROM || 'ShopOnlineUg <no-reply@shoponline.ug>',
        to: opts.to, subject: opts.subject, text: opts.text, html: opts.html
      });
      rec.messageId = info.messageId || null;
      rec.preview = nodemailer.getTestMessageUrl(info) || null;
      db.save();
    } catch (e) {
      console.warn('[mail] send failed:', e.message);
      rec.error = e.message;
      db.save();
    }
  }
  return rec;
}

module.exports = { sendMail: sendMail, initMailer: initMailer, render: render };
