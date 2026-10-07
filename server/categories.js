'use strict';

const BOOK_GENRES = [
  'Fiction', 'Romance', 'Mystery & Thriller', 'Fantasy', 'Science Fiction', 'Historical Fiction',
  'Biography & Autobiography', 'Poetry', 'Drama', 'Children\'s', 'Young Adult', 'Graphic Novel',
  'Academic & Textbooks', 'Education', 'Business & Finance', 'Self Help', 'Health & Fitness',
  'Cookery & Food', 'Religion & Spirituality', 'Politics & Government', 'Law & Legal',
  'Medicine & Nursing', 'Engineering & Technology', 'Agriculture', 'Reference & Dictionaries'
];

const BOOK_LEVELS = [
  'Primary', 'Secondary (Ordinary Level)', 'Secondary (Advanced Level)', 'Higher Education'
];

const BOOK_CONDITIONS = ['New', 'Used'];

const CAMERA_TYPES = ['Photography and Video Cameras', 'CCTV Cameras'];

const ATTRIBUTES = {
  books: [
    { key: 'genre', label: 'Genre', type: 'combo', options: BOOK_GENRES, allowCustom: true, required: true, placeholder: 'Select or type your own genre' },
    { key: 'pages', label: 'Number of Pages', type: 'number', min: 1, max: 20000, required: true },
    { key: 'condition', label: 'Condition', type: 'select', options: BOOK_CONDITIONS, required: true },
    {
      key: 'level', label: 'Academic Level', type: 'select', options: BOOK_LEVELS, required: false,
      hint: 'Required for academic books.'
    }
  ],
  cameras: [
    { key: 'cameraType', label: 'Camera Type', type: 'select', options: CAMERA_TYPES, required: true }
  ],
  gaming: [
    { key: 'platform', label: 'Platform', type: 'select', options: ['Mobile', 'PC', 'PlayStation', 'Xbox', 'Nintendo', 'Retro / Console'], required: false },
    { key: 'gameGenre', label: 'Game Genre', type: 'combo', options: ['Action', 'Adventure', 'Racing', 'Sports', 'Strategy', 'Shooter', 'Puzzle', 'Fighting', 'Role Playing', 'Simulation', 'Sports & Racing'], allowCustom: true, required: false }
  ],
  kitchen: [
    { key: 'powerSource', label: 'Power Source', type: 'select', options: ['Electric', 'Gas', 'Manual', 'Battery', 'Solar'], required: false },
    { key: 'warrantyMonths', label: 'Warranty (months)', type: 'number', min: 0, max: 120, required: false }
  ],
  appliances: [
    { key: 'powerSource', label: 'Power Source', type: 'select', options: ['Electric', 'Gas', 'Manual', 'Battery', 'Solar'], required: false },
    { key: 'warrantyMonths', label: 'Warranty (months)', type: 'number', min: 0, max: 120, required: false }
  ],
  furniture: [
    { key: 'material', label: 'Material', type: 'combo', options: ['Wood', 'Metal', 'Plastic', 'Fabric', 'Leather', 'Glass', 'Rattan', 'Stone'], allowCustom: true, required: false },
    { key: 'assemblyRequired', label: 'Assembly Required', type: 'select', options: ['Yes', 'No'], required: false }
  ],
  'car-accessories': [
    { key: 'vehicleFit', label: 'Fits Vehicle', type: 'combo', options: ['Universal', 'Toyota', 'Nissan', 'Mazda', 'Isuzu', 'Mitsubishi', 'Subaru', 'Honda', 'Kia', 'Hyundai', 'Land Cruiser'], allowCustom: true, required: false }
  ]
};

const LIST = [
  { key: 'flash', label: 'Flash Sales', group: 'deals', img: 'prod-phone' },
  { key: 'top', label: 'Top Selling', group: 'deals', img: 'prod-laptop' },
  { key: 'super', label: 'Supermarket', group: 'daily', img: 'prod-grocery' },
  { key: 'phones', label: 'Smartphones', group: 'electronics', img: 'prod-phone' },
  { key: 'tv', label: 'TV & Electronics', group: 'electronics', img: 'prod-tv' },
  { key: 'appliances', label: 'Appliances', group: 'home', img: 'prod-home' },
  { key: 'kitchen', label: 'Kitchen Appliances', group: 'home', img: 'prod-home' },
  { key: 'furniture', label: 'Furniture', group: 'home', img: 'prod-home' },
  { key: 'books', label: 'Books', group: 'education', img: 'prod-home' },
  { key: 'gaming', label: 'Gaming and Video Games', group: 'electronics', img: 'prod-toy' },
  { key: 'cameras', label: 'Cameras', group: 'electronics', img: 'prod-audio' },
  { key: 'car-accessories', label: 'Car Accessories', group: 'auto', img: 'cat-auto-acc' },
  { key: 'fashion', label: 'Fashion & Shoes', group: 'lifestyle', img: 'prod-fashion' },
  { key: 'beauty', label: 'Health & Beauty', group: 'lifestyle', img: 'prod-beauty' },
  { key: 'toys', label: 'Toys & Kids', group: 'lifestyle', img: 'prod-toy' },
  { key: 'other', label: 'Other', group: 'other', img: 'prod-home' }
];

const GROUPS = [
  { key: 'deals', label: 'Deals' },
  { key: 'electronics', label: 'Electronics' },
  { key: 'home', label: 'Home & Living' },
  { key: 'education', label: 'Books & Education' },
  { key: 'auto', label: 'Automotive' },
  { key: 'daily', label: 'Supermarket' },
  { key: 'lifestyle', label: 'Fashion, Beauty & Kids' },
  { key: 'other', label: 'Other' }
];

const VEHICLE_TYPES = ['Car', 'Motorcycle / Bodabonda', 'Tricycle / Tuk-Tuk'];

const DELIVERY_STATUSES = [
  { key: 'approved', label: 'Item approved' },
  { key: 'assigned', label: 'Driver assigned' },
  { key: 'picked', label: 'Item picked up' },
  { key: 'transit', label: 'Item in transit' },
  { key: 'arrived', label: 'Arrived at destination' },
  { key: 'delivered', label: 'Item delivered' },
  { key: 'cancelled', label: 'Cancelled' }
];

const DELIVERY_STATUS_KEYS = DELIVERY_STATUSES.map(function (s) { return s.key; });

const DRIVER_STAGES = ['applied', 'records', 'review', 'approved', 'rejected', 'suspended'];

function keys() { return LIST.map(function (c) { return c.key; }); }

function find(key) {
  var k = String(key || '').trim().toLowerCase();
  for (var i = 0; i < LIST.length; i++) if (LIST[i].key === k) return LIST[i];
  return null;
}

function label(key) {
  var c = find(key);
  return c ? c.label : 'Other';
}

function attributesFor(key) {
  var c = find(key);
  return c && ATTRIBUTES[c.key] ? ATTRIBUTES[c.key] : [];
}

function hasAttributes(key) { return attributesFor(key).length > 0; }

/*
 * Filters a product list by the attribute fields a category declares. Only
 * attributes actually present on the query string are applied, so
 * /api/products?category=books&genre=Fiction narrows by genre while
 * /api/products?category=books returns the whole category.
 */
function filterByAttributes(list, key, query) {
  var attrs = attributesFor(key);
  var q = query || {};
  var filters = attrs.filter(function (a) {
    var v = q[a.key];
    return v != null && String(v).trim() !== '';
  });
  if (!filters.length) return list;

  return (list || []).filter(function (p) {
    var have = p.attributes || {};
    return filters.every(function (a) {
      var want = String(q[a.key]).trim().toLowerCase();
      var got = have[a.key];
      if (got == null || got === '') return false;
      if (a.type === 'number') return Number(got) === Number(want);
      return String(got).trim().toLowerCase() === want;
    });
  });
}

function publicList() {
  return LIST.map(function (c) {
    var out = { key: c.key, label: c.label, group: c.group, img: c.img };
    var attrs = attributesFor(c.key);
    if (attrs.length) out.attributes = attrs;
    if (c.key === 'cameras') out.subcategories = CAMERA_TYPES.slice();
    return out;
  });
}

function validateAttributes(key, input) {
  var attrs = attributesFor(key);
  var errors = [];
  var out = {};
  if (!attrs.length) return { errors: errors, values: {} };
  var src = input && typeof input === 'object' ? input : {};
  attrs.forEach(function (a) {
    var raw = src[a.key];
    var val = raw == null ? '' : String(raw).trim();
    if (!val) {
      if (a.required) errors.push(a.label + ' is required.');
      return;
    }
    if (a.type === 'number') {
      var n = Number(val);
      if (!isFinite(n)) { errors.push(a.label + ' must be a number.'); return; }
      if (a.min != null && n < a.min) { errors.push(a.label + ' must be at least ' + a.min + '.'); return; }
      if (a.max != null && n > a.max) { errors.push(a.label + ' must be ' + a.max + ' or less.'); return; }
      out[a.key] = Math.round(n);
      return;
    }
    if (a.type === 'select' && a.options.indexOf(val) === -1) {
      errors.push(a.label + ' must be one of: ' + a.options.join(', ') + '.');
      return;
    }
    if (a.type === 'combo') {
      var match = a.options.filter(function (o) { return o.toLowerCase() === val.toLowerCase(); })[0];
      if (!match && !a.allowCustom) { errors.push(a.label + ' is not a recognised option.'); return; }
      out[a.key] = match || val.slice(0, 60);
      return;
    }
    out[a.key] = val.slice(0, 60);
  });
  return { errors: errors, values: out };
}

module.exports = {
  LIST: LIST,
  GROUPS: GROUPS,
  ATTRIBUTES: ATTRIBUTES,
  BOOK_GENRES: BOOK_GENRES,
  BOOK_LEVELS: BOOK_LEVELS,
  BOOK_CONDITIONS: BOOK_CONDITIONS,
  CAMERA_TYPES: CAMERA_TYPES,
  VEHICLE_TYPES: VEHICLE_TYPES,
  DELIVERY_STATUSES: DELIVERY_STATUSES,
  DELIVERY_STATUS_KEYS: DELIVERY_STATUS_KEYS,
  DRIVER_STAGES: DRIVER_STAGES,
  keys: keys,
  find: find,
  label: label,
  attributesFor: attributesFor,
  hasAttributes: hasAttributes,
  filterByAttributes: filterByAttributes,
  publicList: publicList,
  validateAttributes: validateAttributes
};
