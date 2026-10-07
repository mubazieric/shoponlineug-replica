import io, re, os
root = r'C:\Users\HP\shoponlineug-replica'
m = root + r'\js\main.js'
x = io.open(m, encoding='utf-8').read()
log = []

def rep(old, new, tag, count=1, mode='plain'):
    global x
    if mode == 'regex':
        n = len(re.findall(old, x))
        if not n:
            log.append('MISS:' + tag); return
        x = re.sub(old, new, x, count=count)
        log.append('OK(%d):%s' % (n, tag))
    else:
        if old not in x:
            log.append('MISS:' + tag); return
        x = x.replace(old, new) if count == 0 else x.replace(old, new, count)
        log.append('OK:' + tag)

def siteMoney(kind, var):
    return '{ var v = ' + kind + '[]; return v ? v ' + var + ' : 0; }'

# 1) BROK: live delivery fee in PDP delivery info + help + delivery page (public text)
rep(
"Orders to Kampala and major towns are usually delivered within <b>24 - 48 hours</b>. Delivery is free for orders above <b>UGX 200,000</b>, otherwise a fee of UGX 5,500 applies.",
"Orders to Kampala and major towns are usually delivered within <b>24 - 48 hours</b>. Delivery is free for orders above <b>" + siteMoney('window.CONF || {}', '.freeThreshold') + "</b>, otherwise a fee of " + siteMoney('window.CONF || {}', '.deliveryFee') + " applies.",
'delivery_text_help')

rep(
"Delivery is free for orders above <b>UGX 200,000</b>, otherwise a fee of UGX 5,500 applies.",
"Delivery is free for orders above <b>" + siteMoney('window.CONF || {}', '.freeThreshold') + "</b>, otherwise a fee of " + siteMoney('window.CONF || {}', '.deliveryFee') + " applies.",
'delivery_text_pdp')

# 2) PDP "Free delivery on orders over UGX 200,000" text
rep(
"freeThreshold",
"CONF_DELIVERY",
'freeThreshold_direct')

# 3) admin tab bar: add Settings/Theme/Finance buttons
rep(
"'<button data-adm=\"logs\" class=\"' + (ADMIN.tab === 'logs' ? 'on' : '') + '\">Activity log</button>' +",
"'<button data-adm=\"logs\" class=\"' + (ADMIN.tab === 'logs' ? 'on' : '') + '\">Activity log</button>' +\\n'<'button data-adm=\"settings\" class=\"' + (ADMIN.tab === 'settings' ? 'on' : '') + '\">Settings</button>' +\\n'<'button data-adm=\"theme\" class=\"' + (ADMIN.tab === 'theme' ? 'on' : '') + '\">Theme</button>' +\\n'<'button data-adm=\"finance\" class=\"' + (ADMIN.tab === 'finance' ? 'on' : '') + '\">Finance</button>' +",
'admin_tabbar')

# 4) dispatch map
rep(
"orders: adminOrders, logs: adminLogs",
"orders: adminOrders, logs: adminLogs, settings: adminSettings, theme: adminTheme, finance: adminFinance",
'admin_dispatch')

# 5) ADMIN defaults + finals
rep(
"window.ADMIN = ADMIN;",
"window.ADMIN = ADMIN;\n  window.CONF = { siteName: 'ShopOnlineUg', tagline: \"Uganda's online marketplace\", currencyCode: 'UGX', currencySymbol: 'UGX ', deliveryFee: 5500, freeThreshold: 200000, bannerStripVisible: true, dealPopupVisible: true };\n  window.CURRENCY = function () { return window.CONF.currencySymbol; };\n  window.DELIVERY = function () { return { fee: window.CONF.deliveryFee, free: window.CONF.freeThreshold, freeAbove: window.CONF.freeThreshold }; };",
'admin_scope')

io.open(m, 'w', encoding='utf-8', newline='\n').write(x)
print('\n'.join(log))
