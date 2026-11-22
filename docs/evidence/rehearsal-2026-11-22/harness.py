"""Fresh-run rehearsal in a disposable game: the installed game's files in a throwaway Chrome, the real
save from this morning's entry, today's scripts, and the real watchdog code pointed at that copy.
The copy's Remote API is switched off so it can never take the live daemon's connection."""
import functools, gzip, json, subprocess, sys, threading, time, urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

R = Path('/Volumes/ExternalData/BitBurner')
S = Path(__file__).resolve().parent
sys.path.insert(0, str(R / 'tools'))
import websocket
import game_terminal as gt
import run_page_data as rpd
import watchdog_mac as W

APP = Path.home() / 'Library/Application Support/Steam/steamapps/common/Bitburner/bitburner.app/Contents/Resources/app'
WEB, CDP = 8795, 9333
t0 = time.time()
def say(*a): print(time.strftime('%H:%M:%S'), f'+{(time.time()-t0)/60:.1f}m', *a, flush=True)

save = json.loads(gzip.open(R / 'saves/bn12-run2-entered-20261122.json.gz').read())
D = save['data']
settings = json.loads(D['SettingsSave'])
settings.update(RemoteFileApiAddress='invalid.invalid', RemoteFileApiPort=0, RemoteFileApiReconnectionDelay=0)
D['SettingsSave'] = json.dumps(settings)
P = json.loads(D['PlayerSave'])
now = int(time.time() * 1000)
P['data'].update(lastUpdate=now, lastSave=now)
D['PlayerSave'] = json.dumps(P)
servers = json.loads(D['AllServersSave'])
home = servers['home']['data']
scripts, texts = dict(home['scripts']['data']), dict(home['textFiles']['data'])
manifest = json.loads((R / 'sync_manifest.json').read_text())['files']
for name, src in manifest.items():
    code = (R / src).read_text()
    table, field = (scripts, 'code') if name.endswith(('.js', '.jsx', '.ts', '.tsx')) else (texts, 'text')
    item = json.loads(json.dumps(table.get(name) or next(iter(table.values()))))
    item['data'].update({field: code, 'filename': name})
    table[name] = item
texts['sync_manifest.json'] = texts.get('sync_manifest.json') or next(iter(texts.values()))
texts['sync_manifest.json'] = json.loads(json.dumps(texts['sync_manifest.json']))
texts['sync_manifest.json']['data'].update(filename='sync_manifest.json', text=(R / 'sync_manifest.json').read_text())
home['scripts']['data'], home['textFiles']['data'] = list(scripts.items()), list(texts.items())
D['AllServersSave'] = json.dumps(servers)
blob = gzip.compress(json.dumps(save).encode())
say('save prepared: files replaced', len(manifest))

class H(SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        if self.path == '/__save':
            self.send_response(200); self.send_header('Content-Length', str(len(blob))); self.end_headers()
            self.wfile.write(blob)
        else:
            super().do_GET()
web = ThreadingHTTPServer(('127.0.0.1', WEB), functools.partial(H, directory=str(APP)))
threading.Thread(target=web.serve_forever, daemon=True).start()

import tempfile
prof = Path(tempfile.mkdtemp(prefix='bb-rehearsal-'))
chrome = subprocess.Popen(['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '--headless=new',
    f'--user-data-dir={prof}', f'--remote-debugging-port={CDP}', '--remote-debugging-address=127.0.0.1',
    '--no-first-run', '--no-default-browser-check', '--mute-audio', '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
    f'http://127.0.0.1:{WEB}/exit.html'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def page():
    tabs = json.load(urllib.request.urlopen(f'http://127.0.0.1:{CDP}/json', timeout=5))
    t = next(t for t in tabs if t['type'] == 'page' and f':{WEB}' in t['url'])
    return websocket.create_connection(t['webSocketDebuggerUrl'], timeout=90, suppress_origin=True)
def terminal(cmd, settle='4'):
    d = subprocess.run([sys.executable, str(R / 'tools/game_terminal.py'), cmd, '--port', str(CDP), '--settle', settle],
                       capture_output=True, text=True, timeout=90)
    return d.returncode == 0, (d.stdout or d.stderr).replace('\n', ' ')

try:
    time.sleep(6)
    ws = page()
    say('import:', gt.evaluate(ws, 1, """(async () => {
      const bytes = new Uint8Array(await (await fetch('/__save')).arrayBuffer());
      await new Promise((ok, bad) => {
        const open = indexedDB.open('bitburnerSave', 1);
        open.onupgradeneeded = () => open.result.createObjectStore('savestring');
        open.onerror = () => bad(open.error);
        open.onsuccess = () => { const tx = open.result.transaction('savestring', 'readwrite');
          tx.objectStore('savestring').put(bytes, 'save');
          tx.oncomplete = () => { open.result.close(); ok() }; tx.onerror = () => bad(tx.error) };
      });
      setTimeout(() => location.href = '/index.html', 300);
      return 'saved ' + bytes.length })()"""))
    ws.close()
    folder = prof / f'Default/IndexedDB/http_127.0.0.1_{WEB}.indexeddb.blob'
    time.sleep(25)
    state, seen, s, said, killed, last = {}, None, None, None, False, 0
    minutes = float(sys.argv[1]) if len(sys.argv) > 1 else 24
    while time.time() - t0 < minutes * 60:
        try:
            found = rpd.newest_blob(folder)
            if found and found != seen:
                s = rpd.state_from_save(rpd.decode_blob(found[1].read_bytes())); seen = found
            if s:
                action, reason, state = W.decide(s, time.time(), state, False, W.active_bitnodes())
                if reason != said: say('watchdog', action, reason)
                said = reason
                if action == 'restart':
                    ok, out = terminal('home; run startup.js')
                    state = W.restarted(state, s, ok, time.time())
                    say('RESTART', ok, out[:3000])
                if time.time() - last >= 120:
                    last = time.time()
                    say('state', json.dumps({'money': round(s['money']), 'ram': s['homeRam'], 'work': s['work'],
                        'sleeves': sorted({x['task'] for x in s['sleeves']}), 'karma': round(s['karma']), 'scripts': s['scripts']}))
        except Exception as e:
            say('err', repr(e))
        time.sleep(20)
finally:
    chrome.terminate()
    web.shutdown()
    say('done')
