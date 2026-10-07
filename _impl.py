import io,os,subprocess
p=r'C:\Users\HP\shoponlineug-replica\js\main.js'
t=io.open(p,encoding='utf-8').read()
log=[]
# remove the accidental _h.py bench fragments before anything (stray seams I created)
dropped=0
for frag in [r"<script>WASM<empty placeholder /script>", "moneySyb(", "moneySym(", "  function adminTheme() {\n    var sw=[['#2563EB']"]:
    n=t.count(frag)
    if n: t=t.replace(frag,""); dropped+=n
log.append("dropped_stray=%d" % dropped)

ANCH="  function adminLogs() {"
i=t.find(ANCH)
if i<0: log.append("MISS:anchor_adminLogs")
else:
    INS="""  function adminSettings() {
    var c = document.getElementById('adminPanel');
    if (!c) return '';
    var s = CONF;
    return '<div class="tab-form"><h3>Settings</h3><p class="card-sub">Live site-wide values read by the storefront.</p>' +
      '<div class="field _row"><div><label for="apSiteName">Site name</label><input id="apSiteName" value="' + esc(s.siteName) + '"></div>' +
      '<div><label for="apTagline">Tagline</label><input id="apTagline" value="' + esc(s.tagline) + '"></div></div>' +
      '<div class="field _row"><div><label for="apCur">Currency code</label><input id="apCur" value="' + esc(s.currencyCode) + '" maxlength="6"></div>' +
      '<div><label for="apAcc">Theme accent</label><input id="apAcc" type="color" value="' + esc(s.themeAccent || '#2563EB') + '"></div></div>' +
      '<div class="field _row"><div><label for="apFee">Delivery fee</label><input id="apFee" type="number" min="0" value="' + (s.deliveryFee || 5500) + '"></div>' +
      '<div><label for="apFree">Free-delivery threshold</label><input id="apFree" type="number" min="0" value="' + (s.freeThreshold || 200000) + '"></div></div>' +
      '<div class="row-actions"><button class="btn _prim" type="button" id="apSave">Save settings</button></div></div>';
  }
  function adminTheme() {
    var accent = CONF.themeAccent || '#2563EB';
    return '<div class="tab-form"><h3>Theme</h3><p class="card-sub">Pick the brand accent. It applies live and persists via Settings.</p>' +
      '<div class="swatches">' + ['#2563EB', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#7C3AED', '#000000'].map(function (c) {
        return '<button type="button" class="sw" data-ac="' + c + '" style="background:' + c + '" title="' + c + '"></button>';
      }).join('') + '</div>' +
      '<div class="row-actions"><button class="btn _prim" type="button" id="apThemeSave">Save theme accent</button></div></div>';
  }
  function adminFinance() {
    var s = CONF;
    var pay = (ADMIN.payouts || []).filter(function (p) { return p.status !== 'paid'; });
    var rows = pay.length ? pay.map(function (p) {
      return '<tr><td>' + esc(p.vendorName || p.vendorId) + '</td><td class="num">' + fmt(p.amount) + '</td>' +
        '<td><span class="pbadge _pending">' + (p.status || 'pending') + '</span></td>' +
        '<td><button type="button" class="btn _sm _ok" data-payp="' + esc(p.id) + '">Mark paid</button></td></tr>';
    }).join('') : '<tr><td colspan="4" class="empty-note">No pending payouts.</td></tr>';
    return '<div class="tab-form"><h3>Finance</h3><p class="card-sub">Pending vendor payouts. Marking paid records the payout and frees the vendor balance.</p>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Vendor</th><th>Amount</th><th>Status</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<div class="row-actions"><button class="btn _ghost" type="button" id="apRefrFin">Refresh</button></div></div>';
  }
  function saveSiteSettings() {
    var body = {
      siteName: document.getElementById('apSiteName').value.trim() || CONF.siteName,
      tagline: document.getElementById('apTagline').value.trim(),
      currencyCode: (document.getElementById('apCur').value.trim() || 'UGX').toUpperCase(),
      themeAccent: document.getElementById('apAcc').value,
      deliveryFee: Number(document.getElementById('apFee').value) || 5500,
      freeThreshold: Number(document.getElementById('apFree').value) || 200000
    };
    api('/admin/settings', { method: 'PUT', body: JSON.stringify(body) }).then(function () {
      applyConfig(body); showToast('Settings saved and applied storewide.');
    }).catch(function () { showToast('Could not save settings.'); });
  }
  function applyConfig(n) {
    for (var k in n) if (CONF.hasOwnProperty(k)) CONF[k] = n[k];
    if (n.themeAccent) document.documentElement.style.setProperty('--brand', n.themeAccent);
    refreshTotals();
  }
"""
    # insert before "  function adminLogs() {"
    t=t[:i]+INS+t[i:]
    log.append("inserted_renderers=yes")
    # dispatch: map settings/theme/finance -> fns (find the fn map line)
    if "settings: adminSettings, theme: adminTheme, finance: adminFinance" in t:
        log.append("dispatch_already_maps=yes")
    else:
        # patch the three map entries if the dispatch uses them by that exact key
        log.append("dispatch_map_needs_manual=see_gate")

# also wire tabbar? it already has the 3 buttons (healed). ensure dispatch line refs exist already via gateway check.
io.open(p,'w',encoding='utf-8',newline='\n').write(t)
# GATE: node --check + braces + stray gates + missing renderer defs
subprocess.run(['node','--check',p]).returncode==0
t2=io.open(p,encoding='utf-8').read()
ob=len(re.findall(r'\{',t2)); cb=len(re.findall(r'\}',t2))
stray=len(re.findall(r'\\n\'<', t2)) + len(re.findall(r"'<'button",t2))
missing=[]
for fn in ('adminSettings','adminTheme','adminFinance'):
    if ('function '+fn+'(') in t2 and (fn+': admin'+fn[5:]) in t2: pass
    elif ('function '+fn+'(') in t2: missing.append(fn+'(renderer_but_no_dispatch)')
    elif (fn+': admin'+fn[5:]) in t2: log.append(fn+'(dispatch_but_no_fn)')
print('\n'.join(log+['gate='+subprocess.run(['node','--check',p]).returncode.__str__(),'braces=%d=%d'%(ob,cb),'stray=%d'%stray,'missing='+('|'.join(missing) or 'none')]))
print(os.path.basename(p))
