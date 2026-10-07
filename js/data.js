var PRODUCTS = {
  flash: [
    { img:'prod-phone',   name:'iPhone 15 Pro Max 256GB',            price:7850000, old:8550000,  rate:4.7, sold:327,  pd:true,  loc:'Kampala' },
    { img:'prod-phone',   name:'Samsung Galaxy A54 8/256GB',         price:1699000, old:1899000,  rate:4.5, sold:2140, pd:true,  loc:'Kampala' },
    { img:'prod-phone',   name:'Tecno Phantom X2 5G 256GB',          price:2450000, old:2999000,  rate:4.4, sold:512,  pd:true,  loc:'Kampala' },
    { img:'prod-phone',   name:'Redmi Note 13 Pro 8/256GB',          price:1549000, old:1799000,  rate:4.5, sold:3888, pd:true,  loc:'Kampala' },
    { img:'prod-phone',   name:'itel A70 3/64GB',                    price:630000,  old:690000,   rate:4.2, sold:5420, pd:true,  loc:'Kampala' },
    { img:'prod-watch',   name:'Smart Watch Series 5 GPS',           price:380000,  old:520000,   rate:4.0, sold:891,  pd:true,  loc:'Kampala' },
    { img:'prod-phone',   name:'Infinix Hot 40i 4/128GB',            price:540000,  old:620000,   rate:4.3, sold:3210, pd:true,  loc:'Kampala' },
    { img:'prod-phone',   name:'iPhone 13 128GB',                    price:4850000, old:5300000,  rate:4.6, sold:760,  pd:true,  loc:'Kampala' }
  ],
  top: [
    { img:'prod-tv',      name:'Samsung 43&#34; Smart TV 4K UHD',     price:1290000, old:1590000, rate:4.4, sold:1205, pd:true,  loc:'Kampala' },
    { img:'prod-laptop',  name:'MacBook Air M1 8/256GB',             price:4750000, old:5400000, rate:4.8, sold:342,  pd:true,  loc:'Kampala' },
    { img:'prod-shoe',    name:'Men&#39;s Running Sneakers',          price:85000,   old:150000,  rate:4.1, sold:6890, pd:true,  loc:'Kampala' },
    { img:'prod-home',    name:'Official ShopOnlineUg Tote Bag',            price:45000,   old:90000,   rate:3.9, sold:12000,pd:true,  loc:'Kampala' },
    { img:'prod-audio',   name:'Wireless Bluetooth Earbuds Pro',     price:95000,   old:160000,  rate:4.2, sold:4320, pd:true,  loc:'Kampala' },
    { img:'prod-beauty',  name:'LED Ring Light 10&#34; with Tripod',  price:120000,  old:180000,  rate:4.5, sold:980,  pd:true,  loc:'Kampala' },
    { img:'prod-watch',   name:'Men&#39;s Classic Chrono Watch',      price:150000,  old:250000,  rate:4.3, sold:1120, pd:true,  loc:'Kampala' },
    { img:'prod-toy',     name:'PlayStation 5 Console Disc Edition', price:2850000, old:3300000, rate:4.8, sold:210,  pd:true,  loc:'Kampala' }
  ],
  super: [
    { img:'prod-grocery', name:'Super Rice 25kg (Basmati Mix)',      price:158000,  old:175000,  rate:4.6, sold:940,  pd:true,  loc:'Kampala' },
    { img:'prod-grocery', name:'Cooking Oil 5L Bottle',              price:62000,   old:68000,   rate:4.4, sold:2105, pd:true,  loc:'Kampala' },
    { img:'prod-grocery', name:'Sugar 50kg (Processed)',             price:265000,  old:285000,  rate:4.2, sold:630,  pd:true,  loc:'Kampala' },
    { img:'prod-home',    name:'Omo Washing Powder 2kg',             price:28000,   old:32000,   rate:4.5, sold:1880, pd:true,  loc:'Kampala' },
    { img:'prod-home',    name:'Toilet Paper 12 Pack',               price:16500,   old:20000,   rate:4.3, sold:754,  pd:true,  loc:'Kampala' },
    { img:'prod-grocery', name:'Fresh Long Grain Rice 10kg',         price:68000,   old:75000,   rate:4.4, sold:1110, pd:true,  loc:'Kampala' },
    { img:'prod-grocery', name:'Wheat Flour 5kg',                    price:28500,   old:31000,   rate:4.0, sold:842,  pd:true,  loc:'Kampala' },
    { img:'prod-home',    name:'Multipurpose Cleaner 1.5L',          price:29500,   old:36000,   rate:4.1, sold:420,  pd:true,  loc:'Kampala' }
  ],
  phones: [
    { img:'prod-phone',   name:'iPhone 14 128GB',                    price:4650000, old:5100000, rate:4.6, sold:540,  pd:true,  loc:'Kampala' },
    { img:'prod-phone',   name:'Samsung S23 FE 5G 8/256GB',          price:2350000, old:2690000, rate:4.5, sold:880,  pd:true,  loc:'Kampala' },
    { img:'prod-phone',   name:'Tecno Spark 20 Pro 8/256GB',         price:645000,  old:720000,  rate:4.3, sold:3010, pd:true,  loc:'Kampala' },
    { img:'prod-phone',   name:'Infinix Note 40 8/256GB',            price:760000,  old:850000,  rate:4.4, sold:1120, pd:true,  loc:'Kampala' },
    { img:'prod-phone',   name:'itel S24 4/128GB',                   price:420000,  old:470000,  rate:4.1, sold:610,  pd:true,  loc:'Kampala' },
    { img:'prod-phone',   name:'Google Pixel 8a 128GB',              price:3850000, old:4200000, rate:4.7, sold:190,  pd:true,  loc:'Kampala' },
    { img:'prod-phone',   name:'Redmi 12C 4/128GB',                  price:430000,  old:480000,  rate:4.2, sold:940,  pd:true,  loc:'Kampala' },
    { img:'prod-phone',   name:'OnePlus 12R 16/256GB',               price:3120000, old:3450000, rate:4.6, sold:260,  pd:true,  loc:'Kampala' }
  ],
  tv: [
    { img:'prod-tv',      name:'Hisense 55&#34; 4K Smart TV',         price:1850000, old:2150000, rate:4.5, sold:430,  pd:true,  loc:'Kampala' },
    { img:'prod-audio',   name:'JBL Charge 5 Bluetooth Speaker',     price:425000,  old:500000,  rate:4.7, sold:520,  pd:true,  loc:'Kampala' },
    { img:'prod-tv',      name:'LG 50&#34; UHD Smart TV',             price:1740000, old:1990000, rate:4.4, sold:310,  pd:true,  loc:'Kampala' },
    { img:'prod-audio',   name:'Sony WH-1000XM5 Noise Cancelling',   price:1350000, old:1600000, rate:4.8, sold:140,  pd:true,  loc:'Kampala' },
    { img:'prod-tv',      name:'Skyworth 32&#34; HD LED TV',          price:590000,  old:690000,  rate:4.2, sold:680,  pd:true,  loc:'Kampala' },
    { img:'prod-audio',   name:'Boom 2 Mini Soundbar',               price:210000,  old:260000,  rate:4.0, sold:350,  pd:true,  loc:'Kampala' },
    { img:'prod-tv',      name:'TCL 43&#34; FHD Smart TV',            price:820000,  old:950000,  rate:4.3, sold:290,  pd:true,  loc:'Kampala' },
    { img:'prod-audio',   name:'Wireless Karaoke Mic 2-in-1',        price:135000,  old:180000,  rate:4.1, sold:870,  pd:true,  loc:'Kampala' }
  ],
  fashion: [
    { img:'prod-fashion', name:'Women&#39;s Ankara Gown',             price:65000,   old:90000,   rate:4.3, sold:1230, pd:true,  loc:'Kampala' },
    { img:'prod-shoe',    name:'Nike Air Max Running Shoes',         price:350000,  old:450000,  rate:4.6, sold:480,  pd:true,  loc:'Kampala' },
    { img:'prod-fashion', name:'Men&#39;s Slim Fit Suit',             price:185000,  old:250000,  rate:4.4, sold:270,  pd:true,  loc:'Kampala' },
    { img:'prod-shoe',    name:'Official Leather Casual Shoes',      price:120000,  old:170000,  rate:4.2, sold:760,  pd:true,  loc:'Kampala' },
    { img:'prod-fashion', name:'Women&#39;s Maxi Dress',              price:55000,   old:75000,   rate:4.1, sold:980,  pd:true,  loc:'Kampala' },
    { img:'prod-home',    name:'Leather Handbag 2-in-1',             price:140000,  old:220000,  rate:4.3, sold:320,  pd:true,  loc:'Kampala' },
    { img:'prod-fashion', name:'Men&#39;s Polo T-Shirt (Pack of 3)',  price:75000,   old:100000,  rate:4.2, sold:2100, pd:true,  loc:'Kampala' },
    { img:'prod-shoe',    name:'Slip-On Office Shoes',               price:68000,   old:90000,   rate:4.0, sold:640,  pd:true,  loc:'Kampala' }
  ],
  beauty: [
    { img:'prod-beauty',  name:'CeraVe Moisturising Cream 454g',     price:115000,  old:140000,  rate:4.6, sold:420,  pd:true,  loc:'Kampala' },
    { img:'prod-beauty',  name:'Herbal Hair Grow Oil 250ml',         price:45000,   old:65000,   rate:4.2, sold:1130, pd:true,  loc:'Kampala' },
    { img:'prod-beauty',  name:'Perfume 100ml (Oud Collection)',     price:95000,   old:140000,  rate:4.4, sold:670,  pd:true,  loc:'Kampala' },
    { img:'prod-watch',   name:'Unisex Fashion Analog Watch',        price:55000,   old:85000,   rate:4.0, sold:540,  pd:true,  loc:'Kampala' },
    { img:'prod-beauty',  name:'Vitamin C Serum 30ml',               price:65000,   old:90000,   rate:4.3, sold:390,  pd:true,  loc:'Kampala' },
    { img:'prod-beauty',  name:'Curly Hair Leave-In Conditioner',    price:38000,   old:52000,   rate:4.1, sold:280,  pd:true,  loc:'Kampala' },
    { img:'prod-beauty',  name:'Complete Makeup Kit 120pcs',         price:145000,  old:210000,  rate:4.2, sold:210,  pd:true,  loc:'Kampala' },
    { img:'prod-baby',    name:'Gentle Baby Body Wash 400ml',        price:28000,   old:36000,   rate:4.5, sold:460,  pd:true,  loc:'Kampala' }
  ],
  toys: [
    { img:'prod-toy',     name:'Remote Control Car 4x4',             price:85000,   old:130000,  rate:4.2, sold:430,  pd:true,  loc:'Kampala' },
    { img:'prod-baby',    name:'Baby Stroller 3-in-1',               price:520000,  old:640000,  rate:4.5, sold:120,  pd:true,  loc:'Kampala' },
    { img:'prod-toy',     name:'Star Building Blocks 1000pcs',       price:95000,   old:140000,  rate:4.4, sold:260,  pd:true,  loc:'Kampala' },
    { img:'prod-baby',    name:'Baby Car Seat (0-4yrs)',             price:285000,  old:340000,  rate:4.3, sold:95,   pd:true,  loc:'Kampala' },
    { img:'prod-toy',     name:'Educational Tablet for Kids',        price:65000,   old:90000,   rate:4.1, sold:380,  pd:true,  loc:'Kampala' },
    { img:'prod-baby',    name:'Baby Walker &amp; Music Toy',        price:125000,  old:170000,  rate:4.2, sold:180,  pd:true,  loc:'Kampala' },
    { img:'prod-toy',     name:'Wooden Train Set Deluxe',            price:110000,  old:155000,  rate:4.5, sold:150,  pd:true,  loc:'Kampala' },
    { img:'prod-toy',     name:'Bow &amp; Arrow Set for Kids',       price:48000,   old:65000,   rate:3.9, sold:210,  pd:true,  loc:'Kampala' }
  ]
};

var CATEGORIES = [
  { img:'cat-boys-clothing', label:'Boys Clothing',        ic:0x1F455, g1:'#2563EB', g2:'#1E40AF' },
  { img:'cat-womens-fashion',label:'Women&#39;s Fashion',  ic:0x1F457, g1:'#DB2777', g2:'#9D174D' },
  { img:'cat-mens-fashion',  label:'Men&#39;s Fashion',    ic:0x1F9E5, g1:'#0F766E', g2:'#115E59' },
  { img:'cat-mobile-acc',    label:'Mobile Accessories',   ic:0x1F4F1, g1:'#0284C7', g2:'#075985' },
  { img:'cat-auto-acc',      label:'Auto Accessories',     ic:0x1F697, g1:'#F59E0B', g2:'#B45309' },
  { img:'cat-casual-shoes',  label:'Casual Shoes',         ic:0x1F45F, g1:'#64748B', g2:'#334155' },
  { img:'cat-home-decor',    label:'Home Decor',           ic:0x1F6CB, g1:'#F97316', g2:'#C2410C' },
  { img:'cat-handbags',      label:'Handbags',             ic:0x1F45C, g1:'#A855F7', g2:'#6D28D9' },
  { img:'cat-hair-care',     label:'Hair Care',            ic:0x1F487, g1:'#EC4899', g2:'#BE185D' },
  { img:'cat-toys',          label:'Toys',                 ic:0x1F9F8, g1:'#F43F5E', g2:'#BE123C' },
  { img:'cat-computer-acc',  label:'Computer Accessories', ic:0x1F4BB, g1:'#3B82F6', g2:'#1D4ED8' },
  { img:'cat-fashion-acc',   label:'Fashion Accessories',  ic:0x1F576, g1:'#14B8A6', g2:'#0D9488' }
];

var BRANDS = [
  { img:'brand-samsung', name:'Samsung' },
  { img:'brand-apple',   name:'Apple' },
  { img:'brand-tecno',   name:'Tecno' },
  { img:'brand-infinix', name:'Infinix' },
  { img:'brand-xiaomi',  name:'Xiaomi' },
  { img:'brand-itel',    name:'itel' },
  { img:'brand-hisense', name:'Hisense' },
  { img:'brand-nike',    name:'Nike' }
];

var LOCATIONS = ['Kampala','Entebbe','Wakiso','Mukono','Jinja','Gulu','Mbarara','Masaka','Arua','Fort Portal','Mbale','Lira','Soroti','Kabale','Hoima','Njeru'];

var BRAND_OF = [
  ['iPhone','Apple'],['Apple','Apple'],['MacBook','Apple'],
  ['Samsung','Samsung'],['Galaxy','Samsung'],
  ['Tecno','Tecno'],['Infinix','Infinix'],
  ['Redmi','Xiaomi'],['Xiaomi','Xiaomi'],['OnePlus','OnePlus'],
  ['ixel','Google'],['itel','itel'],['Hisense','Hisense'],
  ['LG','LG'],['Sony','Sony'],['JBL','JBL'],['TCL','TCL'],['Skyworth','Skyworth'],
  ['Nike','Nike'],['PlayStation','Sony']
];

var SECTION_TITLE = {
  flash:'Flash Sales',
  top:'Top Selling Items',
  super:'Supermarket',
  phones:'Best Selling Smartphones',
  tv:'TV & Electronics',
  fashion:'Fashion & Shoes',
  beauty:'Health & Beauty',
  toys:'Toys & Kids',
  home:'Home & Office',
  computing:'Computing',
  sport:'Sporting Goods',
  games:'Games & Consoles',
  vendor:'Vendor Marketplace',
  other:'Other Categories'
};

var CAT_ROUTE = {
  'cat-boys-clothing':'fashion',
  'cat-mens-fashion':'fashion',
  'cat-womens-fashion':'fashion',
  'cat-mobile-acc':'phones',
  'cat-auto-acc':'other',
  'cat-casual-shoes':'fashion',
  'cat-home-decor':'home',
  'cat-handbags':'fashion',
  'cat-hair-care':'beauty',
  'cat-toys':'toys',
  'cat-computer-acc':'computing',
  'cat-fashion-acc':'fashion'
};

var DETAILS = {
  'iPhone 15 Pro Max 256GB': {
    brand:'Apple', seller:'ShopOnlineUg Tech Store', warranty:'1 year warranty',
    desc:'The iPhone 15 Pro Max features a strong and lightweight titanium design, the powerful A17 Pro chip and a pro camera system with 5x telephoto zoom. It delivers console-level gaming, all-day battery life and the Dynamic Island experience.',
    feat:['6.7-inch Super Retina XDR display with ProMotion','A17 Pro chip with 6-core GPU','48MP main camera with 5x telephoto','USB-C with USB 3 speeds','Ceramic Shield front, titanium frame','Face ID and IP68 water resistance','Up to 29 hours video playback','Dual SIM (nano + eSIM)']
  },
  'Samsung 43&#34; Smart TV 4K UHD': {
    brand:'Samsung', seller:'ShopOnlineUg Electronics', warranty:'2 years warranty',
    desc:'Bring cinema home with this Samsung 43-inch 4K UHD Smart TV. Crystal Processor 4K upscales everything you watch, while the Tizen smart hub gives you instant access to your favourite streaming apps and a world of entertainment.',
    feat:['43-inch 4K UHD (3840 x 2160) display','Crystal Processor 4K upscaling','Smart TV powered by Tizen','HDR10+ and PurColor','3 HDMI ports and 2 USB ports','Built-in Wi-Fi and Bluetooth','Voice assistant support','Slim design with full HD impact']
  },
  'MacBook Air M1 8/256GB': {
    brand:'Apple', seller:'ShopOnlineUg Tech Store', warranty:'1 year warranty',
    desc:'The Apple M1 chip gives the MacBook Air incredible speed and power. With up to 18 hours of battery life, a stunning Retina display and a fanless, silent design, it is the perfect laptop for work, study and creativity.',
    feat:['Apple M1 chip with 8-core CPU','8GB unified memory, 256GB SSD','13.3-inch Retina display','Up to 18 hours battery life','Fanless silent design','Touch ID and Magic Keyboard','Two Thunderbolt / USB 4 ports','Lightweight 1.29kg']
  }
};

function productId(key, i) {
  return key + '-' + i;
}

function brandFor(name) {
  for (var i = 0; i < BRAND_OF.length; i++) {
    if (name.indexOf(BRAND_OF[i][0]) !== -1) return BRAND_OF[i][1];
  }
  return 'ShopOnlineUg';
}

function buildCatalog() {
  var list = [];
  Object.keys(PRODUCTS).forEach(function (key) {
    PRODUCTS[key].forEach(function (p, i) {
      list.push({
        id: productId(key, i),
        key: key,
        brand: brandFor(p.name),
        img: p.img,
        name: p.name,
        price: p.price,
        old: p.old,
        rate: p.rate,
        sold: p.sold,
        loc: p.loc
      });
    });
  });
  return list;
}