#!/usr/bin/env python3
"""Read the Dark Net map from the Steam game's page and push a scout route.

The page holds the whole topology, including hosts no script has reached. This
opens the Dark Net view over DevTools (127.0.0.1:9222), reads each node's server
from React, finds the shortest path from the stasis-linked host or darkweb to the labyrinth and pushes
dnet_route.json to home for dnet_scout.js. Leaves the Terminal page open.
Run with --loop SECONDS while a chain is being guided; a route is stale after 10m.
"""
import argparse, asyncio, collections, json, subprocess, sys, time, urllib.request
from pathlib import Path

import websockets

REPO = Path(__file__).resolve().parents[3]  # profiles/bn15/tools/ -> repo root
READ_GRAPH = """(()=>{const out=[];for(const b of document.querySelectorAll('button')){
const k=Object.keys(b).find(k=>k.startsWith('__reactFiber'));if(!k)continue;let f=b[k];
for(let i=0;i<6&&f;i++,f=f.return){const s=f.memoizedProps?.server;if(s?.hostname){
out.push({host:s.hostname,depth:s.depth,admin:s.hasAdminRights,link:s.hasStasisLink,net:s.serversOnNetwork});break}}}
return JSON.stringify(out)})()"""
OPEN = "(name=>{const t=[...document.querySelectorAll('.MuiListItem-root,.MuiListItemButton-root,[role=button]')].find(e=>e.innerText.trim()==name);t?.click();return !!t})"


async def evaluate(ws, expression, await_promise=False, ids=iter(range(1, 10**6))):
    msg_id = next(ids)
    params = {"expression": expression, "returnByValue": True, "awaitPromise": await_promise}
    await ws.send(json.dumps({"id": msg_id, "method": "Runtime.evaluate", "params": params}))
    while True:
        reply = json.loads(await ws.recv())
        if reply.get("id") == msg_id:
            return reply["result"]["result"].get("value")


async def read_graph():
    pages = json.load(urllib.request.urlopen("http://127.0.0.1:9222/json"))
    url = next(p["webSocketDebuggerUrl"] for p in pages if p["type"] == "page")
    async with websockets.connect(url, max_size=None) as ws:
        # Focused work hides the sidebar and a running script refocuses within seconds,
        # so leave the work page, open the map and read it in one evaluate call.
        graph = json.loads(await evaluate(ws, f"""(async()=>{{
const away=[...document.querySelectorAll('button')].find(b=>b.innerText.trim()=='Do something else simultaneously');away?.click();
await new Promise(r=>setTimeout(r,300));{OPEN}('Dark Net');await new Promise(r=>setTimeout(r,1500));
const graph={READ_GRAPH};{OPEN}('Terminal');return graph}})()""", await_promise=True))
    return graph


def shortest_route(graph, start="darkweb"):
    links = {n["host"]: n["net"] for n in graph}
    queue, seen = collections.deque([[start]]), {start}
    while queue:
        path = queue.popleft()
        if path[-1].endswith("l4byr1nth"):
            return path
        for host in links.get(path[-1], []):
            if host not in seen and host in links:
                seen.add(host)
                queue.append(path + [host])
    return None


def push_route(route):
    file = REPO / "runtime" / "dnet_route.json"  # generated, gitignored
    file.parent.mkdir(exist_ok=True)
    file.write_text(json.dumps({"ts": int(time.time() * 1000), "path": route}))
    done = subprocess.run([sys.executable, str(REPO / "tools/bb_remote.py"), "ctl-push", "dnet_route.json", str(file)], capture_output=True, text=True)
    return done.stdout.strip() or done.stderr.strip()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--loop", type=float, default=0, help="repeat every N seconds")
    parser.add_argument("--dry-run", action="store_true", help="print without pushing")
    args = parser.parse_args()
    while True:
        graph = asyncio.run(read_graph())
        # A chain can start on the stasis-linked host, which is usually far closer.
        starts = [n["host"] for n in graph if n.get("link")] + ["darkweb"]
        route = next(filter(None, (shortest_route(graph, start) for start in starts)), None)
        print(time.strftime("%H:%M:%S"), len(graph), "nodes", route, flush=True)
        if route and not args.dry_run:
            print(push_route(route), flush=True)
        if not args.loop:
            return
        time.sleep(args.loop)


if __name__ == "__main__":
    main()
