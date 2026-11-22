"""Rehearsal of tools/finish_node.py in a disposable copy, profile switch and backup restore included.
Locks: a cloned tree (every write lands there); its own daemon on 12626/12627; headless Chrome on 9333 serving the
game from 127.0.0.1:8795 with every other name unresolvable; the real game's 9222/12526/12527 are never addressed."""
import functools, gzip, json, os, re, shutil, socket, subprocess, sys, threading, time, urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

R = Path('/Volumes/ExternalData/BitBurner'); S = Path(__file__).resolve().parent; T = S / 'tree'
PY = str(R / '.venv/bin/python3')
WEB, CDP, GAMEPORT, CTL, ORIGIN = 8795, 9333, 12626, 12627, 'http://127.0.0.1:8795'
APP = Path.home() / 'Library/Application Support/Steam/steamapps/common/Bitburner/bitburner.app/Contents/Resources/app'
for port in (WEB, CDP, GAMEPORT, CTL):
    with socket.socket() as k:
        assert k.connect_ex(('127.0.0.1', port)) != 0, f'port {port} is in use; refusing to start'

def say(*a): print(time.strftime('%H:%M:%S'), *a, flush=True)

# 1. cloned tree
if T.exists(): shutil.rmtree(T)
files = subprocess.run(['git', 'ls-files', '-co', '--exclude-standard'], cwd=R, capture_output=True, text=True).stdout.split('\n')
for f in filter(None, files):
    src = R / f
    if src.is_file():
        (T / f).parent.mkdir(parents=True, exist_ok=True); shutil.copy2(src, T / f)
for d in ('saves', 'runtime'): (T / d).mkdir(exist_ok=True)
(T / 'tools/watchdog.pause').unlink(missing_ok=True)
sys.path.insert(0, str(T / 'tools'))
import websocket, game_terminal as gt, run_page_data as rpd, save_export, finish_node as F  # from the clone
assert Path(F.__file__).resolve().is_relative_to(T)

READY = R / 'saves/bn12-world-daemon-ready-20261122.json.gz'
LOW = R / 'saves/pre-install-auto-20261122-1114.json.gz'

def prepare(src):
    save = json.loads(gzip.open(src).read()); D = save['data']
    c = json.loads(D['SettingsSave'])
    c.update(RemoteFileApiAddress='127.0.0.1', RemoteFileApiPort=GAMEPORT, RemoteFileApiReconnectionDelay=2, AutosaveInterval=15)
    D['SettingsSave'] = json.dumps(c)
    P = json.loads(D['PlayerSave']); now = int(time.time() * 1000)
    P['data'].update(lastUpdate=now, lastSave=now); D['PlayerSave'] = json.dumps(P)
    servers = json.loads(D['AllServersSave'])
    for v in servers.values():
        if isinstance(v.get('data'), dict) and 'runningScripts' in v['data']: v['data']['runningScripts'] = []
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
def start_daemon():
    return subprocess.Popen([PY, str(T / 'tools/bb_remote.py'), '--port', str(GAMEPORT), '--control-port', str(CTL),
                             '--log-file', str(T / 'runtime/daemon.log'), 'daemon'], cwd=T, stdout=open(S / 'daemon.out', 'a'), stderr=subprocess.STDOUT)
daemon = start_daemon()
prof = S / f'chrome-{int(time.time())}'
chrome = subprocess.Popen(['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '--headless=new',
    f'--user-data-dir={prof}', f'--remote-debugging-port={CDP}', '--remote-debugging-address=127.0.0.1',
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1', '--no-first-run', '--no-default-browser-check',
    '--mute-audio', '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows', f'{ORIGIN}/exit.html'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def page(expr, timeout=120):
    tabs = json.load(urllib.request.urlopen(f'http://127.0.0.1:{CDP}/json', timeout=5))
    url = next(t['webSocketDebuggerUrl'] for t in tabs if t['type'] == 'page' and t['url'].startswith(ORIGIN + '/'))
    ws = websocket.create_connection(url, timeout=timeout, suppress_origin=True)
    try:
        e = f'(async () => {{ if (location.host !== "127.0.0.1:{WEB}") throw new Error("not the copy"); return await ({expr}) }})()'
        ws.send(gt.cdp_message(1, 'Runtime.evaluate', {'expression': e, 'awaitPromise': True, 'returnByValue': True}))
        while True:
            m = json.loads(ws.recv())
            if m.get('id') == 1: break
        if 'error' in m or 'exceptionDetails' in m['result']: raise RuntimeError(json.dumps(m)[:900])
        return m['result']['result'].get('value')
    finally: ws.close()

def load(bytes_):
    page("(() => { setTimeout(() => location.href='/exit.html', 100); return 'leaving' })()"); time.sleep(4)
    blob['bytes'] = bytes_
    page(f"""(async () => {{ const b = new Uint8Array(await (await fetch('/__save?{time.time()}')).arrayBuffer());
      await new Promise((ok, bad) => {{ const o = indexedDB.open('bitburnerSave');
        o.onupgradeneeded = () => {{ if (!o.result.objectStoreNames.contains('savestring')) o.result.createObjectStore('savestring') }}; o.onerror = () => bad(o.error);
        o.onsuccess = () => {{ const tx = o.result.transaction('savestring', 'readwrite'); tx.objectStore('savestring').put(b, 'save');
          tx.oncomplete = () => {{ o.result.close(); ok() }}; tx.onerror = () => bad(tx.error) }} }});
      setTimeout(() => location.href='/index.html', 100); return 'saved' }})()""")
    time.sleep(22); connected()

def ctl(req, timeout=30):
    with socket.create_connection(('127.0.0.1', CTL), timeout=5) as s:
        s.settimeout(timeout); s.sendall((json.dumps(req) + '\n').encode()); buf = b''
        while not buf.endswith(b'\n'):
            c = s.recv(1 << 16)
            if not c: break
            buf += c
    return json.loads(buf)

def connected(secs=120):
    global daemon
    end = time.time() + secs
    kicked = False
    while time.time() < end:
        if not kicked and time.time() > end - secs + 30:
            # a reload in this copy can leave the old page's socket open; the copy's own daemon is restarted to drop it
            say('restarting the clone daemon'); daemon.terminate(); daemon.wait(10); time.sleep(2); daemon = start_daemon(); kicked = True
        try:
            if ctl({'cmd': 'status'}).get('result', {}).get('connected') and ctl({'cmd': 'get', 'file': '/startup.js'}, 20).get('ok'): return True
        except OSError: pass
        time.sleep(2)
    raise RuntimeError('copy never connected to the clone daemon')

def state():
    save = save_export.decode(save_export.read_raw(CDP)); return rpd.state_from_save(save), F.sf_levels(save)

def brief(s):
    return {k: s[k] for k in ('node', 'nodeResetAt', 'sfLevel', 'installed', 'redPill')} | {'hacking': s['skills']['hacking'], 'scripts': sorted(s['scripts'])[:8]}

def driver(*args, timeout=1500):
    env = dict(os.environ, BB_CDP_PORT=str(CDP))
    d = subprocess.run([PY, str(T / 'tools/finish_node.py'), *args, '--copy', '--cdp-port', str(CDP), '--control-port', str(CTL)],
                       cwd=T, capture_output=True, text=True, env=env, timeout=timeout)
    say(f'driver {" ".join(args)} -> exit {d.returncode}\n' + (d.stdout + d.stderr).strip()[-3000:])
    return d.returncode, d.stdout + d.stderr

def game_files():
    r = ctl({'cmd': 'list'}, 30); return set(r.get('result') or [])

def restore(path):
    """The web build's Options > Import Game > Compare Save reaches the same ImportSave page (Proceed with import,
    Confirm) and saveObject.importGame as the Steam game's File > Load From File."""
    blob['bytes'] = path.read_bytes()
    r = page("""(async () => { const item = [...document.querySelectorAll('[role=button], .MuiListItemButton-root, .MuiListItem-root')].filter(e => e.innerText.trim() === 'Options')[0];
      if (!item) return 'no Options item'; item.click(); return 'options' })()""")
    say('restore', r); time.sleep(2)
    r = page(f"""(async () => {{ const b = new Uint8Array(await (await fetch('/__save?{time.time()}')).arrayBuffer());
      const input = document.getElementById('import-game-file-selector'); if (!input) return 'no import input';
      const dt = new DataTransfer(); dt.items.add(new File([b], '{path.name}')); input.files = dt.files;
      input.dispatchEvent(new Event('change', {{ bubbles: true }})); return 'file given' }})()""")
    say('restore', r); time.sleep(4)
    for label in ('Compare Save', 'Proceed with import', 'Confirm'):
        r = page(f"""(async () => {{ const b = [...document.querySelectorAll('button')].filter(e => e.innerText.trim() === {json.dumps(label)});
          if (b.length !== 1) return 'buttons: ' + [...document.querySelectorAll('button')].map(e => e.innerText.trim()).filter(Boolean).join('|').slice(0, 400);
          b[0].click(); return 'clicked' }})()""")
        say('restore', label, r); time.sleep(4)
    time.sleep(20); connected()

results = []
def check(name, ok, detail):
    results.append((name, bool(ok))); say('PASS' if ok else 'FAIL', name, json.dumps(detail, default=str)[:1500])

try:
    time.sleep(6)
    ready = prepare(READY)
    load(ready); s0, sf0 = state(); say('copy loaded', brief(s0), sf0)
    assert s0['node'] == 12 and s0['redPill']

    # refusals, driver side, in the copy
    load(prepare(LOW))
    code, out = driver('--next', '12', '--go')
    check('low save: driver refuses pill and hacking, changes nothing', code == 2 and 'Red Pill' in out and 'below' in out and state()[0]['nodeResetAt'] == rpd.state_from_save(save_export.decode(gzip.decompress(prepare(LOW)))) ['nodeResetAt'], out[-400:])
    load(ready)
    code, out = driver('--next', '10', '--go')
    check('off-route: driver refuses', code == 2 and 'not on docs/route.md' in out, out[-300:])
    code, out = driver('--next', '13', '--go')
    check('on route, no profile yet: driver refuses', code == 2 and 'no single profile' in out, out[-300:])
    code, out = driver('--next', '11', '--go')
    check('no profile: driver refuses', code == 2 and 'no single profile' in out, out[-300:])

    # refusals, script side (the driver's checks bypassed on purpose)
    connected()
    push = ctl({'cmd': 'push', 'file': '/finish_node.js', 'content': (T / 'tools/finish_node.js').read_text()})
    check('script pushed to the copy', push.get('ok'), push)
    for name, cmd, why in (('stale run', f'run finish_node.js 12 startup.js 123', 'not the run'),
                           ('missing callback', f'run finish_node.js 12 nothere.js {s0["nodeResetAt"]}', 'no callback')):
        page(gt.TYPE_AND_ENTER % {'cmd': json.dumps('home; ' + cmd), 'settle_ms': 4000})
        got = ctl({'cmd': 'get', 'file': '/finish_node.json'}).get('result')
        st = state()[0]
        check(f'script refuses: {name}', why in str(got) and st['node'] == 12 and st['nodeResetAt'] == s0['nodeResetAt'], got)
    ctl({'cmd': 'delete', 'file': '/finish_node.js'})

    # A: BN12 -> BN12, same profile, callback
    load(ready); pre, sfpre = state()
    before = set((T / 'saves').glob('pre-finish-*'))
    code, out = driver('--next', '12', '--go')
    s, sf = state()
    check('A: BN12 to BN12 finishes, enters, residents run', code == 0 and s['node'] == 12 and s['nodeResetAt'] > pre['nodeResetAt'] and sf.get(12, 0) == sfpre.get(12, 0) + 1 and F.RESIDENTS & set(s['scripts']), [brief(s), sf])
    check('A: script removed, pause removed', 'finish_node.js' not in game_files() and not (T / 'tools/watchdog.pause').exists(), sorted(game_files())[:5])
    ap = json.loads((T / 'tools/install_approvals.json').read_text())['approved'][-1]
    check('A: installs approved for the new run, quoting the handover', ap['node'] == 12 and ap["run"] == sf.get(12, 0) + 1 and ap['nodeResetAt'] == s['nodeResetAt'] and 'its in your hands' in ap['ken'], ap)
    backup = sorted(set((T / 'saves').glob('pre-finish-*')) - before)[-1]
    restore(backup); r, rsf = state()
    check('A: Load From File restores the backup exactly', r['node'] == 12 and r['nodeResetAt'] == pre['nodeResetAt'] and r['redPill'] and rsf == sfpre and r['installed'] == pre['installed'], [brief(r), rsf])

    # B: BN12 -> BN10, profile switch, no callback. The clone's route gains BitNode 10 for this alone.
    route = (T / 'docs/route.md').read_text()
    (T / 'docs/route.md').write_text(route.replace('| 8 | 13 |', '| 8 | 13 |', 1) + '', encoding='utf-8')
    rt = route.splitlines(); i = max(k for k, l in enumerate(rt) if re.match(r'^\| *\d+ *\| *\d+ *\|', l))
    rt.insert(i + 1, '| 9 | 10 | 1 | rehearsal only (clone) | none |'); (T / 'docs/route.md').write_text('\n'.join(rt) + '\n')
    load(ready); pre, sfpre = state()
    before = set((T / 'saves').glob('pre-finish-*'))
    code, out = driver('--next', '10', '--go')
    s, sf = state()
    man = json.loads((T / 'sync_manifest.json').read_text())
    check('B: BN12 to BN10 finishes and enters', s['node'] == 10 and sf.get(12, 0) == sfpre.get(12, 0) + 1, [brief(s), sf])
    check('B: profile switched to bn10, startup run, residents up', code == 0 and man['profile'] == 'bn10' and F.RESIDENTS & set(s['scripts']), [man['profile'], s['scripts']])
    want = set(man['files'])
    have = game_files()
    check('B: the game holds the bn10 profile files, no finish script', want <= {x.lstrip('/') for x in have} and 'finish_node.js' not in {x.lstrip('/') for x in have}, sorted(want - {x.lstrip('/') for x in have})[:10])
    ap = json.loads((T / 'tools/install_approvals.json').read_text())['approved'][-1]
    check('B: installs approved for BitNode 10 run', ap['node'] == 10 and ap['nodeResetAt'] == s['nodeResetAt'], ap)
    backup = sorted(set((T / 'saves').glob('pre-finish-*')) - before)[-1]
    restore(backup); r, rsf = state()
    check('B: Load From File restores BN12 exactly', r['node'] == 12 and r['nodeResetAt'] == pre['nodeResetAt'] and rsf == sfpre, [brief(r), rsf])
except Exception:
    import traceback; say('ERROR', traceback.format_exc())
finally:
    chrome.terminate(); daemon.terminate(); web.shutdown()
    say('TOTAL', sum(ok for _, ok in results), 'of', len(results))
