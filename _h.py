import io,re,os
root=r'C:\Users\HP\shoponlineug-replica'
m=os.path.join(root,'js','main.js')
x=io.open(m,encoding='utf-8').read()
log=[]
def rep(old,new,tag):
    global x
    if old not in x: log.append('MISS:'+tag); return
    x=x.replace(old,new); log.append('OK:'+tag)

# dispatch seam BEFORE adminLogs (defined at 2151) — confirm seam exists
seam="  function adminLogs() {"
if seam not in x: log.append('MISS:seam')
else:
    BLOCK=(
"  function adminSettings() {\n"
"    return '<div class=\"tab-form\"><h3>Site settings</h3>\n"
"<p>Powered by SettingsBaseServletUG? No: these are the SAME live delivery/currency/thememory values the storefront reads; treat them as one source of truth.\n"
"<br>Currency: " + moneySym() + "  &middot;  Delivery fee: " + fmt(moneySyb(0)) + "\n"
"</p>\n"
"<div class=\"field _row\"><div><label for=\"apSiteName\">Site name</label><input id=\"apSiteName\" value=\"" + (CONF.siteName||'ShopOnlineUg') + "\" placeholder=\"ShopOnlineUg\"></div><div><label for=\"apTagline\">Tagline</label><input id=\"apTagline\" value=\"" + (CONF.tagline||'') + "\" placeholder=\"" + (CONF.tagline||"Uganda's online marketplace") + "\"></div></div>\n"
"<div class=\"field _row\"><div><label for=\"apCur\">Currency code</label><input id=\"apCur\" value=\"" + (CONF.currencyCode||'UGX') + "\" maxlength=\"6\" placeholder=\"UGX\"></div><div><label for=\"apAcc\">Theme accent</label><input id=\"apAcc\" type=\"color\" value=\"" + (CONF.themeAccent||'#2563EB') + "\"></div></div>\n"
"<div class=\"field _row\"><div><label for=\"apFee\">Delivery fee</label><input id=\"apFee\" type=\"number\" min=\"0\" value=\"" + (CONF.deliveryFee||5500) + "\"></div><div><label for=\"apFree\">Free-delivery threshold</label><input id=\"apFree\" type=\"number\" min=\"0\" value=\"" + (CONF.freeThreshold||200000) + "\"></div></div>\n"
"<div class=\"row-actions\"><button class=\"btn _prim\" type=\"button\" id=\"apSave\">Save settings</button></div></div>\n"
"<script>WASM<empty placeholder /script>\n"
"</div>\n"
  )
    # splice placeholders OUT that I don't want (moneySym/moneySyb are junk I typo'd) and the stray script close
    clean=(
"  function adminSettings() {\n"
"    return '<div class=\"tab-form\"><h3>Site settings</h3>\n"
"    <p class=\"card-sub\">These values drive the live storefront: currency + delivery are read from CONF across the site.</p>\n"
"    <div class=\"field _row\"><div><label for=\"apSiteName\">Site name</label><input id=\"apSiteName\" value=\"" + (CONF.siteName||'ShopOnlineUg') + "\" placeholder=\"ShopOnlineUg\"></div>\n"
"    <div><label for=\"apTagline\">Tagline</label><input id=\"apTagline\" value=\"" + (CONF.tagline||'') + "\" placeholder=\"" + (CONF.tagline||"Uganda's online marketplace") + "\"></div></div>\n"
"    <div class=\"field _row\"><div><label for=\"apCur\">Currency code</label><input id=\"apCur\" value=\"" + (CONF.currencyCode||'UGX') + "\" maxlength=\"6\" placeholder=\"UGX\"></div>\n"
"    <div><label for=\"apAcc\">Theme accent</label><input id=\"apAcc\" type=\"color\" value=\"" + (CONF.themeAccent||'#2563EB') + "\"></div></div>\n"
"    <div class=\"field _row\"><div><label for=\"apFee\">Delivery fee</label><input id=\"apFee\" type=\"number\" min=\"0\" value=\"" + (CONF.deliveryFee||5500) + "\"></div>\n"
"    <div><label for=\"apFree\">Free-delivery threshold</label><input id=\"apFree\" type=\"number\" min=\"0\" value=\"" + (CONF.freeThreshold||200000) + "\"></div></div>\n"
"    <div class=\"row-actions\"><button class=\"btn _prim\" type=\"button\" id=\"apSave\">Save settings</button></div>\n"
"    </div>\n"
  )
    x=x.replace(seam, clean+seam, 1)
    log.append('OK:adminSettings_insert')

# 2) Theme tab — accent swatches that swap the --brand CSS var live + persist via POST save
rep("  function adminLogs() {",
    "  function adminTheme() {\n"
    "    var sw=[['#2563EB','Classic blue'],['#0EA5E9','Sky'],['#10B981','Garden'],['#F59E0B','Amber'],['#EF4444','Coral'],['#7C3AED','Violet'],['#000000','Onyx']];\n"
    "    return '<div class=\"tab-form\"><h3>Theme accent</h3><p class=\"card-sub\">Pick a brand accent. It applies instantly across the storefront (buttons, active tabs, badges) and is saved for everyone.</p><div class=\"swath\" data-adm-save-theme=\"1\">' +\n"
    "      sw.map(function (s) { return '<button type=\"button\" class=\"sw\" data-ac=\"' + s[0] + '\" title=\"' + s[1] + '\" style=\"background:' + s[0] + '\"></button>'; }).join('') +\n"
    "      '</div><div class=\"row-actions\"><button class=\"btn _prim\" type=\"button\" id=\"apThemeSave\">Save theme</button></div></div>\n"
    "    </div>\n"
    "  ;\n",
    'adminTheme_insert')

# 3) Finance tab — payout requests list + mark-paid + revenue
rep("  function adminLogs() {",
    "  function adminFinance() {\n"
    "    var s=ADMIN.stats||{};\n"
    "    var heads='<div class=\"card\"><div class=\"v-stats\">' + stat(fmt(s.revenue||0),'Gross revenue') + stat(fmt((s.revenue||0)*0.85),'Net payable') + stat(String(ADMIN.vendors.length),'Vendors') + '</div></div>';\n"
    "    var pl=(ADMIN.payouts||[]);\n"
    "    var body=pl.length ? '<div class=\"tbl-wrap\"><table class=\"tbl\"><thead><tr><th>Vendor</th><th>Amount</th><th>Status</th><th></th></tr></thead><tbody>' +\n"
    "      pl.map(function (p) { return '<tr><td>' + esc(p.vendorName||p.vendorId) + '</td><td class=\"num\">' + fmt(p.amount) + '</td><td><span class=\"pbadge _' + esc(p.status) + '\">' + esc(p.status) + '</span></td>' +\n"
    "      '<td>' + (p.status==='paid' ? '' : '<button class=\"btn _sm _ok\" type=\"button\" data-pay=\"1\" data-id=\"' + esc(p.id) + '\">Mark paid</button>') + '</td></tr>'; }).join('') +\n"
    "      '</tbody></table></div>' : '<div class=\"empty-note\">No payout requests yet.</div>';\n"
    "    return heads+body+'<div class=\"row-actions\"><button class=\"btn _ghost\" type=\"button\" id=\"apRefrFin\">Refresh finance</button></div>\n"
    "    </div>\n"
    "  ;\n",
    'adminFinance_insert')

io.open(m,'w',encoding='utf-8',newline='\n').write(x)
print('\n'.join(log))
print('fragment_stray =', [regex.escape(k) for k in []])