"""Stock engine in a disposable copy: Remote API off, names unresolvable, own ports; the real game is never addressed.
Starts from the BN12 World-Daemon-ready save with cash set to START, no 4S access, only the engine running."""
import functools, gzip, json, socket, subprocess, sys, threading, time, urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

R = Path('/Volumes/ExternalData/BitBurner'); S = Path(__file__).resolve().parent
sys.path.insert(0, str(R / 'tools'))
import websocket, game_terminal as gt, run_page_data as rpd
WEB, CDP, ORIGIN = 8796, 9334, 'http://127.0.0.1:8796'
START = float(sys.argv[1]) if len(sys.argv) > 1 else 1e12
MINUTES = float(sys.argv[2]) if len(sys.argv) > 2 else 30
APP = Path.home() / 'Library/Application Support/Steam/steamapps/common/Bitburner/bitburner.app/Contents/Resources/app'
for port in (WEB, CDP):
    with socket.socket() as k: assert k.connect_ex(('127.0.0.1', port)) != 0, f'port {port} in use'
def say(*a): print(time.strftime('%H:%M:%S'), *a, flush=True)

FILES = {'stock_engine.js': R / 'core/capital/stock_engine.js', 'stock_engine_logic.js': R / 'core/capital/stock_engine_logic.js',
         'stock_config.json': None, 'aug_install.js': R / 'core/player/aug_install.js',
         'aug_install_logic.js': R / 'core/player/aug_install_logic.js', 'graft_logic.js': R / 'core/player/graft_logic.js',
         'install_advisor_logic.js': R / 'core/player/install_advisor_logic.js'}
CONFIG = json.dumps({"enabled": True, "trade": True, "reserveCash": 0, "investFraction": 0.9})

def prepare():
    save = json.loads(gzip.open(R / 'saves/bn12-world-daemon-ready-20261122.json.gz').read()); D = save['data']
    c = json.loads(D['SettingsSave']); c.update(RemoteFileApiAddress='invalid.invalid', RemoteFileApiPort=0, AutosaveInterval=15)
    D['SettingsSave'] = json.dumps(c)
    P = json.loads(D['PlayerSave']); now = int(time.time() * 1000)
    P['data'].update(lastUpdate=now, lastSave=now, money=START)
    P['data']['has4SDataTixApi'] = False
    D['PlayerSave'] = json.dumps(P)
    servers = json.loads(D['AllServersSave']); h = servers['home']['data']
    for v in servers.values():
        if isinstance(v.get('data'), dict) and 'runningScripts' in v['data']: v['data']['runningScripts'] = []
    scripts, texts = dict(h['scripts']['data']), dict(h['textFiles']['data'])
    for name, path in FILES.items():
        body = CONFIG if path is None else path.read_text()
        table, field = (scripts, 'code') if name.endswith('.js') else (texts, 'text')
        item = json.loads(json.dumps(table.get(name) or next(iter(table.values()))))
        item['data'].update({field: body, 'filename': name}); table[name] = item
    for n in ('stock_engine_status.json', 'stock_liquidate.txt', 'augmentation_readiness.json'): texts.pop(n, None)
    h['scripts']['data'], h['textFiles']['data'] = list(scripts.items()), list(texts.items())
    D['AllServersSave'] = json.dumps(servers)
    return gzip.compress(json.dumps(save).encode())

blob = {'bytes': b''}
class H(SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        if self.path.startswith('/__save'):
            self.send_response(200); self.send_header('Content-Length', str(len(blob['bytes']))); self.end_headers(); self.wfile.write(blob['bytes'])
        else: super().do_GET()
web = ThreadingHTTPServer(('127.0.0.1', WEB), functools.partial(H, directory=str(APP)))
threading.Thread(target=web.serve_forever, daemon=True).start()
prof = S / f'chrome-{int(time.time())}'
chrome = subprocess.Popen(['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '--headless=new', f'--user-data-dir={prof}',
    f'--remote-debugging-port={CDP}', '--remote-debugging-address=127.0.0.1', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',
    '--no-first-run', '--no-default-browser-check', '--mute-audio', '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', f'{ORIGIN}/exit.html'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
folder = prof / f'Default/IndexedDB/http_127.0.0.1_{WEB}.indexeddb.blob'

def page(expr):
    tabs = json.load(urllib.request.urlopen(f'http://127.0.0.1:{CDP}/json', timeout=5))
    url = next(t['webSocketDebuggerUrl'] for t in tabs if t['type'] == 'page' and t['url'].startswith(ORIGIN + '/'))
    ws = websocket.create_connection(url, timeout=120, suppress_origin=True)
    try:
        e = f'(async () => {{ if (location.host !== "127.0.0.1:{WEB}") throw new Error("not the copy"); return await ({expr}) }})()'
        ws.send(gt.cdp_message(1, 'Runtime.evaluate', {'expression': e, 'awaitPromise': True, 'returnByValue': True}))
        while True:
            m = json.loads(ws.recv())
            if m.get('id') == 1: break
        if 'error' in m or 'exceptionDetails' in m['result']: raise RuntimeError(json.dumps(m)[:900])
        return m['result']['result'].get('value')
    finally: ws.close()

def read():
    for _ in range(10):
        try:
            save = rpd.decode_blob(rpd.newest_blob(folder)[1].read_bytes())
            t = dict(json.loads(save['data']['AllServersSave'])['home']['data']['textFiles']['data'])
            st = t.get('stock_engine_status.json')
            return rpd.state_from_save(save), json.loads(st['data']['text']) if st else None
        except Exception as e:
            err = e; time.sleep(2)
    raise err

try:
    time.sleep(6)
    page("(() => { setTimeout(() => location.href='/exit.html', 100); return 1 })()"); time.sleep(3)
    blob['bytes'] = prepare()
    page(f"""(async () => {{ const b = new Uint8Array(await (await fetch('/__save?{time.time()}')).arrayBuffer());
      await new Promise((ok, bad) => {{ const o = indexedDB.open('bitburnerSave');
        o.onupgradeneeded = () => {{ if (!o.result.objectStoreNames.contains('savestring')) o.result.createObjectStore('savestring') }};
        o.onsuccess = () => {{ const tx = o.result.transaction('savestring', 'readwrite'); tx.objectStore('savestring').put(b, 'save');
          tx.oncomplete = () => {{ o.result.close(); ok() }}; tx.onerror = () => bad(tx.error) }} }});
      setTimeout(() => location.href='/index.html', 100); return 1 }})()""")
    time.sleep(22)
    s, _ = read(); say('copy loaded, cash %.3g' % s['money'])
    say('mem', page(gt.TYPE_AND_ENTER % {'cmd': json.dumps('home; mem stock_engine.js'), 'settle_ms': 2000}).get('output', [])[-3:])
    out = page(gt.TYPE_AND_ENTER % {'cmd': json.dumps('home; run stock_engine.js'), 'settle_ms': 3000})
    say('run', out.get('output', [])[-2:])
    t0 = time.time(); series = []
    while time.time() - t0 < MINUTES * 60:
        time.sleep(60)
        s, st = read()
        if st:
            series.append((round((time.time() - t0) / 60, 1), st.get('netWorth'), st.get('mode'), len(st.get('holdings') or []), st.get('realized', {}).get('trades')))
            say('min %.1f net %.4g cash %.3g held %d trades %s mode %s %s' % (series[-1][0], st.get('netWorth') or 0, st.get('cash') or 0, series[-1][3], series[-1][4], st.get('mode'), st.get('access', '')))
    # liquidation by the install guard: aug_install --install must refuse while shares are held
    out = page(gt.TYPE_AND_ENTER % {'cmd': json.dumps('home; run aug_install.js --install'), 'settle_ms': 4000})
    say('install attempt', [l[:200] for l in out.get('output', [])[-3:]])
    for _ in range(6):
        time.sleep(15); s, st = read()
        say('after install attempt: node %s installed %s mode %s held %d holdingsValue %.3g cash %.4g' % (s['node'], s['installed'], st.get('mode'), len(st.get('holdings') or []), st.get('holdingsValue') or 0, st.get('cash') or 0))
        if not st.get('holdings'): break
    (S / f'series-{int(START)}.json').write_text(json.dumps(series))
except Exception:
    import traceback; say('ERROR', traceback.format_exc())
finally:
    chrome.terminate(); web.shutdown(); say('done')
