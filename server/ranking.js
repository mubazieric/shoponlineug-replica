'use strict';

const cats = require('./categories');

const LOW_REVIEW_FLOOR = 3.0;
const DEMOTE_FACTOR = 0.55;
const RESPONSE_WEIGHT = 0.02;
const STAGE_ORDER = { admin_placeholder: 0, staff: 1, vendor: 2 };

function num(v, fallback) {
  var n = Number(v);
  return isFinite(n) ? n : (fallback == null ? 0 : fallback);
}

function listingOrigin(p) {
  if (p.listingOrigin) return p.listingOrigin;
  if (p.isPlaceholder || p.placeholder) return 'admin_placeholder';
  if (p.listedBy === 'staff' || p.staffListed) return 'staff';
  if (p.vendorId && p.vendorId !== 'v-admin' && p.vendorId !== 'staff') return 'vendor';
  return 'staff';
}

function originRank(p) {
  var o = listingOrigin(p);
  return STAGE_ORDER[o] == null ? 1 : STAGE_ORDER[o];
}

function avg(nums) {
  var list = nums.filter(function (n) { return isFinite(n); });
  if (!list.length) return 0;
  return list.reduce(function (a, b) { return a + b; }, 0) / list.length;
}

function reviewsFor(store, subjectKey, subjectId) {
  return (store.reviews || []).filter(function (r) {
    return r.status !== 'hidden' && r[subjectKey] === subjectId;
  });
}

function scoreOf(list) {
  if (!list.length) return 0;
  var s = list.reduce(function (a, r) { return a + num(r.rating, 0); }, 0);
  return Math.round((s / list.length) * 100) / 100;
}

/*
 * Ranking brief (verbatim priority from the marketplace spec):
 *   1. seller with a paid/promotional product appears first in the category
 *   2. product with higher reviews in that category
 *   3. product with higher sales made
 *   4. vendor with higher reviews generally (other categories inclusive)
 *   5. vendor with more products in that category
 *   6. vendor with more products overall regardless of category
 *   7. products listed by our staff
 *   8. admin listed placeholders (always last)
 * Vendors with generally bad reviews get less visibility, and the speed at which
 * a vendor responds breaks ties when scores are otherwise equal.
 */
function buildIndex(store) {
  var vendors = {};
  (store.vendors || []).forEach(function (v) { vendors[v.id] = v; });

  var vendorProducts = {};
  var vendorCategoryCount = {};
  (store.products || []).forEach(function (p) {
    if (!p.vendorId) return;
    if (!vendorProducts[p.vendorId]) vendorProducts[p.vendorId] = [];
    vendorProducts[p.vendorId].push(p);
    var ck = p.vendorId + '|' + (p.category || 'other');
    vendorCategoryCount[ck] = (vendorCategoryCount[ck] || 0) + 1;
  });

  var vendorRating = {};
  var vendorReviewCount = {};
  Object.keys(vendors).forEach(function (vid) {
    var list = reviewsFor(store, 'vendorId', vid);
    vendorRating[vid] = scoreOf(list);
    vendorReviewCount[vid] = list.length;
  });

  var productReviewCount = {};
  (store.products || []).forEach(function (p) {
    productReviewCount[p.id] = reviewsFor(store, 'productId', p.id).length;
  });

  var driverRating = {};
  (store.drivers || []).forEach(function (d) {
    driverRating[d.id] = scoreOf(reviewsFor(store, 'driverId', d.id));
  });

  var now = Date.now();
  var vendorResponse = {};
  Object.keys(vendors).forEach(function (vid) {
    var times = (store.logs || [])
      .filter(function (l) { return l.vendorId === vid && l.responseMs != null; })
      .map(function (l) { return num(l.responseMs, 0); });
    vendorResponse[vid] = times.length ? avg(times) : 0;
  });

  return {
    vendors: vendors,
    vendorProducts: vendorProducts,
    vendorCategoryCount: vendorCategoryCount,
    vendorRating: vendorRating,
    vendorReviewCount: vendorReviewCount,
    productReviewCount: productReviewCount,
    driverRating: driverRating,
    vendorResponse: vendorResponse,
    now: now
  };
}

function floorScore(store, key) {
  var v = Number((store.settings || {})[key]);
  return isFinite(v) && v > 0 ? v : 3.0;
}

function responseBoost(ms) {
  if (!ms || ms <= 0) return 0;
  if (ms >= 24 * 3600 * 1000) return 0;
  return Math.max(0, 1 - (ms / (24 * 3600 * 1000)));
}

function vendorTrust(ix, store, product) {
  var v = product.vendorId ? ix.vendors[product.vendorId] : null;
  var rating = v ? (ix.vendorRating[v.id] || 0) : 0;
  var count = v ? (ix.vendorReviewCount[v.id] || 0) : 0;
  var floor = floorScore(store, 'driverRatingFloor');
  if (count === 0) return { rating: 0, count: 0, demoted: false, floor: floor };
  if (rating < floor) return { rating: rating, count: count, demoted: true, floor: floor };
  return { rating: rating, count: count, demoted: false, floor: floor };
}

function rankProduct(store, ix, p, ctx) {
  var category = p.category || 'other';
  var trust = vendorTrust(ix, store, p);
  var productReviews = reviewsFor(store, 'productId', p.id);
  var productScore = productReviews.length ? scoreOf(productReviews) : num(p.rate, 0);

  var promoted = p.promoted ? 1 : 0;
  if (p.promotedUntil) {
    var until = Number(p.promotedUntil);
    if (until && until < ix.now) promoted = 0;
  }

  var inCategory = ix.vendorCategoryCount[p.vendorId + '|' + category] || 0;
  var totalProducts = p.vendorId ? (ix.vendorProducts[p.vendorId] || []).length : 0;
  var origin = originRank(p);
  var response = p.vendorId ? (ix.vendorResponse[p.vendorId] || 0) : 0;

  var score = 0;
  score += promoted * 100000;
  score += productScore * 1000;
  score += Math.log(1 + num(p.sold, 0)) * 400;
  score += trust.rating * 260;
  score += Math.log(1 + inCategory) * 120;
  score += Math.log(1 + totalProducts) * 70;
  score += (2 - origin) * 40;
  score += responseBoost(response) * RESPONSE_WEIGHT * 100;

  if (trust.demoted) score *= DEMOTE_FACTOR;
  if (num(p.stock, 0) <= 0) score *= 0.35;

  return {
    id: p.id,
    promoted: promoted,
    vendorRatingFloor: trust.floor,
    productScore: productScore,
    productReviewCount: productReviews.length,
    sales: num(p.sold, 0),
    vendorRating: trust.rating,
    vendorReviewCount: trust.count,
    vendorDemoted: trust.demoted,
    categoryProducts: inCategory,
    totalProducts: totalProducts,
    origin: listingOrigin(p),
    responseMs: response,
    score: Math.round(score * 1000) / 1000
  };
}

function compare(a, b) {
  var d = b.promoted - a.promoted;
  if (d) return d;
  d = b.productScore - a.productScore;
  if (d) return d;
  d = b.sales - a.sales;
  if (d) return d;
  d = b.vendorRating - a.vendorRating;
  if (d) return d;
  d = b.categoryProducts - a.categoryProducts;
  if (d) return d;
  d = b.totalProducts - a.totalProducts;
  if (d) return d;
  d = originRank({ listingOrigin: a.origin }) - originRank({ listingOrigin: b.origin });
  if (d) return d;
  var ar = a.responseMs ? 1 / (1 + a.responseMs / 60000) : 0;
  var br = b.responseMs ? 1 / (1 + b.responseMs / 60000) : 0;
  d = br - ar;
  if (d) return d;
  return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0);
}

function rank(store, products, opts) {
  opts = opts || {};
  var ix = buildIndex(store);
  var list = products || [];
  var scored = list.map(function (p) {
    var meta = rankProduct(store, ix, p, opts);
    meta.product = p;
    return meta;
  });
  scored.sort(compare);
  return { index: ix, scored: scored };
}

function rankByCategory(store, products, opts) {
  var r = rank(store, products, opts);
  var groups = {};
  r.scored.forEach(function (s) {
    var c = s.product.category || 'other';
    if (!groups[c]) groups[c] = [];
    groups[c].push(s);
  });
  return { index: r.index, groups: groups };
}

function vendorScore(store, vendorId) {
  var ix = buildIndex(store);
  var list = (ix.vendorProducts[vendorId] || []);
  var best = null;
  list.forEach(function (p) {
    var s = rankProduct(store, ix, p, {});
    if (!best || compare(s, best) < 0) best = s;
  });
  return {
    vendorId: vendorId,
    rating: ix.vendorRating[vendorId] || 0,
    reviewCount: ix.vendorReviewCount[vendorId] || 0,
    totalProducts: list.length,
    categoryProducts: list.reduce(function (n, p) { n[ p.category || 'other' ] = (n[ p.category || 'other' ] || 0) + 1; return n; }, {}),
    responseMs: ix.vendorResponse[vendorId] || 0,
    bestProductScore: best ? best.score : 0,
    score: best ? best.score : 0,
    demoted: list.length ? vendorTrust(ix, store, list[0]).demoted : false,
    floor: floorScore(store, 'driverRatingFloor')
  };
}

/*
 * Vendors the ranking is actively holding back, so the admin dashboard can
 * show who needs attention instead of only listing every seller.
 */
function flaggedVendors(store) {
  var ix = buildIndex(store);
  var out = [];
  (store.vendors || []).forEach(function (v) {
    var rating = ix.vendorRating[v.id] || 0;
    var count = ix.vendorReviewCount[v.id] || 0;
    var trust = vendorTrust(ix, store, { vendorId: v.id });
    var slow = ix.vendorResponse[v.id] || 0;
    var reasons = [];
    if (trust.demoted) reasons.push('review score ' + rating + ' is below the ' + trust.floor + ' floor');
    if (count >= 3 && rating < trust.floor + 1) reasons.push('reviews are close to the ' + trust.floor + ' floor');
    if (slow > 12 * 3600 * 1000) reasons.push('average response is over 12 hours');
    if (!reasons.length) return;
    out.push({
      vendorId: v.id,
      storeName: v.storeName || v.name || v.id,
      rating: rating,
      reviewCount: count,
      floor: trust.floor,
      demoted: trust.demoted,
      responseMs: slow,
      reasons: reasons
    });
  });
  return out.sort(function (a, b) { return (a.rating - b.rating) || (b.responseMs - a.responseMs); });
}

function reasonFor(meta) {
  if (meta.promoted) return 'Promoted listing';
  if (meta.vendorDemoted) return 'Vendor review score below ' + meta.vendorRatingFloor + ' floor';
  if (meta.origin === 'staff') return 'Staff listed';
  if (meta.origin === 'admin_placeholder') return 'Admin placeholder';
  return 'Organic';
}

function explain(store, product) {
  var r = rank(store, [product], {});
  var meta = r.scored[0];
  return {
    id: meta.id,
    score: meta.score,
    promoted: !!meta.promoted,
    productRating: meta.productScore,
    productReviewCount: meta.productReviewCount,
    sales: meta.sales,
    vendorRating: meta.vendorRating,
    vendorReviewCount: meta.vendorReviewCount,
    vendorDemoted: meta.vendorDemoted,
    productsInCategory: meta.categoryProducts,
    productsOverall: meta.totalProducts,
    listedBy: meta.origin,
    responseMinutes: meta.responseMs ? Math.round(meta.responseMs / 60000) : null,
    reason: reasonFor(meta)
  };
}

module.exports = {
  buildIndex: buildIndex,
  rankProduct: rankProduct,
  rank: rank,
  rankByCategory: rankByCategory,
  vendorScore: vendorScore,
  flaggedVendors: flaggedVendors,
  explain: explain,
  compare: compare,
  LOW_REVIEW_FLOOR: LOW_REVIEW_FLOOR,
  DEMOTE_FACTOR: DEMOTE_FACTOR
};
