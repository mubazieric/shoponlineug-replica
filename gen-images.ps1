$ErrorActionPreference = 'Stop'
$out = Join-Path $PSScriptRoot 'img'
if (!(Test-Path -LiteralPath $out)) { New-Item -ItemType Directory -Path $out | Out-Null }

function New-SvgFile([string]$name, [string]$svg) {
    $path = Join-Path $out "$name.svg"
    [System.IO.File]::WriteAllText($path, $svg, (New-Object System.Text.UTF8Encoding($false)))
    Write-Host "generated $name.svg"
}

function Get-Emo([int]$cp) {
    [System.Char]::ConvertFromUtf32($cp)
}

function New-Hero([string]$name, [string]$c1, [string]$c2, [string]$tag, [string]$title, [string]$sub, [string]$cta, [int]$cp, [string]$badge) {
    $emo = Get-Emo $cp
    $svg = @"
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="300" viewBox="0 0 640 300">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="$c1"/>
      <stop offset="1" stop-color="$c2"/>
    </linearGradient>
  </defs>
  <rect width="640" height="300" fill="url(#g)"/>
  <path d="M0 238 L640 150 L640 300 L0 300 Z" fill="#ffffff" opacity="0.05"/>
  <circle cx="560" cy="-60" r="160" fill="#ffffff" opacity="0.08"/>
  <circle cx="-30" cy="270" r="120" fill="#ffffff" opacity="0.07"/>
  <circle cx="120" cy="40" r="6" fill="#ffffff" opacity="0.5"/>
  <circle cx="172" cy="22" r="4" fill="#ffffff" opacity="0.45"/>
  <circle cx="64" cy="14" r="3" fill="#ffffff" opacity="0.4"/>
  <rect x="52" y="34" width="124" height="26" rx="13" fill="#ffffff" opacity="0.18"/>
  <text x="114" y="51" font-family="Ubuntu, Arial, sans-serif" font-size="12" font-weight="700" fill="#ffffff" letter-spacing="1.6" text-anchor="middle">$tag</text>
  <text x="52" y="124" font-family="Ubuntu, Arial, sans-serif" font-size="34" font-weight="700" fill="#ffffff">$title</text>
  <text x="52" y="158" font-family="Ubuntu, Arial, sans-serif" font-size="16" font-weight="500" fill="#ffffff" opacity="0.95">$sub</text>
  <rect x="52" y="186" width="154" height="38" rx="19" fill="#ffffff"/>
  <text x="129" y="211" font-family="Ubuntu, Arial, sans-serif" font-size="15" font-weight="700" fill="$c1" text-anchor="middle">$cta &#8594;</text>
  <g>
    <rect x="408" y="46" width="200" height="208" rx="22" fill="#ffffff" opacity="0.95"/>
    <text x="508" y="168" font-size="150" text-anchor="middle" dominant-baseline="central">$emo</text>
  </g>
  <circle cx="592" cy="52" r="32" fill="#FFD952"/>
  <text x="592" y="43" font-family="Ubuntu, Arial, sans-serif" font-size="12" font-weight="900" fill="#8E1230" text-anchor="middle">$($badge.Split(' ')[0])</text>
  <text x="592" y="59" font-family="Ubuntu, Arial, sans-serif" font-size="12" font-weight="900" fill="#8E1230" text-anchor="middle">$($badge.Split(' ')[1])</text>
</svg>
"@
    New-SvgFile $name $svg
}

New-Hero 'hero-1' '#2563EB' '#1D4ED8' 'LIMITED TIME' 'Black Friday 2026' "Don't just bring the holidays home" 'Shop Now' 0x1F6CD '60% OFF' | Out-Null
New-Hero 'hero-2' '#BE1D3E' '#8E1230' 'HOT DEALS' 'Flash Sales' 'New deals drop every day at midnight' 'Grab Deals' 0x26A1 '80% OFF' | Out-Null
New-Hero 'hero-3' '#0B7A75' '#065855' 'TECH SALE' 'Electronics Week' 'Up to 60% off TVs, phones and audio' 'Shop Tech' 0x1F4FA '50% OFF' | Out-Null
New-Hero 'hero-4' '#6C3FA0' '#4E2B7A' 'STYLE SALE' 'Fashion Week' 'Premium looks. Everyday prices.' 'Shop Styles' 0x1F45F '40% OFF' | Out-Null
New-Hero 'hero-5' '#3F9C3F' '#2E7A2E' 'EVERYDAY SAVINGS' 'Supermarket Deals' 'Fresh groceries delivered to your door' 'Browse All' 0x1F34E '25% OFF' | Out-Null

function New-PromoCard([string]$name, [string]$c1, [string]$c2, [string]$title, [string]$sub, [string]$cta, [int]$cp) {
    $emo = Get-Emo $cp
    $svg = @"
<svg xmlns="http://www.w3.org/2000/svg" width="620" height="250" viewBox="0 0 620 250">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="$c1"/>
      <stop offset="1" stop-color="$c2"/>
    </linearGradient>
  </defs>
  <rect width="620" height="250" fill="url(#g)"/>
  <path d="M0 196 L620 120 L620 250 L0 250 Z" fill="#ffffff" opacity="0.05"/>
  <circle cx="500" cy="-20" r="110" fill="#ffffff" opacity="0.10"/>
  <circle cx="60" cy="260" r="90" fill="#ffffff" opacity="0.10"/>
  <text x="40" y="94" font-family="Ubuntu, Arial, sans-serif" font-size="30" font-weight="700" fill="#ffffff">$title</text>
  <text x="40" y="128" font-family="Ubuntu, Arial, sans-serif" font-size="17" font-weight="500" fill="#ffffff" opacity="0.95">$sub</text>
  <g>
    <circle cx="462" cy="70" r="86" fill="#ffffff" opacity="0.16"/>
    <text x="462" y="116" font-size="110" text-anchor="middle" dominant-baseline="central">$emo</text>
  </g>
  <rect x="40" y="166" width="128" height="34" rx="17" fill="#ffffff"/>
  <text x="104" y="188" font-family="Ubuntu, Arial, sans-serif" font-size="14" font-weight="700" fill="$c1" text-anchor="middle">$cta &#8594;</text>
</svg>
"@
    New-SvgFile $name $svg
}

New-PromoCard 'promo-prime' '#313133' '#151518' 'ShopOnlineUg Prime' 'Unlimited free delivery. 15K UGX' 'Join Prime' 0x1F69A | Out-Null
New-PromoCard 'promo-payday' '#2563EB' '#1D4ED8' 'Payday Deals' 'Big discounts every payday' 'See Deals' 0x1F4B0 | Out-Null
New-PromoCard 'promo-returns' '#0B7A75' '#065855' 'Free Returning' 'Fast and easy product returns' 'Learn More' 0x1F504 | Out-Null

# ---------------- Category tiles (200 x 200) ----------------
function New-CatTile([string]$name, [string]$label, [int]$cp, [int]$r, [int]$g, [int]$b) {
    $emo = Get-Emo $cp
    $svg = @"
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
  <rect width="200" height="200" fill="#FFFFFF"/>
  <rect x="14" y="14" width="172" height="172" rx="24" fill="rgb($r,$g,$b)" opacity="0.10"/>
  <circle cx="100" cy="88" r="52" fill="rgb($r,$g,$b)" opacity="0.14"/>
  <text x="100" y="92" font-size="58" text-anchor="middle" dominant-baseline="central">$emo</text>
  <text x="100" y="168" font-family="Ubuntu, Arial, sans-serif" font-size="22" font-weight="500" fill="#313133" text-anchor="middle">$label</text>
</svg>
"@
    New-SvgFile $name $svg
}

New-CatTile 'cat-boys-clothing' 'Boys Clothing'  0x1F455 240 139 30  | Out-Null
New-CatTile 'cat-mens-fashion'  'Men&apos;s Fashion' 0x1F9E5 94 121 196  | Out-Null
New-CatTile 'cat-womens-fashion' 'Women&apos;s Fashion' 0x1F457 214 78 108 | Out-Null
New-CatTile 'cat-mobile-acc'    'Mobile Accessories' 0x1F4F1 71 178 94  | Out-Null
New-CatTile 'cat-auto-acc'      'Auto Accessories'   0x1F697 30 144 255 | Out-Null
New-CatTile 'cat-casual-shoes'  'Casual Shoes'       0x1F45F 146 103 62  | Out-Null
New-CatTile 'cat-home-decor'    'Home &amp; Decor'  0x1F6CB 233 124 43  | Out-Null
New-CatTile 'cat-handbags'      'Handbags'           0x1F45C 150 66 66  | Out-Null
New-CatTile 'cat-hair-care'     'Hair Care'          0x1F487 190 58 172  | Out-Null
New-CatTile 'cat-toys'          'Toys &amp; Games'  0x1F9F8 224 79 79  | Out-Null
New-CatTile 'cat-computer-acc'  'Computer Accessories' 0x1F4BB 60 106 190 | Out-Null
New-CatTile 'cat-fashion-acc'   'Fashion Accessories'   0x1F576 84 84 84  | Out-Null

# ---------------- Product images (400 x 400) ----------------
function New-Product([string]$name, [int]$cp, [string]$c) {
    $emo = Get-Emo $cp
    $accent = '#F2F2F2'
    $svg = @"
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <rect width="400" height="400" fill="$accent"/>
  <circle cx="60" cy="310" r="120" fill="$c" opacity="0.10"/>
  <circle cx="350" cy="60" r="100" fill="$c" opacity="0.12"/>
  <text x="200" y="210" font-size="150" text-anchor="middle" dominant-baseline="central">$emo</text>
</svg>
"@
    New-SvgFile $name $svg
}

New-Product 'prod-phone'    0x1F4F1 '#FFB36B' | Out-Null
New-Product 'prod-tv'       0x1F4FA '#FF9D9D' | Out-Null
New-Product 'prod-laptop'   0x1F4BB '#A9C1F5' | Out-Null
New-Product 'prod-audio'    0x1F3A7 '#C4B0F5' | Out-Null
New-Product 'prod-watch'    0x231A '#F5D29A' | Out-Null
New-Product 'prod-shoe'     0x1F45F '#D8C4A8' | Out-Null
New-Product 'prod-fashion'  0x1F9E5 '#F5A8C4' | Out-Null
New-Product 'prod-beauty'   0x1F484 '#F5CFA0' | Out-Null
New-Product 'prod-home'     0x1F6CB '#A9EBDF' | Out-Null
New-Product 'prod-toy'      0x1F9F8 '#F5C0AF' | Out-Null
New-Product 'prod-grocery'  0x1F34F '#C6E8A8' | Out-Null
New-Product 'prod-baby'     0x1F37C '#C1D9F5' | Out-Null

# ---------------- Brand logos (240 x 140) ----------------
function New-Brand([string]$name, [string]$text, [string]$color) {
    $svg = @"
<svg xmlns="http://www.w3.org/2000/svg" width="240" height="140" viewBox="0 0 240 140">
  <rect width="240" height="140" fill="#FFFFFF"/>
  <text x="120" y="78" font-family="Ubuntu, Arial, sans-serif" font-size="30" font-weight="700" fill="$color" text-anchor="middle" dominant-baseline="central">$text</text>
</svg>
"@
    New-SvgFile $name $svg
}

New-Brand 'brand-samsung'  'SAMSUNG' '#1428A0' | Out-Null
New-Brand 'brand-apple'    'Apple'   '#333333' | Out-Null
New-Brand 'brand-tecno'    'TECNO'   '#B61E4B' | Out-Null
New-Brand 'brand-infinix'  'Infinix' '#163D92' | Out-Null
New-Brand 'brand-xiaomi'   'Xiaomi'  '#FF6900' | Out-Null
New-Brand 'brand-itel'     'itel'    '#DC0A2D' | Out-Null
New-Brand 'brand-hisense'  'Hisense' '#00A3E0' | Out-Null
New-Brand 'brand-nike'     'NIKE'    '#111111' | Out-Null

# ---------------- section banner tiles (400 x 200) ----------------
function New-CTA([string]$name, [string]$c1, [string]$c2, [string]$title, [string]$sub, [string]$cta, [int]$cp) {
    $emo = Get-Emo $cp
    $svg = @"
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="$c1"/>
      <stop offset="1" stop-color="$c2"/>
    </linearGradient>
  </defs>
  <rect width="400" height="200" fill="url(#g)"/>
  <path d="M0 158 L400 110 L400 200 L0 200 Z" fill="#ffffff" opacity="0.05"/>
  <circle cx="340" cy="10" r="80" fill="#ffffff" opacity="0.10"/>
  <circle cx="30" cy="200" r="70" fill="#ffffff" opacity="0.10"/>
  <text x="28" y="70" font-family="Ubuntu, Arial, sans-serif" font-size="24" font-weight="700" fill="#ffffff">$title</text>
  <text x="28" y="100" font-family="Ubuntu, Arial, sans-serif" font-size="15" font-weight="500" fill="#ffffff" opacity="0.95">$sub</text>
  <g>
    <circle cx="322" cy="68" r="52" fill="#ffffff" opacity="0.18"/>
    <text x="322" y="88" font-size="68" text-anchor="middle" dominant-baseline="central">$emo</text>
  </g>
  <rect x="28" y="136" width="104" height="30" rx="15" fill="#ffffff"/>
  <text x="80" y="157" font-family="Ubuntu, Arial, sans-serif" font-size="13" font-weight="700" fill="$c1" text-anchor="middle">$cta &#8594;</text>
</svg>
"@
    New-SvgFile $name $svg
}

New-CTA 'cta-1' '#BE1D3E' '#8E1230' 'Unlock Big Savings' 'Bundle deals up to 50% off' 'Shop' 0x1F6CD | Out-Null
New-CTA 'cta-2' '#2563EB' '#1D4ED8' 'Office Week' 'Desks, chairs and more' 'Shop' 0x1F4BC | Out-Null
New-CTA 'cta-3' '#0B7A75' '#065855' 'Fresh Groceries' 'Order today, pay on delivery' 'Shop' 0x1F9FA | Out-Null
New-CTA 'cta-4' '#6C3FA0' '#4E2B7A' 'Beauty Haul' 'Up to 40% off skincare' 'Shop' 0x1F484 | Out-Null

function New-PromoBox([string]$name) {
    $svg = @"
<svg xmlns="http://www.w3.org/2000/svg" width="280" height="150" viewBox="0 0 280 150">
  <rect x="4" y="4" width="272" height="142" rx="18" fill="#ffffff" opacity="0.96"/>
  <rect x="16" y="18" width="64" height="22" rx="11" fill="#BE1D3E"/>
  <text x="48" y="33" font-family="Ubuntu, Arial, sans-serif" font-size="12" font-weight="700" fill="#ffffff" text-anchor="middle">FREE</text>
  <text x="16" y="72" font-family="Ubuntu, Arial, sans-serif" font-size="20" font-weight="700" fill="#1D4ED8">Free Delivery</text>
  <text x="16" y="96" font-family="Ubuntu, Arial, sans-serif" font-size="13" fill="#5a6070">on orders over 200K</text>
  <text x="226" y="86" font-size="72" text-anchor="middle" dominant-baseline="central">&#128663;</text>
</svg>
"@
    New-SvgFile $name $svg
}

New-PromoBox 'promo-box' | Out-Null

function New-WideBanner([string]$name, [string]$c1, [string]$c2, [string]$title, [string]$sub, [string]$cta, [int]$cp) {
    $emo = Get-Emo $cp
    $svg = @"
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="120" viewBox="0 0 1200 120">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="$c1"/>
      <stop offset="1" stop-color="$c2"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="120" fill="url(#g)"/>
  <circle cx="80" cy="60" r="70" fill="#ffffff" opacity="0.12"/>
  <circle cx="1120" cy="60" r="90" fill="#ffffff" opacity="0.10"/>
  <text x="120" y="76" font-size="62" text-anchor="middle" dominant-baseline="central">$emo</text>
  <text x="220" y="55" font-family="Ubuntu, Arial, sans-serif" font-size="30" font-weight="700" fill="#ffffff">$title</text>
  <text x="220" y="86" font-family="Ubuntu, Arial, sans-serif" font-size="17" font-weight="500" fill="#ffffff" opacity="0.95">$sub</text>
  <rect x="980" y="42" width="150" height="36" rx="18" fill="#ffffff"/>
  <text x="1055" y="65" font-family="Ubuntu, Arial, sans-serif" font-size="15" font-weight="700" fill="$c1" text-anchor="middle">$cta &#8594;</text>
</svg>
"@
    New-SvgFile $name $svg
}

New-WideBanner 'band-gift' '#BE1D3E' '#8E1230' 'Super Weekend Sale' 'Up to 70% off across every aisle. Ends Sunday.' 'Shop Now' 0x1F381 | Out-Null

function New-DealPopup([string]$name) {
    $svg = @"
<svg xmlns="http://www.w3.org/2000/svg" width="440" height="470" viewBox="0 0 440 470">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#2563EB"/>
      <stop offset="1" stop-color="#1D4ED8"/>
    </linearGradient>
  </defs>
  <rect width="440" height="470" fill="url(#g)"/>
  <circle cx="70" cy="30" r="130" fill="#ffffff" opacity="0.10"/>
  <circle cx="390" cy="450" r="150" fill="#ffffff" opacity="0.10"/>
  <rect x="140" y="26" width="160" height="28" rx="14" fill="#ffffff" opacity="0.2"/>
  <text x="220" y="45" font-family="Ubuntu, Arial, sans-serif" font-size="14" font-weight="700" fill="#ffffff" letter-spacing="2" text-anchor="middle">DEAL OF THE DAY</text>
  <g>
    <rect x="90" y="76" width="260" height="240" rx="22" fill="#ffffff" opacity="0.96"/>
    <text x="220" y="212" font-size="170" text-anchor="middle" dominant-baseline="central">&#127881;</text>
  </g>
  <text x="220" y="344" font-family="Ubuntu, Arial, sans-serif" font-size="26" font-weight="700" fill="#ffffff" text-anchor="middle">Daily Mega Sale</text>
  <text x="220" y="374" font-family="Ubuntu, Arial, sans-serif" font-size="15" fill="#ffffff" opacity="0.94" text-anchor="middle">Biggest drops. Starter prices. Today only.</text>
  <g>
    <rect x="96" y="396" width="56" height="44" rx="8" fill="#ffffff"/>
    <text x="124" y="412" font-family="Ubuntu, Arial, sans-serif" font-size="18" font-weight="700" fill="#BE1D3E" text-anchor="middle">07</text>
    <text x="124" y="431" font-family="Ubuntu, Arial, sans-serif" font-size="11" fill="#6b7280" text-anchor="middle">h</text>
    <rect x="164" y="396" width="56" height="44" rx="8" fill="#ffffff"/>
    <text x="192" y="412" font-family="Ubuntu, Arial, sans-serif" font-size="18" font-weight="700" fill="#BE1D3E" text-anchor="middle">58</text>
    <text x="192" y="431" font-family="Ubuntu, Arial, sans-serif" font-size="11" fill="#6b7280" text-anchor="middle">m</text>
    <rect x="232" y="396" width="56" height="44" rx="8" fill="#ffffff"/>
    <text x="260" y="412" font-family="Ubuntu, Arial, sans-serif" font-size="18" font-weight="700" fill="#BE1D3E" text-anchor="middle">12</text>
    <text x="260" y="431" font-family="Ubuntu, Arial, sans-serif" font-size="11" fill="#6b7280" text-anchor="middle">s</text>
    <rect x="300" y="396" width="56" height="44" rx="8" fill="#ffffff"/>
    <text x="328" y="412" font-family="Ubuntu, Arial, sans-serif" font-size="18" font-weight="700" fill="#BE1D3E" text-anchor="middle">:58</text>
    <text x="328" y="431" font-family="Ubuntu, Arial, sans-serif" font-size="11" fill="#6b7280" text-anchor="middle">ss</text>
  </g>
</svg>
"@
    New-SvgFile $name $svg
}

New-DealPopup 'deal-popup' | Out-Null

# ---------------- flag ----------------
$flag = @"
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="16" viewBox="0 0 24 16">
  <rect width="24" height="16" fill="#000000"/>
  <rect y="3.1" width="24" height="9.8" fill="#FCDD09"/>
  <rect y="4.6" width="24" height="6.8" fill="#D90000"/>
  <circle cx="13" cy="8" r="3.4" fill="#FCDD09"/>
</svg>
"@
New-SvgFile 'flag' $flag

Write-Host 'All images generated.'