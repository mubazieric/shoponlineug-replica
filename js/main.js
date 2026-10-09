(function () {
  'use strict';

  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  var CONF = { siteName: 'ShopOnlineUg', tagline: "Uganda's online marketplace", currencyCode: 'UGX', currencySymbol: 'UGX ', deliveryFee: 5500, freeThreshold: 200000, themeAccent: '#2563EB', bannerStripVisible: true, dealPopupVisible: true };
  function fmt(n) { return CONF.currencySymbol + Math.round(n).toLocaleString('en-US'); }
  function pct(oldP, newP) { return Math.round((1 - newP / oldP) * 100); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function decode(s) {
    return (s || '').replace(/&#(\d+);/g, function (m, c) { return String.fromCharCode(parseInt(c, 10)); });
  }
  function stripHtml(s) {
    var d = document.createElement('div');
    d.innerHTML = s;
    return d.textContent || '';
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function load(key, fallback) {
    try { var v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; }
    catch (e) { return fallback; }
  }
  function save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }
  function money0(n) { return Math.round(n).toLocaleString('en-US'); }
  function dateStr(ts) {
    var d = new Date(ts);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' · ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function etaStr(ts, days) {
    var d = new Date(ts + days * 86400000);
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
  }
  var DEMO_PIN = '0000';
  function luhnCheck(num) {
    var digits = String(num).replace(/\D/g, '');
    if (digits.length < 13) return false;
    var sum = 0, alt = false;
    for (var i = digits.length - 1; i >= 0; i--) {
      var n = parseInt(digits.charAt(i), 10);
      if (alt) { n *= 2; if (n > 9) n -= 9; }
      sum += n;
      alt = !alt;
    }
    return sum % 10 === 0;
  }
  function cardBrand(num) {
    var d = String(num).replace(/\D/g, '');
    if (/^4/.test(d)) return 'Visa';
    if (/^5[1-5]/.test(d) || /^2[2-7]/.test(d)) return 'Mastercard';
    return '';
  }
  function formatCardNum(v) {
    var d = String(v || '').replace(/\D/g, '').slice(0, 16);
    return d.replace(/(\d{4})(?=\d)/g, '$1 ');
  }
  function expiryOk(v) {
    var m = String(v || '').match(/^(\d{2})\/?(\d{2})$/);
    if (!m) return false;
    var mm = parseInt(m[1], 10), yy = parseInt(m[2], 10);
    if (mm < 1 || mm > 12) return false;
    var now = new Date();
    var cyy = now.getFullYear() % 100;
    var cmm = now.getMonth() + 1;
    if (yy < cyy) return false;
    if (yy === cyy && mm < cmm) return false;
    return true;
  }

  /* ============ api client ============ */
  var API = { up: true };
  function api(path, opts) {
    opts = opts || {};
    var headers = opts.headers || {};
    var body = opts.body;
    if (body && typeof body !== 'string') { body = JSON.stringify(body); headers['Content-Type'] = 'application/json'; }
    return fetch('/api' + path, { method: opts.method || 'GET', headers: headers, body: body, credentials: 'same-origin' })
      .then(function (r) {
        return r.text().then(function (t) {
          var d = {};
          try { d = t ? JSON.parse(t) : {}; } catch (e) { d = {}; }
          if (!r.ok) {
            var err = new Error(d.error || ('Request failed (' + r.status + ')'));
            err.status = r.status; err.data = d;
            throw err;
          }
          API.up = true;
          return d;
        });
      })
      .catch(function (e) {
        if (e instanceof TypeError) API.up = false;
        throw e;
      });
  }
  function apiFail(e, where) {
    if (!API.up) return 'Cannot reach the server. Start it with "npm start" inside the server folder, then reload.';
    return (e && e.message) || (where + ' failed');
  }

  /* ============ site settings (admin-managed, public read) ============ */
  function hex2rgb(h) {
    h = String(h || '').replace('#', '').trim();
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
    var n = parseInt(h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  function shade(hex, amt) {
    var c = hex2rgb(hex);
    if (!c) return hex;
    function f(v) { return Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt))); }
    return 'rgb(' + f(c.r) + ',' + f(c.g) + ',' + f(c.b) + ')';
  }
  var CONF_KEYS = ['siteName', 'tagline', 'currencyCode', 'deliveryFee', 'freeThreshold', 'themeAccent', 'bannerStripVisible', 'dealPopupVisible'];
  function applySettings(s) {
    if (!s) return;
    CONF_KEYS.forEach(function (k) { if (s[k] !== undefined && s[k] !== null) CONF[k] = s[k]; });
    CONF.currencySymbol = (CONF.currencyCode || 'UGX') + ' ';
    if (CONF.themeAccent && hex2rgb(CONF.themeAccent)) {
      document.documentElement.style.setProperty('--brand', CONF.themeAccent);
      document.documentElement.style.setProperty('--brand-d', shade(CONF.themeAccent, -0.25));
      document.documentElement.style.setProperty('--brand-soft', shade(CONF.themeAccent, 0.86));
    }
    if (CONF.siteName) {
      document.title = CONF.siteName + ' | Best Online Shopping Mall';
      $$('[data-site-name]').forEach(function (el) { el.textContent = CONF.siteName; });
    }
    if (CONF.tagline) $$('[data-site-tagline]').forEach(function (el) { el.textContent = CONF.tagline; });
    var tick = document.querySelector('.ticker');
    if (tick) tick.hidden = CONF.bannerStripVisible === false;
    if (CONF.dealPopupVisible === false) {
      try { sessionStorage.setItem('sou_deal_pop', '1'); } catch (e) {}
      var ov = document.getElementById('dealPopOv'), pop = document.getElementById('dealPop');
      if (ov) ov.hidden = true;
      if (pop) pop.hidden = true;
    }
  }
  function loadSettings() {
    return api('/products/settings')
      .then(function (d) { applySettings(d.settings); return d.settings; })
      .catch(function () { return null; });
  }

  var SERVER_USER = null;
  function applyServerUser(u) {
    SERVER_USER = u || null;
    if (u) {
      USER = { id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, status: u.status, vendor: u.vendor || null };
      save('sou_user', USER);
    } else {
      USER = null;
      save('sou_user', null);
    }
    updateHeaderAccount();
    if (typeof syncTabbar === 'function') syncTabbar(location.hash);
    if (u && u.role === 'vendor') {
      api('/vendors/me').then(function (d) {
        if (SERVER_USER && d.vendor) {
          SERVER_USER.vendor = d.vendor;
          if (!document.getElementById('accountPage').hidden) renderAccount();
        }
      }).catch(function () {});
    }
  }
  function roleHome() {
    if (!USER) return '#/account';
    if (USER.role === 'admin') return '#/admin';
    if (USER.role === 'vendor') return '#/vendor';
    return '#/account';
  }

  function U(id, w) { return 'https://images.unsplash.com/' + id + '?w=' + (w || 600) + '&q=80&auto=format&fit=crop'; }
  var IMG_VARIANTS = {
    'prod-phone': [U('photo-1511707171634-5f897ff02aa9'), U('photo-1592750475338-74b7b21085ab'), U('photo-1598327105666-5b89351aff97'), U('photo-1580910051074-3eb694886505'), U('photo-1510557880182-3d4d3cba35a5'), U('photo-1520923642038-b4259acecbd7')],
    'prod-laptop': [U('photo-1496181133206-80ce9b88a853'), U('photo-1588872657578-7efd1f1555ed'), U('photo-1541807084-5c52b6b3adef')],
    'prod-tv': [U('photo-1593359677879-a4bb92f829d1'), U('photo-1461151304267-38535e780c79'), U('photo-1567690187548-f07b1d7bf5a9')],
    'prod-audio': [U('photo-1505740420928-5e560c06d30e'), U('photo-1583394838336-acd977736f90'), U('photo-1484704849700-f032a568e944')],
    'prod-watch': [U('photo-1523275335684-37898b6baf30'), U('photo-1579586337278-3befd40fd17a'), U('photo-1508685096489-7aacd43bd3b1')],
    'prod-shoe': [U('photo-1542291026-7eec264c27ff'), U('photo-1549298916-b41d501d3772'), U('photo-1600185365483-26d7a4cc7519')],
    'prod-fashion': [U('photo-1483985988355-763728e1935b'), U('photo-1529139574466-a303027c1d8b'), U('photo-1490481651871-ab68de25d43d')],
    'prod-beauty': [U('photo-1556228720-195a672e8a03'), U('photo-1596462502278-27bfdc403348'), U('photo-1571781926291-c477ebfd024b')],
    'prod-home': [U('photo-1555041469-a586c61ea9bc'), U('photo-1586023492125-27b2c045efd7'), U('photo-1567016432779-094069958ea5')],
    'prod-toy': [U('photo-1558060370-d644479cb6f7'), U('photo-1596461404969-9ae70f2830c1'), U('photo-1587654780291-39c9404d746b')],
    'prod-grocery': [U('photo-1542838132-92c53300491e'), U('photo-1610832958506-aa56368176cf')],
    'prod-baby': [U('photo-1515488042361-ee00e0ddd4e4'), U('photo-1544126592-807ade215a0b')],
    'cat-boys-clothing': [U('photo-1519238263530-99bdd11df2ea', 500)],
    'cat-mens-fashion': [U('photo-1490578474895-699cd4e2cf59', 500)],
    'cat-womens-fashion': [U('photo-1529139574466-a303027c1d8b', 500)],
    'cat-mobile-acc': [U('photo-1580910051074-3eb694886505', 500)],
    'cat-auto-acc': [U('photo-1503376780353-7e6692767b70', 500)],
    'cat-casual-shoes': [U('photo-1560769629-975ec94e6a86', 500)],
    'cat-home-decor': [U('photo-1513694203232-719a280e022f', 500)],
    'cat-handbags': [U('photo-1584917865442-de89df76afd3', 500)],
    'cat-hair-care': [U('photo-1522338242992-e1a54906a8da', 500)],
    'cat-toys': [U('photo-1566576912321-d58ddd7a6088', 500)],
    'cat-computer-acc': [U('photo-1517336714731-489689fd1ca8', 500)],
    'cat-fashion-acc': [U('photo-1511499767150-a48a237f0083', 500)]
  };
  function hashSeed(s) {
    var n = 0; s = String(s || '');
    for (var i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) % 100003;
    return n;
  }
  function imgSrc(key, seed) {
    var arr = IMG_VARIANTS[key];
    if (!arr || !arr.length) return 'img/' + key + '.svg';
    return 'img/' + key + '_' + (hashSeed(seed || key) % arr.length) + '.jpg';
  }
  function imgTag(key, alt, cls, lazy, seed) {
    return '<img src="' + imgSrc(key, seed) + '"' + (cls ? ' class="' + cls + '"' : '') +
      ' alt="' + esc(alt || '') + '"' + (lazy ? ' loading="lazy"' : '') +
      ' data-fb="img/' + key + '.svg" onerror="this.onerror=null;this.src=this.getAttribute(\'data-fb\')">';
  }
  function setImg(el, key, seed) {
    if (!el) return;
    el.onerror = function () { el.onerror = null; el.src = 'img/' + key + '.svg'; };
    el.src = imgSrc(key, seed);
  }

  var CATALOG = buildCatalog();
  var BY_ID = {};
  CATALOG.forEach(function (p) { BY_ID[p.id] = p; });
  Object.keys(PRODUCTS).forEach(function (key) {
    PRODUCTS[key].forEach(function (p, i) {
      if (!p.id) p.id = productId(key, i);
      if (!p.key) p.key = key;
    });
  });

  var VARIANTS = ['Titanium Gray', 'Midnight Black', 'Ocean Blue', 'Silver', 'Rose Gold', 'Emerald Green', 'Sunset Orange', 'Pearl White'];
  var PAGE_IDS = ['homePage', 'catsPage', 'searchPage', 'browsePage', 'pdpPage', 'checkoutPage', 'successPage', 'infoPage', 'wishPage', 'storePage', 'ordersPage', 'accountPage', 'sellPage', 'vendorPage', 'adminPage', 'driverPage'];
  var STAGES = ['Order placed', 'Confirmed', 'Processing', 'Shipped', 'Delivered'];
  var SELLER_BY_KEY = {
    flash: 'ShopOnlineUg Tech Store', top: 'ShopOnlineUg Official Store', super: 'ShopOnlineUg Grocery',
    phones: 'ShopOnlineUg Tech Store', tv: 'ShopOnlineUg Electronics', fashion: 'Fashion Hub UG',
    beauty: 'Beauty Mart UG', toys: 'Kids World UG'
  };
  var STORE_ABOUT = {
    'ShopOnlineUg Tech Store': 'Your trusted destination for smartphones, laptops and gadgets, with genuine warranty and fast delivery across Uganda.',
    'ShopOnlineUg Official Store': 'The official ShopOnlineUg store. Hand-picked best sellers at unbeatable prices with pay on delivery.',
    'ShopOnlineUg Grocery': 'Everyday essentials delivered to your door - rice, oil, sugar and household favourites at market-beating prices.',
    'ShopOnlineUg Electronics': 'TVs, audio and home electronics from the brands you know. Quality checked and warranty backed.',
    'Fashion Hub UG': 'Trendy fashion for men and women. New arrivals every week at prices you will love.',
    'Beauty Mart UG': 'Skincare, haircare, makeup and fragrances - 100% authentic products only.',
    'Kids World UG': 'Toys, baby gear and everything your little ones need, safely and affordably.'
  };

  function sellerFor(p) {
    if (p.seller) return p.seller;
    var d = DETAILS[p.name];
    if (d && d.seller) return d.seller;
    return SELLER_BY_KEY[p.key] || 'ShopOnlineUg Official Store';
  }
  function storeSlug(name) { return name.replace(/[^A-Za-z0-9]+/g, '-').toLowerCase(); }

  var TAB_FOR_PAGE = {
    home: 'home', search: 'home', browse: 'home', pdp: 'home', store: 'home', vendor: 'home',
    wish: 'wish', account: 'account', orders: 'account', sell: 'account', admin: 'account', driver: 'account',
    cats: 'cat'
  };
  function syncTabbar(name) {
    var tab = TAB_FOR_PAGE[name] || '';
    $$('#tabBar .tb').forEach(function (b) {
      b.classList.toggle('on', !!tab && b.getAttribute('data-tab') === tab);
    });
  }
  function showPage(name) {
    PAGE_IDS.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.hidden = true;
    });
    var map = {
      home: 'homePage', cats: 'catsPage', search: 'searchPage', browse: 'browsePage', pdp: 'pdpPage',
      checkout: 'checkoutPage', success: 'successPage', info: 'infoPage',
      wish: 'wishPage', store: 'storePage', orders: 'ordersPage', account: 'accountPage',
      sell: 'sellPage', vendor: 'vendorPage', admin: 'adminPage', driver: 'driverPage'
    };
    var el = document.getElementById(map[name]);
    if (el) el.hidden = false;
    syncTabbar(name);
    try { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); } catch (err) { window.scrollTo(0, 0); }
    closeDrawer();
    closeSuggest();
  }

  var toast = document.getElementById('toast');
  var toastTimer = null;
  function showToast(msg) {
    toast.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6 9 17l-5-5"/></svg>' + msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 2600);
  }

  /* ============ cart ============ */
  var cart = load('sou_cart', []);
  if (!Array.isArray(cart)) cart = [];
  function saveCart() { save('sou_cart', cart); }
  function cartCount() { return cart.reduce(function (n, it) { return n + it.qty; }, 0); }
  function cartSubtotal() {
    return cart.reduce(function (n, it) { var p = BY_ID[it.id]; return p ? n + p.price * it.qty : n; }, 0);
  }
  function addToCart(id, qty) {
    qty = qty || 1;
    var found = cart.filter(function (it) { return it.id === id; })[0];
    if (found) found.qty += qty; else cart.push({ id: id, qty: qty });
    saveCart(); updateBadge(); renderDrawer();
    if (navigator.vibrate) { try { navigator.vibrate(10); } catch (err) {} }
  }
  function setQty(id, qty) {
    var it = cart.filter(function (x) { return x.id === id; })[0];
    if (!it) return;
    it.qty = qty;
    if (it.qty < 1) cart = cart.filter(function (x) { return x.id !== id; });
    saveCart(); updateBadge(); renderDrawer();
  }
  function updateBadge() {
    var n = cartCount();
    function ping(el) {
      if (!el) return;
      el.classList.remove('pop');
      void el.offsetWidth;
      el.classList.add('pop');
    }
    var el = document.getElementById('cartCount');
    if (el) { el.textContent = n; ping(el); }
    var tb = document.getElementById('tbCart');
    if (tb) { tb.textContent = n; tb.classList.toggle('show', n > 0); ping(tb); }
  }

  var drawer = document.getElementById('cartDrawer');
  var drawerOv = document.getElementById('drawerOv');
  function openDrawer() { renderDrawer(); drawer.hidden = false; drawerOv.hidden = false; document.body.classList.add('no-scroll'); }
  function closeDrawer() { if (drawer) drawer.hidden = true; if (drawerOv) drawerOv.hidden = true; document.body.classList.remove('no-scroll'); }

  (function () {
    var bar = document.getElementById('tabBar');
    if (!bar) return;
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('.tb');
      if (!b) return;
      var tab = b.getAttribute('data-tab');
      if (tab === 'home') location.hash = '#/';
      else if (tab === 'wish') location.hash = '#/wish';
      else if (tab === 'account') location.hash = '#/account';
      else if (tab === 'cart') openDrawer();
      else if (tab === 'cat') location.hash = '#/cats';
      if (navigator.vibrate) { try { navigator.vibrate(8); } catch (err) {} }
    });
  })();

  function renderDrawer() {
    var box = document.getElementById('drawerItems');
    var empty = document.getElementById('drawerEmpty');
    var foot = $('.drawer-f');
    var items = cart.map(function (it) { return { p: BY_ID[it.id], qty: it.qty }; }).filter(function (x) { return x.p; });
    document.getElementById('drawerCount').textContent = items.length ? '(' + cartCount() + ')' : '';
    if (!items.length) { box.innerHTML = ''; empty.hidden = false; foot.hidden = true; return; }
    empty.hidden = true; foot.hidden = false;
    box.innerHTML = items.map(function (x) {
      return '<div class="di">' + imgTag(x.p.img, '', '', false, x.p.id) +
        '<div class="di-info"><a class="di-name" href="#/p/' + x.p.id + '">' + x.p.name + '</a>' +
        '<div class="di-price">' + fmt(x.p.price) + '</div>' +
        '<div class="di-qty"><button type="button" data-dec="' + x.p.id + '">&minus;</button>' +
        '<span>' + x.qty + '</span><button type="button" data-inc="' + x.p.id + '">+</button>' +
        '<button type="button" class="di-rm" data-rm="' + x.p.id + '">Remove</button></div></div></div>';
    }).join('');
    document.getElementById('drawerSub').textContent = fmt(cartSubtotal());
  }

  /* ============ wishlist ============ */
  var wish = load('sou_wish', []);
  if (!Array.isArray(wish)) wish = [];
  function saveWish() { save('sou_wish', wish); }
  function isWished(id) { return wish.indexOf(id) !== -1; }
  function updateWishCount() {
    var el = document.getElementById('wishCount');
    if (el) el.textContent = wish.length;
    var tb = document.getElementById('tbWish');
    if (tb) { tb.textContent = wish.length; tb.classList.toggle('show', wish.length > 0); }
    $$('.wish-btn').forEach(function (b) { b.classList.toggle('on', isWished(b.getAttribute('data-wish'))); });
  }
  function toggleWish(id) {
    if (!BY_ID[id]) return;
    var i = wish.indexOf(id);
    if (i === -1) { wish.unshift(id); showToast('Added to wishlist'); }
    else { wish.splice(i, 1); showToast('Removed from wishlist'); }
    saveWish(); updateWishCount();
    $$('.wish-btn[data-wish="' + id + '"]').forEach(function (b) {
      b.classList.remove('pop');
      void b.offsetWidth;
      b.classList.add('pop');
    });
    var tw = document.getElementById('tbWish');
    if (tw && wish.length) {
      tw.classList.remove('pop');
      void tw.offsetWidth;
      tw.classList.add('pop');
    }
    if (!document.getElementById('wishPage').hidden) renderWishPage();
    if (currentPdp && currentPdp.id === id) syncPdpWish();
  }

  /* ============ reviews ============ */
  var REVS = load('sou_reviews', {});
  if (!REVS || typeof REVS !== 'object') REVS = {};
  function saveRevs() { save('sou_reviews', REVS); }
  function seedReviews(p) {
    return [
      { n: 'Brian K.', r: (p.rate >= 4.5 ? 5 : 4), t: 'Exactly as described. Fast delivery to Kampala.', d: '12 Aug 2026' },
      { n: 'Sarah N.', r: 4, t: 'Good quality for the price. Would buy again.', d: '03 Aug 2026' },
      { n: 'Moses A.', r: 5, t: 'ShopOnlineUg never disappoints. Paid on delivery, very smooth.', d: '28 Jul 2026' }
    ];
  }
  function userReviews(id) { return REVS[id] || []; }
  function allReviews(p) { return userReviews(p.id).concat(seedReviews(p)); }
  function avgRating(p) {
    var all = allReviews(p);
    var s = all.reduce(function (a, r) { return a + r.r; }, 0);
    return all.length ? Math.round((s / all.length) * 10) / 10 : p.rate;
  }
  function reviewCount(p) { return p.sold + userReviews(p.id).length; }

  /* ============ orders ============ */
  var ORDERS = load('sou_orders', []);
  if (!Array.isArray(ORDERS)) ORDERS = [];
  function saveOrders() { save('sou_orders', ORDERS); }
  function addOrder(o) { ORDERS.unshift(o); saveOrders(); }
  function stageFor(o) { return Math.min(4, Math.floor((Date.now() - o.ts) / 20000)); }

  /* ============ recently viewed ============ */
  var VIEWED = load('sou_viewed', []);
  if (!Array.isArray(VIEWED)) VIEWED = [];
  function pushViewed(id) {
    var i = VIEWED.indexOf(id);
    if (i !== -1) VIEWED.splice(i, 1);
    VIEWED.unshift(id);
    if (VIEWED.length > 12) VIEWED = VIEWED.slice(0, 12);
    save('sou_viewed', VIEWED);
    renderRecent();
  }
  function renderRecent() {
    var sec = document.getElementById('recentSec');
    if (!sec) return;
    var items = VIEWED.map(function (id) { return BY_ID[id]; }).filter(Boolean);
    sec.hidden = items.length === 0;
    document.getElementById('gridRecent').innerHTML = items.map(function (x) { return card(x); }).join('');
    updateWishCount();
  }

  /* ============ user ============ */
  var USER = load('sou_user', null);
  function updateHeaderAccount() {
    var box = document.getElementById('acctBox');
    if (!box) return;
    $('.ci-label', box).textContent = USER ? 'Hi, ' + USER.name.split(' ')[0] : 'Hi, Sign in';
    $('.ci-value b', box).textContent = 'Account';
  }
  function signOut() {
    api('/auth/logout', { method: 'POST' }).catch(function () {});
    applyServerUser(null);
    renderAccount(); showToast('Signed out');
  }

  /* ============ cart / card delegation ============ */
  document.addEventListener('click', function (e) {
    var sb = e.target.closest('[data-share]');
    if (sb) {
      e.preventDefault(); e.stopPropagation();
      var shp = BY_ID[sb.getAttribute('data-share')];
      if (shp) openShare(shp);
      return;
    }
    var wb = e.target.closest('.wish-btn');
    if (wb) { e.preventDefault(); e.stopPropagation(); toggleWish(wb.getAttribute('data-wish')); return; }
    var add = e.target.closest('.add-cart');
    if (add) {
      e.preventDefault();
      var id = add.getAttribute('data-id');
      var qty = add.getAttribute('data-qty') ? parseInt(add.getAttribute('data-qty'), 10) : 1;
      addToCart(id, qty);
      showToast('Added to cart: <b>' + decode(add.getAttribute('data-name') || '') + '</b>');
      return;
    }
    var inc = e.target.closest('[data-inc]');
    if (inc) { var ii = inc.getAttribute('data-inc'); setQty(ii, (cart.filter(function (x) { return x.id === ii; })[0] || { qty: 0 }).qty + 1); return; }
    var dec = e.target.closest('[data-dec]');
    if (dec) { var di = dec.getAttribute('data-dec'); setQty(di, (cart.filter(function (x) { return x.id === di; })[0] || { qty: 1 }).qty - 1); return; }
    var rm = e.target.closest('[data-rm]');
    if (rm) { setQty(rm.getAttribute('data-rm'), 0); showToast('Removed from cart'); return; }

    var card = e.target.closest('.prd');
    if (card && card.getAttribute('data-id')) { location.hash = '#/p/' + card.getAttribute('data-id'); return; }
  });

  document.getElementById('cartLink').addEventListener('click', function (e) { e.preventDefault(); openDrawer(); });
  document.getElementById('drawerClose').addEventListener('click', closeDrawer);
  drawerOv.addEventListener('click', closeDrawer);
  document.getElementById('drawerCheckout').addEventListener('click', function () {
    if (!cart.length) { showToast('Your cart is empty'); return; }
    closeDrawer(); location.hash = '#/checkout';
  });

  /* ============ product card ============ */
  function heartSvg() {
    return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21.2l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>';
  }
  function shareSvg() {
    return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>';
  }
  function card(p, opts) {
    opts = opts || {};
    var disc = pct(p.old, p.price);
    var name = decode(p.name);
    return '<article class="prd" data-id="' + p.id + '">' +
      '<div class="prd-img is-loading">' +
        imgTag(p.img, name, '', true, p.id) +
        '<span class="off-tag">-' + disc + '%</span>' +
        '<button type="button" class="wish-btn' + (isWished(p.id) ? ' on' : '') + '" data-wish="' + p.id + '" aria-label="Add to wishlist">' + heartSvg() + '</button>' +
        '<button type="button" class="share-btn" data-share="' + p.id + '" aria-label="Share this product">' + shareSvg() + '</button>' +
        '<button type="button" class="add-cart" data-id="' + p.id + '" data-qty="' + (opts.qty || 1) + '" data-name="' + esc(name) + '" aria-label="Add to cart">+</button>' +
      '</div>' +
      '<div class="prd-info">' +
        '<h3 class="prd-name">' + p.name + '</h3>' +
        '<div class="prd-price">' + fmt(p.price) + '</div>' +
        '<div class="prd-old">' + fmt(p.old) + '</div>' +
        '<div class="prd-meta"><span class="stars">&#9733;</span><span class="rate-or">' + p.rate.toFixed(1) + '</span><span>/5</span><span class="dot">&#183;</span><span>' + p.sold.toLocaleString('en-US') + '</span></div>' +
        '<div class="prd-extra">' + p.loc + '<span class="pd">Pay on Delivery</span></div>' +
      '</div>' +
    '</article>';
  }

  function renderGrids() {
    var map = {
      gridFlash: 'flash', gridTop: 'top', gridSuper: 'super', gridPhone: 'phones',
      gridTv: 'tv', gridFashion: 'fashion', gridBeauty: 'beauty', gridToy: 'toys'
    };
    Object.keys(map).forEach(function (id) {
      var box = document.getElementById(id);
      if (!box) return;
      box.innerHTML = PRODUCTS[map[id]].map(card).join('');
    });
  }

  var CAT_FILTER = {
  home: ['Sofa', 'lamp', 'desk', 'chair', 'bed', 'table', 'decor', 'furniture'],
  computing: ['MacBook', 'laptop', 'keyboard', 'mouse', 'computer', 'USB', 'monitor', 'printer'],
  sport: ['bike', 'dumbbell', 'exercise', 'sport', 'racket'],
  games: ['console', 'PlayStation', 'game', 'controller'],
  other: ['Samsung', 'Tecno', 'Infinix', 'itel']
};
  function catItems(route) {
    var raw = PRODUCTS[route] || [];
    if (raw.length) return { items: raw, count: raw.length };
    var f = CAT_FILTER[route] || [];
    var em = f.length ? CATALOG.filter(function (p) {
      var nm = (p.name + ' ' + p.brand).toLowerCase();
      return f.some(function (t) { return nm.indexOf(t.toLowerCase()) !== -1; });
    }) : [];
    return { items: em, count: em.length };
  }
  function catTile(c, i) {
    var route = CAT_ROUTE[c.img] || 'other';
    var info = catItems(route);
    var label = decode(c.label);
    return '<a class="cat-tile" href="#/r/' + route + '" style="--g1:' + c.g1 + ';--g2:' + c.g2 + '" aria-label="' + label + '">' +
      '<span class="ct-glow" aria-hidden="true"></span>' +
      '<span class="ct-spark" aria-hidden="true"></span>' +
      '<span class="ct-emo" aria-hidden="true">' + String.fromCodePoint(c.ic) + '</span>' +
      '<span class="ct-cut" aria-hidden="true">&#9733;</span>' +
      '<span class="ct-nm">' + label + '</span>' +
      '<span class="ct-meta">' + (info.count ? info.count + ' items' : 'Explore') + '<i aria-hidden="true">&#8594;</i></span>' +
      '</a>';
  }
  function renderCatTiles() {
    var box = document.getElementById('catTiles');
    if (!box) return;
    box.innerHTML = CATEGORIES.map(function (c, i) { return catTile(c, i); }).join('');
  }
  function renderCats() {
    var box = document.getElementById('catsGrid');
    if (!box) return;
    var tot = CATEGORIES.reduce(function (n, c) { return n + catItems(CAT_ROUTE[c.img] || 'other').count; }, 0);
    var stat = document.getElementById('catsStat');
    if (stat) stat.textContent = tot + ' products across ' + CATEGORIES.length + ' departments, all in one store.';
    box.innerHTML = CATEGORIES.map(function (c, i) { return catTile(c, i); }).join('');
  }

  function renderBrands() {
    var track = document.getElementById('brandTrack');
    if (!track) return;
    track.innerHTML = BRANDS.map(function (b) {
      return '<a href="#/s/' + encodeURIComponent(b.name) + '"><img src="img/' + b.img + '.svg" alt="' + b.name + '"></a>';
    }).join('');
  }

  /* ============ hero ============ */
  (function () {
    var track = document.getElementById('heroTrack');
    var ind = document.getElementById('heroInd');
    var prev = document.getElementById('heroPrev');
    var next = document.getElementById('heroNext');
    if (!track) return;
    var slides = $$('.hero-slide', track);
    var cur = 0, timer = null;
    slides.forEach(function (_, i) {
      var d = document.createElement('span');
      d.addEventListener('click', function () { go(i); });
      ind.appendChild(d);
    });
    var dots = $$('span', ind);
    function go(i) {
      cur = (i + slides.length) % slides.length;
      track.style.transform = 'translateX(-' + (cur * 100) + '%)';
      dots.forEach(function (d, k) { d.classList.toggle('on', k === cur); });
    }
    function auto() { clearInterval(timer); timer = setInterval(function () { go(cur + 1); }, 5000); }
    prev.addEventListener('click', function () { go(cur - 1); });
    next.addEventListener('click', function () { go(cur + 1); });
    var wrap = $('.hero-view');
    wrap.addEventListener('mouseenter', function () { clearInterval(timer); });
    wrap.addEventListener('mouseleave', auto);
    go(0); auto();
  })();

  /* ============ brand carousel ============ */
  (function () {
    var track = document.getElementById('brandTrack');
    var prev = document.getElementById('brandPrev');
    var next = document.getElementById('brandNext');
    if (!track) return;
    var cur = 0;
    function per() { return Math.max(1, Math.round(track.parentNode.clientWidth / 212)); }
    function max() { return Math.max(0, track.children.length - per()); }
    function move(i) { cur = Math.max(0, Math.min(i, max())); track.style.transform = 'translateX(-' + (cur * 212) + 'px)'; }
    prev.addEventListener('click', function () { move(cur - per()); });
    next.addEventListener('click', function () { move(cur + per()); });
  })();

  /* ============ popular categories slider ============ */
  function setupCatSlider() {
    var view = document.getElementById('catSlider');
    var track = document.getElementById('catTiles');
    if (!view || !track || !track.children.length) return;
    var prev = document.getElementById('catPrev');
    var next = document.getElementById('catNext');
    var ind = document.getElementById('catInd');
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var cur = 0, timer = null, drag = false, sx = 0, dx = 0, suppress = false;
    function step() {
      var t = track.querySelector('.cat-tile');
      return (t ? t.offsetWidth : 168) + 10;
    }
    function per() { return Math.max(1, Math.floor(view.clientWidth / step())); }
    function total() { return Math.max(1, Math.ceil(track.children.length / per())); }
    function renderInd() {
      if (!ind) return;
      ind.innerHTML = '';
      for (var i = 0; i < total(); i++) {
        var d = document.createElement('span');
        (function (k) { d.addEventListener('click', function () { goto(k, true); }); })(i);
        ind.appendChild(d);
      }
    }
    function goto(i, manual) {
      cur = ((i % total()) + total()) % total();
      track.style.transform = 'translateX(-' + (cur * per() * step()) + 'px)';
      if (ind) Array.prototype.forEach.call(ind.children, function (d, k) { d.classList.toggle('on', k === cur); });
      if (manual) restart();
    }
    function auto() {
      clearInterval(timer);
      if (reduced || per() >= track.children.length) return;
      timer = setInterval(function () { goto(cur + 1); }, 3200);
    }
    function restart() { clearInterval(timer); auto(); }
    function stop() { clearInterval(timer); }
    if (prev) prev.addEventListener('click', function () { goto(cur - 1, true); });
    if (next) next.addEventListener('click', function () { goto(cur + 1, true); });
    view.addEventListener('mouseenter', stop);
    view.addEventListener('mouseleave', auto);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop(); else auto();
    });
    if (!reduced) {
      track.addEventListener('pointerdown', function (e) {
        drag = true; sx = e.clientX; dx = 0;
        track.style.transition = 'none';
      });
      window.addEventListener('pointermove', function (e) {
        if (!drag) return;
        dx = e.clientX - sx;
        track.style.transform = 'translateX(' + (dx - cur * per() * step()) + 'px)';
      });
      window.addEventListener('pointerup', function () {
        if (!drag) return;
        drag = false;
        track.style.transition = '';
        if (Math.abs(dx) > 46 && per() < track.children.length) goto(dx < 0 ? cur + 1 : cur - 1, true);
        else if (Math.abs(dx) > 6) goto(cur, false);
        suppress = Math.abs(dx) > 6;
      });
      window.addEventListener('pointercancel', function () {
        if (!drag) return;
        drag = false; track.style.transition = ''; goto(cur, false);
      });
      track.addEventListener('click', function (e) {
        if (suppress) { e.preventDefault(); e.stopPropagation(); suppress = false; }
      }, true);
    }
    window.addEventListener('resize', function () { renderInd(); goto(cur, false); });
    renderInd();
    goto(0, false);
    auto();
  }

  /* ============ flash countdown ============ */
  (function () {
    var d = document.getElementById('cdD'), h = document.getElementById('cdH'), m = document.getElementById('cdM'), s = document.getElementById('cdS');
    if (!d) return;
    function target() { var t = new Date(); t.setHours(24, 0, 0, 0); return t; }
    var t0 = target();
    function tick() {
      var diff = Math.max(0, t0 - new Date());
      d.textContent = pad(Math.floor(diff / 86400000));
      h.textContent = pad(Math.floor(diff % 86400000 / 3600000));
      m.textContent = pad(Math.floor(diff % 3600000 / 60000));
      s.textContent = pad(Math.floor(diff % 60000 / 1000));
      if (diff === 0) t0 = target();
    }
    tick(); setInterval(tick, 1000);
  })();

  /* ============ categories dropdown ============ */
  (function () {
    var btn = document.getElementById('allcatBtn');
    var panel = document.getElementById('catPanel');
    var ov = document.getElementById('catOv');
    if (!btn || !panel) return;
    var hideTimer = null;
    function open() {
      clearTimeout(hideTimer);
      btn.classList.add('open'); panel.classList.add('open');
      if (ov) { ov.hidden = false; void ov.offsetWidth; ov.classList.add('show'); }
    }
    function close() {
      clearTimeout(hideTimer);
      btn.classList.remove('open'); panel.classList.remove('open');
      if (ov) { ov.classList.remove('show'); setTimeout(function () { if (!panel.classList.contains('open')) ov.hidden = true; }, 240); }
    }
    function closeSoon() { clearTimeout(hideTimer); hideTimer = setTimeout(close, 240); }
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (panel.classList.contains('open')) close(); else open();
    });
    [btn, panel].forEach(function (el) {
      el.addEventListener('mouseenter', open);
      el.addEventListener('mouseleave', closeSoon);
    });
    panel.addEventListener('click', function (e) {
      var a = e.target.closest('a[href^="#/"]');
      if (a) close();
    });
    if (ov) ov.addEventListener('click', close);
    document.addEventListener('click', function (e) {
      if (!panel.contains(e.target) && !btn.contains(e.target)) close();
    });
  })();

  /* ============ location ============ */
  (function () {
    var box = document.getElementById('locBox');
    var pop = document.getElementById('locPop');
    var list = document.getElementById('locList');
    var input = document.getElementById('locInput');
    if (!box) return;
    function paint(filter) {
      var q = (filter || '').toLowerCase();
      var rows = LOCATIONS.filter(function (c) { return c.toLowerCase().indexOf(q) !== -1; });
      list.innerHTML = rows.length ? rows.map(function (c) { return '<li data-loc="' + c + '">' + c + '</li>'; }).join('') : '<li class="loc-none">No match</li>';
    }
    function set(city) {
      document.getElementById('locName').textContent = city;
      document.getElementById('topLoc').textContent = city;
      try { localStorage.setItem('sou_loc', city); } catch (e) {}
      pop.hidden = true;
      showToast('Deliver to: <b>' + city + '</b>');
    }
    paint('');
    var saved = null;
    try { saved = localStorage.getItem('sou_loc'); } catch (e) {}
    if (saved) set(saved);
    box.addEventListener('click', function (e) {
      var li = e.target.closest('li[data-loc]');
      if (li) { set(li.getAttribute('data-loc')); return; }
      if (e.target.closest('#locPop')) return;
      e.stopPropagation();
      var open = !pop.hidden;
      pop.hidden = true;
      if (!open) { paint(input.value); pop.hidden = false; input.focus(); }
    });
    input.addEventListener('input', function () { paint(input.value); });
    document.addEventListener('click', function (e) { if (!box.contains(e.target)) pop.hidden = true; });
  })();

  /* ============ account modal ============ */
  var acctModal = document.getElementById('acctModal');
  var modalOv = document.getElementById('modalOv');
  var pendingEmail = null, pendingKind = 'customer', googleAccounts = [];
  function openAcct(panel) { acctModal.hidden = false; modalOv.hidden = false; document.body.classList.add('no-scroll'); if (panel) acctPanel(panel); }
  function closeAcct() { acctModal.hidden = true; modalOv.hidden = true; document.body.classList.remove('no-scroll'); }
  function acctPanel(name) {
    $$('.acct-form').forEach(function (f) { f.hidden = f.getAttribute('data-panel') !== name; });
    $$('.acct-tabs').forEach(function (t) { t.hidden = (name === 'verify' || name === 'google'); });
    $$('.acct-tabs button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-at') === name); });
    var msg = document.getElementById('acctMsg');
    if (msg && name !== 'verify') msg.hidden = true;
  }
  function acctMsg(text, kind) {
    var m = document.getElementById('acctMsg');
    if (!m) return;
    if (!text) { m.hidden = true; m.textContent = ''; return; }
    m.textContent = text;
    m.className = 'acct-msg' + (kind ? ' _' + kind : '');
    m.hidden = false;
  }
  function afterAuth() {
    closeAcct(); updateHeaderAccount(); renderAccount();
    var go = roleHome();
    if (location.hash !== go) location.hash = go;
    showToast('Signed in as <b>' + esc(USER.name) + '</b>');
  }
  (function () {
    var box = document.getElementById('acctBox');
    if (!acctModal) return;
    box.addEventListener('click', function () {
      if (USER) { location.hash = '#/account'; } else { openAcct(); }
    });
    document.getElementById('modalClose').addEventListener('click', closeAcct);
    modalOv.addEventListener('click', closeAcct);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeAcct(); });
    $$('.acct-tabs button').forEach(function (b) {
      b.addEventListener('click', function () { acctPanel(b.getAttribute('data-at')); });
    });
    document.getElementById('loginForm').addEventListener('submit', function (e) {
      e.preventDefault();
      acctMsg('');
      api('/auth/login', { method: 'POST', body: { email: document.getElementById('loginEmail').value.trim(), password: document.getElementById('loginPass').value } })
        .then(function (d) { applyServerUser(d.user); afterAuth(); })
        .catch(function (err) {
          if (err.data && err.data.needsVerification) {
            pendingEmail = err.data.email; pendingKind = err.data.kind || 'customer';
            acctPanel('verify'); acctMsg(err.message, 'info');
          } else { acctMsg(apiFail(err, 'Sign in'), 'err'); }
        });
    });
    document.getElementById('regForm').addEventListener('submit', function (e) {
      e.preventDefault();
      acctMsg('');
      var payload = {
        name: document.getElementById('regName').value.trim(),
        email: document.getElementById('regEmail').value.trim(),
        phone: document.getElementById('regPhone').value.trim(),
        password: document.getElementById('regPass').value
      };
      api('/auth/register', { method: 'POST', body: payload })
        .then(function (d) {
          pendingEmail = payload.email; pendingKind = 'customer';
          acctPanel('verify');
          acctMsg('We emailed a 6-digit code to ' + payload.email + '. It expires in 10 minutes.', 'ok');
          loadMailbox();
        })
        .catch(function (err) { acctMsg(apiFail(err, 'Registration'), 'err'); });
    });
    document.getElementById('verifyForm').addEventListener('submit', function (e) {
      e.preventDefault();
      acctMsg('');
      api('/auth/verify', { method: 'POST', body: { email: pendingEmail, code: document.getElementById('verifyCode').value.trim(), kind: pendingKind } })
        .then(function (d) { applyServerUser(d.user); afterAuth(); })
        .catch(function (err) {
          if (err.data && err.data.needsVerification === false) { acctPanel('login'); acctMsg(err.message, 'info'); return; }
          acctMsg(apiFail(err, 'Verification'), 'err');
        });
    });
    document.getElementById('resendCode').addEventListener('click', function () {
      api('/auth/resend', { method: 'POST', body: { email: pendingEmail, kind: pendingKind } })
        .then(function () { acctMsg('A fresh code is on its way. It expires in 10 minutes.', 'ok'); loadMailbox(); })
        .catch(function (err) { acctMsg(apiFail(err, 'Resend'), 'err'); });
    });
    document.getElementById('verifyBack').addEventListener('click', function () { acctPanel('login'); });
    document.getElementById('openMail').addEventListener('click', function () { closeAcct(); openMailbox(); });
    document.getElementById('googleBtn').addEventListener('click', function () { startGoogle(); });
    document.getElementById('googleBack').addEventListener('click', function () { acctPanel('login'); });
    document.getElementById('fbBtn').addEventListener('click', function () { acctMsg('Facebook sign in is not configured in this demo. Use Google or email.', 'info'); });
    document.getElementById('gOtherBtn').addEventListener('click', function () {
      var email = document.getElementById('gOther').value.trim();
      if (!email) return acctMsg('Enter your Google email address.', 'err');
      googleSignIn({ email: email, name: email.split('@')[0], provider: 'google' });
    });
    document.getElementById('gList').addEventListener('click', function (e) {
      var b = e.target.closest('.g-item');
      if (b) googleSignIn(googleAccounts[parseInt(b.getAttribute('data-i'), 10)]);
    });
  })();

  function startGoogle() {
    acctMsg('');
    api('/auth/config')
      .then(function (cfg) {
        if (cfg.google) { location.href = '/api/auth/google'; return; }
        return api('/auth/google/mock/accounts').then(function (d) {
          googleAccounts = d.accounts || [];
          document.getElementById('gList').innerHTML = googleAccounts.map(function (a, i) {
            return '<button type="button" class="g-item" data-i="' + i + '"><span class="g-av">' + esc(String(a.name || a.email || '?').charAt(0).toUpperCase()) +
              '</span><span><b>' + esc(a.name) + '</b><span>' + esc(a.email) + '</span></span></button>';
          }).join('');
          acctPanel('google');
        });
      })
      .catch(function (err) { acctMsg(apiFail(err, 'Google sign in'), 'err'); });
  }
  function googleSignIn(acct) {
    api('/auth/google/mock', { method: 'POST', body: acct })
      .then(function (d) { applyServerUser(d.user); afterAuth(); })
      .catch(function (err) { acctMsg(apiFail(err, 'Google sign in'), 'err'); });
  }

  /* ============ mailbox ============ */
  var mailModal = document.getElementById('mailModal');
  var mailOv = document.getElementById('mailOv');
  function openMailbox() { loadMailbox(); mailModal.hidden = false; mailOv.hidden = false; document.body.classList.add('no-scroll'); }
  function closeMailbox() { mailModal.hidden = true; mailOv.hidden = true; if (acctModal.hidden) document.body.classList.remove('no-scroll'); }
  function loadMailbox() {
    return api('/dev/outbox').then(function (d) {
      var items = d.messages || d.outbox || [];
      document.getElementById('mailCount').textContent = items.length;
      var body = document.getElementById('mailBody');
      if (!items.length) { body.innerHTML = '<div class="mail-empty">No emails yet. Register, sign in, or apply as a vendor and messages will appear here.</div>'; return; }
      body.innerHTML = items.slice().reverse().map(function (m) {
        var text = m.text || '';
        var cm = text.match(/\b(\d{6})\b/);
        var lm = text.match(/https?:\/\/[^\s]+/);
        var code = cm ? '<div class="mail-code">' + esc(cm[1]) + '</div>' : '';
        var link = lm ? '<a class="mail-link" href="' + esc(lm[0]) + '">' + esc(lm[0]) + '</a>' : '';
        return '<div class="mail-item"><h4>' + esc(m.subject || 'ShopOnlineUg email') + '</h4>' +
          '<div class="mi-meta"><span>To: ' + esc(m.to || '') + '</span><span>' + esc(m.at ? new Date(m.at).toLocaleString('en-GB') : '') + '</span><span>' + esc(m.transport || '') + '</span></div>' +
          '<div class="mi-body">' + esc(text) + '</div>' + code + link + '</div>';
      }).join('');
    }).catch(function () {
      document.getElementById('mailCount').textContent = '0';
      document.getElementById('mailBody').innerHTML = '<div class="mail-empty">' + esc(apiFail(null, 'Mailbox')) + '</div>';
    });
  }
  (function () {
    if (!mailModal) return;
    document.getElementById('mailClose').addEventListener('click', closeMailbox);
    mailOv.addEventListener('click', closeMailbox);
    document.getElementById('mailClear').addEventListener('click', function () {
      api('/dev/outbox', { method: 'DELETE' }).then(function () { loadMailbox(); }).catch(function () {});
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMailbox(); });
    var link = document.getElementById('mailLink');
    if (link) link.addEventListener('click', function (e) { e.preventDefault(); openMailbox(); });
    loadMailbox();
  })();

  /* ============ search suggestions ============ */
  var suggest = document.getElementById('suggest');
  var searchInput = document.getElementById('searchInput');
  function closeSuggest() { if (suggest) { suggest.hidden = true; suggest.innerHTML = ''; } }
  function openSuggest(q) {
    q = q.trim().toLowerCase();
    if (!q) { closeSuggest(); return; }
    var hits = CATALOG.filter(function (p) {
      return stripHtml(p.name).toLowerCase().indexOf(q) !== -1 || p.brand.toLowerCase().indexOf(q) !== -1;
    }).slice(0, 6);
    if (!hits.length) { closeSuggest(); return; }
    suggest.innerHTML = hits.map(function (p) {
      return '<a href="#/p/' + p.id + '" class="sg">' + imgTag(p.img, '', '', false, p.id) +
        '<span class="sg-n">' + p.name + '</span><span class="sg-p">' + fmt(p.price) + '</span></a>';
    }).join('') + '<a href="#/s/' + encodeURIComponent(q) + '" class="sg-all">See all results for &quot;' + esc(q) + '&quot;</a>';
    suggest.hidden = false;
  }
  searchInput.addEventListener('input', function () { openSuggest(searchInput.value); });
  searchInput.addEventListener('focus', function () { if (searchInput.value.trim()) openSuggest(searchInput.value); });
  document.addEventListener('click', function (e) {
    if (suggest && !suggest.contains(e.target) && e.target !== searchInput) closeSuggest();
  });
  suggest.addEventListener('click', function () { closeSuggest(); searchInput.blur(); });
  document.getElementById('searchForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var q = searchInput.value.trim();
    closeSuggest(); searchInput.blur();
    if (!q) { showToast('Type something to search'); return; }
    location.hash = '#/s/' + encodeURIComponent(q);
  });

  /* ============ PDP ============ */
  function galleryFor(p) {
    var imgs = [p.img];
    PRODUCTS[p.key].forEach(function (x) { if (imgs.indexOf(x.img) === -1) imgs.push(x.img); });
    Object.keys(PRODUCTS).forEach(function (k) {
      if (imgs.length >= 4) return;
      PRODUCTS[k].forEach(function (x) { if (imgs.length < 4 && imgs.indexOf(x.img) === -1) imgs.push(x.img); });
    });
    return imgs.slice(0, 4);
  }
  function variantsFor(p) {
    var s = 0;
    p.id.split('').forEach(function (ch) { s += ch.charCodeAt(0); });
    var out = [];
    for (var i = 0; i < 3; i++) out.push(VARIANTS[(s + i) % VARIANTS.length]);
    return out;
  }
  function detailFor(p) {
    var d = DETAILS[p.name] || {};
    return {
      brand: d.brand || p.brand,
      seller: sellerFor(p),
      warranty: d.warranty || (p.key === 'fashion' || p.key === 'beauty' || p.key === 'super' ? 'Genuine product guarantee' : '6 months warranty'),
      desc: d.desc || ('The ' + stripHtml(p.name) + ' is one of our most popular picks in ' + (SECTION_TITLE[p.key] || 'this category') + '. It combines dependable quality with great value, and every order is covered by ShopOnlineUg customer protection with pay on delivery available.'),
      feat: d.feat || [
        'Top-rated pick in ' + (SECTION_TITLE[p.key] || 'this category'),
        'Quality checked before dispatch',
        'Pay on Delivery available',
        'Free 7-day returns',
        'Fast delivery within Kampala and major towns',
        'Sold and shipped by a verified ShopOnlineUg vendor',
        'Great value at ' + pct(p.old, p.price) + '% off the listed price',
        'Rated ' + p.rate.toFixed(1) + '/5 by ' + p.sold.toLocaleString('en-US') + ' shoppers'
      ]
    };
  }

  var pdpQty = 1;
  var currentPdp = null;
  function syncPdpWish() {
    var b = document.getElementById('pdpWish');
    if (b) b.classList.toggle('on', isWished(currentPdp.id));
  }
  function reviewsHtml(p) {
    var all = allReviews(p);
    var mine = userReviews(p.id);
    var form = '<div class="rev-form-wrap"><h3>Write a review</h3>' +
      '<form id="revForm" data-id="' + p.id + '">' +
      '<div class="rev-stars" id="revStars">' +
      [1, 2, 3, 4, 5].map(function (i) { return '<button type="button" class="rev-star" data-star="' + i + '">&#9733;</button>'; }).join('') +
      '</div>' +
      '<input id="revName" type="text" placeholder="Your name" value="' + (USER ? esc(USER.name) : '') + '">' +
      '<textarea id="revText" placeholder="Share your experience with this product"></textarea>' +
      '<button type="submit" class="btn _prim">SUBMIT REVIEW</button>' +
      '</form></div>';
    return '<h3>Customer reviews</h3>' +
      '<div class="rev-sum"><span class="stars">&#9733;</span> <b>' + avgRating(p).toFixed(1) + ' out of 5</b> · ' + reviewCount(p).toLocaleString('en-US') + ' ratings · ' + mine.length + ' written</div>' +
      form +
      all.map(function (rv) {
        return '<div class="review"><div class="rev-h"><b>' + esc(rv.n) + '</b><span class="stars">' + Array(Math.max(0, Math.round(rv.r)) + 1).join('&#9733;') + '</span><span class="rev-date">' + (rv.d || 'Just now') + '</span></div><p>' + esc(rv.t) + '</p></div>';
      }).join('');
  }
  function renderPDP(id) {
    var p = BY_ID[id];
    if (!p) { location.hash = '#/'; return; }
    pdpQty = 1;
    var d = detailFor(p);
    document.getElementById('pdpCrumb').innerHTML = '<a href="#/">Home</a><span>&#8250;</span><a href="#/r/' + p.key + '">' + (SECTION_TITLE[p.key] || 'Category') + '</a><span>&#8250;</span><b>' + p.name + '</b>';
    document.getElementById('pdpBrand').textContent = d.brand;
    document.getElementById('pdpName').innerHTML = p.name;
    document.getElementById('pdpRate').textContent = avgRating(p).toFixed(1);
    document.getElementById('pdpSold').textContent = '(' + reviewCount(p).toLocaleString('en-US') + ' ratings)';
    document.getElementById('pdpStock').textContent = 'In Stock';
    document.getElementById('pdpPrice').textContent = fmt(p.price);
    document.getElementById('pdpOld').textContent = fmt(p.old);
    document.getElementById('pdpOff').textContent = '-' + pct(p.old, p.price) + '%';
    document.getElementById('pdpDelivery').textContent = p.loc + ' and nearby';
    document.getElementById('pdpWarranty').textContent = d.warranty;
    document.getElementById('pdpSeller').innerHTML = '<a href="#/store/' + storeSlug(d.seller) + '">' + esc(d.seller) + '</a>';
    document.getElementById('qtyVal').textContent = '1';
    document.getElementById('pdpSub').textContent = '';
    document.getElementById('pdpColors').innerHTML = variantsFor(p).map(function (v, i) {
      return '<span class="color-chip' + (i === 0 ? ' on' : '') + '">' + v + '</span>';
    }).join('');
    syncPdpWish();

    var imgs = galleryFor(p);
    setImg(document.getElementById('pdpMainImg'), imgs[0], p.id);
    document.getElementById('pdpMainImg').alt = stripHtml(p.name);
    document.getElementById('pdpThumbs').innerHTML = imgs.map(function (im, i) {
      var sd = i === 0 ? p.id : p.id + '-' + i;
      return '<button type="button" class="thumb' + (i === 0 ? ' on' : '') + '" data-img="' + im + '" data-seed="' + sd + '">' + imgTag(im, '', '', false, sd) + '</button>';
    }).join('');

    document.getElementById('tabDesc').innerHTML = '<h3>Product description</h3><p>' + esc(decode(d.desc)) + '</p><h3>Why shop with ShopOnlineUg</h3><p>Enjoy pay on delivery, free 7-day returns and friendly customer support in Uganda. Every order is backed by our buyer protection promise.</p>';
    document.getElementById('tabSpecs').innerHTML = '<h3>Specifications</h3><table class="spec-table"><tbody>' +
      '<tr><td>Brand</td><td>' + esc(d.brand) + '</td></tr>' +
      '<tr><td>Model</td><td>' + esc(decode(p.name)) + '</td></tr>' +
      '<tr><td>Category</td><td>' + (SECTION_TITLE[p.key] || 'General') + '</td></tr>' +
      '<tr><td>SKU</td><td>' + p.id.toUpperCase() + '</td></tr>' +
      '<tr><td>Warranty</td><td>' + esc(d.warranty) + '</td></tr>' +
      '<tr><td>Seller</td><td>' + esc(d.seller) + '</td></tr>' +
      '<tr><td>Availability</td><td>In Stock</td></tr></tbody></table>';
    document.getElementById('tabDel').innerHTML = '<h3>Delivery information</h3><p>Delivery to <b>' + p.loc + '</b> and nearby towns. Orders placed before 3pm are usually delivered the next working day. Delivery is free on orders above UGX 200,000, otherwise a small fee of UGX 5,500 applies.</p><h3>Returns &amp; refunds</h3><p>Changed your mind? Return the item within 7 days in its original condition for a full refund. Some items such as groceries and personal care products are non-returnable for hygiene reasons.</p>';
    document.getElementById('tabRev').innerHTML = reviewsHtml(p);
    setTab('desc');

    var rel = PRODUCTS[p.key].map(function (x, i) { return BY_ID[productId(p.key, i)]; });
    var seen = {}, pool = rel.concat(CATALOG), out = [];
    pool.forEach(function (x) {
      if (!x || out.length >= 6 || x.id === p.id || seen[x.id]) return;
      seen[x.id] = 1; out.push(x);
    });
    document.getElementById('pdpRelated').innerHTML = out.map(function (x) { return card(x); }).join('');
    updateWishCount();
  }

  function setTab(name) {
    $$('.pdp-tabs .tab').forEach(function (t) { t.classList.toggle('on', t.getAttribute('data-tab') === name); });
    var map = { desc: 'tabDesc', specs: 'tabSpecs', del: 'tabDel', rev: 'tabRev' };
    Object.keys(map).forEach(function (k) { document.getElementById(map[k]).hidden = k !== name; });
  }
  $$('.pdp-tabs .tab').forEach(function (t) {
    t.addEventListener('click', function () { setTab(t.getAttribute('data-tab')); });
  });
  document.getElementById('pdpThumbs').addEventListener('click', function (e) {
    var th = e.target.closest('.thumb');
    if (!th) return;
    $$('.thumb').forEach(function (x) { x.classList.remove('on'); });
    th.classList.add('on');
    setImg(document.getElementById('pdpMainImg'), th.getAttribute('data-img'), th.getAttribute('data-seed'));
  });
  document.getElementById('pdpColors').addEventListener('click', function (e) {
    var chip = e.target.closest('.color-chip');
    if (!chip) return;
    $$('.color-chip').forEach(function (x) { x.classList.remove('on'); });
    chip.classList.add('on');
  });
  document.getElementById('qtyMinus').addEventListener('click', function () {
    pdpQty = Math.max(1, pdpQty - 1);
    document.getElementById('qtyVal').textContent = pdpQty; syncSub();
  });
  document.getElementById('qtyPlus').addEventListener('click', function () {
    pdpQty = Math.min(20, pdpQty + 1);
    document.getElementById('qtyVal').textContent = pdpQty; syncSub();
  });
  function syncSub() {
    if (!currentPdp) return;
    document.getElementById('pdpSub').textContent = pdpQty > 1 ? 'Subtotal: ' + fmt(currentPdp.price * pdpQty) : '';
  }
  document.getElementById('pdpAdd').addEventListener('click', function () {
    if (!currentPdp) return;
    addToCart(currentPdp.id, pdpQty);
    showToast('Added to cart: <b>' + decode(currentPdp.name) + '</b>' + (pdpQty > 1 ? ' ×' + pdpQty : ''));
  });
  document.getElementById('pdpBuy').addEventListener('click', function () {
    if (!currentPdp) return;
    addToCart(currentPdp.id, pdpQty);
    location.hash = '#/checkout';
  });
  document.getElementById('pdpWish').addEventListener('click', function () {
    if (currentPdp) toggleWish(currentPdp.id);
  });
  document.getElementById('pdpShare').addEventListener('click', function () {
    if (currentPdp) openShare(currentPdp);
  });
  document.addEventListener('click', function (e) {
    var s = e.target.closest('.rev-star');
    if (s) {
      var form = s.closest('#revForm');
      $$('.rev-star', form).forEach(function (b, i) { b.classList.toggle('on', i < parseInt(s.getAttribute('data-star'), 10)); });
      form.setAttribute('data-rating', s.getAttribute('data-star'));
      return;
    }
  });
  document.addEventListener('submit', function (e) {
    if (!e.target || e.target.id !== 'revForm') return;
    e.preventDefault();
    var form = e.target;
    var rating = parseInt(form.getAttribute('data-rating') || '0', 10);
    var name = ($('#revName', form).value || '').trim() || 'Anonymous';
    var text = ($('#revText', form).value || '').trim();
    if (!rating) { showToast('Please pick a star rating'); return; }
    if (!text) { showToast('Please write a short review'); return; }
    var id = form.getAttribute('data-id');
    if (!REVS[id]) REVS[id] = [];
    REVS[id].unshift({ n: name, r: rating, t: text, d: 'Just now' });
    saveRevs();
    showToast('Thanks! Your review was submitted');
    document.getElementById('tabRev').innerHTML = reviewsHtml(BY_ID[id]);
    document.getElementById('pdpRate').textContent = avgRating(BY_ID[id]).toFixed(1);
  });

  /* ============ wishlist page ============ */
  function renderWishPage() {
    var items = wish.map(function (id) { return BY_ID[id]; }).filter(Boolean);
    document.getElementById('wishN').textContent = items.length + ' saved item' + (items.length === 1 ? '' : 's');
    document.getElementById('wishGrid').innerHTML = items.map(function (x) { return card(x); }).join('');
    document.getElementById('wishGrid').hidden = items.length === 0;
    document.getElementById('wishEmpty').hidden = items.length > 0;
  }

  /* ============ store page ============ */
  function sellerFromSlug(slug) {
    var names = Object.keys(STORE_ABOUT).concat(CATALOG.map(sellerFor));
    for (var i = 0; i < names.length; i++) {
      if (storeSlug(names[i]) === slug) return names[i];
    }
    return null;
  }
  function renderStore(slug) {
    var name = sellerFromSlug(slug);
    if (!name) { location.hash = '#/'; return; }
    var items = CATALOG.filter(function (p) { return sellerFor(p) === name; });
    document.getElementById('storeCrumb').textContent = name;
    document.getElementById('storeName').textContent = name;
    document.getElementById('storeLogo').textContent = name.replace(/[^A-Za-z ]/g, '').split(' ').map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase();
    document.getElementById('storeCount').textContent = items.length + ' products';
    document.getElementById('storeAbout').textContent = STORE_ABOUT[name] || 'A verified ShopOnlineUg marketplace seller offering quality products with fast delivery across Uganda.';
    document.getElementById('storeProductCount').textContent = items.length + ' products';
    document.getElementById('storeGrid').innerHTML = items.map(function (x) { return card(x); }).join('');
    var follows = load('sou_follow', []);
    var btn = document.getElementById('storeFollow');
    btn.textContent = follows.indexOf(name) !== -1 ? 'FOLLOWING' : 'FOLLOW';
    btn.setAttribute('data-store', name);
    updateWishCount();
  }
  document.getElementById('storeFollow').addEventListener('click', function () {
    var btn = document.getElementById('storeFollow');
    var name = btn.getAttribute('data-store');
    var follows = load('sou_follow', []);
    var i = follows.indexOf(name);
    if (i === -1) { follows.push(name); btn.textContent = 'FOLLOWING'; showToast('Following ' + name); }
    else { follows.splice(i, 1); btn.textContent = 'FOLLOW'; showToast('Unfollowed ' + name); }
    save('sou_follow', follows);
  });

  /* ============ orders page ============ */
  /*
   * Orders now live on the server. My Orders paints the server copy (which
   * carries the live delivery status and rider) and falls back to any purely
   * local/guest orders that were never synced.
   */
  var SERVER_ORDERS = [];
  function serverOrderToLocal(so) {
    return {
      no: so.orderNo,
      serverId: so.id,
      ts: so.createdAt,
      items: (so.items || []).map(function (it) { return { id: it.id, qty: it.qty, name: it.name, img: it.img, price: it.price }; }),
      total: so.total,
      name: so.name, phone: so.phone, region: so.region, town: so.town, addr: so.addr,
      pay: so.pay, payMethod: so.payMethod, payStatus: so.payStatus,
      status: so.status, deliveryStatus: so.deliveryStatus
    };
  }
  function loadServerOrders() {
    if (!SERVER_USER) { SERVER_ORDERS = []; return Promise.resolve(); }
    return api('/orders').then(function (d) { SERVER_ORDERS = d.orders || []; }).catch(function () {});
  }
  function serverStage(o) {
    if (o.status === 'Delivered') return 4;
    if (o.status === 'Cancelled') return 0;
    var map = { approved: 1, assigned: 2, picked: 2, transit: 3, arrived: 3, delivered: 4, cancelled: 0 };
    var key = o.deliveryStatus || (o.delivery && o.delivery.status);
    if (map[key] != null) return map[key];
    return o.status === 'Approved' ? 1 : 0;
  }
  function combinedOrders() {
    var seen = {};
    var out = SERVER_ORDERS.map(function (so) {
      seen[so.id] = true;
      return {
        server: true, id: so.id, no: so.orderNo, ts: so.createdAt, items: so.items, total: so.total,
        name: so.name, phone: so.phone, region: so.region, town: so.town, addr: so.addr,
        pay: so.pay, payMethod: so.payMethod, payStatus: so.payStatus,
        status: so.status, deliveryStatus: so.deliveryStatus, delivery: so.delivery, stage: serverStage(so)
      };
    });
    ORDERS.forEach(function (o) {
      if (o.serverId && seen[o.serverId]) return;
      out.push({ local: true, no: o.no, ts: o.ts, items: o.items, total: o.total, name: o.name, phone: o.phone, region: o.region, town: o.town, addr: o.addr, pay: o.pay, payMethod: o.payMethod, payStatus: o.payStatus, stage: stageFor(o) });
    });
    return out;
  }
  function paintOrders() {
    var list = document.getElementById('ordersList');
    var empty = document.getElementById('ordersEmpty');
    var orders = combinedOrders();
    document.getElementById('ordersN').textContent = orders.length + ' order' + (orders.length === 1 ? '' : 's');
    if (!orders.length) {
      list.innerHTML = '';
      empty.hidden = false;
      document.getElementById('ordersEmpty').innerHTML = SERVER_USER
        ? '<h3>No orders yet</h3><p>When you place an order it will show up here with live delivery tracking.</p><a class="btn _prim" href="#/">Start shopping</a>'
        : '<h3>No orders yet</h3><p>Sign in to see your orders across devices, or place an order to track it here.</p><a class="btn _prim" href="#/">Start shopping</a>';
      return;
    }
    empty.hidden = true;
    list.innerHTML = orders.map(function (o) {
      var stage = o.stage != null ? o.stage : stageFor(o);
      var items = (o.items || []).map(function (it) {
        return { p: BY_ID[it.id] || { id: it.id, img: it.img || 'prod-home', name: it.name || 'Item', price: it.price || 0 }, qty: it.qty };
      }).filter(function (x) { return x.p; });
      var steps = STAGES.map(function (s, i) {
        var cls = i < stage ? 'done' : (i === stage ? 'active' : '');
        return '<div class="tstep ' + cls + '"><span class="tdot"></span><span class="tlbl">' + s + '</span></div>';
      }).join('');
      var d = o.delivery;
      var driverLine = '';
      if (d && d.driver) {
        driverLine = '<div class="order-driver">Rider: <b>' + esc(d.driver.name || 'Assigned') + '</b>' +
          (d.driver.vehicleType ? ' · ' + esc(d.driver.vehicleType) : '') +
          (d.driver.numberPlate ? ' · ' + esc(d.driver.numberPlate) : '') + '</div>';
      }
      var rateLine = '';
      if (o.server && o.deliveryStatus === 'delivered' && d && d.driver) {
        if (d.rating) {
          rateLine = '<div class="order-rate _done">You rated this delivery ' + '&#9733;'.repeat(Math.max(1, Math.min(5, d.rating))) + '</div>';
        } else {
          rateLine = '<div class="order-rate" data-oid="' + esc(o.id) + '"><span>Rate your rider:</span>' +
            [1, 2, 3, 4, 5].map(function (n) { return '<button type="button" class="rate-star" data-rating="' + n + '" title="' + n + ' star' + (n === 1 ? '' : 's') + '">&#9733;</button>'; }).join('') +
            '</div>';
        }
      }
      return '<div class="order">' +
        '<div class="order-h"><div><span class="order-no">#' + esc(o.no) + '</span><span class="order-date">' + dateStr(o.ts) + '</span></div>' +
        '<span class="order-total">' + fmt(o.total) + '</span></div>' +
        '<div class="order-items">' + items.map(function (x) {
          return '<a class="oi" href="#/p/' + x.p.id + '">' + imgTag(x.p.img, '', '', false, x.p.id) + '<span>' + esc(stripHtml(x.p.name)) + '</span><i>×' + x.qty + '</i></a>';
        }).join('') + '</div>' +
        '<div class="track">' +
          '<div class="track-bar"><div class="track-fill" style="width:' + (stage / 4 * 100) + '%"></div></div>' +
          '<div class="track-steps">' + steps + '</div>' +
          '<div class="track-eta">' + (stage >= 4 ? 'Delivered' : 'Estimated delivery: ' + etaStr(o.ts, 2)) + ' · Pay: ' + esc(o.pay || 'Pay on Delivery') +
            (o.payStatus === 'Paid' ? ' · <span class="pbadge _approved" style="font-size:11px;vertical-align:middle">Paid</span>' : ' · <span class="pbadge _pending" style="font-size:11px;vertical-align:middle">Pending</span>') + '</div>' +
        '</div>' +
        driverLine + rateLine +
        '<div class="order-foot">Deliver to ' + esc(o.name || 'Customer') + ' · ' + esc(o.town || o.region || 'Kampala') + ' · ' + esc(o.phone || '') + '</div>' +
      '</div>';
    }).join('');
  }
  function renderOrders() {
    paintOrders();
    loadServerOrders().then(function () { if (!document.getElementById('ordersPage').hidden) paintOrders(); });
  }
  document.addEventListener('click', function (e) {
    var star = e.target.closest('.rate-star');
    if (!star) return;
    var wrap = star.closest('.order-rate');
    if (!wrap) return;
    var oid = wrap.getAttribute('data-oid');
    var rating = parseInt(star.getAttribute('data-rating'), 10) || 5;
    wrap.innerHTML = '<span class="rate-star-spin"></span>Submitting your rating…';
    api('/orders/' + encodeURIComponent(oid) + '/rate-driver', { method: 'POST', body: { rating: rating, text: rating >= 4 ? 'Great delivery service.' : 'Delivery could be improved.' } })
      .then(function () { showToast('Thanks for rating your rider'); return loadServerOrders(); })
      .then(function () { paintOrders(); })
      .catch(function (err) { showToast(apiFail(err, 'Rating')); paintOrders(); });
  });

  /* ============ account page ============ */
  function renderAccount() {
    var side = document.getElementById('acctSide');
    var body = document.getElementById('acctBody');
    if (USER) {
      side.innerHTML = '<div class="profile"><div class="avatar">' + esc(USER.name.split(' ').map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase()) + '</div>' +
        '<h3>' + esc(USER.name) + '</h3><p>' + esc(USER.email) + '</p>' +
        '<button type="button" class="btn signout" id="signOutBtn">Sign out</button></div>';
    } else {
      side.innerHTML = '<div class="profile"><div class="avatar">?</div><h3>Welcome</h3><p>Sign in to track orders, save products and check out faster.</p>' +
        '<button type="button" class="btn _prim" id="acctSignIn">Sign in / Register</button></div>';
    }
    body.innerHTML = '<div class="acct-tiles">' +
      '<a class="tile" href="#/orders"><b>' + ORDERS.length + '</b><span>My Orders</span></a>' +
      '<a class="tile" href="#/wish"><b>' + wish.length + '</b><span>Wishlist</span></a>' +
      '<a class="tile" href="#/account"><b>' + VIEWED.length + '</b><span>Recently viewed</span></a>' +
      '</div>' +
      accountPortalHtml() +
      '<h3 class="acct-h">Recently viewed</h3>' +
      '<div class="prd-row grid6" id="acctRecent"></div>' +
      '<button type="button" class="btn signout acct-reset" id="acctReset">Reset demo data</button>';
    document.getElementById('acctRecent').innerHTML = (VIEWED.map(function (id) { return BY_ID[id]; }).filter(Boolean).map(function (x) { return card(x); }).join('')) ||
      '<div class="acct-none">No products viewed yet.</div>';
    updateWishCount();
  }
  function accountPortalHtml() {
    if (!SERVER_USER) return '';
    var u = SERVER_USER;
    var html = '<h3 class="acct-h">Marketplace accounts</h3>';
    if (u.role === 'admin') {
      html += '<p class="acct-none">Signed in as administrator.</p><div class="acct-quick">' +
        '<a href="#/admin"><b>Admin portal</b><span>Approve vendors and products, manage users and orders.</span></a>' +
        '<a href="#/vendor"><b>Vendor hub</b><span>Preview the seller experience.</span></a></div>';
    } else if (u.role === 'vendor' && u.vendor) {
      html += '<p class="acct-none">' + esc(u.vendor.name) + ' <span class="pbadge _' + esc(u.vendor.status) + '">' + esc(u.vendor.status) + '</span></p>' +
        '<div class="acct-quick"><a href="#/vendor"><b>Vendor dashboard</b><span>Add products, track orders and manage your store.</span></a>' +
        '<a href="#/store/' + esc(storeSlug(u.vendor.name)) + '"><b>Public store page</b><span>See how buyers view your listings.</span></a></div>';
    } else if (u.role === 'customer') {
      html += '<p class="acct-none">Your email is verified.</p><div class="acct-quick">' +
        '<a href="#/sell"><b>Become a vendor</b><span>Open your own store on ShopOnlineUg.</span></a>' +
        '<a href="#/driver"><b>Rider portal</b><span>Apply to deliver orders and earn per drop.</span></a>' +
        '<a href="#/"><b>Keep shopping</b><span>Browse today&rsquo;s deals.</span></a></div>';
    }
    return html;
  }
  document.addEventListener('click', function (e) {
    if (e.target.closest('#signOutBtn')) { signOut(); return; }
    if (e.target.closest('#acctSignIn')) { openAcct(); return; }
    if (e.target.closest('#acctReset')) { resetDemo(); return; }
  });

  /* ============ search page ============ */
  function renderSearch(q) {
    q = decode(q);
    var lower = q.trim().toLowerCase();
    var hits = CATALOG.filter(function (p) {
      return stripHtml(p.name).toLowerCase().indexOf(lower) !== -1 ||
        p.brand.toLowerCase().indexOf(lower) !== -1 ||
        (SECTION_TITLE[p.key] || '').toLowerCase().indexOf(lower) !== -1;
    });
    document.getElementById('searchTerm').textContent = q;
    document.getElementById('searchH').textContent = 'Results for "' + q + '"';
    document.getElementById('searchCount').textContent = hits.length + ' product' + (hits.length === 1 ? '' : 's') + ' found';
    document.getElementById('searchGrid').innerHTML = hits.map(card).join('');
    document.getElementById('searchEmpty').hidden = hits.length > 0;
    document.getElementById('searchGrid').hidden = hits.length === 0;
    updateWishCount();
  }

  /* ============ browse page ============ */
  function renderBrowse(key) {
    var title = SECTION_TITLE[key] || 'Products';
    var info = catItems(key);
    document.getElementById('browseName').textContent = title;
    document.getElementById('browseH').textContent = title;
    var box = document.getElementById('browseGrid');
    var empty = document.getElementById('browseEmpty');
    if (!info.count) {
      box.innerHTML = ''; box.hidden = true; empty.hidden = false;
      document.getElementById('browseEmptyH').textContent = title + ' coming soon';
      document.getElementById('browseCount').textContent = '';
      return;
    }
    box.hidden = false; empty.hidden = true;
    document.getElementById('browseCount').textContent = info.count + ' product' + (info.count === 1 ? '' : 's');
    box.innerHTML = info.items.map(function (p, i) { return card(p.id ? p : BY_ID[productId(key, i)]); }).join('');
    updateWishCount();
  }

  /* ============ payment ============ */
  var payModal = document.getElementById('payModal');
  var payModalOv = document.getElementById('payModalOv');
  var payModalBody = document.getElementById('payModalBody');
  var payProcessing = false;
  function openPayModal(html) {
    payModalBody.innerHTML = html;
    payModal.hidden = false;
    payModalOv.hidden = false;
    document.body.classList.add('no-scroll');
  }
  function closePayModal() {
    if (payProcessing) return;
    payModal.hidden = true;
    payModalOv.hidden = true;
    if ((!acctModal || acctModal.hidden) && (!mailModal || mailModal.hidden)) document.body.classList.remove('no-scroll');
  }
  document.getElementById('payModalClose').addEventListener('click', closePayModal);
  payModalOv.addEventListener('click', closePayModal);
  function renderMomoPrompt(brand, amount, onSuccess) {
    var cls = brand.indexOf('MTN') !== -1 ? '_mtn' : '_airtel';
    openPayModal(
      '<div class="pay-prompt">' +
      '<div class="pay-logo ' + cls + '">' + esc(brand) + '</div>' +
      '<div class="pay-amount">UGX ' + money0(amount) + '</div>' +
      '<div class="pay-label">You are about to pay ShopOnlineUg. Enter your Mobile Money PIN to approve this payment.</div>' +
      '<div class="pay-pin">' +
      '<input id="payPin1" type="tel" maxlength="1" inputmode="numeric" autofocus>' +
      '<input id="payPin2" type="tel" maxlength="1" inputmode="numeric">' +
      '<input id="payPin3" type="tel" maxlength="1" inputmode="numeric">' +
      '<input id="payPin4" type="tel" maxlength="1" inputmode="numeric">' +
      '</div>' +
      '<div class="pay-row"><div><button class="btn _prim" type="button" id="payApprove">Approve payment</button></div>' +
      '<div><button class="btn _ghost" type="button" id="payMomoCancel">Cancel</button></div></div>' +
      '<div class="pay-status" id="payStatus">Demo PIN: <b>' + DEMO_PIN + '</b></div>' +
      '</div>'
    );
    var pins = ['payPin1', 'payPin2', 'payPin3', 'payPin4'].map(function (id) { return document.getElementById(id); });
    if (pins[0]) pins[0].focus();
    pins.forEach(function (inp, i) {
      if (!inp) return;
      inp.addEventListener('input', function () {
        if (inp.value.length === 1 && i < pins.length - 1) pins[i + 1].focus();
      });
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Backspace' && !inp.value && i > 0) pins[i - 1].focus();
        if (e.key === 'Enter') document.getElementById('payApprove').click();
        if (!/^[0-9]$/.test(e.key) && e.key.length === 1) e.preventDefault();
      });
    });
    document.getElementById('payMomoCancel').addEventListener('click', function () { if (!payProcessing) closePayModal(); });
    document.getElementById('payApprove').addEventListener('click', function () {
      var status = document.getElementById('payStatus');
      var pin = pins.map(function (x) { return x ? x.value : ''; }).join('');
      if (pin.length < 4) {
        status.className = 'pay-status _err';
        status.textContent = 'Please enter all 4 digits of your PIN.';
        return;
      }
      if (pin !== DEMO_PIN) {
        status.className = 'pay-status _err';
        status.textContent = 'Incorrect PIN. Please try again.';
        pins.forEach(function (x) { if (x) { x.value = ''; x.style.borderColor = '#DC2626'; } });
        if (pins[0]) pins[0].focus();
        return;
      }
      status.className = 'pay-status';
      status.innerHTML = '<span class="pay-spin"></span>Processing payment&hellip;';
      document.getElementById('payApprove').disabled = true;
      document.querySelector('#payMomoCancel').disabled = true;
      payProcessing = true;
      setTimeout(function () {
        status.className = 'pay-status _ok';
        status.innerHTML = '&#10003; Payment approved';
        setTimeout(function () { payProcessing = false; closePayModal(); onSuccess(); }, 900);
      }, 1300);
    });
  }
  function renderCardPrompt(amount, onSuccess) {
    openPayModal(
      '<div class="pay-prompt">' +
      '<div class="pay-logo _card">Card Payment</div>' +
      '<div class="pay-amount">UGX ' + money0(amount) + '</div>' +
      '<div class="pay-label">Pay securely with a Visa or Mastercard debit or credit card.</div>' +
      '<div class="pay-field"><label for="payCardNo">Card number</label><input id="payCardNo" type="text" inputmode="numeric" maxlength="19" placeholder="4111 1111 1111 1111" autocomplete="off"></div>' +
      '<div class="pay-row"><div class="pay-field"><label for="payCardExp">Expiry (MM/YY)</label><input id="payCardExp" type="text" inputmode="numeric" maxlength="7" placeholder="MM/YY"></div>' +
      '<div class="pay-field"><label for="payCardCvv">CVV</label><input id="payCardCvv" type="password" inputmode="numeric" maxlength="4" placeholder="123"></div></div>' +
      '<div class="pay-field"><label for="payCardName">Name on card</label><input id="payCardName" type="text" placeholder="e.g. Amina Nakato"></div>' +
      '<div class="pay-row"><div><button class="btn _prim" type="button" id="payCardSubmit">Pay UGX ' + money0(amount) + '</button></div>' +
      '<div><button class="btn _ghost" type="button" id="payCardCancel">Cancel</button></div></div>' +
      '<div class="pay-status" id="payCardStatus"></div>' +
      '</div>'
    );
    var numInp = document.getElementById('payCardNo');
    var expInp = document.getElementById('payCardExp');
    var cvvInp = document.getElementById('payCardCvv');
    var nameInp = document.getElementById('payCardName');
    numInp.addEventListener('input', function () {
      var pos = numInp.selectionStart || 0;
      var oldLen = numInp.value.length;
      numInp.value = formatCardNum(numInp.value);
      var diff = numInp.value.length - oldLen;
      var set = pos + diff;
      if (set < 0) set = 0;
      numInp.setSelectionRange(set, set);
    });
    expInp.addEventListener('input', function () {
      var d = expInp.value.replace(/[^\d]/g, '').slice(0, 4);
      expInp.value = d.length > 2 ? d.slice(0, 2) + '/' + d.slice(2) : d;
    });
    cvvInp.addEventListener('input', function () {
      cvvInp.value = cvvInp.value.replace(/\D/g, '').slice(0, 4);
    });
    document.getElementById('payCardCancel').addEventListener('click', function () { if (!payProcessing) closePayModal(); });
    document.getElementById('payCardSubmit').addEventListener('click', function () {
      var status = document.getElementById('payCardStatus');
      var num = formatCardNum(numInp.value).replace(/\s/g, '');
      var exp = expInp.value.trim();
      var cvv = cvvInp.value.trim();
      var name = nameInp.value.trim();
      if (!num) { status.className = 'pay-status _err'; status.textContent = 'Please enter your card number.'; return; }
      var brand = cardBrand(num);
      if (!brand) { status.className = 'pay-status _err'; status.textContent = 'Only Visa and Mastercard are accepted.'; return; }
      if (!luhnCheck(num)) { status.className = 'pay-status _err'; status.textContent = 'This card number is not valid.'; return; }
      if (!exp) { status.className = 'pay-status _err'; status.textContent = 'Please enter the card expiry date.'; return; }
      if (!expiryOk(exp)) { status.className = 'pay-status _err'; status.textContent = 'Card expiry is invalid or in the past.'; return; }
      if (!/^\d{3,4}$/.test(cvv)) { status.className = 'pay-status _err'; status.textContent = 'Please enter a valid CVV.'; return; }
      if (!name) { status.className = 'pay-status _err'; status.textContent = 'Please enter the name on the card.'; return; }
      status.className = 'pay-status';
      status.innerHTML = '<span class="pay-spin"></span>Processing payment&hellip;';
      document.getElementById('payCardSubmit').disabled = true;
      document.getElementById('payCardCancel').disabled = true;
      payProcessing = true;
      setTimeout(function () {
        status.className = 'pay-status _ok';
        status.innerHTML = '&#10003; Payment approved via ' + brand;
        setTimeout(function () { payProcessing = false; closePayModal(); onSuccess(); }, 900);
      }, 1600);
    });
  }

  /* ============ checkout ============ */
  function renderCheckout() {
    if (!cart.length) { showToast('Your cart is empty'); location.hash = '#/'; return; }
    var region = document.getElementById('coRegion');
    region.innerHTML = LOCATIONS.map(function (c) { return '<option>' + c + '</option>'; }).join('');
    var items = cart.map(function (it) { return { p: BY_ID[it.id], qty: it.qty }; }).filter(function (x) { return x.p; });
    document.getElementById('coItems').innerHTML = items.map(function (x) {
      return '<div class="co-item">' + imgTag(x.p.img, '', '', false, x.p.id) + '<div><div class="co-item-name">' + x.p.name + '</div><div class="co-item-q">Qty ' + x.qty + '</div></div><b>' + fmt(x.p.price * x.qty) + '</b></div>';
    }).join('');
    var sub = cartSubtotal();
    var fee = sub >= (CONF.freeThreshold || 200000) ? 0 : (CONF.deliveryFee || 5500);
    document.getElementById('coSubtotal').textContent = fmt(sub);
    document.getElementById('coDelivery').textContent = fee ? fmt(fee) : 'FREE';
    document.getElementById('coGrand').textContent = fmt(sub + fee);
  }
  document.getElementById('coBackCart').addEventListener('click', function (e) { e.preventDefault(); openDrawer(); });
  $$('.pay-row').forEach(function (r) {
    r.addEventListener('click', function () {
      $$('.pay-row').forEach(function (x) { x.classList.remove('on'); });
      r.classList.add('on');
    });
  });
  document.getElementById('coPlace').addEventListener('click', function () {
    var form = document.getElementById('coForm');
    if (!form.reportValidity()) return;
    var items = cart.slice();
    var sub = cartSubtotal();
    var fee = sub >= (CONF.freeThreshold || 200000) ? 0 : (CONF.deliveryFee || 5500);
    var total = sub + fee;
    var payRow = $('.pay-row.on');
    var payVal = payRow ? payRow.getAttribute('data-pay') : 'pod';
    var payLabel = payRow ? (payRow.querySelector('b') || {}).textContent || 'Cash' : 'Pay on Delivery';
    var contact = {
      name: document.getElementById('coName').value,
      phone: document.getElementById('coPhone').value,
      region: document.getElementById('coRegion').value,
      town: document.getElementById('coTown').value,
      addr: document.getElementById('coAddr').value
    };
    function localOrder(payStatus) {
      return Object.assign({
        no: 'UG' + Math.floor(100000000 + Math.random() * 899999999),
        ts: Date.now(),
        items: items,
        total: total,
        pay: payLabel,
        payMethod: payVal,
        payStatus: payStatus
      }, contact);
    }
    function done(o) {
      addOrder(o);
      cart = [];
      saveCart(); updateBadge(); renderDrawer();
      location.hash = '#/success/' + o.no;
    }
    var placeBtn = document.getElementById('coPlace');
    function finalize(payStatus) {
      if (!SERVER_USER) { done(localOrder(payStatus)); return; }
      placeBtn.disabled = true;
      api('/orders', {
        method: 'POST',
        body: {
          items: items.map(function (it) { return { id: it.id, qty: it.qty }; }),
          name: contact.name, phone: contact.phone, region: contact.region, town: contact.town, addr: contact.addr,
          pay: payLabel, payMethod: payVal, payStatus: payStatus
        }
      }).then(function (d) {
        placeBtn.disabled = false;
        if (d && d.order) done(serverOrderToLocal(d.order)); else done(localOrder(payStatus));
        loadServerOrders().then(function () { if (!document.getElementById('ordersPage').hidden) paintOrders(); });
      }).catch(function (e) {
        placeBtn.disabled = false;
        showToast(apiFail(e, 'Order'));
      });
    }
    if (payVal === 'mtn' || payVal === 'airtel') {
      renderMomoPrompt(payLabel, total, function () { finalize('Paid'); });
      return;
    }
    if (payVal === 'card') {
      renderCardPrompt(total, function () { finalize('Paid'); });
      return;
    }
    finalize('Pending');
  });

  /* ============ info pages ============ */
  var INFO = {
    help: ['Help Centre', 'Call our customer care on <b>+256-700-579-597</b> (Mon - Sun, 8am - 9pm) or email <b>help@shoponline.ug</b>. You can also chat with us in the ShopOnlineUg app for instant answers about orders, delivery, returns and payments.'],
    track: ['Track your order', 'Open <b>My Orders</b> to follow each order from confirmation to delivery. You will see a live timeline for every order you place.'],
    returns: ['Returns &amp; Cancellations', 'You may return most items within <b>7 days</b> of delivery in their original packaging. Go to <b>My Orders</b>, select the item and choose <b>Return</b>. Groceries and personal care items cannot be returned for hygiene reasons.'],
    delivery: ['Delivery information', function () { return 'We deliver across Uganda. Orders to Kampala and major towns are usually delivered within <b>24 - 48 hours</b>. Delivery is free for orders above <b>' + fmt(CONF.freeThreshold || 200000) + '</b>, otherwise a fee of ' + fmt(CONF.deliveryFee || 5500) + ' applies. Pay on delivery is available.'; }],
    about: ['About ShopOnlineUg', 'ShopOnlineUg is the leading e-commerce platform in Africa. Our marketplace connects millions of buyers with thousands of vendors, offering electronics, fashion, home goods, groceries and much more at the best prices with convenient pay on delivery.'],
    career: ['ShopOnlineUg careers', 'Join a team that is building the future of commerce in Africa. We hire across engineering, logistics, commercial, marketing and operations. Send your CV to <b>careers@shoponline.ug</b>.'],
    sell: ['Sell on ShopOnlineUg', 'Reach millions of customers across Uganda. List your products on our marketplace, manage orders from the Vendor Hub and get paid on time. Registration is free - start selling today.'],
    term: ['Terms and conditions', 'By using the ShopOnlineUg platform you agree to our terms of use, marketplace policies and privacy practices. Prices, availability and promotions may change without notice. All purchases are subject to our buyer protection policy.'],
    privacy: ['Privacy notice', 'We respect your privacy. This notice explains what personal data we collect, how we use it to process orders and improve your experience, and the choices you have. We never sell your personal data to third parties.'],
    cookie: ['Cookie notice', 'Like most websites, we use cookies and similar technologies to keep you signed in, remember your cart and personalise the content and ads you see. You can control cookies in your browser settings.'],
    prime: ['ShopOnlineUg Prime', 'ShopOnlineUg Prime gives you unlimited free delivery on eligible orders for a small monthly fee. Subscribe for <b>UGX 15,000</b> per month and enjoy faster delivery plus exclusive member-only deals.'],
    pay: ['Payment methods', 'Shop the way you like. We accept <b>MTN Mobile Money</b>, <b>Airtel Money</b>, <b>Visa</b> and <b>Mastercard</b>, PayPal, bank transfer and <b>Pay on Delivery</b> in cash or mobile money.'],
    locator: ['Store Locator', 'Prefer to shop in person? Visit ShopOnlineUg pickup stations and partner stores across Kampala, Entebbe, Mbarara, Gulu and Jinja to collect your orders or return items.'],
    security: ['Security', 'Your security matters to us. All payments are encrypted and processed by PCI-DSS compliant providers. Never share your password or one-time codes with anyone - ShopOnlineUg staff will never ask for them.'],
    app: ['Get the app', 'Download the ShopOnlineUg app free from the App Store and Google Play. Shop faster with flash-deal notifications, track deliveries in real time and check out in seconds with stored cards and mobile money.'],
    how: ['How to shop on ShopOnlineUg', '1. Search or browse categories to find a product.<br>2. Tap <b>Add to Cart</b>.<br>3. Choose your delivery address and payment method.<br>4. Confirm your order and follow it in <b>My Orders</b>. You can pay on delivery in most regions.'],
    express: ['ShopOnlineUg Express', 'Get selected electronics, phones and fashion items delivered the <b>same day</b> in Kampala. Order before <b>1pm</b> for same-day dispatch. Express delivery costs UGX 8,000.'],
    affiliate: ['ShopOnlineUg Affiliate Program', 'Promote ShopOnlineUg products on your blog, site or social channels and earn up to <b>5% commission</b> on every sale you refer. Sign up free and get a unique tracker link plus regular payouts.'],
    consultant: ['Become a sales consultant', 'Earn extra income by sharing ShopOnlineUg deals with your community. Consultants earn commission on orders placed through their personal link and get monthly bonuses for high sales volumes.'],
    logistics: ['Become a logistics service partner', 'We work with couriers, van owners and last-mile agents across Uganda. If you can deliver orders reliably, register with your fleet details and we will onboard you onto our delivery network.'],
    money: ['Mobile Money', 'Pay instantly with <b>MTN Mobile Money</b> or <b>Airtel Money</b>. Choose Mobile Money at checkout, approve the prompt on your phone and your order ships right away.'],
    pod: ['Pay on Delivery', 'Pay in cash or via mobile money when your order reaches your door. Available for orders up to UGX 1,000,000 in most delivery zones.'],
    card: ['Visa &amp; Mastercard', 'Pay securely with any Visa or Mastercard. Card payments are processed over encrypted, PCI-DSS compliant channels and are never stored on our servers.'],
    paypal: ['PayPal', 'Pay with your PayPal balance or a linked card. Select PayPal at checkout and you will be redirected to confirm payment securely.'],
    bank: ['Bank Transfer', 'Transfer directly to our GTBank account and your order is confirmed once payment reflects. Always include your order number as the payment reference.'],
    nigeria: ['ShopOnlineUg Nigeria', 'ShopOnlineUg delivers across Nigeria, including Lagos, Abuja and Port Harcourt, plus nationwide courier coverage. Reach local support on <b>0700-SHOP-NG</b> anytime.'],
    kenya: ['ShopOnlineUg Kenya', 'Our Kenyan store serves Nairobi, Mombasa, Kisumu and all major towns. Pay with M-PESA, cards or on delivery and reach support on <b>0700-700-700</b>.'],
    cote: ['ShopOnlineUg C\u00f4te d\'Ivoire', 'Nous livrons partout en C\u00f4te d\'Ivoire, y compris Abidjan, Bouak\u00e9 et Yamoussoukro. Paiement \u00e0 la livraison et Mobile Money disponibles.'],
    morocco: ['ShopOnlineUg Morocco', 'Livraison dans tout le Maroc avec paiement \u00e0 la livraison et Mobile Money. Support local sur la hotline d\u00e9di\u00e9e.'],
    egypt: ['ShopOnlineUg Egypt', 'ShopOnlineUg delivers across Egypt, from Cairo and Alexandria to Upper Egypt. Pay with Vodafone Cash, cards or cash on delivery.'],
    ghana: ['ShopOnlineUg Ghana', 'Our Ghanaian store serves Accra, Kumasi and nationwide. Pay with MTN Mobile Money, cards or cash on delivery.']
  };
  function infoFor(title) {
    var t = (title || '').toLowerCase();
    var map = { 'pay on delivery': 'pod', 'mobile money': 'money', 'mastercard': 'card', 'visa': 'card', 'paypal': 'paypal', 'bank': 'bank', 'returns': 'returns', 'return': 'returns', 'delivery': 'delivery', 'locator': 'locator', 'help': 'help', 'contact': 'help', 'track': 'track', 'about': 'about', 'career': 'career', 'sell': 'sell', 'prime': 'prime', 'terms': 'term', 'term': 'term', 'privacy': 'privacy', 'cookie': 'cookie', 'security': 'security', 'app': 'app', 'how': 'how', 'express': 'express', 'affiliate': 'affiliate', 'consultant': 'consultant', 'logistics': 'logistics', 'nigeria': 'nigeria', 'kenya': 'kenya', 'ivoire': 'cote', 'morocco': 'morocco', 'egypt': 'egypt', 'ghana': 'ghana', 'pay': 'pay' };
    var keys = ['pay on delivery', 'mobile money', 'mastercard', 'visa', 'paypal', 'bank', 'returns', 'return', 'delivery', 'locator', 'help', 'track', 'about', 'career', 'sell', 'prime', 'terms', 'term', 'privacy', 'cookie', 'security', 'app', 'how', 'express', 'affiliate', 'consultant', 'logistics', 'nigeria', 'kenya', 'ivoire', 'morocco', 'egypt', 'ghana', 'contact', 'pay'];
    for (var i = 0; i < keys.length; i++) {
      if (t.indexOf(keys[i]) !== -1) {
        var ent = INFO[map[keys[i]]];
        return [ent[0], typeof ent[1] === 'function' ? ent[1]() : ent[1]];
      }
    }
    return [title || 'Information', 'We don&apos;t have a dedicated article for this section yet, but you can still explore the full shop below or hop over to the <a href="#/">home page</a>.'];
  }
  function matchProducts(q) {
    var words = (q || '').toLowerCase().split(/[^a-z0-9]+/).filter(function (w) { return w.length > 2; });
    var out = CATALOG.filter(function (p) { return words.some(function (w) { return stripHtml(p.name).toLowerCase().indexOf(w) !== -1; }); });
    if (words.length && !out.length) out = PRODUCTS.top;
    return out.slice(0, 4);
  }
  function renderInfo(title) {
    var info = infoFor(title);
    document.getElementById('infoCrumb').textContent = title || 'Information';
    document.getElementById('infoH').innerHTML = info[0];
    var rel = matchProducts(title);
    var html = '<div class="info-body"><p>' + info[1] + '</p>';
    if (/logistics|rid|deliver/i.test(title || '')) {
      html += '<p class="info-cta"><b>Ready to ride?</b> <a href="#/driver">Open the rider portal</a> to apply as a delivery partner.</p>';
    }
    if (rel.length) html += '<h3 class="info-sub">Related products</h3><div class="info-rel">' + rel.map(card).join('') + '</div>';
    html += '<p class="info-cta">Browse <a href="#/cats">all categories</a> or go back to the <a href="#/">home page</a>.</p></div>';
    document.getElementById('infoBody').innerHTML = html;
  }

  /* ============ generic links ============ */
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href="#"]');
    if (!a) return;
    if (a.closest('#cartLink') || a.id === 'coBackCart') return;
    var route = a.getAttribute('data-route');
    if (route) { e.preventDefault(); location.hash = '#' + route; return; }
    e.preventDefault();
    var label = (a.textContent || '').trim();
    if (!label) { var im = a.querySelector('img'); label = (im && im.getAttribute('alt')) || 'Offer'; }
    location.hash = '#/info/' + encodeURIComponent(label);
  }, true);

  /* ============ router ============ */
  function router() {
    var h = location.hash.replace(/^#\/?/, '').split('?')[0];
    var parts = h.split('/').filter(function (x) { return x !== ''; });
    var page = parts[0] || 'home';
    if (page === 'p') {
      var p = BY_ID[parts[1]];
      if (!p) { showPage('home'); return; }
      currentPdp = p;
      renderPDP(parts[1]);
      pushViewed(parts[1]);
      showPage('pdp');
    } else if (page === 's') { renderSearch(decodeURIComponent(parts.slice(1).join('/'))); showPage('search'); }
    else if (page === 'cats') { renderCats(); showPage('cats'); }
    else if (page === 'r') { renderBrowse(parts[1]); showPage('browse'); }
    else if (page === 'store') { renderStore(parts[1]); showPage('store'); }
    else if (page === 'wish') { renderWishPage(); showPage('wish'); }
    else if (page === 'orders') { renderOrders(); showPage('orders'); }
    else if (page === 'account') { renderAccount(); showPage('account'); }
    else if (page === 'sell') { renderSellPage(); showPage('sell'); }
    else if (page === 'vendor') { renderVendorPage(); showPage('vendor'); }
    else if (page === 'admin') { renderAdminPage(); showPage('admin'); }
    else if (page === 'driver') { renderDriverPage(); showPage('driver'); }
    else if (page === 'mailbox') { showPage('home'); openMailbox(); }
    else if (page === 'checkout') { renderCheckout(); showPage('checkout'); }
    else if (page === 'success') {
      document.getElementById('orderNo').textContent = parts[1] || 'UG000000000';
      var payEl = document.getElementById('successPay');
      var lastOrder = ORDERS[0];
      if (lastOrder && lastOrder.payMethod && lastOrder.payMethod !== 'pod') {
        payEl.hidden = false;
        payEl.textContent = 'Payment of ' + fmt(lastOrder.total) + ' via ' + lastOrder.pay + ' approved. Your payment status is ' + lastOrder.payStatus + '.';
      } else {
        payEl.hidden = true;
      }
      showPage('success');
    } else if (page === 'info') { renderInfo(decodeURIComponent(parts.slice(1).join('/'))); showPage('info'); }
    else { showPage('home'); }
  }
  window.addEventListener('hashchange', router);
  setInterval(function () {
    if (!document.getElementById('ordersPage').hidden) renderOrders();
  }, 5000);

  /* ============ back to top / cookie ============ */
  var toTop = document.getElementById('toTop');
  window.addEventListener('scroll', function () {
    toTop.classList.toggle('show', window.scrollY > 420);
  }, { passive: true });
  toTop.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });

  (function () {
    var b = document.getElementById('cookieBanner');
    var ok = document.getElementById('cookieOk');
    if (!b || !ok) return;
    try { if (localStorage.getItem('sou_cookie') === '1') b.classList.add('hidden'); } catch (e) {}
    ok.addEventListener('click', function () {
      try { localStorage.setItem('sou_cookie', '1'); } catch (e) {}
      b.classList.add('hidden');
    });
  })();

  /* ============ demo data ============ */
  function demoOrder(no, ts, items, total, info) {
    return {
      no: no, ts: ts, items: items, total: total, name: info.name, phone: info.phone,
      region: info.region, town: info.town, addr: info.addr, pay: info.pay,
      payMethod: info.payMethod || 'pod', payStatus: info.payStatus || 'Pending'
    };
  }
  function seedDemo(force) {
    try { if (!force && localStorage.getItem('sou_seeded') === '1') return; } catch (e) {}
    var now = Date.now();
    var info = { name: 'Demo Shopper', phone: '+256 772 123 456', region: 'Central', town: 'Kampala', addr: 'Plot 12, Kampala Road' };
    if (!wish.length) { wish = ['flash-1', 'super-3', 'toy-2', 'beauty-1']; saveWish(); }
    if (!VIEWED.length) { VIEWED = ['flash-0', 'phones-1', 'tv-2', 'fashion-1', 'beauty-0']; save('sou_viewed', VIEWED); }
    if (!cart.length) { cart = [{ id: 'phones-1', qty: 1 }, { id: 'super-0', qty: 2 }]; saveCart(); }
    if (!Object.keys(REVS).length) {
      REVS['flash-0'] = [{ n: 'Aisha M.', r: 5, t: 'Battery lasts all day and it arrived the next morning. Very happy!', d: 'Yesterday' }];
      REVS['phones-1'] = [{ n: 'Peter O.', r: 4, t: 'Great value for money. Camera is sharp in daylight.', d: '3 days ago' }];
      saveRevs();
    }
    if (!ORDERS.length) {
      ORDERS = [
        demoOrder('UG482910375', now - 25000, [{ id: 'phones-0', qty: 1 }], BY_ID['phones-0'].price,
          { name: info.name, phone: info.phone, region: info.region, town: info.town, addr: info.addr, pay: 'MTN Mobile Money', payMethod: 'mtn', payStatus: 'Paid' }),
        demoOrder('UG193847562', now - 3 * 86400000, [{ id: 'flash-2', qty: 1 }, { id: 'super-1', qty: 2 }],
          BY_ID['flash-2'].price + BY_ID['super-1'].price * 2,
          { name: info.name, phone: info.phone, region: info.region, town: info.town, addr: info.addr, pay: 'Pay on Delivery', payMethod: 'pod', payStatus: 'Pending' })
      ];
      saveOrders();
    }
    if (!load('sou_follow', []).length) save('sou_follow', ['ShopOnlineUg Tech Store']);
    try { localStorage.setItem('sou_seeded', '1'); } catch (e) {}
  }
  function resetDemo() {
    ['sou_cart', 'sou_wish', 'sou_reviews', 'sou_orders', 'sou_viewed', 'sou_user', 'sou_follow', 'sou_seeded'].forEach(function (k) {
      try { localStorage.removeItem(k); } catch (e) {}
    });
    location.reload();
  }

  /* ============ vendor catalog (approved marketplace products) ============ */
  var VENDOR_IDS = [];
  function loadVendorCatalog() {
    return api('/products').then(function (d) {
      VENDOR_IDS.forEach(function (id) { delete BY_ID[id]; });
      var keep = CATALOG.filter(function (p) { return p.key !== 'vendor'; });
      CATALOG.length = 0;
      Array.prototype.push.apply(CATALOG, keep);
      VENDOR_IDS = [];
      PRODUCTS.vendor = (d.products || []).map(function (vp) {
        var entry = {
          id: vp.id, key: 'vendor', serverId: vp.id, brand: brandFor(vp.name),
          img: vp.img || 'prod-home', name: vp.name, price: vp.price,
          old: vp.old && vp.old > vp.price ? vp.old : vp.price,
          rate: vp.rate || 4.5, sold: vp.sold || 0, loc: vp.loc || 'Kampala',
          seller: vp.seller || 'Marketplace Seller', desc: vp.description || ''
        };
        CATALOG.push(entry); BY_ID[entry.id] = entry; VENDOR_IDS.push(entry.id);
        return entry;
      });
      var sec = document.getElementById('vendorSec');
      var grid = document.getElementById('gridVendor');
      if (sec && grid) { grid.innerHTML = PRODUCTS.vendor.map(card).join(''); sec.hidden = PRODUCTS.vendor.length === 0; }
      updateWishCount();
    }).catch(function () {});
  }

  /* ============ sell page ============ */
  var IMG_KEYS = ['prod-phone', 'prod-tv', 'prod-laptop', 'prod-watch', 'prod-audio', 'prod-fashion', 'prod-shoe', 'prod-beauty', 'prod-home', 'prod-grocery', 'prod-toy', 'prod-baby'];
  var VENDOR_CATEGORIES = [
    { v: 'flash', l: 'Flash Sales' }, { v: 'top', l: 'Top Selling' }, { v: 'super', l: 'Supermarket' },
    { v: 'phones', l: 'Smartphones' }, { v: 'tv', l: 'TV & Electronics' }, { v: 'fashion', l: 'Fashion & Shoes' },
    { v: 'beauty', l: 'Health & Beauty' }, { v: 'toys', l: 'Toys & Kids' }, { v: 'other', l: 'Other' }
  ];
  function stat(n, l) { return '<div class="v-stat"><b>' + esc(String(n)) + '</b><span>' + esc(l) + '</span></div>'; }
  function sellHero() {
    return '<div class="portal-hero"><h1>Sell to millions on ShopOnlineUg</h1>' +
      '<p>Join Uganda\'s fastest growing marketplace. Open your store for free, list your products and get paid on delivery. Every store and every product is reviewed by our team before it goes live.</p>' +
      '<div class="ph-actions"><a class="btn _prim" href="#/vendor">Vendor dashboard</a><a class="btn _line" href="#/r/vendor">Browse vendors</a></div></div>' +
      '<div class="steps"><div class="step"><b><i>1</i>Apply</b><span>Tell us about your business and what you sell.</span></div>' +
      '<div class="step"><b><i>2</i>Confirm</b><span>Enter the 6-digit code emailed to you. It expires in 10 minutes.</span></div>' +
      '<div class="step"><b><i>3</i>Get approved</b><span>An admin reviews your store, then your listings go live.</span></div>' +
      '<div class="step"><b><i>4</i>Grow</b><span>Track orders and add products from your dashboard.</span></div></div>';
  }
  function sellSideHtml() {
    return '<div class="card"><h3>Why sell with us?</h3>' +
      '<p class="card-sub">No monthly fees, nationwide delivery partners and pay-on-delivery protection for buyers.</p>' +
      '<div class="acct-quick">' +
      '<a href="#/vendor"><b>Vendor dashboard</b><span>Manage listings and orders in real time.</span></a>' +
      '<a href="#/mailbox"><b>Local mailbox</b><span>Every confirmation email is also shown here.</span></a>' +
      '</div></div>';
  }
  function fieldHtml(label, id, type, ph, val, req) {
    return '<div class="field"><label for="' + id + '">' + label + '</label><input id="' + id + '" type="' + (type || 'text') +
      '" placeholder="' + ph + '"' + (val ? ' value="' + esc(val) + '"' : '') + (req ? ' required' : '') + '></div>';
  }
  function vendorFormHtml(authed) {
    var catOpts = VENDOR_CATEGORIES.map(function (c) { return '<option value="' + c.v + '">' + c.l + '</option>'; }).join('');
    return '<form id="sellForm" novalidate>' +
      (authed ? '' : fieldHtml('Your full name', 'vfOwner', 'text', 'e.g. Amina Nakato', '', true)) +
      fieldHtml('Store name', 'vfStore', 'text', 'e.g. Kampala Gadgets Hub', '', true) +
      '<div class="field _row">' +
        '<div><label for="vfEmail">Business email</label><input id="vfEmail" type="email" placeholder="you@business.ug"' + (authed ? ' value="' + esc(SERVER_USER.email) + '" readonly' : '') + '></div>' +
        '<div><label for="vfPhone">Phone number</label><input id="vfPhone" type="tel" placeholder="+256 7XX XXX XXX"></div>' +
      '</div>' +
      '<div class="field _row">' +
        '<div><label for="vfLoc">Location</label><input id="vfLoc" type="text" placeholder="e.g. Kampala"></div>' +
        '<div><label for="vfCat">Main category</label><select id="vfCat">' + catOpts + '</select></div>' +
      '</div>' +
      '<div class="field"><label for="vfDesc">What will you sell?</label><textarea id="vfDesc" placeholder="Tell buyers about your store and the products you plan to list"></textarea></div>' +
      (authed ? '' : '<div class="field"><label for="vfPass">Password</label><input id="vfPass" type="password" placeholder="Create a password (min 6 characters)"></div>') +
      '<button class="btn _prim acct-submit" type="submit">' + (authed ? 'SUBMIT APPLICATION' : 'APPLY &amp; CONFIRM EMAIL') + '</button>' +
      '<p class="acct-foot">By applying you agree to our seller terms and marketplace policies.</p>' +
      '</form>';
  }
  function renderSellPage() {
    var body = document.getElementById('sellBody');
    if (SERVER_USER && SERVER_USER.role === 'vendor') {
      var nm = (SERVER_USER.vendor && SERVER_USER.vendor.storeName) || SERVER_USER.name;
      body.innerHTML = '<div class="portal-hero"><h1>' + esc(nm) + '</h1>' +
        '<p>You already have a seller account. Head to your dashboard to manage products and orders.</p>' +
        '<div class="ph-actions"><a class="btn _prim" href="#/vendor">Open vendor dashboard</a></div></div>';
      return;
    }
    if (SERVER_USER) {
      body.innerHTML = sellHero() +
        '<div class="pgrid _2"><div class="card"><h3>Open your store</h3>' +
        '<p class="card-sub">Applying as <b>' + esc(SERVER_USER.name) + '</b> (' + esc(SERVER_USER.email) + '). Your email is already verified.</p>' +
        vendorFormHtml(true) + '</div>' + sellSideHtml() + '</div>';
      return;
    }
    body.innerHTML = sellHero() +
      '<div class="pgrid _2"><div class="card"><h3>Seller application</h3>' +
      '<p class="card-sub">Fill in your details and we will email a 6-digit code to confirm your business email.</p>' +
      vendorFormHtml(false) + '</div>' + sellSideHtml() + '</div>';
  }
  function submitSellForm() {
    if (SERVER_USER) {
      api('/vendors/apply-authed', {
        method: 'POST', body: {
          storeName: document.getElementById('vfStore').value.trim(),
          phone: document.getElementById('vfPhone').value.trim(),
          location: document.getElementById('vfLoc').value.trim(),
          category: document.getElementById('vfCat').value,
          description: document.getElementById('vfDesc').value.trim()
        }
      }).then(function (d) {
        SERVER_USER.vendor = d.vendor;
        if (d.user) { SERVER_USER.role = d.user.role; if (USER) { USER.role = d.user.role; save('sou_user', USER); } }
        updateHeaderAccount();
        showToast('Application submitted for review');
        location.hash = '#/vendor';
      }).catch(function (err) { showToast(apiFail(err, 'Application')); });
      return;
    }
    api('/vendors/apply', {
      method: 'POST', body: {
        ownerName: document.getElementById('vfOwner').value.trim(),
        storeName: document.getElementById('vfStore').value.trim(),
        email: document.getElementById('vfEmail').value.trim(),
        phone: document.getElementById('vfPhone').value.trim(),
        location: document.getElementById('vfLoc').value.trim(),
        category: document.getElementById('vfCat').value,
        description: document.getElementById('vfDesc').value.trim(),
        password: document.getElementById('vfPass').value
      }
    }).then(function (d) {
      pendingKind = 'vendor'; pendingEmail = d.email;
      loadMailbox();
      openAcct('verify');
      acctMsg('We emailed a 6-digit code to ' + d.email + '. Enter it to confirm your store. It expires in 10 minutes.', 'ok');
      showToast('Check your email for the confirmation code');
    }).catch(function (err) { showToast(apiFail(err, 'Application')); });
  }

  /* ============ vendor portal ============ */
  var VENDOR_DATA = null, editingId = null;
  var VENDOR = { tab: 'overview', pFilt: 'all', pQ: '', oFilt: 'all' };
  function renderVendorPage() {
    var body = document.getElementById('vendorBody');
    if (!SERVER_USER) {
      body.innerHTML = '<div class="portal-hero"><h1>Vendor portal</h1><p>Sign in or apply to open your store on ShopOnlineUg.</p>' +
        '<div class="ph-actions"><a class="btn _prim" href="#/sell">Become a vendor</a><button class="btn _line" type="button" id="vendorSignIn">Sign in</button></div></div>';
      return;
    }
    if (SERVER_USER.role !== 'vendor') {
      body.innerHTML = '<div class="portal-hero"><h1>Sell on ShopOnlineUg</h1><p>You are signed in as ' + esc(SERVER_USER.name) +
        '. Open a store to start listing products.</p><div class="ph-actions"><a class="btn _prim" href="#/sell">Apply as a vendor</a></div></div>';
      return;
    }
    body.innerHTML = '<div id="vendorBody2"><div class="empty-note">Loading your dashboard&hellip;</div></div>';
    Promise.all([api('/vendors/me'), api('/vendors/products'), api('/vendors/orders'),
      api('/vendors/notifications').catch(function () { return { notifications: [], unread: 0 }; })]).then(function (r) {
      VENDOR_DATA = { me: r[0], products: r[1].products || [], orders: r[2].orders || [], notes: r[3].notifications || [], unread: r[3].unread || 0 };
      SERVER_USER.vendor = r[0].vendor;
      renderVendorDash();
    }).catch(function (e) {
      document.getElementById('vendorBody2').innerHTML = '<div class="pending-note">' + esc(apiFail(e, 'Vendor portal')) + '</div>';
    });
  }
  function vendorWarn(v) {
    if (v.status === 'pending') return '<div class="pending-note">Your store is <b>awaiting admin approval</b>. You can prepare listings now, but they will only go live once an admin approves your store.</div>';
    if (v.status === 'rejected') return '<div class="pending-note">Your application was not approved. ' + esc(v.rejectionReason || 'Contact support for details.') + '</div>';
    if (v.status === 'suspended') return '<div class="pending-note">Your store is currently suspended. Email support@shoponline.ug.</div>';
    return '';
  }
  function vendorCanAdd(v) { return v.status === 'approved'; }
  function vendorNotesHtml() {
    if (!VENDOR_DATA || !VENDOR_DATA.unread) return '';
    var list = (VENDOR_DATA.notes || []).slice(0, 5);
    return '<div class="card drv-note"><div class="mail-h"><div><h3>Messages from ShopOnlineUg</h3>' +
      '<p class="mail-sub">' + VENDOR_DATA.unread + ' unread message(s) from the admin team</p></div>' +
      '<button type="button" class="linkish" id="vendorMarkRead">Mark all read</button></div>' +
      '<div class="mail-list">' + list.map(function (n) {
        return '<div class="mail-item' + (n.status === 'unread' ? ' _new' : '') + '">' +
          '<div class="mail-from">' + esc(n.subject || n.title || 'Message') + '</div>' +
          '<div class="mail-subject">' + esc(n.body || '') + '</div>' +
          '<div class="mail-meta">' + esc(new Date(n.createdAt).toLocaleString('en-GB')) + '</div></div>';
      }).join('') + '</div></div>';
  }
  function renderVendorDash() {
    if (!VENDOR_DATA) return;
    var v = VENDOR_DATA.me.vendor, c = VENDOR_DATA.me.counts, m = VENDOR_DATA.me;
    document.getElementById('vendorBody2').innerHTML =
      '<div class="portal-hero"><h1>' + esc(v.storeName) + ' <span class="pbadge _' + esc(v.status) + '">' + esc(v.status) + '</span></h1>' +
      '<p>' + esc(v.description || 'Manage your listings, orders and store profile.') + '</p>' +
      '<div class="ph-actions"><a class="btn _prim" href="#/store/' + esc(storeSlug(v.storeName)) + '">View public store</a>' +
      '<button class="btn _line" type="button" data-vtab="profile">Store settings</button></div></div>' +
      vendorWarn(v) +
      vendorNotesHtml() +
      '<div class="v-stats">' +
      stat(money0(m.net), 'Net revenue') + stat(money0(m.available), 'Available') +
      stat(m.ordersCount, 'Orders') + stat(m.unitsSold, 'Units sold') +
      stat(c.approved, 'Live products') + stat(c.pending, 'Pending review') + stat(c.rejected, 'Rejected') + stat(m.lowStock, 'Low stock') +
      '</div>' +
      '<div class="ptabs">' +
      [['overview', 'Overview'], ['products', 'Products'], ['orders', 'Orders'], ['profile', 'Store profile'], ['payouts', 'Payouts']].map(function (t) {
        return '<button data-vtab="' + t[0] + '" class="' + (VENDOR.tab === t[0] ? 'on' : '') + '">' + t[1] + '</button>';
      }).join('') +
      '</div><div id="vendorPanel"></div>';
    renderVendorTab();
    if (editingId) fillProductForm();
  }
  function renderVendorTab() {
    $$('#vendorBody2 .ptabs button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-vtab') === VENDOR.tab); });
    var fn = { overview: vendorOverview, products: vendorProducts, orders: vendorOrders, profile: vendorProfile, payouts: vendorPayouts }[VENDOR.tab];
    var panel = document.getElementById('vendorPanel');
    if (panel) panel.innerHTML = fn ? fn() : '';
    if (VENDOR.tab === 'products' && editingId) fillProductForm();
  }
  function vendorActivityTable(list) {
    if (!list || !list.length) return '<div class="empty-note">No recent activity yet. Actions you take appear here.</div>';
    return '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>When</th><th>Activity</th><th>Details</th></tr></thead><tbody>' +
      list.map(function (a) {
        return '<tr><td class="num">' + esc(new Date(a.at).toLocaleString('en-GB')) + '</td><td>' + esc(a.type) + '</td><td>' + esc(a.detail || '') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  function vendorOverview() {
    var v = VENDOR_DATA.me.vendor, c = VENDOR_DATA.me.counts, m = VENDOR_DATA.me;
    var low = '';
    if (m.lowStock) low = '<div class="pending-note _info">' + m.lowStock + ' product(s) are low on stock (5 or fewer left). Restock to keep your listings selling.</div>';
    return '<div class="card" style="margin-bottom:18px"><h3>Store at a glance</h3>' +
      '<p class="card-sub">' + esc(v.storeName) + ' &middot; ' + esc(v.location || '') + ' &middot; ' + c.approved + ' live product(s) &middot; ' + m.ordersCount + ' order(s) worth UGX ' + money0(m.revenue) + '.</p>' +
      '<div class="row-actions">' +
      '<button class="btn _prim" type="button" data-vtab="products">Manage products</button>' +
      '<button class="btn _ghost" type="button" data-vtab="orders">Fulfil orders</button>' +
      '<button class="btn _ghost" type="button" data-vtab="payouts">Payouts</button>' +
      '<a class="btn _line" href="#/store/' + esc(storeSlug(v.storeName)) + '">View storefront</a>' +
      '</div></div>' + low +
      '<div class="card"><h3>Recent activity</h3>' + vendorActivityTable(m.activity) + '</div>';
  }
  function vfiltBtn(val, label) {
    return '<button class="btn _sm ' + (VENDOR.pFilt === val ? '_prim' : '_ghost') + '" type="button" data-vpf="' + val + '">' + label + '</button>';
  }
  function vendorProducts() {
    var v = VENDOR_DATA.me.vendor;
    var canAdd = vendorCanAdd(v);
    var q = VENDOR.pQ.toLowerCase();
    var list = VENDOR_DATA.products.filter(function (p) {
      if (VENDOR.pFilt !== 'all' && p.status !== VENDOR.pFilt) return false;
      if (q && (p.name || '').toLowerCase().indexOf(q) === -1 && (p.category || '').toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
    var head = '<div class="row-actions" style="margin-bottom:12px">' +
      '<input id="vpQ" type="search" placeholder="Search your products" value="' + esc(VENDOR.pQ) + '" style="flex:1;min-width:170px;border:1px solid var(--line);border-radius:8px;padding:8px 10px">' +
      '<button class="btn _sm _prim" type="button" data-vps="1">Search</button>' +
      vfiltBtn('all', 'All') + vfiltBtn('approved', 'Approved') + vfiltBtn('pending', 'Pending') + vfiltBtn('rejected', 'Rejected') +
      '<button class="btn _sm _ok" type="button" data-vnew="1">+ New product</button></div>';
    return head +
      '<div class="card" style="margin-bottom:18px"><h3>' + (editingId ? 'Edit product' : 'Add a product') + '</h3>' +
      '<p class="card-sub">New and edited products are reviewed by our team before going live.</p>' + vendorProductForm(canAdd, v) + '</div>' +
      '<div class="card"><h3>Your listings (' + list.length + ')</h3>' + vendorProductsTable(list) + '</div>';
  }
  function vendorProductForm(canAdd, v) {
    var catOpts = VENDOR_CATEGORIES.map(function (c) { return '<option value="' + c.v + '">' + c.l + '</option>'; }).join('');
    var imgOpts = IMG_KEYS.map(function (k) { return '<option value="' + k + '">' + k.replace('prod-', '') + '</option>'; }).join('');
    return '<form id="vProductForm" novalidate>' +
      fieldHtml('Product name', 'vpName', 'text', 'e.g. Tecno Spark 20 Pro', '', true) +
      '<div class="field _row"><div><label for="vpPrice">Price (UGX)</label><input id="vpPrice" type="number" min="1" placeholder="0"></div>' +
      '<div><label for="vpOld">Compare-at price (optional)</label><input id="vpOld" type="number" min="0" placeholder="0"></div></div>' +
      '<div class="field _row"><div><label for="vpStock">Stock</label><input id="vpStock" type="number" min="0" placeholder="0"></div>' +
      '<div><label for="vpCat">Category</label><select id="vpCat">' + catOpts + '</select></div></div>' +
      '<div class="field _row"><div><label for="vpImg">Image</label><select id="vpImg">' + imgOpts + '</select></div>' +
      '<div><label for="vpLoc">Location</label><input id="vpLoc" type="text" value="' + esc(v.location || 'Kampala') + '"></div></div>' +
      '<div class="field"><label for="vpDesc">Description</label><textarea id="vpDesc" placeholder="Describe your product, warranty and delivery"></textarea></div>' +
      '<div class="row-actions"><button class="btn _prim" type="submit"' + (canAdd ? '' : ' disabled') + '>' + (editingId ? 'SAVE CHANGES' : 'SUBMIT FOR REVIEW') + '</button>' +
      (editingId ? '<button class="btn _ghost" type="button" id="vpCancel">Cancel edit</button>' : '') + '</div>' +
      (canAdd ? '' : '<p class="acct-foot">Product submissions unlock once an admin approves your store.</p>') +
      '</form>';
  }
  function vendorProductsTable(list) {
    if (!list.length) return '<div class="empty-note">No products match this view. Add your first listing above.</div>';
    return '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Product</th><th>Price</th><th>Stock</th><th>Status</th><th></th></tr></thead><tbody>' +
      list.map(function (p) {
        var low = p.stock != null && p.stock <= 5;
        var stk = '<span class="pbadge _' + (low ? 'low' : 'ok') + '">' + (p.stock != null ? p.stock : 0) + '</span>' + (low ? ' <b>low</b>' : '') + (p.sold ? '<div class="mi-meta">' + p.sold + ' sold</div>' : '');
        return '<tr><td><div class="cell-prod">' + imgTag(p.img, '', 'prod-thumb', true, p.id) + '<span><b>' + esc(p.name) + '</b><span>' + esc(p.category || 'other') + ' &middot; ' + esc(p.loc || '') + '</span></span></div></td>' +
          '<td class="num">' + fmt(p.price) + '</td>' +
          '<td>' + stk + '</td>' +
          '<td><span class="pbadge _' + esc(p.status) + '">' + esc(p.status) + '</span>' + (p.rejectionReason ? '<div class="mi-meta">' + esc(p.rejectionReason) + '</div>' : '') + '</td>' +
          '<td><div class="row-actions"><button class="btn _sm _ghost" type="button" data-v-edit="' + esc(p.id) + '">Edit</button>' +
          '<button class="btn _sm _ghost" type="button" data-vdupl="' + esc(p.id) + '">Duplicate</button>' +
          '<button class="btn _sm _danger" type="button" data-v-del="' + esc(p.id) + '">Delete</button></div></td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  function ofiltBtn(val, label) {
    return '<button class="btn _sm ' + (VENDOR.oFilt === val ? '_prim' : '_ghost') + '" type="button" data-vof="' + val + '">' + label + '</button>';
  }
  function orderActions(o) {
    var id = esc(o.id);
    if (o.status === 'Pending') return '<div class="row-actions"><button class="btn _sm _prim" type="button" data-vst="Packed" data-id="' + id + '">Pack</button><button class="btn _sm _danger" type="button" data-vst="Cancelled" data-id="' + id + '">Cancel</button></div>';
    if (o.status === 'Packed') return '<div class="row-actions"><button class="btn _sm _prim" type="button" data-vst="Shipped" data-id="' + id + '">Ship</button><button class="btn _sm _danger" type="button" data-vst="Cancelled" data-id="' + id + '">Cancel</button></div>';
    if (o.status === 'Shipped') return '<div class="row-actions"><button class="btn _sm _ok" type="button" data-vst="Delivered" data-id="' + id + '">Mark delivered</button></div>';
    return '';
  }
  function vendorOrders() {
    var vid = VENDOR_DATA.me.vendor.id;
    var list = VENDOR_DATA.orders.filter(function (o) { return VENDOR.oFilt === 'all' || o.status === VENDOR.oFilt; });
    var head = '<div class="row-actions" style="margin-bottom:12px">' +
      ofiltBtn('all', 'All') + ofiltBtn('Pending', 'Pending') + ofiltBtn('Packed', 'Packed') + ofiltBtn('Shipped', 'Shipped') + ofiltBtn('Delivered', 'Delivered') + ofiltBtn('Cancelled', 'Cancelled') +
      '</div>';
    if (!list.length) return head + '<div class="empty-note">No orders in this view. Orders that include your products appear here.</div>';
    return head + '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Order</th><th>Your items</th><th>Your total</th><th>Customer</th><th>Status</th><th></th></tr></thead><tbody>' +
      list.map(function (o) {
        var mine = (o.items || []).filter(function (it) { return it.vendorId === vid; });
        var sub = mine.reduce(function (n, it) { return n + (it.price || 0) * (it.qty || 1); }, 0);
        return '<tr><td class="num">#' + esc(o.orderNo || o.id) + '<div class="mi-meta">' + esc(o.createdAt ? new Date(o.createdAt).toLocaleDateString('en-GB') : '') + '</div></td>' +
          '<td>' + mine.map(function (it) { return esc(it.name || 'Item') + ' &times;' + (it.qty || 1); }).join('<br>') + '</td>' +
          '<td class="num">' + fmt(sub) + '</td>' +
          '<td>' + esc(o.name || 'Customer') + '<div class="mi-meta">' + esc(o.phone || '') + '</div></td>' +
          '<td><span class="pbadge _approved">' + esc(o.status || 'Pending') + '</span></td>' +
          '<td>' + orderActions(o) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  function vendorProfile() {
    var v = VENDOR_DATA.me.vendor;
    var catOpts = VENDOR_CATEGORIES.map(function (c) { return '<option value="' + c.v + '"' + (v.category === c.v ? ' selected' : '') + '>' + c.l + '</option>'; }).join('');
    return '<div class="pgrid _2">' +
      '<div class="card"><h3>Store settings</h3><p class="card-sub">Keep your public store profile accurate so buyers know what to expect.</p>' +
      '<form id="vProfileForm" novalidate>' +
      fieldHtml('Store name', 'vprName', 'text', 'e.g. Demo Electronics', v.storeName, true) +
      '<div class="field _row"><div><label for="vprCat">Main category</label><select id="vprCat">' + catOpts + '</select></div>' +
      '<div><label for="vprPhone">Phone number</label><input id="vprPhone" type="tel" value="' + esc(v.phone || '') + '" required></div></div>' +
      '<div class="field _row"><div><label for="vprLoc">Location</label><input id="vprLoc" type="text" value="' + esc(v.location || '') + '" required></div>' +
      '<div><label for="vprTax">Tax ID (TIN)</label><input id="vprTax" type="text" value="' + esc(v.taxId || '') + '"></div></div>' +
      '<div class="field"><label for="vprWeb">Website</label><input id="vprWeb" type="url" placeholder="https://" value="' + esc(v.website || '') + '"></div>' +
      '<div class="field"><label for="vprDesc">Store description</label><textarea id="vprDesc">' + esc(v.description || '') + '</textarea></div>' +
      '<button class="btn _prim acct-submit" type="submit">SAVE CHANGES</button>' +
      '</form></div>' +
      '<div class="card"><h3>Account details</h3>' +
      '<div class="acct-line"><span>Owner</span><b>' + esc(v.ownerName || '') + '</b></div>' +
      '<div class="acct-line"><span>Email</span><b>' + esc(v.email || '') + '</b></div>' +
      '<div class="acct-line"><span>Store status</span><b><span class="pbadge _' + esc(v.status) + '">' + esc(v.status) + '</span></b></div>' +
      '<div class="acct-line"><span>Applied</span><b>' + esc(v.createdAt ? new Date(v.createdAt).toLocaleDateString('en-GB') : '') + '</b></div>' +
      '<div class="acct-line"><span>Reviewed</span><b>' + esc(v.reviewedAt ? new Date(v.reviewedAt).toLocaleDateString('en-GB') : 'Not yet') + '</b></div>' +
      '<p class="acct-foot"><a href="#/store/' + esc(storeSlug(v.storeName)) + '">View your public storefront</a></p></div>' +
      '</div>';
  }
  function vendorPayouts() {
    var m = VENDOR_DATA.me;
    if (!vendorCanAdd(VENDOR_DATA.me.vendor)) {
      return '<div class="pending-note">Payouts unlock once your store is approved by an admin.</div>';
    }
    var rows = (m.payouts || []).map(function (p) {
      return '<tr><td class="num">' + esc(p.id) + '</td><td>' + esc(new Date(p.createdAt).toLocaleDateString('en-GB')) + '</td>' +
        '<td class="num">' + fmt(p.amount) + '</td>' +
        '<td><span class="pbadge ' + (p.status === 'paid' ? '_approved' : '_pending') + '">' + esc(p.status || 'processing') + '</span></td></tr>';
    }).join('');
    var table = rows ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Reference</th><th>Requested</th><th>Amount</th><th>Status</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<div class="empty-note">No payouts yet. Request one when you have a balance.</div>';
    return '<div class="pgrid _3" style="margin-bottom:18px">' +
      '<div class="card"><h3>Available balance</h3><div class="v-bal">UGX ' + money0(m.available) + '</div>' +
      '<p class="card-sub">Payouts are sent to your registered bank or mobile money account within 2 working days.</p>' +
      '<button class="btn _prim" type="button" data-vpayout="1"' + (m.available > 0 ? '' : ' disabled') + '>Request payout</button></div>' +
      '<div class="card"><h3>Gross revenue</h3><div class="v-bal">UGX ' + money0(m.revenue) + '</div><p class="card-sub">Total value of all orders containing your products.</p></div>' +
      '<div class="card"><h3>Service fee</h3><div class="v-bal _neg">- UGX ' + money0(m.commission) + '</div><p class="card-sub">ShopOnlineUg applies a flat 10% service fee on your sales.</p></div>' +
      '</div>' +
      '<div class="card"><h3>Payout history</h3>' + table + '</div>';
  }
  function fillProductForm() {
    var p = (VENDOR_DATA.products || []).filter(function (x) { return x.id === editingId; })[0];
    if (!p) { editingId = null; return; }
    document.getElementById('vpName').value = p.name;
    document.getElementById('vpPrice').value = p.price;
    document.getElementById('vpOld').value = p.old && p.old > p.price ? p.old : '';
    document.getElementById('vpStock').value = p.stock != null ? p.stock : '';
    document.getElementById('vpCat').value = p.category || 'other';
    document.getElementById('vpImg').value = p.img || 'prod-home';
    document.getElementById('vpLoc').value = p.loc || '';
    document.getElementById('vpDesc').value = p.description || '';
    var f = document.getElementById('vProductForm');
    if (f) f.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function submitVendorProduct() {
    var body = {
      name: document.getElementById('vpName').value.trim(),
      price: document.getElementById('vpPrice').value,
      old: document.getElementById('vpOld').value,
      stock: document.getElementById('vpStock').value,
      category: document.getElementById('vpCat').value,
      img: document.getElementById('vpImg').value,
      loc: document.getElementById('vpLoc').value.trim(),
      description: document.getElementById('vpDesc').value.trim()
    };
    var req = editingId ? api('/vendors/products/' + editingId, { method: 'PUT', body: body }) : api('/vendors/products', { method: 'POST', body: body });
    req.then(function () {
      showToast(editingId ? 'Product updated and sent for review' : 'Product submitted for review');
      editingId = null;
      reloadVendor();
    }).catch(function (err) { showToast(apiFail(err, 'Save product')); });
  }
  function submitVendorProfile() {
    var body = {
      storeName: document.getElementById('vprName').value.trim(),
      category: document.getElementById('vprCat').value,
      phone: document.getElementById('vprPhone').value.trim(),
      location: document.getElementById('vprLoc').value.trim(),
      taxId: document.getElementById('vprTax').value.trim(),
      website: document.getElementById('vprWeb').value.trim(),
      description: document.getElementById('vprDesc').value.trim()
    };
    api('/vendors/me', { method: 'PUT', body: body }).then(function () {
      showToast('Store profile updated');
      reloadVendor();
    }).catch(function (err) { showToast(apiFail(err, 'Save profile')); });
  }
  function duplicateVendorProduct(id) {
    var src = (VENDOR_DATA.products || []).filter(function (x) { return x.id === id; })[0];
    if (!src) return;
    api('/vendors/products', { method: 'POST', body: {
      name: src.name + ' (copy)', price: src.price, old: src.old, stock: src.stock,
      category: src.category, img: src.img, loc: src.loc, description: src.description
    } }).then(function () { showToast('Product duplicated'); reloadVendor(); })
      .catch(function (err) { showToast(apiFail(err, 'Duplicate')); });
  }
  function updateVendorOrderStatus(btn) {
    var status = btn.getAttribute('data-vst');
    if (status === 'Cancelled' && !window.confirm('Cancel this order? The customer will no longer be able to track it.')) return;
    api('/vendors/orders/' + btn.getAttribute('data-id') + '/status', { method: 'PUT', body: { status: status } })
      .then(function () { showToast('Order marked ' + status); reloadVendor(); })
      .catch(function (err) { showToast(apiFail(err, 'Update order')); });
  }
  function requestVendorPayout() {
    api('/vendors/payouts', { method: 'POST', body: {} })
      .then(function () { showToast('Payout requested - processing within 2 working days'); reloadVendor(); })
      .catch(function (err) { showToast(apiFail(err, 'Payout request')); });
  }
  function reloadVendor() {
    Promise.all([api('/vendors/me'), api('/vendors/products'), api('/vendors/orders')]).then(function (r) {
      VENDOR_DATA = { me: r[0], products: r[1].products || [], orders: r[2].orders || [] };
      SERVER_USER.vendor = r[0].vendor;
      renderVendorDash();
      loadVendorCatalog();
    }).catch(function (e) { showToast(apiFail(e, 'Refresh')); });
  }

  /* ============ admin portal ============ */
  var ADMIN = { tab: 'overview', stats: null, logs: [], vendors: [], products: [], users: [], orders: [], payouts: [], drivers: [], deliveries: [], deliveryTx: null, deliveryLoaded: false, vFilt: 'pending', pFilt: 'pending', uRole: '' };
  function renderAdminPage() {
    var body = document.getElementById('adminBody');
    if (!SERVER_USER || SERVER_USER.role !== 'admin') {
      body.innerHTML = '<div class="portal-hero"><h1>Admin portal</h1><p>Restricted area. Sign in with an administrator account to review vendors, products and users.</p>' +
        '<div class="ph-actions"><button class="btn _prim" type="button" id="adminSignIn">Sign in</button></div></div>';
      return;
    }
    body.innerHTML = '<div id="adminTop"><div class="empty-note">Loading admin data&hellip;</div></div>';
    loadAdminAll();
  }
  function loadAdminAll() {
    return Promise.all([api('/admin/stats'), api('/admin/vendors'), api('/admin/products'), api('/admin/users'), api('/admin/orders'), api('/admin/logs'), api('/admin/payouts')])
      .then(function (r) {
        ADMIN.stats = r[0].stats; ADMIN.logs = r[5].logs || r[0].recentLogs || [];
        ADMIN.vendors = r[1].vendors || []; ADMIN.products = r[2].products || [];
        ADMIN.users = r[3].users || []; ADMIN.orders = r[4].orders || [];
        ADMIN.payouts = (r[6] && r[6].payouts) || [];
        renderAdminTop();
      }).catch(function (e) {
        document.getElementById('adminTop').innerHTML = '<div class="pending-note">' + esc(apiFail(e, 'Admin portal')) + '</div>';
      });
  }
  function loadAdminPayouts() {
    return api('/admin/payouts')
      .then(function (d) { ADMIN.payouts = d.payouts || []; if (ADMIN.tab === 'finance') renderAdminTab(); })
      .catch(function () {});
  }
  function loadAdminDelivery() {
    return Promise.all([api('/admin/drivers'), api('/admin/deliveries')])
      .then(function (r) {
        ADMIN.drivers = r[0].drivers || [];
        ADMIN.deliveries = r[1].deliveries || [];
        ADMIN.deliveryTx = r[1].transactions || null;
        ADMIN.deliveryLoaded = true;
        if (ADMIN.tab === 'delivery') renderAdminTab();
      }).catch(function (e) {
        ADMIN.deliveryLoaded = true;
        document.getElementById('adminPanel').innerHTML = '<div class="pending-note">' + esc(apiFail(e, 'Delivery')) + '</div>';
      });
  }
  function renderAdminTop() {
    var s = ADMIN.stats;
    document.getElementById('adminTop').innerHTML =
      '<div class="portal-hero"><h1>Admin control room</h1><p>Approve vendors and products, manage users and monitor marketplace activity.</p></div>' +
      '<div class="v-stats">' + stat(s.users, 'Users') + stat(s.customers, 'Customers') + stat(s.vendors, 'Vendors') +
      stat(s.vendorsPending, 'Vendors pending') + stat(s.products, 'Products') + stat(s.productsPending, 'Products pending') +
      stat(s.orders, 'Orders') + stat(money0(s.revenue), 'Revenue (UGX)') + stat(s.suspended, 'Suspended') + '</div>' +
      '<div class="ptabs">' +
      '<button data-adm="overview" class="' + (ADMIN.tab === 'overview' ? 'on' : '') + '">Overview</button>' +
      '<button data-adm="vendors" class="' + (ADMIN.tab === 'vendors' ? 'on' : '') + '">Vendors</button>' +
      '<button data-adm="products" class="' + (ADMIN.tab === 'products' ? 'on' : '') + '">Products</button>' +
      '<button data-adm="users" class="' + (ADMIN.tab === 'users' ? 'on' : '') + '">Users</button>' +
      '<button data-adm="orders" class="' + (ADMIN.tab === 'orders' ? 'on' : '') + '">Orders</button>' +
      '<button data-adm="delivery" class="' + (ADMIN.tab === 'delivery' ? 'on' : '') + '">Delivery</button>' +
      '<button data-adm="logs" class="' + (ADMIN.tab === 'logs' ? 'on' : '') + '">Activity log</button>' + '<button data-adm="settings" class="' + (ADMIN.tab === 'settings' ? 'on' : '') + '">Settings</button>' +
    '<button data-adm="theme" class="' + (ADMIN.tab === 'theme' ? 'on' : '') + '">Theme</button>' +
    '<button data-adm="finance" class="' + (ADMIN.tab === 'finance' ? 'on' : '') + '">Finance</button>' +
      '</div><div id="adminPanel"></div>';
    renderAdminTab();
  }
  function renderAdminTab() {
    $$('#adminTop .ptabs button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-adm') === ADMIN.tab); });
    var fn = { overview: adminOverview, vendors: adminVendors, products: adminProducts, users: adminUsers, orders: adminOrders, delivery: adminDelivery, logs: adminLogs, settings: adminSettings, theme: adminTheme, finance: adminFinance }[ADMIN.tab];
    document.getElementById('adminPanel').innerHTML = fn ? fn() : '';
  }
  function filterBtns(prefix, attr, current, items) {    return '<div class="row-actions" style="margin-bottom:12px">' + items.map(function (f) {
      return '<button class="btn _sm ' + (f.v === current ? '_prim' : '_ghost') + '" type="button" ' + attr + '="' + f.v + '">' + f.l + '</button>';
    }).join('') + '</div>';
  }
  function adminLogList(logs) {
    if (!logs.length) return '<div class="empty-note">No activity yet.</div>';
    return '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>When</th><th>Type</th><th>By</th><th>Details</th></tr></thead><tbody>' +
      logs.map(function (l) {
        return '<tr><td class="num">' + esc(l.at ? new Date(l.at).toLocaleString('en-GB') : '') + '</td><td>' + esc(l.type) + '</td>' +
          '<td>' + esc(l.by || l.email || 'system') + '</td><td>' + esc(l.storeName || l.productId || l.vendorId || l.email || '') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  function adminOverview() {
    var s = ADMIN.stats;
    return '<div class="card" style="margin-bottom:18px"><h3>Marketplace at a glance</h3><p class="card-sub">' +
      s.vendorsPending + ' vendor application(s) and ' + s.productsPending + ' product(s) are waiting for review.</p>' +
      '<div class="row-actions"><button class="btn _prim" type="button" data-adm="vendors">Review vendors</button>' +
      '<button class="btn _ghost" type="button" data-adm="products">Review products</button></div></div>' +
      '<div class="card"><h3>Recent activity</h3>' + adminLogList(ADMIN.logs.slice(0, 12)) + '</div>';
  }
  function adminVendors() {
    var filt = ADMIN.vFilt;
    var list = ADMIN.vendors.filter(function (v) { return filt === 'all' || v.status === filt; });
    var head = filterBtns('v', 'data-vfilt', filt, [
      { v: 'pending', l: 'Pending' }, { v: 'approved', l: 'Approved' }, { v: 'rejected', l: 'Rejected' },
      { v: 'suspended', l: 'Suspended' }, { v: 'all', l: 'All' }
    ]);
    if (!list.length) return head + '<div class="empty-note">No vendors in this view.</div>';
    return head + '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Store</th><th>Owner</th><th>Products</th><th>Status</th><th></th></tr></thead><tbody>' +
      list.map(function (v) {
        return '<tr><td><b>' + esc(v.storeName) + '</b><div class="mi-meta">' + esc(v.location || '') + ' &middot; ' + esc(v.category || '') + '</div></td>' +
          '<td>' + esc(v.ownerName || '') + '<div class="mi-meta">' +
            (v.email ? '<a href="mailto:' + esc(v.email) + '">' + esc(v.email) + '</a>' : 'no email on file') + '<br>' +
            (v.phone ? '<a href="tel:' + esc(String(v.phone).replace(/[^\d+]/g, '')) + '">' + esc(v.phone) + '</a>' : 'no phone on file') +
          '</div></td>' +
          '<td class="num">' + (v.productCount || 0) + '</td>' +
          '<td><span class="pbadge _' + esc(v.status) + '">' + esc(v.status) + '</span>' + (v.rejectionReason ? '<div class="mi-meta">' + esc(v.rejectionReason) + '</div>' : '') + '</td>' +
          '<td><div class="row-actions">' +
          '<a class="btn _sm _ghost" href="tel:' + esc(String(v.phone || '').replace(/[^\d+]/g, '')) + '"' + (v.phone ? '' : ' aria-disabled="true"') + '>Call</a>' +
          '<a class="btn _sm _ghost" href="mailto:' + esc(v.email || '') + '"' + (v.email ? '' : ' aria-disabled="true"') + '>Email</a>' +
          '<button class="btn _sm _prim" type="button" data-avmsg="' + esc(v.id) + '">Message</button>' +
          '</div><div class="row-actions" style="margin-top:6px"><button class="btn _sm _ok" type="button" data-av="approve" data-id="' + esc(v.id) + '">Approve</button>' +
          '<button class="btn _sm _danger" type="button" data-av="reject" data-id="' + esc(v.id) + '">Reject</button>' +
          '<button class="btn _sm _ghost" type="button" data-av="suspend" data-id="' + esc(v.id) + '">' + (v.status === 'suspended' ? 'Reinstate' : 'Suspend') + '</button></div></td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  function adminProducts() {
    var filt = ADMIN.pFilt;
    var list = ADMIN.products.filter(function (p) { return filt === 'all' || p.status === filt; });
    var head = filterBtns('p', 'data-pfilt', filt, [
      { v: 'pending', l: 'Pending' }, { v: 'approved', l: 'Approved' }, { v: 'rejected', l: 'Rejected' }, { v: 'all', l: 'All' }
    ]);
    if (!list.length) return head + '<div class="empty-note">No products in this view.</div>';
    return head + '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Product</th><th>Vendor</th><th>Price</th><th>Status</th><th></th></tr></thead><tbody>' +
      list.map(function (p) {
        return '<tr><td><div class="cell-prod">' + imgTag(p.img, '', 'prod-thumb', true, p.id) + '<span><b>' + esc(p.name) + '</b><span>' + esc(p.category || 'other') + '</span></span></div></td>' +
          '<td>' + esc(p.storeName || '') + '</td><td class="num">' + fmt(p.price) + '</td>' +
          '<td><span class="pbadge _' + esc(p.status) + '">' + esc(p.status) + '</span>' + (p.rejectionReason ? '<div class="mi-meta">' + esc(p.rejectionReason) + '</div>' : '') + '</td>' +
          '<td><div class="row-actions"><button class="btn _sm _ok" type="button" data-ap="approve" data-id="' + esc(p.id) + '">Approve</button>' +
          '<button class="btn _sm _danger" type="button" data-ap="reject" data-id="' + esc(p.id) + '">Reject</button></div></td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  function adminUsers() {
    var q = (ADMIN.uQ || '').toLowerCase();
    var role = ADMIN.uRole;
    var list = ADMIN.users.filter(function (u) {
      if (role && u.role !== role) return false;
      if (!q) return true;
      return (u.name || '').toLowerCase().indexOf(q) !== -1 || (u.email || '').toLowerCase().indexOf(q) !== -1;
    });
    var head = '<div class="row-actions" style="margin-bottom:12px">' +
      '<input id="admUserQ" class="adm-search" type="search" placeholder="Search name or email" value="' + esc(ADMIN.uQ || '') + '" style="flex:1;min-width:180px;border:1px solid var(--line);border-radius:8px;padding:8px 10px">' +
      '<button class="btn _prim _sm" type="button" data-uq="go">Search</button>' +
      '<button class="btn _sm _ghost" type="button" data-urfilt="">All</button>' +
      '<button class="btn _sm _ghost" type="button" data-urfilt="customer">Customers</button>' +
      '<button class="btn _sm _ghost" type="button" data-urfilt="vendor">Vendors</button>' +
      '<button class="btn _sm _ghost" type="button" data-urfilt="admin">Admins</button></div>';
    if (!list.length) return head + '<div class="empty-note">No users found.</div>';
    return head + '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>User</th><th>Role</th><th>Status</th><th>Joined</th><th></th></tr></thead><tbody>' +
      list.map(function (u) {
        return '<tr><td><b>' + esc(u.name) + '</b><div class="mi-meta">' + esc(u.email) + '<br>' + esc(u.phone || '') + '</div></td>' +
          '<td><span class="pbadge _' + esc(u.role) + '">' + esc(u.role) + '</span></td>' +
          '<td><span class="pbadge _' + esc(u.status || 'active') + '">' + esc(u.status || 'active') + '</span></td>' +
          '<td class="num">' + esc(u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-GB') : '') + '</td>' +
          '<td>' + (u.role === 'admin' ? '<span class="mi-meta">protected</span>' :
            '<button class="btn _sm ' + ((u.status === 'suspended') ? '_ok' : '_danger') + '" type="button" data-au="1" data-id="' + esc(u.id) + '" data-status="' + ((u.status === 'suspended') ? 'active' : 'suspended') + '">' + ((u.status === 'suspended') ? 'Reactivate' : 'Suspend') + '</button>') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  function adminOrders() {
    if (!ADMIN.orders.length) return '<div class="empty-note">No orders yet.</div>';
    return '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th></tr></thead><tbody>' +
      ADMIN.orders.map(function (o) {
        return '<tr><td class="num">#' + esc(o.orderNo || o.id) + '<div class="mi-meta">' + esc(o.createdAt ? new Date(o.createdAt).toLocaleDateString('en-GB') : '') + '</div></td>' +
          '<td>' + esc(o.name || 'Customer') + '</td><td class="num">' + ((o.items || []).length) + '</td>' +
          '<td class="num">' + fmt(o.total || 0) + '</td><td><span class="pbadge _approved">' + esc(o.status || 'Placed') + '</span></td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  function adminDelivery() {
    var tx = ADMIN.deliveryTx;
    var head = '<div class="row-actions" style="margin-bottom:12px">' +
      '<button class="btn _sm _ghost" type="button" id="admDelRef">Refresh</button>' +
      '<span class="mi-meta">Rider applications, live deliveries and transport revenue.</span></div>';
    var stats = tx ? '<div class="v-stats">' +
      stat(ADMIN.drivers.length, 'Riders') +
      stat(ADMIN.drivers.filter(function (d) { return d.status === 'pending'; }).length, 'Riders pending') +
      stat(tx.count, 'Deliveries') + stat(tx.awaitingDriver, 'Waiting for a rider') +
      stat(tx.inTransit, 'In transit') + stat(tx.delivered, 'Delivered') +
      stat(money0(tx.transportRevenue), 'Transport (UGX)') +
      stat(tx.cancelled, 'Cancelled') + '</div>' : '';

    var drivers = ADMIN.drivers.length
      ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Rider</th><th>Vehicle</th><th>Status</th><th>Trips</th><th></th></tr></thead><tbody>' +
        ADMIN.drivers.map(function (d) {
          var acts = ['approved', 'pending', 'rejected', 'suspended'].map(function (s) {
            if (s === d.status) return '';
            var lbl = s === 'approved' ? 'Approve' : s === 'pending' ? 'Reset to pending' : s;
            return '<button class="btn _sm ' + (s === 'approved' ? '_ok' : '_ghost') + '" type="button" data-adrv="' + s + '" data-id="' + esc(d.id) + '">' + lbl + '</button>';
          }).join('');
          return '<tr><td><b>' + esc(d.name) + '</b><div class="mi-meta">' + esc(d.phone) + '<br>' + esc(d.email || '') + '</div>' +
            (d.rejectionReason ? '<div class="mi-meta">' + esc(d.rejectionReason) + '</div>' : '') + '</td>' +
            '<td>' + esc(d.vehicleType) + '<div class="mi-meta">' + esc(d.numberPlate) + '</div></td>' +
            '<td><span class="pbadge _' + esc(d.status === 'approved' ? 'approved' : d.status === 'pending' ? 'pending' : d.status === 'suspended' ? 'suspended' : 'rejected') + '">' + esc(d.status) + '</span>' +
            (d.hasDocuments ? '<div class="mi-meta">documents on file</div>' : '<div class="mi-meta">documents missing</div>') + '</td>' +
            '<td class="num">' + (d.stats ? d.stats.delivered : 0) + ' done<br><span class="mi-meta">' + (d.rating && d.rating.rating ? d.rating.rating.toFixed(1) + ' / 5' : 'no ratings') + '</span>' +
            (d.ratingFlag && d.ratingFlag.flagged ? '<div class="pbadge _rejected" style="margin-top:4px">below floor</div>' : '') + '</td>' +
            '<td><div class="row-actions">' + acts + '</div>' +
            (d.documents && d.documents.license ? '<div class="mi-meta"><a href="' + esc(d.documents.license) + '" target="_blank" rel="noopener">licence</a> &middot; ' : '') +
            (d.documents && d.documents.nationalId ? '<a href="' + esc(d.documents.nationalId) + '" target="_blank" rel="noopener">national ID</a> &middot; ' : '') +
            (d.documents && d.documents.selfie ? '<a href="' + esc(d.documents.selfie) + '" target="_blank" rel="noopener">selfie</a>' : '') + '</div></td></tr>';
        }).join('') + '</tbody></table></div>'
      : '<div class="empty-note">No riders have applied yet. Point customers to the rider portal at #/driver.</div>';

    var nextMap = { approved: 'assigned', assigned: 'picked', picked: 'transit', transit: 'arrived', arrived: 'delivered' };
    var nextLabel = { picked: 'Picked up', transit: 'On the way', arrived: 'Arrived', delivered: 'Delivered' };
    var approvedRiders = ADMIN.drivers.filter(function (x) { return x.status === 'approved'; });
    var dels = ADMIN.deliveries.length
      ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Order</th><th>Drop-off</th><th>Rider</th><th>Status</th><th>Transport</th><th>Actions</th></tr></thead><tbody>' +
        ADMIN.deliveries.map(function (d) {
          var acts = '';
          if (d.status === 'approved' && !d.assignedDriverId) {
            acts = '<div class="row-actions adm-dispatch">' +
              '<select data-adlc-sel="' + esc(d.id) + '"><option value="">Choose rider&hellip;</option>' +
              approvedRiders.map(function (x) {
                var low = x.ratingFlag && x.ratingFlag.flagged ? ' (low rating)' : '';
                return '<option value="' + esc(x.id) + '">' + esc(x.name) + low + '</option>';
              }).join('') + '</select>' +
              '<button class="btn _sm _prim" type="button" data-adlc="assign" data-id="' + esc(d.id) + '">Assign</button></div>';
          } else if (d.status !== 'delivered' && d.status !== 'cancelled') {
            var nxt = nextMap[d.status];
            acts = '<div class="row-actions">' +
              (nxt ? '<button class="btn _sm _prim" type="button" data-adlc="advance" data-status="' + nxt + '" data-id="' + esc(d.id) + '">' + nextLabel[nxt] + '</button>' : '') +
              '<button class="btn _sm _danger" type="button" data-adlc="advance" data-status="cancelled" data-id="' + esc(d.id) + '">Cancel</button></div>';
          } else {
            acts = '<span class="mi-meta">' + (d.status === 'delivered' ? (d.transportPaid ? 'completed' : 'fee pending') : 'closed') + '</span>';
          }
          return '<tr><td class="num">#' + esc(d.orderNo || d.orderId || '') + '<div class="mi-meta">' + esc(d.customerName || '') + '<br>' + esc(d.customerPhone || '') + '</div></td>' +
            '<td>' + esc(d.dropoffAddress || '') + '<div class="mi-meta">' + esc(d.dropoffTown || '') + '</div></td>' +
            '<td>' + (d.driver ? esc(d.driver.name) : '<span class="mi-meta">unassigned</span>') +
            (d.numberPlate ? '<div class="mi-meta">' + esc(d.numberPlate) + ' &middot; ' + esc(d.vehicleType || '') + '</div>' : '') +
            (d.driverRatingFlag && d.driverRatingFlag.flagged ? '<div class="pbadge _rejected" style="margin-top:4px">below floor</div>' : '') + '</td>' +
            '<td><span class="pbadge _' + esc(d.status === 'delivered' ? 'approved' : d.status === 'cancelled' ? 'rejected' : d.status === 'approved' ? 'pending' : 'processing') + '">' + esc(d.statusLabel || d.status) + '</span>' +
            (d.etaAt ? '<div class="mi-meta">ETA ' + esc(new Date(d.etaAt).toLocaleString('en-GB')) + '</div>' : '') + '</td>' +
            '<td class="num">' + fmt(d.transportFee || 0) + '<div class="mi-meta">' + esc(d.transportPaidBy || '') + (d.transportPaid ? ' paid' : '') + '</div></td>' +
            '<td>' + acts + '</td></tr>';
        }).join('') + '</tbody></table></div>'
      : '<div class="empty-note">No deliveries yet. Deliveries are created automatically when an order is approved or packed.</div>';

    return head + stats +
      '<div class="card" style="margin:18px 0"><h3>Riders</h3><p class="card-sub">Approve a rider to let them claim pickup jobs from the rider portal.</p>' + drivers + '</div>' +
      '<div class="card"><h3>Deliveries</h3>' + dels + '</div>';
  }

  function adminSettings() {
    return '<div class="tab-form"><h3>Site settings</h3>' +
      '<p class="card-sub">These values are the live source of truth for the storefront: currency, delivery and theme accent apply immediately for every visitor.</p>' +
      '<div class="field _row"><div><label for="apSiteName">Site name</label><input id="apSiteName" type="text" value="' + esc(CONF.siteName) + '"></div>' +
      '<div><label for="apTagline">Tagline</label><input id="apTagline" type="text" value="' + esc(CONF.tagline) + '"></div></div>' +
      '<div class="field _row"><div><label for="apCur">Currency code</label><input id="apCur" type="text" maxlength="6" value="' + esc(CONF.currencyCode) + '"></div>' +
      '<div><label for="apAcc">Theme accent</label><input id="apAcc" type="color" value="' + esc(CONF.themeAccent) + '"></div></div>' +
      '<div class="field _row"><div><label for="apFee">Delivery fee (UGX)</label><input id="apFee" type="number" min="0" step="1" value="' + (CONF.deliveryFee || 0) + '"></div>' +
      '<div><label for="apFree">Free-delivery threshold (UGX)</label><input id="apFree" type="number" min="0" step="1" value="' + (CONF.freeThreshold || 0) + '"></div></div>' +
      '<div class="row-actions"><button class="btn _prim" type="button" id="apSave">Save settings</button></div></div>';
  }
  function adminTheme() {
    var swatches = [['#2563EB', 'Classic blue'], ['#0EA5E9', 'Sky'], ['#10B981', 'Garden'], ['#F59E0B', 'Amber'], ['#EF4444', 'Coral'], ['#7C3AED', 'Violet'], ['#000000', 'Onyx']];
    return '<div class="tab-form"><h3>Theme accent</h3>' +
      '<p class="card-sub">Pick the brand colour. It applies instantly across the storefront (buttons, active tabs, badges) and is saved for everyone.</p>' +
      '<div class="swatches">' + swatches.map(function (s) {
        return '<button type="button" class="sw' + (String(CONF.themeAccent).toLowerCase() === s[0].toLowerCase() ? ' on' : '') + '" data-ac="' + s[0] + '" title="' + s[1] + '" style="background:' + s[0] + '"><span>' + s[1] + '</span></button>';
      }).join('') + '</div>' +
      '<div class="row-actions"><button class="btn _prim" type="button" id="apThemeSave">Save theme</button></div></div>';
  }
  function adminFinance() {
    var s = ADMIN.stats || {};
    var all = ADMIN.payouts || [];
    var pending = all.filter(function (p) { return p.status !== 'paid'; });
    var paid = all.filter(function (p) { return p.status === 'paid'; });
    var owed = pending.reduce(function (n, p) { return n + (p.amount || 0); }, 0);
    var heads = '<div class="v-stats">' + stat(money0(s.revenue || 0), 'Gross revenue') + stat(money0(Math.round((s.revenue || 0) * 0.85)), 'Net payable') + stat(money0(owed), 'Payouts pending') + stat(String(all.length), 'Payout requests') + '</div>';
    var rows = all.length ? all.map(function (p) {
      return '<tr><td><b>' + esc(p.vendorName || p.vendorId) + '</b><div class="mi-meta">' + (p.paidAt ? 'paid ' + esc(new Date(p.paidAt).toLocaleDateString('en-GB')) : 'requested ' + esc(p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-GB') : '')) + '</div></td>' +
        '<td class="num">' + fmt(p.amount) + '</td>' +
        '<td><span class="pbadge _' + esc(p.status || 'pending') + '">' + esc(p.status || 'pending') + '</span></td>' +
        '<td>' + (p.status === 'paid' ? '<span class="mi-meta">settled</span>' : '<button class="btn _sm _ok" type="button" data-payp="' + esc(p.id) + '">Mark paid</button>') + '</td></tr>';
    }).join('') : '';
    var body = all.length
      ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Vendor</th><th>Amount</th><th>Status</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>'
      : '<div class="empty-note">No payout requests yet. Vendors request payouts from the Vendor hub.</div>';
    var foot = (pending.length ? '<p class="card-sub">' + pending.length + ' payout(s) still waiting.</p>' : '<p class="card-sub">All ' + paid.length + ' payout(s) settled.</p>') +
      '<div class="row-actions"><button class="btn _ghost" type="button" id="apRefrFin">Refresh finance</button></div>';
    return heads + body + foot;
  }
  function saveSiteSettings() {
    var name = ($('#apSiteName') || {}).value, tagline = ($('#apTagline') || {}).value;
    var cur = ($('#apCur') || {}).value, acc = ($('#apAcc') || {}).value;
    var fee = Number(($('#apFee') || {}).value), thr = Number(($('#apFree') || {}).value);
    var body = {
      siteName: (name || '').trim() || CONF.siteName,
      tagline: (tagline || '').trim(),
      currencyCode: ((cur || '').trim() || 'UGX').toUpperCase(),
      themeAccent: acc || CONF.themeAccent,
      deliveryFee: isFinite(fee) && fee >= 0 ? Math.round(fee) : CONF.deliveryFee,
      freeThreshold: isFinite(thr) && thr >= 0 ? Math.round(thr) : CONF.freeThreshold
    };
    api('/admin/settings', { method: 'PUT', body: body })
      .then(function (d) {
        applySettings(d.settings || body);
        renderGrids(); renderCatTiles(); renderDrawer();
        showToast('Settings saved and applied storewide.');
        renderAdminTab();
      })
      .catch(function (e) { showToast(apiFail(e, 'Save settings')); });
  }
  function saveThemeAccent(accent) {
    api('/admin/settings', { method: 'PUT', body: { themeAccent: accent } })
      .then(function (d) {
        applySettings(d.settings || { themeAccent: accent });
        renderGrids(); renderCatTiles(); renderDrawer();
        showToast('Theme accent updated.');
        renderAdminTab();
      })
      .catch(function (e) { showToast(apiFail(e, 'Save theme')); });
  }
  function payOutPayout(id) {
    api('/admin/payouts/' + id + '/pay', { method: 'POST' })
      .then(function () { showToast('Payout marked as paid.'); loadAdminPayouts(); })
      .catch(function (e) { showToast(apiFail(e, 'Payout')); });
  }
  function adminLogs() { return '<div class="card"><h3>Activity log</h3>' + adminLogList(ADMIN.logs) + '</div>'; }
  function adminVendorAction(el) {
    var act = el.getAttribute('data-av'), id = el.getAttribute('data-id'), body = null;
    if (act === 'reject') {
      var reason = window.prompt('Reason for rejection (optional):');
      if (reason === null) return;
      body = { reason: reason };
    }
    api('/admin/vendors/' + id + '/' + act, { method: 'POST', body: body })
      .then(function () { showToast('Vendor ' + act + 'd'); adminRefresh(); })
      .catch(function (e) { showToast(apiFail(e, 'Action')); });
  }
  function adminProductAction(el) {
    var act = el.getAttribute('data-ap'), id = el.getAttribute('data-id'), body = null;
    if (act === 'reject') {
      var reason = window.prompt('Reason for rejection (optional):');
      if (reason === null) return;
      body = { reason: reason };
    }
    api('/admin/products/' + id + '/' + act, { method: 'POST', body: body })
      .then(function () { showToast('Product ' + act + 'd'); adminRefresh(); })
      .catch(function (e) { showToast(apiFail(e, 'Action')); });
  }
  function adminRefresh() { loadAdminAll(); loadVendorCatalog(); }

  /* ============ portal event wiring ============ */
  document.addEventListener('submit', function (e) {
    if (e.target && e.target.id === 'sellForm') { e.preventDefault(); submitSellForm(); }
    else if (e.target && e.target.id === 'vProductForm') { e.preventDefault(); submitVendorProduct(); }
    else if (e.target && e.target.id === 'vProfileForm') { e.preventDefault(); submitVendorProfile(); }
  });
  document.addEventListener('click', function (e) {
    var vtab = e.target.closest('[data-vtab]');
    if (vtab) {
      VENDOR.tab = vtab.getAttribute('data-vtab');
      if (VENDOR.tab !== 'products') editingId = null;
      renderVendorTab();
      return;
    }
    var vpf = e.target.closest('[data-vpf]');
    if (vpf) { VENDOR.pFilt = vpf.getAttribute('data-vpf'); renderVendorTab(); return; }
    if (e.target.closest('[data-vps]')) {
      var vpq = document.getElementById('vpQ');
      VENDOR.pQ = vpq ? vpq.value : '';
      renderVendorTab();
      return;
    }
    var vnew = e.target.closest('[data-vnew]');
    if (vnew) {
      editingId = null;
      VENDOR.tab = 'products';
      renderVendorTab();
      var nf = document.getElementById('vProductForm');
      if (nf) nf.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    var vof = e.target.closest('[data-vof]');
    if (vof) { VENDOR.oFilt = vof.getAttribute('data-vof'); renderVendorTab(); return; }
    var vdu = e.target.closest('[data-vdupl]');
    if (vdu) { duplicateVendorProduct(vdu.getAttribute('data-vdupl')); return; }
    var vst = e.target.closest('[data-vst]');
    if (vst) { updateVendorOrderStatus(vst); return; }
    if (e.target.closest('[data-vpayout]')) { requestVendorPayout(); return; }
    var adm = e.target.closest('[data-adm]');
    if (adm) {
      ADMIN.tab = adm.getAttribute('data-adm');
      if (ADMIN.tab === 'delivery' && !ADMIN.deliveryLoaded) { loadAdminDelivery(); return; }
      renderAdminTab();
      return;
    }
    if (e.target.closest('#admDelRef')) { ADMIN.deliveryLoaded = false; loadAdminDelivery(); return; }
    if (e.target.closest('#apSave')) { saveSiteSettings(); return; }
    if (e.target.closest('#apThemeSave')) { saveThemeAccent(CONF.themeAccent || '#2563EB'); return; }
    if (e.target.closest('#apRefrFin')) { loadAdminPayouts(); showToast('Finance refreshed.'); return; }
    var sw = e.target.closest('.sw[data-ac]');
    if (sw) {
      applySettings({ themeAccent: sw.getAttribute('data-ac') });
      $$('.sw').forEach(function (b) { b.classList.toggle('on', b === sw); });
      return;
    }
    var payp = e.target.closest('[data-payp]');
    if (payp) { payOutPayout(payp.getAttribute('data-payp')); return; }
    var vf = e.target.closest('[data-vfilt]');
    if (vf) { ADMIN.vFilt = vf.getAttribute('data-vfilt'); renderAdminTab(); return; }
    var pf = e.target.closest('[data-pfilt]');
    if (pf) { ADMIN.pFilt = pf.getAttribute('data-pfilt'); renderAdminTab(); return; }
    var urf = e.target.closest('[data-urfilt]');
    if (urf) { ADMIN.uRole = urf.getAttribute('data-urfilt'); renderAdminTab(); return; }
    if (e.target.closest('[data-uq]')) {
      var inp = document.getElementById('admUserQ');
      ADMIN.uQ = inp ? inp.value : '';
      renderAdminTab();
      return;
    }
    var av = e.target.closest('[data-av]');
    if (av) { adminVendorAction(av); return; }
    var avm = e.target.closest('[data-avmsg]');
    if (avm) { openVendorMessage(avm.getAttribute('data-avmsg')); return; }
    var adrv = e.target.closest('[data-adrv]');
    if (adrv) {
      api('/admin/drivers/' + adrv.getAttribute('data-id') + '/status', { method: 'POST', body: { status: adrv.getAttribute('data-adrv') } })
        .then(function () { showToast('Rider status updated'); ADMIN.deliveryLoaded = false; loadAdminDelivery(); })
        .catch(function (err) { showToast(apiFail(err, 'Rider status')); });
      return;
    }
    var adlc = e.target.closest('[data-adlc]');
    if (adlc) {
      var did = adlc.getAttribute('data-id');
      var action = adlc.getAttribute('data-adlc');
      var payload = {};
      if (action === 'assign') {
        var sel = document.querySelector('[data-adlc-sel="' + did + '"]');
        if (!sel || !sel.value) { showToast('Choose a rider first'); return; }
        payload = { status: 'assigned', driverId: sel.value };
      } else {
        payload = { status: adlc.getAttribute('data-status') };
      }
      var send = function (body) {
        return api('/admin/deliveries/' + did + '/status', { method: 'PUT', body: body })
          .then(function () { showToast('Delivery updated'); ADMIN.deliveryLoaded = false; loadAdminDelivery(); })
          .catch(function (err) { showToast(apiFail(err, 'Delivery')); });
      };
      if (payload.status === 'delivered') {
        if (!window.confirm('Mark this delivery as delivered?')) return;
        var dlv = (ADMIN.deliveries || []).filter(function (x) { return x.id === did; })[0];
        if (dlv && dlv.transportPaidBy === 'customer' && !dlv.transportPaid) {
          payload.transportPaid = window.confirm('Has the transport fee been collected from the customer? Click OK to mark it collected.');
        }
      }
      if (payload.status === 'cancelled' && !window.confirm('Cancel this delivery? It will return to the pool.')) return;
      send(payload);
      return;
    }
    var ap = e.target.closest('[data-ap]');
    if (ap) { adminProductAction(ap); return; }
    var au = e.target.closest('[data-au]');
    if (au) {
      api('/admin/users/' + au.getAttribute('data-id') + '/status', { method: 'POST', body: { status: au.getAttribute('data-status') } })
        .then(function () { showToast('User updated'); adminRefresh(); })
        .catch(function (err) { showToast(apiFail(err, 'Action')); });
      return;
    }
    var ve = e.target.closest('[data-v-edit]');
    if (ve) { editingId = ve.getAttribute('data-v-edit'); VENDOR.tab = 'products'; renderVendorDash(); return; }
    var vd = e.target.closest('[data-v-del]');
    if (vd) {
      if (!window.confirm('Delete this product?')) return;
      api('/vendors/products/' + vd.getAttribute('data-v-del'), { method: 'DELETE' })
        .then(function () { showToast('Product deleted'); reloadVendor(); })
        .catch(function (err) { showToast(apiFail(err, 'Delete')); });
      return;
    }
    if (e.target.closest('#vpCancel')) { editingId = null; renderVendorDash(); return; }
    if (e.target.closest('#vendorMarkRead')) {
      api('/vendors/notifications/read', { method: 'POST', body: {} })
        .then(function () { if (VENDOR_DATA) { VENDOR_DATA.unread = 0; VENDOR_DATA.notes = []; } renderVendorDash(); })
        .catch(function (err) { showToast(apiFail(err, 'Messages')); });
      return;
    }
    if (e.target.closest('#vendorSignIn')) { openAcct('login'); return; }
    if (e.target.closest('#adminSignIn')) { openAcct('login'); return; }
  });

  /* ============ shared modal helper ============ */
  function syncBodyLock() {
    var open = document.querySelectorAll('.modal:not([hidden])').length;
    document.body.classList.toggle('no-scroll', open > 0);
  }

  /* ============ product share ============ */
  var shareModal = document.getElementById('shareModal');
  var shareOv = document.getElementById('shareOv');
  function productUrl(p) { return location.origin + location.pathname + '#/p/' + p.id; }
  function copyText(txt) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(txt);
    var ta = document.createElement('textarea');
    ta.value = txt; ta.setAttribute('readonly', '');
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (err) {}
    document.body.removeChild(ta);
    return Promise.resolve();
  }
  function openShare(p) {
    if (!p || !shareModal) return;
    var name = stripHtml(decode(p.name));
    var url = productUrl(p);
    var text = name + ' - ' + fmt(p.price) + ' on ShopOnlineUg';
    document.getElementById('shareTitle').textContent = name;
    document.getElementById('shareSub').textContent = fmt(p.price) + ' \u00b7 ' + (p.loc || 'Kampala') + ' \u00b7 ' + (p.seller || 'ShopOnlineUg');
    setImg(document.getElementById('shareImg'), p.img, p.id);
    document.getElementById('shareUrl').textContent = url;
    document.getElementById('shareWa').href = 'https://wa.me/?text=' + encodeURIComponent(text + ' ' + url);
    document.getElementById('shareFb').href = 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url);
    document.getElementById('shareX').href = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(url);
    document.getElementById('shareMail').href = 'mailto:?subject=' + encodeURIComponent('Look at this: ' + name) + '&body=' + encodeURIComponent(text + '\n\n' + url);
    document.getElementById('shareNativeBtn').hidden = !navigator.share;
    document.getElementById('shareCopyLabel').textContent = 'Copy link';
    shareModal.hidden = false; shareOv.hidden = false; syncBodyLock();
  }
  function closeShare() { shareModal.hidden = true; shareOv.hidden = true; syncBodyLock(); }
  (function setupShare() {
    if (!shareModal) return;
    document.getElementById('shareClose').addEventListener('click', closeShare);
    shareOv.addEventListener('click', closeShare);
    document.getElementById('shareCopyBtn').addEventListener('click', function () {
      copyText(document.getElementById('shareUrl').textContent).then(function () {
        document.getElementById('shareCopyLabel').textContent = 'Copied!';
        showToast('Link copied to clipboard');
      });
    });
    document.getElementById('shareNativeBtn').addEventListener('click', function () {
      if (!navigator.share) return;
      var title = document.getElementById('shareTitle').textContent;
      navigator.share({ title: title, text: title + ' on ShopOnlineUg', url: document.getElementById('shareUrl').textContent })
        .catch(function () {});
    });
    document.getElementById('shareGrid').addEventListener('click', function (e) {
      var a = e.target.closest('.share-opt');
      if (a && a.tagName === 'A') setTimeout(closeShare, 200);
    });
  })();

  /* ============ admin: message a vendor ============ */
  var avMsgModal = document.getElementById('avMsgModal');
  var avMsgOv = document.getElementById('avMsgOv');
  var AV_MSG_VENDOR = null;
  function closeVendorMessage() { avMsgModal.hidden = true; avMsgOv.hidden = true; syncBodyLock(); }
  function openVendorMessage(id) {
    AV_MSG_VENDOR = ADMIN.vendors.filter(function (v) { return v.id === id; })[0] || null;
    if (!AV_MSG_VENDOR) return;
    document.getElementById('avMsgTo').textContent = (AV_MSG_VENDOR.storeName || 'Vendor') +
      (AV_MSG_VENDOR.email ? ' \u00b7 ' + AV_MSG_VENDOR.email : '');
    document.getElementById('avMsgSubject').value = 'Message from the ShopOnlineUg team';
    document.getElementById('avMsgBody').value = '';
    document.getElementById('avMsgErr').hidden = true;
    avMsgModal.hidden = false; avMsgOv.hidden = false; syncBodyLock();
    document.getElementById('avMsgBody').focus();
  }
  function sendVendorMessage() {
    if (!AV_MSG_VENDOR) return;
    var subject = document.getElementById('avMsgSubject').value.trim();
    var message = document.getElementById('avMsgBody').value.trim();
    var errBox = document.getElementById('avMsgErr');
    var btn = document.getElementById('avMsgSend');
    if (message.length < 2) { errBox.textContent = 'Write a short message first.'; errBox.hidden = false; return; }
    errBox.hidden = true;
    btn.disabled = true; btn.textContent = 'Sending...';
    api('/admin/vendors/' + AV_MSG_VENDOR.id + '/message', { method: 'POST', body: { subject: subject, message: message } })
      .then(function () {
        btn.disabled = false; btn.textContent = 'Send message';
        closeVendorMessage();
        showToast('Message sent to <b>' + esc(AV_MSG_VENDOR.storeName || 'vendor') + '</b> and added to their hub');
      })
      .catch(function (e) {
        btn.disabled = false; btn.textContent = 'Send message';
        errBox.textContent = apiFail(e, 'Message'); errBox.hidden = false;
      });
  }
  if (avMsgModal) {
    document.getElementById('avMsgClose').addEventListener('click', closeVendorMessage);
    document.getElementById('avMsgCancel').addEventListener('click', closeVendorMessage);
    document.getElementById('avMsgSend').addEventListener('click', sendVendorMessage);
    avMsgOv.addEventListener('click', closeVendorMessage);
  }

  /* ============ rider portal ============ */
  var DRIVER_UI = { tab: 'jobs', config: null, me: null, jobs: null, notes: [], docs: {}, poll: null, busy: false };
  var NEXT_STEP = {
    assigned: { status: 'picked', label: 'Picked up' },
    picked: { status: 'transit', label: 'Start delivery' },
    transit: { status: 'arrived', label: 'Arrived at customer' },
    arrived: { status: 'delivered', label: 'Mark delivered' }
  };

  function driverSignedOutHtml() {
    return '<div class="portal-hero drv-hero"><h1>Deliver with ShopOnlineUg</h1>' +
      '<p>Pick up packed orders from vendors across Kampala, drop them to customers and earn on every job. Work your own hours and track every delivery from your phone.</p>' +
      '<div class="ph-actions"><button class="btn _prim" type="button" id="drvApplyBtn">Apply to ride</button>' +
      '<button class="btn _line" type="button" id="drvSignIn">Sign in</button></div></div>' +
      '<div class="v-stats">' +
      stat('UGX 3,000+', 'Average pay per drop') + stat('Flexible', 'Work when you want') +
      stat('Weekly', 'Payouts to your phone') + stat('Live', 'GPS tracking on every job') +
      '</div>' +
      '<div class="card drv-card"><h3>How it works</h3><div class="drv-steps">' +
      '<div class="step on"><b>1</b><span>Apply</span><p>Share your details, vehicle and documents.</p></div>' +
      '<div class="step"><b>2</b><span>Get approved</span><p>Our team verifies you, usually within a day.</p></div>' +
      '<div class="step"><b>3</b><span>Claim jobs</span><p>Take open pickups near you from the rider portal.</p></div>' +
      '<div class="step"><b>4</b><span>Earn</span><p>Confirm handovers and get paid every week.</p></div>' +
      '</div>' +
      '<p class="card-sub">You need a motorcycle, bicycle or tuk-tuk, a valid driver&rsquo;s licence, your national ID and a selfie for verification. ' +
      'Already riding with us? <a href="#/info/Become%20a%20logistics%20service%20partner">Read the partner guide</a>.</p></div>';
  }

  function driverField(label, id, type, val, opts) {
    opts = opts || {};
    if (type === 'select') {
      return '<div class="field' + (opts.row ? '' : '') + '"><label for="' + id + '">' + label + '</label>' +
        '<select id="' + id + '">' + opts.options.map(function (o) {
          var v = typeof o === 'string' ? o : o.v;
          var l = typeof o === 'string' ? o : o.l;
          return '<option value="' + esc(v) + '"' + (String(val || '') === String(v) ? ' selected' : '') + '>' + esc(l) + '</option>';
        }).join('') + '</select></div>';
    }
    return '<div class="field"><label for="' + id + '">' + label + '</label>' +
      '<input id="' + id + '" type="' + type + '" value="' + esc(val || '') + '"' +
      (opts.ph ? ' placeholder="' + esc(opts.ph) + '"' : '') + (opts.attrs || '') + '></div>';
  }

  function renderDriverApply() {
    var cfg = DRIVER_UI.config || {};
    var u = SERVER_USER || {};
    var body = document.getElementById('driverBody');
    var vehicles = cfg.vehicleTypes || [];
    body.innerHTML = '<div class="portal-hero drv-hero"><h1>Apply to ride</h1>' +
      '<p>Tell us about you and your vehicle. Every field below is required by our delivery team.</p></div>' +
      '<form class="card drv-form" id="drvForm" novalidate>' +
      '<h3>Your details</h3>' +
      '<div class="field _row"><div><label for="drName">Full name</label><input id="drName" type="text" value="' + esc(u.name || '') + '" placeholder="e.g. Joseph Mugisha"></div>' +
      '<div><label for="drPhone">Phone number</label><input id="drPhone" type="tel" value="' + esc(u.phone || '') + '" placeholder="+256 7.. ... ..."></div></div>' +
      '<div class="field _row"><div><label for="drEmail">Email</label><input id="drEmail" type="email" value="' + esc(u.email || '') + '"></div>' +
      '<div><label for="drDob">Date of birth</label><input id="drDob" type="date"></div></div>' +
      '<h3>Vehicle</h3>' +
      '<div class="field _row"><div><label for="drVehicle">Vehicle type</label><select id="drVehicle">' +
      vehicles.map(function (v) { return '<option value="' + esc(v) + '">' + esc(v) + '</option>'; }).join('') +
      '</select></div><div><label for="drPlate">Number plate</label><input id="drPlate" type="text" placeholder="e.g. KDG 419F"></div></div>' +
      '<div class="field _row"><div><label for="drLic">Driver&rsquo;s licence number</label><input id="drLic" type="text" placeholder="e.g. U7845123"></div>' +
      '<div><label for="drLicExp">Licence expiry</label><input id="drLicExp" type="date"></div></div>' +
      '<div class="field"><label for="drNid">National ID number</label><input id="drNid" type="text" placeholder="e.g. CM987654321"></div>' +
      '<h3>Documents</h3>' +
      '<p class="card-sub">Clear photos, JPG or PNG, under 3MB each. We verify them before approving your account.</p>' +
      '<div class="drv-files">' +
      '<label class="drv-file" for="drLicFile"><b>Driver&rsquo;s licence photo</b><span id="drLicFileName">Choose a file</span>' +
      '<input id="drLicFile" type="file" accept="image/*"></label>' +
      '<label class="drv-file" for="drNidFile"><b>National ID photo</b><span id="drNidFileName">Choose a file</span>' +
      '<input id="drNidFile" type="file" accept="image/*"></label>' +
      '<label class="drv-file" for="drSelfieFile"><b>Selfie</b><span id="drSelfieFileName">Choose a file</span>' +
      '<input id="drSelfieFile" type="file" accept="image/*" capture="user"></label>' +
      '</div>' +
      '<p class="drv-err" id="drErr" hidden></p>' +
      '<div class="row-actions"><button class="btn _prim" type="submit">Submit application</button>' +
      '<button class="btn _ghost" type="button" id="drvCancelApply">Back</button></div>' +
      '<p class="acct-foot">By applying you agree to the ShopOnlineUg rider terms and our privacy notice.</p>' +
      '</form>';
    DRIVER_UI.docs = {};
    var form = document.getElementById('drvForm');
    form.addEventListener('submit', function (e) { e.preventDefault(); submitDriverApply(); });
    ['drLicFile', 'drNidFile', 'drSelfieFile'].forEach(function (id) {
      document.getElementById(id).addEventListener('change', onDriverFile);
    });
    document.getElementById('drvCancelApply').addEventListener('click', function () { renderDriverPage(); });
  }

  function onDriverFile(e) {
    var input = e.target;
    if (!input.files || !input.files[0]) return;
    var key = { drLicFile: 'licenseFile', drNidFile: 'nationalIdFile', drSelfieFile: 'selfieFile' }[input.id];
    var nameEl = document.getElementById(input.id + 'Name');
    shrinkImage(input.files[0], function (err, dataUrl) {
      if (err) { if (nameEl) nameEl.textContent = err; return; }
      DRIVER_UI.docs[key] = dataUrl;
      if (nameEl) nameEl.textContent = input.files[0].name + ' \u2713 ready';
    });
  }

  function shrinkImage(file, cb) {
    if (!/^image\//.test(file.type)) { cb('Please choose an image file.'); return; }
    var reader = new FileReader();
    reader.onerror = function () { cb('Could not read that file.'); };
    reader.onload = function () {
      var img = new Image();
      img.onerror = function () { cb('That file is not a valid image.'); };
      img.onload = function () {
        var max = 1280;
        var scale = Math.min(1, max / Math.max(img.width, img.height));
        var w = Math.max(1, Math.round(img.width * scale));
        var h = Math.max(1, Math.round(img.height * scale));
        var c = document.createElement('canvas');
        c.width = w; c.height = h;
        var ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        var out;
        try { out = c.toDataURL('image/jpeg', 0.82); } catch (err) { out = reader.result; }
        cb(null, out);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function submitDriverApply() {
    var errBox = document.getElementById('drErr');
    function fail(msg) { errBox.textContent = msg; errBox.hidden = false; }
    var payload = {
      name: document.getElementById('drName').value.trim(),
      phone: document.getElementById('drPhone').value.trim(),
      email: document.getElementById('drEmail').value.trim(),
      dob: document.getElementById('drDob').value,
      vehicleType: document.getElementById('drVehicle').value,
      numberPlate: document.getElementById('drPlate').value.trim(),
      licenseNo: document.getElementById('drLic').value.trim(),
      licenseExpiry: document.getElementById('drLicExp').value,
      nationalIdNo: document.getElementById('drNid').value.trim(),
      licenseFile: DRIVER_UI.docs.licenseFile || null,
      nationalIdFile: DRIVER_UI.docs.nationalIdFile || null,
      selfieFile: DRIVER_UI.docs.selfieFile || null
    };
    if (!payload.licenseFile || !payload.nationalIdFile || !payload.selfieFile) {
      fail('Upload all three documents: licence, national ID and selfie.'); return;
    }
    errBox.hidden = true;
    api('/delivery/apply', { method: 'POST', body: payload })
      .then(function (d) {
        showToast('Application received! Our team will review it shortly.');
        DRIVER_UI.me = d;
        DRIVER_UI.tab = 'jobs';
        renderDriverPage();
      })
      .catch(function (e) { fail(apiFail(e, 'Application')); });
  }

  function renderDriverDash() {
    var body = document.getElementById('driverBody');
    var m = DRIVER_UI.me || {};
    var d = m.driver || {};
    var st = m.stats || d.stats || {};
    var rating = (m.rating && m.rating.rating) || d.rating || 0;
    var statusLbl = { pending: 'awaiting approval', approved: 'approved', rejected: 'rejected', suspended: 'suspended' }[d.status] || d.status;
    var note = '';
    var cfgS = m.settings || {};
    if (d.status === 'pending') note = '<div class="pending-note">Your application is <b>awaiting approval</b>. You can browse open jobs, but claiming unlocks once an admin approves your records.</div>';
    if (d.status === 'rejected') note = '<div class="pending-note">Your application was not approved. ' + esc(d.rejectionReason || 'Contact support for details.') + '</div>';
    if (d.status === 'suspended') note = '<div class="pending-note">Your rider account is suspended. Contact support@shoponline.ug.</div>';
    if (d.status === 'approved' && d.gpsEnabled === false && cfgS.driverGpsRequired) note += '<div class="pending-note">Location sharing is <b>off</b>. Turn it on under <b>My profile</b> to claim and complete deliveries.</div>';
    if (m.ratingFlag && m.ratingFlag.flagged) note += '<div class="pending-note">Your rating (' + Number(m.ratingFlag.rating || 0).toFixed(1) + ' / 5) is below the ' + esc(String(m.ratingFlag.floor)) + ' minimum. New job claims are paused - contact support to have your account reviewed.</div>';

    body.innerHTML = '<div class="portal-hero drv-hero"><h1>' + esc(d.name || 'Rider') +
      ' <span class="pbadge _' + esc(d.status) + '">' + esc(statusLbl) + '</span></h1>' +
      '<p>' + esc(d.vehicleType || '') + (d.numberPlate ? ' &middot; ' + esc(d.numberPlate) : '') + ' &middot; ' + esc(d.phone || '') + '</p>' +
      '<div class="ph-actions">' +
      '<button class="btn _prim" type="button" data-dtab="jobs">Open jobs</button>' +
      '<button class="btn _line" type="button" data-dtab="profile">My profile</button>' +
      '<button class="btn _line" type="button" data-dtab="alerts">Alerts' + (DRIVER_UI.unread ? ' (' + DRIVER_UI.unread + ')' : '') + '</button>' +
      '</div></div>' + note +
      '<div class="v-stats">' +
      stat(money0(st.earnings || 0), 'Earnings (UGX)') +
      stat(st.delivered || 0, 'Completed') + stat(st.active || 0, 'Active now') +
      stat(rating ? Number(rating).toFixed(1) : '-', 'Rating / 5') +
      stat(st.total || 0, 'Lifetime jobs') + stat(st.onTime || 0, 'Delivered on time') +
      '</div>' +
      '<div class="ptabs">' +
      [['jobs', 'Jobs'], ['profile', 'My profile'], ['alerts', 'Alerts' + (DRIVER_UI.unread ? ' (' + DRIVER_UI.unread + ')' : '')]].map(function (t) {
        return '<button data-dtab="' + t[0] + '" class="' + (DRIVER_UI.tab === t[0] ? 'on' : '') + '">' + t[1] + '</button>';
      }).join('') + '</div>' +
      '<div id="driverPanel"><div class="empty-note">Loading jobs&hellip;</div></div>';
    renderDriverTab();
    loadDriverJobs();
  }

  function renderDriverTab() {
    $$('#driverBody .ptabs button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-dtab') === DRIVER_UI.tab); });
    var panel = document.getElementById('driverPanel');
    if (!panel) return;
    if (DRIVER_UI.tab === 'profile') { panel.innerHTML = driverProfileHtml(); return; }
    if (DRIVER_UI.tab === 'alerts') { panel.innerHTML = driverAlertsHtml(); return; }
    panel.innerHTML = driverJobsHtml();
  }

  function claimBlockReason() {
    var m = DRIVER_UI.me || {};
    if (m.canClaim && m.canClaim.ok === false) return m.canClaim.error || 'You cannot claim jobs right now.';
    return null;
  }

  function driverJobsHtml() {
    var j = DRIVER_UI.jobs;
    if (!j) return '<div class="empty-note">Loading jobs&hellip;</div>';
    var active = j.active || [];
    var open = j.open || [];
    var history = j.history || [];
    var html = '';
    if (active.length) {
      html += '<div class="card"><h3>Your active job' + (active.length === 1 ? '' : 's') + '</h3>' +
        active.map(function (d) { return driverJobCard(d, true); }).join('') + '</div>';
    }
    var block = claimBlockReason();
    html += '<div class="card"><h3>Open pickups (' + open.length + ')</h3>' +
      '<p class="card-sub">Jobs waiting for a rider. Customer contact details stay hidden until you accept.</p>' +
      (block ? '<div class="pending-note">' + esc(block) + '</div>' : '') +
      (open.length ? open.map(function (d) { return driverJobCard(d, false); }).join('')
        : '<div class="empty-note">No open pickups right now. We will alert you when a vendor packs an order.</div>') +
      '</div>';
    html += '<div class="card"><h3>Recent jobs</h3>' +
      (history.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Order</th><th>Drop-off</th><th>Status</th><th>Earned</th></tr></thead><tbody>' +
        history.map(function (d) {
          return '<tr><td class="num">#' + esc(d.orderNo || d.orderId || '') + '</td>' +
            '<td>' + esc(d.dropoffTown || '') + '<div class="mi-meta">' + esc(d.dropoffAddress || '') + '</div></td>' +
            '<td><span class="pbadge _' + (d.status === 'delivered' ? 'approved' : 'rejected') + '">' + esc(d.statusLabel || d.status) + '</span></td>' +
            '<td class="num">' + (d.status === 'delivered' ? fmt(d.driverPay || 0) : '-') + '</td></tr>';
        }).join('') + '</tbody></table></div>'
        : '<div class="empty-note">Completed jobs appear here.</div>') +
      '</div>';
    return html;
  }

  function driverJobCard(d, isActive) {
    var step = isActive ? NEXT_STEP[d.status] : null;
    var items = (d.items || []).map(function (it) { return it.qty + ' \u00d7 ' + it.name; }).join(', ');
    var statusCls = d.status === 'delivered' ? 'approved' : d.status === 'cancelled' ? 'rejected' : 'processing';
    return '<div class="drv-job">' +
      '<div class="drv-job-top">' +
      '<div><b>Order #' + esc(d.orderNo || d.orderId || '') + '</b>' +
      '<span class="pbadge _' + statusCls + '">' + esc(d.statusLabel || d.status) + '</span></div>' +
      '<span class="drv-pay">' + fmt(d.transportFee || 0) + ' transport</span>' +
      '</div>' +
      '<div class="drv-job-body">' +
      '<p><b>Pick up</b> ' + esc(d.pickupAddress || 'Kampala') + '</p>' +
      '<p><b>Drop off</b> ' + esc(d.dropoffAddress || '') + (d.dropoffTown ? ', ' + esc(d.dropoffTown) : '') + '</p>' +
      (items ? '<p class="drv-items">' + esc(items) + '</p>' : '') +
      (d.customerName ? '<p class="drv-items">' + esc(d.customerName) +
        (d.customerPhone ? ' &middot; <a href="tel:' + esc(String(d.customerPhone).replace(/[^\d+]/g, '')) + '">' + esc(d.customerPhone) + '</a>' : '') + '</p>' : '') +
      (d.etaAt ? '<p class="drv-items">ETA ' + esc(new Date(d.etaAt).toLocaleString('en-GB')) + '</p>' : '') +
      '</div>' +
      '<div class="row-actions drv-job-actions">' +
      (isActive
        ? (step ? '<button class="btn _sm _prim" type="button" data-dadv="' + step.status + '" data-id="' + esc(d.id) + '">' + step.label + '</button>' : '') +
          '<button class="btn _sm _danger" type="button" data-dadv="cancelled" data-id="' + esc(d.id) + '">Cancel</button>'
        : (claimBlockReason()
          ? '<button class="btn _sm _prim" type="button" disabled>Claiming paused</button>'
          : '<button class="btn _sm _prim" type="button" data-dclaim="' + esc(d.id) + '">Claim this job</button>' +
            (d.dropoffLat ? '<a class="btn _sm _ghost" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=' + d.dropoffLat + ',' + d.dropoffLng + '">Directions</a>' : ''))) +
      '</div></div>';
  }

  function driverProfileHtml() {
    var m = DRIVER_UI.me || {};
    var d = m.driver || {};
    var cfg = DRIVER_UI.config || {};
    var vehicles = cfg.vehicleTypes || [];
    return '<form class="card drv-form" id="drvProfileForm">' +
      '<h3>Rider profile</h3>' +
      '<div class="field _row"><div><label for="dpName">Full name</label><input id="dpName" type="text" value="' + esc(d.name || '') + '"></div>' +
      '<div><label for="dpPhone">Phone number</label><input id="dpPhone" type="tel" value="' + esc(d.phone || '') + '"></div></div>' +
      '<div class="field _row"><div><label for="dpDob">Date of birth</label><input id="dpDob" type="date" value="' + esc(d.dob || '') + '"></div>' +
      '<div><label for="dpVehicle">Vehicle type</label><select id="dpVehicle">' +
      vehicles.map(function (v) { return '<option value="' + esc(v) + '"' + (d.vehicleType === v ? ' selected' : '') + '>' + esc(v) + '</option>'; }).join('') +
      '</select></div></div>' +
      '<div class="field _row"><div><label for="dpPlate">Number plate</label><input id="dpPlate" type="text" value="' + esc(d.numberPlate || '') + '"></div>' +
      '<div><label for="dpLic">Licence number</label><input id="dpLic" type="text" value="' + esc(d.licenseNo || '') + '"></div></div>' +
      '<div class="field _row"><div><label for="dpLicExp">Licence expiry</label><input id="dpLicExp" type="date" value="' + esc(d.licenseExpiry || '') + '"></div>' +
      '<div><label for="dpNid">National ID number</label><input id="dpNid" type="text" value="' + esc(d.nationalIdNo || '') + '"></div></div>' +
      '<div class="field"><label for="dpGps">Location sharing</label><select id="dpGps">' +
      '<option value="on"' + (d.gpsEnabled !== false ? ' selected' : '') + '>Share my location while delivering</option>' +
      '<option value="off"' + (d.gpsEnabled === false ? ' selected' : '') + '>Do not share location</option></select></div>' +
      '<div class="drv-files">' +
      ['license', 'nationalId', 'selfie'].map(function (k) {
        var labels = { license: "Driver's licence photo", nationalId: 'National ID photo', selfie: 'Selfie photo' };
        var has = d.documents && d.documents[k];
        return '<label class="drv-file" for="dpFile_' + k + '"><b>' + labels[k] + '</b>' +
          '<span id="dpFile_' + k + 'Name">' + (has ? 'On file \u2713' : 'Not uploaded yet') + '</span>' +
          '<input id="dpFile_' + k + '" type="file" accept="image/*"' + (k === 'selfie' ? ' capture="user"' : '') + '></label>';
      }).join('') +
      '</div>' +
      '<p class="drv-err" id="dpErr" hidden></p>' +
      '<div class="row-actions"><button class="btn _prim" type="submit">Save profile</button>' +
      '<button class="btn _ghost" type="button" id="drvSignOut">Sign out</button></div>' +
      '</form>';
  }

  function driverAlertsHtml() {
    var notes = DRIVER_UI.notes || [];
    if (!notes.length) return '<div class="card"><h3>Alerts</h3><div class="empty-note">No alerts yet. Pickup requests and delivery updates show up here.</div></div>';
    return '<div class="card"><div class="mail-h"><div><h3>Alerts</h3><p class="mail-sub">' +
      (DRIVER_UI.unread ? DRIVER_UI.unread + ' unread' : 'All caught up') + '</p></div>' +
      '<button type="button" class="linkish" data-dread="all">Mark all read</button></div>' +
      '<div class="mail-list">' + notes.map(function (n) {
        return '<div class="mail-item' + (n.status === 'unread' ? ' _new' : '') + '">' +
          '<div class="mail-from">' + esc(n.title || 'Update') + '</div>' +
          '<div class="mail-subject">' + esc(n.body || '') + '</div>' +
          '<div class="mail-meta">' + esc(new Date(n.createdAt).toLocaleString('en-GB')) +
          (n.orderNo ? ' &middot; order #' + esc(n.orderNo) : '') + '</div></div>';
      }).join('') + '</div></div>';
  }

  function loadDriverJobs() {
    if (!DRIVER_UI.me) return;
    return Promise.all([api('/delivery/jobs'), api('/delivery/notifications')])
      .then(function (r) {
        DRIVER_UI.jobs = r[0];
        DRIVER_UI.notes = r[1].notifications || [];
        DRIVER_UI.unread = r[1].unread || 0;
        if (DRIVER_UI.tab === 'jobs' || DRIVER_UI.tab === 'alerts') renderDriverTab();
      })
      .catch(function (e) {
        var panel = document.getElementById('driverPanel');
        if (panel) panel.innerHTML = '<div class="pending-note">' + esc(apiFail(e, 'Jobs')) + '</div>';
      });
  }

  function pingLocation() {
    if (!DRIVER_UI.me || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(function (pos) {
      api('/delivery/location', { method: 'POST', body: { lat: pos.coords.latitude, lng: pos.coords.longitude } })
        .catch(function () {});
    }, function () {}, { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 });
  }

  function startDriverPolling() {
    if (DRIVER_UI.poll) return;
    DRIVER_UI.poll = setInterval(function () {
      if (document.getElementById('driverPage').hidden) return;
      if (!DRIVER_UI.me) return;
      pingLocation();
      loadDriverJobs();
    }, 20000);
  }

  function driverAdvance(btn) {
    var status = btn.getAttribute('data-dadv');
    var id = btn.getAttribute('data-id');
    if (DRIVER_UI.busy) return;
    var job = ((DRIVER_UI.jobs && DRIVER_UI.jobs.active) || []).filter(function (x) { return x.id === id; })[0];
    var transportPaid = false;
    if (status === 'delivered') {
      if (!window.confirm('Confirm you handed the order over to the customer.')) return;
      if (job && job.transportPaidBy === 'customer' && !job.transportPaid) {
        if (!window.confirm('Collect the transport fee of ' + fmt(job.transportFee || 0) + ' from the customer.\n\nClick OK once you have collected it.')) return;
        transportPaid = true;
      }
    }
    if (status === 'cancelled' && !window.confirm('Cancel this delivery? It will return to the open pool.')) return;
    DRIVER_UI.busy = true;
    btn.disabled = true;
    api('/delivery/jobs/' + id + '/advance', { method: 'POST', body: { status: status, confirmHandover: status === 'delivered', transportPaid: transportPaid } })
      .then(function (r) {
        DRIVER_UI.busy = false;
        showToast('Delivery marked <b>' + esc((r.delivery && r.delivery.statusLabel) || status) + '</b>');
        loadDriverMe().then(function () { renderDriverDash(); });
      })
      .catch(function (e) {
        DRIVER_UI.busy = false;
        btn.disabled = false;
        showToast(apiFail(e, 'Update'));
      });
  }

  function loadDriverMe() {
    if (!DRIVER_UI.me) return Promise.resolve();
    return api('/delivery/me').then(function (m) { DRIVER_UI.me = m; }).catch(function () {});
  }

  function driverClaim(btn) {
    if (DRIVER_UI.busy) return;
    DRIVER_UI.busy = true;
    btn.disabled = true; btn.textContent = 'Claiming...';
    api('/delivery/jobs/' + btn.getAttribute('data-dclaim') + '/claim', { method: 'POST' })
      .then(function () { DRIVER_UI.busy = false; showToast('Job claimed - it is now yours.'); loadDriverMe().then(function () { renderDriverDash(); }); })
      .catch(function (e) {
        DRIVER_UI.busy = false;
        btn.disabled = false; btn.textContent = 'Claim this job';
        showToast(apiFail(e, 'Claim'));
      });
  }

  function saveDriverProfile(e) {
    if (e) e.preventDefault();
    var payload = {
      name: document.getElementById('dpName').value.trim(),
      phone: document.getElementById('dpPhone').value.trim(),
      dob: document.getElementById('dpDob').value,
      vehicleType: document.getElementById('dpVehicle').value,
      numberPlate: document.getElementById('dpPlate').value.trim(),
      licenseNo: document.getElementById('dpLic').value.trim(),
      licenseExpiry: document.getElementById('dpLicExp').value,
      nationalIdNo: document.getElementById('dpNid').value.trim(),
      gpsEnabled: document.getElementById('dpGps').value === 'on'
    };
    api('/delivery/me', { method: 'PUT', body: payload })
      .then(function (d) {
        DRIVER_UI.me = { driver: d.driver, stats: DRIVER_UI.me.stats, rating: DRIVER_UI.me.rating, completeness: d.completeness };
        showToast(d.needsReview ? 'Profile saved - records sent for review' : 'Profile saved');
        renderDriverDash();
      })
      .catch(function (e) {
        var box = document.getElementById('dpErr');
        if (box) { box.textContent = apiFail(e, 'Save'); box.hidden = false; }
        showToast(apiFail(e, 'Save'));
      });
  }

  function saveDriverDocs(e) {
    var input = e.target;
    if (!input.id || input.id.indexOf('dpFile_') !== 0) return;
    if (!input.files || !input.files[0]) return;
    var key = input.id.replace('dpFile_', '');
    shrinkImage(input.files[0], function (err, dataUrl) {
      var nameEl = document.getElementById(input.id + 'Name');
      if (err) { if (nameEl) nameEl.textContent = err; return; }
      var body = {};
      body[key] = dataUrl;
      api('/delivery/me/documents', { method: 'POST', body: body })
        .then(function () {
          if (nameEl) nameEl.textContent = 'Uploaded \u2713';
          showToast('Document uploaded');
          loadDriverMe();
        })
        .catch(function (er) { if (nameEl) nameEl.textContent = apiFail(er, 'Upload'); });
    });
  }

  function renderDriverPage() {
    var body = document.getElementById('driverBody');
    if (!body) return;
    if (!SERVER_USER) { body.innerHTML = driverSignedOutHtml(); startDriverPolling(); return; }
    body.innerHTML = '<div class="empty-note">Loading the rider portal&hellip;</div>';
    var cfg = null;
    api('/delivery/config').then(function (c) { cfg = c; DRIVER_UI.config = c; return api('/delivery/me'); })
      .then(function (m) {
        DRIVER_UI.me = m;
        DRIVER_UI.tab = 'jobs';
        renderDriverDash();
        startDriverPolling();
        pingLocation();
      })
      .catch(function (e) {
        if (e && e.status === 404) { DRIVER_UI.tab = 'apply'; renderDriverApply(); startDriverPolling(); return; }
        body.innerHTML = '<div class="pending-note">' + esc(apiFail(e, 'Rider portal')) + '</div>';
      });
  }

  /* ============ rider portal events ============ */
  document.addEventListener('change', function (e) {
    if (!document.getElementById('driverPage').hidden) saveDriverDocs(e);
  });
  document.addEventListener('submit', function (e) {
    if (e.target && e.target.id === 'drvProfileForm') saveDriverProfile(e);
  });
  document.addEventListener('click', function (e) {
    if (document.getElementById('driverPage').hidden) return;
    var dt = e.target.closest('[data-dtab]');
    if (dt) { DRIVER_UI.tab = dt.getAttribute('data-dtab'); renderDriverTab(); if (DRIVER_UI.tab === 'alerts') loadDriverJobs(); return; }
    var claim = e.target.closest('[data-dclaim]');
    if (claim) { driverClaim(claim); return; }
    var adv = e.target.closest('[data-dadv]');
    if (adv) { driverAdvance(adv); return; }
    var read = e.target.closest('[data-dread]');
    if (read) {
      api('/delivery/notifications/read', { method: 'POST', body: {} })
        .then(function () { DRIVER_UI.unread = 0; loadDriverJobs(); })
        .catch(function (er) { showToast(apiFail(er, 'Alerts')); });
      return;
    }
    if (e.target.closest('#drvApplyBtn')) {
      if (!SERVER_USER) { openAcct('login'); showToast('Sign in first, then apply to ride'); return; }
      DRIVER_UI.tab = 'apply'; renderDriverApply(); return;
    }
    if (e.target.closest('#drvSignIn')) { openAcct('login'); return; }
    if (e.target.closest('#drvSignOut')) { signOut(); renderDriverPage(); return; }
  });

  /* ============ ambiance ============ */
  function setupTicker() {
    var t = document.getElementById('tickerTrack');
    if (!t) return;
    var items = [
      ['FREE DELIVERY', 'on orders over ' + fmt(CONF.freeThreshold || 200000)],
      ['PAY ON DELIVERY', 'now available nationwide'],
      ['7-DAY RETURNS', 'no questions asked'],
      ['FLASH SALES', 'new drops every midnight'],
      ['100% AUTHENTIC', 'secure checkout'],
      ['UGANDA DELIVERIES', 'Kampala to the border']
    ];
    var g = '<div class="ticker-g">' + items.map(function (it) {
      return '<span><b>' + it[0] + '</b>' + it[1] + '</span><i>&#9679;</i>';
    }).join('') + '</div>';
    t.innerHTML = g + g;
  }

  function setupReveal() {
    var els = Array.prototype.slice.call(document.querySelectorAll(
      '#homePage .hero,#homePage .band,#homePage .sec,#homePage .cta-strip'
    ));
    if (!('IntersectionObserver' in window)) {
      els.forEach(function (e) { e.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.12 });
    els.forEach(function (el, i) {
      el.classList.add('reveal');
      el.style.setProperty('--rd', Math.min((i % 5) * 70, 280) + 'ms');
      io.observe(el);
    });
  }

  function setupProgress() {
    var prog = document.getElementById('progBar');
    if (!prog) return;
    function onProg() {
      var h = document.documentElement;
      var max = h.scrollHeight - h.clientHeight;
      prog.style.width = (max > 0 ? (window.pageYOffset / max) * 100 : 0) + '%';
    }
    window.addEventListener('scroll', onProg, { passive: true });
    onProg();
  }

  function setupDealPop() {
    if (CONF.dealPopupVisible === false) return;
    var ov = document.getElementById('dealPopOv');
    var pop = document.getElementById('dealPop');
    if (!ov || !pop) return;
    var K = 'sou_deal_pop';
    var x = document.getElementById('dealPopX');
    var link = document.getElementById('dealPopLink');
    function openPop() { ov.hidden = false; pop.hidden = false; }
    function closePop() { sessionStorage.setItem(K, '1'); ov.hidden = true; pop.hidden = true; }
    if (x) x.addEventListener('click', closePop);
    if (ov) ov.addEventListener('click', closePop);
    if (link) link.addEventListener('click', closePop);
    if (sessionStorage.getItem(K)) return;
    setTimeout(openPop, 2600);
  }

  /* ============ init ============ */
  seedDemo();
  renderGrids();
  renderCatTiles();
  setupCatSlider();
  renderBrands();
  updateBadge();
  updateWishCount();
  renderDrawer();
  renderRecent();
  updateHeaderAccount();
  router();
  setupTicker();
  setupReveal();
  setupProgress();
  setupDealPop();
  document.addEventListener('load', function (e) {
    if (e.target && e.target.tagName === 'IMG') {
      var w = e.target.closest('.prd-img');
      if (w) w.classList.remove('is-loading');
    }
  }, true);

  (function bootstrap() {
    var q = location.hash.split('?')[1] || '';
    loadSettings().then(function () { renderGrids(); renderCatTiles(); renderDrawer(); });
    api('/auth/me').then(function (d) {
      applyServerUser(d.user);
      loadVendorCatalog();
      loadMailbox();
      if (q.indexOf('verified=1') !== -1) showToast('Email confirmed. Welcome to ShopOnlineUg!');
      if (q.indexOf('google=1') !== -1) showToast('Signed in with Google');
      if (q.indexOf('google=unconfigured') !== -1) showToast('Google sign-in is not configured on this server.');
      if (q) { location.hash = roleHome(); }
      else { router(); }
    }).catch(function () {
      loadVendorCatalog();
      loadMailbox();
    });
  })();
})();